/* =====================================================================
 * ZyroNex · WebUSB ESC/POS εκτύπωση (additive, capability-detected)
 * Πραγματική εκτύπωση απόδειξης + άνοιγμα συρταριού σε θερμικούς
 * εκτυπωτές μέσω WebUSB. Fallback παντού σε «Browser Print».
 *
 * Κανόνες: var, mobile-first, ΠΟΤΕ δεν μπλοκάρει την πώληση.
 * WebUSB: Chrome desktop + Android. iOS/Safari → Browser Print.
 * ===================================================================== */

/* Registry εκτυπωτών — κάθε profile: { label, protocol, width, chars }. */
var ZN_PRINTERS = {
  browser:        { label: 'Browser Print (default)',          protocol: 'browser',     width: 80, chars: 48 },
  generic80:      { label: 'Generic 80mm',                      protocol: 'escpos',      width: 80, chars: 48 },
  generic58:      { label: 'Generic 58mm',                      protocol: 'escpos',      width: 58, chars: 32 },
  epson_tmt20iii: { label: 'EPSON TM-T20III (80mm)',            protocol: 'escpos',      width: 80, chars: 48 },
  epson_tmt88:    { label: 'EPSON TM-T88VI/VII (80mm)',         protocol: 'escpos',      width: 80, chars: 48 },
  epson_tmm30:    { label: 'EPSON TM-m30/m30II (80mm)',         protocol: 'escpos',      width: 80, chars: 48 },
  xprinter_xp80:  { label: 'Xprinter XP-80 (80mm)',             protocol: 'escpos',      width: 80, chars: 48 },
  xprinter_xp58:  { label: 'Xprinter XP-58 (58mm)',             protocol: 'escpos',      width: 58, chars: 32 },
  rongta_rp80:    { label: 'Rongta RP80 (80mm)',                protocol: 'escpos',      width: 80, chars: 48 },
  rongta_rp58:    { label: 'Rongta RP58 (58mm)',                protocol: 'escpos',      width: 58, chars: 32 },
  bixolon_srp350: { label: 'Bixolon SRP-350III (80mm)',         protocol: 'escpos',      width: 80, chars: 48 },
  citizen_cte351: { label: 'Citizen CT-E351 (80mm)',            protocol: 'escpos',      width: 80, chars: 48 },
  star_tsp143:    { label: 'Star TSP143 (80mm)',                protocol: 'star_raster', width: 80, chars: 48 },
  star_tsp654:    { label: 'Star TSP654II / mC-Print3 (80mm)',  protocol: 'star_line',   width: 80, chars: 48 }
};

/* Legacy aliases — παλιές αποθηκευμένες τιμές dropdown. */
var _ZN_PRINTER_ALIASES = { epson: 'epson_tmt20iii', star: 'star_tsp143' };

