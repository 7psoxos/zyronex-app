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
    if (t === 'bundle')           return '📦 Πακέτο (Bundle)';
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
    if (r.type === 'bundle') {
      var bItems = c.items || [];
      var effStr = e.percent ? (e.percent + '% έκπτ.') : (e.amount ? ('-' + e.amount + '€') : '');
      return bItems.length + ' είδη πακέτου → ' + effStr;
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
  function _lbl(t) { return '<label class="fw-700 text-sm" style="display:block;margin-bottom:3px">' + t + '</label>'; }
  function _hint(t) { return '<div style="font-size:12px;color:var(--text-2);margin-bottom:5px;line-height:1.4">' + t + '</div>'; }
  function _row(h) { return '<div style="margin-bottom:14px">' + h + '</div>'; }

  /* Trigger button για product picker — αντικαθιστά <select> προϊόντος */
  function _prodPickerBtnHtml(id, attrs) {
    var prods = typeof PRODUCTS !== 'undefined' ? PRODUCTS : [];
    var found = id ? prods.find(function (p) { return String(p.id) === String(id); }) : null;
    var lbl = found ? _esc(found.name) : '🔍 Επέλεξε προϊόν…';
    return '<button type="button" ' + (attrs || '') + ' data-pid="' + _esc(String(id || '')) + '"'
      + ' onclick="ZN_PROMOS._openPicker(this)"'
      + ' style="' + _INP + ';text-align:left;cursor:pointer;word-break:break-word">'
      + lbl + '</button>';
  }

  /* ─── Bundle helpers ─── */
  function _bundleSelHtml(ref, id) {
    var cats = _cats();
    if (ref === 'category') {
      return '<select class="znpf-bsel" style="' + _INP + '">'
        + '<option value="">— Κατηγορία —</option>'
        + cats.map(function (c) {
            return '<option value="' + _esc(c) + '"' + (id === c ? ' selected' : '') + '>' + _esc(c) + '</option>';
          }).join('')
        + '</select>';
    }
    // product → picker trigger button (αντί dropdown)
    return _prodPickerBtnHtml(id, 'class="znpf-bpick"');
  }
  function _bundleRowHtml(ref, id, qty) {
    var refSel = '<select class="znpf-bref" onchange="ZN_PROMOS._onBundleRefChange(this)" style="' + _INP + '">'
      + '<option value="product"' + (ref === 'product' ? ' selected' : '') + '>Προϊόν</option>'
      + '<option value="category"' + (ref === 'category' ? ' selected' : '') + '>Κατηγορία</option>'
      + '</select>';
    return '<div class="znpf-brow" style="background:var(--bg-2);border-radius:10px;padding:12px;margin-bottom:8px">'
      + '<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end">'
      + '<div style="flex:1;min-width:110px">' + _lbl('Τύπος') + refSel + '</div>'
      + '<div class="znpf-bsel-wrap" style="flex:2;min-width:160px">' + _lbl('Επιλογή') + _bundleSelHtml(ref, id) + '</div>'
      + '<div style="flex:0 0 90px">' + _lbl('Ποσ.') + '<input class="znpf-bqty" type="number" min="1" value="' + (qty||1) + '" style="' + _INP + '"></div>'
      + '<button type="button" onclick="ZN_PROMOS._removeBundleRow(this)"'
      + ' style="min-height:44px;min-width:44px;flex-shrink:0;background:rgba(231,76,60,0.1);'
      + 'border:1px solid rgba(231,76,60,0.35);color:#e74c3c;border-radius:8px;cursor:pointer;'
      + 'font-size:18px;padding:0;align-self:flex-end">✕</button>'
      + '</div></div>';
  }
  function _readBundleItems() {
    var rows = document.querySelectorAll('#znpf-bundle-items .znpf-brow');
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var refEl = rows[i].querySelector('.znpf-bref');
      var qtyEl = rows[i].querySelector('.znpf-bqty');
      var ref = refEl ? refEl.value : 'product';
      var id;
      if (ref === 'product') {
        var pickBtn = rows[i].querySelector('.znpf-bpick');
        id = pickBtn ? (pickBtn.dataset.pid || '') : '';
      } else {
        var selEl = rows[i].querySelector('.znpf-bsel');
        id = selEl ? selEl.value : '';
      }
      var qty = qtyEl ? (parseInt(qtyEl.value) || 1) : 1;
      if (id) { out.push({ ref: ref, id: id, qty: qty }); }
    }
    return out;
  }

  /* ─── Scope/ids field ─── */
  function _idsFieldHtml(scope, selectedIds) {
    selectedIds = selectedIds || [];
    if (scope === 'all') { return ''; }
    if (scope === 'product') {
      return _row(_lbl('IDs προϊόντων (comma-separated)')
        + '<input id="znpf-ids" type="text" value="' + _esc(selectedIds.join(', ')) + '" '
        + 'placeholder="π.χ. 42,55" style="' + _INP + '">');
    }
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
  function _readIds(scope) {
    var out = [];
    if (scope === 'all') { return out; }
    if (scope === 'category') {
      var checkedCbs = document.querySelectorAll('input.znpf-cat-cb:checked');
      for (var i = 0; i < checkedCbs.length; i++) { out.push(checkedCbs[i].value); }
      return out;
    }
    var raw = ((document.getElementById('znpf-ids') || {}).value || '');
    out = raw.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    return out;
  }

  function _fetchRules() {
    var shopId = typeof SHOP_ID !== 'undefined' ? SHOP_ID : null;
    return sbAuth.from('promo_rules').select('*')
      .eq('shop_id', shopId)
      .order('priority', { ascending: false })
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
  /* eff: r.effect — χρησιμοποιείται μόνο για bundle (για να φορτώσει τιμή edit) */
  function _typeFields(type, cond, eff) {
    cond = cond || {};
    eff  = eff  || {};
    var prods = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []);
    var cats  = _cats();
    var catOpts = '<option value="">— Επιλογή κατηγορίας —</option>'
      + cats.map(function (c) {
          return '<option value="' + _esc(c) + '"' + (cond.category === c ? ' selected' : '') + '>' + _esc(c) + '</option>';
        }).join('');
    if (type === 'percent_over_qty') {
      return _row(_lbl('Προϊόν') + _prodPickerBtnHtml(cond.product_id, 'id="znpf-product"'))
           + _row(_lbl('Ελάχιστη ποσότητα') + '<input id="znpf-minqty" type="number" min="1" value="' + (cond.min_qty||'') + '" placeholder="π.χ. 3" style="' + _INP + '">');
    }
    if (type === 'category_combo') {
      return _row(_lbl('Κατηγορία') + '<select id="znpf-category" style="' + _INP + '">' + catOpts + '</select>')
           + _row(_lbl('Ελάχιστη ποσότητα') + '<input id="znpf-minqty" type="number" min="1" value="' + (cond.min_qty||'') + '" placeholder="π.χ. 3" style="' + _INP + '">');
    }
    if (type === 'nth_discount') {
      return _row(_lbl('Προϊόν (ή κενό για κατηγορία)') + _prodPickerBtnHtml(cond.product_id, 'id="znpf-product"'))
           + _row(_lbl('Κατηγορία (αν δεν επιλέξεις προϊόν)') + '<select id="znpf-category" style="' + _INP + '">' + catOpts + '</select>')
           + _row(_lbl('N — έκπτωση κάθε N-οστού τεμαχίου') + '<input id="znpf-n" type="number" min="2" value="' + (cond.n||'') + '" placeholder="π.χ. 3" style="' + _INP + '">');
    }
    if (type === 'bundle') {
      var bItems = (cond.items && cond.items.length) ? cond.items
        : [{ref:'product',id:'',qty:1},{ref:'product',id:'',qty:1}];
      var bRows = '';
      for (var bi = 0; bi < bItems.length; bi++) {
        bRows += _bundleRowHtml(bItems[bi].ref || 'product', String(bItems[bi].id || ''), Number(bItems[bi].qty) || 1);
      }
      var bEffType = eff.amount ? 'amount' : 'percent';
      var bEffVal  = eff.amount ? eff.amount : (eff.percent || '');
      var bEffOpts = '<option value="percent"' + (bEffType === 'percent' ? ' selected' : '') + '>Ποσοστό %</option>'
        + '<option value="amount"' + (bEffType === 'amount' ? ' selected' : '') + '>Σταθερό ποσό €</option>';
      var bEffLbl = bEffType === 'amount' ? 'Ποσό € (σταθερό, μία φορά)' : 'Ποσοστό %';
      var bEffPh  = bEffType === 'amount' ? 'π.χ. 5.00' : 'π.χ. 20';
      return _row(_lbl('Είδη πακέτου (ελάχ. 2)') + _hint('Πρέπει να υπάρχουν ΟΛΑ στο καλάθι για να ισχύσει το πακέτο.'))
        + '<div id="znpf-bundle-items" style="margin-bottom:10px">' + bRows + '</div>'
        + '<button type="button" onclick="ZN_PROMOS._addBundleRow()"'
        + ' style="display:flex;align-items:center;justify-content:center;gap:6px;width:100%;'
        + 'min-height:44px;padding:0 16px;background:var(--bg-2);border:1px solid var(--border);'
        + 'border-radius:10px;color:var(--accent);font-size:14px;font-weight:700;cursor:pointer;margin-bottom:14px">'
        + '➕ Προσθήκη είδους</button>'
        + _row(_lbl('Τύπος έκπτωσης') + '<select id="znpf-beff-type" onchange="ZN_PROMOS._onBundleEffChange()" style="' + _INP + '">' + bEffOpts + '</select>')
        + '<div id="znpf-beff-val-wrap">'
        + _row(_lbl(bEffLbl) + _hint('Το ποσοστό ή ποσό που αφαιρείται από τα είδη του πακέτου.') + '<input id="znpf-beff-val" type="number" min="0" step="0.5" value="' + _esc(String(bEffVal)) + '" placeholder="' + bEffPh + '" style="' + _INP + '">')
        + '</div>';
    }
    var curScope = cond.scope || 'all';
    var scopeOpts = ['all','product','category'].map(function (s) {
      var lbl = s === 'all' ? 'Όλα τα προϊόντα' : (s === 'product' ? 'Συγκεκριμένα προϊόντα' : 'Κατηγορίες');
      return '<option value="' + s + '"' + (curScope === s ? ' selected' : '') + '>' + lbl + '</option>';
    }).join('');
    if (type === 'expiry') {
      return _row(_lbl('Εύρος') + _hint('Σε ποια προϊόντα ισχύει: όλα, συγκεκριμένο, ή κατηγορία.') + '<select id="znpf-scope" onchange="ZN_PROMOS._onScopeChange()" style="' + _INP + '">' + scopeOpts + '</select>')
           + '<div id="znpf-ids-wrap">' + _idsFieldHtml(curScope, cond.ids||[]) + '</div>'
           + _row(_lbl('Ημέρες πριν τη λήξη') + '<input id="znpf-daysbefore" type="number" min="1" value="' + (cond.days_before||'') + '" placeholder="π.χ. 7" style="' + _INP + '">');
    }
    if (type === 'dead_stock') {
      return _row(_lbl('Εύρος') + _hint('Σε ποια προϊόντα ισχύει: όλα, συγκεκριμένο, ή κατηγορία.') + '<select id="znpf-scope" onchange="ZN_PROMOS._onScopeChange()" style="' + _INP + '">' + scopeOpts + '</select>')
           + '<div id="znpf-ids-wrap">' + _idsFieldHtml(curScope, cond.ids||[]) + '</div>'
           + _row(_lbl('Ημέρες χωρίς πώληση') + _hint('Σκάει αν το προϊόν δεν πουλήθηκε τόσες μέρες (ή ποτέ).') + '<input id="znpf-daysnonsale" type="number" min="1" value="' + (cond.days_no_sale||'') + '" placeholder="π.χ. 30" style="' + _INP + '">');
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
    var typeOpts = ['percent_over_qty','category_combo','nth_discount','expiry','dead_stock','bundle'].map(function (t) {
      return '<option value="' + t + '"' + (curType === t ? ' selected' : '') + '>' + _typeLabel(t) + '</option>';
    }).join('');

    var isPctHidden = curType === 'bundle';

    var html = '<div style="background:var(--bg-0);border-radius:18px 18px 0 0;padding:20px;width:100%;'
      + 'max-width:640px;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-sizing:border-box">'
      + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px">'
      + '<div class="fw-700" style="font-size:17px">' + (id ? '✏️ Επεξεργασία Προσφοράς' : '🎁 Νέα Προσφορά') + '</div>'
      + '<button onclick="ZN_PROMOS.closeModal()" aria-label="Κλείσιμο"'
      + ' style="background:none;border:none;cursor:pointer;font-size:24px;min-height:44px;min-width:44px;color:var(--text-2);line-height:1">×</button>'
      + '</div>'
      + _row(_lbl('Όνομα Κανόνα') + _hint('Όπως εμφανίζεται στον πελάτη (απόδειξη/καλάθι).') + '<input id="znpf-name" type="text" value="' + _esc(r.name||'') + '" placeholder="π.χ. 3 υγρά −20%" style="' + _INP + '">')
      + _row(_lbl('Τύπος') + _hint('Τι λογική ακολουθεί: ποσότητα, λήξη, αδρανές απόθεμα, πακέτο, n-οστό.') + '<select id="znpf-type" onchange="ZN_PROMOS._onTypeChange()" style="' + _INP + '">' + typeOpts + '</select>')
      + '<div id="znpf-fields" style="margin-bottom:2px">' + _typeFields(curType, cond, eff) + '</div>'
      + '<div id="znpf-pct-wrap"' + (isPctHidden ? ' style="display:none"' : '') + '>'
      + _row(_lbl('Έκπτωση %') + _hint('Το ποσοστό που αφαιρείται.') + '<input id="znpf-percent" type="number" min="0" max="100" step="0.5" value="' + (eff.percent||'') + '" placeholder="π.χ. 20" style="' + _INP + '">')
      + '</div>'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px">'
      + '<div style="flex:1;min-width:130px">'
      + _lbl('Προτεραιότητα')
      + _hint('Μεγαλύτερος αριθμός = υψηλότερη. Μετράει μόνο στο «Μόνο η καλύτερη».')
      + '<input id="znpf-priority" type="number" min="1" value="' + (r.priority||100) + '" style="' + _INP + '"></div>'
      + '<div style="flex:1;min-width:130px;padding-top:22px">'
      + '<label style="display:flex;align-items:center;gap:10px;cursor:pointer">'
      + '<input id="znpf-active" type="checkbox"' + (r.active !== false ? ' checked' : '') + ' style="width:22px;height:22px;cursor:pointer">'
      + '<span class="fw-700 text-sm">Ενεργό</span></label>'
      + _hint('Αν κλειστό, η προσφορά δεν εφαρμόζεται.')
      + '</div></div>'
      + '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">'
      + '<div style="flex:1;min-width:130px">'
      + _lbl('Ισχύει από (προαιρ.)') + _hint('Προαιρετικές ημερομηνίες — εκτός αυτών η προσφορά κοιμάται.')
      + '<input id="znpf-from" type="date" value="' + (r.valid_from ? r.valid_from.slice(0,10) : '') + '" style="' + _INP + '"></div>'
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
    var pctWrap = document.getElementById('znpf-pct-wrap');
    if (pctWrap) { pctWrap.style.display = t === 'bundle' ? 'none' : ''; }
  }

  function _onScopeChange() {
    var scope = (document.getElementById('znpf-scope') || {}).value || 'all';
    var el = document.getElementById('znpf-ids-wrap');
    if (el) { el.innerHTML = _idsFieldHtml(scope, []); }
  }

  /* ─── Bundle interactive handlers ─── */
  function _onBundleRefChange(sel) {
    var row = sel;
    while (row && (row.className || '').indexOf('znpf-brow') === -1) { row = row.parentNode; }
    if (!row) { return; }
    var wrap = row.querySelector('.znpf-bsel-wrap');
    if (wrap) { wrap.innerHTML = _lbl('Επιλογή') + _bundleSelHtml(sel.value, ''); }
  }

  function _removeBundleRow(btn) {
    var rows = document.querySelectorAll('#znpf-bundle-items .znpf-brow');
    if (rows.length <= 2) {
      if (typeof toast === 'function') { toast('Ελάχιστο 2 είδη απαιτούνται', 'warn'); }
      return;
    }
    var el = btn;
    while (el && (el.className || '').indexOf('znpf-brow') === -1) { el = el.parentNode; }
    if (el && el.parentNode) { el.parentNode.removeChild(el); }
  }

  function _addBundleRow() {
    var container = document.getElementById('znpf-bundle-items');
    if (!container) { return; }
    var div = document.createElement('div');
    div.innerHTML = _bundleRowHtml('product', '', 1);
    container.appendChild(div.firstChild);
  }

  /* Ανοίγει ZN_PICKER για επιλογή προϊόντος — χρησιμοποιείται σε bundle rows + fields */
  function _openPicker(btn) {
    if (typeof ZN_PICKER === 'undefined') { return; }
    ZN_PICKER.open(btn, {
      onSelect: function (p) {
        btn.dataset.pid  = String(p.id);
        btn.textContent  = p.name;
      }
    });
  }

  function _onBundleEffChange() {
    var t = (document.getElementById('znpf-beff-type') || {}).value || 'percent';
    var wrap = document.getElementById('znpf-beff-val-wrap');
    if (!wrap) { return; }
    var inp = document.getElementById('znpf-beff-val');
    var curVal = inp ? inp.value : '';
    var lbl = t === 'amount' ? 'Ποσό € (σταθερό, μία φορά)' : 'Ποσοστό %';
    var ph  = t === 'amount' ? 'π.χ. 5.00' : 'π.χ. 20';
    wrap.innerHTML = _row(_lbl(lbl) + '<input id="znpf-beff-val" type="number" min="0" step="0.5" value="' + _esc(curVal) + '" placeholder="' + ph + '" style="' + _INP + '">');
  }

  function closeModal() {
    var el = document.getElementById('znpr-modal');
    if (el) { el.remove(); }
    _editingId = null;
  }

  /* ─── Save (insert or update) ─── */
  function save() {
    var name   = ((document.getElementById('znpf-name')     || {}).value || '').trim();
    var type   = (document.getElementById('znpf-type')      || {}).value || '';
    var pct    = parseFloat((document.getElementById('znpf-percent')  || {}).value) || 0;
    var prio   = parseInt((document.getElementById('znpf-priority')   || {}).value) || 100;
    var activeEl = document.getElementById('znpf-active');
    var active = activeEl ? !!activeEl.checked : true;
    var vFrom  = (document.getElementById('znpf-from') || {}).value || null;
    var vTo    = (document.getElementById('znpf-to')   || {}).value || null;

    if (!name) { toast('✋ BLOCK: κενό όνομα', 'danger'); return; }
    if (!type) { toast('✋ BLOCK: κενός τύπος', 'danger'); return; }
    if (type !== 'bundle' && !pct) { toast('✋ BLOCK: pct=0 (βάλε έκπτωση %)', 'danger'); return; }

    var conditions = null;
    if (type === 'percent_over_qty') {
      var pid  = ((document.getElementById('znpf-product') || {}).dataset || {}).pid || '';
      var minq = parseInt((document.getElementById('znpf-minqty') || {}).value) || 0;
      if (!pid)  { toast('✋ BLOCK: επίλεξε προϊόν', 'danger'); return; }
      if (!minq) { toast('✋ BLOCK: βάλε ποσότητα', 'danger'); return; }
      conditions = { product_id: pid, min_qty: minq };
    } else if (type === 'category_combo') {
      var cat   = (document.getElementById('znpf-category') || {}).value || '';
      var minq2 = parseInt((document.getElementById('znpf-minqty') || {}).value) || 0;
      if (!cat)   { toast('✋ BLOCK: επίλεξε κατηγορία', 'danger'); return; }
      if (!minq2) { toast('✋ BLOCK: βάλε ποσότητα', 'danger'); return; }
      conditions = { category: cat, min_qty: minq2 };
    } else if (type === 'nth_discount') {
      var pid2 = ((document.getElementById('znpf-product')  || {}).dataset || {}).pid || '';
      var cat2 = (document.getElementById('znpf-category') || {}).value || '';
      var n    = parseInt((document.getElementById('znpf-n') || {}).value) || 0;
      if (!pid2 && !cat2) { toast('✋ BLOCK: επίλεξε προϊόν ή κατηγορία', 'danger'); return; }
      if (!n || n < 2)    { toast('✋ BLOCK: N πρέπει ≥ 2', 'danger'); return; }
      conditions = pid2 ? { product_id: pid2, n: n } : { category: cat2, n: n };
    } else if (type === 'expiry') {
      var eScope = (document.getElementById('znpf-scope') || {}).value || 'all';
      var eIds   = _readIds(eScope);
      var eDB    = parseInt((document.getElementById('znpf-daysbefore') || {}).value) || 0;
      if (!eDB)  { toast('✋ BLOCK: βάλε ημέρες λήξης', 'danger'); return; }
      if (eScope !== 'all' && !eIds.length) { toast('✋ BLOCK: επίλεξε στοιχεία', 'danger'); return; }
      conditions = { scope: eScope, ids: eIds, days_before: eDB };
    } else if (type === 'dead_stock') {
      var dScope = (document.getElementById('znpf-scope') || {}).value || 'all';
      var dIds   = _readIds(dScope);
      var dDNS   = parseInt((document.getElementById('znpf-daysnonsale') || {}).value) || 0;
      if (!dDNS) { toast('✋ BLOCK: βάλε ημέρες αδράνειας', 'danger'); return; }
      if (dScope !== 'all' && !dIds.length) { toast('✋ BLOCK: επίλεξε στοιχεία', 'danger'); return; }
      conditions = { scope: dScope, ids: dIds, days_no_sale: dDNS };
    } else if (type === 'bundle') {
      var bItems = _readBundleItems();
      if (bItems.length < 2) { toast('✋ BLOCK: ελάχιστο 2 είδη στο πακέτο', 'danger'); return; }
      conditions = { items: bItems };
    }

    if (conditions === null) {
      toast('✋ BLOCK: άγνωστος τύπος "' + type + '"', 'danger');
      return;
    }

    var shopId = typeof SHOP_ID !== 'undefined' ? SHOP_ID : null;

    var effect;
    if (type === 'bundle') {
      var bEffTypeVal = (document.getElementById('znpf-beff-type') || {}).value || 'percent';
      var bEffValNum  = parseFloat((document.getElementById('znpf-beff-val') || {}).value) || 0;
      if (!bEffValNum) { toast('✋ BLOCK: βάλε τιμή έκπτωσης', 'danger'); return; }
      effect = bEffTypeVal === 'amount' ? { amount: bEffValNum } : { percent: bEffValNum };
    } else {
      effect = { percent: pct };
    }

    var payload = {
      name: name, type: type, conditions: conditions,
      effect: effect, priority: prio, active: active,
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
    _onScopeChange: _onScopeChange,
    _onBundleRefChange: _onBundleRefChange,
    _removeBundleRow: _removeBundleRow,
    _addBundleRow: _addBundleRow,
    _onBundleEffChange: _onBundleEffChange,
    _openPicker: _openPicker
  };
})();
