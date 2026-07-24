/**
 * Dense geo cache (IndexedDB, extension origin).
 * ONLY stores successful detections: handle + location (+ optional display name).
 * Never persists misses / empty location / rate-limit failures.
 */
(function (global) {
  'use strict';

  const DB_NAME = 'xcd_geo_v1';
  const STORE = 'loc';
  const DB_VERSION = 1;
  const MAX_ENTRIES = 100000;
  const TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
  const LEGACY_STORAGE_KEY = 'xcd_location_cache_v1';

  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onerror = () => reject(req.error || new Error('IDB open failed'));
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'k' });
          store.createIndex('t', 't', { unique: false });
        }
      };
    });
    return dbPromise;
  }

  function now() {
    return Date.now();
  }

  function normalizeHandle(screenName) {
    if (typeof screenName !== 'string') return '';
    return screenName.trim().replace(/^@+/, '').toLowerCase();
  }

  function isFresh(row) {
    return row && typeof row.t === 'number' && now() - row.t < TTL_MS;
  }

  /** Only complete positive rows are public hits. */
  function toPublic(row) {
    if (!row || !row.l) return null;
    return {
      location: row.l,
      locationAccurate: row.a !== 0,
      name: row.n || '',
      screenName: row.k,
      cachedAt: row.t
    };
  }

  function idbGet(db, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  function idbPut(db, row) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function idbCount(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  }

  function idbDeleteKeys(db, keys) {
    if (!keys.length) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      for (const k of keys) store.delete(k);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function evictIfNeeded(db) {
    const count = await idbCount(db);
    if (count <= MAX_ENTRIES) return;
    const over = count - MAX_ENTRIES + 500;
    const toDelete = [];
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const idx = tx.objectStore(STORE).index('t');
      const req = idx.openCursor();
      req.onsuccess = () => {
        const cursor = req.result;
        if (!cursor || toDelete.length >= over) {
          resolve();
          return;
        }
        toDelete.push(cursor.value.k);
        cursor.continue();
      };
      req.onerror = () => reject(req.error);
    });
    await idbDeleteKeys(db, toDelete);
  }

  async function get(screenName) {
    const k = normalizeHandle(screenName);
    if (!k) return null;
    try {
      const db = await openDb();
      const row = await idbGet(db, k);
      if (!row || !isFresh(row) || !row.l) {
        if (row && !isFresh(row)) {
          try {
            await idbDeleteKeys(db, [k]);
          } catch (_) {
            /* ignore */
          }
        }
        return null;
      }
      return toPublic(row);
    } catch (e) {
      console.warn('[xcd] geo-cache get failed', e);
      return null;
    }
  }

  /**
   * Persist ONLY successful detections with location.
   * @returns {Promise<boolean>} true if stored
   */
  async function put(screenName, data = {}) {
    const k = normalizeHandle(screenName);
    if (!k) return false;

    const locRaw = data.location;
    if (locRaw == null || locRaw === '') return false; // never store empties
    const loc = String(locRaw).trim().toLowerCase();
    if (!loc) return false;

    const displayName =
      typeof data.name === 'string' && data.name.trim()
        ? data.name.trim().slice(0, 80)
        : '';

    const row = {
      k,
      l: loc,
      a: data.locationAccurate === false ? 0 : 1,
      t: now()
    };
    if (displayName) row.n = displayName;

    try {
      const db = await openDb();
      await idbPut(db, row);
      await evictIfNeeded(db);
      return true;
    } catch (e) {
      console.warn('[xcd] geo-cache put failed', e);
      return false;
    }
  }

  async function stats() {
    try {
      const db = await openDb();
      const count = await idbCount(db);
      return { count, max: MAX_ENTRIES, db: DB_NAME };
    } catch (e) {
      return { count: 0, max: MAX_ENTRIES, error: String(e?.message || e) };
    }
  }

  /** Import only positive legacy entries; drop blob after. */
  async function migrateFromChromeStorage() {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return { migrated: 0 };
    }
    let raw;
    try {
      const data = await chrome.storage.local.get(LEGACY_STORAGE_KEY);
      raw = data[LEGACY_STORAGE_KEY];
    } catch {
      return { migrated: 0 };
    }
    if (!raw || typeof raw !== 'object') return { migrated: 0 };

    let migrated = 0;
    const entries = Object.entries(raw);
    try {
      const db = await openDb();
      for (let i = 0; i < entries.length; i += 200) {
        const slice = entries.slice(i, i + 200);
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE, 'readwrite');
          const store = tx.objectStore(STORE);
          for (const [key, entry] of slice) {
            const k = normalizeHandle(key);
            if (!k) continue;
            const val = entry?.value || entry;
            if (!val || typeof val !== 'object') continue;
            const loc =
              val.location != null ? String(val.location).trim().toLowerCase() : '';
            if (!loc) continue; // skip empties / negatives
            const row = {
              k,
              l: loc,
              a: val.locationAccurate === false ? 0 : 1,
              t: typeof val.cachedAt === 'number' ? val.cachedAt : now()
            };
            if (typeof val.name === 'string' && val.name.trim()) {
              row.n = val.name.trim().slice(0, 80);
            }
            store.put(row);
            migrated++;
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
      }
      await evictIfNeeded(db);
    } catch (e) {
      console.warn('[xcd] geo migrate failed', e);
    }

    try {
      await chrome.storage.local.remove(LEGACY_STORAGE_KEY);
    } catch (_) {
      /* ignore */
    }
    return { migrated };
  }

  const api = {
    DB_NAME,
    MAX_ENTRIES,
    TTL_MS,
    LEGACY_STORAGE_KEY,
    get,
    put,
    stats,
    migrateFromChromeStorage
  };

  global.XCD_GEO_IDB = api;
  if (typeof self !== 'undefined') self.XCD_GEO_IDB = api;
})(typeof globalThis !== 'undefined' ? globalThis : self);
