/* =====================================================================
 * ZyroNex · RMA / Εγγυήσεις & Επισκευές
 * Πίνακες zn_rma / zn_rma_events (RLS βάσει auth_shop_id).
 * ΟΛΕΣ οι κλήσεις με sbAuth. Mobile-first, fallback, ποτέ block.
 * Συνδέεται με το υπάρχον warranty_records (serial lookup) — δεν το διπλώνει.
 * Ετικέτα μέσω κοινού print builder (znOpenPrintDoc): θερμικό + A4.
 * ===================================================================== */

var RMA_CACHE = [];
var RMA_FILTER = 'all';
var _RMA_LOOKUP = null; // { product, productId, saleDate, warrantyEnd, warrantyMonths, source }

var ZN_RMA_STATUSES = [
  { id: 'received',             label: 'Παρελήφθη',               color: '#3b82f6' },
  { id: 'sent_to_supplier',     label: 'Στάλθηκε σε προμηθευτή',  color: '#f59e0b' },
  { id: 'repaired',             label: 'Επισκευάστηκε',           color: '#10b981' },
  { id: 'replaced',             label: 'Αντικαταστάθηκε',         color: '#10b981' },
  { id: 'returned_to_customer', label: 'Επιστράφηκε στον πελάτη', color: '#22c55e' },
  { id: 'rejected',             label: 'Απορρίφθηκε',             color: '#ef4444' },
  { id: 'cancelled',            label: 'Ακυρώθηκε',               color: '#6b7280' }
];

var _ZN_RMA_CLOSED = ['returned_to_customer', 'rejected', 'cancelled'];
function _rmaIsClosed(status) { return _ZN_RMA_CLOSED.indexOf(status) !== -1; }

/* ---------- helpers ---------- */
function _rmaEsc(s) {
  if (typeof escapeHtml === 'function') { return escapeHtml(s == null ? '' : String(s)); }
  var d = document.createElement('div'); d.textContent = (s == null ? '' : String(s)); return d.innerHTML;
}
function _rf(row, names) {
  for (var i = 0; i < names.length; i++) {
    if (row && row[names[i]] != null && row[names[i]] !== '') { return row[names[i]]; }
  }
  return '';
}
function _rmaStatusMeta(id) {
  for (var i = 0; i < ZN_RMA_STATUSES.length; i++) {
    if (ZN_RMA_STATUSES[i].id === id) { return ZN_RMA_STATUSES[i]; }
  }
  return { id: id, label: id || '—', color: '#6b7280' };
}
function _rmaStatusBadge(id) {
  var m = _rmaStatusMeta(id);
  return '<span class="chip" style="font-size:10px;background:' + m.color + '22;color:' + m.color +
    ';border:1px solid ' + m.color + '55">' + _rmaEsc(m.label) + '</span>';
}
function _rmaDate(v) {
  if (!v) { return '—'; }
  try { return (typeof dateGR === 'function') ? dateGR(v) : new Date(v).toLocaleDateString('el-GR'); }
  catch (e) { return String(v); }
}
function _rmaNumber(row) { return _rf(row, ['rma_number', 'number', 'rma_no', 'code']) || ('#' + _rf(row, ['id'])); }
function _rmaBarcodeUrl(text) {
  return 'https://bwipjs-api.metafloor.com/?bcid=code128&text=' + encodeURIComponent(text) +
    '&scale=2&height=12&includetext=false';
}

