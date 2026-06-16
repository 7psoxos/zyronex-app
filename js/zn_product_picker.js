/* =====================================================================
 * ZyroNex · Product Picker (ZN_PICKER)
 * Επαναχρησιμοποιήσιμο floating picker με live αναζήτηση + barcode.
 *
 * API:
 *   ZN_PICKER.open(triggerEl, { onSelect: fn(product) })
 *   ZN_PICKER.close()
 *
 * Αναζήτηση: substring στο name (case-insensitive) + prefix/exact στο barcode.
 * Auto-select σε ακριβές barcode match (για σαρωτές που κάνουν type+Enter).
 * ===================================================================== */
var ZN_PICKER = (function () {
  'use strict';

  var _host = null;
  var _onSelect = null;
  var _triggerEl = null;

  function _prods() {
    return typeof PRODUCTS !== 'undefined' ? PRODUCTS : [];
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function _buildHost() {
    var h = document.createElement('div');
    h.id = 'znPickerHost';
    h.style.cssText =
      'display:none;position:fixed;z-index:10000;'
      + 'background:var(--bg-0,#1a1a2e);'
      + 'border:1px solid var(--border,rgba(255,255,255,0.12));'
      + 'border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.55);'
      + 'width:320px;max-width:calc(100vw - 24px);'
      + 'overflow:hidden;box-sizing:border-box';
    h.innerHTML =
      '<div style="padding:10px 10px 0">'
      + '<input id="znPickerSearch" type="text" autocomplete="off" inputmode="search"'
      + ' placeholder="🔍 Αναζήτηση ή barcode"'
      + ' style="width:100%;font-size:16px;min-height:44px;padding:0 12px;'
      + 'border:1px solid var(--border,rgba(255,255,255,0.15));border-radius:8px;'
      + 'background:var(--bg-1,#12121e);color:var(--text-0,#fff);'
      + 'box-sizing:border-box;-webkit-appearance:none;outline:none">'
      + '</div>'
      + '<ul id="znPickerList" style="list-style:none;margin:8px 0 0;padding:0;'
      + 'max-height:280px;overflow-y:auto;-webkit-overflow-scrolling:touch"></ul>';

    document.body.appendChild(h);

    var inp = h.querySelector('#znPickerSearch');
    inp.addEventListener('input', function () { _render(this.value); });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var first = h.querySelector('#znPickerList li[data-pid]');
        if (first) { _pick({ id: first.dataset.pid, name: first.dataset.name, barcode: first.dataset.barcode }); }
      }
      if (e.key === 'Escape') { close(); }
    });

    // Κλείσιμο αν κλικ έξω από το picker και εκτός trigger
    document.addEventListener('mousedown', function (e) {
      if (!_host || _host.style.display === 'none') { return; }
      if (!_host.contains(e.target)
          && e.target !== _triggerEl
          && !(_triggerEl && _triggerEl.contains(e.target))) {
        close();
      }
    }, true);

    // Επαναθέτηση position σε scroll (π.χ. modal scroll)
    document.addEventListener('scroll', function () {
      if (_host && _host.style.display !== 'none') { _position(); }
    }, true);

    return h;
  }

  function _render(q) {
    var all = _prods();
    var q2 = (q || '').trim().toLowerCase();
    var list = document.getElementById('znPickerList');
    if (!list) { return; }

    // Ακριβές barcode match → auto-select αμέσως
    if (q2) {
      for (var j = 0; j < all.length; j++) {
        if (String(all[j].barcode || '').toLowerCase() === q2) {
          _pick(all[j]);
          return;
        }
      }
    }

    var filtered = q2
      ? all.filter(function (p) {
          return p.name.toLowerCase().indexOf(q2) !== -1
              || String(p.barcode || '').toLowerCase().indexOf(q2) === 0;
        })
      : all;

    var shown = filtered.slice(0, 60);

    if (!shown.length) {
      list.innerHTML = '<li style="padding:14px 16px;color:var(--text-2,#888);font-size:14px">'
        + 'Κανένα αποτέλεσμα</li>';
      return;
    }

    list.innerHTML = shown.map(function (p) {
      return '<li data-pid="' + p.id + '" data-name="' + _esc(p.name) + '"'
        + ' data-barcode="' + _esc(p.barcode || '') + '"'
        + ' style="padding:10px 16px;cursor:pointer;'
        + 'border-bottom:1px solid var(--border,rgba(255,255,255,0.06));'
        + 'display:flex;flex-direction:column;gap:2px;'
        + 'min-height:44px;justify-content:center;'
        + '-webkit-tap-highlight-color:transparent">'
        + '<span style="font-size:14px;font-weight:600;word-break:break-word">'
        + _esc(p.name) + '</span>'
        + (p.barcode
           ? '<span style="font-size:11px;color:var(--text-2,#888)">' + _esc(p.barcode) + '</span>'
           : '')
        + '</li>';
    }).join('');

    var items = list.querySelectorAll('li[data-pid]');
    for (var i = 0; i < items.length; i++) {
      (function (li) {
        li.addEventListener('click', function () {
          _pick({ id: li.dataset.pid, name: li.dataset.name, barcode: li.dataset.barcode });
        });
        li.addEventListener('mouseover', function () {
          li.style.background = 'var(--bg-2,rgba(255,255,255,0.07))';
        });
        li.addEventListener('mouseout', function () {
          li.style.background = '';
        });
      })(items[i]);
    }
  }

  function _position() {
    if (!_triggerEl || !_host) { return; }
    var rect = _triggerEl.getBoundingClientRect();
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var vw = window.innerWidth  || document.documentElement.clientWidth;
    var pickerH = 370;
    var top = (rect.bottom + pickerH + 8 <= vh)
      ? rect.bottom + 4
      : Math.max(8, rect.top - pickerH - 4);
    var w    = Math.max(280, rect.width);
    var left = Math.min(Math.max(8, rect.left), vw - w - 8);
    _host.style.top   = top + 'px';
    _host.style.left  = left + 'px';
    _host.style.width = w + 'px';
  }

  function open(triggerEl, opts) {
    _triggerEl = triggerEl;
    _onSelect  = (opts && opts.onSelect) || null;
    if (!_host) { _host = _buildHost(); }
    var inp = document.getElementById('znPickerSearch');
    if (inp) { inp.value = ''; }
    _render('');
    _host.style.display = 'block';
    _position();
    if (inp) { setTimeout(function () { inp.focus(); }, 40); }
  }

  function close() {
    if (_host) { _host.style.display = 'none'; }
    _onSelect  = null;
    _triggerEl = null;
  }

  function _pick(p) {
    var cb = _onSelect;
    close();
    if (cb) { cb(p); }
  }

  return { open: open, close: close };
})();
