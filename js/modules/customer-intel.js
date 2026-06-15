// customer-intel.js — lazy-loaded module for Customer Intelligence
// Dependencies (stay in zn-leaves.js): CI_TAB, CI_SALE_ITEMS_CACHE, ciEnsureItems, ciCustomerItems, honestDataBanner
// Globals expected at runtime: PRODUCTS, CUSTOMERS, SALES, toast, lucide, isPluginActive, escapeHtml, eur, custAvatarHTML, ciCustomerSales, ciIsCoil, ciIsLiquid, ciFlavorFamily
// ===== MAIN RENDERER =====
async function renderCustomerIntel(){
  const content = document.getElementById('content');
  content.innerHTML = `<div class="page-head">
    <div><div class="page-title">👥 Ανάλυση Πελατών</div><div class="page-sub">Insights για να κρατάς τους πελάτες κοντά — derived από πωλήσεις</div></div>
    <button class="btn btn-ghost" onclick="CI_SALE_ITEMS_CACHE=null;renderCustomerIntel()"><i data-lucide="refresh-cw" size="16"></i> Ανανέωση</button>
  </div>
  <div style="text-align:center;padding:40px"><div style="width:40px;height:40px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite;display:inline-block"></div></div>`;
  lucide.createIcons();
  await ciEnsureItems();
  renderCustomerIntelBody();
}

function renderCustomerIntelBody(){
  const content = document.getElementById('content');
  content.innerHTML = `
    <div class="page-head">
      <div><div class="page-title">👥 Ανάλυση Πελατών</div><div class="page-sub">Insights για να κρατάς τους πελάτες κοντά — derived από πωλήσεις</div></div>
      <button class="btn btn-ghost" onclick="CI_SALE_ITEMS_CACHE=null;renderCustomerIntel()"><i data-lucide="refresh-cw" size="16"></i> Ανανέωση</button>
    </div>
    ${(typeof honestDataBanner==='function')?honestDataBanner():''}
    <div class="flex gap-2 mb-4" style="flex-wrap:wrap">
      <button class="btn ${CI_TAB==='dna'?'btn-primary':'btn-ghost'}" onclick="setCITab('dna')"><i data-lucide="dna" size="16"></i> Προφίλ Πελάτη</button>
      <button class="btn ${CI_TAB==='coil'?'btn-primary':'btn-ghost'}" onclick="setCITab('coil')"><i data-lucide="zap" size="16"></i> Αντιστάσεις</button>
      <button class="btn ${CI_TAB==='churner'?'btn-primary':'btn-ghost'}" onclick="setCITab('churner')"><i data-lucide="user-x" size="16"></i> Σε Κίνδυνο</button>
      ${(typeof isPluginActive==='function' && isPluginActive('winback')) ? `<button class="btn ${CI_TAB==='winback'?'btn-primary':'btn-ghost'}" onclick="setCITab('winback')"><i data-lucide="undo-2" size="16"></i> Επανάκτηση</button>` : ''}
      <button class="btn ${CI_TAB==='flavor'?'btn-primary':'btn-ghost'}" onclick="setCITab('flavor')"><i data-lucide="palette" size="16"></i> Προτίμηση Γεύσης</button>
      <button class="btn ${CI_TAB==='tapering'?'btn-primary':'btn-ghost'}" onclick="setCITab('tapering')"><i data-lucide="trending-down" size="16"></i> Μείωση Νικοτίνης</button>
      ${(typeof isPluginActive==='function' && isPluginActive('basket_affinity')) ? `<button class="btn ${CI_TAB==='affinity'?'btn-primary':'btn-ghost'}" onclick="setCITab('affinity')"><i data-lucide="link" size="16"></i> Τι Πάει Μαζί</button>` : ''}
      <button class="btn ${CI_TAB==='birthdays'?'btn-primary':'btn-ghost'}" onclick="setCITab('birthdays')"><i data-lucide="cake" size="16"></i> Γενέθλια</button>
    </div>
    <div id="ciTabBody"></div>
  `;
  renderCITabBody();
  lucide.createIcons();
}

function setCITab(tab){ CI_TAB = tab; renderCustomerIntelBody(); }

function renderCITabBody(){
  const body = document.getElementById('ciTabBody');
  if(!body) return;
  if(CI_TAB==='dna') body.innerHTML = renderCIDna();
  else if(CI_TAB==='coil') body.innerHTML = renderCICoil();
  else if(CI_TAB==='churner') body.innerHTML = renderCIChurner();
  else if(CI_TAB==='winback') body.innerHTML = renderCIWinback();
  else if(CI_TAB==='affinity') body.innerHTML = renderCIAffinity();
  else if(CI_TAB==='flavor') body.innerHTML = renderCIFlavor();
  else if(CI_TAB==='tapering') body.innerHTML = renderCITapering();
  else if(CI_TAB==='birthdays') body.innerHTML = renderCIBirthdays();
  lucide.createIcons();
}

