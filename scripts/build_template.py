#!/usr/bin/env python3
"""Maakt het paneel-masker voor een Tesla wrap-sjabloon.

Gebruik:
  python3 scripts/build_template.py <sjabloon.png> <uitvoermap> [opties]

Opties:
  --name "Naam"       weergavenaam in panels.json (standaard: Sjabloon)
  --size W H          schaal het sjabloon eerst naar deze afmeting (standaard: de eigen afmeting)
  --threshold N       een pixel is beschrijfbaar bij luminantie > N en alpha >= 128 (standaard: 128)
  --fill-holes        donkere gebieden die volledig binnen een paneel liggen, tellen ook als paneel
  --min-area N        kleinere gebieden zijn ruis (standaard: 300 px)
  --preview PAD.png   ter controle: de herkende panelen in kleur

Uitvoer in <uitvoermap>:
  mask.png     Grijswaarden-PNG op de sjabloonafmeting. Pixelwaarde = paneel-id (0 = buiten de panelen).
  panels.json  Naam, afmetingen, spiegelas (axis) en per paneel: naam, oppervlakte, bounding box,
               middelpunt en het spiegelpaneel (mirror, of null als er geen spiegelbeeld is).

Tesla-sjablonen (github.com/teslamotors/custom-wraps) hebben witte, beschrijfbare gebieden op een
transparante of zwarte achtergrond. Gebruik daarvoor de standaardwaarden.
"""
import argparse
import json
import os
from collections import deque

import numpy as np
from PIL import Image, ImageDraw


def label(mask):
    """Labelt samenhangende gebieden (4-connectiviteit). Geeft (labels, aantal)."""
    h, w = mask.shape
    flat = mask.ravel().tolist()
    lab = [0] * (h * w)
    n = 0
    for s in range(h * w):
        if not flat[s] or lab[s]:
            continue
        n += 1
        lab[s] = n
        queue = deque([s])
        while queue:
            p = queue.popleft()
            y, x = divmod(p, w)
            for ok, q in ((x > 0, p - 1), (x < w - 1, p + 1), (y > 0, p - w), (y < h - 1, p + w)):
                if ok and flat[q] and not lab[q]:
                    lab[q] = n
                    queue.append(q)
    return np.array(lab, dtype=np.int32).reshape(h, w), n


def position_name(cx, cy, w, h):
    vert = "boven" if cy < h / 3 else ("midden" if cy < 2 * h / 3 else "onder")
    horiz = "links" if cx < w / 3 else ("midden" if cx < 2 * w / 3 else "rechts")
    return f"{vert} {horiz}"


