// Tesla Wrap Ontwerper: state, gereedschap, lagen, project en export.
import { loadTemplate, idAt, boundsOf } from './template.js';
import { renderWrap, renderOverlay, ensurePaint, drawStroke, drawSegment, hitLayer, FONTS } from './render.js';
import { History, copyLayers } from './model.js';
import { exportWrap } from './export.js';
import { makeCanvas, loadImage, download, stamp, esc, clamp, newId } from './util.js';

const TEMPLATE_DIR = 'assets/templates/voyager';
const S = 1024;
const MAX_PHOTO_SIDE = 2048;
const LABELS = { fill: 'Kleurvlak', image: 'Foto', paint: 'Tekening', text: 'Tekst' };
const TOOL_HINTS = {
  select: 'Tik op een paneel om het te kiezen. Met “Meerdere panelen” of Shift kies je er meer.',
  move: 'Sleep een foto of tekst om hem te verplaatsen. Knijp met twee vingers om te vergroten en te draaien.',
  brush: 'Teken op de wrap. Alles buiten de panelen verdwijnt in de export.',
  eraser: 'De gum wist op de geselecteerde tekenlaag.',
  text: 'Tik op de wrap om een tekstlaag te plaatsen.',
};
const TOOL_KEYS = { p: 'select', v: 'move', b: 'brush', e: 'eraser', t: 'text' };

const $ = (sel) => document.querySelector(sel);
const el = {
  overlay: $('#overlay'),
  wrap: $('#wrap'),
  status: $('#status'),
  hint: $('#hint'),
  props: $('#props'),
  layers: $('#layers'),
  undo: $('#undo'),
  redo: $('#redo'),
  color: $('#color'),
  size: $('#size'),
  sizeOut: $('#size-out'),
  multi: $('#multi'),
  outlines: $('#outlines'),
  labels: $('#labels'),
  scopeNote: $('#scope-note'),
  photoInput: $('#photo-input'),
  projectInput: $('#project-input'),
  dialog: $('#export-dialog'),
};

const scene = {
  size: S,
  tpl: null,
  layers: [],
  assets: new Map(), // id -> { id, img, w, h, dataUrl }
  paint: new Map(), // laag-id -> canvas van de tekenlaag (afgeleid van de streken)
  work: makeCanvas(S),
  tmp: makeCanvas(S),
  out: el.wrap,
  selPanels: new Set(),
  selLayerId: null,
  tint: null,
  tintKey: null,
};
const ui = { tool: 'select', outlines: true, labels: false };
const history = new History();
const pointers = new Map();
const counters = { fill: 0, image: 0, paint: 0, text: 0 };
let drag = null;
let frame = 0;
let photoTarget = null; // laag die een nieuwe foto krijgt; null = nieuwe fotolaag
let exportUrl = null;
let flashTimer = 0;

// --- hulpfuncties ----------------------------------------------------------------

const findLayer = (id) => scene.layers.find((l) => l.id === id) || null;
const selLayer = () => findLayer(scene.selLayerId);
const scopeNow = () => (scene.selPanels.size ? [...scene.selPanels].sort((a, b) => a - b) : null);
const baseLayer = () => ({
  id: 'base',
  type: 'fill',
  name: 'Basis',
  visible: true,
  opacity: 1,
  panels: null,
  color: '#ffffff',
  color2: '#ffffff',
  gradient: false,
  angle: 90,
});
const nextName = (type) => `${LABELS[type]} ${++counters[type]}`;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y) || 1;
const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function toCanvas(e) {
  const r = el.overlay.getBoundingClientRect();
  return { x: ((e.clientX - r.left) * S) / r.width, y: ((e.clientY - r.top) * S) / r.height };
}

// Nieuwe laag komt boven de geselecteerde laag, of bovenaan.
function insertLayer(layer) {
  const cur = scene.layers.findIndex((l) => l.id === scene.selLayerId);
  scene.layers.splice(cur === -1 ? scene.layers.length : cur + 1, 0, layer);
  scene.selLayerId = layer.id;
}