/* ---------- TAB: Win-back (προσωπικός ρυθμός + αγαπημένη γεύση → ενέργεια) ---------- */
// Βρίσκει την αγαπημένη γεύση/προϊόν του πελάτη από το ιστορικό του.
function _winbackFavorite(customerId){
  try {
    const items = CI_SALE_ITEMS_CACHE || [];
    const custItems = ciCustomerItems(customerId, items);
    if (!custItems.length) return null;
    // μέτρα συχνότητα ανά προϊόν
    const freq = {};
    custItems.forEach(function(it){
      const pid = it.product_id;
      const q = Number(it.qty || it.quantity || 1);
      freq[pid] = (freq[pid] || 0) + (isFinite(q) ? q : 1);
    });
    let bestPid = null, bestN = 0;
    Object.keys(freq).forEach(function(pid){ if (freq[pid] > bestN) { bestN = freq[pid]; bestPid = pid; } });
    if (bestPid == null) return null;
    const p = (typeof PRODUCTS !== 'undefined') ? PRODUCTS.find(function(x){ return x && String(x.id) === String(bestPid); }) : null;
    if (!p) return null;
    // αγαπημένη γεύση από flavorTags αν υπάρχει, αλλιώς όνομα προϊόντος
    let flavor = null;
    const tags = p.flavorTags || p.flavor_tags;
    if (Array.isArray(tags) && tags.length) flavor = tags[0];
    return { product: p.name, flavor: flavor };
  } catch(_) { return null; }
}

function renderCIWinback(){
  let rows = [];
  try {
    const list = Array.isArray(CUSTOMERS) ? CUSTOMERS : [];
    list.forEach(function(c){
      if (!c) return;
      const sales = ciCustomerSales(c.id);
      if (sales.length < 2) return; // χρειάζονται ≥2 επισκέψεις για να βγει ρυθμός
      // ταξινόμησε ημερομηνίες (νεότερη πρώτη)
      const times = sales.map(function(s){ return new Date(s.created_at || s.date).getTime(); })
        .filter(function(t){ return isFinite(t); }).sort(function(a,b){ return b-a; });
      if (times.length < 2) return;
      // μέσο διάστημα μεταξύ διαδοχικών επισκέψεων
      let gaps = [];
      for (let i = 0; i < times.length - 1; i++) {
        const g = (times[i] - times[i+1]) / 86400000;
        if (isFinite(g) && g > 0) gaps.push(g);
      }
      if (!gaps.length) return;
      const avgGap = gaps.reduce(function(a,b){ return a+b; }, 0) / gaps.length;
      if (!isFinite(avgGap) || avgGap <= 0) return;
      const daysSince = Math.floor((Date.now() - times[0]) / 86400000);
      // ΤΡΙΓΚΕΡ: ξεπέρασε τον προσωπικό ρυθμό κατά ≥50% (και τουλάχιστον +5 μέρες)
      const overdue = daysSince - avgGap;
      if (overdue >= Math.max(avgGap * 0.5, 5)) {
        rows.push({
          c: c,
          avgGap: Math.round(avgGap),
          daysSince: daysSince,
          overdue: Math.round(overdue),
          fav: _winbackFavorite(c.id),
          spent: sales.reduce(function(a,s){ return a + (Number(s.total)||0); }, 0)
        });
      }
    });
  } catch(_) { rows = []; }

  // ταξινόμηση: μεγαλύτερη καθυστέρηση + αξία πρώτα
  rows.sort(function(a,b){ return (b.overdue + b.spent/50) - (a.overdue + a.spent/50); });

  if (!rows.length) {
    return `<div class="card" style="text-align:center;padding:40px">
      <div style="font-size:40px;margin-bottom:12px">👍</div>
      <div class="fw-700" style="margin-bottom:6px">Κανείς δεν ξεφεύγει από τον ρυθμό του</div>
      <div class="muted" style="font-size:13px">Όταν ένας τακτικός πελάτης αργήσει πέρα από τη συνήθειά του, θα εμφανιστεί εδώ με έτοιμη ενέργεια επανάκτησης.</div>
    </div>`;
  }

  const cards = rows.map(function(r, idx){
    const favText = r.fav
      ? (r.fav.flavor ? (r.fav.flavor + ' (' + r.fav.product + ')') : r.fav.product)
      : '—';
    const contact = [];
    if (r.c.phone) contact.push('📞 ' + escapeHtml(String(r.c.phone)));
    if (r.c.email) contact.push('✉️ ' + escapeHtml(String(r.c.email)));
    return `<div style="background:var(--bg-2);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;flex-wrap:wrap">
        <div style="display:flex;align-items:flex-start;gap:10px">
          ${(typeof custAvatarHTML==='function') ? custAvatarHTML(r.c.name, 42, ({bronze:'🥉',silver:'🥈',gold:'🥇',platinum:'💎'})[r.c.loyaltyTier||'bronze'], null) : ''}
          <div>
          <div class="fw-800" style="font-size:14px">${escapeHtml(r.c.name || 'Πελάτης')}</div>
          <div style="font-size:11px;color:var(--text-2);margin-top:2px">
            Ερχόταν κάθε ~${r.avgGap} ημ. · Λείπει <b style="color:var(--warn)">${r.daysSince} ημ.</b> (+${r.overdue} πέρα από τον ρυθμό)
          </div>
          ${contact.length ? `<div style="font-size:11px;color:var(--text-2);margin-top:2px">${contact.join(' · ')}</div>` : ''}
          <div style="font-size:11px;color:var(--text-1);margin-top:4px">Αγαπημένο: <b>${escapeHtml(favText)}</b></div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:var(--text-2)">Συν. τζίρος</div>
          <div class="fw-800" style="font-size:14px;color:var(--accent)">${eur(r.spent)}</div>
        </div>
      </div>
      <button class="btn btn-ghost" style="width:100%;margin-top:10px;font-size:12px;min-height:44px" onclick="_winbackMessage(${idx})">
        <i data-lucide="message-circle" size="14"></i> Ετοίμασε μήνυμα επανάκτησης
      </button>
    </div>`;
  }).join('');

  try { window._WINBACK_ROWS = rows; } catch(_){}

  return `<div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px">
      <b>${rows.length}</b> πελάτες ξεπέρασαν τον προσωπικό τους ρυθμό αγορών. Στείλε τους στοχευμένη προσφορά πριν χαθούν.
    </div>${cards}`;
}