/* ---------- λίστα / σελίδα ---------- */
async function renderRMA() {
  var content = document.getElementById('content');
  if (!content) { return; }
  content.innerHTML = '<div class="page-head"><div class="page-title">🔧 RMA / Εγγυήσεις & Επισκευές</div></div>' +
    '<div class="muted" style="padding:40px;text-align:center"><div style="width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 12px"></div>Φόρτωση...</div>';
  try {
    if (typeof sbAuth === 'undefined' || !sbAuth.from) { throw new Error('Μη διαθέσιμη σύνδεση'); }
    var res = await sbAuth.from('zn_rma').select('*').order('created_at', { ascending: false }).limit(300);
    if (window.CURRENT_PAGE_ID && window.CURRENT_PAGE_ID !== 'rma') { return; }
    if (res && res.error) { throw new Error(res.error.message || 'Σφάλμα φόρτωσης'); }
    RMA_CACHE = (res && res.data) ? res.data : [];
  } catch (e) {
    RMA_CACHE = [];
    content.innerHTML = '<div class="page-head"><div class="page-title">🔧 RMA / Εγγυήσεις & Επισκευές</div></div>' +
      '<div class="card" style="padding:24px;text-align:center;color:var(--text-2)">Δεν ήταν δυνατή η φόρτωση: ' +
      _rmaEsc(e.message || String(e)) + '</div>' +
      '<div style="text-align:center;margin-top:12px"><button class="btn btn-ghost" onclick="renderRMA()">Δοκίμασε ξανά</button></div>';
    return;
  }
  _renderRMAPage();
}

function _renderRMAPage() {
  var content = document.getElementById('content');
  if (!content) { return; }
  var open = RMA_CACHE.filter(function (r) { return !_rmaIsClosed(_rf(r, ['status'])); }).length;
  content.innerHTML =
    '<div class="page-head">' +
      '<div>' +
        '<div class="page-title">🔧 RMA / Εγγυήσεις & Επισκευές</div>' +
        '<div class="page-sub">' + RMA_CACHE.length + ' σύνολο · ' + open + ' ενεργά</div>' +
      '</div>' +
      '<div class="flex gap-2" style="flex-wrap:wrap">' +
        '<button class="btn btn-ghost" style="min-height:44px" onclick="renderRMA()"><i data-lucide="refresh-cw" size="16"></i> Ανανέωση</button>' +
        '<button class="btn btn-primary" style="min-height:44px" onclick="openNewRMA()"><i data-lucide="plus" size="16"></i> Νέο RMA</button>' +
      '</div>' +
    '</div>' +
    '<div class="tabs mb-3" style="flex-wrap:wrap">' +
      _rmaFilterTab('all', 'Όλα') +
      _rmaFilterTab('open', 'Ενεργά') +
      _rmaFilterTab('closed', 'Κλειστά') +
    '</div>' +
    '<div id="rmaList"></div>';
  _renderRMAList();
  if (typeof lucide !== 'undefined' && lucide.createIcons) { lucide.createIcons(); }
}

function _rmaFilterTab(id, label) {
  return '<div class="tab ' + (RMA_FILTER === id ? 'active' : '') + '" onclick="RMA_FILTER=\'' + id + '\';_renderRMAPage()">' + label + '</div>';
}

function _renderRMAList() {
  var listEl = document.getElementById('rmaList');
  if (!listEl) { return; }
  var rows = RMA_CACHE;
  if (RMA_FILTER === 'open') {
    rows = rows.filter(function (r) { return !_rmaIsClosed(_rf(r, ['status'])); });
  } else if (RMA_FILTER === 'closed') {
    rows = rows.filter(function (r) { return _rmaIsClosed(_rf(r, ['status'])); });
  }
  if (!rows.length) {
    listEl.innerHTML = '<div class="card" style="padding:32px;text-align:center;color:var(--text-2)">' +
      '<div style="font-size:34px;margin-bottom:8px">🔧</div>Κανένα RMA. Πάτα «➕ Νέο RMA».</div>';
    return;
  }
  listEl.innerHTML = rows.map(_rmaCardHTML).join('');
  if (typeof lucide !== 'undefined' && lucide.createIcons) { lucide.createIcons({ el: listEl }); }
}