// Schaalt en centreert een foto zodat hij de bounding box van de panelen bedekt.
function fitLayer(l) {
  const a = scene.assets.get(l.asset);
  if (!a) return;
  const [x0, y0, x1, y1] = boundsOf(scene.tpl, l.panels);
  l.x = (x0 + x1) / 2;
  l.y = (y0 + y1) / 2;
  l.base = Math.max((x1 - x0) / a.w, (y1 - y0) / a.h);
  l.zoom = 1;
  l.rot = 0;
}

function flash(msg) {
  el.hint.textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(updateStatus, 2600);
}

// --- weergave en undo ------------------------------------------------------------

function requestRender() {
  if (!frame) {
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderNow();
    });
  }
}

function renderNow() {
  if (!scene.tpl) return;
  renderWrap(scene);
  renderOverlay(scene, el.overlay, ui);
}

// Ververs de UI. Lijst en eigenschappen kunnen worden overgeslagen, bijvoorbeeld tijdens het typen,
// zodat een knop die je net aanklikt niet verdwijnt.
function refresh({ list = true, props = true } = {}) {
  if (!scene.tpl) return;
  if (list) renderLayerList();
  if (props) renderProps();
  updateUndo();
  updateStatus();
  requestRender();
}

// Legt een undo-punt vast en ververst de UI.
function commit(opts) {
  history.push(copyLayers(scene.layers));
  refresh(opts);
}

function restore(snapshot) {
  scene.layers = copyLayers(snapshot);
  scene.paint.clear();
  if (!findLayer(scene.selLayerId)) scene.selLayerId = null;
  refresh();
}

function undo() {
  const s = history.undo();
  if (s) restore(s);
}

function redo() {
  const s = history.redo();
  if (s) restore(s);
}

function updateUndo() {
  el.undo.disabled = !history.canUndo;
  el.redo.disabled = !history.canRedo;
}

function updateStatus() {
  const n = scene.selPanels.size;
  el.status.textContent = scene.tpl
    ? `${scene.tpl.name} · ${scene.tpl.panels.length} panelen · ${n ? `${n} gekozen` : 'geen paneel gekozen'}`
    : '';
  el.hint.textContent = TOOL_HINTS[ui.tool] || '';
  el.scopeNote.textContent = n
    ? 'Nieuwe lagen komen op de gekozen panelen.'
    : 'Nieuwe lagen komen op de hele wrap. Kies eerst panelen om ze daarop te zetten.';
}

function setTool(name) {
  ui.tool = name;
  document.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === name)));
  updateStatus();
}

// --- lagen -----------------------------------------------------------------------

function addFill() {
  insertLayer({
    id: newId('l'),
    type: 'fill',
    name: nextName('fill'),
    visible: true,
    opacity: 1,
    panels: scopeNow(),
    color: el.color.value,
    color2: '#1f2937',
    gradient: false,
    angle: 90,
  });
  commit();
}

function addText(at) {
  insertLayer({
    id: newId('l'),
    type: 'text',
    name: nextName('text'),
    visible: true,
    opacity: 1,
    panels: scopeNow(),
    text: 'TESLA',
    font: 'Arial Black',
    bold: true,
    size: 180,
    color: el.color.value,
    x: at.x,
    y: at.y,
    rot: 0,
  });
  commit();
}

function deleteLayer(id) {
  const i = scene.layers.findIndex((l) => l.id === id);
  if (i < 0) return;
  scene.layers.splice(i, 1);
  scene.paint.delete(id);
  if (scene.selLayerId === id) scene.selLayerId = null;
  commit();
}

function moveLayer(id, dir) {
  const i = scene.layers.findIndex((l) => l.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= scene.layers.length) return;
  [scene.layers[i], scene.layers[j]] = [scene.layers[j], scene.layers[i]];
  commit();
}

function resetDocument() {
  scene.layers = [baseLayer()];
  scene.assets.clear();
  scene.paint.clear();
  scene.selLayerId = null;
  scene.selPanels.clear();
  for (const k of Object.keys(counters)) counters[k] = 0;
  history.reset(copyLayers(scene.layers));
  refresh();
}

