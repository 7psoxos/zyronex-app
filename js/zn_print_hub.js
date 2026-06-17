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

/* =========================================================
 * Κοινός receipt/document builder — απόδειξη/τιμολόγιο/δελτίο
 * Ένα παράθυρο με format selector (58 | 80 | A4), logo
 * ιδιοκτήτη στην κορυφή και ZyroNex branding footer.
 * ========================================================= */

/* ZyroNex software brand mark (inline SVG) για το footer. */
var _ZN_BRAND_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="118" height="22" viewBox="0 0 118 22">' +
  '<rect x="0" y="1" width="20" height="20" rx="5" fill="#00d4a8"/>' +
  '<path d="M5 6 H15 L6 16 H16" fill="none" stroke="#06251f" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '<text x="26" y="16" font-family="Helvetica,Arial,sans-serif" font-size="14" font-weight="800" fill="#0f172a">ZyroNex</text>' +
  '</svg>';

/* Default μορφή ανά τύπο: απόδειξη → 80mm, τιμολόγιο/δελτίο → A4. */
function _znDefaultFmt(R) {
  if (R && (R.kind === 'document')) { return 'A4'; }
  var s = {};
  try { s = JSON.parse(localStorage.getItem('katastimaSettings') || '{}'); } catch (e) {}
  return (s.receiptFormat === '58' || s.receiptFormat === 'A4') ? s.receiptFormat : '80';
}