function _rmaCardHTML(r) {
  var id = _rf(r, ['id']);
  var num = _rmaNumber(r);
  var prod = _rf(r, ['product_name', 'device_name']) || '—';
  var serial = _rf(r, ['serial_number', 'serial']);
  var cust = _rf(r, ['customer_name']);
  var phone = _rf(r, ['customer_phone']);
  var wv = _rf(r, ['warranty_valid']);
  var warrChip = (wv === true || wv === 't' || wv === 1)
    ? '<span class="chip" style="font-size:10px;background:rgba(34,197,94,.15);color:#22c55e">🛡️ Εγγύηση: Ισχύει</span>'
    : (wv === false || wv === 'f' || wv === 0)
      ? '<span class="chip" style="font-size:10px;background:rgba(239,68,68,.12);color:#ef4444">Εγγύηση: Έληξε</span>'
      : '';
  return '<div class="card" style="padding:14px;margin-bottom:10px;cursor:pointer" onclick="openRMADetail(\'' + _rmaEsc(id) + '\')">' +
    '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">' +
      '<div style="min-width:0;flex:1">' +
        '<div style="font-weight:800;font-size:15px;word-break:break-word">' + _rmaEsc(prod) + '</div>' +
        '<div class="mono text-xs" style="color:var(--text-2);margin-top:2px">' + _rmaEsc(num) + (serial ? (' · SN: ' + _rmaEsc(serial)) : '') + '</div>' +
        (cust ? ('<div class="text-xs" style="margin-top:2px">👤 ' + _rmaEsc(cust) + (phone ? (' · ' + _rmaEsc(phone)) : '') + '</div>') : '') +
      '</div>' +
      '<div style="text-align:right;white-space:nowrap">' + _rmaDate(_rf(r, ['created_at', 'created'])) + '</div>' +
    '</div>' +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center">' +
      _rmaStatusBadge(_rf(r, ['status'])) + warrChip +
      '<span style="flex:1"></span>' +
      '<button class="btn btn-ghost" style="font-size:12px;padding:4px 10px;min-height:36px" onclick="event.stopPropagation();znPrintRmaLabel(\'' + _rmaEsc(id) + '\')"><i data-lucide="tag" size="14"></i> Ετικέτα</button>' +
    '</div>' +
  '</div>';
}

/* ---------- Νέο RMA ---------- */
function openNewRMA() {
  _RMA_LOOKUP = null;
  openModal('<div class="modal-head">' +
    '<h3 class="fw-800 text-xl">🔧 Νέο RMA</h3>' +
    '<button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button>' +
  '</div>' +
  '<div class="modal-body">' +
    '<div class="form-row">' +
      '<label class="form-label">Barcode ή Serial (scan / πληκτρολόγηση)</label>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<input class="form-input" id="rma_code" placeholder="Scan ή πληκτρολόγησε..." style="flex:1;min-width:160px;min-height:44px;font-size:16px" ' +
          'onkeydown="if(event.key===\'Enter\'){event.preventDefault();rmaLookup();}" autocomplete="off">' +
        '<button class="btn btn-primary" style="min-height:44px" onclick="rmaLookup()"><i data-lucide="search" size="16"></i> Αναζήτηση</button>' +
      '</div>' +
      '<div id="rma_lookup_result" class="text-xs" style="margin-top:8px"></div>' +
    '</div>' +
    '<div class="form-row">' +
      '<label class="form-label">Προϊόν / Συσκευή *</label>' +
      '<input class="form-input" id="rma_product" data-pid="" placeholder="π.χ. Voopoo Drag 3" style="min-height:44px">' +
    '</div>' +
    '<div class="form-grid">' +
      '<div class="form-row"><label class="form-label">Σειριακός (Serial)</label><input class="form-input" id="rma_serial" placeholder="π.χ. VP12345" style="min-height:44px"></div>' +
      '<div class="form-row"><label class="form-label">Ημ/νία αγοράς</label><input class="form-input" type="date" id="rma_pdate" style="min-height:44px" value="' + new Date().toISOString().slice(0, 10) + '"></div>' +
    '</div>' +
    '<div class="form-grid">' +
      '<div class="form-row"><label class="form-label">Διάρκεια εγγύησης</label>' +
        '<select class="form-select" id="rma_wmonths" style="min-height:44px">' +
          '<option value="0">Χωρίς</option><option value="3">3 μήνες</option><option value="6">6 μήνες</option>' +
          '<option value="12" selected>12 μήνες</option><option value="24">24 μήνες</option>' +
        '</select></div>' +
      '<div class="form-row"><label class="form-label">Προμηθευτής</label><input class="form-input" id="rma_supplier" placeholder="π.χ. Voopoo Hellas" style="min-height:44px"></div>' +
    '</div>' +
    '<div class="form-grid">' +
      '<div class="form-row"><label class="form-label">Πελάτης (όνομα)</label><input class="form-input" id="rma_cust" placeholder="Ονοματεπώνυμο" style="min-height:44px"></div>' +
      '<div class="form-row"><label class="form-label">Τηλέφωνο</label><input class="form-input" id="rma_phone" placeholder="69..." style="min-height:44px"></div>' +
    '</div>' +
    '<div class="form-row"><label class="form-label">Περιγραφή βλάβης *</label>' +
      '<textarea class="form-input form-textarea" id="rma_fault" rows="2" placeholder="π.χ. Δεν φορτίζει, οθόνη χαλασμένη..."></textarea></div>' +
    '<div class="flex gap-2 mt-4">' +
      '<button class="btn btn-primary" onclick="saveRMA()"><i data-lucide="save" size="16"></i> Δημιουργία RMA</button>' +
      '<button class="btn btn-ghost" onclick="closeModal()">Ακύρωση</button>' +
    '</div>' +
  '</div>');
  if (typeof lucide !== 'undefined' && lucide.createIcons) { lucide.createIcons(); }
  setTimeout(function () { var el = document.getElementById('rma_code'); if (el) { el.focus(); } }, 100);
}