// --- panelen en gereedschap --------------------------------------------------------

function pickPanel(p, e) {
  const id = idAt(scene.tpl, p.x, p.y);
  const additive = el.multi.checked || e.shiftKey || e.ctrlKey || e.metaKey;
  if (!additive) scene.selPanels.clear();
  if (id) {
    if (additive && scene.selPanels.has(id)) scene.selPanels.delete(id);
    else scene.selPanels.add(id);
  }
  refresh();
}

function beginMove(p, pointerId) {
  const hit = hitLayer(scene, p.x, p.y);
  scene.selLayerId = hit ? hit.id : null;
  if (hit) {
    drag = { kind: 'move', id: hit.id, pointerId, start: p, x0: hit.x, y0: hit.y, moved: false, pinch: null };
  }
  refresh();
}

function startPinch() {
  const l = findLayer(drag.id);
  if (!l) return;
  const [a, b] = [...pointers.values()];
  drag.pinch = {
    d0: dist(a, b),
    a0: angle(a, b),
    m0: mid(a, b),
    zoom0: l.zoom,
    size0: l.size,
    rot0: l.rot,
    x0: l.x,
    y0: l.y,
  };
  drag.moved = true;
}

function beginStroke(p, pointerId, erase) {
  let layer = selLayer();
  if (!layer || layer.type !== 'paint') {
    if (erase) {
      flash('Kies eerst een tekenlaag (teken er eerst iets op) om te gummen.');
      return;
    }
    layer = { id: newId('l'), type: 'paint', name: nextName('paint'), visible: true, opacity: 1, panels: null, strokes: [] };
    insertLayer(layer);
  }
  const ctx = ensurePaint(scene, layer).getContext('2d');
  const stroke = { c: el.color.value, w: Number(el.size.value), e: erase, p: [p.x, p.y] };
  layer.strokes = [...layer.strokes, stroke];
  drawStroke(ctx, stroke);
  drag = { kind: 'draw', id: layer.id, pointerId, stroke, last: p };
  refresh();
}

function onPointerDown(e) {
  if (!scene.tpl || (e.pointerType === 'mouse' && e.button !== 0)) return;
  e.preventDefault();
  el.overlay.setPointerCapture(e.pointerId);
  const p = toCanvas(e);
  pointers.set(e.pointerId, p);
  if (pointers.size > 1) {
    if (drag && drag.kind === 'move') startPinch();
    requestRender();
    return;
  }
  switch (ui.tool) {
    case 'select':
      pickPanel(p, e);
      break;
    case 'move':
      beginMove(p, e.pointerId);
      break;
    case 'brush':
      beginStroke(p, e.pointerId, false);
      break;
    case 'eraser':
      beginStroke(p, e.pointerId, true);
      break;
    case 'text':
      addText(p);
      setTool('move');
      break;
  }
}

function onPointerMove(e) {
  if (!pointers.has(e.pointerId)) return;
  const p = toCanvas(e);
  pointers.set(e.pointerId, p);
  if (!drag) return;

  if (drag.kind === 'move') {
    const l = findLayer(drag.id);
    if (!l) return;
    if (drag.pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const pz = drag.pinch;
      const k = dist(a, b) / pz.d0;
      const m = mid(a, b);
      if (l.type === 'text') l.size = clamp(pz.size0 * k, 16, 500);
      else l.zoom = clamp(pz.zoom0 * k, 0.1, 6);
      l.rot = pz.rot0 + ((angle(a, b) - pz.a0) * 180) / Math.PI;
      l.x = pz.x0 + (m.x - pz.m0.x);
      l.y = pz.y0 + (m.y - pz.m0.y);
    } else if (e.pointerId === drag.pointerId) {
      l.x = drag.x0 + (p.x - drag.start.x);
      l.y = drag.y0 + (p.y - drag.start.y);
      drag.moved = true;
    }
    syncFields();
  } else if (drag.kind === 'draw' && e.pointerId === drag.pointerId) {
    const l = findLayer(drag.id);
    if (!l) return;
    const last = drag.last;
    drag.stroke.p.push(p.x, p.y);
    drawSegment(ensurePaint(scene, l).getContext('2d'), drag.stroke, last.x, last.y, p.x, p.y);
    drag.last = p;
  }
  requestRender();
}