function _winbackMessage(idx){
  try {
    const rows = window._WINBACK_ROWS || [];
    const r = rows[idx];
    if (!r) return;
    const name = (r.c.name || '').split(' ')[0] || 'φίλε';
    const favText = r.fav ? (r.fav.flavor || r.fav.product) : null;
    const favPart = favText ? (' Έχουμε ξανά ' + favText + ' που σου αρέσει!') : '';
    const msg = 'Γεια σου ' + name + '! Σε λείψαμε 🙂' + favPart + ' Πέρνα από το κατάστημα για μια ειδική έκπτωση -15% στην επόμενη αγορά σου. Σε περιμένουμε!';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(msg).then(function(){
        if (typeof toast === 'function') toast('Το μήνυμα αντιγράφηκε — έτοιμο για SMS/Viber', 'success');
      }).catch(function(){
        try { window.prompt('Αντιγράψτε το μήνυμα:', msg); } catch(_){}
      });
    } else {
      try { window.prompt('Αντιγράψτε το μήνυμα:', msg); } catch(_){}
    }
  } catch(_){}
}

/* ---------- TAB: DNA (dashboard με tags) ---------- */
function ciBuildDnaTags(customer, items){
  const tags = [];
  const sales = ciCustomerSales(customer.id);
  if(!sales.length) return ['Νέος'];

  const n = sales.length;
  const totalSpent = sales.reduce((a,s)=>a+(s.total||0),0);
  const avg = totalSpent / n;

  // Spending tier
  if(totalSpent >= 500) tags.push('💎 VIP');
  else if(totalSpent >= 200) tags.push('⭐ Regular');
  else if(n >= 3) tags.push('👤 Active');

  // Recency
  const last = sales.map(s=>new Date(s.created_at||s.date).getTime()).sort((a,b)=>b-a)[0];
  const daysSince = last ? Math.floor((Date.now()-last)/86400000) : 999;
  if(daysSince > 60) tags.push('🕸️ Μακρινός');
  else if(daysSince <= 7) tags.push('🔥 Πρόσφατος');

  // Basket analysis
  const coilCount = items.filter(it=>{ const p = PRODUCTS.find(x=>x.id===it.product_id); return ciIsCoil(p); }).length;
  const liquidCount = items.filter(it=>{ const p = PRODUCTS.find(x=>x.id===it.product_id); return ciIsLiquid(p); }).length;

  if(coilCount >= 10) tags.push('🔧 DIYer');
  if(liquidCount >= 5 && liquidCount > coilCount*2) tags.push('💧 Liquid Fan');

  // Nicotine preference
  if(customer.preferred_nicotine===0 || customer.preferredNicotine===0) tags.push('🚭 0mg');
  else if((customer.preferred_nicotine||customer.preferredNicotine)>=12) tags.push('⚡ High-nic');
  else if((customer.preferred_nicotine||customer.preferredNicotine)>=3) tags.push('Low-nic');

  // Avg basket size
  if(avg >= 50) tags.push('💰 Big basket');
  else if(avg < 10) tags.push('🪙 Small basket');

  return tags;
}

// ── Basket Affinity (Τι Πάει Μαζί) ──
// Ομαδοποιεί τα sale_items ανά απόδειξη και μετράει ζεύγη προϊόντων που εμφανίζονται μαζί.
function _affinityComputePairs(){
  var items = CI_SALE_ITEMS_CACHE || [];
  if(!items.length) return [];
  // group product ids per sale
  var bySale = {};
  items.forEach(function(it){
    if(!it || it.sale_id == null || it.product_id == null) return;
    var sid = it.sale_id;
    if(!bySale[sid]) bySale[sid] = {};
    bySale[sid][it.product_id] = true; // unique products per sale
  });
  // count product totals + pair counts
  var prodCount = {};   // pid -> σε πόσες αποδείξεις
  var pairCount = {};   // "a|b" -> μαζί
  Object.keys(bySale).forEach(function(sid){
    var pids = Object.keys(bySale[sid]);
    pids.forEach(function(p){ prodCount[p] = (prodCount[p]||0) + 1; });
    for(var i=0;i<pids.length;i++){
      for(var j=i+1;j<pids.length;j++){
        var a = pids[i], b = pids[j];
        var key = a < b ? a+'|'+b : b+'|'+a;
        pairCount[key] = (pairCount[key]||0) + 1;
      }
    }
  });
  var nameOf = function(pid){
    var p = (typeof PRODUCTS!=='undefined') ? PRODUCTS.find(function(x){ return x && String(x.id)===String(pid); }) : null;
    return p ? p.name : null;
  };
  var pairs = [];
  Object.keys(pairCount).forEach(function(key){
    var together = pairCount[key];
    if(together < 2) return; // χρειάζονται ≥2 κοινές εμφανίσεις για σήμα
    var parts = key.split('|');
    var a = parts[0], b = parts[1];
    var na = nameOf(a), nb = nameOf(b);
    if(!na || !nb) return;
    // confidence: από αυτούς που πήραν Α, πόσοι πήραν και Β
    var confA = prodCount[a] ? Math.round((together/prodCount[a])*100) : 0;
    var confB = prodCount[b] ? Math.round((together/prodCount[b])*100) : 0;
    pairs.push({ a:na, b:nb, together:together, conf: Math.max(confA, confB) });
  });
  pairs.sort(function(x,y){ return (y.together - x.together) || (y.conf - x.conf); });
  return pairs.slice(0, 40);
}

