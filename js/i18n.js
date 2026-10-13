// Talen van de site. Nederlands is de bron: de Nederlandse tekst is de sleutel in de vertalingen
// (js/i18n/<taal>.json). Een tekst zonder vertaling blijft dus Nederlands.
import { getPref, setPref } from './prefs.js';

export const LANGS = [
  { code: 'nl', name: 'Nederlands', locale: 'nl-NL' },
  { code: 'en', name: 'English', locale: 'en-GB' },
  { code: 'de', name: 'Deutsch', locale: 'de-DE' },
  { code: 'fr', name: 'Français', locale: 'fr-FR' },
  { code: 'tr', name: 'Türkçe', locale: 'tr-TR' },
];
const CODES = LANGS.map((l) => l.code);
// Landen die een taal bepalen. Andere landen, zoals België en Zwitserland, volgen de taal van de browser.
const COUNTRY_LANG = { NL: 'nl', DE: 'de', AT: 'de', FR: 'fr', TR: 'tr' };
// Vaste HTML-teksten staan in de tekst zelf en in deze attributen.
const TEXT_ATTRS = [
  ['[aria-label]', 'aria-label'],
  ['[title]', 'title'],
  ['[alt]', 'alt'],
  ['[placeholder]', 'placeholder'],
  ['meta[name="description"]', 'content'],
];

let lang = 'nl';
let dict = {};
let statics = null; // de Nederlandse bron van de vaste HTML, zodat die bij elke taalwissel opnieuw vertaald kan worden
let version = 0; // een nieuwere taalkeuze maakt een oudere die nog aan het laden is ongeldig
const dictionaries = new Map();
const listeners = [];

export const currentLang = () => lang;
export const localeTag = () => LANGS.find((l) => l.code === lang).locale;
// Roept fn aan na elke taalwissel, zodat teksten die JavaScript maakt opnieuw getekend kunnen worden.
export const onLanguageChange = (fn) => listeners.push(fn);

// Vertaalt een Nederlandse tekst. Waarden voor {naam} geef je mee: t('{n} panelen', { n: 3 }).
export function t(source, vars) {
  const text = (Object.hasOwn(dict, source) && dict[source]) || source;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, key) => (Object.hasOwn(vars, key) ? vars[key] : match));
}

function loadDictionary(code) {
  if (code === 'nl') return Promise.resolve({});
  if (!dictionaries.has(code)) {
    const load = fetch(new URL(`./i18n/${code}.json`, import.meta.url)).then((res) => {
      if (!res.ok) throw new Error(`vertaling ${code} niet gevonden (${res.status})`);
      return res.json();
    });
    dictionaries.set(code, load);
    load.catch(() => dictionaries.delete(code)); // een mislukte download mag later opnieuw
  }
  return dictionaries.get(code);
}

// Onthoudt de Nederlandse tekst van de vaste HTML, nog vóór de eerste vertaling.
function collectStatics() {
  statics = [];
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node.parentElement.closest('script, style')) continue;
    const text = node.nodeValue;
    const source = text.trim();
    if (!source) continue;
    const at = text.indexOf(source);
    statics.push({ node, source, lead: text.slice(0, at), trail: text.slice(at + source.length) });
  }
  for (const [selector, attr] of TEXT_ATTRS) {
    document.querySelectorAll(selector).forEach((el) => {
      const source = el.getAttribute(attr).trim();
      if (source) statics.push({ el, attr, source });
    });
  }
}

function applyStatics() {
  for (const s of statics) {
    if (s.node) s.node.nodeValue = s.lead + t(s.source) + s.trail;
    else s.el.setAttribute(s.attr, t(s.source));
  }
}

// Zet de taal: de vaste HTML, de vertaalde teksten en de luisteraars. Zonder vertaling blijft het Nederlands.
export async function setLanguage(code, { save = true } = {}) {
  const mine = ++version;
  let next = CODES.includes(code) ? code : 'nl';
  let nextDict;
  try {
    nextDict = await loadDictionary(next);
  } catch {
    next = 'nl';
    nextDict = {};
  }
  if (mine !== version) return;
  lang = next;
  dict = nextDict;
  if (save && next === code) setPref('lang', next);
  if (!statics) collectStatics();
  applyStatics();
  document.documentElement.lang = next;
  document.querySelectorAll('[data-lang-select]').forEach((s) => (s.value = next));
  listeners.forEach((fn) => fn(next));
}

// Taal van het land van de bezoeker (api/country.js op Vercel). Null als dat niet lukt.
async function countryLanguage() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch('/api/country', { cache: 'no-store', signal: controller.signal });
    if (!res.ok) return null;
    const { country } = await res.json();
    return COUNTRY_LANG[country] || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// De eerste taal van de browser die de site kent, anders Engels.
function browserLanguage() {
  for (const tag of navigator.languages || [navigator.language]) {
    const code = String(tag || '').slice(0, 2).toLowerCase();
    if (CODES.includes(code)) return code;
  }
  return 'en';
}

// Volgorde: je eigen keuze (onthouden), dan het land, dan de browser.
async function resolveLanguage() {
  const saved = getPref('lang', null);
  if (CODES.includes(saved)) return saved;
  return (await countryLanguage()) || browserLanguage();
}

// Start de taal van de pagina en koppelt de taalkiezer. Roep dit aan voordat er teksten worden getekend.
export async function initI18n() {
  document.querySelectorAll('[data-lang-select]').forEach((s) => {
    s.innerHTML = LANGS.map((l) => `<option value="${l.code}">${l.name}</option>`).join('');
    s.addEventListener('change', () => setLanguage(s.value));
  });
  await setLanguage(await resolveLanguage(), { save: false });
}