async function rmaLookup() {
  var codeEl = document.getElementById('rma_code');
  var resEl = document.getElementById('rma_lookup_result');
  if (!codeEl || !resEl) { return; }
  var code = (codeEl.value || '').trim();
  if (!code) { resEl.innerHTML = '<span style="color:var(--warn)">Δώσε barcode ή serial.</span>'; return; }
  resEl.innerHTML = '<span class="muted">Αναζήτηση...</span>';
  var msgs = [];
  _RMA_LOOKUP = {};

  // 1) Προϊόν από barcode (τοπικό PRODUCTS)
  var prod = null;
  try {
    if (typeof PRODUCTS !== 'undefined' && PRODUCTS.length) {
      prod = PRODUCTS.find(function (p) { return p.barcode && String(p.barcode) === code; }) || null;
    }
  } catch (e) {}
  if (prod) {
    var pf = document.getElementById('rma_product'); if (pf) { pf.value = prod.name; pf.dataset.pid = String(prod.id); }
    _RMA_LOOKUP.productId = prod.id;
    msgs.push('✅ Προϊόν: <b>' + _rmaEsc(prod.name) + '</b>');

    // 2) Αρχική πώληση (sbAuth, RLS) — η πιο πρόσφατη
    try {
      var sres = await sbAuth.from('sale_items').select('sale_id, sales(created_at)').eq('product_id', prod.id).limit(50);
      if (sres && !sres.error && sres.data && sres.data.length) {
        var withDate = sres.data.filter(function (x) { return x.sales && x.sales.created_at; });
        if (withDate.length) {
          withDate.sort(function (a, b) { return String(a.sales.created_at).localeCompare(String(b.sales.created_at)); });
          var lastRow = withDate[withDate.length - 1];
          var last = lastRow.sales.created_at;
          _RMA_LOOKUP.saleId = lastRow.sale_id;
          var sd = document.getElementById('rma_pdate'); if (sd) { sd.value = String(last).slice(0, 10); }
          msgs.push('🧾 Αρχική πώληση: ' + _rmaDate(last));
        } else { msgs.push('<span class="muted">Δεν βρέθηκε αρχική πώληση — συμπλήρωσε χειροκίνητα.</span>'); }
      } else { msgs.push('<span class="muted">Δεν βρέθηκε αρχική πώληση — συμπλήρωσε χειροκίνητα.</span>'); }
    } catch (e2) { msgs.push('<span class="muted">Δεν βρέθηκε αρχική πώληση — συμπλήρωσε χειροκίνητα.</span>'); }
  } else {
    // Serial: γέμισε το πεδίο serial και ψάξε υπάρχουσα εγγύηση
    var sf = document.getElementById('rma_serial'); if (sf && !sf.value) { sf.value = code; }
    msgs.push('ℹ️ Δεν βρέθηκε προϊόν με αυτό το barcode — αντιμετωπίζεται ως serial.');
  }

  // 3) Σύνδεση με υπάρχον warranty_records (serial)
  try {
    var wq = await sbAuth.from('warranty_records').select('*').eq('serial_number', code).limit(1);
    if (wq && !wq.error && wq.data && wq.data.length) {
      var w = wq.data[0];
      if (w.purchase_date) { var pd = document.getElementById('rma_pdate'); if (pd) { pd.value = String(w.purchase_date).slice(0, 10); } }
      if (w.serial_number) { var ss = document.getElementById('rma_serial'); if (ss) { ss.value = w.serial_number; } }
      if (w.device_name && !document.getElementById('rma_product').value) { document.getElementById('rma_product').value = w.device_name; }
      var valid = w.warranty_end ? (new Date(w.warranty_end).getTime() >= Date.now()) : null;
      msgs.push('🛡️ Υπάρχουσα εγγύηση: ' + (valid === true ? '<b style="color:#22c55e">Ισχύει</b> (έως ' + _rmaDate(w.warranty_end) + ')'
        : valid === false ? '<b style="color:#ef4444">Έληξε</b> (' + _rmaDate(w.warranty_end) + ')' : 'καταχωρημένη'));
    }
  } catch (e3) {}

  resEl.innerHTML = msgs.join('<br>');
}