function onPointerEnd(e) {
  if (!pointers.delete(e.pointerId) || !drag) return;
  if (drag.kind === 'draw') {
    if (e.pointerId === drag.pointerId) {
      drag = null;
      commit({ list: false, props: false });
    }
  } else if (pointers.size === 0) {
    const moved = drag.moved;
    drag = null;
    if (moved) commit({ list: false, props: false });
  } else if (drag.pinch) {
    // Een vinger van de twee is los: ga door met slepen op de vinger die nog op het scherm staat.
    const [id2, q] = pointers.entries().next().value;
    const l = findLayer(drag.id);
    Object.assign(drag, { pinch: null, pointerId: id2, start: q, x0: l ? l.x : 0, y0: l ? l.y : 0, moved: true });
  }
  requestRender();
}

// Werkt de schuifregelaars bij tijdens slepen en knijpen, zonder de hele eigenschappen-paneel opnieuw te bouwen.
function syncFields() {
  const l = selLayer();
  if (!l) return;
  el.props.querySelectorAll('input[type="range"][data-prop]').forEach((input) => {
    const k = input.dataset.prop;
    const v = k === 'zoom' ? l.zoom * 100 : k === 'opacity' ? l.opacity * 100 : l[k];
    if (typeof v !== 'number') return;
    input.value = Math.round(v);
    const out = el.props.querySelector(`[data-out="${k}"]`);
    if (out) out.textContent = Math.round(v) + input.dataset.unit;
  });
}

// --- lagenlijst en eigenschappen ---------------------------------------------------

function renderLayerList() {
  if (!scene.layers.length) {
    el.layers.innerHTML = '<li class="muted small">Nog geen lagen.</li>';
    return;
  }
  el.layers.innerHTML = [...scene.layers]
    .reverse()
    .map((l) => {
      const scope = l.panels ? `panelen ${l.panels.join(', ')}` : 'hele wrap';
      return `<li class="layer${l.id === scene.selLayerId ? ' is-selected' : ''}" data-id="${l.id}">
        <input type="checkbox" data-act="vis"${l.visible ? ' checked' : ''} aria-label="${esc(l.name)} zichtbaar">
        <button class="layer-name" type="button" data-act="select">
          <strong>${esc(l.name)}</strong><small>${esc(`${LABELS[l.type]} · ${scope}`)}</small>
        </button>
        <span class="layer-btns">
          <button class="btn icon" type="button" data-act="up" aria-label="Eén laag omhoog">▲</button>
          <button class="btn icon" type="button" data-act="down" aria-label="Eén laag omlaag">▼</button>
          <button class="btn icon danger" type="button" data-act="del" aria-label="Laag verwijderen">✕</button>
        </span>
      </li>`;
    })
    .join('');
}

const rangeField = (prop, label, value, min, max, unit) =>
  `<label class="field"><span>${label} <b data-out="${prop}">${Math.round(value)}${unit}</b></span>` +
  `<input type="range" data-prop="${prop}" data-unit="${unit}" min="${min}" max="${max}" step="1" value="${Math.round(value)}"></label>`;

const colorField = (prop, label, value) =>
  `<label class="field"><span>${label}</span><input type="color" data-prop="${prop}" value="${value}"></label>`;

