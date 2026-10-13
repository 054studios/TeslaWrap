// Startpagina: de autokeuze (direct naar de editor), en de galerij met tien ontwerpen per model.
import { t, initI18n, onLanguageChange } from './i18n.js';
import { getPref, setPref } from './prefs.js';

const modelGrid = document.getElementById('model-groups');
const groupFilters = document.getElementById('group-filters');
const variantFilters = document.getElementById('variant-filters');
const grid = document.getElementById('gallery-grid');

let models = []; // assets/templates/index.json: id, name, group, code
let examples = []; // voorbeelden/index.json
const sizes = new Map(); // model-id -> { w, h, panels } uit panels.json
let group = null; // de gekozen auto (groepsnaam)
let variant = null; // het gekozen model binnen die auto

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const groups = () => [...new Set(models.map((m) => m.group))];
const variantsOf = (g) => models.filter((m) => m.group === g);

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

async function loadSize(m) {
  const res = await fetch(`assets/templates/${m.id}/panels.json`);
  if (!res.ok) throw new Error(t('sjabloon {id} niet gevonden', { id: m.id }));
  const data = await res.json();
  sizes.set(m.id, { w: data.width, h: data.height, panels: data.panels.length });
}

// Tekent het paneelsilhouet van een model, zoals de editor doet. Zonder silhouet blijft alleen de naam staan.
async function drawSilhouette(canvas, id) {
  const size = sizes.get(id);
  if (!size) return;
  try {
    const img = await loadImage(`assets/templates/${id}/mask.png`);
    const W = 260;
    const H = Math.round((W * size.h) / size.w);
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
    // Zonder silhouet toont de rij alleen de naam.
  }
}

// De autokeuze: elke rij opent de editor met dat model klaar.
function modelCard(m) {
  const size = sizes.get(m.id);
  const meta = size ? t('{n} panelen, {w} × {h}', { n: size.panels, w: size.w, h: size.h }) : '';
  return `<a class="model-card" href="/ontwerp/?model=${encodeURIComponent(m.id)}">
    <span class="sil-wrap"><canvas data-sil="${esc(m.id)}" aria-hidden="true"></canvas></span>
    <span class="model-text">
      <span class="model-name">${esc(t(m.name))}</span>
      <span class="model-meta">${esc(meta)}</span>
    </span>
  </a>`;
}

function renderPicker() {
  modelGrid.innerHTML = groups()
    .map(
      (g) => `<section class="model-group" aria-labelledby="g-${slug(g)}">
        <h3 id="g-${slug(g)}">${esc(g)}</h3>
        <div class="model-list">${variantsOf(g).map(modelCard).join('')}</div>
      </section>`,
    )
    .join('');
  modelGrid.querySelectorAll('canvas[data-sil]').forEach((c) => drawSilhouette(c, c.dataset.sil));
}

function renderFilters() {
  groupFilters.innerHTML = groups()
    .map((g) => `<button class="chip" type="button" aria-pressed="${g === group}" data-group="${esc(g)}">${esc(g)}</button>`)
    .join('');
  variantFilters.innerHTML = variantsOf(group)
    .map((m) => `<button class="chip" type="button" aria-pressed="${m.id === variant}" data-variant="${esc(m.id)}">${esc(t(m.name))}</button>`)
    .join('');
}

// Een ontwerp: miniatuur, naam en beschrijving, een echte PNG-download voor de Tesla-app, en openen in de editor.
function designCard(ex) {
  const name = t(ex.name);
  const description = t(ex.description);
  const size = sizes.get(ex.model);
  const ratio = size ? `${size.w} / ${size.h}` : '1 / 1';
  const height = size ? Math.round((512 * size.h) / size.w) : 512;
  return `<article class="design-card">
    <div class="design-thumb" style="aspect-ratio: ${ratio}">
      <img src="${esc(ex.thumb)}" width="512" height="${height}" loading="lazy" alt="${esc(t('Voorbeeld {name}: {description}', { name, description }))}">
    </div>
    <div class="design-body">
      <h3>${esc(name)}</h3>
      <p>${esc(description)}</p>
      <div class="design-actions">
        <a class="btn small" href="${esc(ex.image)}" download="${esc(ex.download)}">${t('Download PNG')}</a>
        <a class="text-link" href="/ontwerp/?voorbeeld=${encodeURIComponent(ex.id)}">${t('Openen en aanpassen')}</a>
      </div>
    </div>
  </article>`;
}

// Tijdens het laden: lege kaarten in de vorm van een ontwerp, zonder tekst en zonder beweging.
const skeletonCards = (n) =>
  '<div class="design-card is-loading" aria-hidden="true"><div class="design-thumb"></div><div class="design-body"><span class="bar"></span><span class="bar short"></span></div></div>'.repeat(n);

function renderGallery() {
  const list = examples.filter((e) => e.model === variant);
  grid.innerHTML = list.length
    ? list.map(designCard).join('')
    : `<p class="muted">${esc(t('Nog geen voorbeelden voor dit model.'))}</p>`;
  grid.removeAttribute('aria-busy');
}

function renderAll() {
  renderFilters();
  renderGallery();
}

// Onthoudt de gekozen auto en het model, zodat de galerij daar weer opent.
function remember() {
  setPref('galleryGroup', group);
  setPref('galleryVariant', variant);
}

function chooseInitial() {
  const savedGroup = getPref('galleryGroup', null);
  group = groups().includes(savedGroup) ? savedGroup : groups()[0];
  const ids = variantsOf(group).map((m) => m.id);
  const savedVariant = getPref('galleryVariant', null);
  variant = ids.includes(savedVariant) ? savedVariant : ids[0];
}

groupFilters.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-group]');
  if (!chip) return;
  group = chip.dataset.group;
  variant = variantsOf(group)[0].id;
  remember();
  renderAll();
});

variantFilters.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-variant]');
  if (!chip) return;
  variant = chip.dataset.variant;
  remember();
  renderAll();
});

async function init() {
  grid.innerHTML = skeletonCards(10);
  try {
    const [catalog, gallery] = await Promise.all(
      ['assets/templates/index.json', 'voorbeelden/index.json'].map(async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(t('galerij niet gevonden ({status})', { status: res.status }));
        return res.json();
      }),
    );
    models = catalog.models;
    examples = gallery.examples;
    await Promise.all(models.map(loadSize));
    chooseInitial();
    renderPicker();
    renderAll();
  } catch (err) {
    grid.innerHTML = `<p class="muted">${esc(t('De galerij kon niet laden ({msg}).', { msg: err.message }))} ${esc(t('Herlaad de pagina of probeer het later opnieuw.'))}</p>`;
    grid.removeAttribute('aria-busy');
  }
}

onLanguageChange(() => {
  if (models.length) {
    renderPicker();
    renderAll();
  }
});
initI18n().then(init);
