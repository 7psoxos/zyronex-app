/* =====================================================================
 * ZyroNex · Atomic Checkout helper (Vanilla JS)
 * Καλεί το RPC zn_checkout_atomic ώστε το stock να μειώνεται ατομικά
 * (αποτρέπει overselling/-1 σε ταυτόχρονα ταμεία). Χρήση ΜΕΣΑ στο
 * _doCheckout, στο Βήμα 3 (stock decrement) αντί για loop με sb.update.
 *
 * Κανόνες: var, String-safe IDs, sbAuth (authenticated).
 * ===================================================================== */
var ZN_ATOMIC = (function () {
  'use strict';

  /* cart: array από {productId, qty}. Επιστρέφει Promise<{ok, items}|{ok:false,...}>. */
  function decrementCart(cart) {
    var items = (cart || []).map(function (it) {
      return { product_id: it.productId, qty: Number(it.qty) || 0 };
    });
    return sbAuth.rpc('zn_checkout_atomic', { p_items: items }).then(function (res) {
      if (res.error) {
        // Μήνυμα τύπου "INSUFFICIENT_STOCK:<pid>"
        var m = String(res.error.message || '');
        if (m.indexOf('INSUFFICIENT_STOCK') >= 0) {
          var pid = m.split(':')[1];
          return { ok: false, reason: 'insufficient_stock', productId: pid };
        }
        return { ok: false, reason: 'error', message: m };
      }
      // Ενημέρωσε το τοπικό cache PRODUCTS με τα νέα stocks
      var data = res.data || {};
      (data.items || []).forEach(function (row) {
        var p = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).find(function (x) {
          return String(x.id) === String(row.product_id);
        });
        if (p) { p.stock = row.new_stock; }
      });
      return { ok: true, items: data.items || [] };
    });
  }

  return { decrementCart: decrementCart };
})();