function renderProps() {
  const l = selLayer();
  if (!l) {
    el.props.innerHTML = '<p class="muted small">Selecteer een laag in de lijst, of voeg er een toe.</p>';
    return;
  }

  let body = '';
  if (l.type === 'fill') {
    body =
      colorField('color', 'Kleur', l.color) +
      `<label class="check"><input type="checkbox" data-act="grad"${l.gradient ? ' checked' : ''}> Verloop</label>` +
      (l.gradient ? colorField('color2', 'Tweede kleur', l.color2) + rangeField('angle', 'Hoek', l.angle, -180, 180, '°') : '');
  } else if (l.type === 'image') {
    body =
      rangeField('zoom', 'Vergroting', l.zoom * 100, 10, 600, '%') +
      rangeField('rot', 'Draaien', l.rot, -180, 180, '°') +
      rangeField('opacity', 'Dekking', l.opacity * 100, 0, 100, '%') +
      `<div class="row">
        <button class="btn" type="button" data-act="flip">Spiegelen</button>
        <button class="btn" type="button" data-act="fit">Opnieuw passen</button>
        <button class="btn" type="button" data-act="replace">Andere foto</button>
      </div>`;
  } else if (l.type === 'paint') {
    body =
      rangeField('opacity', 'Dekking', l.opacity * 100, 0, 100, '%') +
      '<p class="muted small">Kies Kwast of Gum om te tekenen. Tekeningen worden altijd tot de panelen beperkt.</p>';
  } else if (l.type === 'text') {
    body =
      `<label class="field"><span>Tekst</span><input type="text" data-prop="text" value="${esc(l.text)}"></label>` +
      `<label class="field"><span>Lettertype</span><select data-prop="font">${FONTS.map(
        (f) => `<option${f === l.font ? ' selected' : ''}>${f}</option>`,
      ).join('')}</select></label>` +
      `<label class="check"><input type="checkbox" data-act="bold"${l.bold ? ' checked' : ''}> Vet</label>` +
      colorField('color', 'Kleur', l.color) +
      rangeField('size', 'Grootte', l.size, 16, 500, 'px') +
      rangeField('rot', 'Draaien', l.rot, -180, 180, '°') +
      rangeField('opacity', 'Dekking', l.opacity * 100, 0, 100, '%');
  }

  const n = scene.selPanels.size;
  const scope =
    l.type === 'paint'
      ? ''
      : `<div class="field"><span>Toepassen op</span>
        <div class="seg">
          <button class="btn${l.panels ? '' : ' on'}" type="button" data-act="scope-all">Hele wrap</button>
          <button class="btn${l.panels ? ' on' : ''}" type="button" data-act="scope-sel"${n ? '' : ' disabled'}>Gekozen panelen (${n})</button>
        </div>
        <small class="muted">${l.panels ? `Nu op panelen ${l.panels.join(', ')}` : 'Nu op alle panelen'}</small>
      </div>`;

  el.props.innerHTML = `<h3>${esc(l.name)}</h3>${scope}${body}
    <button class="btn danger" type="button" data-act="delete">Laag verwijderen</button>`;
}

function setProp(l, key, raw) {
  if (key === 'zoom') l.zoom = Number(raw) / 100;
  else if (key === 'opacity') l.opacity = Number(raw) / 100;
  else if (key === 'rot' || key === 'angle' || key === 'size') l[key] = Number(raw);
  else l[key] = raw; // color, color2, text, font
}

function onPropInput(e) {
  const t = e.target;
  const l = selLayer();
  if (!l || !t.dataset.prop) return;
  setProp(l, t.dataset.prop, t.value);
  const out = el.props.querySelector(`[data-out="${t.dataset.prop}"]`);
  if (out) out.textContent = t.value + (t.dataset.unit || '');
  requestRender();
}

function onPropChange(e) {
  const t = e.target;
  const l = selLayer();
  if (!l) return;
  if (t.dataset.prop) {
    setProp(l, t.dataset.prop, t.value);
    commit({ list: false, props: false });
  } else if (t.dataset.act === 'grad') {
    l.gradient = t.checked;
    commit();
  } else if (t.dataset.act === 'bold') {
    l.bold = t.checked;
    commit({ list: false, props: false });
  }
}

function onPropClick(e) {
  const btn = e.target.closest('[data-act]');
  const l = selLayer();
  if (!btn || !l) return;
  switch (btn.dataset.act) {
    case 'scope-all':
      l.panels = null;
      commit();
      break;
    case 'scope-sel':
      if (scene.selPanels.size) {
        l.panels = scopeNow();
        commit();
      }
      break;
    case 'flip':
      l.flip = !l.flip;
      commit();
      break;
    case 'fit':
      fitLayer(l);
      commit();
      break;
    case 'replace':
      photoTarget = l.id;
      el.photoInput.click();
      break;
    case 'delete':
      deleteLayer(l.id);
      break;
  }
}

