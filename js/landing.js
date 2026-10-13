// Galerij op de startpagina: de voorbeelden uit voorbeelden/index.json, met een filter per model.
import { t, initI18n, onLanguageChange } from './i18n.js';
import { getPref, setPref } from './prefs.js';

const grid = document.getElementById('gallery-grid');
const filters = document.getElementById('filters');
const ALL = 'Alle';
let examples = [];
let activeGroup = getPref('galleryFilter', ALL);

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function card(ex) {
  const name = t(ex.name);
  const description = t(ex.description);
  return `<article class="example" data-group="${esc(ex.group)}">
    <img src="${esc(ex.thumb)}" width="512" height="512" loading="lazy" alt="${esc(t('Voorbeeld {name}: {description}', { name, description }))}">
    <h3>${esc(name)}</h3>
    <span class="model">${esc(t(ex.modelName))}</span>
    <p>${esc(description)}</p>
    <a class="btn quiet small" href="/ontwerp/?voorbeeld=${encodeURIComponent(ex.id)}">${t('Openen en aanpassen')}</a>
  </article>`;
}

// Tekent de filters en de voorbeelden opnieuw, ook na een taalwissel. Het gekozen filter blijft staan.
function render() {
  const groups = [...new Set(examples.map((e) => e.group))];
  if (activeGroup !== ALL && !groups.includes(activeGroup)) activeGroup = ALL;
  filters.innerHTML = [ALL, ...groups]
    .map((g) => `<button class="chip" type="button" data-filter="${esc(g)}">${esc(g === ALL ? t(ALL) : g)}</button>`)
    .join('');
  grid.innerHTML = examples.map(card).join('');
  applyFilter();
}

function applyFilter() {
  filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === activeGroup)));
  grid.querySelectorAll('.example').forEach((c) => {
    c.hidden = activeGroup !== ALL && c.dataset.group !== activeGroup;
  });
}

filters.addEventListener('click', (e) => {
  const chip = e.target.closest('[data-filter]');
  if (!chip) return;
  activeGroup = chip.dataset.filter;
  setPref('galleryFilter', activeGroup);
  applyFilter();
});

async function init() {
  try {
    const res = await fetch('voorbeelden/index.json');
    if (!res.ok) throw new Error(t('galerij niet gevonden ({status})', { status: res.status }));
    examples = (await res.json()).examples;
    render();
  } catch (err) {
    grid.innerHTML = `<p class="muted">${esc(t('De galerij kon niet laden ({msg}).', { msg: err.message }))}</p>`;
  }
}

onLanguageChange(() => {
  if (examples.length) render();
});
initI18n().then(init);
