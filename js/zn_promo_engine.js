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
 *   expiry            : conditions {scope, ids, days_before} effect {percent}
 *                       scope: 'all'|'product'|'category'
 *                       Εφαρμόζεται αν days_to_expiry <= days_before (από RPC context).
 *   dead_stock        : conditions {scope, ids, days_no_sale} effect {percent}
 *                       Εφαρμόζεται αν days_since_sale >= days_no_sale ή == null.
 *
 * Κανόνες: var, sbAuth, String-safe IDs.
 * ===================================================================== */
var ZN_PROMO = (function () {
  'use strict';

  var _rules = [];   // cache κανόνων
  var _ctx   = {};   // cache offer context: { [product_id]: {days_to_expiry, days_since_sale} }

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

  /* Φορτώνει context ανά προϊόν από RPC: days_to_expiry, days_since_sale. */
  function loadOfferContext() {
    return sbAuth.rpc('zn_offer_context', {}).then(function (res) {
      if (res.error) { _ctx = {}; return _ctx; }
      var rows = res.data || [];
      _ctx = {};
      for (var j = 0; j < rows.length; j++) {
        _ctx[String(rows[j].product_id)] = {
          days_to_expiry:  rows[j].days_to_expiry  != null ? Number(rows[j].days_to_expiry)  : null,
          days_since_sale: rows[j].days_since_sale != null ? Number(rows[j].days_since_sale) : null
        };
      }
      return _ctx;
    }).catch(function () { _ctx = {}; return _ctx; });
  }

  /* Scope matching helper — επιστρέφει τις γραμμές του cart που ταιριάζουν. */
  function _scopeLines(cart, scope, ids) {
    ids = ids || [];
    if (scope === 'all') { return cart.slice(); }
    if (scope === 'product') {
      var pidSet = {};
      for (var k = 0; k < ids.length; k++) { pidSet[String(ids[k])] = 1; }
      return cart.filter(function (l) { return pidSet[String(l.productId)]; });
    }
    if (scope === 'category') {
      var catSet = {};
      for (var m = 0; m < ids.length; m++) { catSet[String(ids[m])] = 1; }
      return cart.filter(function (l) { return catSet[String(l.category)]; });
    }
    return [];
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

      } else if (r.type === 'expiry') {
        // Έκπτωση σε προϊόντα που λήγουν σύντομα
        var eLines = _scopeLines(cart, cond.scope, cond.ids);
        var daysBefore = Number(cond.days_before || 0);
        var eTotalAmt = 0;
        var eFired = false;
        for (var ei = 0; ei < eLines.length; ei++) {
          var ePid = String(eLines[ei].productId);
          var eCtx = _ctx[ePid];
          if (eCtx && eCtx.days_to_expiry != null
              && eCtx.days_to_expiry >= 0
              && eCtx.days_to_expiry <= daysBefore) {
            var eAmt = Math.round(
              Number(eLines[ei].qty) * Number(eLines[ei].price)
              * Number(eff.percent || 0) / 100 * 100
            ) / 100;
            eTotalAmt += eAmt;
            eFired = true;
          }
        }
        if (eFired) {
          discount += eTotalAmt;
          applied.push(r.name);
          breakdown.push({ name: r.name, amount: eTotalAmt });
        }

      } else if (r.type === 'dead_stock') {
        // Έκπτωση σε αδρανή προϊόντα (δεν πουλήθηκαν αρκετό καιρό)
        var dLines = _scopeLines(cart, cond.scope, cond.ids);
        var daysNoSale = Number(cond.days_no_sale || 0);
        var dTotalAmt = 0;
        var dFired = false;
        var dbgMapSize = Object.keys(_ctx).length; // [DBG]
        for (var di = 0; di < dLines.length; di++) {
          var dPid = String(dLines[di].productId);
          var dCtx = _ctx[dPid];
          var dbgFire = false; // [DBG]
          if (dCtx) {
            // null days_since_sale = ποτέ δεν πουλήθηκε → μέτρα ως αδρανές
            var dSince = dCtx.days_since_sale;
            if (dSince === null || dSince >= daysNoSale) {
              var dAmt = Math.round(
                Number(dLines[di].qty) * Number(dLines[di].price)
                * Number(eff.percent || 0) / 100 * 100
              ) / 100;
              dTotalAmt += dAmt;
              dFired = true;
              dbgFire = true; // [DBG]
            }
          }
          // [DBG] προσωρινό debug toast — αφαίρεσε μόλις λυθεί το πρόβλημα
          if (typeof toast === 'function') {
            toast(
              '[DBG] dead_stock ' + (dLines[di].name || dPid) +
              ': mapSize=' + dbgMapSize +
              ' ctx=' + (dCtx ? 'βρέθηκε' : 'όχι') +
              ' dss=' + (dCtx ? (dCtx.days_since_sale === null ? 'null' : String(dCtx.days_since_sale)) : '—') +
              ' thr=' + daysNoSale +
              ' fire=' + (dbgFire ? 'yes' : 'no'),
              'info', 6000
            );
          }
        }
        if (dFired) {
          discount += dTotalAmt;
          applied.push(r.name);
          breakdown.push({ name: r.name, amount: dTotalAmt });
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

  return { loadRules: loadRules, loadOfferContext: loadOfferContext, evaluate: evaluate };
})();