function onLayerClick(e) {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.closest('li').dataset.id;
  switch (btn.dataset.act) {
    case 'select':
      scene.selLayerId = id;
      refresh();
      break;
    case 'up':
      moveLayer(id, 1);
      break;
    case 'down':
      moveLayer(id, -1);
      break;
    case 'del':
      deleteLayer(id);
      break;
  }
}

function onLayerChange(e) {
  const t = e.target;
  if (t.dataset.act !== 'vis') return;
  const l = findLayer(t.closest('li').dataset.id);
  if (!l) return;
  l.visible = t.checked;
  commit();
}

// --- foto's, project en export ---------------------------------------------------------

// Verkleint grote foto's en slaat ze op als data-URL, zodat het project later weer opent.
async function loadAsset(file) {
  const src = URL.createObjectURL(file);
  let img;
  try {
    img = await loadImage(src);
  } finally {
    URL.revokeObjectURL(src);
  }
  const k = Math.min(1, MAX_PHOTO_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * k);
  const h = Math.round(img.naturalHeight * k);
  const canvas = makeCanvas(w, h);
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92);
  const decoded = await loadImage(dataUrl);
  return { id: newId('a'), img: decoded, w, h, dataUrl };
}

async function onPhotoPicked(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const asset = await loadAsset(file);
    scene.assets.set(asset.id, asset);
    const target = photoTarget ? findLayer(photoTarget) : null;
    photoTarget = null;
    if (target) {
      target.asset = asset.id;
      fitLayer(target);
      scene.selLayerId = target.id;
    } else {
      const layer = {
        id: newId('l'),
        type: 'image',
        name: nextName('image'),
        visible: true,
        opacity: 1,
        panels: scopeNow(),
        asset: asset.id,
        x: S / 2,
        y: S / 2,
        rot: 0,
        zoom: 1,
        base: 1,
        flip: false,
      };
      fitLayer(layer);
      insertLayer(layer);
    }
    commit();
  } catch (err) {
    alert(`Foto kon niet worden toegevoegd: ${err.message}`);
  }
}

function saveProject() {
  const assets = {};
  for (const l of scene.layers) {
    if (l.asset && scene.assets.has(l.asset)) assets[l.asset] = { dataUrl: scene.assets.get(l.asset).dataUrl };
  }
  const data = { format: 'tesla-wrap-project', version: 1, template: TEMPLATE_DIR, layers: scene.layers, assets };
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `tesla-wrap-project-${stamp()}.json`);
}

async function loadProjectFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.format !== 'tesla-wrap-project' || !Array.isArray(data.layers)) {
      throw new Error('dit is geen Tesla wrap-project');
    }
    scene.assets.clear();
    for (const [id, a] of Object.entries(data.assets || {})) {
      const img = await loadImage(a.dataUrl);
      scene.assets.set(id, { id, img, w: img.naturalWidth, h: img.naturalHeight, dataUrl: a.dataUrl });
    }
    scene.layers = data.layers;
    scene.paint.clear();
    scene.selLayerId = null;
    scene.selPanels.clear();
    for (const k of Object.keys(counters)) counters[k] = scene.layers.filter((l) => l.type === k).length;
    history.reset(copyLayers(scene.layers));
    refresh();
  } catch (err) {
    alert(`Project openen mislukt: ${err.message}`);
  }
}

async function openExport() {
  if (!scene.tpl) return;
  renderNow();
  try {
    showExport(await exportWrap(scene.out, scene.tpl));
  } catch (err) {
    alert(`Exporteren mislukt: ${err.message}`);
  }
}

