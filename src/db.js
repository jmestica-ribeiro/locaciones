import { openDB } from 'idb';

const DB_NAME = 'ribeiro-obras';
const DB_VERSION = 1;

function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cache')) {
        db.createObjectStore('cache', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function cacheGet(key) {
  const db = await getDB();
  const entry = await db.get('cache', key);
  return entry?.data ?? null;
}

export async function cacheSet(key, data) {
  const db = await getDB();
  await db.put('cache', { key, data, updatedAt: Date.now() });
}

export async function outboxAdd(item) {
  const db = await getDB();
  return db.add('outbox', { ...item, createdAt: Date.now() });
}

export async function outboxGetAll() {
  const db = await getDB();
  return db.getAll('outbox');
}

export async function outboxDelete(id) {
  const db = await getDB();
  return db.delete('outbox', id);
}

export async function outboxCount() {
  const db = await getDB();
  return db.count('outbox');
}
