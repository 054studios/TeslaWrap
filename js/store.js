// Ontwerpen in de browser (IndexedDB). Elk ontwerp heeft een lijstitem (naam, model, miniatuur, datum)
// en de inhoud (lagen en foto's). Fouten worden genegeerd: zonder opslag werkt de editor gewoon,
// alleen zonder automatisch herstel.
const DB_NAME = 'tesla-wrap';
const DB_VERSION = 2;
const LEGACY = 'drafts'; // oude opslag van één ontwerp; alleen nog om het over te zetten
const DESIGNS = 'designs';
const CONTENT = 'content';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of [LEGACY, DESIGNS, CONTENT]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Voert één verzoek uit op één opslag; het resultaat is het antwoord van dat verzoek.
async function run(store, mode, op) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = op(tx.objectStore(store));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// Schrijft in beide opslagen in één transactie, zodat een ontwerp nooit half wordt opgeslagen.
async function write(ops) {
  const db = await open();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction([DESIGNS, CONTENT], 'readwrite');
      ops(tx.objectStore(DESIGNS), tx.objectStore(CONTENT));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// Alle ontwerpen als lijstitems, het laatst bewerkte eerst.
export const listDesigns = () =>
  run(DESIGNS, 'readonly', (s) => s.getAll())
    .then((rows) => (rows || []).sort((a, b) => b.savedAt - a.savedAt))
    .catch(() => []);

export const getContent = (id) => run(CONTENT, 'readonly', (s) => s.get(id)).catch(() => null);

export const putDesign = (meta, content) =>
  write((designs, contents) => {
    designs.put(meta, meta.id);
    contents.put(content, meta.id);
  }).catch(() => {});

export const putMeta = (meta) => run(DESIGNS, 'readwrite', (s) => s.put(meta, meta.id)).catch(() => {});

export const deleteDesign = (id) =>
  write((designs, contents) => {
    designs.delete(id);
    contents.delete(id);
  }).catch(() => {});

// Het oude enkele ontwerp (sleutel 'current') overzetten naar de nieuwe lijst.
export const loadLegacy = () => run(LEGACY, 'readonly', (s) => s.get('current')).catch(() => null);
export const clearLegacy = () => run(LEGACY, 'readwrite', (s) => s.delete('current')).catch(() => {});