function showExport(result) {
  if (exportUrl) URL.revokeObjectURL(exportUrl);
  exportUrl = URL.createObjectURL(result.blob);
  const name = `tesla-wrap-${stamp()}.png`;
  const ok = result.checks.every((c) => c.ok);

  $('#export-preview').src = exportUrl;
  $('#export-info').textContent = `${result.width} × ${result.height} px · ${(result.blob.size / 1024).toFixed(0)} KB · ${result.mode}`;
  $('#export-checks').innerHTML = result.checks
    .map((c) => `<li class="${c.ok ? 'ok' : 'fail'}"><span>${c.ok ? '✓' : '✗'}</span>${esc(c.label)}</li>`)
    .join('');

  const link = $('#export-download');
  link.href = exportUrl;
  link.download = name;
  link.hidden = !ok;

  const file = new File([result.blob], name, { type: 'image/png' });
  const share = $('#export-share');
  share.hidden = !ok || !(navigator.canShare && navigator.canShare({ files: [file] }));
  share.onclick = () => navigator.share({ files: [file], title: 'Tesla wrap' }).catch(() => {});

  el.dialog.showModal();
}

// --- toetsenbord en bindingen ---------------------------------------------------------

function onKey(e) {
  if (e.target.closest('input, textarea, select')) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (mod && key === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
  } else if (mod && key === 'y') {
    e.preventDefault();
    redo();
  } else if (mod) {
    return;
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && scene.selLayerId) {
    e.preventDefault();
    deleteLayer(scene.selLayerId);
  } else if (e.key === 'Escape') {
    scene.selPanels.clear();
    scene.selLayerId = null;
    refresh();
  } else if (TOOL_KEYS[key]) {
    setTool(TOOL_KEYS[key]);
  }
}

function bindEvents() {
  document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));

  $('#add-fill').addEventListener('click', addFill);
  $('#add-photo').addEventListener('click', () => {
    photoTarget = null;
    el.photoInput.click();
  });
  $('#add-text').addEventListener('click', () => {
    const [x0, y0, x1, y1] = boundsOf(scene.tpl, scopeNow());
    addText({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
  });
  $('#clear-all').addEventListener('click', () => {
    if (confirm('Alle lagen verwijderen en opnieuw beginnen?')) resetDocument();
  });
  $('#select-all').addEventListener('click', () => {
    scene.selPanels = new Set(scene.tpl.panels.map((p) => p.id));
    refresh();
  });
  $('#select-none').addEventListener('click', () => {
    scene.selPanels.clear();
    refresh();
  });

  el.size.addEventListener('input', () => {
    el.sizeOut.textContent = el.size.value;
  });
  el.outlines.addEventListener('change', () => {
    ui.outlines = el.outlines.checked;
    requestRender();
  });
  el.labels.addEventListener('change', () => {
    ui.labels = el.labels.checked;
    requestRender();
  });

  el.undo.addEventListener('click', undo);
  el.redo.addEventListener('click', redo);
  $('#save-project').addEventListener('click', saveProject);
  $('#open-project').addEventListener('click', () => el.projectInput.click());
  el.projectInput.addEventListener('change', loadProjectFile);
  el.photoInput.addEventListener('change', onPhotoPicked);
  $('#export').addEventListener('click', openExport);

  el.overlay.addEventListener('pointerdown', onPointerDown);
  el.overlay.addEventListener('pointermove', onPointerMove);
  el.overlay.addEventListener('pointerup', onPointerEnd);
  el.overlay.addEventListener('pointercancel', onPointerEnd);

  el.layers.addEventListener('click', onLayerClick);
  el.layers.addEventListener('change', onLayerChange);
  el.props.addEventListener('input', onPropInput);
  el.props.addEventListener('change', onPropChange);
  el.props.addEventListener('click', onPropClick);

  document.addEventListener('keydown', onKey);
}

async function init() {
  bindEvents();
  el.sizeOut.textContent = el.size.value;
  setTool('select');
  try {
    scene.tpl = await loadTemplate(TEMPLATE_DIR);
  } catch (err) {
    el.status.textContent = `Sjabloon laden mislukt: ${err.message}`;
    return;
  }
  scene.layers = [baseLayer()];
  history.reset(copyLayers(scene.layers));
  refresh();
}

init();
