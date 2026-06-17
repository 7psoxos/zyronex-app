/* =========================================================
 * ZyroNex · Print Hub
 * Ενοποιημένος dispatcher εκτύπωσης: Sunmi → WebUSB → Browser
 * Ποτέ δεν μπλοκάρει πώληση. var only, mobile-first.
 * ========================================================= */

async function znPrintReceipt(ctx) {
  var saleData   = ctx.saleData   || {};
  var items      = ctx.items      || [];
  var subtotal   = ctx.subtotal   || 0;
  var vat        = ctx.vat        || 0;
  var customerId = ctx.customerId || null;

  var saleId    = saleData.id;
  var payMethod = saleData.payment_method || 'Μετρητά';
  var isCash    = (payMethod === 'cash' || payMethod === 'Μετρητά');
  var aps       = (typeof getAppSettings === 'function') ? getAppSettings() : {};
  var method    = aps.printMethod || 'auto';

  /* ── Sunmi (1ης προτεραιότητας) ── */
  var trySunmi = (method === 'sunmi') ||
    (method === 'auto' && typeof SUNMI !== 'undefined' && SUNMI.available);
  if (trySunmi && typeof SUNMI !== 'undefined' && SUNMI.available) {
    try {
      var customer = customerId && typeof CUSTOMERS !== 'undefined'
        ? CUSTOMERS.find(function(x) { return x.id === customerId; }) : null;
      var efkAmt = items.reduce(function(acc, it) { return acc + (parseFloat(it.efk_amount) || 0); }, 0);
      var sunmiOk = await SUNMI.print({
        saleId:        saleId,
        items:         items,
        subtotal:      subtotal,
        vat:           vat,
        total:         subtotal,
        efk:           efkAmt,
        customer:      customer ? customer.name : null,
        cashier:       (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER.name : null,
        shopName:      aps.shopName   || 'ZYRONEX',
        shopAfm:       aps.afm        || '',
        shopAddress:   aps.address    || aps.addr || '',
        shopPhone:     aps.phone      || '',
        shopDoy:       aps.doy        || '',
        paymentMethod: payMethod,
        markNumber:    saleData.mark_number || '',
        footerText:    aps.receiptFooter || 'Ευχαριστούμε για την προτίμηση!'
      });
      if (sunmiOk) {
        if (typeof toast === 'function') { toast('🖨️ Εκτύπωση επιτυχής', 'success'); }
        if (isCash) { SUNMI.openCashDrawer().catch(function() {}); }
        return;
      }
      if (typeof toast === 'function') { toast('⚠️ Σφάλμα Sunmi — Browser Print', 'warning'); }
    } catch (e) {
      if (typeof toast === 'function') { toast('⚠️ Σφάλμα Sunmi — επόμενη μέθοδος', 'warning'); }
    }
  }

  /* ── WebUSB ESC/POS (2ης προτεραιότητας) ── */
  var tryEscpos = (method === 'escpos') ||
    (method === 'auto' && aps.autoPrint &&
     typeof ZN_ESCPOS !== 'undefined' && ZN_ESCPOS.available() &&
     ZN_ESCPOS.currentProfile().protocol !== 'browser');
  if (tryEscpos && typeof ZN_ESCPOS !== 'undefined' && ZN_ESCPOS.available()) {
    try {
      var recData = {
        shopName: aps.shopName || 'ZyroNex',
        address:  aps.address  || aps.addr || '',
        phone:    aps.phone    || '',
        afm:      aps.afm      || '',
        title:    'ΑΠΟΔΕΙΞΗ',
        saleId:   saleId,
        datetime: new Date().toLocaleString('el-GR'),
        items:    items.map(function(it) {
          return { name: it.product_name, qty: it.quantity, price: it.unit_price };
        }),
        total:  subtotal,
        footer: aps.receiptFooter || 'Ευχαριστούμε για την προτίμηση!'
      };
      var escOk = await ZN_ESCPOS.printReceipt(recData);
      if (escOk) {
        if (typeof toast === 'function') { toast('🖨️ Απόδειξη εκτυπώθηκε (ESC/POS)', 'success'); }
        if (isCash) { ZN_ESCPOS.openDrawer().catch(function() {}); }
        return;
      }
    } catch (e) {
      if (typeof toast === 'function') { toast('Σφάλμα WebUSB — Browser Print', 'warning'); }
    }
  }

  /* ── Browser Print (fallback — ποτέ block πώλησης) ── */
  if (typeof generateReceipt === 'function') {
    setTimeout(function() {
      if (typeof showConfirm === 'function') {
        showConfirm('Θέλεις να κατεβάσεις απόδειξη σε PDF;',
          function() { generateReceipt(saleId, items, subtotal, vat, customerId); });
      } else {
        generateReceipt(saleId, items, subtotal, vat, customerId);
      }
    }, 300);
  }
}

/* ─── Ορατότητα τμημάτων Settings ανά μέθοδο εκτύπωσης ─── */
function _znPrintHubMethodChange() {
  var sel = document.getElementById('s_printMethod');
  var method = sel ? sel.value : 'auto';
  var sunmiDiv  = document.getElementById('znPrintHubSunmi');
  var escposDiv = document.getElementById('znPrintHubEscpos');
  if (sunmiDiv)  { sunmiDiv.style.display  = (method === 'auto' || method === 'sunmi')  ? '' : 'none'; }
  if (escposDiv) { escposDiv.style.display = (method === 'auto' || method === 'escpos') ? '' : 'none'; }
  if (typeof ZN_ESCPOS !== 'undefined' && ZN_ESCPOS.syncControls) { ZN_ESCPOS.syncControls(); }
}

if (typeof window !== 'undefined') {
  window.znPrintReceipt          = znPrintReceipt;
  window._znPrintHubMethodChange = _znPrintHubMethodChange;
}
