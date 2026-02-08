function setupStorage(Lang) {
  const memoryCache = new Map();

  const DB_NAME = 'MEL_Storage';
  const DB_VERSION = 1;
  const STORE_NAME = 'mel_data';

  let dbInstance = null;
  let dbInitialized = false;

  function initDB() {
    if (dbInstance || dbInitialized) return;

    dbInitialized = true;

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.warn('[MEL Storage] IndexedDB failed, using memory-only mode');
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;

      loadExistingData();
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
  }

  function loadExistingData() {
    if (!dbInstance) return;

    try {
      const transaction = dbInstance.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = (event) => {
        const items = event.target.result;
        items.forEach((item) => {
          try {
            memoryCache.set(item.key, JSON.parse(item.value));
          } catch (e) {
            console.warn('[MEL Storage] Failed to parse item:', item.key);
          }
        });
      };
    } catch (e) {
      console.warn('[MEL Storage] Failed to load existing data');
    }
  }

  function persistToDB(key, value) {
    if (!dbInstance) return;

    try {
      const transaction = dbInstance.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      let serialized;
      try {
        serialized = JSON.stringify(value);
      } catch (e) {
        console.warn('[MEL Storage] Failed to serialize:', key);
        return;
      }

      store.put({
        key: String(key),
        value: serialized,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('[MEL Storage] Failed to persist:', key);
    }
  }

  function removeFromDB(key) {
    if (!dbInstance) return;

    try {
      const transaction = dbInstance.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(String(key));
    } catch (e) {
      console.warn('[MEL Storage] Failed to remove:', key);
    }
  }

  function clearDB() {
    if (!dbInstance) return;

    try {
      const transaction = dbInstance.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
    } catch (e) {
      console.warn('[MEL Storage] Failed to clear DB');
    }
  }

  initDB();

  Lang.addHandler('storage', {
    type: 'value',
    value: {
      set: function (key, value) {
        const k = String(key);

        memoryCache.set(k, value);

        persistToDB(k, value);

        return value;
      },

      get: function (key) {
        const k = String(key);

        if (memoryCache.has(k)) {
          return memoryCache.get(k);
        }

        return null;
      },

      remove: function (key) {
        const k = String(key);

        memoryCache.delete(k);
        removeFromDB(k);

        return true;
      },

      clear: function () {
        memoryCache.clear();
        clearDB();

        return true;
      },

      keys: function () {
        return Array.from(memoryCache.keys());
      },

      size: function () {
        return memoryCache.size;
      },

      has: function (key) {
        return memoryCache.has(String(key));
      },

      values: function () {
        return Array.from(memoryCache.values());
      },

      entries: function () {
        const result = [];
        memoryCache.forEach((value, key) => {
          result.push([key, value]);
        });
        return result;
      },
    },
  });

  Lang.addKeyword('storage');
}
