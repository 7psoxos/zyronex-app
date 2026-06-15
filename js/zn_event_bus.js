/* =====================================================================
 * ZyroNex · Cross-Device State Sync (Vanilla JS Event Bus)
 * Custom event bus πάνω στα Supabase Realtime WebSockets. Όταν ένα
 * tablet αλλάζει stock, τα άλλα POS ενημερώνουν ΑΚΑΡΙΑΙΑ το τοπικό
 * cache (PRODUCTS) και το DOM — χωρίς refresh.
 *
 * Κανόνες: var, sbAuth, String-safe IDs.
 * ===================================================================== */
var ZN_BUS = (function () {
  'use strict';

  var _channel = null;
  var _handlers = {};   // event → [fn]

  /* Εγγραφή σε εσωτερικό event. */
  function on(evt, fn) {
    if (!_handlers[evt]) { _handlers[evt] = []; }
    _handlers[evt].push(fn);
  }
  function _emit(evt, data) {
    (_handlers[evt] || []).forEach(function (fn) {
      try { fn(data); } catch (e) { /* μην σπάει το bus ένας bad handler */ }
    });
  }

  /* Σύνδεση στα Realtime changes του πίνακα products (ανά shop). */
  function connect() {
    if (_channel || typeof sbAuth.channel !== 'function') { return; }
    _channel = sbAuth.channel('zn-pos-sync')
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        function (payload) { _onProductUpdate(payload && payload.new); })
      .subscribe();
  }

  function _onProductUpdate(row) {
    if (!row) { return; }
    // Ενημέρωσε το τοπικό cache string-safe
    var p = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).find(function (x) {
      return String(x.id) === String(row.id);
    });
    if (p) {
      p.stock = row.stock;
      if (typeof row.price !== 'undefined') { p.price = row.price; }
    }
    _emit('product:update', row);

    // Αν είμαστε στο POS και το προϊόν είναι στο καλάθι, ανανέωσε ένδειξη.
    if (typeof CART !== 'undefined' && CART.some(function (c) {
      return String(c.productId) === String(row.id);
    })) {
      _emit('cart:stockchanged', row);
      if (typeof renderCart === 'function') { try { renderCart(); } catch (e) {} }
    }
  }

  function disconnect() {
    if (_channel && typeof _channel.unsubscribe === 'function') { _channel.unsubscribe(); }
    _channel = null;
  }

  return { on: on, connect: connect, disconnect: disconnect };
})();
