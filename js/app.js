// Tesla Wrap Ontwerper: stappen, modelkeuze, editor, zoomen, lagen, symmetrie, opslag en export.
import { loadTemplate, idAt, boundsOf } from './template.js';
import { renderWrap, renderOverlay, ensurePaint, drawStroke, drawSegment, hitLayer, FONTS, toLocal, transformHandles, imageBox, textBox } from './render.js';
import { History, copyLayers } from './model.js';
import { exportWrap } from './export.js';
import { listDesigns, getContent, putDesign, putMeta, deleteDesign, loadLegacy, clearLegacy } from './store.js';
import { makeCanvas, loadImage, download, stamp, esc, clamp, newId } from './util.js';
import { t, initI18n, onLanguageChange, localeTag } from './i18n.js';
import { getPref, setPref } from './prefs.js';

const MODELS_URL = 'assets/templates/index.json';
const MAX_PHOTO_SIDE = 2048;
const MAX_STICKER_SIDE = 1024;
const MIN_Z = 1;
const MAX_Z = 8;
const LABELS = { fill: 'Kleurvlak', image: 'Foto', sticker: 'Sticker', paint: 'Tekening', text: 'Tekst' };
const TOOL_HINTS = {
  select: 'Tik op een paneel om het te kiezen. Met Meerdere panelen of Shift kies je er meer.',
  move: 'Sleep een foto, sticker of tekst. Op een leeg deel van het canvas verschuif je het beeld.',
  brush: 'Teken met één vinger. Met twee vingers zoom je of verschuif je het beeld.',
  eraser: 'De gum wist op de geselecteerde tekenlaag.',
  text: 'Tik op de wrap om een tekstlaag te plaatsen.',
};
const HINT_PHOTO = 'Sleep de foto om te verschuiven.';
const HINT_STICKER = 'Sleep de sticker om te verschuiven.';
const HINT_TEXT = 'Sleep de tekst om te verschuiven.';
const TOOL_KEYS = { s: 'select', v: 'move', b: 'brush', e: 'eraser', t: 'text' };
const ARROW_STEP = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const GRIP_PX = 20; // hoe dicht bij een hoekje of het draaibolletje je moet komen (schermpixels)
const DRAG_PX = 4; // vanaf zoveel schermpixels is een klik een sleep
const wrapDeg = (d) => ((((d + 180) % 360) + 360) % 360) - 180;
// Hoekverschil in radialen, teruggebracht naar −π…π, zodat een draai over de grens van ±180° niet springt.
const wrapRad = (r) => Math.atan2(Math.sin(r), Math.cos(r));

const $ = (sel) => document.querySelector(sel);
const el = {
  start: $('#start'),
  grid: $('#model-grid'),
  startBack: $('#start-back'),
  startNote: $('#start-note'),
  designs: $('#designs'),
  designGrid: $('#design-grid'),
  editor: $('#editor'),
  stage: $('#stage'),
  viewport: $('#viewport'),
  wrap: $('#wrap'),
  overlay: $('#overlay'),
  zoomLevel: $('#zoom-level'),
  modelName: $('#model-name'),
  panelCount: $('#panel-count'),
  selCount: $('#sel-count'),
  hint: $('#hint'),
  steps: document.querySelectorAll('.step'),
  undo: $('#undo'),
  redo: $('#redo'),
  props: $('#props'),
  layers: $('#layers'),
  color: $('#color'),
  size: $('#size'),
  sizeOut: $('#size-out'),
  multi: $('#multi'),
  symmetry: $('#symmetry'),
  outlines: $('#outlines'),
  labels: $('#labels'),
  scopeNote: $('#scope-note'),
  photoInput: $('#photo-input'),
  photoEachInput: $('#photo-each-input'),
  addPhoto: $('#add-photo'),
  addPhotoEach: $('#add-photo-each'),
  mobilePhotoScope: $('#mobile-photo-scope'),
  stickerInput: $('#sticker-input'),
  projectInput: $('#project-input'),
  dialog: $('#export-dialog'),
};

// Het canvas past zich aan het gekozen sjabloon aan: 1024 × 1024, of 1024 × 768 voor de Cybertruck.
const scene = {
  w: 1024,
  h: 1024,
  tpl: null,
  layers: [],
  assets: new Map(), // id -> { id, img, w, h, dataUrl }
  paint: new Map(), // laag-id -> canvas van de tekenlaag (afgeleid van de streken)
  work: makeCanvas(1024),
  tmp: makeCanvas(1024),
  out: el.wrap,
  selPanels: new Set(),
  selLayerId: null,
  tint: null,
  tintKey: null,
};
const ui = { tool: 'select', outlines: true, labels: false, symmetry: false, space: false };
const view = { z: 1, x: 0, y: 0 }; // zoom en verschuiving van het beeld, in stage-pixels
const history = new History();
const pointers = new Map(); // pointerId -> { cx, cy } in schermcoördinaten
const counters = { fill: 0, image: 0, sticker: 0, paint: 0, text: 0 };
const templates = new Map(); // model-id -> geladen sjabloon (één keer laden)
const catalog = new Map(); // model-id -> panels.json (voor de modelkaarten)
let models = [];
let current = null; // het gekozen model uit index.json
let screen = 'start';
let drag = null;
let frame = 0;
let photoTarget = null; // laag die een nieuwe foto krijgt; null = nieuwe fotolaag
let exportUrl = null;
let flashTimer = 0;
let saveTimer = 0;
let designList = []; // alle opgeslagen ontwerpen als lijstitems, het laatst bewerkte eerst
let activeDesign = null; // { id, name } van het ontwerp dat je nu bewerkt; null = nog niet opgeslagen

// --- hulpfuncties ----------------------------------------------------------------

const findLayer = (id) => scene.layers.find((l) => l.id === id) || null;
const selLayer = () => findLayer(scene.selLayerId);
const scopeNow = () => (scene.selPanels.size ? [...scene.selPanels].sort((a, b) => a - b) : null);
const baseLayer = () => ({
  id: 'base',
  type: 'fill',
  name: t('Basis'),
  visible: true,
  opacity: 1,
  panels: null,
  color: '#ffffff',
  color2: '#ffffff',
  gradient: false,
  angle: 90,
});
const nextName = (type) => `${t(LABELS[type])} ${++counters[type]}`;
const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y) || 1;
const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const mirrorOf = (id) => (scene.tpl && scene.tpl.byId.get(id) ? scene.tpl.byId.get(id).mirror : null) ?? null;
const isBlank = (layers) =>
  layers.length <= 1 && (!layers[0] || (layers[0].type === 'fill' && layers[0].color === '#ffffff'));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// Schermcoördinaat naar canvas-coördinaat. Werkt ook als het beeld gezoomd of verschoven is.