def mirror_mask(mask, axis):
    """Spiegelt een masker horizontaal om de lijn x = axis."""
    w = mask.shape[1]
    xm = np.round(2 * axis - np.arange(w)).astype(int)
    valid = (xm >= 0) & (xm < w)
    out = np.zeros_like(mask)
    out[:, valid] = mask[:, xm[valid]]
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("outdir")
    ap.add_argument("--name", default="Sjabloon")
    ap.add_argument("--size", nargs=2, type=int, metavar=("W", "H"))
    ap.add_argument("--threshold", type=int, default=128)
    ap.add_argument("--fill-holes", action="store_true")
    ap.add_argument("--min-area", type=int, default=300)
    ap.add_argument("--preview")
    args = ap.parse_args()

    im = Image.open(args.src).convert("RGBA")
    if args.size:
        im = im.resize(tuple(args.size), Image.LANCZOS)
    w, h = im.size
    rgba = np.asarray(im).astype(np.float32)
    lum = 0.299 * rgba[..., 0] + 0.587 * rgba[..., 1] + 0.114 * rgba[..., 2]
    paint = (rgba[..., 3] >= 128) & (lum > args.threshold)

    if args.fill_holes:
        bg_labels, _ = label(~paint)
        edge = np.unique(np.concatenate([bg_labels[0], bg_labels[-1], bg_labels[:, 0], bg_labels[:, -1]]))
        outside = np.isin(bg_labels, edge[edge > 0])
        enclosed = (~paint) & (~outside)
        print(f"ingesloten donkere gebieden dichtgemaakt als paneel: {label(enclosed)[1]}")
        paint = paint | enclosed

    comp, n = label(paint)
    sizes = np.bincount(comp.ravel(), minlength=n + 1)
    yy, xx = np.indices(comp.shape)
    cy = np.bincount(comp.ravel(), weights=yy.ravel(), minlength=n + 1) / np.maximum(sizes, 1)
    cx = np.bincount(comp.ravel(), weights=xx.ravel(), minlength=n + 1) / np.maximum(sizes, 1)

    keep = [l for l in range(1, n + 1) if sizes[l] >= args.min_area]
    keep.sort(key=lambda l: (round(cy[l] / 40), cx[l]))  # leesvolgorde: boven naar onder, links naar rechts
    if not keep:
        raise SystemExit("Geen paneel gevonden; controleer --threshold")
    if len(keep) > 255:
        raise SystemExit("Te veel panelen voor een 8-bit id-kaart")

    ids = np.zeros(comp.shape, dtype=np.uint8)
    panels = []
    for new_id, l in enumerate(keep, start=1):
        m = comp == l
        ids[m] = new_id
        ys, xs = np.nonzero(m)
        panels.append({
            "id": new_id,
            "name": f"Paneel {new_id}: {position_name(cx[l], cy[l], w, h)}",
            "area": int(sizes[l]),
            "bbox": [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1],
            "center": [round(float(cx[l]), 1), round(float(cy[l]), 1)],
        })

    # Symmetrie: de spiegelas van het hele voertuig, en per paneel het spiegelpaneel.
    paint_all = ids > 0
    candidates = np.arange(w / 2 - 15, w / 2 + 15.01, 0.5)
    scores = []
    for a in candidates:
        m = mirror_mask(paint_all, a)
        scores.append(np.logical_and(m, paint_all).sum() / max(1, np.logical_or(m, paint_all).sum()))
    axis = float(candidates[int(np.argmax(scores))])
    masks = {p["id"]: ids == p["id"] for p in panels}
    for p in panels:
        mirrored = mirror_mask(masks[p["id"]], axis)
        best_id, best_iou = None, 0.0
        for q in panels:
            inter = np.logical_and(mirrored, masks[q["id"]]).sum()
            union = np.logical_or(mirrored, masks[q["id"]]).sum()
            iou = inter / union if union else 0.0
            if iou > best_iou:
                best_id, best_iou = q["id"], iou
        p["mirror"] = best_id if best_iou >= 0.5 else None
    print(f"spiegelas x = {axis:.1f}; symmetrie:", ", ".join(f"{p['id']}->{p['mirror']}" for p in panels))

    os.makedirs(args.outdir, exist_ok=True)
    Image.fromarray(ids, mode="L").save(os.path.join(args.outdir, "mask.png"), optimize=True)
    with open(os.path.join(args.outdir, "panels.json"), "w", encoding="utf-8") as f:
        json.dump({"name": args.name, "width": w, "height": h, "axis": axis, "panels": panels},
                  f, ensure_ascii=False, indent=2)

    print(f"{len(panels)} panelen ({w} x {h}) geschreven naar {args.outdir}")
    for p in panels:
        print(f"  {p['id']:>2} {p['name']:<30} oppervlakte={p['area']:>6} bbox={p['bbox']}")
    edge_touch = ids[0].any() or ids[-1].any() or ids[:, 0].any() or ids[:, -1].any()
    print("raakt de rand van het canvas:", bool(edge_touch))

    if args.preview:
        flat = Image.alpha_composite(Image.new("RGBA", im.size, (0, 0, 0, 255)), im).convert("RGB")
        base = np.asarray(flat).astype(np.float32)
        palette = np.array([(230, 25, 75), (60, 180, 75), (255, 225, 25), (0, 130, 200), (245, 130, 48),
                            (145, 30, 180), (70, 240, 240), (240, 50, 230), (210, 245, 60), (250, 190, 212)], np.float32)
        color = palette[ids.astype(np.int32) % len(palette)]
        out = np.where(ids[..., None] > 0, 0.5 * base + 0.5 * color, base).astype(np.uint8)
        img = Image.fromarray(out)
        draw = ImageDraw.Draw(img)
        for p in panels:
            draw.text((p["center"][0] - 8, p["center"][1] - 8), str(p["id"]), fill=(255, 255, 255))
        img.save(args.preview)


if __name__ == "__main__":
    main()
