/* =====================================================================
 * ZyroNex · Promo Rules UI — CRUD για promo_rules
 * Admin-only. Κανόνες: var παντού, 44px tap targets, mobile-first.
 * ===================================================================== */
var ZN_PROMOS = (function () {
  'use strict';

  var _rules = [];
  var _editingId = null;

  /* ─── Helpers ─── */
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function _typeLabel(t) {
    if (t === 'percent_over_qty') return '% επί ποσότητας';
    if (t === 'category_combo')   return 'Combo κατηγορίας';
    if (t === 'nth_discount')     return 'Έκπτωση n-οστού';
    if (t === 'expiry')           return 'Λήξη (expiry)';
    if (t === 'dead_stock')       return 'Αδρανές απόθεμα';
    return t || '—';
  }
  function _productName(pid) {
    if (!pid) return '—';
    var p = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).find(function (x) {
      return String(x.id) === String(pid);
    });
    return p ? p.name : ('#' + pid);
  }
  function _condSummary(r) {
    var c = r.conditions || {}, e = r.effect || {};
    var pct = e.percent ? (e.percent + '% έκπτ.') : '';
    if (r.type === 'percent_over_qty') return _productName(c.product_id) + ', ' + (c.min_qty||'?') + '+ τεμ. → ' + pct;
    if (r.type === 'category_combo')   return '«' + (c.category||'') + '» ' + (c.min_qty||'?') + '+ τεμ. → ' + pct;
    if (r.type === 'nth_discount') {
      var t = c.product_id ? _productName(c.product_id) : ('«' + (c.category||'') + '»');
      return t + ' · κάθε ' + (c.n||'?') + 'ο τεμ. → ' + pct;
    }
    if (r.type === 'expiry') {
      var scopeLabel = c.scope === 'all' ? 'Όλα' : (c.scope === 'product' ? 'Προϊόντα' : 'Κατηγορίες');
      return scopeLabel + ' · ≤' + (c.days_before||'?') + ' ημ. λήξης → ' + pct;
    }
    if (r.type === 'dead_stock') {
      var scopeLabel2 = c.scope === 'all' ? 'Όλα' : (c.scope === 'product' ? 'Προϊόντα' : 'Κατηγορίες');
      return scopeLabel2 + ' · ≥' + (c.days_no_sale||'?') + ' ημ. χωρίς πώληση → ' + pct;
    }
    return '';
  }
  function _cats() {
    var seen = {}, out = [];
    (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).forEach(function (p) {
      if (p.category && !seen[p.category]) { seen[p.category] = 1; out.push(p.category); }
    });
    return out.sort();
  }
  var _INP = 'width:100%;font-size:16px;min-height:44px;padding:0 12px;'
    + 'border:1px solid var(--border);border-radius:10px;'
    + 'background:var(--bg-1);color:var(--text-0);'
    + '-webkit-appearance:none;box-sizing:border-box';
  function _lbl(t) { return '<label class="fw-700 text-sm" style="display:block;margin-bottom:6px">' + t + '</label>'; }
  function _row(h) { return '<div style="margin-bottom:14px">' + h + '</div>'; }

  /* Generates the ids-field HTML based on current scope.
     scope='all'      → nothing (no ids needed)
     scope='product'  → free text (product IDs)
     scope='category' → checkbox list from PRODUCTS cache */
  function _idsFieldHtml(scope, selectedIds) {
    selectedIds = selectedIds || [];
    if (scope === 'all') { return ''; }
    if (scope === 'product') {
      return _row(_lbl('IDs προϊόντων (comma-separated)')
        + '<input id="znpf-ids" type="text" value="' + _esc(selectedIds.join(', ')) + '" '
        + 'placeholder="π.χ. 42,55" style="' + _INP + '">');
    }
    // scope === 'category' — checkbox list από PRODUCTS cache
    var cats = _cats();
    if (!cats.length) {
      return _row('<p style="color:var(--text-2);font-size:13px;margin:0">'
        + 'Δεν βρέθηκαν κατηγορίες στο απόθεμα.</p>');
    }
    var items = cats.map(function (c) {
      var chk = selectedIds.indexOf(c) >= 0 ? ' checked' : '';
      return '<label style="display:flex;align-items:center;gap:10px;min-height:44px;cursor:pointer;'
        + 'padding:0 12px;border-bottom:1px solid var(--border)">'
        + '<input type="checkbox" class="znpf-cat-cb" value="' + _esc(c) + '"' + chk
        + ' style="width:20px;height:20px;flex-shrink:0;cursor:pointer">'
        + '<span style="font-size:14px;word-break:break-word">' + _esc(c) + '</span></label>';
    }).join('');
    return _row(_lbl('Κατηγορίες (επίλεξε μία ή περισσότερες)')
      + '<div style="border:1px solid var(--border);border-radius:10px;'
      + 'max-height:220px;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--bg-1)">'
      + items + '</div>');
  }

  /* Reads the selected ids based on current scope value. */
  function _readIds(scope) {
    var out = [];
    if (scope === 'all') {
      toast('[DBG] scope=all → ids=[]', 'info');
      return out;
    }
    if (scope === 'category') {
      var allCbs   = document.querySelectorAll('input.znpf-cat-cb');
      var checkedCbs = document.querySelectorAll('input.znpf-cat-cb:checked');
      toast('[DBG] cat-cb total:' + allCbs.length + ' checked:' + checkedCbs.length, 'info');
      for (var i = 0; i < checkedCbs.length; i++) { out.push(checkedCbs[i].value); }
      return out;
    }
    var raw = ((document.getElementById('znpf-ids') || {}).value || '');
    out = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    toast('[DBG] product ids raw:"' + raw + '" parsed:' + out.length, 'info');
    return out;
  }
  function _fetchRules() {
    var shopId = typeof SHOP_ID !== 'undefined' ? SHOP_ID : null;
    return sbAuth.from('promo_rules').select('*')
      .eq('shop_id', shopId)
      .order('priority', { ascending: true })
      .then(function (res) {
        if (res.error) { console.error('[ZN_PROMOS._fetchRules] error:', res.error); }
        _rules = res.error ? [] : (res.data || []);
        return _rules;
      });
  }

  /* ─── Main page render ─── */
  function render() {
    var content = document.getElementById('content');
    if (!content) { return; }
    content.innerHTML =
      '<div class="page-head">'
      + '<div><div class="page-title">🎁 Σύνθετες Προσφορές</div>'
      + '<div class="page-sub">Κανόνες εκπτώσεων — εφαρμόζονται αυτόματα στο POS</div></div>'
      + '<button class="btn btn-primary" style="min-height:44px" onclick="ZN_PROMOS.openModal(null)">'
      + '<i data-lucide="plus" size="18"></i> Νέα Προσφορά</button></div>'
      + (typeof znGuideBox === 'function' ? znGuideBox('promos') : '')
      + '<div id="znpr-list"><div class="muted" style="text-align:center;padding:40px">Φόρτωση…</div></div>';
    if (typeof lucide !== 'undefined') { try { lucide.createIcons({ el: content }); } catch (_) {} }
    _fetchRules().then(function () { _renderList(); });
  }

  function _renderList() {
    var el = document.getElementById('znpr-list');
    if (!el) { return; }
    if (!_rules.length) {
      el.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:var(--text-2)">'
        + '🎁 Δεν υπάρχουν κανόνες. Πάτα «Νέα Προσφορά» για να ξεκινήσεις.</div>';
      return;
    }
    el.innerHTML = _rules.map(function (r) {
      var dateRange = (r.valid_from || r.valid_to)
        ? ('<div class="text-xs muted mt-1">📅 '
           + (r.valid_from ? r.valid_from.slice(0,10) : '∞') + ' → '
           + (r.valid_to   ? r.valid_to.slice(0,10)   : '∞') + '</div>')
        : '';
      return '<div class="card" style="margin-bottom:12px">'
        + '<div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">'
        + '<div style="flex:1;min-width:0">'
        + '<div style="font-weight:700;font-size:15px;word-break:break-word">' + _esc(r.name) + '</div>'
        + '<div class="text-xs muted mt-1">' + _typeLabel(r.type) + ' · Προτ. ' + (r.priority||100) + '</div>'
        + '<div class="text-xs mt-1" style="color:var(--text-2);word-break:break-word">' + _esc(_condSummary(r)) + '</div>'
        + dateRange
        + '</div>'
        + '<div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;flex-shrink:0">'
        + '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;min-height:44px">'
        + '<input type="checkbox"' + (r.active ? ' checked' : '') + ' style="width:20px;height:20px;cursor:pointer"'
        + ' onchange="ZN_PROMOS.toggleActive(\'' + r.id + '\',this.checked)">'
        + '<span class="text-xs fw-700">' + (r.active ? 'Ενεργό' : 'Ανενεργό') + '</span></label>'
        + '<button class="btn btn-ghost" style="min-height:44px;padding:0 14px;font-size:13px"'
        + ' onclick="ZN_PROMOS.openModal(\'' + r.id + '\')">✏️ Επεξεργασία</button>'
        + '<button style="min-height:44px;padding:0 14px;font-size:13px;cursor:pointer;'
        + 'border:1px solid rgba(231,76,60,0.35);background:rgba(231,76,60,0.1);color:#e74c3c;border-radius:8px"'
        + ' onclick="ZN_PROMOS.deleteRule(\'' + r.id + '\')">🗑 Διαγραφή</button>'
        + '</div></div></div>';
    }).join('');
  }

  /* ─── Type-specific form fields ─── */
  function _typeFields(type, cond) {
    cond = cond || {};
    var prods = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []);
    var cats  = _cats();
    var prodOpts = '<option value="">— Επιλογή προϊόντος —</option>'
      + prods.map(function (p) {
          return '<option value="' + p.id + '"' + (String(cond.product_id) === String(p.id) ? ' selected' : '') + '>' + _esc(p.name) + '</option>';
        }).join('');
    var catOpts = '<option value="">— Επιλογή κατηγορίας —</option>'
      + cats.map(function (c) {
          return '<option value="' + _esc(c) + '"' + (cond.category === c ? ' selected' : '') + '>' + _esc(c) + '</option>';
        }).join('');
    if (type === 'percent_over_qty') {
      return _row(_lbl('Προϊόν') + '<select id="znpf-product" style="' + _INP + '">' + prodOpts + '</select>')
           + _row(_lbl('Ελάχιστη ποσότητα') + '<input id="znpf-minqty" type="number" min="1" value="' + (cond.min_qty||'') + '" placeholder="π.χ. 3" style="' + _INP + '">');
    }
    if (type === 'category_combo') {
      return _row(_lbl('Κατηγορία') + '<select id="znpf-category" style="' + _INP + '">' + catOpts + '</select>')
           + _row(_lbl('Ελάχιστη ποσότητα') + '<input id="znpf-minqty" type="number" min="1" value="' + (cond.min_qty||'') + '" placeholder="π.χ. 3" style="' + _INP + '">');
    }
    if (type === 'nth_discount') {
      return _row(_lbl('Προϊόν (ή κενό για κατηγορία)') + '<select id="znpf-product" style="' + _INP + '">' + prodOpts + '</select>')
           + _row(_lbl('Κατηγορία (αν δεν επιλέξεις προϊόν)') + '<select id="znpf-category" style="' + _INP + '">' + catOpts + '</select>')
           + _row(_lbl('N — έκπτωση κάθε N-οστού τεμαχίου') + '<input id="znpf-n" type="number" min="2" value="' + (cond.n||'') + '" placeholder="π.χ. 3" style="' + _INP + '">');
    }
    var curScope = cond.scope || 'all';
    var scopeOpts = ['all','product','category'].map(function (s) {
      var lbl = s === 'all' ? 'Όλα τα προϊόντα' : (s === 'product' ? 'Συγκεκριμένα προϊόντα' : 'Κατηγορίες');
      return '<option value="' + s + '"' + (curScope === s ? ' selected' : '') + '>' + lbl + '</option>';
    }).join('');
    if (type === 'expiry') {
      return _row(_lbl('Εύρος') + '<select id="znpf-scope" onchange="ZN_PROMOS._onScopeChange()" style="' + _INP + '">' + scopeOpts + '</select>')
           + '<div id="znpf-ids-wrap">' + _idsFieldHtml(curScope, cond.ids||[]) + '</div>'
           + _row(_lbl('Ημέρες πριν τη λήξη') + '<input id="znpf-daysbefore" type="number" min="1" value="' + (cond.days_before||'') + '" placeholder="π.χ. 7" style="' + _INP + '">');
    }
    if (type === 'dead_stock') {
      return _row(_lbl('Εύρος') + '<select id="znpf-scope" onchange="ZN_PROMOS._onScopeChange()" style="' + _INP + '">' + scopeOpts + '</select>')
           + '<div id="znpf-ids-wrap">' + _idsFieldHtml(curScope, cond.ids||[]) + '</div>'
           + _row(_lbl('Ημέρες χωρίς πώληση') + '<input id="znpf-daysnonsale" type="number" min="1" value="' + (cond.days_no_sale||'') + '" placeholder="π.χ. 30" style="' + _INP + '">');
    }
    return '';
  }

  /* ─── Open modal (create or edit) ─── */
  function openModal(id) {
    _editingId = id || null;
    var r = {};
    if (id) { r = _rules.find(function (x) { return String(x.id) === String(id); }) || {}; }
    var cond = r.conditions || {}, eff = r.effect || {};
    var curType = r.type || 'percent_over_qty';
    var typeOpts = ['percent_over_qty','category_combo','nth_discount','expiry','dead_stock'].map(function (t) {
      return '<option value="' + t + '"' + (curType === t ? ' selected' : '') + '>' + _typeLabel(t) + '</option>';
    }).join('');

    var html = '<div style="background:var(--bg-0);border-radius:18px 18px 0 0;padding:20px;width:100%;'
      + 'max-width:640px;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">'
      + '<div class="fw-700" style="font-size:17px">' + (id ? '✏️ Επεξεργασία Προσφοράς' : '🎁 Νέα Προσφορά') + '</div>'
      + '<button onclick="ZN_PROMOS.closeModal()" aria-label="Κλείσιμο"'
      + ' style="background:none;border:none;cursor:pointer;font-size:24px;min-height:44px;min-width:44px;color:var(--text-2);line-height:1">×</button>'
      + '</div>'
      + _row(_lbl('Όνομα Κανόνα') + '<input id="znpf-name" type="text" value="' + _esc(r.name||'') + '" placeholder="π.χ. 3 τεμάχια −20%" style="' + _INP + '">')
      + _row(_lbl('Τύπος') + '<select id="znpf-type" onchange="ZN_PROMOS._onTypeChange()" style="' + _INP + '">' + typeOpts + '</select>')
      + '<div id="znpf-fields" style="margin-bottom:2px">' + _typeFields(curType, cond) + '</div>'
      + _row(_lbl('Έκπτωση %') + '<input id="znpf-percent" type="number" min="0" max="100" step="0.5" value="' + (eff.percent||'') + '" placeholder="π.χ. 20" style="' + _INP + '">')
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
      + '<div style="flex:1;min-width:130px">' + _lbl('Προτεραιότητα') + '<input id="znpf-priority" type="number" min="1" value="' + (r.priority||100) + '" style="' + _INP + '"></div>'
      + '<div style="flex:1;min-width:130px;display:flex;align-items:center;gap:10px;padding-top:22px">'
      + '<input id="znpf-active" type="checkbox"' + (r.active !== false ? ' checked' : '') + ' style="width:22px;height:22px;cursor:pointer">'
      + '<label for="znpf-active" class="fw-700 text-sm" style="cursor:pointer">Ενεργό</label>'
      + '</div></div>'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">'
      + '<div style="flex:1;min-width:130px">' + _lbl('Ισχύει από (προαιρ.)') + '<input id="znpf-from" type="date" value="' + (r.valid_from ? r.valid_from.slice(0,10) : '') + '" style="' + _INP + '"></div>'
      + '<div style="flex:1;min-width:130px">' + _lbl('Ισχύει έως (προαιρ.)') + '<input id="znpf-to" type="date" value="' + (r.valid_to ? r.valid_to.slice(0,10) : '') + '" style="' + _INP + '"></div>'
      + '</div>'
      + '<button class="btn btn-primary" style="width:100%;min-height:44px;font-size:15px" onclick="ZN_PROMOS.save()">💾 Αποθήκευση</button>'
      + '</div>';

    var overlay = document.createElement('div');
    overlay.id = 'znpr-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9000;display:flex;align-items:flex-end;justify-content:center';
    overlay.onclick = function (e) { if (e.target === overlay) { closeModal(); } };
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
    setTimeout(function () { var n = document.getElementById('znpf-name'); if (n) n.focus(); }, 80);
  }

  function _onTypeChange() {
    var t = (document.getElementById('znpf-type') || {}).value;
    var el = document.getElementById('znpf-fields');
    if (el && t) { el.innerHTML = _typeFields(t, {}); }
  }

  function _onScopeChange() {
    var scope = (document.getElementById('znpf-scope') || {}).value || 'all';
    var el = document.getElementById('znpf-ids-wrap');
    if (el) { el.innerHTML = _idsFieldHtml(scope, []); }
  }

  function closeModal() {
    var el = document.getElementById('znpr-modal');
    if (el) { el.remove(); }
    _editingId = null;
  }

  /* ─── Save (insert or update) — με πλήρη instrumentation ─── */
  function save() {
    /* ΒΗΜΑ 0: επιβεβαίωση ότι η save καλείται */
    toast('▶ save ξεκίνησε', 'info');

    var name   = ((document.getElementById('znpf-name')     || {}).value || '').trim();
    var type   = (document.getElementById('znpf-type')      || {}).value || '';
    var pct    = parseFloat((document.getElementById('znpf-percent')  || {}).value) || 0;
    var prio   = parseInt((document.getElementById('znpf-priority')   || {}).value) || 100;
    var activeEl = document.getElementById('znpf-active');
    var active = activeEl ? !!activeEl.checked : true;
    var vFrom  = (document.getElementById('znpf-from') || {}).value || null;
    var vTo    = (document.getElementById('znpf-to')   || {}).value || null;

    /* ΒΗΜΑ 1: τιμές πεδίων */
    toast('[DBG] name:"' + name + '" type:"' + type + '" pct:' + pct, 'info');

    if (!name) { toast('✋ BLOCK: κενό όνομα', 'danger'); return; }
    if (!type) { toast('✋ BLOCK: κενός τύπος', 'danger'); return; }
    if (!pct)  { toast('✋ BLOCK: pct=0 (βάλε έκπτωση %)', 'danger'); return; }

    /* ΒΗΜΑ 2: conditions branch */
    toast('[DBG] → branch type=' + type, 'info');

    var conditions = null;
    if (type === 'percent_over_qty') {
      var pid  = (document.getElementById('znpf-product') || {}).value || '';
      var minq = parseInt((document.getElementById('znpf-minqty') || {}).value) || 0;
      toast('[DBG] poq pid:"' + pid + '" minq:' + minq, 'info');
      if (!pid)  { toast('✋ BLOCK: επίλεξε προϊόν', 'danger'); return; }
      if (!minq) { toast('✋ BLOCK: βάλε ποσότητα', 'danger'); return; }
      conditions = { product_id: pid, min_qty: minq };
    } else if (type === 'category_combo') {
      var cat   = (document.getElementById('znpf-category') || {}).value || '';
      var minq2 = parseInt((document.getElementById('znpf-minqty') || {}).value) || 0;
      toast('[DBG] combo cat:"' + cat + '" minq:' + minq2, 'info');
      if (!cat)   { toast('✋ BLOCK: επίλεξε κατηγορία', 'danger'); return; }
      if (!minq2) { toast('✋ BLOCK: βάλε ποσότητα', 'danger'); return; }
      conditions = { category: cat, min_qty: minq2 };
    } else if (type === 'nth_discount') {
      var pid2 = (document.getElementById('znpf-product')  || {}).value || '';
      var cat2 = (document.getElementById('znpf-category') || {}).value || '';
      var n    = parseInt((document.getElementById('znpf-n') || {}).value) || 0;
      toast('[DBG] nth pid2:"' + pid2 + '" cat2:"' + cat2 + '" n:' + n, 'info');
      if (!pid2 && !cat2) { toast('✋ BLOCK: επίλεξε προϊόν ή κατηγορία', 'danger'); return; }
      if (!n || n < 2)    { toast('✋ BLOCK: N πρέπει ≥ 2', 'danger'); return; }
      conditions = pid2 ? { product_id: pid2, n: n } : { category: cat2, n: n };
    } else if (type === 'expiry') {
      var eScope = (document.getElementById('znpf-scope') || {}).value || 'all';
      var eIds   = _readIds(eScope);
      var eDB    = parseInt((document.getElementById('znpf-daysbefore') || {}).value) || 0;
      toast('[DBG] expiry scope:' + eScope + ' ids:' + JSON.stringify(eIds) + ' days:' + eDB, 'info');
      if (!eDB)  { toast('✋ BLOCK: βάλε ημέρες λήξης', 'danger'); return; }
      if (eScope !== 'all' && !eIds.length) { toast('✋ BLOCK: επίλεξε στοιχεία', 'danger'); return; }
      conditions = { scope: eScope, ids: eIds, days_before: eDB };
    } else if (type === 'dead_stock') {
      var dScope = (document.getElementById('znpf-scope') || {}).value || 'all';
      var dIds   = _readIds(dScope);
      var dDNS   = parseInt((document.getElementById('znpf-daysnonsale') || {}).value) || 0;
      toast('[DBG] dead_stock scope:' + dScope + ' ids:' + JSON.stringify(dIds) + ' days:' + dDNS, 'info');
      if (!dDNS) { toast('✋ BLOCK: βάλε ημέρες αδράνειας', 'danger'); return; }
      if (dScope !== 'all' && !dIds.length) { toast('✋ BLOCK: επίλεξε στοιχεία', 'danger'); return; }
      conditions = { scope: dScope, ids: dIds, days_no_sale: dDNS };
    }

    if (conditions === null) {
      toast('✋ BLOCK: άγνωστος τύπος "' + type + '"', 'danger');
      return;
    }

    /* ΒΗΜΑ 3: payload */
    var shopId = typeof SHOP_ID !== 'undefined' ? SHOP_ID : null;
    toast('[DBG] shopId:' + shopId + ' editingId:' + _editingId, 'info');

    var payload = {
      name: name, type: type, conditions: conditions,
      effect: { percent: pct }, priority: prio, active: active,
      valid_from: vFrom || null, valid_to: vTo || null
    };

    var op;
    if (_editingId) {
      op = sbAuth.from('promo_rules').update(payload)
        .eq('id', _editingId).eq('shop_id', shopId);
    } else {
      payload.shop_id = shopId;
      op = sbAuth.from('promo_rules').insert(payload);
    }

    /* ΒΗΜΑ 4: αποστολή */
    toast('[DBG] καλώ Supabase…', 'info');

    op.then(function (res) {
      if (res.error) {
        console.error('[ZN_PROMOS.save] Supabase error:', res.error);
        toast('❌ Supabase error: ' + (res.error.message || res.error.code || JSON.stringify(res.error)), 'danger');
        return;
      }
      toast(_editingId ? '✅ Αποθηκεύτηκε' : '✅ Δημιουργήθηκε', 'success');
      closeModal();
      if (typeof ZN_PROMO !== 'undefined') { ZN_PROMO.loadRules().catch(function () {}); }
      _fetchRules().then(function () { _renderList(); });
    }).catch(function (err) {
      console.error('[ZN_PROMOS.save] exception:', err);
      toast('❌ Exception: ' + (err && err.message ? err.message : String(err)), 'danger');
    });
  }

  /* ─── Toggle active ─── */
  function toggleActive(id, active) {
    var shopId = typeof SHOP_ID !== 'undefined' ? SHOP_ID : null;
    sbAuth.from('promo_rules').update({ active: active })
      .eq('id', id).eq('shop_id', shopId)
      .then(function (res) {
        if (res.error) {
          console.error('[ZN_PROMOS.toggleActive] error:', res.error);
          if (typeof toast === 'function') toast('Σφάλμα: ' + (res.error.message || res.error.code), 'danger');
          return;
        }
        if (typeof ZN_PROMO !== 'undefined') { ZN_PROMO.loadRules().catch(function () {}); }
        _fetchRules().then(function () { _renderList(); });
      }).catch(function (err) {
        console.error('[ZN_PROMOS.toggleActive] exception:', err);
        if (typeof toast === 'function') toast('Εξαίρεση toggle: ' + (err && err.message ? err.message : String(err)), 'danger');
      });
  }

  /* ─── Delete with confirmation ─── */
  function deleteRule(id) {
    var r = _rules.find(function (x) { return String(x.id) === String(id); });
    if (!confirm('Διαγραφή κανόνα «' + (r ? r.name : id) + '»;\nΔεν μπορεί να αναιρεθεί.')) { return; }
    var shopId = typeof SHOP_ID !== 'undefined' ? SHOP_ID : null;
    sbAuth.from('promo_rules').delete()
      .eq('id', id).eq('shop_id', shopId)
      .then(function (res) {
        if (res.error) {
          console.error('[ZN_PROMOS.deleteRule] error:', res.error);
          if (typeof toast === 'function') toast('Σφάλμα διαγραφής: ' + (res.error.message || res.error.code), 'danger');
          return;
        }
        if (typeof toast === 'function') toast('Διαγράφηκε', 'success');
        if (typeof ZN_PROMO !== 'undefined') { ZN_PROMO.loadRules().catch(function () {}); }
        _fetchRules().then(function () { _renderList(); });
      }).catch(function (err) {
        console.error('[ZN_PROMOS.deleteRule] exception:', err);
        if (typeof toast === 'function') toast('Εξαίρεση διαγραφής: ' + (err && err.message ? err.message : String(err)), 'danger');
      });
  }

  return {
    render: render,
    openModal: openModal,
    closeModal: closeModal,
    save: save,
    toggleActive: toggleActive,
    deleteRule: deleteRule,
    _onTypeChange: _onTypeChange,
    _onScopeChange: _onScopeChange
  };
})();
