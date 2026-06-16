/* =====================================================================
 * ZyroNex · Offline Sync (IndexedDB + sync-only Service Worker)
 * ⚠️ ΠΡΟΣΟΧΗ: ο SW εδώ είναι ΑΥΣΤΗΡΑ sync-only — ΔΕΝ κάνει caching
 * HTML/JS (δεν ξαναφέρνει το stale-code bug που σβήσαμε). Μόνο
 * background flush της IndexedDB ουράς όταν επανέρχεται το δίκτυο.
 *
 * Αντικαθιστά σταδιακά το localStorage `offlineSaleQueue` με IndexedDB
 * (πιο ανθεκτικό σε μεγάλο όγκο/iOS). Κανόνες: var.
 * ===================================================================== */
var ZN_OFFLINE = (function () {
  'use strict';

  var DB = 'zn_offline';
  var STORE = 'sale_queue';
  var _db = null;

  function _open() {
    return new Promise(function (resolve, reject) {
      if (_db) { resolve(_db); return; }
      var req = indexedDB.open(DB, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror = function () { reject(req.error); };
    });
  }

  /* Βάλε μια πώληση στην ουρά (όταν δεν υπάρχει δίκτυο). */
  function enqueue(sale) {
    return _open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).add({ sale: sale, ts: Date.now() });
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function _all() {
    return _open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var out = [];
        var tx = db.transaction(STORE, 'readonly');
        var cur = tx.objectStore(STORE).openCursor();
        cur.onsuccess = function (e) {
          var c = e.target.result;
          if (c) { out.push({ id: c.key, value: c.value }); c.continue(); }
          else { resolve(out); }
        };
        cur.onerror = function () { reject(cur.error); };
      });
    });
  }

  function _delete(id) {
    return _open().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = resolve;
      });
    });
  }

  /* Flush: στέλνει τις πωλήσεις της ουράς στη Supabase. Βασίζεται στην
     υπάρχουσα _commitOneSale() της εφαρμογής (idempotent loyalty). */
  function flush() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return Promise.resolve(0);
    }
    return _all().then(function (rows) {
      if (!rows.length) { return 0; }
      var chain = Promise.resolve();
      var n = 0;
      rows.forEach(function (r) {
        chain = chain.then(function () {
          var commit = (typeof _commitOneSale === 'function')
            ? _commitOneSale(r.value.sale)
            : Promise.resolve(true);
          return Promise.resolve(commit).then(function (ok) {
            if (ok !== false) { n++; return _delete(r.id); }
          });
        });
      });
      return chain.then(function () { return n; });
    });
  }

  /* Καταχώρηση sync-only SW + flush όταν επανέρχεται το δίκτυο. */
  function init() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', function () { flush(); });
    }
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      // ⚠️ versioned URL ώστε να μην κολλάει stale SW
      navigator.serviceWorker.register('/zn-sync-sw.js?v=1').catch(function () {});
    }
  }

  return { enqueue: enqueue, flush: flush, init: init };
})();
