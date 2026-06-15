/* =====================================================================
 * ZyroNex · Task 3 — ModuleLoader (Lazy Loading, Vanilla JS)
 * Φορτώνει βαριά modules (Customer Intel, Campaigns, Site Builder, Pulse)
 * ΜΟΝΟ όταν ο χρήστης πάει στη σελίδα τους — όχι στο αρχικό boot του POS.
 *
 * Κανόνες ZyroNex:
 *  - var παντού (Safari TDZ-safe). Καμία top-level import/export δήλωση
 *    σε αυτό το αρχείο (τρέχει ως inline script) — μόνο δυναμικό import().
 *  - Σέβεται το history stack: ΔΕΝ αγγίζει το window._pageHistory ούτε το
 *    routing· απλώς εξασφαλίζει ότι το module είναι φορτωμένο ΠΡΙΝ το render.
 *  - Dedupe: κάθε module φορτώνεται μία φορά (cache promise).
 *  - Loading state + error/retry. iOS-safe overlay (δεν "κολλάει" σε notch).
 *
 * Πηγές: 01-ARCHITECTURE-BOOT (load order, showPage/_pageHistory),
 *        13-CUSTOMERS-LOYALTY (renderCustomerIntel),
 *        15-MARKETING-ONLINE (renderCampaigns, renderSiteBuilder, renderPulse).
 * ===================================================================== */
var ZN_MODULE_LOADER = (function () {
  'use strict';

  // Registry: page-key → {url, global}. Το `global` είναι το όνομα της
  // συνάρτησης render που εκθέτει το module αφού φορτωθεί (π.χ. window.renderCustomerIntel).
  // Τα URLs δείχνουν σε ES modules που έχουν εξαχθεί από το zn-leaves.js.
  var REGISTRY = {
    'customer-intel': { url: '/js/modules/customer-intel.js', global: 'renderCustomerIntel' },
    campaigns:     { url: '/js/modules/campaigns.js',      global: 'renderCampaigns' },
    sitebuilder:   { url: '/js/modules/site-builder.js',   global: 'renderSiteBuilder' },
    pulse:         { url: '/js/modules/pulse.js',          global: 'renderPulse' }
  };

  // Cache από promises ανά key → εγγυάται single-flight (dedupe).
  var _loading = {};
  // Σύνολο ήδη φορτωμένων keys.
  var _loaded = {};

  /* Είναι το page-key "lazy"; */
  function isLazy(pageKey) {
    return !!REGISTRY[pageKey];
  }

  /* Εξασφαλίζει ότι το module είναι φορτωμένο. Επιστρέφει Promise.
     Αν δεν είναι lazy → resolve αμέσως. */
  function ensure(pageKey) {
    if (!isLazy(pageKey)) { return Promise.resolve(true); }
    if (_loaded[pageKey])  { return Promise.resolve(true); }
    if (_loading[pageKey]) { return _loading[pageKey]; } // single-flight

    var entry = REGISTRY[pageKey];
    _showSpinner(true);

    // Δυναμικό import() — έγκυρο και σε non-module script.
    var p = import(entry.url).then(function (mod) {
      // Το module μπορεί να κάνει είτε named export είτε να γράψει σε window.
      var fn = (mod && mod[entry.global]) || window[entry.global];
      if (typeof fn === 'function') {
        // Δημοσίευση στο global scope ώστε το υπάρχον routing/render να το βρει.
        window[entry.global] = fn;
      }
      _loaded[pageKey] = true;
      delete _loading[pageKey];
      _showSpinner(false);
      return true;
    }).catch(function (err) {
      delete _loading[pageKey]; // ώστε να ξαναδοκιμάσει την επόμενη φορά
      _showSpinner(false);
      throw err;
    });

    _loading[pageKey] = p;
    return p;
  }

  /* Φόρτωσε + κάλεσε τη render. arg = προαιρετικό όρισμα στη render. */
  function loadAndRender(pageKey, arg) {
    return ensure(pageKey).then(function () {
      var entry = REGISTRY[pageKey];
      var fn = window[entry.global];
      if (typeof fn === 'function') { return fn(arg); }
      throw new Error('Module φορτώθηκε αλλά λείπει η ' + entry.global + '()');
    }).catch(function (err) {
      _renderError(pageKey, err);
    });
  }

  /* Spinner overlay — ελαφρύ, iOS-safe (χρησιμοποιεί υπάρχον #bootLoader
     αν υπάρχει, αλλιώς φτιάχνει μικρό inline indicator). */
  function _showSpinner(on) {
    var el = document.getElementById('znLazySpinner');
    if (on) {
      if (!el) {
        el = document.createElement('div');
        el.id = 'znLazySpinner';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        // Ελάχιστο, λειτουργικό styling — χωρίς αισθητικές παρεμβάσεις.
        el.style.cssText =
          'position:fixed;top:env(safe-area-inset-top,0);left:0;right:0;' +
          'padding:10px;text-align:center;font-size:16px;z-index:99999;' +
          '-webkit-tap-highlight-color:transparent;';
        el.textContent = 'Φόρτωση…';
        document.body.appendChild(el);
      }
      el.style.display = 'block';
    } else if (el) {
      el.style.display = 'none';
    }
  }

  /* Οθόνη σφάλματος με κουμπί επανάληψης (δεν σπάει το routing). */
  function _renderError(pageKey, err) {
    var content = document.getElementById('content');
    var msg = (err && err.message) ? err.message : 'Αποτυχία φόρτωσης module';
    if (typeof toast === 'function') { toast('Σφάλμα φόρτωσης: ' + msg, 'danger'); }
    if (content) {
      content.innerHTML =
        '<div class="card"><h3>⚠️ Δεν φόρτωσε το module</h3>' +
        '<p style="word-break:break-word">' + _esc(msg) + '</p>' +
        '<button class="btn" style="min-height:44px" onclick="ZN_MODULE_LOADER.retry(\'' +
        _esc(pageKey) + '\')">🔄 Επανάληψη</button></div>';
    }
  }

  /* Καθαρίζει το cache για ένα key και ξαναπροσπαθεί. */
  function retry(pageKey) {
    delete _loaded[pageKey];
    delete _loading[pageKey];
    return loadAndRender(pageKey);
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/'/g, '&#39;');
  }

  return {
    REGISTRY: REGISTRY,
    isLazy: isLazy,
    ensure: ensure,
    loadAndRender: loadAndRender,
    retry: retry
  };
})();