function renderCIAffinity(){
  var pairs = [];
  try { pairs = _affinityComputePairs(); } catch(_) { pairs = []; }
  if(!pairs.length){
    return `<div class="card" style="text-align:center;padding:40px">
      <div style="font-size:48px">🔗</div>
      <div class="fw-800 text-xl mt-3">Δεν υπάρχει αρκετό ιστορικό</div>
      <div class="muted mt-2">Χρειάζονται περισσότερες αποδείξεις με ≥2 προϊόντα για να βρεθούν συνδυασμοί.</div>
    </div>`;
  }
  var rows = pairs.map(function(p){
    return `<div style="background:var(--bg-1);border:1px solid var(--border);border-radius:12px;padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <span class="chip chip-neutral" style="font-size:12px">${escapeHtml(p.a)}</span>
        <span style="color:var(--accent);font-weight:800">+</span>
        <span class="chip chip-neutral" style="font-size:12px">${escapeHtml(p.b)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--text-2)">
        <span>Μαζί σε <b style="color:var(--text-0)">${p.together}</b> αποδείξεις</span>
        <span>Συσχέτιση: <b style="color:var(--accent)">${p.conf}%</b></span>
      </div>
    </div>`;
  }).join('');
  return `<div style="background:rgba(0,212,168,0.08);border:1px solid rgba(0,212,168,0.25);border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:13px">
      💡 Όταν ένας πελάτης αγοράζει το πρώτο προϊόν, πρότεινέ του το δεύτερο. Αυξάνει τον μέσο όρο καλαθιού.
    </div>${rows}`;
}

// Helper: «avatar + όνομα» cell για τους πίνακες των CI tabs (ενιαία εμφάνιση)
function _ciNameCell(c){
  if(!c) return '<span class="muted">—</span>';
  var tierEmojiMap = {bronze:'🥉', silver:'🥈', gold:'🥇', platinum:'💎'};
  var tierColorMap = {bronze:'#cd7f32', silver:'#c0c0c0', gold:'#ffd700', platinum:'#e5e4e2'};
  var tier = c.loyaltyTier || 'bronze';
  var av = (typeof custAvatarHTML === 'function')
    ? custAvatarHTML(c.name, 38, tierEmojiMap[tier]||'🥉', tierColorMap[tier]||'#cd7f32')
    : '';
  var nm = (c.name||'').replace(/</g,'&lt;');
  return '<div style="display:flex;align-items:center;gap:10px">' + av + '<span class="fw-700">' + nm + '</span></div>';
}

function renderCIDna(){
  const items = CI_SALE_ITEMS_CACHE || [];
  const tierEmojiMap = {bronze:'🥉', silver:'🥈', gold:'🥇', platinum:'💎'};
  const tierColorMap = {bronze:'#cd7f32', silver:'#c0c0c0', gold:'#ffd700', platinum:'#e5e4e2'};
  const rows = CUSTOMERS.map(c=>{
    const custItems = ciCustomerItems(c.id, items);
    const sales = ciCustomerSales(c.id);
    const tags = ciBuildDnaTags(c, custItems);
    const spent = sales.reduce((a,s)=>a+(s.total||0),0);
    const lastSale = sales.map(s=>new Date(s.created_at||s.date).getTime()).sort((a,b)=>b-a)[0];
    const daysSince = lastSale ? Math.floor((Date.now()-lastSale)/86400000) : null;
    return {c, tags, spent, visits: sales.length, daysSince};
  });

  // Sort: higher spent πρώτα
  rows.sort((a,b)=>b.spent-a.spent);

  if(!rows.length){
    return `<div class="card" style="text-align:center;padding:40px"><div class="muted">Δεν υπάρχουν πελάτες ακόμα.</div></div>`;
  }

  const cards = rows.map(r=>{
    const c = r.c;
    const tier = (c.loyaltyTier||'bronze');
    const tierEmoji = tierEmojiMap[tier] || '🥉';
    const tierColor = tierColorMap[tier] || '#cd7f32';
    const avatar = (typeof custAvatarHTML === 'function')
      ? custAvatarHTML(c.name, 50, tierEmoji, tierColor)
      : '';
    const lastTxt = r.daysSince===null ? '—' : (r.daysSince===0 ? 'σήμερα' : r.daysSince+' μέρες');
    const lastColor = (r.daysSince!==null && r.daysSince>60) ? 'var(--warn)' : 'var(--text-1)';
    const tagsHtml = r.tags.length
      ? r.tags.map(t=>`<span class="chip chip-neutral" style="font-size:11px">${t}</span>`).join('')
      : '<span class="muted text-sm">—</span>';
    const spentColor = r.spent>0 ? 'var(--accent)' : 'var(--text-2)';
    return `<div onclick="openCustomerDetail(${JSON.stringify(c.id)})" style="background:var(--bg-1);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px;cursor:pointer;-webkit-tap-highlight-color:transparent;transition:border-color .15s" ontouchstart="" onmouseover="this.style.borderColor='var(--border-strong)'" onmouseout="this.style.borderColor='var(--border)'">
      <div style="display:flex;align-items:center;gap:12px">
        ${avatar}
        <div style="flex:1;min-width:0">
          <div class="fw-800" style="font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(c.name||'').replace(/</g,'&lt;')}</div>
          <div style="font-size:11px;color:var(--text-2);margin-top:1px">${(c.phone||'—')}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="fw-800" style="font-size:16px;color:${spentColor}">${eur(r.spent)}</div>
          <div style="font-size:11px;color:var(--text-2)">${r.visits} επισκ.</div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:10px">${tagsHtml}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:11px;color:var(--text-2)">
        <span>Τελ. αγορά: <span style="color:${lastColor};font-weight:600">${lastTxt}</span></span>
        <span style="color:${tierColor};font-weight:700;text-transform:capitalize">${tierEmoji} ${tier}</span>
      </div>
    </div>`;
  }).join('');

  return `<div>${cards}</div>`;
}