async function saveRMA() {
  var prodEl = document.getElementById('rma_product');
  var product = (prodEl && prodEl.value || '').trim();
  var fault = (document.getElementById('rma_fault').value || '').trim();
  if (!product) { toast('Συμπλήρωσε προϊόν/συσκευή', 'danger'); return; }
  if (!fault) { toast('Συμπλήρωσε περιγραφή βλάβης', 'danger'); return; }

  var pid = (prodEl && prodEl.dataset && prodEl.dataset.pid) ? +prodEl.dataset.pid : null;
  var lk = _RMA_LOOKUP || {};
  // Ακριβή ονόματα στηλών zn_rma — rma_number/warranty_valid/shop_id/created_by τα βάζει το trigger
  var payload = {
    product_id: pid,
    product_name: product,
    serial_number: (document.getElementById('rma_serial').value || '').trim() || null,
    customer_id: (lk.customerId != null) ? lk.customerId : null,
    customer_name: (document.getElementById('rma_cust').value || '').trim() || null,
    customer_phone: (document.getElementById('rma_phone').value || '').trim() || null,
    sale_id: (lk.saleId != null) ? lk.saleId : null,
    purchase_date: document.getElementById('rma_pdate').value || null,
    warranty_months: parseInt(document.getElementById('rma_wmonths').value, 10) || 0,
    supplier_id: (lk.supplierId != null) ? lk.supplierId : null,
    supplier_name: (document.getElementById('rma_supplier').value || '').trim() || null,
    issue_description: fault,
    notes: null,
    status: 'received'
  };

  try {
    if (typeof sbAuth === 'undefined' || !sbAuth.from) { throw new Error('Μη διαθέσιμη σύνδεση'); }
    var res = await sbAuth.from('zn_rma').insert(payload).select().single();
    if (res && res.error) { throw new Error(res.error.message || 'Σφάλμα'); }
    if (res && res.data) { RMA_CACHE.unshift(res.data); }
    closeModal();
    toast('✅ RMA δημιουργήθηκε: ' + _rmaNumber(res.data || {}), 'success');
    if (window.CURRENT_PAGE_ID === 'rma') { _renderRMAPage(); }
  } catch (err) {
    toast('Σφάλμα: ' + (err.message || err), 'danger');
  }
}