function canvasPoint(cx, cy) {
  const r = el.overlay.getBoundingClientRect();
  return { x: ((cx - r.left) * scene.w) / r.width, y: ((cy - r.top) * scene.h) / r.height };
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

// Een sticker of logo past binnen 60% van de panelen, zodat hij er rustig op staat.
function fitSticker(l) {
  const a = scene.assets.get(l.asset);
  if (!a) return;
  const [x0, y0, x1, y1] = boundsOf(scene.tpl, l.panels);
  l.x = (x0 + x1) / 2;
  l.y = (y0 + y1) / 2;
  l.base = Math.min(((x1 - x0) * 0.6) / a.w, ((y1 - y0) * 0.6) / a.h);
  l.zoom = 1;
  l.rot = 0;
}

function flash(msg) {
  el.hint.textContent = msg;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(updateStatus, 2600);
}

// --- zoomen en verschuiven ---------------------------------------------------------

function stageRect() {
  return el.stage.getBoundingClientRect();
}

function clampView() {
  if (view.z <= MIN_Z) {
    view.z = MIN_Z;
    view.x = 0;
    view.y = 0;
    return;
  }
  const r = stageRect();
  view.x = clamp(view.x, r.width - r.width * view.z, 0);
  view.y = clamp(view.y, r.height - r.height * view.z, 0);
}

function applyView() {
  el.viewport.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.z})`;
  el.zoomLevel.textContent = `${Math.round(view.z * 100)}%`;
}

// Zoomt rond een punt op het scherm, zodat dat punt op dezelfde plek blijft.
function zoomAt(px, py, z) {
  const z2 = clamp(z, MIN_Z, MAX_Z);
  view.x = px - ((px - view.x) * z2) / view.z;
  view.y = py - ((py - view.y) * z2) / view.z;
  view.z = z2;
  clampView();
  applyView();
}

function zoomBy(factor) {
  const r = stageRect();
  if (!r.width) return;
  zoomAt(r.width / 2, r.height / 2, view.z * factor);
}

function fitView() {
  view.z = MIN_Z;
  view.x = 0;
  view.y = 0;
  applyView();
}

// Zoomt zo in dat de gekozen panelen het beeld vullen.
function zoomToSelection() {
  if (!scene.selPanels.size || !scene.tpl) return flash(t('Kies eerst een paneel om naartoe te zoomen.'));
  const r = stageRect();
  if (!r.width) return;
  const base = r.width / scene.w; // schermpixels per canvas-pixel bij zoom 1
  const [x0, y0, x1, y1] = boundsOf(scene.tpl, [...scene.selPanels]);
  const bw = Math.max(1, (x1 - x0) * base);
  const bh = Math.max(1, (y1 - y0) * base);
  view.z = clamp(Math.min((r.width / 1.15) / bw, (r.height / 1.15) / bh), MIN_Z, MAX_Z);
  view.x = r.width / 2 - ((x0 + x1) / 2) * base * view.z;
  view.y = r.height / 2 - ((y0 + y1) / 2) * base * view.z;
  clampView();
  applyView();
}

function onWheel(e) {
  if (screen !== 'editor' || !scene.tpl) return;
  e.preventDefault();
  const r = stageRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, view.z * Math.exp(-e.deltaY * 0.0018));
}

// Twee vingers: zoomen en verschuiven rond het midden tussen de vingers.
function beginView() {
  const [a, b] = [...pointers.values()];
  const r = stageRect();
  drag = {
    kind: 'view',
    d0: Math.hypot(b.cx - a.cx, b.cy - a.cy) || 1,
    z0: view.z,
    x0: view.x,
    y0: view.y,
    m0: { x: (a.cx + b.cx) / 2 - r.left, y: (a.cy + b.cy) / 2 - r.top },
  };
}

function updateView() {
  const [a, b] = [...pointers.values()];
  const r = stageRect();
  const d = Math.hypot(b.cx - a.cx, b.cy - a.cy) || 1;
  const mx = (a.cx + b.cx) / 2 - r.left;
  const my = (a.cy + b.cy) / 2 - r.top;
  const ux = (drag.m0.x - drag.x0) / drag.z0; // punt van het beeld onder het beginmidden
  const uy = (drag.m0.y - drag.y0) / drag.z0;
  view.z = clamp(drag.z0 * (d / drag.d0), MIN_Z, MAX_Z);
  view.x = mx - ux * view.z;
  view.y = my - uy * view.z;
  clampView();
  applyView();
}

// --- weergave en undo --------------------------------------------------------------

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

// Legt een undo-punt vast, ververst de UI en bewaart het ontwerp automatisch.
function commit(opts) {
  history.push(copyLayers(scene.layers));
  refresh(opts);
  scheduleSave();
}

function restore(snapshot) {
  scene.layers = copyLayers(snapshot);
  scene.paint.clear();
  if (!findLayer(scene.selLayerId)) scene.selLayerId = null;
  refresh();
  scheduleSave();
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

// Waar een nieuwe foto terechtkomt: de hele wrap, één paneel, of meerdere panelen samen.
function photoScope() {
  const ids = [...scene.selPanels].sort((a, b) => a - b);
  if (!ids.length) return { label: t('Foto voor hele wrap'), short: t('hele wrap'), each: false };
  if (ids.length === 1) return { label: t('Foto op paneel {n}', { n: ids[0] }), short: t('paneel {n}', { n: ids[0] }), each: false };
  return { label: t('Foto over {n} panelen', { n: ids.length }), short: t('{n} panelen', { n: ids.length }), each: true };
}

function updateStatus() {
  const n = scene.selPanels.size;
  el.modelName.textContent = scene.tpl ? t(scene.tpl.name) : '';
  el.panelCount.textContent = scene.tpl ? t('{n} panelen', { n: scene.tpl.panels.length }) : '';
  el.selCount.textContent = n ? t('{n} gekozen', { n }) : t('Geen paneel gekozen');
  el.hint.textContent = transformHint() || t(TOOL_HINTS[ui.tool] || '');
  el.scopeNote.textContent = n
    ? t('Nieuwe lagen komen op de gekozen panelen.')
    : t('Nieuwe lagen komen op de hele wrap. Kies eerst panelen om ze daarop te zetten.');
  const ps = photoScope();
  el.addPhoto.textContent = ps.label;
  el.addPhotoEach.hidden = !ps.each;
  el.mobilePhotoScope.textContent = ps.short;
  el.zoomLevel.textContent = `${Math.round(view.z * 100)}%`;
}

function setTool(name) {
  ui.tool = name;
  setPref('tool', name);
  document.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === name)));
  updateStatus();
}

// --- schermen en stappen -------------------------------------------------------------

function setScreen(name) {
  screen = name;
  el.start.hidden = name !== 'start';
  el.editor.hidden = name !== 'editor';
  if (name === 'start') {
    renderModelGrid();
    renderDesigns();
  } else {
    refresh();
  }
  updateSteps();
  window.scrollTo(0, 0);
}

function updateSteps() {
  const hasModel = !!current;
  el.steps.forEach((b) => {
    const step = b.dataset.step;
    const active = (step === 'model' && screen === 'start') || (step === 'edit' && screen === 'editor');
    b.disabled = step !== 'model' && !hasModel;
    if (active) b.setAttribute('aria-current', 'step');
    else b.removeAttribute('aria-current');
  });
  el.startBack.hidden = !hasModel;
  $('#export').disabled = !hasModel;
}

function onStep(step) {
  if (step === 'model') setScreen('start');
  else if (step === 'edit') setScreen('editor');
  else if (step === 'export') openExport();
}

// --- modellen en de startpagina -------------------------------------------------------

async function loadModelList() {
  const r = await fetch(MODELS_URL);
  if (!r.ok) throw new Error(t('modellijst niet gevonden ({status})', { status: r.status }));
  return r.json();
}

async function loadCatalog() {
  await Promise.all(
    models.map(async (m) => {
      const r = await fetch(`assets/templates/${m.id}/panels.json`);
      if (!r.ok) throw new Error(t('sjabloon {id} niet gevonden', { id: m.id }));
      catalog.set(m.id, await r.json());
    }),
  );
}

// Tekent het paneelsilhouet van een model: witte panelen op de kaart.
async function drawSilhouette(canvas, id) {
  const meta = catalog.get(id);
  if (!meta) return;
  try {
    const img = await loadImage(`assets/templates/${id}/mask.png`);
    const W = 260;
    const H = Math.round((W * meta.height) / meta.width);
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const d = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < d.data.length; i += 4) {
      const on = d.data[i] > 0;
      d.data[i] = 226;
      d.data[i + 1] = 231;
      d.data[i + 2] = 238;
      d.data[i + 3] = on ? 255 : 0;
    }
    ctx.putImageData(d, 0, 0);
  } catch {
    // Zonder silhouet toont de kaart alleen de naam.
  }
}

function modelCard(m) {
  const meta = catalog.get(m.id);
  const info = meta ? t('{n} panelen, {w} × {h}', { n: meta.panels.length, w: meta.width, h: meta.height }) : '';
  const isCurrent = current && current.id === m.id;
  return `<button class="model-card${isCurrent ? ' is-current' : ''}" type="button" data-model="${m.id}">
    <span class="sil-wrap"><canvas data-sil="${m.id}" aria-hidden="true"></canvas></span>
    <span class="model-name">${esc(t(m.name))}</span>
    <span class="model-meta mono">${esc(info)}</span>
  </button>`;
}

function renderModelGrid() {
  const groups = new Map();
  for (const m of models) {
    if (!groups.has(m.group)) groups.set(m.group, []);
    groups.get(m.group).push(m);
  }
  el.grid.innerHTML = [...groups]
    .map(
      ([group, items]) => `<section class="model-group" aria-labelledby="g-${slug(group)}">
        <h2 id="g-${slug(group)}">${esc(group)}</h2>
        <div class="cards">${items.map(modelCard).join('')}</div>
      </section>`,
    )
    .join('');
  el.grid.querySelectorAll('canvas[data-sil]').forEach((c) => drawSilhouette(c, c.dataset.sil));
}

// Laadt een model: sjabloon, canvasafmeting en (tenzij keepDoc) een lege lagenlijst.
async function selectModel(id, { keepDoc = false } = {}) {
  const entry = models.find((m) => m.id === id);
  if (!entry) throw new Error(t('onbekend model: {id}', { id }));
  let tpl = templates.get(id);
  if (!tpl) {
    tpl = await loadTemplate(`assets/templates/${id}`);
    templates.set(id, tpl);
  }
  current = entry;
  scene.tpl = tpl;
  scene.w = tpl.w;
  scene.h = tpl.h;
  for (const c of [scene.work, scene.tmp, el.wrap, el.overlay]) {
    c.width = tpl.w;
    c.height = tpl.h;
  }
  el.stage.style.aspectRatio = `${tpl.w} / ${tpl.h}`;
  scene.tint = null;
  scene.tintKey = null;
  fitView();
  try {
    localStorage.setItem('tesla-wrap-model', id);
  } catch {
    // Geen opslag beschikbaar: het model wordt dan niet onthouden.
  }
  if (keepDoc) refresh();
  else resetDocument();
}

// --- ontwerpen: meerdere designs, automatisch opgeslagen in de browser ---------------------

const designId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

// Leeg ontwerp voor het gekozen model. Lagen en selectie zijn per model, dus die worden ook gewist.
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

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraftNow, 700);
}

// Miniatuur van het ontwerp: het gerenderde wrap, klein en als JPEG.
function thumbnail() {
  renderWrap(scene);
  const w = 180;
  const h = Math.round((w * scene.h) / scene.w);
  const c = makeCanvas(w, h);
  c.getContext('2d').drawImage(scene.out, 0, 0, w, h);
  return c.toDataURL('image/jpeg', 0.8);
}

// Bewaart het open ontwerp. Een leeg ontwerp krijgt pas een plek in de lijst als er iets op staat;
// een ontwerp dat al in de lijst staat (bijvoorbeeld na "Alles leegmaken") wordt ook leeg bewaard.
async function saveDraftNow() {
  clearTimeout(saveTimer);
  if (!current) return;
  if (!activeDesign) {
    if (isBlank(scene.layers)) return;
    activeDesign = { id: designId(), name: t('Ontwerp {n}', { n: designList.length + 1 }) };
  }
  const assets = [];
  for (const l of scene.layers) {
    if (l.asset && scene.assets.has(l.asset) && !assets.some((a) => a.id === l.asset)) {
      assets.push({ id: l.asset, dataUrl: scene.assets.get(l.asset).dataUrl });
    }
  }
  const meta = { id: activeDesign.id, name: activeDesign.name, model: current.id, savedAt: Date.now(), thumb: thumbnail() };
  designList = [meta, ...designList.filter((d) => d.id !== meta.id)];
  await putDesign(meta, { layers: scene.layers, assets });
}

// Zet de inhoud van een ontwerp (lagen en foto's) in de editor.
async function applyContent(layers, assets) {
  scene.assets.clear();
  for (const a of assets || []) {
    const img = await loadImage(a.dataUrl);
    scene.assets.set(a.id, { id: a.id, img, w: img.naturalWidth, h: img.naturalHeight, dataUrl: a.dataUrl });
  }
  scene.layers = layers;
  scene.paint.clear();
  scene.selLayerId = null;
  scene.selPanels.clear();
  for (const k of Object.keys(counters)) counters[k] = scene.layers.filter((l) => l.type === k).length;
  history.reset(copyLayers(scene.layers));
}

// Kiest een model: dat is een nieuw, leeg ontwerp. Het vorige ontwerp blijft in de lijst staan.
async function chooseModel(id) {
  if (current && id === current.id) return setScreen('editor');
  try {
    await saveDraftNow();
    await selectModel(id);
    activeDesign = null;
    setScreen('editor');
  } catch (err) {
    alert(t('Model laden mislukt: {msg}', { msg: err.message }));
  }
}

// Opent een ontwerp uit de lijst.
async function openDesign(id) {
  try {
    await saveDraftNow();
    const meta = designList.find((d) => d.id === id);
    const content = await getContent(id);
    if (!meta || !content) throw new Error(t('dit ontwerp is niet meer beschikbaar'));
    await selectModel(meta.model, { keepDoc: true });
    await applyContent(content.layers, content.assets);
    activeDesign = { id: meta.id, name: meta.name };
    setScreen('editor');
  } catch (err) {
    alert(t('Ontwerp openen mislukt: {msg}', { msg: err.message }));
  }
}

// Opent een projectbestand of voorbeeld als nieuw ontwerp in de lijst.
async function importProject(data, name) {
  // Oudere projecten noemden het sjabloon met pad (assets/templates/voyager): de laatste naam is het model.
  const wanted = data.model || String(data.template || '').split('/').pop();
  if (!models.some((m) => m.id === wanted)) throw new Error(t('het model "{model}" bestaat niet meer', { model: wanted }));
  await saveDraftNow();
  await selectModel(wanted, { keepDoc: true });
  const assets = Object.entries(data.assets || {}).map(([id, a]) => ({ id, dataUrl: a.dataUrl }));
  await applyContent(data.layers, assets);
  activeDesign = { id: designId(), name };
  await saveDraftNow();
  setScreen('editor');
}

// Een voorbeeld uit de gallery, als eigen kopie.
async function openExample(id) {
  const r = await fetch(`voorbeelden/${encodeURIComponent(id)}.json`);
  if (!r.ok) throw new Error(t('voorbeeld niet gevonden ({status})', { status: r.status }));
  const data = await r.json();
  await importProject(data, t(data.name || 'Voorbeeld'));
}

async function duplicateDesign(id) {
  await saveDraftNow();
  const meta = designList.find((d) => d.id === id);
  const content = await getContent(id);
  if (!meta || !content) return;
  const copy = { ...meta, id: designId(), name: t('Kopie van {name}', { name: meta.name }), savedAt: Date.now() };
  await putDesign(copy, content);
  designList = [copy, ...designList];
  renderDesigns();
}

async function renameDesign(id) {
  const meta = designList.find((d) => d.id === id);
  if (!meta) return;
  const name = prompt(t('Nieuwe naam voor dit ontwerp'), meta.name);
  if (name === null || !name.trim()) return;
  meta.name = name.trim().slice(0, 60);
  if (activeDesign && activeDesign.id === id) activeDesign.name = meta.name;
  await putMeta(meta);
  renderDesigns();
}

async function removeDesign(id) {
  const meta = designList.find((d) => d.id === id);
  if (!meta || !confirm(t('"{name}" verwijderen? Dit kan niet ongedaan worden gemaakt.', { name: meta.name }))) return;
  await deleteDesign(id);
  designList = designList.filter((d) => d.id !== id);
  if (activeDesign && activeDesign.id === id) {
    activeDesign = null;
    if (current) resetDocument(); // zodat het verwijderde ontwerp niet opnieuw wordt bewaard
  }
  renderDesigns();
}

// Mijn ontwerpen op de startpagina.
function renderDesigns() {
  el.designs.hidden = !designList.length;
  el.designGrid.innerHTML = designList.map(designCard).join('');
}

function designCard(d) {
  const model = models.find((m) => m.id === d.model);
  const open = activeDesign && activeDesign.id === d.id;
  const when = new Date(d.savedAt).toLocaleString(localeTag(), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  return `<article class="design-card${open ? ' is-current' : ''}">
    <div class="design-thumb">${d.thumb ? `<img src="${d.thumb}" alt="">` : ''}</div>
    <div class="design-info">
      <strong>${esc(d.name)}</strong>
      <span class="muted small">${esc(model ? t(model.name) : d.model)}</span>
      <span class="muted small mono">${esc(when)}</span>
    </div>
    <div class="design-actions">
      <button class="btn ${open ? 'primary' : 'quiet'} small" type="button" data-design="open" data-id="${d.id}">${open ? t('Doorgaan') : t('Openen')}</button>
      <button class="btn quiet small" type="button" data-design="dup" data-id="${d.id}">${t('Dupliceren')}</button>
      <button class="btn quiet small" type="button" data-design="rename" data-id="${d.id}">${t('Hernoemen')}</button>
      <button class="btn quiet small danger" type="button" data-design="del" data-id="${d.id}">${t('Verwijderen')}</button>
    </div>
  </article>`;
}

function onDesignClick(e) {
  const btn = e.target.closest('[data-design]');
  if (!btn) return;
  const actions = { open: openDesign, dup: duplicateDesign, rename: renameDesign, del: removeDesign };
  actions[btn.dataset.design](btn.dataset.id);
}

// Laadt de lijst uit de opslag. Een oud enkel ontwerp wordt eerst in de lijst gezet.
async function loadDesigns() {
  const legacy = await loadLegacy();
  if (legacy) {
    if (legacy.model && models.some((m) => m.id === legacy.model) && !isBlank(legacy.layers || [])) {
      const meta = { id: designId(), name: t('Mijn ontwerp'), model: legacy.model, savedAt: legacy.savedAt || Date.now(), thumb: '' };
      await putDesign(meta, { layers: legacy.layers, assets: legacy.assets || [] });
    }
    await clearLegacy();
  }
  designList = await listDesigns();
}

// --- lagen --------------------------------------------------------------------------

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

// --- panelen en gereedschap --------------------------------------------------------

// Kiest een paneel. Met symmetrie aan kies je het spiegelpaneel er automatisch bij.
function pickPanel(p, e) {
  const id = idAt(scene.tpl, p.x, p.y);
  const additive = el.multi.checked || e.shiftKey || e.ctrlKey || e.metaKey;
  if (!additive) scene.selPanels.clear();
  if (id) {
    const ids = [id];
    const mir = ui.symmetry ? mirrorOf(id) : null;
    if (mir !== null && mir !== id) ids.push(mir);
    const remove = additive && scene.selPanels.has(id);
    ids.forEach((i) => {
      if (remove) scene.selPanels.delete(i);
      else scene.selPanels.add(i);
    });
  }
  refresh();
}

function beginMove(p, e) {
  const hit = hitLayer(scene, p.x, p.y);
  if (!hit) {
    scene.selLayerId = null;
    drag = { kind: 'pan', x: e.clientX, y: e.clientY };
    refresh();
    return;
  }
  scene.selLayerId = hit.id;
  drag = { kind: 'move', id: hit.id, pointerId: e.pointerId, start: p, x0: hit.x, y0: hit.y, moved: false, pinch: null };
  refresh();
}

// Twee vingers op een gekozen laag: vergroten en draaien van de laag.
function startPinch() {
  const l = findLayer(drag.id);
  if (!l) return beginView();
  const [a, b] = [...pointers.values()].map((q) => canvasPoint(q.cx, q.cy));
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

// Canvas-pixels per schermpixel: zo blijven greepjes en drempels even groot als je inzoomt.
function pxScale() {
  const w = el.overlay.getBoundingClientRect().width;
  return w ? scene.w / w : 1;
}

// De gekozen laag is een foto, sticker of tekst, en dus te verplaatsen en te draaien.
function selMovable() {
  const l = selLayer();
  return !!l && l.visible && (l.type === 'image' || l.type === 'text');
}

// Greep op een hoekje (vergroten) of het draaibolletje (draaien) van de gekozen laag, of null.
function gripAt(p) {
  if (!selMovable()) return null;
  const h = transformHandles(scene, selLayer(), pxScale());
  if (!h) return null;
  const near = (q) => Math.hypot(p.x - q.x, p.y - q.y) <= GRIP_PX * pxScale();
  const corner = h.corners.find(near);
  if (corner) return { kind: 'scale', layer: selLayer(), corner };
  if (near(h.rotate)) return { kind: 'rotate', layer: selLayer() };
  return null;
}

// Ligt het punt binnen de kaders van de gekozen laag?
function insideSelected(p) {
  if (!selMovable()) return false;
  const l = selLayer();
  const box = l.type === 'image' ? imageBox(scene, l) : textBox(l);
  if (!box) return false;
  const { lx, ly } = toLocal(l, p.x, p.y);
  return Math.abs(lx) <= box.hw && Math.abs(ly) <= box.hh;
}

// Het selectiegereedschap op de gekozen laag: een klik kiest nog steeds een paneel, een sleep verplaatst de laag.
function beginPending(p, e) {
  const l = selLayer();
  drag = {
    kind: 'pending',
    id: l.id,
    pointerId: e.pointerId,
    p0: p,
    cx: e.clientX,
    cy: e.clientY,
    x0: l.x,
    y0: l.y,
    mods: { shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey },
  };
}

// Vergroten (hoekje) of draaien (bolletje). Het middelpunt van de laag blijft op zijn plek.
function beginTransform(grip, p, e) {
  const l = grip.layer;
  const c = { x: l.x, y: l.y };
  const base = { kind: grip.kind, id: l.id, pointerId: e.pointerId, moved: false, c, zoom0: l.zoom, size0: l.size, rot0: l.rot };
  drag = grip.kind === 'scale' ? { ...base, d0: dist(c, grip.corner) } : { ...base, a0: angle(c, p) };
}

// Tijdens vergroten of draaien volgt de laag de vinger of de muis.
function updateTransform(p) {
  const l = findLayer(drag.id);
  if (!l) return;
  const { c } = drag;
  if (drag.kind === 'scale') {
    const k = dist(c, p) / drag.d0;
    if (l.type === 'text') l.size = clamp(drag.size0 * k, 16, 500);
    else l.zoom = clamp(drag.zoom0 * k, 0.1, 6);
  } else {
    l.rot = wrapDeg(drag.rot0 + (wrapRad(angle(c, p) - drag.a0) * 180) / Math.PI);
  }
  drag.moved = true;
  syncFields();
}

// Tip bij de gekozen foto, sticker of tekst: wat je ermee kunt doen.
function transformHint() {
  if (!selMovable() || !['select', 'move'].includes(ui.tool)) return '';
  const l = selLayer();
  const hint = l.type === 'text' ? HINT_TEXT : l.sticker ? HINT_STICKER : HINT_PHOTO;
  return `${t(hint)} ${t('Een hoekje vergroot, het bolletje draait. Pijltjes en [ ] stellen fijn bij.')}`;
}

// Een streek met symmetrie aan krijgt de spiegelas mee, zodat hij ook op de andere kant getekend wordt.
function beginStroke(p, pointerId, erase) {
  let layer = selLayer();
  if (!layer || layer.type !== 'paint') {
    if (erase) return flash(t('Kies eerst een tekenlaag (teken er eerst iets op) om te gummen.'));
    layer = { id: newId('l'), type: 'paint', name: nextName('paint'), visible: true, opacity: 1, panels: null, strokes: [] };
    insertLayer(layer);
  }
  const ctx = ensurePaint(scene, layer).getContext('2d');
  const stroke = {
    c: el.color.value,
    w: Number(el.size.value),
    e: erase,
    sym: ui.symmetry && typeof scene.tpl.axis === 'number' ? scene.tpl.axis : null,
    p: [p.x, p.y],
  };
  layer.strokes = [...layer.strokes, stroke];
  drawStroke(ctx, stroke);
  drag = { kind: 'draw', id: layer.id, pointerId, stroke, last: p };
  refresh();
}

function finishStroke() {
  drag = null;
  commit({ list: false, props: false });
}

function onPointerDown(e) {
  if (!scene.tpl || screen !== 'editor') return;
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
  e.preventDefault();
  el.overlay.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { cx: e.clientX, cy: e.clientY });

  if (pointers.size >= 2) {
    const transforming = drag && (drag.kind === 'scale' || drag.kind === 'rotate');
    if (!transforming) {
      if (drag && drag.kind === 'move' && drag.pinch === null && ui.tool === 'move') startPinch();
      else {
        if (drag && drag.kind === 'draw') finishStroke();
        beginView();
      }
    }
    requestRender();
    return;
  }

  if (e.button === 1 || ui.space) {
    drag = { kind: 'pan', x: e.clientX, y: e.clientY };
    return;
  }
  const p = canvasPoint(e.clientX, e.clientY);
  const grip = ui.tool === 'select' || ui.tool === 'move' ? gripAt(p) : null;
  if (grip) {
    beginTransform(grip, p, e);
    requestRender();
    return;
  }
  switch (ui.tool) {
    case 'select':
      if (insideSelected(p)) beginPending(p, e);
      else pickPanel(p, e);
      break;
    case 'move':
      beginMove(p, e);
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
  requestRender();
}

function onPointerMove(e) {
  const pos = pointers.get(e.pointerId);
  if (!pos) return;
  pos.cx = e.clientX;
  pos.cy = e.clientY;
  if (!drag) return;
  // Een klik op de gekozen laag wordt een sleep zodra de vinger of muis echt beweegt.
  if (drag.kind === 'pending' && e.pointerId === drag.pointerId && Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy) > DRAG_PX) {
    drag = { kind: 'move', id: drag.id, pointerId: drag.pointerId, start: drag.p0, x0: drag.x0, y0: drag.y0, moved: false, pinch: null };
  }

  if (drag.kind === 'pan') {
    view.x += e.clientX - drag.x;
    view.y += e.clientY - drag.y;
    drag.x = e.clientX;
    drag.y = e.clientY;
    clampView();
    applyView();
  } else if (drag.kind === 'view') {
    if (pointers.size >= 2) updateView();
  } else if (drag.kind === 'move') {
    const l = findLayer(drag.id);
    if (!l) return;
    if (drag.pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()].map((q) => canvasPoint(q.cx, q.cy));
      const pz = drag.pinch;
      const k = dist(a, b) / pz.d0;
      const m = mid(a, b);
      if (l.type === 'text') l.size = clamp(pz.size0 * k, 16, 500);
      else l.zoom = clamp(pz.zoom0 * k, 0.1, 6);
      l.rot = wrapDeg(pz.rot0 + (wrapRad(angle(a, b) - pz.a0) * 180) / Math.PI);
      l.x = pz.x0 + (m.x - pz.m0.x);
      l.y = pz.y0 + (m.y - pz.m0.y);
    } else if (e.pointerId === drag.pointerId) {
      const p = canvasPoint(e.clientX, e.clientY);
      l.x = drag.x0 + (p.x - drag.start.x);
      l.y = drag.y0 + (p.y - drag.start.y);
      drag.moved = true;
    }
    syncFields();
  } else if (drag.kind === 'scale' || drag.kind === 'rotate') {
    if (e.pointerId === drag.pointerId) updateTransform(canvasPoint(e.clientX, e.clientY));
  } else if (drag.kind === 'draw' && e.pointerId === drag.pointerId) {
    const l = findLayer(drag.id);
    if (!l) return;
    const p = canvasPoint(e.clientX, e.clientY);
    const last = drag.last;
    drag.stroke.p.push(p.x, p.y);
    drawSegment(ensurePaint(scene, l).getContext('2d'), drag.stroke, last.x, last.y, p.x, p.y);
    drag.last = p;
  }
  requestRender();
}

function onPointerEnd(e) {
  if (!pointers.delete(e.pointerId) || !drag) return;
  if (drag.kind === 'pending') {
    if (e.pointerId === drag.pointerId) {
      const { p0, mods } = drag;
      drag = null;
      // Zonder sleep was het gewoon een klik: kies dan het paneel onder de vinger.
      if (e.type === 'pointerup') pickPanel(p0, mods);
    }
  } else if (drag.kind === 'scale' || drag.kind === 'rotate') {
    if (e.pointerId === drag.pointerId) {
      const moved = drag.moved;
      drag = null;
      if (moved) commit({ list: false, props: false });
    }
  } else if (drag.kind === 'draw') {
    if (e.pointerId === drag.pointerId) finishStroke();
  } else if (drag.kind === 'view') {
    if (pointers.size < 2) drag = null;
  } else if (drag.kind === 'pan') {
    if (pointers.size === 0) drag = null;
  } else if (drag.kind === 'move') {
    if (pointers.size === 0) {
      const moved = drag.moved;
      drag = null;
      if (moved) commit({ list: false, props: false });
    } else if (drag.pinch) {
      // Een van de twee vingers is los: ga door met slepen op de vinger die nog op het scherm staat.
      const [id2, pos] = pointers.entries().next().value;
      const l = findLayer(drag.id);
      Object.assign(drag, {
        pinch: null,
        pointerId: id2,
        start: canvasPoint(pos.cx, pos.cy),
        x0: l ? l.x : 0,
        y0: l ? l.y : 0,
        moved: true,
      });
    }
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

// --- lagenlijst en eigenschappen ------------------------------------------------------

function renderLayerList() {
  if (!scene.layers.length) {
    el.layers.innerHTML = `<li class="muted small">${t('Nog geen lagen.')}</li>`;
    return;
  }
  el.layers.innerHTML = [...scene.layers]
    .reverse()
    .map((l) => {
      const scope = l.panels ? t('panelen {ids}', { ids: l.panels.join(', ') }) : t('hele wrap');
      return `<li class="layer${l.id === scene.selLayerId ? ' is-selected' : ''}" data-id="${l.id}">
        <input type="checkbox" data-act="vis"${l.visible ? ' checked' : ''} aria-label="${esc(t('{name} zichtbaar', { name: l.name }))}">
        <button class="layer-name" type="button" data-act="select">
          <strong>${esc(l.name)}</strong><small>${esc(`${t(LABELS[l.type])}, ${scope}`)}</small>
        </button>
        <span class="layer-btns">
          <button class="icon-btn" type="button" data-act="up" aria-label="${t('Eén laag omhoog')}" title="${t('Omhoog')}">${icon('up')}</button>
          <button class="icon-btn" type="button" data-act="down" aria-label="${t('Eén laag omlaag')}" title="${t('Omlaag')}">${icon('down')}</button>
          <button class="icon-btn danger" type="button" data-act="del" aria-label="${t('Laag verwijderen')}" title="${t('Verwijderen')}">${icon('close')}</button>
        </span>
      </li>`;
    })
    .join('');
}

// Kleine pictogrammen (lijnstijl, zoals de rest van de interface).
function icon(name) {
  const symbols = { up: 'chevron-up', down: 'chevron-down', close: 'x' };
  return `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><use href="img/icons.svg#i-${symbols[name] || 'x'}"/></svg>`;
}

const rangeField = (prop, label, value, min, max, unit) =>
  `<label class="field"><span>${t(label)} <b class="mono" data-out="${prop}">${Math.round(value)}${unit}</b></span>` +
  `<input type="range" data-prop="${prop}" data-unit="${unit}" min="${min}" max="${max}" step="1" value="${Math.round(value)}"></label>`;

const colorField = (prop, label, value) =>
  `<label class="field"><span>${t(label)}</span><input type="color" data-prop="${prop}" value="${value}"></label>`;

function renderProps() {
  const l = selLayer();
  if (!l) {
    el.props.innerHTML = `<p class="muted small">${t('Selecteer een laag in de lijst, of voeg er een toe.')}</p>`;
    return;
  }

  let body = '';
  if (l.type === 'fill') {
    body =
      colorField('color', 'Kleur', l.color) +
      `<label class="check"><input type="checkbox" data-act="grad"${l.gradient ? ' checked' : ''}> ${t('Verloop')}</label>` +
      (l.gradient ? colorField('color2', 'Tweede kleur', l.color2) + rangeField('angle', 'Hoek', l.angle, -180, 180, '°') : '');
  } else if (l.type === 'image') {
    body =
      rangeField('zoom', 'Vergroting', l.zoom * 100, 10, 600, '%') +
      rangeField('rot', 'Draaien', l.rot, -180, 180, '°') +
      rangeField('opacity', 'Dekking', l.opacity * 100, 0, 100, '%') +
      `<div class="row">
        <button class="btn" type="button" data-act="flip">${t('Spiegelen')}</button>
        <button class="btn" type="button" data-act="fit">${t('Opnieuw passen')}</button>
        <button class="btn" type="button" data-act="replace">${t('Andere afbeelding')}</button>
      </div>`;
  } else if (l.type === 'paint') {
    body =
      rangeField('opacity', 'Dekking', l.opacity * 100, 0, 100, '%') +
      `<p class="muted small">${t('Kies Kwast of Gum om te tekenen. Tekeningen worden altijd tot de panelen beperkt.')}</p>`;
  } else if (l.type === 'text') {
    body =
      `<label class="field"><span>${t('Tekst')}</span><input type="text" data-prop="text" value="${esc(l.text)}"></label>` +
      `<label class="field"><span>${t('Lettertype')}</span><select data-prop="font">${FONTS.map(
        (f) => `<option${f === l.font ? ' selected' : ''}>${f}</option>`,
      ).join('')}</select></label>` +
      `<label class="check"><input type="checkbox" data-act="bold"${l.bold ? ' checked' : ''}> ${t('Vet')}</label>` +
      colorField('color', 'Kleur', l.color) +
      rangeField('size', 'Grootte', l.size, 16, 500, 'px') +
      rangeField('rot', 'Draaien', l.rot, -180, 180, '°') +
      rangeField('opacity', 'Dekking', l.opacity * 100, 0, 100, '%');
  }

  const n = scene.selPanels.size;
  const scope =
    l.type === 'paint'
      ? ''
      : `<div class="field"><span>${t('Toepassen op')}</span>
        <div class="seg">
          <button class="btn${l.panels ? '' : ' on'}" type="button" data-act="scope-all">${t('Hele wrap')}</button>
          <button class="btn${l.panels ? ' on' : ''}" type="button" data-act="scope-sel"${n ? '' : ' disabled'}>${t('Gekozen panelen ({n})', { n })}</button>
        </div>
        <small class="muted">${l.panels ? t('Nu op panelen {ids}', { ids: l.panels.join(', ') }) : t('Nu op alle panelen')}</small>
      </div>`;

  el.props.innerHTML = `<h3>${esc(l.name)}</h3>${scope}${body}
    <button class="btn quiet danger" type="button" data-act="delete">${t('Laag verwijderen')}</button>`;
}

function setProp(l, key, raw) {
  if (key === 'zoom') l.zoom = Number(raw) / 100;
  else if (key === 'opacity') l.opacity = Number(raw) / 100;
  else if (key === 'rot' || key === 'angle' || key === 'size') l[key] = Number(raw);
  else l[key] = raw; // color, color2, text, font
}

function onPropInput(e) {
  const input = e.target;
  const l = selLayer();
  if (!l || !input.dataset.prop) return;
  setProp(l, input.dataset.prop, input.value);
  const out = el.props.querySelector(`[data-out="${input.dataset.prop}"]`);
  if (out) out.textContent = input.value + (input.dataset.unit || '');
  requestRender();
}

function onPropChange(e) {
  const input = e.target;
  const l = selLayer();
  if (!l) return;
  if (input.dataset.prop) {
    setProp(l, input.dataset.prop, input.value);
    commit({ list: false, props: false });
  } else if (input.dataset.act === 'grad') {
    l.gradient = input.checked;
    commit();
  } else if (input.dataset.act === 'bold') {
    l.bold = input.checked;
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
      if (l.sticker) fitSticker(l);
      else fitLayer(l);
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
  const input = e.target;
  if (input.dataset.act !== 'vis') return;
  const l = findLayer(input.closest('li').dataset.id);
  if (!l) return;
  l.visible = input.checked;
  commit();
}

// --- afbeeldingen: foto's en stickers ----------------------------------------------------

// Foto: volledige afbeelding, verkleind tot MAX_PHOTO_SIDE. PNG blijft PNG (transparantie blijft behouden).
async function loadPhoto(file) {
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
  return { id: newId('a'), img: await loadImage(dataUrl), w, h, dataUrl };
}

// Sticker of logo: PNG, WebP of SVG. Transparantie blijft, en lege randen worden bijgesneden.
async function loadSticker(file) {
  const src = URL.createObjectURL(file);
  let img;
  try {
    img = await loadImage(src);
  } finally {
    URL.revokeObjectURL(src);
  }
  const nw = img.naturalWidth || 1024; // SVG zonder afmeting
  const nh = img.naturalHeight || 1024;
  const k = Math.min(1, MAX_STICKER_SIDE / Math.max(nw, nh));
  const w = Math.max(1, Math.round(nw * k));
  const h = Math.max(1, Math.round(nh * k));
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const b = alphaBounds(ctx, w, h);
  const trimmed = makeCanvas(b.w, b.h);
  trimmed.getContext('2d').drawImage(canvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
  const dataUrl = trimmed.toDataURL('image/png');
  return { id: newId('a'), img: await loadImage(dataUrl), w: b.w, h: b.h, dataUrl };
}

// Het kleinste vak dat alle zichtbare pixels (alpha > 8) omvat.
function alphaBounds(ctx, w, h) {
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return { x: 0, y: 0, w, h };
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Eén foto per gekozen paneel. Eén bestand geldt voor alle panelen; anders precies één bestand per paneel, in paneelvolgorde.
async function pickPhotosEach(e) {
  const files = [...e.target.files];
  e.target.value = '';
  const panels = [...scene.selPanels].sort((a, b) => a - b);
  if (!files.length || panels.length < 2) return;
  if (files.length !== 1 && files.length !== panels.length) {
    alert(t("Kies één foto, of precies {n} foto's: één per gekozen paneel.", { n: panels.length }));
    return;
  }
  try {
    const assets = [];
    for (const file of files) {
      const asset = await loadPhoto(file);
      scene.assets.set(asset.id, asset);
      assets.push(asset);
    }
    panels.forEach((id, i) => {
      const layer = {
        id: newId('l'),
        type: 'image',
        name: nextName('image'),
        sticker: false,
        visible: true,
        opacity: 1,
        panels: [id],
        asset: (assets.length === 1 ? assets[0] : assets[i]).id,
        x: scene.w / 2,
        y: scene.h / 2,
        rot: 0,
        zoom: 1,
        base: 1,
        flip: false,
      };
      fitLayer(layer);
      insertLayer(layer);
    });
    commit();
  } catch (err) {
    alert(t("Foto's konden niet worden toegevoegd: {msg}", { msg: err.message }));
  }
}

async function pickFile(e, { sticker }) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const asset = sticker ? await loadSticker(file) : await loadPhoto(file);
    scene.assets.set(asset.id, asset);
    const target = !sticker && photoTarget ? findLayer(photoTarget) : null;
    photoTarget = null;
    if (target) {
      target.asset = asset.id;
      fitLayer(target);
      scene.selLayerId = target.id;
    } else {
      const layer = {
        id: newId('l'),
        type: 'image',
        name: nextName(sticker ? 'sticker' : 'image'),
        sticker,
        visible: true,
        opacity: 1,
        panels: scopeNow(),
        asset: asset.id,
        x: scene.w / 2,
        y: scene.h / 2,
        rot: 0,
        zoom: 1,
        base: 1,
        flip: false,
      };
      if (sticker) fitSticker(layer);
      else fitLayer(layer);
      insertLayer(layer);
    }
    commit();
  } catch (err) {
    alert(t('Afbeelding kon niet worden toegevoegd: {msg}', { msg: err.message }));
  }
}

// --- project en export ---------------------------------------------------------------

function saveProject() {
  const assets = {};
  for (const l of scene.layers) {
    if (l.asset && scene.assets.has(l.asset)) assets[l.asset] = { dataUrl: scene.assets.get(l.asset).dataUrl };
  }
  const data = {
    format: 'tesla-wrap-project',
    version: 2,
    name: activeDesign ? activeDesign.name : null,
    model: current ? current.id : null,
    layers: scene.layers,
    assets,
  };
  download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `tesla-wrap-project-${stamp()}.json`);
}

async function loadProjectFile(e) {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.format !== 'tesla-wrap-project' || !Array.isArray(data.layers)) {
      throw new Error(t('dit is geen Tesla wrap-project'));
    }
    await importProject(data, data.name || t('Geïmporteerd ontwerp'));
  } catch (err) {
    alert(t('Project openen mislukt: {msg}', { msg: err.message }));
  }
}

async function openExport() {
  if (!scene.tpl) return;
  renderNow();
  try {
    showExport(await exportWrap(scene.out, scene.tpl));
  } catch (err) {
    alert(t('Exporteren mislukt: {msg}', { msg: err.message }));
  }
}

// Bestandsnaam: maximaal 30 tekens, alleen letters, cijfers, streepjes en underscores (Tesla-eis).
function exportName() {
  const d = new Date();
  const hhmm = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  return `wrap_${current.code}_${hhmm}.png`;
}

function showExport(result) {
  if (exportUrl) URL.revokeObjectURL(exportUrl);
  exportUrl = URL.createObjectURL(result.blob);
  const name = exportName();
  const ok = result.checks.every((c) => c.ok);

  $('#export-preview').src = exportUrl;
  $('#export-info').textContent = `${t(current.name)}, ${result.width} × ${result.height} px, ${(result.blob.size / 1024).toFixed(0)} KB, ${result.mode}`;
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

  if (!el.dialog.open) el.dialog.showModal();
}

// --- toetsenbord en bindingen ---------------------------------------------------------

function onKey(e) {
  if (screen !== 'editor' || el.dialog.open) return;
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
  } else if (e.key === ' ') {
    ui.space = true;
    e.preventDefault();
  } else if ((e.key === 'Delete' || e.key === 'Backspace') && scene.selLayerId) {
    e.preventDefault();
    deleteLayer(scene.selLayerId);
  } else if (e.key === 'Escape') {
    scene.selPanels.clear();
    scene.selLayerId = null;
    refresh();
  } else if (e.key === '+' || e.key === '=') {
    zoomBy(1.25);
  } else if (e.key === '-') {
    zoomBy(1 / 1.25);
  } else if (e.key === '0') {
    fitView();
  } else if (ARROW_STEP[e.key] && selMovable()) {
    e.preventDefault();
    const [dx, dy] = ARROW_STEP[e.key];
    const step = e.shiftKey ? 10 : 1;
    const l = selLayer();
    l.x += dx * step;
    l.y += dy * step;
    syncFields();
    commit({ list: false, props: false });
  } else if ((e.key === '[' || e.key === ']') && selMovable()) {
    e.preventDefault();
    const l = selLayer();
    l.rot = wrapDeg(l.rot + (e.key === ']' ? 5 : -5));
    syncFields();
    commit({ list: false, props: false });
  } else if (TOOL_KEYS[key]) {
    setTool(TOOL_KEYS[key]);
  }
}

function setupEvents() {
  document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
  el.steps.forEach((b) => b.addEventListener('click', () => onStep(b.dataset.step)));
  el.startBack.addEventListener('click', () => setScreen('editor'));
  el.grid.addEventListener('click', (e) => {
    const card = e.target.closest('button[data-model]');
    if (card) chooseModel(card.dataset.model);
  });
  el.designGrid.addEventListener('click', onDesignClick);

  $('#add-fill').addEventListener('click', addFill);
  for (const btn of [$('#add-photo'), $('#mobile-photo')]) {
    btn.addEventListener('click', () => {
      photoTarget = null;
      el.photoInput.click();
    });
  }
  $('#add-photo-each').addEventListener('click', () => el.photoEachInput.click());
  $('#add-sticker').addEventListener('click', () => {
    el.stickerInput.click();
  });
  $('#add-text').addEventListener('click', () => {
    const [x0, y0, x1, y1] = boundsOf(scene.tpl, scopeNow());
    addText({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
  });
  $('#clear-all').addEventListener('click', () => {
    if (!confirm(t('Alle lagen verwijderen en opnieuw beginnen?'))) return;
    resetDocument();
    scheduleSave();
  });
  $('#select-all').addEventListener('click', () => {
    scene.selPanels = new Set(scene.tpl.panels.map((p) => p.id));
    refresh();
  });
  $('#select-none').addEventListener('click', () => {
    scene.selPanels.clear();
    refresh();
  });

  el.color.addEventListener('input', () => setPref('color', el.color.value));
  el.size.addEventListener('input', () => {
    el.sizeOut.textContent = el.size.value;
    setPref('size', el.size.value);
  });
  el.multi.addEventListener('change', () => setPref('multi', el.multi.checked));
  el.symmetry.addEventListener('change', () => {
    ui.symmetry = el.symmetry.checked;
    setPref('symmetry', ui.symmetry);
    requestRender();
  });
  el.outlines.addEventListener('change', () => {
    ui.outlines = el.outlines.checked;
    setPref('outlines', ui.outlines);
    requestRender();
  });
  el.labels.addEventListener('change', () => {
    ui.labels = el.labels.checked;
    setPref('labels', ui.labels);
    requestRender();
  });

  el.undo.addEventListener('click', undo);
  el.redo.addEventListener('click', redo);
  $('#save-project').addEventListener('click', saveProject);
  $('#open-project').addEventListener('click', () => el.projectInput.click());
  el.projectInput.addEventListener('change', loadProjectFile);
  el.photoInput.addEventListener('change', (e) => pickFile(e, { sticker: false }));
  el.photoEachInput.addEventListener('change', pickPhotosEach);
  el.stickerInput.addEventListener('change', (e) => pickFile(e, { sticker: true }));

  $('#zoom-in').addEventListener('click', () => zoomBy(1.25));
  $('#zoom-out').addEventListener('click', () => zoomBy(1 / 1.25));
  $('#zoom-fit').addEventListener('click', fitView);
  $('#zoom-panel').addEventListener('click', zoomToSelection);
  el.stage.addEventListener('wheel', onWheel, { passive: false });

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
  document.addEventListener('keyup', (e) => {
    if (e.key === ' ') ui.space = false;
  });
  window.addEventListener('pagehide', saveDraftNow);
  $('#export').addEventListener('click', openExport);
}

// Zet de onthouden keuzes terug: gereedschap, kleur, dikte en de paneel-opties.
function restorePrefs() {
  el.color.value = getPref('color', el.color.value);
  el.size.value = getPref('size', el.size.value);
  el.sizeOut.textContent = el.size.value;
  el.multi.checked = getPref('multi', el.multi.checked);
  el.symmetry.checked = getPref('symmetry', el.symmetry.checked);
  el.outlines.checked = getPref('outlines', el.outlines.checked);
  el.labels.checked = getPref('labels', el.labels.checked);
  ui.symmetry = el.symmetry.checked;
  ui.outlines = el.outlines.checked;
  ui.labels = el.labels.checked;
  const tool = getPref('tool', 'select');
  setTool(Object.values(TOOL_KEYS).includes(tool) ? tool : 'select');
}

// Bij een taalwissel: alles wat je ziet opnieuw vertalen.
function refreshText() {
  if (models.length) renderModelGrid();
  renderDesigns();
  refresh();
  if (el.dialog.open) openExport();
}

async function init() {
  setupEvents();
  await initI18n();
  onLanguageChange(refreshText);
  restorePrefs();
  try {
    const data = await loadModelList();
    models = data.models;
    await loadCatalog();
    await loadDesigns();
  } catch (err) {
    el.startNote.textContent = t('Laden mislukt: {msg}', { msg: err.message });
  }
  // Een link uit de gallery (?voorbeeld=id) opent dat voorbeeld als eigen ontwerp.
  const example = new URLSearchParams(location.search).get('voorbeeld');
  if (example) {
    window.history.replaceState(null, '', location.pathname);
    try {
      await openExample(example);
      return;
    } catch (err) {
      el.startNote.textContent = t('Voorbeeld openen mislukt: {msg}', { msg: err.message });
    }
  }
  // Een autokeuze van de landingspagina (?model=id) opent de editor meteen met dat model.
  const model = new URLSearchParams(location.search).get('model');
  if (model && models.some((m) => m.id === model)) {
    window.history.replaceState(null, '', location.pathname);
    await chooseModel(model);
    return;
  }
  setScreen('start');
}

init();
