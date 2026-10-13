// Galerij op de startpagina: de voorbeelden uit voorbeelden/index.json, met een filter per model.
const grid = document.getElementById('gallery-grid');
const filters = document.getElementById('filters');

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function card(ex) {
  return `<article class="example" data-group="${esc(ex.group)}">
    <img src="${esc(ex.thumb)}" width="512" height="512" loading="lazy" alt="Voorbeeld ${esc(ex.name)}: ${esc(ex.description)}">
    <h3>${esc(ex.name)}</h3>
    <span class="model">${esc(ex.modelName)}</span>
    <p>${esc(ex.description)}</p>
    <a class="btn quiet small" href="/ontwerp/?voorbeeld=${encodeURIComponent(ex.id)}">Openen en aanpassen</a>
  </article>`;
}

async function init() {
  try {
    const res = await fetch('voorbeelden/index.json');
    if (!res.ok) throw new Error(`galerij niet gevonden (${res.status})`);
    const { examples } = await res.json();
    const groups = [...new Set(examples.map((e) => e.group))];
    filters.innerHTML = ['Alle', ...groups]
      .map((g) => `<button class="chip" type="button" aria-pressed="${g === 'Alle'}" data-filter="${esc(g)}">${esc(g)}</button>`)
      .join('');
    grid.innerHTML = examples.map(card).join('');
    filters.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-filter]');
      if (!chip) return;
      const group = chip.dataset.filter;
      filters.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === chip)));
      grid.querySelectorAll('.example').forEach((c) => {
        c.hidden = group !== 'Alle' && c.dataset.group !== group;
      });
    });
  } catch (err) {
    grid.innerHTML = `<p class="muted">De galerij kon niet laden (${esc(err.message)}).</p>`;
  }
}

init();
