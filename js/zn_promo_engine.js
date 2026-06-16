/* =====================================================================
 * ZyroNex · Promo Engine (Vanilla JS Rule Engine)
 * Διαβάζει promo_rules από Supabase (cache), και σε κάθε αλλαγή του CART
 * υπολογίζει live τη βέλτιστη έκπτωση — χωρίς lag (καθαρά in-memory).
 *
 * Τύποι κανόνων:
 *   percent_over_qty  : conditions {product_id, min_qty}  effect {percent}
 *   category_combo    : conditions {category, min_qty}     effect {percent}
 *   nth_discount      : conditions {product_id|category, n} effect {percent}
 *                       (έκπτωση στο n-οστό τεμάχιο, π.χ. 3ο −50%)
 *
 * Κανόνες: var, sbAuth, String-safe IDs.
 * ===================================================================== */
var ZN_PROMO = (function () {
  'use strict';

  var _rules = [];   // cache κανόνων

  function loadRules() {
    return sbAuth.from('promo_rules').select('*').eq('active', true)
      .then(function (res) {
        if (res.error) { _rules = []; return _rules; }
        var now = Date.now();
        _rules = (res.data || []).filter(function (r) {
          var okFrom = !r.valid_from || new Date(r.valid_from).getTime() <= now;
          var okTo   = !r.valid_to   || new Date(r.valid_to).getTime()   >= now;
          return okFrom && okTo;
        }).sort(function (a, b) { return (a.priority || 100) - (b.priority || 100); });
        return _rules;
      });
  }

  /* cart: array {productId, qty, price, category}. Επιστρέφει {discount, applied[], breakdown[]}. */
  function evaluate(cart) {
    cart = cart || [];
    var discount = 0;
    var applied = [];
    var breakdown = [];  // [{name, amount}] — ένα entry ανά κανόνα που έπιασε
    var i, r;

    for (i = 0; i < _rules.length; i++) {
      r = _rules[i];
      var cond = r.conditions || {};
      var eff  = r.effect || {};

      if (r.type === 'percent_over_qty') {
        var lines = cart.filter(function (l) {
          return String(l.productId) === String(cond.product_id);
        });
        var q = _sum(lines, 'qty');
        if (q >= Number(cond.min_qty || 0)) {
          var base = _sumProduct(lines);
          var amt = Math.round(base * Number(eff.percent || 0) / 100 * 100) / 100;
          discount += amt;
          applied.push(r.name);
          breakdown.push({ name: r.name, amount: amt });
        }

      } else if (r.type === 'category_combo') {
        var clines = cart.filter(function (l) {
          return String(l.category) === String(cond.category);
        });
        var cq = _sum(clines, 'qty');
        if (cq >= Number(cond.min_qty || 0)) {
          var cbase = _sumProduct(clines);
          var camt = Math.round(cbase * Number(eff.percent || 0) / 100 * 100) / 100;
          discount += camt;
          applied.push(r.name);
          breakdown.push({ name: r.name, amount: camt });
        }

      } else if (r.type === 'nth_discount') {
        // έκπτωση στο n-οστό τεμάχιο (π.χ. αγοράζεις 3, το 3ο −50%)
        var sel = cart.filter(function (l) {
          return cond.product_id ? String(l.productId) === String(cond.product_id)
               : String(l.category) === String(cond.category);
        });
        var totalQty = _sum(sel, 'qty');
        var n = Number(cond.n || 0);
        if (n > 0 && totalQty >= n && sel.length) {
          // το φθηνότερο τεμάχιο παίρνει την έκπτωση (υπέρ πελάτη)
          var cheapest = sel.reduce(function (a, b) {
            return (Number(a.price) <= Number(b.price)) ? a : b;
          });
          var hits = Math.floor(totalQty / n); // πόσες φορές «πιάνει»
          var namt = Math.round(Number(cheapest.price) * hits * Number(eff.percent || 0) / 100 * 100) / 100;
          discount += namt;
          applied.push(r.name);
          breakdown.push({ name: r.name, amount: namt });
        }
      }
    }
    return { discount: Math.round(discount * 100) / 100, applied: applied, breakdown: breakdown };
  }

  function _sum(arr, key) {
    return arr.reduce(function (s, x) { return s + (Number(x[key]) || 0); }, 0);
  }
  function _sumProduct(arr) {
    return arr.reduce(function (s, x) { return s + (Number(x.qty) || 0) * (Number(x.price) || 0); }, 0);
  }

  return { loadRules: loadRules, evaluate: evaluate };
})();