var ZN_ESCPOS = (function () {
  'use strict';

  var ESC = 0x1B, GS = 0x1D;
  var _device = null;
  var _ifaceNum = null;
  var _epOut = null;

  /* ---------- Capability ---------- */
  function available() {
    return (typeof navigator !== 'undefined') && ('usb' in navigator);
  }

  /* ---------- Profiles ---------- */
  function getProfileKey(key) {
    if (!key) { return 'browser'; }
    if (ZN_PRINTERS[key]) { return key; }
    if (_ZN_PRINTER_ALIASES[key]) { return _ZN_PRINTER_ALIASES[key]; }
    return 'browser';
  }
  function getProfile(key) { return ZN_PRINTERS[getProfileKey(key)]; }
  function currentProfile() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem('katastimaSettings') || '{}'); } catch (e) {}
    return getProfile(s.printer);
  }

  function isConnected() { return !!_device; }
  function deviceName() {
    if (!_device) { return ''; }
    return _device.productName || _device.manufacturerName ||
      ('USB ' + (_device.vendorId || '')) || 'Εκτυπωτής';
  }

  /* ---------- Greek encoder (CP737) ---------- */
  /* Θερμικοί εκτυπωτές: επιλογή code page PC737 (Greek) με ESC t 14. */
  var _GR = (function () {
    var m = {};
    var up = 'ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ';     // 0x80..0x97
    var i;
    for (i = 0; i < up.length; i++) { m[up[i]] = 0x80 + i; }
    var lo = 'αβγδεζηθικλμνξοπρσςτυφχψ';      // 0x98..0xAF (περιλ. ς)
    for (i = 0; i < lo.length; i++) { m[lo[i]] = 0x98 + i; }
    m['ω'] = 0xE0;
    var acc = 'άέήϊίόύϋώΆΈΉΊΌΎΏ';             // 0xE1..0xEF, Ώ=0xF0
    for (i = 0; i < acc.length; i++) { m[acc[i]] = 0xE1 + i; }
    return m;
  })();

  function _encodeText(str) {
    str = String(str == null ? '' : str);
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var ch = str[i];
      var code = str.charCodeAt(i);
      if (code < 0x80) { out.push(code); continue; }
      if (ch === '€') { out.push(0x45, 0x55, 0x52); continue; } // EUR
      var b = _GR[ch];
      out.push(b !== undefined ? b : 0x3F); // '?'
    }
    return out;
  }

  function _repeat(ch, n) {
    var s = '';
    for (var i = 0; i < n; i++) { s += ch; }
    return s;
  }
  function _padLine(left, right, width) {
    left = String(left); right = String(right);
    var space = width - left.length - right.length;
    if (space < 1) { space = 1; }
    return left + _repeat(' ', space) + right;
  }

  /* ---------- ESC/POS builder ---------- */
  function buildReceiptBytes(profile, data, logoBytes) {
    var chars = (profile && profile.chars) || 48;
    var b = [];
    function raw(arr) { for (var i = 0; i < arr.length; i++) { b.push(arr[i]); } }
    function txt(s) { raw(_encodeText(s)); }
    function nl(n) { n = n || 1; for (var i = 0; i < n; i++) { b.push(0x0A); } }

    raw([ESC, 0x40]);            // init
    raw([ESC, 0x74, 0x0E]);      // code page PC737 (Greek)

    /* Logo (rasterized, native DPI) — αν υπάρχει */
    if (logoBytes && logoBytes.length) { raw(logoBytes); }

    /* Header — center + bold + double */
    raw([ESC, 0x61, 0x01]);      // center
    raw([ESC, 0x45, 0x01]);      // bold on
    raw([GS, 0x21, 0x11]);       // double width + height
    txt(data.shopName || 'ZyroNex'); nl();
    raw([GS, 0x21, 0x00]);       // normal size
    raw([ESC, 0x45, 0x00]);      // bold off
    if (data.address) { txt(data.address); nl(); }
    if (data.phone)   { txt('Τηλ: ' + data.phone); nl(); }
    if (data.afm)     { txt('ΑΦΜ: ' + data.afm); nl(); }

    raw([ESC, 0x61, 0x00]);      // left
    txt(_repeat('-', chars)); nl();

    /* Title */
    raw([ESC, 0x61, 0x01]); raw([ESC, 0x45, 0x01]);
    txt(data.title || 'ΑΠΟΔΕΙΞΗ'); nl();
    raw([ESC, 0x45, 0x00]); raw([ESC, 0x61, 0x00]);
    if (data.saleId)   { txt('Αρ: ' + data.saleId); nl(); }
    if (data.datetime) { txt(data.datetime); nl(); }
    txt(_repeat('-', chars)); nl();

    /* Items */
    var items = data.items || [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var name = String(it.name || '');
      var qty = (it.qty != null) ? it.qty : ((it.quantity != null) ? it.quantity : 1);
      var price = Number(it.price != null ? it.price : (it.unit_price != null ? it.unit_price : 0));
      var lineTotal = qty * price;
      txt(name); nl();
      txt(_padLine('  ' + qty + ' x ' + price.toFixed(2), lineTotal.toFixed(2), chars)); nl();
    }
    txt(_repeat('-', chars)); nl();

    /* Total — bold + double (στήλη μισή λόγω double width) */
    raw([ESC, 0x61, 0x00]);
    raw([ESC, 0x45, 0x01]); raw([GS, 0x21, 0x11]);
    txt(_padLine('ΣΥΝΟΛΟ', Number(data.total || 0).toFixed(2) + ' EUR', Math.floor(chars / 2)));
    nl();
    raw([GS, 0x21, 0x00]); raw([ESC, 0x45, 0x00]);
    nl();

    /* Footer */
    raw([ESC, 0x61, 0x01]);
    txt(data.footer || 'Ευχαριστούμε!'); nl();

    /* ZyroNex software branding (όχι στοιχεία παρόχου) */
    txt(_repeat('-', chars)); nl();
    txt('ZyroNex POS'); nl();
    txt('Δημιουργήθηκε με το ZyroNex POS System'); nl();
    raw([ESC, 0x61, 0x00]);

    nl(4);                       // feed
    raw([GS, 0x56, 0x42, 0x00]); // cut (partial με feed)
    return new Uint8Array(b);
  }

  function _drawerBytes() {
    return new Uint8Array([ESC, 0x70, 0x00, 0x19, 0xFA]); // drawer kick
  }

  /* ---------- Logo raster (native DPI ~203) ---------- */
  /* Rasterize logo σε GS v 0 bit-image, centered, στο native dot-width
     του εκτυπωτή (58mm=384, 80mm=576). Floyd-Steinberg για ευκρίνεια.
     Επιστρέφει Array bytes ή null (ποτέ throw). */
  function _rasterizeLogo(url, maxDots) {
    return new Promise(function (resolve) {
      if (!url || typeof document === 'undefined') { resolve(null); return; }
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () {
        try {
          var ratio = img.width / img.height;
          var w = Math.min(img.width, maxDots);
          var h = Math.round(w / ratio);
          if (h > 240) { h = 240; w = Math.round(h * ratio); }
          w = Math.floor(w / 8) * 8;                 // width πολλαπλάσιο του 8
          if (w < 8) { resolve(null); return; }
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          var cx = cv.getContext('2d');
          cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h);
          cx.drawImage(img, 0, 0, w, h);
          var d = cx.getImageData(0, 0, w, h).data;
          var gray = new Float32Array(w * h);
          var i;
          for (i = 0; i < w * h; i++) {
            gray[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
          }
          var mono = new Uint8Array(w * h); // 1 = μαύρο
          for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
              var idx = y * w + x;
              var old = gray[idx];
              var nw = old < 128 ? 0 : 255;
              mono[idx] = nw === 0 ? 1 : 0;
              var err = old - nw;
              if (x + 1 < w) { gray[idx + 1] += err * 7 / 16; }
              if (y + 1 < h) {
                if (x > 0) { gray[idx + w - 1] += err * 3 / 16; }
                gray[idx + w] += err * 5 / 16;
                if (x + 1 < w) { gray[idx + w + 1] += err * 1 / 16; }
              }
            }
          }
          var bytesPerRow = w / 8;
          var out = [ESC, 0x61, 0x01];               // center
          out.push(GS, 0x76, 0x30, 0x00,
            bytesPerRow & 0xFF, (bytesPerRow >> 8) & 0xFF,
            h & 0xFF, (h >> 8) & 0xFF);
          for (var ry = 0; ry < h; ry++) {
            for (var bx = 0; bx < bytesPerRow; bx++) {
              var bits = 0;
              for (var bit = 0; bit < 8; bit++) {
                var px = bx * 8 + bit;
                if (px < w && mono[ry * w + px]) { bits |= (0x80 >> bit); }
              }
              out.push(bits);
            }
          }
          out.push(0x0A);                            // feed
          out.push(ESC, 0x61, 0x00);                 // left
          resolve(out);
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  }

  /* ---------- WebUSB σύνδεση ---------- */
  function _findOutEndpoint(dev) {
    var cfg = dev.configuration;
    if (!cfg) { return null; }
    for (var i = 0; i < cfg.interfaces.length; i++) {
      var iface = cfg.interfaces[i];
      for (var a = 0; a < iface.alternates.length; a++) {
        var alt = iface.alternates[a];
        for (var e = 0; e < alt.endpoints.length; e++) {
          var ep = alt.endpoints[e];
          if (ep.direction === 'out' && (ep.type === 'bulk' || ep.type === 'interrupt')) {
            return { ifaceNum: iface.interfaceNumber, epNum: ep.endpointNumber };
          }
        }
      }
    }
    return null;
  }

  async function connect() {
    if (!available()) { throw new Error('WebUSB μη διαθέσιμο'); }
    var dev = null;
    var granted = await navigator.usb.getDevices();      // ήδη granted
    if (granted && granted.length) { dev = granted[0]; }
    if (!dev) { dev = await navigator.usb.requestDevice({ filters: [] }); }
    if (!dev) { throw new Error('Δεν επιλέχθηκε συσκευή'); }
    await dev.open();
    if (dev.configuration === null) { await dev.selectConfiguration(1); }
    var out = _findOutEndpoint(dev);
    if (!out) { throw new Error('Δεν βρέθηκε OUT endpoint'); }
    await dev.claimInterface(out.ifaceNum);
    _device = dev; _ifaceNum = out.ifaceNum; _epOut = out.epNum;
    return dev;
  }

  function disconnect() {
    if (_device) { try { _device.close(); } catch (e) {} }
    _device = null; _ifaceNum = null; _epOut = null;
  }

  async function _send(bytes) {
    if (!_device) { await connect(); }
    await _device.transferOut(_epOut, bytes);
  }

  /* ---------- Print API ---------- */
  /* Επιστρέφει true αν τυπώθηκε με ESC/POS, false αν χρειάζεται Browser Print. */
  async function printReceipt(data) {
    var profile = currentProfile();
    if (profile.protocol === 'browser') { return false; }
    if (profile.protocol === 'star_raster') {
      if (typeof toast === 'function') {
        toast('Ο Star TSP143 χρειάζεται raster — προσωρινά Browser Print', 'warning');
      }
      return false;
    }
    /* escpos + star_line (emulation) → ESC/POS path */
    /* Logo rasterized στο native dot-width (58mm=384, 80mm=576) */
    var logoBytes = null;
    try {
      var _logoUrl = (typeof getCustomLogo === 'function') ? getCustomLogo()
        : ((typeof window !== 'undefined' && window.getCustomLogo) ? window.getCustomLogo() : null);
      if (_logoUrl) {
        var dots = (profile.chars === 32) ? 384 : 576;
        logoBytes = await _rasterizeLogo(_logoUrl, dots);
      }
    } catch (e) { logoBytes = null; }
    var bytes = buildReceiptBytes(profile, data, logoBytes);
    await _send(bytes);
    return true;
  }

  async function openDrawer() {
    var profile = currentProfile();
    if (profile.protocol === 'browser' || profile.protocol === 'star_raster') { return false; }
    await _send(_drawerBytes());
    return true;
  }

  /* ---------- UI helpers ---------- */
  function optionsHTML(selectedKey) {
    var cur = getProfileKey(selectedKey);
    var html = '';
    for (var k in ZN_PRINTERS) {
      if (!ZN_PRINTERS.hasOwnProperty(k)) { continue; }
      html += '<option value="' + k + '"' + (k === cur ? ' selected' : '') + '>' +
        ZN_PRINTERS[k].label + '</option>';
    }
    return html;
  }

  function syncControls() {
    var connectBtn = document.getElementById('znEscposConnect');
    var testBtn = document.getElementById('znEscposTest');
    var status = document.getElementById('znEscposStatus');
    var profile = currentProfile();
    var show = available() && profile.protocol !== 'browser';
    if (connectBtn) { connectBtn.style.display = show ? '' : 'none'; }
    if (testBtn) { testBtn.style.display = show ? '' : 'none'; }
    if (status) {
      if (!available()) {
        status.textContent = 'WebUSB μη διαθέσιμο σε αυτή τη συσκευή — χρήση Browser Print.';
      } else if (profile.protocol === 'browser') {
        status.textContent = '';
      } else if (profile.protocol === 'star_raster') {
        status.textContent = 'Ο Star TSP143 (raster) χρησιμοποιεί προσωρινά Browser Print.';
      } else if (isConnected()) {
        status.textContent = 'Συνδεδεμένος: ' + deviceName();
      } else {
        status.textContent = 'Μη συνδεδεμένος — πάτα «🔌 Σύνδεση εκτυπωτή».';
      }
    }
  }

  async function connectUI() {
    if (!available()) {
      if (typeof toast === 'function') {
        toast('Το WebUSB δεν υποστηρίζεται εδώ (π.χ. iOS) — χρήση Browser Print', 'info');
      }
      return;
    }
    try {
      await connect();
      if (typeof toast === 'function') { toast('🔌 Συνδέθηκε: ' + deviceName(), 'success'); }
    } catch (e) {
      if (typeof toast === 'function') {
        toast('Σφάλμα σύνδεσης: ' + (e.message || e) + ' — Browser Print', 'warning');
      }
    }
    syncControls();
  }

  async function testPrintUI() {
    var profile = currentProfile();
    if (profile.protocol === 'browser') {
      if (typeof toast === 'function') { toast('Επίλεξε πρώτα εκτυπωτή ESC/POS από τη λίστα', 'info'); }
      return;
    }
    if (!available()) {
      if (typeof toast === 'function') { toast('WebUSB μη διαθέσιμο — Browser Print', 'info'); }
      return;
    }
    if (profile.protocol === 'star_raster') {
      if (typeof toast === 'function') { toast('Star TSP143 (raster) — δοκίμασε Browser Print', 'warning'); }
      return;
    }
    try {
      var data = {
        shopName: 'ZyroNex',
        title: 'ΔΟΚΙΜΑΣΤΙΚΗ ΑΠΟΔΕΙΞΗ',
        saleId: 'TEST',
        datetime: new Date().toLocaleString('el-GR'),
        items: [{ name: 'Δοκιμαστικό προϊόν', qty: 1, price: 1.00 }],
        total: 1.00,
        footer: 'Δοκιμή εκτυπωτή ✓'
      };
      await printReceipt(data);
      await openDrawer();
      if (typeof toast === 'function') { toast('🧾 Δοκιμαστική εκτύπωση + άνοιγμα συρταριού', 'success'); }
    } catch (e) {
      if (typeof toast === 'function') {
        toast('Σφάλμα εκτύπωσης: ' + (e.message || e) + ' — Browser Print', 'warning');
      }
    }
    syncControls();
  }

  return {
    available: available,
    getProfile: getProfile, getProfileKey: getProfileKey, currentProfile: currentProfile,
    isConnected: isConnected, deviceName: deviceName,
    connect: connect, disconnect: disconnect,
    buildReceiptBytes: buildReceiptBytes,
    printReceipt: printReceipt, openDrawer: openDrawer,
    optionsHTML: optionsHTML, syncControls: syncControls,
    connectUI: connectUI, testPrintUI: testPrintUI
  };
})();

if (typeof window !== 'undefined') {
  window.ZN_PRINTERS = ZN_PRINTERS;
  window.ZN_ESCPOS = ZN_ESCPOS;
}