function _znBuildPrintDoc(R) {
  R.fmt = R.fmt || _znDefaultFmt(R);
  R.brand = _ZN_BRAND_SVG;
  if (!R.title) { R.title = (R.kind === 'document') ? 'ΠΑΡΑΣΤΑΤΙΚΟ' : 'ΑΠΟΔΕΙΞΗ ΛΙΑΝΙΚΗΣ'; }
  var json = JSON.stringify(R).replace(/</g, '\\u003c');
  var titleSafe = String(R.number || '');

  return '<!DOCTYPE html>\n' +
'<html lang="el"><head><meta charset="UTF-8">\n' +
'<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
'<title>' + (R.title || 'Παραστατικό') + ' ' + titleSafe + '</title>\n' +
'<style id="pageStyle">@page{ size:80mm auto; margin:0; }</style>\n' +
'<style>\n' +
'*{ box-sizing:border-box; }\n' +
'html,body{ margin:0; background:#f3f4f6; }\n' +
'body{ color:#000; -webkit-print-color-adjust:exact; print-color-adjust:exact; }\n' +
'.rcpt-toolbar{ position:fixed; top:0; left:0; right:0; display:flex; gap:6px; align-items:center; flex-wrap:wrap;\n' +
'  padding:10px 12px; background:linear-gradient(135deg,#00d4a8,#00a387); color:#fff; z-index:1000;\n' +
'  font-family:-apple-system,Segoe UI,Roboto,sans-serif; box-shadow:0 2px 12px rgba(0,0,0,.15); }\n' +
'.rcpt-toolbar b{ font-size:13px; margin-right:4px; }\n' +
'.rcpt-toolbar button{ border:none; border-radius:8px; padding:8px 12px; font-weight:700; cursor:pointer;\n' +
'  font-family:inherit; font-size:13px; background:rgba(255,255,255,.2); color:#fff; min-height:40px; }\n' +
'.rcpt-toolbar button.active{ background:#fff; color:#00a387; }\n' +
'.rcpt-toolbar .sp{ flex:1; }\n' +
'#rcptRoot{ margin:64px auto 24px; }\n' +
'.thermal{ font-family:\'Courier New\',\'Consolas\',monospace; color:#000; background:#fff; margin:0 auto;\n' +
'  padding:6mm 4mm; line-height:1.4; box-shadow:0 2px 16px rgba(0,0,0,.12); }\n' +
'.thermal.w58{ width:58mm; font-size:11px; }\n' +
'.thermal.w80{ width:80mm; font-size:12px; }\n' +
'.thermal .logo{ text-align:center; margin-bottom:8px; }\n' +
'.thermal .logo img{ max-width:90%; max-height:24mm; object-fit:contain; }\n' +
'.thermal .shop{ text-align:center; font-weight:bold; font-size:1.35em; letter-spacing:.5px; text-transform:uppercase; margin-bottom:4px; }\n' +
'.thermal .info{ text-align:center; font-size:.92em; margin-bottom:6px; line-height:1.5; }\n' +
'.thermal .title{ text-align:center; font-weight:bold; letter-spacing:1px; margin:6px 0; padding:4px 0; border-top:2px solid #000; border-bottom:2px solid #000; }\n' +
'.thermal .row{ display:flex; justify-content:space-between; font-size:.92em; margin-bottom:2px; }\n' +
'.thermal .dash{ border-top:1px dashed #000; margin:6px 0; }\n' +
'.thermal .it{ margin-bottom:6px; }\n' +
'.thermal .it .nm{ font-weight:600; }\n' +
'.thermal .it .ln{ display:flex; justify-content:space-between; padding-left:8px; font-size:.92em; }\n' +
'.thermal .it .ex{ font-size:.82em; color:#444; padding-left:8px; font-style:italic; }\n' +
'.thermal .grand{ display:flex; justify-content:space-between; font-weight:bold; font-size:1.3em; padding:6px 0; margin:4px 0; border-top:2px solid #000; border-bottom:2px solid #000; }\n' +
'.thermal .foot{ text-align:center; font-size:.92em; margin-top:12px; font-style:italic; }\n' +
'.a4{ width:210mm; min-height:297mm; background:#fff; margin:0 auto; padding:18mm 16mm; color:#111;\n' +
'  font-family:-apple-system,Segoe UI,Roboto,\'Helvetica Neue\',Arial,sans-serif; font-size:12pt; line-height:1.5; box-shadow:0 2px 24px rgba(0,0,0,.12); }\n' +
'.a4 .head{ display:flex; align-items:center; gap:18px; border-bottom:3px solid #00a387; padding-bottom:16px; margin-bottom:18px; }\n' +
'.a4 .head img{ max-height:90px; max-width:200px; object-fit:contain; }\n' +
'.a4 .head .nm{ font-size:24pt; font-weight:800; letter-spacing:-.3px; }\n' +
'.a4 .head .meta{ font-size:10.5pt; color:#444; margin-top:4px; line-height:1.45; }\n' +
'.a4 .head .docbox{ margin-left:auto; text-align:right; }\n' +
'.a4 .head .docbox .dt{ font-size:16pt; font-weight:800; color:#00a387; }\n' +
'.a4 .head .docbox .no{ font-size:13pt; font-weight:700; font-family:\'Courier New\',monospace; margin-top:2px; }\n' +
'.a4 .head .docbox .dd{ font-size:10pt; color:#555; margin-top:2px; }\n' +
'.a4 .client{ background:#f7f9fa; border-left:3px solid #00a387; border-radius:8px; padding:12px 14px; margin-bottom:16px; }\n' +
'.a4 .client .lbl{ font-size:9.5pt; font-weight:700; letter-spacing:1.2px; text-transform:uppercase; color:#888; margin-bottom:3px; }\n' +
'.a4 .client .nm{ font-weight:700; font-size:12.5pt; }\n' +
'.a4 .client .ln{ font-size:10pt; color:#555; }\n' +
'.a4 table{ width:100%; border-collapse:collapse; margin-bottom:16px; }\n' +
'.a4 th{ text-align:left; font-size:10.5pt; text-transform:uppercase; letter-spacing:.4px; color:#555; border-bottom:2px solid #111; padding:8px 6px; }\n' +
'.a4 th.r,.a4 td.r{ text-align:right; }\n' +
'.a4 th.c,.a4 td.c{ text-align:center; }\n' +
'.a4 td{ padding:8px 6px; border-bottom:1px solid #e2e2e2; font-size:11pt; }\n' +
'.a4 .tot{ width:46%; margin-left:auto; }\n' +
'.a4 .tot .tr{ display:flex; justify-content:space-between; padding:4px 0; }\n' +
'.a4 .tot .grand{ display:flex; justify-content:space-between; padding:10px 0; margin-top:6px; border-top:2px solid #111; border-bottom:2px solid #111; font-size:15pt; font-weight:800; }\n' +
'.a4 .notes{ background:#f7f9fa; border-radius:6px; padding:10px 12px; font-size:10pt; color:#555; margin-top:14px; }\n' +
'.a4 .foot{ text-align:center; margin-top:26px; color:#555; font-style:italic; font-size:10pt; }\n' +
'.znfoot{ text-align:center; margin-top:16px; }\n' +
'.znfoot .znline{ border-top:1px dashed #bbb; margin-bottom:10px; }\n' +
'.znfoot svg{ max-width:60%; height:auto; }\n' +
'.znfoot .zntxt{ font-size:10px; color:#888; margin-top:5px; }\n' +
'@media print{\n' +
'  html,body{ background:#fff; }\n' +
'  .no-print{ display:none !important; }\n' +
'  #rcptRoot{ margin:0 auto; }\n' +
'  .thermal{ box-shadow:none; }\n' +
'  .a4{ box-shadow:none; margin:0; width:auto; min-height:auto; padding:14mm; }\n' +
'}\n' +
'</style></head>\n' +
'<body>\n' +
'<div class="rcpt-toolbar no-print">\n' +
'  <b>Μορφή:</b>\n' +
'  <button type="button" data-fmt="58">58mm</button>\n' +
'  <button type="button" data-fmt="80">80mm</button>\n' +
'  <button type="button" data-fmt="A4">A4</button>\n' +
'  ' + (R.isPreview ? '<span style="background:rgba(255,255,255,.25);padding:6px 10px;border-radius:8px;font-size:12px;font-weight:700">👁️ ΠΡΟΕΠΙΣΚΟΠΗΣΗ</span>' : '') + '\n' +
'  <span class="sp"></span>\n' +
'  <button type="button" id="rcptPrint">🖨️ Εκτύπωση</button>\n' +
'  <button type="button" onclick="window.close()">✕</button>\n' +
'</div>\n' +
'<div id="rcptRoot"></div>\n' +
'<script>\n' +
'(function(){\n' +
'  var R = ' + json + ';\n' +
'  var BRAND = ' + JSON.stringify(_ZN_BRAND_SVG) + ';\n' +
'  var eur = function(n){ return (Number(n)||0).toFixed(2).replace(".",",")+" €"; };\n' +
'  var esc = function(t){ return String(t==null?"":t).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); };\n' +
'  function infoLine(){\n' +
'    var p=[]; if(R.shopAddr) p.push(esc(R.shopAddr)+(R.shopCity?(", "+esc(R.shopCity)):""));\n' +
'    var t2=[]; if(R.shopAfm) t2.push("ΑΦΜ: "+esc(R.shopAfm)); if(R.shopDoy) t2.push("ΔΟΥ: "+esc(R.shopDoy));\n' +
'    if(t2.length) p.push(t2.join("  •  "));\n' +
'    if(R.shopPhone) p.push("Τηλ: "+esc(R.shopPhone));\n' +
'    if(R.shopEmail) p.push(esc(R.shopEmail));\n' +
'    return p;\n' +
'  }\n' +
'  function znFooter(){ return "<div class=\\"znfoot\\"><div class=\\"znline\\"></div>"+BRAND+"<div class=\\"zntxt\\">Δημιουργήθηκε με το ZyroNex POS System</div></div>"; }\n' +
'  function totals(){ return R.totals || {net:0,vat:0,efk:0,total:0}; }\n' +
'  function renderThermal(w){\n' +
'    var T=totals();\n' +
'    var logo = R.logo ? "<div class=\\"logo\\"><img src=\\""+R.logo+"\\" alt=\\"logo\\"></div>" : "";\n' +
'    var name = "<div class=\\"shop\\">"+esc(R.shopName||"ZyroNex")+"</div>";\n' +
'    var info = "<div class=\\"info\\">"+infoLine().join("<br>")+"</div>";\n' +
'    var rows = "";\n' +
'    rows += "<div class=\\"row\\"><span>Αρ.:</span><span><b>"+esc(R.number)+"</b></span></div>";\n' +
'    rows += "<div class=\\"row\\"><span>Ημ/νία:</span><span>"+esc(R.date)+(R.time?(" "+esc(R.time)):"")+"</span></div>";\n' +
'    if(R.client && R.client.name) rows += "<div class=\\"row\\"><span>Πελάτης:</span><span>"+esc(R.client.name)+"</span></div>";\n' +
'    if(R.cashier) rows += "<div class=\\"row\\"><span>Ταμίας:</span><span>"+esc(R.cashier)+"</span></div>";\n' +
'    var its = (R.items||[]).map(function(it){\n' +
'      var ex = (it.nicotine_mg!=null) ? "<div class=\\"ex\\">Νικοτίνη: "+esc(it.nicotine_mg)+" mg/ml</div>" : "";\n' +
'      return "<div class=\\"it\\"><div class=\\"nm\\">"+esc(it.name)+"</div><div class=\\"ln\\"><span>"+esc(it.qty)+" × "+eur(it.unitPrice)+"</span><span><b>"+eur(it.total)+"</b></span></div>"+ex+"</div>";\n' +
'    }).join("");\n' +
'    var tot = "<div class=\\"row\\"><span>Καθαρή Αξία:</span><span>"+eur(T.net)+"</span></div>"+\n' +
'              "<div class=\\"row\\"><span>ΦΠΑ:</span><span>"+eur(T.vat)+"</span></div>"+\n' +
'              ((T.efk>0)?"<div class=\\"row\\"><span>ΕΦΚ:</span><span>"+eur(T.efk)+"</span></div>":"");\n' +
'    return "<div class=\\"thermal "+(w==="58"?"w58":"w80")+"\\">"+logo+name+info+\n' +
'      "<div class=\\"title\\">"+esc(R.title)+"</div>"+rows+\n' +
'      "<div class=\\"dash\\"></div>"+its+"<div class=\\"dash\\"></div>"+tot+\n' +
'      "<div class=\\"grand\\"><span>ΣΥΝΟΛΟ:</span><span>"+eur(T.total)+"</span></div>"+\n' +
'      (R.footerText?("<div class=\\"foot\\">"+esc(R.footerText)+"</div>"):"")+\n' +
'      (R.notes?("<div class=\\"foot\\">"+esc(R.notes)+"</div>"):"")+\n' +
'      znFooter()+"</div>";\n' +
'  }\n' +
'  function renderA4(){\n' +
'    var T=totals();\n' +
'    var isDoc = (R.kind==="document");\n' +
'    var logo = R.logo ? "<img src=\\""+R.logo+"\\" alt=\\"logo\\">" : "";\n' +
'    var hasEfk = (R.items||[]).some(function(it){ return it.efk>0; });\n' +
'    var head = "<th>Περιγραφή</th><th class=\\"c\\">Ποσ.</th><th class=\\"r\\">Τιμή</th>"+\n' +
'      (isDoc?"<th class=\\"c\\">ΦΠΑ</th>":"")+"<th class=\\"r\\">"+(isDoc?"Καθαρό":"Αξία")+"</th>"+(hasEfk?"<th class=\\"r\\">ΕΦΚ</th>":"");\n' +
'    var body = (R.items||[]).map(function(it){\n' +
'      var nm = esc(it.name) + (it.nicotine_mg!=null?(" <span style=\\"color:#777;font-size:9.5pt\\">("+esc(it.nicotine_mg)+" mg/ml)</span>"):"");\n' +
'      var lineNet = (it.lineNet!=null)? it.lineNet : (Number(it.unitPrice||0)*Number(it.qty||1));\n' +
'      return "<tr><td>"+nm+"</td><td class=\\"c\\">"+esc(it.qty)+(it.unit?(" "+esc(it.unit)):"")+"</td><td class=\\"r\\">"+eur(it.unitPrice)+"</td>"+\n' +
'        (isDoc?("<td class=\\"c\\">"+esc(it.vatPct!=null?it.vatPct:24)+"%</td>"):"")+\n' +
'        "<td class=\\"r\\">"+eur(isDoc?lineNet:it.total)+"</td>"+(hasEfk?("<td class=\\"r\\">"+(it.efk>0?eur(it.efk):"—")+"</td>"):"")+"</tr>";\n' +
'    }).join("");\n' +
'    var client = (R.client && R.client.name) ? ("<div class=\\"client\\"><div class=\\"lbl\\">Λήπτης</div><div class=\\"nm\\">"+esc(R.client.name)+"</div>"+\n' +
'      ((R.client.afm)?("<div class=\\"ln\\">ΑΦΜ: "+esc(R.client.afm)+(R.client.doy?(" · ΔΟΥ: "+esc(R.client.doy)):"")+"</div>"):"")+\n' +
'      ((R.client.addr)?("<div class=\\"ln\\">"+esc(R.client.addr)+(R.client.city?(", "+esc(R.client.city)):"")+"</div>"):"")+"</div>") : "";\n' +
'    return "<div class=\\"a4\\"><div class=\\"head\\">"+logo+\n' +
'      "<div><div class=\\"nm\\">"+esc(R.shopName||"ZyroNex")+"</div><div class=\\"meta\\">"+infoLine().join(" · ")+"</div></div>"+\n' +
'      "<div class=\\"docbox\\"><div class=\\"dt\\">"+esc(R.title)+"</div><div class=\\"no\\">"+esc(R.number)+"</div><div class=\\"dd\\">"+esc(R.date)+(R.time?(" "+esc(R.time)):"")+"</div></div></div>"+\n' +
'      client+\n' +
'      "<table><thead><tr>"+head+"</tr></thead><tbody>"+body+"</tbody></table>"+\n' +
'      "<div class=\\"tot\\"><div class=\\"tr\\"><span>Καθαρή Αξία</span><span>"+eur(T.net)+"</span></div>"+\n' +
'      "<div class=\\"tr\\"><span>ΦΠΑ</span><span>"+eur(T.vat)+"</span></div>"+\n' +
'      ((T.efk>0)?"<div class=\\"tr\\"><span>ΕΦΚ</span><span>"+eur(T.efk)+"</span></div>":"")+\n' +
'      "<div class=\\"grand\\"><span>ΣΥΝΟΛΟ</span><span>"+eur(T.total)+"</span></div></div>"+\n' +
'      (R.notes?("<div class=\\"notes\\"><b>Σημειώσεις:</b> "+esc(R.notes)+"</div>"):"")+\n' +
'      (R.footerText?("<div class=\\"foot\\">"+esc(R.footerText)+"</div>"):"")+\n' +
'      znFooter()+"</div>";\n' +
'  }\n' +
'  function pageCss(fmt){ if(fmt==="A4") return "@page{ size:A4; margin:12mm; }"; if(fmt==="58") return "@page{ size:58mm auto; margin:0; }"; return "@page{ size:80mm auto; margin:0; }"; }\n' +
'  function render(fmt){\n' +
'    document.getElementById("pageStyle").textContent = pageCss(fmt);\n' +
'    document.getElementById("rcptRoot").innerHTML = (fmt==="A4") ? renderA4() : renderThermal(fmt);\n' +
'    var bb=document.querySelectorAll(".rcpt-toolbar [data-fmt]");\n' +
'    for(var i=0;i<bb.length;i++){ bb[i].className=(bb[i].getAttribute("data-fmt")===fmt)?"active":""; }\n' +
'    R.fmt=fmt;\n' +
'  }\n' +
'  var fb=document.querySelectorAll(".rcpt-toolbar [data-fmt]");\n' +
'  for(var i=0;i<fb.length;i++){ (function(b){ b.onclick=function(){ render(b.getAttribute("data-fmt")); }; })(fb[i]); }\n' +
'  document.getElementById("rcptPrint").onclick=function(){ window.print(); };\n' +
'  render(R.fmt);\n' +
'  if(!R.isPreview){ setTimeout(function(){ window.print(); }, 450); }\n' +
'})();\n' +
'</' + 'script>\n' +
'</body></html>';
}

/* Άνοιγμα ενοποιημένου παραθύρου εκτύπωσης. Επιστρέφει true/false. */
function znOpenPrintDoc(R) {
  try {
    var html = _znBuildPrintDoc(R || {});
    var w = window.open('', '_blank', 'width=820,height=720');
    if (!w) {
      if (typeof toast === 'function') { toast('Ο browser μπλόκαρε το popup. Επίτρεψε popups.', 'warning'); }
      return false;
    }
    w.document.write(html);
    w.document.close();
    return true;
  } catch (e) {
    if (typeof toast === 'function') { toast('Σφάλμα εκτύπωσης: ' + (e.message || e), 'danger'); }
    return false;
  }
}

if (typeof window !== 'undefined') {
  window.znPrintReceipt          = znPrintReceipt;
  window._znPrintHubMethodChange = _znPrintHubMethodChange;
  window.znOpenPrintDoc          = znOpenPrintDoc;
  window._znBuildPrintDoc        = _znBuildPrintDoc;
  window._ZN_BRAND_SVG           = _ZN_BRAND_SVG;
}
