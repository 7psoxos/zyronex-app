/* =====================================================================
 * ZyroNex · Task 1 — Reorder Engine (Vanilla JS)
 * Καλεί το RPC zn_burn_rate_reorder (server-side), ομαδοποιεί ανά
 * προμηθευτή, και χτίζει προσχέδια παραγγελιών.
 *
 * Κανόνες ZyroNex τηρούνται:
 *  - var παντού (όχι const/let) → Safari TDZ-safe.
 *  - String-safe ID matching (bigint/uuid).
 *  - Κλήση μέσω sbAuth (authenticated) ώστε να δουλεύει το RLS.
 *  - Καμία βαριά λογική στον client· ο υπολογισμός είναι στο RPC.
 *  - Plugin-gated με isPluginActive('reorder_assistant').
 *
 * Εξαρτήσεις (υπάρχουν ήδη): sbAuth, PRODUCTS, SUPPLIERS, toast(),
 *   isPluginActive(), can(), showPage(), logShopChange().
 * ===================================================================== */
var ZN_REORDER = (function () {
  'use strict';

  // Τελευταίο αποτέλεσμα (cache για το render, χωρίς νέα κλήση).
  var _lastRows = null;

  /* Καλεί το RPC. opts: {windowDays, coverageDays, leadDays, onlyReorder} */
  function compute(opts) {
    opts = opts || {};
    var params = {
      p_window_days:   Number(opts.windowDays)   || 30,
      p_coverage_days: Number(opts.coverageDays) || 30,
      p_lead_days:     Number(opts.leadDays)     || 7,
      p_only_reorder:  opts.onlyReorder !== false
    };
    // ΠΑΝΤΑ sbAuth (authenticated) — όχι sb (anon) — για σωστό RLS.
    return sbAuth.rpc('zn_burn_rate_reorder', params).then(function (res) {
      if (res.error) { throw res.error; }
      _lastRows = res.data || [];
      return _lastRows;
    });
  }

  /* Βρίσκει όνομα προμηθευτή string-safe (id μπορεί να είναι bigint). */
  function _supplierName(sid) {
    if (sid === null || typeof sid === 'undefined') { return 'Χωρίς προμηθευτή'; }
    var s = (typeof SUPPLIERS !== 'undefined' ? SUPPLIERS : []).find(function (x) {
      return String(x.id) === String(sid);
    });
    return s ? s.name : ('Προμηθευτής #' + sid);
  }

  /* Ομαδοποιεί τις γραμμές ανά προμηθευτή → προσχέδια παραγγελιών. */
  function buildOrdersBySupplier(rows) {
    rows = rows || _lastRows || [];
    var bySupplier = {};
    var i, r, key;
    for (i = 0; i < rows.length; i++) {
      r = rows[i];
      if (!r.needs_reorder) { continue; }
      key = (r.supplier_id === null || typeof r.supplier_id === 'undefined')
        ? '__none__' : String(r.supplier_id);
      if (!bySupplier[key]) {
        bySupplier[key] = {
          supplierId: (key === '__none__' ? null : r.supplier_id),
          supplierName: _supplierName(r.supplier_id),
          lines: [],
          totalUnits: 0
        };
      }
      bySupplier[key].lines.push({
        productId:    r.product_id,
        productName:  r.product_name,
        currentStock: Number(r.current_stock),
        dailyBurn:    Number(r.daily_burn),
        daysLeft:     (r.days_left === null ? null : Number(r.days_left)),
        trendFactor:  Number(r.trend_factor),
        suggestedQty: Number(r.suggested_qty)
      });
      bySupplier[key].totalUnits += Number(r.suggested_qty) || 0;
    }
    // Μετατροπή σε array, ταξινομημένο με τους πιο "επείγοντες" πρώτους.
    var orders = Object.keys(bySupplier).map(function (k) { return bySupplier[k]; });
    orders.sort(function (a, b) { return b.lines.length - a.lines.length; });
    return orders;
  }

  /* Render — ελάχιστο markup, χρησιμοποιεί υπάρχουσες κλάσεις/helpers.
     (Καμία νέα αισθητική — μόνο δομή/λογική.) */
  function render(orders) {
    var content = document.getElementById('content');
    if (!content) { return; }
    orders = orders || buildOrdersBySupplier();

    var html = '';
    html += '<div class="page-head"><h2>🛒 Έξυπνη Παραγγελία</h2>'
         +  '<p class="muted">Προτάσεις αναπλήρωσης βάσει ρυθμού κατανάλωσης (30 ημερών).</p></div>';

    if (!orders.length) {
      html += '<div class="card"><p>✅ Κανένα προϊόν δεν χρειάζεται παραγγελία αυτή τη στιγμή.</p></div>';
      content.innerHTML = html;
      return;
    }

    var i, j, o, ln;
    for (i = 0; i < orders.length; i++) {
      o = orders[i];
      html += '<div class="card" style="margin-bottom:16px">';
      html += '<div style="font-weight:700;font-size:15px;margin-bottom:12px;word-break:break-word;min-width:0">'
           +  _esc(o.supplierName)
           +  ' <span style="font-weight:400;font-size:13px;color:var(--text-2)">· ' + o.lines.length + ' προϊόντα</span></div>';
      for (j = 0; j < o.lines.length; j++) {
        ln = o.lines[j];
        html += '<div style="padding:10px 0;min-width:0;overflow:hidden;'
             +  (j < o.lines.length - 1 ? 'border-bottom:1px solid var(--border);' : '') + '">';
        html += '<div style="font-weight:600;font-size:14px;word-break:break-word;min-width:0;margin-bottom:6px">'
             +  _esc(ln.productName) + '</div>';
        html += '<div style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;font-size:12px;color:var(--text-2)">';
        html += '<span>📦 ' + ln.currentStock + ' στοκ</span>';
        html += '<span>🔥 ' + ln.dailyBurn.toFixed(2) + '/ημ.</span>';
        html += '<span>📅 ' + (ln.daysLeft === null ? '—' : ln.daysLeft) + ' ημ.</span>';
        html += '<span>' + _trendIcon(ln.trendFactor) + '</span>';
        html += '<span style="font-size:13px;font-weight:800;color:var(--accent)">'
             +  'Παρ. ×' + ln.suggestedQty + '</span>';
        html += '</div>';
        html += '</div>';
      }
      html += '<button class="btn" style="min-height:44px;margin-top:10px;width:100%"'
           +  ' onclick="ZN_REORDER.exportOrder('
           +  (o.supplierId === null ? 'null' : "'" + String(o.supplierId) + "'")
           +  ')">📋 Αντιγραφή παραγγελίας</button>';
      html += '</div>';
    }
    content.innerHTML = html;
  }

  /* Εξαγωγή μιας παραγγελίας ως κείμενο (για email/clipboard στον προμηθευτή). */
  function exportOrder(supplierId) {
    var orders = buildOrdersBySupplier();
    var o = orders.find(function (x) { return String(x.supplierId) === String(supplierId); });
    if (!o) { o = orders.find(function (x) { return x.supplierId === null && supplierId === null; }); }
    if (!o) { toast('Δεν βρέθηκε παραγγελία', 'danger'); return; }

    var txt = 'Παραγγελία προς: ' + o.supplierName + '\n\n';
    var j;
    for (j = 0; j < o.lines.length; j++) {
      txt += '• ' + o.lines[j].productName + ' × ' + o.lines[j].suggestedQty + '\n';
    }
    txt += '\nΣύνολο μονάδων: ' + o.totalUnits;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(function () {
        toast('Η παραγγελία αντιγράφηκε', 'success');
      });
    } else {
      toast(txt, 'info');
    }
    if (typeof logShopChange === 'function') {
      logShopChange('reorder', 'Δημιουργήθηκε προσχέδιο παραγγελίας: ' + o.supplierName);
    }
  }

  /* Entry point — plugin-gated, καλεί RPC και κάνει render. */
  function open() {
    if (typeof isPluginActive === 'function' && !isPluginActive('reorder_assistant')) {
      toast('Το plugin «Έξυπνη Παραγγελία» δεν είναι ενεργό', 'info');
      return;
    }
    if (typeof can === 'function' && !can('inventory')) {
      toast('Δεν έχεις δικαίωμα πρόσβασης', 'danger');
      return;
    }
    toast('Υπολογισμός ρυθμού κατανάλωσης…', 'info');
    compute({ onlyReorder: true })
      .then(function () { render(); })
      .catch(function (e) {
        toast('Σφάλμα: ' + (e && e.message ? e.message : 'άγνωστο'), 'danger');
      });
  }

  function _trendIcon(t) {
    if (t > 1.15) { return '📈'; }
    if (t < 0.85) { return '📉'; }
    return '➡️';
  }
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  return {
    compute: compute,
    buildOrdersBySupplier: buildOrdersBySupplier,
    render: render,
    exportOrder: exportOrder,
    open: open
  };
})();
