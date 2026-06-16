/* =====================================================================
 * ZyroNex · Blind Inventory Audit (Vanilla JS)
 * Τυφλή απογραφή: scan barcode + εισαγωγή ποσότητας — ΠΟΤΕ δεν δείχνει
 * το θεωρητικό απόθεμα. IndexedDB buffer (κακό WiFi στην αποθήκη) →
 * batch UPSERT στη Supabase. Multi-device shelf-lock μέσω Realtime Presence.
 *
 * Server side: create_audit_snapshot / record_audit_count / reconcile_audit /
 * commit_audit (zyronex_advanced.sql).
 *
 * Κανόνες: var, sbAuth, mobile-first (44px), iOS-safe. Καμία αισθητική.
 * ===================================================================== */
var ZN_AUDIT = (function () {
  'use strict';

  var DB_NAME = 'zn_audit';
  var STORE   = 'pending_counts';
  var _db = null;
  var _auditId = null;
  var _deviceId = 'dev-' + Math.random().toString(36).slice(2, 8);
  var _presence = null;          // Supabase Realtime channel
  var _lockedProducts = {};      // productId → deviceId (από presence)

  /* ---------- IndexedDB ---------- */
  function _openDb() {
    return new Promise(function (resolve, reject) {
      if (_db) { resolve(_db); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'key' });
        }
      };
      req.onsuccess = function (e) { _db = e.target.result; resolve(_db); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function _bufferPut(productId, qty) {
    return _openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put({
          key: _auditId + ':' + productId,
          auditId: _auditId, productId: productId, qty: qty,
          device: _deviceId, ts: Date.now()
        });
        tx.oncomplete = resolve;
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function _bufferAll() {
    return _openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var out = [];
        var tx = db.transaction(STORE, 'readonly');
        var cur = tx.objectStore(STORE).openCursor();
        cur.onsuccess = function (e) {
          var c = e.target.result;
          if (c) { if (c.value.auditId === _auditId) { out.push(c.value); } c.continue(); }
          else { resolve(out); }
        };
        cur.onerror = function () { reject(cur.error); };
      });
    });
  }

  function _bufferClear(keys) {
    return _openDb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readwrite');
        var st = tx.objectStore(STORE);
        keys.forEach(function (k) { st.delete(k); });
        tx.oncomplete = resolve;
      });
    });
  }

  /* ---------- Lifecycle ---------- */
  function start() {
    if (typeof can === 'function' && !can('inventory')) {
      toast('Δεν έχεις δικαίωμα απογραφής', 'danger'); return Promise.resolve();
    }
    return sbAuth.rpc('create_audit_snapshot', {}).then(function (res) {
      if (res.error) { throw res.error; }
      _auditId = res.data;
      _joinPresence();
      toast('Απογραφή ξεκίνησε (τυφλή). Σκάναρε προϊόντα.', 'success');
      render();
      return _auditId;
    }).catch(function (e) { toast('Σφάλμα έναρξης: ' + (e.message || e), 'danger'); });
  }

  /* Καταγραφή ενός count — buffer τοπικά, sync στο background. */
  function recordCount(productId, qty) {
    if (!_auditId) { toast('Δεν υπάρχει ενεργή απογραφή', 'danger'); return; }
    if (_lockedProducts[productId] && _lockedProducts[productId] !== _deviceId) {
      toast('Άλλη συσκευή μετράει αυτό το προϊόν', 'info'); return;
    }
    _announceLock(productId);
    _bufferPut(productId, Number(qty) || 0).then(function () {
      toast('Καταγράφηκε', 'success');
      sync(); // best-effort· αν δεν υπάρχει δίκτυο, μένει στο buffer
    });
  }

  /* Batch UPSERT των buffered counts στη Supabase. */
  function sync() {
    if (!_auditId) { return Promise.resolve(); }
    return _bufferAll().then(function (rows) {
      if (!rows.length) { return; }
      var chain = Promise.resolve();
      var done = [];
      rows.forEach(function (r) {
        chain = chain.then(function () {
          return sbAuth.rpc('record_audit_count', {
            p_audit: r.auditId, p_product_id: r.productId,
            p_counted: r.qty, p_device: r.device
          }).then(function (res) {
            if (!res.error) { done.push(r.key); }
          });
        });
      });
      return chain.then(function () { if (done.length) { return _bufferClear(done); } });
    });
  }

  function reconcile(threshold) {
    return sbAuth.rpc('reconcile_audit', {
      p_audit: _auditId, p_recount_threshold: Number(threshold) || 50
    }).then(function (res) {
      if (res.error) { throw res.error; }
      return res.data || [];
    });
  }

  function commit() {
    if (typeof can === 'function' && !can('inventory')) {
      toast('Μόνο manager κάνει commit', 'danger'); return;
    }
    return sbAuth.rpc('commit_audit', { p_audit: _auditId }).then(function (res) {
      if (res.error) { throw res.error; }
      toast('Απογραφή οριστικοποιήθηκε', 'success');
      _leavePresence();
      return res.data;
    }).catch(function (e) { toast('Σφάλμα commit: ' + (e.message || e), 'danger'); });
  }

  /* ---------- Realtime Presence (shelf-lock) ---------- */
  function _joinPresence() {
    if (typeof sbAuth.channel !== 'function') { return; }
    _presence = sbAuth.channel('audit:' + _auditId, { config: { presence: { key: _deviceId } } });
    _presence
      .on('broadcast', { event: 'lock' }, function (p) {
        if (p && p.payload) { _lockedProducts[p.payload.productId] = p.payload.device; }
      })
      .subscribe();
  }
  function _announceLock(productId) {
    _lockedProducts[productId] = _deviceId;
    if (_presence) {
      _presence.send({ type: 'broadcast', event: 'lock',
        payload: { productId: productId, device: _deviceId } });
    }
  }
  function _leavePresence() {
    if (_presence && typeof _presence.unsubscribe === 'function') { _presence.unsubscribe(); }
    _presence = null;
  }

  /* ---------- Minimal blind UI (καμία αισθητική) ---------- */
  function render() {
    var content = document.getElementById('content');
    if (!content) { return; }
    content.innerHTML =
      '<div class="page-head"><h2>📦 Τυφλή Απογραφή</h2>' +
      '<p class="muted">Σκάναρε barcode και βάλε ποσότητα. Δεν φαίνεται το αναμενόμενο.</p></div>' +
      '<div class="card">' +
      '<input id="znAuBarcode" inputmode="text" placeholder="Barcode" ' +
      'style="font-size:16px;min-height:44px;width:100%;-webkit-appearance:none">' +
      '<input id="znAuQty" inputmode="numeric" placeholder="Ποσότητα" ' +
      'style="font-size:16px;min-height:44px;width:100%;margin-top:8px">' +
      '<button class="btn" style="min-height:44px;margin-top:8px" onclick="ZN_AUDIT._submit()">Καταγραφή</button>' +
      '</div>' +
      '<div class="card"><button class="btn" style="min-height:44px" onclick="ZN_AUDIT._finish()">Ολοκλήρωση & Συμφιλίωση</button></div>';
  }

  function _submit() {
    var bc = (document.getElementById('znAuBarcode') || {}).value || '';
    var qty = (document.getElementById('znAuQty') || {}).value || '';
    var p = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).find(function (x) {
      return String(x.barcode) === String(bc).trim();
    });
    if (!p) { toast('Άγνωστο barcode', 'danger'); return; }
    recordCount(p.id, qty);
    document.getElementById('znAuBarcode').value = '';
    document.getElementById('znAuQty').value = '';
    document.getElementById('znAuBarcode').focus();
  }

  function _finish() {
    sync().then(function () { return reconcile(50); }).then(function (rows) {
      var v = (rows || []).filter(function (r) { return Number(r.variance) !== 0; });
      toast('Συμφιλίωση: ' + v.length + ' αποκλίσεις', v.length ? 'info' : 'success');
    }).catch(function (e) { toast('Σφάλμα: ' + (e.message || e), 'danger'); });
  }

  return {
    start: start, recordCount: recordCount, sync: sync,
    reconcile: reconcile, commit: commit, render: render,
    _submit: _submit, _finish: _finish
  };
})();
