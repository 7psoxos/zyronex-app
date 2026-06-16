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
  var _matchedProduct = null;    // προϊόν που αντιστοιχεί στο τρέχον barcode
  var _recentLog = [];           // τελευταία καταχωρημένα (max 5, για feedback)

  var _INP = 'width:100%;font-size:16px;min-height:44px;padding:0 12px;'
    + 'border:1px solid var(--border);border-radius:10px;'
    + 'background:var(--bg-1);color:var(--text-0);'
    + '-webkit-appearance:none;box-sizing:border-box;outline:none';

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

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
      _recentLog = [];
      _matchedProduct = null;
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

  /* ---------- Barcode scan helpers ---------- */

  /* Αντιστοίχιση barcode → προϊόν (ακριβής, case-sensitive). */
  function _findByBarcode(bc) {
    var prods = typeof PRODUCTS !== 'undefined' ? PRODUCTS : [];
    for (var i = 0; i < prods.length; i++) {
      if (String(prods[i].barcode || '') === bc) { return prods[i]; }
    }
    return null;
  }

  /* Ανανέωση εμφάνισης του recent log (τελευταία 5 καταχωρημένα). */
  function _renderLog() {
    var el = document.getElementById('znAuLog');
    if (!el) { return; }
    if (!_recentLog.length) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.innerHTML = '<div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:6px">Τελευταία καταχωρημένα</div>'
      + _recentLog.slice().reverse().map(function (e) {
          return '<div style="display:flex;justify-content:space-between;align-items:center;'
            + 'padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">'
            + '<span style="word-break:break-word;flex:1;margin-right:8px">' + _esc(e.name) + '</span>'
            + '<span style="font-weight:700;flex-shrink:0;color:var(--accent)">×' + e.qty + '</span>'
            + '</div>';
        }).join('');
  }

  /* Επιλέγεται προϊόν από barcode → δείξε όνομα + εστίασε qty. */
  function _matchBarcode(bc) {
    var p = _findByBarcode(bc);
    var matchEl = document.getElementById('znAuMatch');
    var qtyWrap = document.getElementById('znAuQtyWrap');
    if (p) {
      _matchedProduct = p;
      if (matchEl) {
        matchEl.innerHTML = '<span style="color:var(--accent);font-weight:700">✅ ' + _esc(p.name) + '</span>';
      }
      if (qtyWrap) { qtyWrap.style.display = ''; }
      var qtyEl = document.getElementById('znAuQty');
      if (qtyEl) { setTimeout(function () { qtyEl.focus(); qtyEl.select(); }, 40); }
    } else {
      _matchedProduct = null;
      if (matchEl) { matchEl.innerHTML = ''; }
      if (qtyWrap) { qtyWrap.style.display = 'none'; }
    }
  }

  /* Καθαρισμός μετά από καταγραφή — επαναφορά στο barcode input. */
  function _resetScan() {
    _matchedProduct = null;
    var bcEl   = document.getElementById('znAuBarcode');
    var qtyEl  = document.getElementById('znAuQty');
    var matchEl = document.getElementById('znAuMatch');
    var qtyWrap = document.getElementById('znAuQtyWrap');
    if (bcEl)    { bcEl.value = ''; }
    if (qtyEl)   { qtyEl.value = ''; }
    if (matchEl) { matchEl.innerHTML = ''; }
    if (qtyWrap) { qtyWrap.style.display = 'none'; }
    if (bcEl)    { bcEl.focus(); }
  }

  /* ---------- UI ---------- */
  function render() {
    var content = document.getElementById('content');
    if (!content) { return; }
    var guide = (typeof znGuideBox === 'function') ? znGuideBox('blindaudit') : '';

    if (!_auditId) {
      /* Pre-start: guide box + explicit start button — no auto-start. */
      content.innerHTML =
        '<div class="page-head"><h2>📦 Τυφλή Απογραφή</h2>' +
        '<p class="muted">Η απογραφή ξεκινά μόνο με το κουμπί. Οι πωλήσεις POS συνεχίζουν κανονικά.</p></div>' +
        guide +
        '<div class="card" style="text-align:center;padding:32px 16px">' +
        '<p class="text-xs muted mb-3">Πάτα «Έναρξη» για να παγώσει το απόθεμα και να αρχίσει η τυφλή καταμέτρηση.</p>' +
        '<button class="btn btn-primary" style="min-height:44px;min-width:180px" onclick="ZN_AUDIT.start()">📦 Έναρξη Απογραφής</button>' +
        '</div>';
      return;
    }

    /* Active audit: barcode scan UI. */
    content.innerHTML =
      '<div class="page-head"><h2>📦 Τυφλή Απογραφή</h2>' +
      '<p class="muted">Σκάναρε barcode → βάλε ποσότητα. Δεν φαίνεται το αναμενόμενο.</p></div>' +

      /* ── Βήμα 1: Barcode ── */
      '<div class="card" style="margin-bottom:12px">' +
      '<div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">1. Σκάναρε barcode</div>' +
      '<input id="znAuBarcode" type="text" inputmode="text" autocomplete="off" autocorrect="off" spellcheck="false" ' +
      'placeholder="🔍 Σκάναρε ή γράψε barcode" style="' + _INP + '">' +
      '<button class="btn btn-ghost" style="width:100%;min-height:44px;margin-top:8px;font-size:14px;border:1px solid var(--border)" ' +
      'onclick="if(typeof startScanner===\'function\')startScanner(\'audit\')">📷 Σκάναρε με κάμερα</button>' +
      '<div id="znAuMatch" style="min-height:28px;margin-top:8px;font-size:14px;line-height:1.4;word-break:break-word"></div>' +
      '</div>' +

      /* ── Βήμα 2: Ποσότητα (κρυφό αρχικά) ── */
      '<div id="znAuQtyWrap" class="card" style="margin-bottom:12px;display:none">' +
      '<div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px">2. Πόσα μέτρησες;</div>' +
      '<input id="znAuQty" type="number" inputmode="numeric" min="0" step="1" placeholder="Ποσότητα" style="' + _INP + '">' +
      '<button class="btn btn-primary" style="width:100%;min-height:44px;margin-top:10px;font-size:15px" ' +
      'onclick="ZN_AUDIT._submit()">✅ Καταγραφή</button>' +
      '</div>' +

      /* ── Log τελευταίων ── */
      '<div id="znAuLog" class="card" style="display:none;margin-bottom:12px"></div>' +

      /* ── Ολοκλήρωση ── */
      '<div class="card">' +
      '<button class="btn" style="min-height:44px;width:100%;font-size:14px" onclick="ZN_AUDIT._finish()">🏁 Ολοκλήρωση & Συμφιλίωση</button>' +
      '</div>';

    /* Wire barcode input */
    var bcEl = document.getElementById('znAuBarcode');
    if (bcEl) {
      bcEl.addEventListener('input', function () {
        var bc = this.value.trim();
        /* Ακριβές barcode match → auto-select (ίδια λογική με ZN_PICKER). */
        if (bc) { _matchBarcode(bc); }
        else {
          _matchedProduct = null;
          var m = document.getElementById('znAuMatch');
          var w = document.getElementById('znAuQtyWrap');
          if (m) { m.innerHTML = ''; }
          if (w) { w.style.display = 'none'; }
        }
      });
      bcEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          if (_matchedProduct) {
            /* Ήδη matched — εστίασε qty. */
            var q = document.getElementById('znAuQty');
            if (q) { q.focus(); q.select(); }
          } else {
            /* Δεν βρέθηκε — εμφάνισε error μόνο αν έχει τιμή. */
            var bc2 = this.value.trim();
            if (bc2) { toast('Άγνωστο barcode: ' + bc2, 'danger'); }
          }
        }
        if (e.key === 'Escape') { _resetScan(); }
      });
      setTimeout(function () { if (bcEl) { bcEl.focus(); } }, 80);
    }

    /* Wire qty input */
    var qtyEl = document.getElementById('znAuQty');
    if (qtyEl) {
      qtyEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { _submit(); }
        if (e.key === 'Escape') { _resetScan(); }
      });
    }

    _renderLog();
  }

  function _submit() {
    if (!_matchedProduct) {
      var bc = ((document.getElementById('znAuBarcode') || {}).value || '').trim();
      if (!bc) { toast('Σκάναρε πρώτα barcode', 'danger'); return; }
      toast('Άγνωστο barcode', 'danger'); return;
    }
    var qtyEl = document.getElementById('znAuQty');
    var qty = parseInt((qtyEl || {}).value || '') ;
    if (isNaN(qty) || qty < 0) { toast('Βάλε έγκυρη ποσότητα (≥ 0)', 'danger'); return; }

    /* Αποθήκευσε στο log (όνομα, χωρίς stock — τυφλό). */
    _recentLog.push({ name: _matchedProduct.name, qty: qty });
    if (_recentLog.length > 5) { _recentLog.shift(); }

    recordCount(_matchedProduct.id, qty);
    _resetScan();
    _renderLog();
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
    _submit: _submit, _finish: _finish, _resetScan: _resetScan
  };
})();