/* ---------- Ετικέτα (κοινός builder) ---------- */
function znPrintRmaLabel(id) {
  var r = RMA_CACHE.find(function (x) { return String(_rf(x, ['id'])) === String(id); });
  if (!r) { toast('Δεν βρέθηκε το RMA', 'warning'); return; }
  if (typeof znOpenPrintDoc !== 'function') { toast('Ο εκτυπωτής δεν είναι διαθέσιμος', 'warning'); return; }
  var s = (typeof getSettings === 'function') ? getSettings() : {};
  var num = _rmaNumber(r);
  var wv = _rf(r, ['warranty_valid']);
  var warrantyText = (wv === true || wv === 't' || wv === 1) ? 'Ισχύει'
    : (wv === false || wv === 'f' || wv === 0) ? 'Έληξε' : '';
  var R = {
    kind: 'rma',
    title: 'RMA / ΕΠΙΣΚΕΥΗ',
    number: num,
    logo: (typeof getCustomLogo === 'function') ? (getCustomLogo() || '') : '',
    barcodeUrl: _rmaBarcodeUrl(num),
    shopName: s.shopName || 'ZyroNex',
    shopAddr: s.addr || s.address || '', shopCity: s.city || '',
    shopAfm: s.afm || '', shopDoy: s.doy || '', shopPhone: s.phone || '', shopEmail: s.email || '',
    product: _rf(r, ['product_name', 'device_name']) || '—',
    serial: _rf(r, ['serial_number', 'serial']),
    client: { name: _rf(r, ['customer_name']), phone: _rf(r, ['customer_phone']) },
    date: _rmaDate(_rf(r, ['created_at', 'created'])),
    statusLabel: _rmaStatusMeta(_rf(r, ['status'])).label,
    warrantyText: warrantyText,
    supplier: _rf(r, ['supplier_name']),
    fault: _rf(r, ['issue_description'])
  };
  znOpenPrintDoc(R);
}

/* ---------- Λεπτομέρεια + κατάσταση + ιστορικό ---------- */
async function openRMADetail(id) {
  var r = RMA_CACHE.find(function (x) { return String(_rf(x, ['id'])) === String(id); });
  if (!r) { toast('Δεν βρέθηκε το RMA', 'warning'); return; }
  var num = _rmaNumber(r);
  var curStatus = _rf(r, ['status']);
  var hasSupplier = !!(_rf(r, ['supplier_name']) || _rf(r, ['supplier_id']));
  openModal('<div class="modal-head">' +
    '<h3 class="fw-800 text-xl">🔧 ' + _rmaEsc(num) + '</h3>' +
    '<button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button>' +
  '</div>' +
  '<div class="modal-body">' +
    '<div class="card" style="padding:12px;margin-bottom:12px">' +
      '<div style="font-weight:800;font-size:15px">' + _rmaEsc(_rf(r, ['product_name', 'device_name']) || '—') + '</div>' +
      '<div class="text-xs" style="color:var(--text-2);margin-top:4px">' +
        (_rf(r, ['serial_number', 'serial']) ? ('SN: ' + _rmaEsc(_rf(r, ['serial_number', 'serial'])) + '<br>') : '') +
        (_rf(r, ['customer_name']) ? ('👤 ' + _rmaEsc(_rf(r, ['customer_name'])) + (_rf(r, ['customer_phone']) ? (' · ' + _rmaEsc(_rf(r, ['customer_phone']))) : '') + '<br>') : '') +
        '📅 ' + _rmaDate(_rf(r, ['created_at', 'created'])) +
      '</div>' +
      (_rf(r, ['issue_description']) ? ('<div class="text-sm" style="margin-top:8px"><b>Βλάβη:</b> ' + _rmaEsc(_rf(r, ['issue_description'])) + '</div>') : '') +
    '</div>' +
    '<div class="form-row">' +
      '<label class="form-label">Κατάσταση</label>' +
      '<select class="form-select" id="rma_status_sel" style="min-height:44px">' +
        ZN_RMA_STATUSES.map(function (st) { return '<option value="' + st.id + '"' + (st.id === curStatus ? ' selected' : '') + '>' + _rmaEsc(st.label) + '</option>'; }).join('') +
      '</select>' +
    '</div>' +
    '<div class="form-row"><label class="form-label">Σημείωση (προαιρετικά)</label>' +
      '<input class="form-input" id="rma_status_note" placeholder="π.χ. στάλθηκε με courier" style="min-height:44px"></div>' +
    '<div class="flex gap-2" style="flex-wrap:wrap">' +
      '<button class="btn btn-primary" onclick="rmaSetStatus(\'' + _rmaEsc(id) + '\')"><i data-lucide="check" size="16"></i> Αλλαγή κατάστασης</button>' +
      '<button class="btn btn-ghost" onclick="znPrintRmaLabel(\'' + _rmaEsc(id) + '\')"><i data-lucide="tag" size="16"></i> Ετικέτα</button>' +
      (hasSupplier ? ('<button class="btn btn-ghost" onclick="rmaSupplierClaim(\'' + _rmaEsc(id) + '\')"><i data-lucide="mail" size="16"></i> 📧 Claim προμηθευτή</button>') : '') +
    '</div>' +
    '<div class="section-title" style="font-size:13px;margin:16px 0 8px">📜 Ιστορικό</div>' +
    '<div id="rma_events"><div class="muted text-sm">Φόρτωση...</div></div>' +
  '</div>');
  if (typeof lucide !== 'undefined' && lucide.createIcons) { lucide.createIcons(); }
  _loadRMAEvents(id);
}

