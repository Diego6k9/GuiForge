/**
 * Keeps the loaded pack file in IndexedDB so it survives a reload. The pack itself stays on this
 * computer; nothing is uploaded anywhere. Every call fails quietly when storage is blocked.
 */
const DB_NAME = 'guiforge-assets';
const STORE = 'packs';
const KEY = 'current';

interface StoredPack {
  name: string;
  file: Blob;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = action(tx.objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

export async function savePack(pack: StoredPack): Promise<void> {
  try {
    await run('readwrite', (store) => store.put(pack, KEY));
  } catch {
    // Storage blocked: the pack works for this session only.
  }
}

export async function loadPack(): Promise<StoredPack | null> {
  try {
    const stored = await run<StoredPack | undefined>('readonly', (store) => store.get(KEY));
    return stored ?? null;
  } catch {
    return null;
  }
}

export async function clearPack(): Promise<void> {
  try {
    await run('readwrite', (store) => store.delete(KEY));
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}
