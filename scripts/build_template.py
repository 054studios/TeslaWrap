#!/usr/bin/env python3
"""Maakt het paneel-masker voor een Tesla wrap-sjabloon.

Gebruik:
  python3 scripts/build_template.py <sjabloon.jpg> <uitvoermap> [--name "Naam"] [--preview voorbeeld.png]

Uitvoer in <uitvoermap>:
  mask.png     1024x1024 grijswaarden-PNG. Pixelwaarde = paneel-id (0 = buiten de panelen).
  panels.json  Naam, oppervlakte, bounding box en middelpunt per paneel.

Het sjabloon wordt geschaald naar 1024x1024, zodat de paneelvormen exact
overeenkomen met de Tesla-export. Alles met luminantie <= BG_THRESHOLD telt als
zwarte achtergrond; ingesloten donkere details binnen een paneel worden meegenomen.
"""
import argparse
import json
import os
from collections import deque

import numpy as np
from PIL import Image, ImageDraw

SIZE = 1024
BG_THRESHOLD = 8   # luminantie (0-255) tot en met deze waarde = zwarte achtergrond
MIN_AREA = 300     # kleinere vlekken zijn ruis en worden weggelaten


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


def position_name(cx, cy):
    vert = "boven" if cy < SIZE / 3 else ("midden" if cy < 2 * SIZE / 3 else "onder")
    horiz = "links" if cx < SIZE / 3 else ("midden" if cx < 2 * SIZE / 3 else "rechts")
    return f"{vert} {horiz}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("src")
    ap.add_argument("outdir")
    ap.add_argument("--name", default="Sjabloon")
    ap.add_argument("--preview", help="Optioneel: PNG met de herkende panelen ter controle")
    args = ap.parse_args()

    gray = Image.open(args.src).convert("L").resize((SIZE, SIZE), Image.LANCZOS)
    lum = np.asarray(gray)

    panel = lum > BG_THRESHOLD
    bg_labels, _ = label(~panel)
    edge = np.unique(np.concatenate([bg_labels[0], bg_labels[-1], bg_labels[:, 0], bg_labels[:, -1]]))
    outside = np.isin(bg_labels, edge[edge > 0])
    enclosed = (~panel) & (~outside)
    filled = panel | enclosed

    hole_labels, hole_n = label(enclosed)
    hole_sizes = np.bincount(hole_labels.ravel())[1:] if hole_n else []
    print(f"ingesloten achtergrond-gebieden (dichtgemaakt als paneel): {hole_n}, grootste: {sorted(hole_sizes)[-5:] if hole_n else []}")

    comp, n = label(filled)
    sizes = np.bincount(comp.ravel(), minlength=n + 1)
    yy, xx = np.indices(comp.shape)
    cy = np.bincount(comp.ravel(), weights=yy.ravel(), minlength=n + 1) / np.maximum(sizes, 1)
    cx = np.bincount(comp.ravel(), weights=xx.ravel(), minlength=n + 1) / np.maximum(sizes, 1)

    keep = [l for l in range(1, n + 1) if sizes[l] >= MIN_AREA]
    keep.sort(key=lambda l: (round(cy[l] / 40), cx[l]))  # leesvolgorde: boven naar onder, links naar rechts
    if len(keep) > 255:
        raise SystemExit("Te veel panelen voor een 8-bit id-kaart")

    ids = np.zeros(comp.shape, dtype=np.uint8)
    panels = []
    for new_id, l in enumerate(keep, start=1):
        m = comp == l
        ids[m] = new_id
        ys, xs = np.nonzero(m)
        bbox = [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
        panels.append({
            "id": new_id,
            "name": f"Paneel {new_id}: {position_name(cx[l], cy[l])}",
            "area": int(sizes[l]),
            "bbox": bbox,
            "center": [round(float(cx[l]), 1), round(float(cy[l]), 1)],
        })

    os.makedirs(args.outdir, exist_ok=True)
    Image.fromarray(ids, mode="L").save(os.path.join(args.outdir, "mask.png"), optimize=True)
    with open(os.path.join(args.outdir, "panels.json"), "w", encoding="utf-8") as f:
        json.dump({"name": args.name, "size": SIZE, "panels": panels}, f, ensure_ascii=False, indent=2)

    print(f"{len(panels)} panelen geschreven naar {args.outdir}")
    for p in panels:
        print(f"  {p['id']:>2} {p['name']:<28} oppervlakte={p['area']:>6} bbox={p['bbox']}")
    edge_touch = ids[0].any() or ids[-1].any() or ids[:, 0].any() or ids[:, -1].any()
    print("raakt de rand van het canvas:", bool(edge_touch))

    if args.preview:
        base = np.asarray(Image.open(args.src).convert("RGB").resize((SIZE, SIZE), Image.LANCZOS)).astype(np.float32)
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
