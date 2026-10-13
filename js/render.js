// Tekent de lagen op het 1024 × 1024 canvas. Dezelfde code levert het voorbeeld en de export,
// dus wat je ziet is wat je downloadt.
import { makeCanvas } from './util.js';
import { maskFor } from './template.js';

export const FONTS = ['Arial Black', 'Impact', 'Georgia', 'Trebuchet MS', 'Verdana', 'Courier New'];

const measureCtx = makeCanvas(4).getContext('2d');

// --- penseelstreken -----------------------------------------------------------

function styleStroke(ctx, s) {
  ctx.globalCompositeOperation = s.e ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.c;
  ctx.fillStyle = s.c;
  ctx.lineWidth = s.w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

// Volledige streek, of een stip als er maar één punt is.
export function drawStroke(ctx, s) {
  const p = s.p;
  ctx.save();
  styleStroke(ctx, s);
  ctx.beginPath();
  if (p.length <= 2) {
    ctx.arc(p[0], p[1], s.w / 2, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  }
  ctx.restore();
}

// Alleen het nieuwe stuk, tijdens het tekenen.
export function drawSegment(ctx, s, x0, y0, x1, y1) {
  ctx.save();
  styleStroke(ctx, s);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

// Canvas van een tekenlaag. Wordt opnieuw opgebouwd uit de streken, bijvoorbeeld na ongedaan maken.
export function ensurePaint(scene, layer) {
  let canvas = scene.paint.get(layer.id);
  if (!canvas) {
    canvas = makeCanvas(scene.size);
    const ctx = canvas.getContext('2d');
    for (const s of layer.strokes) drawStroke(ctx, s);
    scene.paint.set(layer.id, canvas);
  }
  return canvas;
}

// --- afmetingen en hit-test -----------------------------------------------------

export function fontOf(layer) {
  return `${layer.bold ? 'bold ' : ''}${layer.size}px "${layer.font}", sans-serif`;
}

// Halve breedte en hoogte van een fotolaag, in canvas-pixels, na schaal.
export function imageBox(scene, layer) {
  const a = scene.assets.get(layer.asset);
  if (!a) return null;
  const s = layer.base * layer.zoom;
  return { hw: (a.w * s) / 2, hh: (a.h * s) / 2 };
}

export function textBox(layer) {
  measureCtx.font = fontOf(layer);
  return { hw: measureCtx.measureText(layer.text || ' ').width / 2, hh: (layer.size * 1.1) / 2 };
}

// Punt (x, y) in de lokale coördinaten van de laag (zonder verschuiving en rotatie).
function toLocal(layer, x, y) {
  const dx = x - layer.x;
  const dy = y - layer.y;
  const t = (layer.rot * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { lx: dx * c + dy * s, ly: -dx * s + dy * c };
}

// Bovenste zichtbare foto- of tekstlaag onder het punt, of null.
export function hitLayer(scene, x, y) {
  for (let i = scene.layers.length - 1; i >= 0; i--) {
    const l = scene.layers[i];
    if (!l.visible || (l.type !== 'image' && l.type !== 'text')) continue;
    const box = l.type === 'image' ? imageBox(scene, l) : textBox(l);
    if (!box) continue;
    const { lx, ly } = toLocal(l, x, y);
    const pad = l.type === 'text' ? 12 : 0;
    if (Math.abs(lx) <= box.hw + pad && Math.abs(ly) <= box.hh + pad) return l;
  }
  return null;
}

// --- compositie ---------------------------------------------------------------

function fillStyleOf(scene, layer, c) {
  if (!layer.gradient) return layer.color;
  const a = (layer.angle * Math.PI) / 180;
  const r = scene.size * 0.75;
  const mid = scene.size / 2;
  const g = c.createLinearGradient(mid - Math.cos(a) * r, mid - Math.sin(a) * r, mid + Math.cos(a) * r, mid + Math.sin(a) * r);
  g.addColorStop(0, layer.color);
  g.addColorStop(1, layer.color2);
  return g;
}

// Tekent de inhoud van één laag op c (zonder dekking en zonder paneelmasker).
function drawContent(scene, layer, c) {
  const S = scene.size;
  switch (layer.type) {
    case 'fill':
      c.fillStyle = fillStyleOf(scene, layer, c);
      c.fillRect(0, 0, S, S);
      break;
    case 'image': {
      const a = scene.assets.get(layer.asset);
      if (!a) break;
      const s = layer.base * layer.zoom;
      c.save();
      c.translate(layer.x, layer.y);
      c.rotate((layer.rot * Math.PI) / 180);
      c.scale(layer.flip ? -s : s, s);
      c.drawImage(a.img, -a.w / 2, -a.h / 2, a.w, a.h);
      c.restore();
      break;
    }
    case 'paint':
      c.drawImage(ensurePaint(scene, layer), 0, 0);
      break;
    case 'text':
      c.save();
      c.translate(layer.x, layer.y);
      c.rotate((layer.rot * Math.PI) / 180);
      c.font = fontOf(layer);
      c.fillStyle = layer.color;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(layer.text, 0, 0);
      c.restore();
      break;
  }
}

// Zet alle lagen samen en zet het resultaat op scene.out: zwart, met de wrap daarop, buiten de panelen zwart.
export function renderWrap(scene) {
  const { size: S, work, tmp, out } = scene;
  const w = work.getContext('2d');
  const t = tmp.getContext('2d');

  w.setTransform(1, 0, 0, 1, 0, 0);
  w.globalAlpha = 1;
  w.globalCompositeOperation = 'source-over';
  w.clearRect(0, 0, S, S);

  for (const layer of scene.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.globalAlpha = 1;
    t.globalCompositeOperation = 'source-over';
    t.clearRect(0, 0, S, S);
    drawContent(scene, layer, t);
    if (layer.panels) {
      t.globalCompositeOperation = 'destination-in';
      t.drawImage(maskFor(scene.tpl, layer.panels), 0, 0);
    }
    w.globalAlpha = layer.opacity;
    w.drawImage(tmp, 0, 0);
    w.globalAlpha = 1;
  }

  // Alles buiten de panelen weghalen en daarna op zwart zetten.
  w.globalCompositeOperation = 'destination-in';
  w.drawImage(maskFor(scene.tpl, null), 0, 0);
  w.globalCompositeOperation = 'source-over';

  const o = out.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalAlpha = 1;
  o.fillStyle = '#000';
  o.fillRect(0, 0, S, S);
  o.drawImage(work, 0, 0);
  return out;
}

// --- overlay (alleen voor de editor, niet in de export) ----------------------------

function selectionTint(scene) {
  const ids = [...scene.selPanels].sort((a, b) => a - b);
  const key = ids.join(',');
  if (scene.tintKey !== key) {
    const c = makeCanvas(scene.size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(47, 129, 247, 0.45)';
    ctx.fillRect(0, 0, scene.size, scene.size);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskFor(scene.tpl, ids), 0, 0);
    scene.tint = c;
    scene.tintKey = key;
  }
  return scene.tint;
}

function drawLabels(scene, c) {
  c.save();
  c.font = 'bold 22px system-ui, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineWidth = 5;
  c.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  c.fillStyle = '#fff';
  for (const p of scene.tpl.panels) {
    const [x, y] = p.center;
    c.strokeText(String(p.id), x, y);
    c.fillText(String(p.id), x, y);
  }
  c.restore();
}

function drawSelectionBox(scene, l, c) {
  const box = l.type === 'image' ? imageBox(scene, l) : textBox(l);
  if (!box) return;
  c.save();
  c.translate(l.x, l.y);
  c.rotate((l.rot * Math.PI) / 180);
  c.lineWidth = 6;
  c.setLineDash([18, 12]);
  c.strokeStyle = '#2f81f7';
  c.strokeRect(-box.hw, -box.hh, box.hw * 2, box.hh * 2);
  c.restore();
}

export function renderOverlay(scene, canvas, opts) {
  const S = scene.size;
  const c = canvas.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, S, S);
  if (opts.outlines) c.drawImage(scene.tpl.outline, 0, 0);
  if (scene.selPanels.size) c.drawImage(selectionTint(scene), 0, 0);
  if (opts.labels) drawLabels(scene, c);
  const l = scene.layers.find((x) => x.id === scene.selLayerId);
  if (l && l.visible && (l.type === 'image' || l.type === 'text')) drawSelectionBox(scene, l, c);
}
