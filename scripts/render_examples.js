// Rendert de voorbeelden met de editor zelf: elk projectbestand openen en als PNG exporteren.
// Zo is elke PNG in voorbeelden/ precies wat de editor exporteert.
//
// Eerst: python3 scripts/build_examples.py, en de server vanuit de repo-root:
//   python3 -m http.server 8000 --bind 127.0.0.1
// Dan:
//   NODE_PATH=$(npm root -g) node scripts/render_examples.js [id ...]
//
// Zonder id's rendert het script alle voorbeelden uit voorbeelden/index.json. Per voorbeeld meldt het
// paginafouten, meldingen (alert), mislukte verzoeken en exportcontroles die niet slagen; dan eindigt het
// met code 1. BASE_URL (standaard http://127.0.0.1:8000) en WORKERS (standaard 4) zijn instelbaar.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
const WORKERS = Math.max(1, Number(process.env.WORKERS) || 4);
// Lokaal bestaat /api/country niet (dat is een Vercel-functie); de editor valt dan terug op de browsertaal.
const IGNORED_URLS = ['/api/country'];

async function renderOne(browser, ex) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`paginafout: ${e.message}`));
  page.on('dialog', (d) => {
    errors.push(`melding: ${d.message()}`);
    d.dismiss().catch(() => {});
  });
  page.on('response', (r) => {
    if (r.status() >= 400 && !IGNORED_URLS.some((u) => r.url().includes(u))) errors.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) errors.push(`console: ${m.text()}`);
  });
  try {
    await page.goto(`${BASE}/ontwerp/index.html`);
    await page.waitForSelector('.model-card', { timeout: 20000 });
    await page.setInputFiles('#project-input', path.join(REPO, `voorbeelden/${ex.id}.json`));
    await page.waitForFunction(() => !document.querySelector('#editor').hidden, null, { timeout: 20000 });
    await page.click('#export');
    await page.waitForSelector('#export-dialog[open]', { timeout: 30000 });
    const failed = await page.$$eval('#export-checks li.fail', (items) => items.map((li) => li.textContent.trim()));
    if (failed.length) {
      errors.push(...failed.map((f) => `exportcontrole: ${f}`));
    } else {
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#export-download')]);
      await dl.saveAs(path.join(REPO, ex.image));
    }
  } catch (e) {
    errors.push(e.message.split('\n')[0]);
  } finally {
    await ctx.close();
  }
  return errors;
}

(async () => {
  const all = JSON.parse(fs.readFileSync(path.join(REPO, 'voorbeelden/index.json'), 'utf8')).examples;
  const wanted = process.argv.slice(2);
  const unknown = wanted.filter((id) => !all.some((ex) => ex.id === id));
  if (unknown.length) throw new Error(`onbekende voorbeelden: ${unknown.join(', ')}`);
  const examples = wanted.length ? all.filter((ex) => wanted.includes(ex.id)) : all;

  const res = await fetch(`${BASE}/ontwerp/index.html`).catch(() => null);
  if (!res || !res.ok) throw new Error(`de editor draait niet op ${BASE}; start de server vanuit de repo-root`);

  const browser = await chromium.launch({ headless: true });
  const failures = [];
  let next = 0;
  const worker = async () => {
    while (next < examples.length) {
      const ex = examples[next++];
      const errors = await renderOne(browser, ex);
      console.log(ex.id, errors.length ? `FOUT: ${errors.join(' | ')}` : 'ok');
      if (errors.length) failures.push(ex.id);
    }
  };
  await Promise.all(Array.from({ length: Math.min(WORKERS, examples.length) }, worker));
  await browser.close();
  console.log(`${examples.length - failures.length} van ${examples.length} gerenderd zonder fouten`);
  if (failures.length) {
    console.log(`met fouten: ${failures.join(', ')}`);
    process.exit(1);
  }
})().catch((e) => {
  console.error(e.message.split('\n')[0]);
  process.exit(1);
});