/* =====================================================================
 * ΕΝΣΩΜΑΤΩΣΗ στο routing (Doc 01 §4 — showPage → _showPageInternal)
 * ---------------------------------------------------------------------
 * Wrappάρουμε το _showPageInternal ώστε ΠΡΙΝ κάνει render μια lazy σελίδα,
 * να εξασφαλίζεται η φόρτωση του module. ΔΕΝ αγγίζουμε το _pageHistory —
 * το routing/back stack μένει ακριβώς όπως είναι.
 * ===================================================================== */
(function () {
  'use strict';
  if (typeof window._showPageInternal !== 'function') { return; } // guard
  if (window.__znLazyWrapped) { return; }                          // idempotent
  window.__znLazyWrapped = true;

  var _orig = window._showPageInternal;
  window._showPageInternal = function (page) {
    var key = String(page || '');
    if (ZN_MODULE_LOADER.isLazy(key)) {
      // Φόρτωσε το module· μόλις είναι έτοιμο, άσε το αρχικό routing να τρέξει.
      return ZN_MODULE_LOADER.ensure(key)
        .then(function () { return _orig.call(window, page); })
        .catch(function (err) {
          if (typeof toast === 'function') {
            toast('Σφάλμα: ' + (err && err.message ? err.message : 'module'), 'danger');
          }
        });
    }
    return _orig.call(window, page);
  };
})();