/* ---------- TAB: COIL LIFE ---------- */
// Λογική: για κάθε πελάτη που έχει αγοράσει coil, υπολόγισε days από την τελευταία
// αγορά coil. Αν >= 21 μέρες → alert "μάλλον χρειάζεται νέες".
function renderCICoil(){
  const items = CI_SALE_ITEMS_CACHE || [];
  const alerts = [];

  CUSTOMERS.forEach(c=>{
    const custItems = ciCustomerItems(c.id, items);
    const coilPurchases = [];
    custItems.forEach(it=>{
      const p = PRODUCTS.find(x=>x.id===it.product_id);
      if(ciIsCoil(p)){
        const sale = SALES.find(s=>s.id===it.sale_id);
        if(sale) coilPurchases.push({date: sale.created_at||sale.date, qty: it.qty||1, name: p.name});
      }
    });
    if(!coilPurchases.length) return;

    coilPurchases.sort((a,b)=> new Date(b.date) - new Date(a.date));
    const last = coilPurchases[0];
    const daysSince = Math.floor((Date.now()-new Date(last.date).getTime())/86400000);

    // Εκτίμηση μέσης διάρκειας coil: αν έχει >=3 αγορές, υπολόγισε μέσο όρο gaps
    let avgGap = 21; // default
    if(coilPurchases.length >= 3){
      const gaps = [];
      for(let i=1; i<coilPurchases.length; i++){
        const g = (new Date(coilPurchases[i-1].date)-new Date(coilPurchases[i].date))/86400000;
        if(g>0 && g<180) gaps.push(g);
      }
      if(gaps.length) avgGap = gaps.reduce((a,b)=>a+b,0)/gaps.length;
    }

    const dueIn = avgGap - daysSince;
    const severity = daysSince >= avgGap*1.5 ? 'overdue' : daysSince >= avgGap ? 'due' : daysSince >= avgGap*0.8 ? 'soon' : 'ok';
    if(severity === 'ok') return;

    alerts.push({
      customer: c, lastCoilDate: last.date, lastCoilName: last.name,
      daysSince, avgGap: Math.round(avgGap), dueIn: Math.round(dueIn), severity,
      totalPurchases: coilPurchases.length
    });
  });

  alerts.sort((a,b)=>{
    const order = {overdue:0, due:1, soon:2};
    return (order[a.severity] - order[b.severity]) || (b.daysSince - a.daysSince);
  });

  if(!alerts.length){
    return `<div class="card" style="text-align:center;padding:40px">
      <div style="font-size:48px">✅</div>
      <div class="fw-800 text-xl mt-3">Όλοι οι πελάτες είναι ΟΚ με coils</div>
      <div class="muted mt-2">Κανένας δεν έχει ξεπεράσει τον μέσο χρόνο αντικατάστασης.</div>
    </div>`;
  }

  const sevLabel = (s) => s==='overdue' ? '🔴 Κατεπείγον' : s==='due' ? '🟡 Έφτασε η ώρα' : '🔵 Σύντομα';

  return `
    <div class="card mb-3" style="padding:14px;background:var(--bg-2)">
      <div class="text-sm">💡 <b>Λογική:</b> ο μέσος χρόνος αντικατάστασης υπολογίζεται από τις προηγούμενες αγορές coils του κάθε πελάτη. Default 21 μέρες αν δεν υπάρχει αρκετό ιστορικό.</div>
    </div>
    <div class="card" style="padding:0">
      <table class="tbl responsive-stack">
        <thead><tr>
          <th>Πελάτης</th>
          <th>Τηλέφωνο</th>
          <th>Τελ. coil</th>
          <th style="text-align:right">Μέρες πριν</th>
          <th style="text-align:right">Συχνότητα</th>
          <th>Status</th>
        </tr></thead>
        <tbody>
          ${alerts.map(a=>`<tr>
            <td data-label="Πελάτης">${_ciNameCell(a.customer)}</td>
            <td data-label="Τηλέφωνο">${a.customer.phone?`<a href="tel:${a.customer.phone}">${a.customer.phone}</a>`:'<span class="muted">—</span>'}</td>
            <td data-label="Τελ. coil" class="text-sm">${(a.lastCoilName||'').replace(/</g,'&lt;').slice(0,40)}</td>
            <td data-label="Μέρες πριν" style="text-align:right" class="fw-700">${a.daysSince}</td>
            <td data-label="Συχνότητα" style="text-align:right" class="muted">~${a.avgGap}d</td>
            <td data-label="Status">${sevLabel(a.severity)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ---------- TAB: CHURNER DETECTOR ---------- */
// Πελάτες που είχαν σταθερή συχνότητα και σταμάτησαν.
// Heuristic: >=3 επισκέψεις παλιότερα, μέσος χρόνος μεταξύ επισκέψεων < 30d,
// αλλά δεν έχουν φανεί για >2x της μέσης συχνότητας.
function renderCIChurner(){
  const churners = [];

  CUSTOMERS.forEach(c=>{
    const sales = ciCustomerSales(c.id);
    if(sales.length < 3) return;

    const dates = sales.map(s=>new Date(s.created_at||s.date).getTime()).sort((a,b)=>a-b);
    const gaps = [];
    for(let i=1; i<dates.length; i++) gaps.push((dates[i]-dates[i-1])/86400000);
    const avgGap = gaps.reduce((a,b)=>a+b,0)/gaps.length;
    if(avgGap > 60) return; // δεν ήταν ποτέ regular

    const lastDate = dates[dates.length-1];
    const daysSince = (Date.now()-lastDate)/86400000;

    if(daysSince > avgGap*2 && daysSince > 21){
      const spent = sales.reduce((a,s)=>a+(s.total||0),0);
      churners.push({
        customer: c, avgGap: Math.round(avgGap), daysSince: Math.round(daysSince),
        lastDate, spent, visits: sales.length,
        overdueFactor: daysSince / avgGap
      });
    }
  });

  churners.sort((a,b)=>b.spent-a.spent); // χάνεις περισσότερα λεφτά → υψηλότερα

  if(!churners.length){
    return `<div class="card" style="text-align:center;padding:40px">
      <div style="font-size:48px">✅</div>
      <div class="fw-800 text-xl mt-3">Δεν εντοπίστηκαν churners</div>
      <div class="muted mt-2">Όλοι οι regular πελάτες σου είναι ενεργοί.</div>
    </div>`;
  }

  return `
    <div class="card mb-3" style="padding:14px;background:var(--bg-2)">
      <div class="text-sm">💡 <b>Λογική:</b> πελάτες με ≥3 επισκέψεις και τυπική συχνότητα &lt;60 μέρες, που έχουν να φανούν &gt;2× της μέσης συχνότητας. Ταξινομημένοι ανά lost revenue.</div>
    </div>
    <div class="card" style="padding:0">
      <table class="tbl responsive-stack">
        <thead><tr>
          <th>Πελάτης</th>
          <th>Τηλέφωνο</th>
          <th style="text-align:right">Ερχόταν κάθε</th>
          <th style="text-align:right">Λείπει</th>
          <th style="text-align:right">Αξία</th>
          <th style="text-align:right">Risk</th>
        </tr></thead>
        <tbody>
          ${churners.map(ch=>`<tr>
            <td data-label="Πελάτης">${_ciNameCell(ch.customer)}</td>
            <td data-label="Τηλέφωνο">${ch.customer.phone?`<a href="tel:${ch.customer.phone}">${ch.customer.phone}</a>`:'<span class="muted">—</span>'}</td>
            <td data-label="Συχνότητα" style="text-align:right" class="muted">~${ch.avgGap}d</td>
            <td data-label="Λείπει" style="text-align:right" class="fw-700" style="color:var(--danger)">${ch.daysSince}d</td>
            <td data-label="Αξία" style="text-align:right" class="fw-700">${ch.spent.toFixed(0)}€</td>
            <td data-label="Risk" style="text-align:right">${ch.overdueFactor>=4?'🔴':ch.overdueFactor>=3?'🟠':'🟡'} ${ch.overdueFactor.toFixed(1)}×</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ---------- TAB: FLAVOR PROFILE ---------- */
function renderCIFlavor(){
  const items = CI_SALE_ITEMS_CACHE || [];
  const profiles = [];

  CUSTOMERS.forEach(c=>{
    const custItems = ciCustomerItems(c.id, items);
    const flavors = {};
    let liquidCount = 0;
    custItems.forEach(it=>{
      const p = PRODUCTS.find(x=>x.id===it.product_id);
      if(!ciIsLiquid(p)) return;
      liquidCount += (it.qty||1);
      const fam = ciFlavorFamily(p.name);
      flavors[fam] = (flavors[fam]||0) + (it.qty||1);
    });
    if(liquidCount < 2) return; // χρειαζόμαστε ≥2 liquid purchases για σοβαρό profile

    const sorted = Object.entries(flavors).sort((a,b)=>b[1]-a[1]);
    const dominant = sorted[0];
    const dominantPct = Math.round((dominant[1]/liquidCount)*100);
    profiles.push({customer: c, dominant: dominant[0], dominantPct, liquidCount, breakdown: sorted.slice(0,3)});
  });

  profiles.sort((a,b)=>b.liquidCount - a.liquidCount);

  if(!profiles.length){
    return `<div class="card" style="text-align:center;padding:40px">
      <div style="font-size:48px">🎨</div>
      <div class="fw-800 text-xl mt-3">Δεν υπάρχει αρκετό ιστορικό</div>
      <div class="muted mt-2">Χρειάζονται ≥2 αγορές υγρών ανά πελάτη για να χτιστεί profile.</div>
    </div>`;
  }

  return `
    <div class="card mb-3" style="padding:14px;background:var(--bg-2)">
      <div class="text-sm">💡 <b>Λογική:</b> οι γεύσεις αναγνωρίζονται από τα ονόματα των υγρών (tobacco, menthol, berry, tropical κ.ά.). Πελάτες με ≥2 υγρά εμφανίζονται εδώ.</div>
    </div>
    <div class="card" style="padding:0">
      <table class="tbl responsive-stack">
        <thead><tr>
          <th>Πελάτης</th>
          <th>Κυρίαρχη γεύση</th>
          <th>Προφίλ</th>
          <th style="text-align:right">Υγρά (total)</th>
        </tr></thead>
        <tbody>
          ${profiles.map(pr=>`<tr>
            <td data-label="Πελάτης">${_ciNameCell(pr.customer)}</td>
            <td data-label="Γεύση"><span class="chip chip-neutral">${pr.dominant}</span> <span class="text-sm muted">${pr.dominantPct}%</span></td>
            <td data-label="Προφίλ" class="text-sm muted">${pr.breakdown.map(([f,n])=>`${f} ×${n}`).join(' · ')}</td>
            <td data-label="Υγρά" style="text-align:right" class="fw-700">${pr.liquidCount}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ---------- TAB: TAPERING ---------- */
// Για κάθε πελάτη, κοίτα αν οι αγορές νικοτίνης πέφτουν σταδιακά στον χρόνο.
function renderCITapering(){
  const items = CI_SALE_ITEMS_CACHE || [];
  const taperers = [];

  CUSTOMERS.forEach(c=>{
    const custItems = ciCustomerItems(c.id, items);
    // Προσπαθούμε να εξάγουμε nicotine level από τα items:
    // - αν το item έχει πεδίο `nicotine` ή `nic`, χρησιμοποιείται
    // - αλλιώς, αν το product έχει `has_nicotine` και `preferred_nicotine` από τον πελάτη, το αγνοούμε
    // - αλλιώς, ψάχνουμε regex στο όνομα: π.χ. "3mg", "6 mg"
    const nicTimeline = [];
    custItems.forEach(it=>{
      const p = PRODUCTS.find(x=>x.id===it.product_id);
      if(!p || !p.has_nicotine) return;
      const sale = SALES.find(s=>s.id===it.sale_id);
      if(!sale) return;
      let nic = it.nicotine ?? it.nic ?? null;
      if(nic===null){
        const m = (p.name||'').match(/(\d+)\s*mg/i);
        if(m) nic = +m[1];
      }
      if(nic===null) return;
      nicTimeline.push({date: sale.created_at||sale.date, nic, name: p.name});
    });

    if(nicTimeline.length < 3) return;
    nicTimeline.sort((a,b)=> new Date(a.date) - new Date(b.date));

    // Χωρίζουμε σε πρώτο/δεύτερο μισό και συγκρίνουμε μέσο όρο
    const half = Math.floor(nicTimeline.length/2);
    const early = nicTimeline.slice(0, half);
    const recent = nicTimeline.slice(-half);
    const avgEarly = early.reduce((a,x)=>a+x.nic,0)/early.length;
    const avgRecent = recent.reduce((a,x)=>a+x.nic,0)/recent.length;
    const drop = avgEarly - avgRecent;

    if(drop < 1) return; // όχι significant drop

    taperers.push({
      customer: c, avgEarly, avgRecent, drop,
      first: nicTimeline[0].nic, last: nicTimeline[nicTimeline.length-1].nic,
      count: nicTimeline.length
    });
  });

  taperers.sort((a,b)=>b.drop-a.drop);

  if(!taperers.length){
    return `<div class="card" style="text-align:center;padding:40px">
      <div style="font-size:48px">📉</div>
      <div class="fw-800 text-xl mt-3">Κανείς σε tapering phase</div>
      <div class="muted mt-2">Δεν εντοπίστηκε σταδιακή μείωση νικοτίνης. Χρειάζονται ≥3 αγορές νικοτινούχων προϊόντων ανά πελάτη.</div>
    </div>`;
  }

  return `
    <div class="card mb-3" style="padding:14px;background:var(--bg-2)">
      <div class="text-sm">💡 <b>Λογική:</b> μέσος όρος νικοτίνης στο παλιό vs πρόσφατο μισό των αγορών. Η νικοτίνη εντοπίζεται από ονόματα (π.χ. "6mg", "12mg") ή από πεδίο sale_items.</div>
    </div>
    <div class="card" style="padding:0">
      <table class="tbl responsive-stack">
        <thead><tr>
          <th>Πελάτης</th>
          <th style="text-align:right">Ξεκίνησε</th>
          <th style="text-align:right">Τώρα</th>
          <th style="text-align:right">Μείωση</th>
          <th>Πορεία</th>
        </tr></thead>
        <tbody>
          ${taperers.map(t=>`<tr>
            <td data-label="Πελάτης">${_ciNameCell(t.customer)}</td>
            <td data-label="Ξεκίνησε" style="text-align:right">${t.avgEarly.toFixed(1)}mg</td>
            <td data-label="Τώρα" style="text-align:right" class="fw-700" style="color:var(--success)">${t.avgRecent.toFixed(1)}mg</td>
            <td data-label="Μείωση" style="text-align:right">−${t.drop.toFixed(1)}mg</td>
            <td data-label="Πορεία"><span class="chip chip-neutral">${t.first}mg</span> → <span class="chip chip-neutral">${t.last}mg</span></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ---------- TAB: BIRTHDAYS ---------- */
function renderCIBirthdays(){
  const withBday = CUSTOMERS.filter(c=>c.birthday);
  const withoutBday = CUSTOMERS.filter(c=>!c.birthday);

  if(!withBday.length){
    return `
      <div class="card mb-3" style="padding:14px;background:var(--bg-2)">
        <div class="text-sm">💡 Δεν υπάρχουν γενέθλια αποθηκευμένα. Μπες στο <b>Πελάτες</b> → άνοιξε έναν πελάτη → <b>Επεξεργασία</b> → συμπλήρωσε το πεδίο "Γενέθλια".</div>
        <div class="text-xs muted mt-2">⚠️ Χρειάζεται στήλη <code>birthday</code> (type date) στον πίνακα <code>customers</code> της Supabase. Αν δεν υπάρχει, πρόσθεσε: <code>ALTER TABLE customers ADD COLUMN birthday date;</code></div>
      </div>
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:48px">🎂</div>
        <div class="fw-800 text-xl mt-3">Κανένας πελάτης με γενέθλια ακόμα</div>
        <div class="muted mt-2">${CUSTOMERS.length} πελάτες — πρόσθεσε γενέθλια στο profile τους.</div>
      </div>
    `;
  }

  // Υπολόγισε μέρες μέχρι τα επόμενα γενέθλια
  const today = new Date();
  const todayY = today.getFullYear();
  const withInfo = withBday.map(c=>{
    const [y,m,d] = (c.birthday||'').split('-').map(Number);
    if(!m || !d) return null;
    let next = new Date(todayY, m-1, d);
    if(next < new Date(todayY, today.getMonth(), today.getDate())) next = new Date(todayY+1, m-1, d);
    const daysUntil = Math.ceil((next - today)/86400000);
    const age = y ? (next.getFullYear() - y) : null;
    const isToday = m-1===today.getMonth() && d===today.getDate();
    return {c, m, d, y, daysUntil, age, isToday, nextDate: next};
  }).filter(Boolean);

  withInfo.sort((a,b)=>a.daysUntil-b.daysUntil);
  const thisMonth = withInfo.filter(x=>x.m-1===today.getMonth() || (x.daysUntil<=31));
  const todayBdays = withInfo.filter(x=>x.isToday);

  const monthName = ['Ιανουάριο','Φεβρουάριο','Μάρτιο','Απρίλιο','Μάιο','Ιούνιο','Ιούλιο','Αύγουστο','Σεπτέμβριο','Οκτώβριο','Νοέμβριο','Δεκέμβριο'][today.getMonth()];

  return `
    ${todayBdays.length ? `
      <div class="card mb-3" style="padding:18px;border-color:var(--accent);background:var(--bg-2)">
        <div class="fw-800 text-xl">🎉 Σήμερα έχουν γενέθλια!</div>
        <div class="mt-2">${todayBdays.map(t=>`<div class="fw-700">${(t.c.name||'').replace(/</g,'&lt;')}${t.age?` (${t.age} ετών)`:''} ${t.c.phone?`— <a href="tel:${t.c.phone}">${t.c.phone}</a>`:''}</div>`).join('')}</div>
      </div>
    `:''}

    <div class="grid kpi-grid mb-3">
      <div class="card kpi"><div class="kpi-label">Σύνολο με birthday</div><div class="kpi-value">${withBday.length}</div><div class="kpi-sub muted">/ ${CUSTOMERS.length} πελάτες</div></div>
      <div class="card kpi"><div class="kpi-label">Χωρίς birthday</div><div class="kpi-value" style="color:var(--warn)">${withoutBday.length}</div><div class="kpi-sub muted">συμπλήρωσε τα</div></div>
      <div class="card kpi" style="border-color:var(--accent)"><div class="kpi-label">Επόμενες 30 μέρες</div><div class="kpi-value" style="color:var(--accent)">${thisMonth.length}</div><div class="kpi-sub muted">γενέθλια προσεχώς</div></div>
    </div>

    <div class="card" style="padding:0">
      <div style="padding:14px;border-bottom:1px solid var(--border)" class="fw-700">Επόμενα γενέθλια (ταξινομημένα)</div>
      <table class="tbl responsive-stack">
        <thead><tr>
          <th>Πελάτης</th>
          <th>Ημερομηνία</th>
          <th style="text-align:right">Σε</th>
          <th style="text-align:right">Ηλικία</th>
          <th>Επικοινωνία</th>
        </tr></thead>
        <tbody>
          ${withInfo.slice(0,50).map(t=>`<tr ${t.isToday?'style="background:var(--bg-2)"':''}>
            <td data-label="Πελάτης">${_ciNameCell(t.c)}</td>
            <td data-label="Ημερομηνία">${String(t.d).padStart(2,'0')}/${String(t.m).padStart(2,'0')}${t.y?'/'+t.y:''}</td>
            <td data-label="Σε" style="text-align:right" class="fw-700">${t.isToday?'<span style="color:var(--accent)">Σήμερα!</span>':t.daysUntil+'d'}</td>
            <td data-label="Ηλικία" style="text-align:right" class="muted">${t.age?t.age+1:'—'}</td>
            <td data-label="Επικοινωνία">${t.c.phone?`<a href="tel:${t.c.phone}" class="text-sm">📞</a>`:''} ${t.c.email?`<a href="mailto:${t.c.email}" class="text-sm">✉️</a>`:''}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>

    ${withoutBday.length ? `
      <details class="card mt-3" style="padding:14px">
        <summary class="fw-700" style="cursor:pointer">Πελάτες χωρίς γενέθλια (${withoutBday.length})</summary>
        <div class="mt-2 text-sm muted">${withoutBday.slice(0,30).map(c=>(c.name||'').replace(/</g,'&lt;')).join(' · ')}${withoutBday.length>30?` ...και ${withoutBday.length-30} ακόμα`:''}</div>
      </details>
    `:''}
  `;
}

// Expose all functions globally after lazy load
(function() {
  var toExport = [renderCustomerIntel, renderCustomerIntelBody, setCITab, renderCITabBody, _winbackFavorite, renderCIWinback, _winbackMessage, ciBuildDnaTags, _affinityComputePairs, renderCIAffinity, _ciNameCell, renderCIDna, renderCICoil, renderCIChurner, renderCIFlavor, renderCITapering, renderCIBirthdays];
  var i;
  for (i = 0; i < toExport.length; i++) {
    if (typeof toExport[i] === 'function') { window[toExport[i].name] = toExport[i]; }
  }
})();
export { renderCustomerIntel };