async function _loadRMAEvents(id) {
  var el = document.getElementById('rma_events');
  if (!el) { return; }
  try {
    var res = await sbAuth.from('zn_rma_events').select('*').eq('rma_id', id).order('created_at', { ascending: false }).limit(100);
    if (res && res.error) { throw new Error(res.error.message); }
    var rows = (res && res.data) ? res.data : [];
    if (!rows.length) { el.innerHTML = '<div class="muted text-sm">Καμία καταχώρηση ακόμη.</div>'; return; }
    el.innerHTML = rows.map(function (ev) {
      var st = _rf(ev, ['status']);
      var note = _rf(ev, ['note']);
      return '<div style="display:flex;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">' +
        '<div style="flex:1;min-width:0">' + _rmaStatusBadge(st) +
          (note ? ('<div class="text-xs" style="margin-top:4px">' + _rmaEsc(note) + '</div>') : '') +
        '</div>' +
        '<div class="text-xs muted" style="white-space:nowrap">' + _rmaDate(_rf(ev, ['created_at', 'created'])) + '</div>' +
      '</div>';
    }).join('');
  } catch (e) {
    el.innerHTML = '<div class="muted text-sm">Δεν φορτώθηκε το ιστορικό: ' + _rmaEsc(e.message || String(e)) + '</div>';
  }
}

async function rmaSetStatus(id) {
  var sel = document.getElementById('rma_status_sel');
  var noteEl = document.getElementById('rma_status_note');
  if (!sel) { return; }
  var status = sel.value;
  var note = noteEl ? (noteEl.value || '').trim() : '';
  try {
    if (typeof sbAuth === 'undefined' || !sbAuth.rpc) { throw new Error('Μη διαθέσιμη σύνδεση'); }
    var res = await sbAuth.rpc('zn_rma_set_status', { p_rma: id, p_status: status, p_note: note || null });
    if (res && res.error) { throw new Error(res.error.message || 'Σφάλμα'); }
    // ενημέρωσε cache
    var r = RMA_CACHE.find(function (x) { return String(_rf(x, ['id'])) === String(id); });
    if (r) { r.status = status; }
    toast('✅ Κατάσταση: ' + _rmaStatusMeta(status).label, 'success');
    if (noteEl) { noteEl.value = ''; }
    _loadRMAEvents(id);
    if (window.CURRENT_PAGE_ID === 'rma') { _renderRMAList(); }
  } catch (err) {
    toast('Σφάλμα: ' + (err.message || err), 'danger');
  }
}

