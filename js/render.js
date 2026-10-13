// Tekent de lagen op het canvas van het gekozen sjabloon. Dezelfde code levert het voorbeeld
// en de export, dus wat je ziet is wat je downloadt.
import { makeCanvas } from './util.js';
import { maskFor } from './template.js';

export const FONTS = ['Arial Black', 'Impact', 'Georgia', 'Trebuchet MS', 'Verdana', 'Courier New'];

const measureCtx = makeCanvas(4).getContext('2d');
const hasSym = (s) => typeof s.sym === 'number';

// --- penseelstreken -----------------------------------------------------------

function styleStroke(ctx, s) {
  ctx.globalCompositeOperation = s.e ? 'destination-out' : 'source-over';
  ctx.strokeStyle = s.c;
  ctx.fillStyle = s.c;
  ctx.lineWidth = s.w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function paintPath(ctx, s, p) {
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

function paintSeg(ctx, s, x0, y0, x1, y1) {
  ctx.save();
  styleStroke(ctx, s);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.restore();
}

// Een streek met symmetrie (s.sym = spiegelas) wordt ook op de andere kant getekend.
export function drawStroke(ctx, s) {
  paintPath(ctx, s, s.p);
  if (hasSym(s)) paintPath(ctx, s, s.p.map((v, i) => (i % 2 === 0 ? 2 * s.sym - v : v)));
}

export function drawSegment(ctx, s, x0, y0, x1, y1) {
  paintSeg(ctx, s, x0, y0, x1, y1);
  if (hasSym(s)) paintSeg(ctx, s, 2 * s.sym - x0, y0, 2 * s.sym - x1, y1);
}

// Canvas van een tekenlaag. Wordt opnieuw opgebouwd uit de streken, bijvoorbeeld na ongedaan maken.
export function ensurePaint(scene, layer) {
  let canvas = scene.paint.get(layer.id);
  if (!canvas) {
    canvas = makeCanvas(scene.w, scene.h);
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

// Halve breedte en hoogte van een foto- of stickerlaag, in canvas-pixels, na schaal.
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
export function toLocal(layer, x, y) {
  const dx = x - layer.x;
  const dy = y - layer.y;
  const t = (layer.rot * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { lx: dx * c + dy * s, ly: -dx * s + dy * c };
}

// Canvas-punt van een punt in de lokale ruimte van de laag (rotatie om het middelpunt).
export function localToWorld(layer, lx, ly) {
  const t = (layer.rot * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return { x: layer.x + lx * c - ly * s, y: layer.y + lx * s + ly * c };
}

// Hoekjes (vergroten) en het draaibolletje (draaien) van een foto-, sticker- of tekstlaag, in canvas-coördinaten.
// px = canvas-pixels per schermpixel, zodat de greepjes op het scherm even groot blijven.
export function transformHandles(scene, layer, px) {
  const box = layer.type === 'image' ? imageBox(scene, layer) : textBox(layer);
  if (!box) return null;
  const { hw, hh } = box;
  return {
    box,
    corners: [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => localToWorld(layer, x, y)),
    top: localToWorld(layer, 0, -hh),
    rotate: localToWorld(layer, 0, -hh - 36 * px),
  };
}

// Bovenste zichtbare foto-, sticker- of tekstlaag onder het punt, of null.
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
  const r = Math.max(scene.w, scene.h) * 0.75;
  const mx = scene.w / 2;
  const my = scene.h / 2;
  const g = c.createLinearGradient(mx - Math.cos(a) * r, my - Math.sin(a) * r, mx + Math.cos(a) * r, my + Math.sin(a) * r);
  g.addColorStop(0, layer.color);
  g.addColorStop(1, layer.color2);
  return g;
}

// Tekent de inhoud van één laag op c (zonder dekking en zonder paneelmasker).
function drawContent(scene, layer, c) {
  switch (layer.type) {
    case 'fill':
      c.fillStyle = fillStyleOf(scene, layer, c);
      c.fillRect(0, 0, scene.w, scene.h);
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

// Zet alle lagen samen op scene.out: zwart, met de wrap daarop, en buiten de panelen zwart.
export function renderWrap(scene) {
  const { w, h, work, tmp, out } = scene;
  const wc = work.getContext('2d');
  const tc = tmp.getContext('2d');

  wc.setTransform(1, 0, 0, 1, 0, 0);
  wc.globalAlpha = 1;
  wc.globalCompositeOperation = 'source-over';
  wc.clearRect(0, 0, w, h);

  for (const layer of scene.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    tc.setTransform(1, 0, 0, 1, 0, 0);
    tc.globalAlpha = 1;
    tc.globalCompositeOperation = 'source-over';
    tc.clearRect(0, 0, w, h);
    drawContent(scene, layer, tc);
    if (layer.panels) {
      tc.globalCompositeOperation = 'destination-in';
      tc.drawImage(maskFor(scene.tpl, layer.panels), 0, 0);
    }
    wc.globalAlpha = layer.opacity;
    wc.drawImage(tmp, 0, 0);
    wc.globalAlpha = 1;
  }

  // Alles buiten de panelen weghalen en daarna op zwart zetten.
  wc.globalCompositeOperation = 'destination-in';
  wc.drawImage(maskFor(scene.tpl, null), 0, 0);
  wc.globalCompositeOperation = 'source-over';

  const o = out.getContext('2d');
  o.setTransform(1, 0, 0, 1, 0, 0);
  o.globalAlpha = 1;
  o.fillStyle = '#000';
  o.fillRect(0, 0, w, h);
  o.drawImage(work, 0, 0);
  return out;
}

// --- overlay (alleen voor de editor, niet in de export) ----------------------------

function selectionTint(scene) {
  const ids = [...scene.selPanels].sort((a, b) => a - b);
  const key = ids.join(',');
  if (scene.tintKey !== key) {
    const c = makeCanvas(scene.w, scene.h);
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(210, 75, 67, 0.4)';
    ctx.fillRect(0, 0, scene.w, scene.h);
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskFor(scene.tpl, ids), 0, 0);
    scene.tint = c;
    scene.tintKey = key;
  }
  return scene.tint;
}

function drawLabels(scene, c) {
  c.save();
  c.font = '600 22px system-ui, sans-serif';
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

// Gestippeld kader om de gekozen laag. Met Selecteer of Verplaats ook de greepjes: hoekjes en het draaibolletje.
function drawSelectionBox(scene, l, c, px, grips) {
  const h = transformHandles(scene, l, px);
  if (!h) return;
  c.save();
  c.translate(l.x, l.y);
  c.rotate((l.rot * Math.PI) / 180);
  c.lineWidth = 6;
  c.setLineDash([18, 12]);
  c.strokeStyle = '#d24b43';
  c.strokeRect(-h.box.hw, -h.box.hh, h.box.hw * 2, h.box.hh * 2);
  c.restore();
  if (!grips) return;
  c.save();
  c.strokeStyle = '#d24b43';
  c.lineWidth = 3 * px;
  c.beginPath();
  c.moveTo(h.top.x, h.top.y);
  c.lineTo(h.rotate.x, h.rotate.y);
  c.stroke();
  c.fillStyle = '#fff';
  for (const p of h.corners) dot(c, p, 9 * px);
  c.fillStyle = '#d24b43';
  dot(c, h.rotate, 10 * px);
  c.restore();
}

function dot(c, p, r) {
  c.beginPath();
  c.arc(p.x, p.y, r, 0, Math.PI * 2);
  c.fill();
  c.stroke();
}

// Stippellijn op de spiegelas, zodat je ziet waar de symmetrie precies ligt.
function drawAxis(scene, c) {
  c.save();
  c.strokeStyle = 'rgba(210, 75, 67, 0.9)';
  c.lineWidth = 3;
  c.setLineDash([12, 10]);
  c.beginPath();
  c.moveTo(scene.tpl.axis, 0);
  c.lineTo(scene.tpl.axis, scene.h);
  c.stroke();
  c.restore();
}

export function renderOverlay(scene, canvas, opts) {
  const c = canvas.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.clearRect(0, 0, scene.w, scene.h);
  if (opts.outlines) c.drawImage(scene.tpl.outline, 0, 0);
  if (scene.selPanels.size) c.drawImage(selectionTint(scene), 0, 0);
  if (opts.labels) drawLabels(scene, c);
  if (opts.symmetry && typeof scene.tpl.axis === 'number') drawAxis(scene, c);
  const l = scene.layers.find((x) => x.id === scene.selLayerId);
  if (l && l.visible && (l.type === 'image' || l.type === 'text')) {
    const w = canvas.getBoundingClientRect().width;
    drawSelectionBox(scene, l, c, w ? scene.w / w : 1, opts.tool === 'select' || opts.tool === 'move');
  }
}
