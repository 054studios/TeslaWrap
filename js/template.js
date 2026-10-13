// Sjabloon = een masker van 1024 × 1024 px waarin elke pixel het paneel-id bevat
// (rood kanaal; 0 = buiten de panelen). Zie scripts/build_template.py.
import { makeCanvas, loadImage } from './util.js';

const MASK_CACHE_LIMIT = 40;

export async function loadTemplate(folder) {
  const [img, meta] = await Promise.all([
    loadImage(`${folder}/mask.png`),
    fetch(`${folder}/panels.json`).then((r) => {
      if (!r.ok) throw new Error(`sjabloon niet gevonden (${r.status})`);
      return r.json();
    }),
  ]);
  const size = meta.size;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, size, size);
  const px = ctx.getImageData(0, 0, size, size).data;
  const ids = new Uint8Array(size * size);
  for (let i = 0; i < ids.length; i++) ids[i] = px[i * 4];

  const tpl = {
    size,
    name: meta.name,
    panels: meta.panels,
    byId: new Map(meta.panels.map((p) => [p.id, p])),
    ids,
    maskCache: new Map(),
  };
  tpl.outline = buildOutline(tpl);
  return tpl;
}

// Paneel-id op een punt van het canvas (0 = buiten de panelen).
export function idAt(tpl, x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= tpl.size || yi >= tpl.size) return 0;
  return tpl.ids[yi * tpl.size + xi];
}

// Bounding box [x0, y0, x1, y1] van de gekozen panelen. Geen panelen = hele wrap.
export function boundsOf(tpl, ids) {
  if (!ids || !ids.length) return [0, 0, tpl.size, tpl.size];
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const id of ids) {
    const p = tpl.byId.get(id);
    if (!p) continue;
    x0 = Math.min(x0, p.bbox[0]);
    y0 = Math.min(y0, p.bbox[1]);
    x1 = Math.max(x1, p.bbox[2]);
    y1 = Math.max(y1, p.bbox[3]);
  }
  return Number.isFinite(x0) ? [x0, y0, x1, y1] : [0, 0, tpl.size, tpl.size];
}

// Masker als canvas: dekking 255 binnen de gekozen panelen, 0 erbuiten. null = alle panelen.
export function maskFor(tpl, ids) {
  const key = ids ? [...ids].sort((a, b) => a - b).join(',') : '*';
  const cached = tpl.maskCache.get(key);
  if (cached) return cached;

  const sel = new Uint8Array(256);
  if (ids) {
    for (const id of ids) sel[id] = 1;
  } else {
    sel.fill(1);
    sel[0] = 0;
  }

  const canvas = makeCanvas(tpl.size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(tpl.size, tpl.size);
  const d = img.data;
  for (let i = 0; i < tpl.ids.length; i++) {
    if (sel[tpl.ids[i]]) d.fill(255, i * 4, i * 4 + 4);
  }
  ctx.putImageData(img, 0, 0);

  if (tpl.maskCache.size >= MASK_CACHE_LIMIT) {
    tpl.maskCache.delete(tpl.maskCache.keys().next().value);
  }
  tpl.maskCache.set(key, canvas);
  return canvas;
}

// Donkere omlijning op de randen tussen panelen en achtergrond (en tussen panelen onderling).
function buildOutline(tpl) {
  const { size, ids } = tpl;
  const edge = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const id = ids[i];
      if (!id) continue;
      if (
        (x > 0 && ids[i - 1] !== id) ||
        (x < size - 1 && ids[i + 1] !== id) ||
        (y > 0 && ids[i - size] !== id) ||
        (y < size - 1 && ids[i + size] !== id)
      ) {
        edge[i] = 1;
      }
    }
  }

  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const paint = (j) => {
    d[j * 4] = 0;
    d[j * 4 + 1] = 0;
    d[j * 4 + 2] = 0;
    d[j * 4 + 3] = 140;
  };
  for (let i = 0; i < edge.length; i++) {
    if (!edge[i]) continue;
    paint(i);
    if (i + 1 < edge.length) paint(i + 1);
    if (i + size < edge.length) paint(i + size);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}
