// Automatisch opslaan in de browser (IndexedDB). Fouten worden genegeerd: zonder opslag werkt de
// editor gewoon, alleen zonder automatisch herstel.
const DB_NAME = 'tesla-wrap';
const STORE = 'drafts';
const KEY = 'current';

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, op) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = op(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export const saveDraft = (draft) => run('readwrite', (s) => s.put(draft, KEY)).catch(() => {});
export const loadDraft = () => run('readonly', (s) => s.get(KEY)).catch(() => null);
export const clearDraft = () => run('readwrite', (s) => s.delete(KEY)).catch(() => {});