/* ---------- (προαιρετικό) Claim προμηθευτή via email Edge Function ---------- */
function _rmaIsEmail(v) {
  return (typeof v === 'string') && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

/* Ανάλυση email προμηθευτή: από SUPPLIERS cache (supplier_id) → DB → '' */
async function _rmaResolveSupplierEmail(r) {
  var supplierId = _rf(r, ['supplier_id']);
  // 1) Τοπικό cache SUPPLIERS
  try {
    if (supplierId && typeof SUPPLIERS !== 'undefined' && SUPPLIERS && SUPPLIERS.length) {
      var sc = SUPPLIERS.find(function (x) { return String(x.id) === String(supplierId); });
      if (sc && sc.email) { return String(sc.email).trim(); }
    }
  } catch (e) {}
  // 2) DB (sbAuth) — στήλη email του suppliers
  try {
    if (supplierId && typeof sbAuth !== 'undefined' && sbAuth.from) {
      var res = await sbAuth.from('suppliers').select('email').eq('id', supplierId).limit(1);
      if (res && !res.error && res.data && res.data.length && res.data[0].email) {
        return String(res.data[0].email).trim();
      }
    }
  } catch (e2) {}
  return '';
}

async function rmaSupplierClaim(id) {
  var r = RMA_CACHE.find(function (x) { return String(_rf(x, ['id'])) === String(id); });
  if (!r) { return; }
  if (typeof sendEmail !== 'function') { toast('Email μη διαθέσιμο', 'warning'); return; }

  // 5) Χωρίς προμηθευτή → μην προχωράς
  var supplierName = _rf(r, ['supplier_name']);
  var supplierId = _rf(r, ['supplier_id']);
  if (!supplierName && !supplierId) { toast('Δεν έχει οριστεί προμηθευτής σε αυτό το RMA', 'warning'); return; }

  // 2/3) Ανάλυση email (prefill) — αν δεν υπάρχει, ζήτα το χειροκίνητα
  var prefill = await _rmaResolveSupplierEmail(r);
  var label = 'Email προμηθευτή' + (supplierName ? (' (' + supplierName + ')') : '') + ':';
  var to = prompt(label, prefill || '');
  if (to === null) { return; } // άκυρο

  // 4) Το to πρέπει να είναι πάντα έγκυρο string
  to = (typeof to === 'string') ? to.trim() : '';
  if (!_rmaIsEmail(to)) { toast('Λείπει έγκυρο email προμηθευτή', 'warning'); return; }

  var num = _rmaNumber(r);
  var s = (typeof getSettings === 'function') ? getSettings() : {};
  var bodyHtml = '<h2>Αίτημα RMA ' + _rmaEsc(num) + '</h2>' +
    '<p><b>Προϊόν:</b> ' + _rmaEsc(_rf(r, ['product_name', 'device_name']) || '—') + '</p>' +
    '<p><b>Serial:</b> ' + _rmaEsc(_rf(r, ['serial_number', 'serial']) || '—') + '</p>' +
    '<p><b>Ημ/νία αγοράς:</b> ' + _rmaDate(_rf(r, ['purchase_date'])) + '</p>' +
    '<p><b>Περιγραφή βλάβης:</b> ' + _rmaEsc(_rf(r, ['issue_description']) || '—') + '</p>' +
    '<p>Παρακαλούμε για τις ενέργειές σας.</p><p>— ' + _rmaEsc(s.shopName || 'ZyroNex') + '</p>';
  var html = (typeof buildEmailTemplate === 'function')
    ? buildEmailTemplate('RMA ' + num, bodyHtml, '')
    : bodyHtml;
  try {
    await sendEmail({ to: to, subject: 'RMA ' + num + ' — ' + (s.shopName || 'ZyroNex'), html: html, text: 'RMA ' + num });
    toast('📧 Claim στάλθηκε στον προμηθευτή (' + to + ')', 'success');
  } catch (e) {
    toast('Σφάλμα αποστολής: ' + (e.message || e), 'danger');
  }
}

if (typeof window !== 'undefined') {
  window.renderRMA = renderRMA;
  window.openNewRMA = openNewRMA;
  window.rmaLookup = rmaLookup;
  window.saveRMA = saveRMA;
  window.znPrintRmaLabel = znPrintRmaLabel;
  window.openRMADetail = openRMADetail;
  window.rmaSetStatus = rmaSetStatus;
  window.rmaSupplierClaim = rmaSupplierClaim;
  window._renderRMAPage = _renderRMAPage;
}
