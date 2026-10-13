// Keuzes van de bezoeker (taal, gereedschap, kleur, paneel-opties), onthouden in deze browser.
// Lukt de opslag niet, dan geldt de keuze alleen voor deze pagina.
const KEY = 'tesla-wrap-prefs';
let cache = null;

function load() {
  if (!cache) {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(KEY));
    } catch {
      // Ongeldige of geblokkeerde opslag: we beginnen met lege keuzes.
    }
    cache = saved && typeof saved === 'object' ? saved : {};
  }
  return cache;
}

export function getPref(name, fallback) {
  const value = load()[name];
  return value === undefined ? fallback : value;
}

export function setPref(name, value) {
  load()[name] = value;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Geen opslag beschikbaar: de keuze geldt dan voor deze pagina.
  }
}
