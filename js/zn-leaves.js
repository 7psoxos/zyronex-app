// ZyroNex modular extraction — Phase 1: pure formatters

var eur=(n)=> (n||0).toFixed(2).replace('.',',')+' €';
var fmt=(n)=> new Intl.NumberFormat('el-GR').format(n);
var dateGR=(s)=>{if(!s)return '—';const d=new Date(s);return d.toLocaleDateString('el-GR')};
function formatHours(h){
  if(!h || h < 0) return '0ω 0λ';
  const totalMin = Math.round(h * 60);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `${hours}ω ${mins.toString().padStart(2,'0')}λ`;
}

// Phase 1b: string helpers + pure constants

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function helpNormalizeGreek(s) {
  if (!s) return '';
  return s.toLowerCase()
    .replace(/ά/g, 'α').replace(/έ/g, 'ε').replace(/ή/g, 'η')
    .replace(/ί/g, 'ι').replace(/ό/g, 'ο').replace(/ύ/g, 'υ')
    .replace(/ώ/g, 'ω').replace(/ϊ/g, 'ι').replace(/ϋ/g, 'υ')
    .replace(/ΐ/g, 'ι').replace(/ΰ/g, 'υ').replace(/ς/g, 'σ');
}

function _xmlEscape(s){
  return String(s||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}

function formatMarkdown(text){
  if(!text) return '';
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^### (.+)$/gm, '<h4 style="margin-top:12px;margin-bottom:6px">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 style="margin-top:14px;margin-bottom:6px">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 style="margin-top:16px;margin-bottom:8px">$1</h2>')
    .replace(/^[•\-] (.+)$/gm, '<div style="margin:4px 0;padding-left:16px;position:relative"><span style="position:absolute;left:0;color:var(--accent)">▸</span>$1</div>')
    .replace(/\n/g, '<br>');
}

var NICOTINE_LEVELS = [0,3,6,9,12,18,20];
var DAY_NAMES_GR = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
var DAY_NAMES_GR_SHORT = ['Κυρ','Δευ','Τρι','Τετ','Πεμ','Παρ','Σαβ'];
var ACCT_MONTHS_GR = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος','Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
var EFK_RATE_PER_ML = 0.10;
var WASTE_REASONS = {
  expired: {label:'🔴 Ληγμένο', color:'var(--danger)'},
  broken: {label:'💥 Σπασμένο', color:'var(--warn)'},
  stolen: {label:'🚨 Κλεμμένο', color:'var(--danger)'},
  damaged: {label:'🩹 Κατεστραμμένο', color:'var(--warn)'},
  sample: {label:'🎁 Δείγμα/Δώρο', color:'var(--info)'},
  defective: {label:'⚠️ Ελαττωματικό', color:'var(--warn)'},
  other: {label:'❓ Άλλο', color:'var(--text-2)'}
};

// Phase 2: static Supabase + AI config
var SUPABASE_URL = 'https://wopyucsdaeamywscxfzs.supabase.co';
var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndvcHl1Y3NkYWVhbXl3c2N4ZnpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MzI3MjMsImV4cCI6MjA5MjIwODcyM30.ZCCf-fZ1IQRKMLOR2eR_eZzEg_klSH7W38m1eA2VAoE';
var AI_ENDPOINT = `${SUPABASE_URL}/functions/v1/claude-proxy`;

// Phase 3: core mutable state
var USERS = [];
var SUPPLIERS = [];
var PRODUCTS = [];
var CUSTOMERS = [];
var SALES = [];
var SALES_MONTHLY_TOTALS = {}; // { 'YYYY-MM': { total, count } } — all-time, loaded at startup
var CART = [];
var CURRENT_USER = null;
var _appReady = false; // set to true after successful login
var PIN_BUFFER = '';
var SELECTED_USER_ID = null;

// Phase 3b: categories
var DEFAULT_CATEGORIES = ['Υγρά Αναπλήρωσης','Συσκευές','Αντιστάσεις','Μπαταρίες','Αξεσουάρ'];

// Mutable list — μπορεί να επεξεργαστεί ο admin από Settings
// Πάντα διατηρεί 'Όλα' στην αρχή για filtering
var CATEGORIES = (() => {
  try {
    const saved = localStorage.getItem('vs_product_categories');
    if (saved) {
      const arr = JSON.parse(saved);
      if (Array.isArray(arr) && arr.length > 0) {
        // Φρόντισε να υπάρχει 'Όλα' στην αρχή
        return ['Όλα', ...arr.filter(c => c && c !== 'Όλα')];
      }
    }
  } catch(e) {}
  return ['Όλα', ...DEFAULT_CATEGORIES];
})();

// Phase 4a: modal system
function openModal(html){
  const m=document.createElement('div');m.className='modal-overlay';m.id='activeModal';
  m.innerHTML=`<div class="modal">${html}</div>`;
  m.addEventListener('click',e=>{if(e.target===m)closeModal()});
  document.getElementById('modalHost').appendChild(m);
  document.body.classList.add('modal-open');
  document.documentElement.classList.add('modal-open');

  // ┌─────────────────────────────────────────────────────────────┐
  // │ STICKY HEADER FIX — INLINE STYLES (νικάνε ΟΛΑ τα CSS rules) │
  // └─────────────────────────────────────────────────────────────┘
  // Inline styles έχουν τη μεγαλύτερη προτεραιότητα από κάθε external CSS,
  // ακόμα και με !important. Έτσι εξαλείφεται κάθε conflict.
  const modalEl = m.querySelector('.modal');
  if(modalEl){
    // Ενσωμάτωση στο modal-body του υπόλοιπου content (αν δεν υπάρχει ήδη wrapper)
    const head = modalEl.querySelector(':scope > .modal-head');
    let body = modalEl.querySelector(':scope > .modal-body');
    if(head && !body){
      const bodyContent = [];
      let next = head.nextSibling;
      while(next){
        const cur = next;
        next = next.nextSibling;
        bodyContent.push(cur);
      }
      body = document.createElement('div');
      body.className = 'modal-body';
      bodyContent.forEach(n => body.appendChild(n));
      modalEl.appendChild(body);
    }

    // ── INLINE STYLES — αδύνατο να ακυρωθούν από CSS rules ──
    // 1) Modal: flex container που ΔΕΝ scrolls μόνο του
    Object.assign(modalEl.style, {
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      maxHeight: 'calc(100dvh - 24px)',
      minHeight: '0'
    });

    // 2) Header: fixed στο top, δεν scrolls
    if(head){
      Object.assign(head.style, {
        flex: '0 0 auto',
        flexShrink: '0',
        position: 'relative',
        top: 'auto',
        zIndex: '10',
        background: 'var(--bg-1)'
      });
    }

    // 3) Body: το ΜΟΝΟ scrollable element
    if(body){
      Object.assign(body.style, {
        flex: '1 1 auto',
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: '0',
        webkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain'
      });
      // -webkit prefix needs setProperty για να δουλέψει
      body.style.setProperty('-webkit-overflow-scrolling', 'touch');
      body.style.setProperty('overscroll-behavior', 'contain');
    }

    // touch-move propagation για iOS
    modalEl.addEventListener('touchmove', e=>e.stopPropagation(), {passive:true});
  }

  if(typeof lucide !== 'undefined') lucide.createIcons();
}
function closeModal(){
  const m=document.getElementById('activeModal');
  if(m){
    m.classList.add('closing');
    document.body.classList.remove('modal-open');
    document.documentElement.classList.remove('modal-open');
    // Remove DOM after fade-out completes (~180ms)
    setTimeout(()=>{ if(m.parentNode) m.remove(); }, 200);
  }
}

// ╔══════════════════════════════════════════════════════════════════╗
// ║ UNIVERSAL STICKY HEADER ENFORCER                                 ║
// ╚══════════════════════════════════════════════════════════════════╝
// Παρακολουθεί το DOM για ΟΠΟΙΟΔΗΠΟΤΕ νέο .modal element
// (ακόμα και αν δημιουργείται έξω από το openModal) και εφαρμόζει
// inline styles ώστε το header να μένει σταθερά πάνω.
// Inline styles έχουν την υψηλότερη CSS specificity — αδύνατο να ακυρωθούν.
function _enforceModalLayout(modalEl){
  if(!modalEl || modalEl._stickyApplied) return;
  modalEl._stickyApplied = true;

  // 1) Modal: flex container
  Object.assign(modalEl.style, {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: '0'
  });

  // 2) Find or create body wrapper
  const head = modalEl.querySelector(':scope > .modal-head');
  let body = modalEl.querySelector(':scope > .modal-body');
  if(head && !body){
    const bodyContent = [];
    let next = head.nextSibling;
    while(next){
      const cur = next;
      next = next.nextSibling;
      bodyContent.push(cur);
    }
    if(bodyContent.length > 0){
      body = document.createElement('div');
      body.className = 'modal-body';
      bodyContent.forEach(n => body.appendChild(n));
      modalEl.appendChild(body);
    }
  }

  // 3) Header: σταθερό στο top
  if(head){
    Object.assign(head.style, {
      flex: '0 0 auto',
      flexShrink: '0',
      position: 'relative',
      zIndex: '10',
      background: 'var(--bg-1)'
    });
  }

  // 4) Body: μόνο αυτό scrolls
  if(body){
    Object.assign(body.style, {
      flex: '1 1 auto',
      overflowY: 'auto',
      overflowX: 'hidden',
      minHeight: '0'
    });
    body.style.setProperty('-webkit-overflow-scrolling', 'touch');
    body.style.setProperty('overscroll-behavior', 'contain');
  }
}

// Custom confirm dialog — αντικαθιστά το native confirm() που μπλοκάρει σε iOS Safari
function showConfirm(msg, onOk, onCancel){
  const id = 'confirmModal_'+Date.now();
  const m = document.createElement('div');
  m.className = 'modal-overlay';
  m.id = id;
  m.style.cssText = 'z-index:200';
  m.innerHTML = `<div class="modal" style="max-width:400px;padding:0">
    <div class="modal-body" style="padding:24px">
      <div class="text-sm" style="line-height:1.6;white-space:pre-wrap">${msg}</div>
      <div class="flex gap-2 mt-4" style="justify-content:flex-end">
        <button class="btn btn-ghost" id="${id}_cancel">Ακύρωση</button>
        <button class="btn btn-primary" id="${id}_ok">OK</button>
      </div>
    </div>
  </div>`;
  document.getElementById('modalHost').appendChild(m);
  document.body.classList.add('modal-open');
  const cleanup = ()=>{ m.remove(); document.body.classList.remove('modal-open'); };
  document.getElementById(`${id}_ok`).onclick = ()=>{ cleanup(); if(onOk) onOk(); };
  document.getElementById(`${id}_cancel`).onclick = ()=>{ cleanup(); if(onCancel) onCancel(); };
  lucide.createIcons();
}

// Phase 4b: session + logo
var SESSION_KEY = 'vapestation_session';
var SESSION_DAYS = 30;

function saveSession(userId){
  try{
    const expiresAt = Date.now() + SESSION_DAYS*24*60*60*1000;
    localStorage.setItem(SESSION_KEY, JSON.stringify({userId, expiresAt}));
  }catch(_){}
}
function clearSession(){
  try{ localStorage.removeItem(SESSION_KEY); }catch(_){}
}
function getSavedSession(){
  try{
    const raw = localStorage.getItem(SESSION_KEY);
    if(!raw) return null;
    const s = JSON.parse(raw);
    if(!s || !s.userId || !s.expiresAt) return null;
    if(Date.now() > s.expiresAt){ clearSession(); return null; }
    return s;
  }catch(_){ return null; }
}

var LOGO_KEY = 'vs_shop_logo_v2';  // v2 key — αποφεύγει stale data
var _CACHED_LOGO_URL = (()=>{ try{ return localStorage.getItem(LOGO_KEY)||null; }catch(e){ return null; } })();  // Άμεση φόρτωση από localStorage, Supabase override async

function getCustomLogo(){
  return _CACHED_LOGO_URL;
}

function setCustomLogo(url){
  _CACHED_LOGO_URL = url;
  try{
    if(url) localStorage.setItem(LOGO_KEY, url);
    else localStorage.removeItem(LOGO_KEY);
  }catch(e){}
}

// Phase 4c: safe router pieces
var PAGE_PERMS = {
  pos: 'pos',
  inventory: 'inventory',
  customers: 'customers',
  shipments: 'shipments',
  suppliers: 'suppliers',
  purchases: 'suppliers',
  cashbook: 'cashbook',
  'inspector-competitors': '*',  // Επιπλέον check μέσα στο page renderer για isDeveloperOwner()
  reports: '*',     // Μόνο Διαχειριστής (ευαίσθητα οικονομικά)
  vat: '*',         // Μόνο Διαχειριστής
  balance: '*',     // Μόνο Διαχειριστής
  ai: 'ai',
  bi: 'ai',
  mixology: 'pos',  // DIY & Mixology — ο Ταμίας το χρειάζεται στο ταμείο
  warroom: 'ai',
  'customer-intel': 'ai',
  campaigns: 'campaigns',
  alerts: 'alerts',
  shifts: 'users',
  banking: '*',     // Μόνο Διαχειριστής βλέπει banking
  waste: '*',       // Μόνο Διαχειριστής (απομειώσεις)
  batches: '*',     // Μόνο Διαχειριστής (παρτίδες)
  competitors: '*', // Μόνο Διαχειριστής (ανταγωνισμός)
  hardware: 'inventory',
  oracle: '*',      // The Oracle — μόνο Διαχειριστής
  brain: '*',       // The Brain — μόνο Διαχειριστής
  'seasonal-intel': '*', // Εποχική Νοημοσύνη — μόνο Διαχειριστής
  'supplier-scorecard': '*', // Βαθμολογία Προμηθευτών — μόνο Διαχειριστής
  'remember-this': '*', // Θυμάσαι αυτό; — μόνο Διαχειριστής
  'dosage-tracker': '*', // Παρακολούθηση Νικοτίνης — μόνο Διαχειριστής
  'energy-tracker': '*', // Ενέργεια & Λογαριασμοί — μόνο Διαχειριστής
  compliance: '*',
  pricewar: '*',    // Price War — μόνο Διαχειριστής
  support: '*',     // Υποστήριξη — μόνο Διαχειριστής
  helpdesk: '*',    // Help Desk — μόνο Διαχειριστής
  users: 'users',
  settings: 'settings',
  inspector: '*',   // μόνο για Διαχειριστή (πλήρη δικαιώματα)
  audit: null,      // Audit Mode — ΟΛΟΙ έχουν πρόσβαση (έλεγχοι έρχονται ξαφνικά)
  'data-cleanup': '*', // μόνο για Διαχειριστή
  'shop-changelog': '*', // Ιστορικό Αλλαγών — μόνο Διαχειριστής
  'age-log': '*', // Μητρώο Ηλικίας — μόνο Διαχειριστής
  'compliance-calendar': '*', // Ημερολόγιο Συμμόρφωσης — μόνο Διαχειριστής
  breakeven: '*', // Νεκρό Σημείο — μόνο Διαχειριστής
  legal: '*',       // Νομικά — μόνο Διαχειριστής
  help: '*',        // Knowledge Base — μόνο Διαχειριστής
  'dead-stock': '*', // Dead Stock Recovery — μόνο Διαχειριστής (κρίσιμες οικονομικές αποφάσεις)
  'expense-calendar': '*', // Ημερολόγιο Εξόδων — μόνο Διαχειριστής (πληρωμές, λογιστής)
  // ── Σελίδες που έλειπαν εντελώς (= ήταν ορατές σε ΟΛΟΥΣ). Τώρα admin-only. ──
  kiosk: '*',          // Kiosk & Idle Screen — μόνο Διαχειριστής
  plugins: '*',        // Plugin Market — μόνο Διαχειριστής
  sitebuilder: '*',    // Site Builder — μόνο Διαχειριστής
  vault: '*',          // ZyroNex Vault — μόνο Διαχειριστής
  agents: '*',         // Εξειδικευμένοι Βοηθοί — μόνο Διαχειριστής
  subscription: '*',   // Συνδρομή & Plugins — μόνο Διαχειριστής
  documents: '*',      // Έγγραφα — μόνο Διαχειριστής
  taxagent: '*',       // Λογιστήριο AI — μόνο Διαχειριστής (ευαίσθητα οικονομικά)
  'online-orders': '*',// Wolt/efood/Skroutz — μόνο Διαχειριστής
  exchange: '*',       // ZyroNex Exchange — μόνο Διαχειριστής
  pulse: '*'           // ZyroNex Pulse — μόνο Διαχειριστής
};
// Η αρχική (dashboard) είναι πάντα προσβάσιμη σε όποιον μπει στο app.
// Αν κάποιος δεν έχει κανένα permission, θα δει ένα "no access" placeholder.

function firstAllowedPage(){
  // Admin πάντα dashboard
  if(CURRENT_USER && (CURRENT_USER.perms?.includes('*'))) return 'dashboard';
  // Non-admin: προτεραιότητα βάσει ρόλου
  const role = (CURRENT_USER?.role||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if(role.includes('ταμ') || role.includes('cashier')) return can(PAGE_PERMS['pos']) ? 'pos' : 'dashboard';
  if(role.includes('αποθ') || role.includes('warehouse')) return can(PAGE_PERMS['inventory']) ? 'inventory' : 'dashboard';
  // Generic: πρώτη allowed σελίδα
  const prefOrder = ['pos','inventory','customers','shipments','suppliers','reports','alerts','ai'];
  for(const p of prefOrder){ if(can(PAGE_PERMS[p])) return p; }
  return 'dashboard';
}

function getInitialPage(){
  // Λίστα των έγκυρων pages — αν δεν είναι εδώ, fallback στο dashboard
  const validPages = ['dashboard','pos','inventory','customers','suppliers','purchases',
    'shipments','cashbook','reports','vat','bi','ai','oracle','brain','warroom','pricewar','seasonal-intel','supplier-scorecard','remember-this','dosage-tracker','energy-tracker',
    'customer-intel','mixology','campaigns','alerts','shifts','users','settings','inspector',
    'hardware','batches','waste','competitors','banking','balance','documents',
    'data-cleanup','help','legal','dead-stock','expense-calendar','compliance','audit',
    'shop-changelog','compliance-calendar','breakeven','age-log',
    'online-orders','support','helpdesk','security','inspector-competitors','plugins'];

  // 1) Αν δεν υπάρχει hash στο URL → προσπάθησε να επαναφέρεις την τελευταία σελίδα (επιβίωση από refresh)
  const hashPage = (location.hash||'').replace('#','').trim();
  if(!hashPage){
    // fresh open / refresh without hash — restore lastPage if it's still valid
    try{
      const saved = localStorage.getItem('lastPage');
      if(saved && validPages.includes(saved)){
        // respect role permissions: non-admin must be allowed on that page
        if(typeof CURRENT_USER !== 'undefined' && CURRENT_USER){
          const perms = CURRENT_USER.perms||[];
          if(perms.includes('*') || perms.includes(saved)) return saved;
        } else {
          return saved;
        }
      }
    }catch(_){}
    // no valid saved page → role default
    if(typeof CURRENT_USER !== 'undefined' && CURRENT_USER && (CURRENT_USER.perms||[]).includes('*')){
      return 'dashboard';
    }
    return null;
  }

  // 2) Υπάρχει hash → χρησιμοποίησέ το αν είναι έγκυρο
  if(validPages.includes(hashPage)) return hashPage;

  // 3) Άκυρο hash → καθάρισέ το
  try { history.replaceState(null, '', location.pathname + location.search); } catch(_){}

  // 4) Fallback σε localStorage μόνο αν υπήρχε hash αλλά ήταν άκυρο
  try{
    const saved = localStorage.getItem('lastPage');
    if(saved && validPages.includes(saved)) return saved;
  }catch(_){}

  return null;
}

// Phase 4: reload detection helper
function _isPageReload(){
  try {
    var nav = (performance.getEntriesByType && performance.getEntriesByType('navigation')[0]);
    if (nav && nav.type) return nav.type === 'reload';
    return performance.navigation && performance.navigation.type === 1;
  } catch(e){ return false; }
}

// Phase 5a: ROLE_ICONS, can, PLAN_FEATURES, ZYRONEX_PLUGINS,
//           isPluginActive, PLUGIN_SUBS_CACHE, isPluginUsable,
//           planHas, getPlanLimit, planGuard
var ROLE_ICONS = {
  admin: "data:image/png;base64,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",
  cashier: "data:image/png;base64,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",
  warehouse: "data:image/png;base64,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"
};
var can=(perm)=> CURRENT_USER && (CURRENT_USER.perms.includes('*') || CURRENT_USER.perms.includes(perm));
var PLAN_FEATURES = {
  basic: {
    // POS & Core
    pos:               true,
    inventory:         true,
    customers:         true,
    suppliers:         true,
    purchases:         true,
    shipments:         true,
    cashbook:          true,
    reports:           true,
    vat:               true,
    balance:           true,
    banking:           true,
    waste:             true,
    batches:           true,
    shifts:            true,
    hardware:          true,
    alerts:            true,
    support:           true,
    help:              true,
    settings:          true,
    users:             true,
    // Loyalty basic
    loyalty:           true,
    // myDATA
    mydata:            true,
    // Max SKUs / users
    max_users:         1,
    max_skus:          1000,
    // BLOCKED in Basic
    ai_oracle:         false,
    brain:             false,
    pricewar:          false,
    warroom:           false,
    'customer-intel':  false,
    campaigns:         false,
    mixology:          false,
    ai:                false,
    bi:                false,
    invoice_scanner:   false,
    compliance:        false,
    competitors:       false,
    inspector:         false,
    'data-cleanup':    false,
    multi_location:    false,
    api_access:        false,
    email_marketing:   false,
    // Automated
    auto_email_accountant: false,
    ergani_submission:     false,
  },
  pro: {
    // Everything in Basic
    pos:true,inventory:true,customers:true,suppliers:true,purchases:true,
    shipments:true,cashbook:true,reports:true,vat:true,balance:true,
    banking:true,waste:true,batches:true,shifts:true,hardware:true,
    alerts:true,support:true,help:true,settings:true,users:true,
    loyalty:true,mydata:true,
    max_users: 3,
    max_skus: 999999,
    // AI & Advanced — UNLOCKED
    ai_oracle:         true,
    brain:             true,
    pricewar:          true,
    warroom:           true,
    'customer-intel':  true,
    campaigns:         true,
    mixology:          true,
    ai:                true,
    bi:                true,
    invoice_scanner:   true,
    compliance:        true,
    competitors:       true,
    inspector:         true,
    'data-cleanup':    true,
    email_marketing:   true,
    auto_email_accountant: true,
    ergani_submission:     true,
    // Still locked
    multi_location:    false,
    api_access:        false,
  },
  enterprise: {
    // Everything in Pro
    pos:true,inventory:true,customers:true,suppliers:true,purchases:true,
    shipments:true,cashbook:true,reports:true,vat:true,balance:true,
    banking:true,waste:true,batches:true,shifts:true,hardware:true,
    alerts:true,support:true,help:true,settings:true,users:true,
    loyalty:true,mydata:true,ai_oracle:true,brain:true,pricewar:true,
    warroom:true,'customer-intel':true,campaigns:true,mixology:true,
    ai:true,bi:true,invoice_scanner:true,compliance:true,competitors:true,
    inspector:true,'data-cleanup':true,email_marketing:true,
    auto_email_accountant:true,ergani_submission:true,
    max_users: 999,
    max_skus:  999999,
    // Enterprise extras
    multi_location:    true,
    api_access:        true,
  },
  trial: {
    // Trial = Pro features for 14 days
    pos:true,inventory:true,customers:true,suppliers:true,purchases:true,
    shipments:true,cashbook:true,reports:true,vat:true,balance:true,
    banking:true,waste:true,batches:true,shifts:true,hardware:true,
    alerts:true,support:true,help:true,settings:true,users:true,
    loyalty:true,mydata:true,ai_oracle:true,brain:true,pricewar:true,
    warroom:true,'customer-intel':true,campaigns:true,mixology:true,
    ai:true,bi:true,invoice_scanner:true,compliance:true,competitors:true,
    inspector:true,'data-cleanup':true,email_marketing:true,
    auto_email_accountant:true,ergani_submission:true,
    multi_location:false,api_access:false,
    max_users: 3,
    max_skus: 999999,
    is_trial: true,
  }
};
var ZYRONEX_PLUGINS = [
  {
    id: 'invoice_check',
    name: 'Έλεγχος Τιμολογίου',
    icon: '🔎',
    tagline: 'Εντοπίζει αυξήσεις τιμών & λάθη χρέωσης αυτόματα.',
    price: '9,90€/μήνα',
    pricing: { monthly: 9.90, oneTime: 199 },
    category: 'Οικονομικά',
    location: 'Αποθήκη → Smart Invoice Scanner',
    about: 'Επεκτείνει τον Invoice Scanner: μόλις σκανάρεις τιμολόγιο προμηθευτή, κάθε γραμμή συγκρίνεται αυτόματα με το τελευταίο κόστος που είχες καταγράψει για το ίδιο προϊόν.',
    steps: [
      'Σκανάρεις/ανεβάζεις το τιμολόγιο όπως πάντα.',
      'Κάθε προϊόν σημαίνεται: 🔴 ακρίβυνε (+%), 🟢 φθήνυνε, ≈ ίδια τιμή, 🆕 νέο.',
      'Γίνεται μαθηματικός έλεγχος (ποσότητα × τιμή ≈ σύνολο) → ⚠️ αν υπάρχει απόκλιση.',
      'Σύνοψη πάνω-πάνω: πόσα ακρίβυναν και συνολικό επιπλέον κόστος.'
    ],
    result: 'Δεν πληρώνεις ποτέ ξανά κρυφή αύξηση ή λάθος χρέωση χωρίς να το δεις.'
  },
  {
    id: 'reorder_assistant',
    name: 'Παραγγελία με ένα κουμπί',
    icon: '🛒',
    tagline: 'Έτοιμη λίστα παραγγελίας ανά προμηθευτή σε ένα κλικ.',
    price: '12,90€/μήνα',
    pricing: { monthly: 12.9, oneTime: 259 },
    category: 'Αποθήκη',
    location: 'Αποθήκη → Εργαλεία → 🛒 Παραγγελία',
    about: 'Ενοποιεί απόθεμα, ελάχιστο όριο και ρυθμό πωλήσεων και σου ετοιμάζει έξυπνη πρόταση παραγγελίας, ομαδοποιημένη ανά προμηθευτή.',
    steps: [
      'Πατάς «🛒 Παραγγελία» στα εργαλεία της Αποθήκης.',
      'Το σύστημα βρίσκει τι τελειώνει (βάσει αποθέματος + ρυθμού + ελάχιστου).',
      'Προτείνει ποσότητες για κάλυψη ~30 ημερών, ομαδοποιημένα ανά προμηθευτή.',
      'Αντιγράφεις τη λίστα κάθε προμηθευτή έτοιμη για αποστολή.'
    ],
    result: 'Δεν μένεις ποτέ χωρίς stock και δεν χάνεις ώρες υπολογίζοντας τι να παραγγείλεις.'
  },
  {
    id: 'winback',
    name: 'Win-back Πελατών',
    icon: '🔁',
    tagline: 'Εντοπίζει πελάτες που χάνονται — πριν χαθούν.',
    price: '14,90€/μήνα',
    pricing: { monthly: 14.9, oneTime: 299 },
    category: 'Πελάτες',
    location: 'Πελάτες → Customer Intelligence → Win-back',
    about: 'Μαθαίνει τον προσωπικό ρυθμό κάθε πελάτη (πόσο συχνά έρχεται) και σε ειδοποιεί όταν κάποιος αργήσει πέρα από τη συνήθειά του — με έτοιμο μήνυμα επανάκτησης.',
    steps: [
      'Υπολογίζει το μέσο διάστημα μεταξύ επισκέψεων κάθε πελάτη.',
      'Σημαίνει όσους ξεπέρασαν τον ρυθμό τους κατά ≥50%.',
      'Δείχνει την αγαπημένη τους γεύση/προϊόν.',
      'Ετοιμάζει μήνυμα επανάκτησης έτοιμο για SMS/Viber.'
    ],
    result: 'Επαναφέρεις πελάτες που θα έφευγαν, με στοχευμένη προσφορά στη γεύση τους.'
  },
  {
    id: 'basket_affinity',
    name: 'Τι Πάει Μαζί',
    icon: '🔗',
    tagline: 'Ανακαλύπτει ποια προϊόντα αγοράζονται μαζί.',
    price: '11,90€/μήνα',
    pricing: { monthly: 11.9, oneTime: 239 },
    category: 'Πωλήσεις',
    location: 'Πελάτες → Ανάλυση Πελατών → Τι Πάει Μαζί',
    about: 'Αναλύει τις αποδείξεις σου και βρίσκει ποια προϊόντα μπαίνουν συχνά στο ίδιο καλάθι — ώστε να κάνεις στοχευμένο cross-sell στον πάγκο.',
    steps: [
      'Διαβάζει όλες τις πωλήσεις και ομαδοποιεί τα προϊόντα ανά απόδειξη.',
      'Εντοπίζει τα ζεύγη που εμφανίζονται μαζί πιο συχνά.',
      'Δείχνει «ποιος αγοράζει Α, παίρνει και Β» με ποσοστό.',
      'Σε καθοδηγεί τι να προτείνεις στην πώληση.'
    ],
    result: 'Αυξάνεις τον μέσο όρο καλαθιού προτείνοντας το σωστό συμπληρωματικό προϊόν.'
  },
  {
    id: 'smart_bundle',
    name: 'Έξυπνα Πακέτα',
    icon: '🎁',
    tagline: 'Προτείνει πακέτα προσφοράς που πουλάνε & κρατούν κέρδος.',
    price: '13,90€/μήνα',
    pricing: { monthly: 13.9, oneTime: 279 },
    category: 'Πωλήσεις',
    location: 'Αποθήκη → Εργαλεία → 🎁 Έξυπνα Πακέτα',
    about: 'Συνδυάζει «τι πάει μαζί», τι λήγει σύντομα και τι έχει καλό περιθώριο, για να σου προτείνει έτοιμα πακέτα προσφοράς.',
    steps: [
      'Εντοπίζει προϊόντα που αγοράζονται μαζί (affinity).',
      'Δίνει προτεραιότητα σε ό,τι λήγει ή έχει καλό margin.',
      'Προτείνει πακέτο με τιμή και εκτιμώμενο κέρδος.',
      'Αντιγράφεις την πρόταση έτοιμη για προσφορά.'
    ],
    result: 'Πουλάς περισσότερα, αδειάζεις stock που λήγει, χωρίς να καις περιθώριο.'
  },
  {
    id: 'expiry_markdown',
    name: 'Έκπτωση Λήξης',
    icon: '⏳',
    tagline: 'Κλιμακωτή έκπτωση σε προϊόντα που λήγουν.',
    price: '9,90€/μήνα',
    pricing: { monthly: 9.9, oneTime: 199 },
    category: 'Αποθήκη',
    location: 'Αποθήκη → Εργαλεία → ⏳ Έκπτωση Λήξης',
    about: 'Εντοπίζει τι λήγει σύντομα και προτείνει αυτόματη κλιμακωτή έκπτωση — όσο πλησιάζει η λήξη, μεγαλώνει η έκπτωση — για να πουληθεί πριν πεταχτεί.',
    steps: [
      'Βρίσκει προϊόντα που λήγουν σε 60/30/15 ημέρες.',
      'Προτείνει κλιμακωτή έκπτωση ανά ζώνη λήξης.',
      'Δείχνει πόσο κεφάλαιο κινδυνεύεις να χάσεις.',
      'Εφαρμόζεις την προτεινόμενη τιμή με ένα κλικ.'
    ],
    result: 'Μετατρέπεις ληγμένο/νεκρό stock σε ρευστό αντί για απώλεια.'
  },
  {
    id: 'site_builder',
    name: 'ZyroNex Site Builder',
    icon: '🎨',
    tagline: 'Φτιάξε επαγγελματικό website & eshop με drag & drop.',
    price: '24,90€/μήνα',
    pricing: { monthly: 24.90, oneTime: 499 },
    category: 'Marketing',
    location: 'Μενού → 🎨 Site Builder',
    about: 'Πλήρης visual website builder με έτοιμα πρότυπα, drag & drop στοιχεία, και ολοκληρωμένο eshop (καλάθι, παραγγελίες, ασφαλείς πληρωμές). Τα προϊόντα σου συνδέονται αυτόματα από την αποθήκη.',
    steps: [
      'Διάλεξε έτοιμο πρότυπο (Vape Shop, Eshop, Clean) ή ξεκίνα από το μηδέν.',
      'Πρόσθεσε στοιχεία (hero, προϊόντα, τιμοκατάλογος, gallery) με ένα tap.',
      'Τα προϊόντα σου εμφανίζονται ζωντανά από την αποθήκη με καλάθι.',
      'Δημοσίευσε το site σου — οι παραγγελίες έρχονται με ασφαλή πληρωμή.'
    ],
    result: 'Αποκτάς online παρουσία & eshop χωρίς προγραμματιστή, συνδεδεμένο με το ταμείο σου.'
  }
];
function isPluginActive(pluginId){
  try { if (_isOwnerBypass()) return true; } catch(_) {}
  // A live DB subscription counts as installed (authoritative).
  var hasDbSub = !!(PLUGIN_SUBS_CACHE && PLUGIN_SUBS_CACHE[pluginId]);
  var installedLocal = getInstalledPlugins().indexOf(pluginId) !== -1;
  if (!hasDbSub && !installedLocal) return false;
  // Respect per-plugin subscription lifecycle: a suspended/cancelled plugin is NOT active.
  try {
    var st = getPluginState(pluginId);
    if (st === 'suspended' || st === 'cancelled') return false;
  } catch(_) {}
  return true;
}
var PLUGIN_SUBS_CACHE = null; // map plugin_id -> {status, mode, current_period_end, cancel_at_period_end}
function isPluginUsable(pluginId){
  if (!isPluginActive(pluginId)) return false;
  var st = getPluginState(pluginId);
  return st !== 'suspended' && st !== 'cancelled';
}
function planHas(feature) {
  if(_isOwnerBypass()) return true; // admin βλέπει όλα
  const plan = (SHOP_SUBSCRIPTION?.plan || 'trial').toLowerCase();
  const features = PLAN_FEATURES[plan] || PLAN_FEATURES.trial;
  return features[feature] === true;
}
function getPlanLimit(limit) {
  if(_isOwnerBypass()) return 999999; // admin = unlimited
  const plan = (SHOP_SUBSCRIPTION?.plan || 'trial').toLowerCase();
  const features = PLAN_FEATURES[plan] || PLAN_FEATURES.trial;
  return features[limit] ?? 999999;
}
function planGuard(feature, requiredPlan = 'Pro') {
  if (planHas(feature)) return true;
  showUpgradePrompt(feature, requiredPlan);
  return false;
}

// Phase 5b: data loaders
async function loadHardwareCompat(){
  try{
    const {data, error} = await sb.from('hardware_compat')
      .select('device_id, consumable_id')
      .eq('shop_id', SHOP_ID);
    if(error){ console.warn('hardware_compat load error:', error); return; }
    HARDWARE_COMPAT = {};
    (data||[]).forEach(function(r){
      if(!HARDWARE_COMPAT[r.device_id]) HARDWARE_COMPAT[r.device_id] = new Set();
      HARDWARE_COMPAT[r.device_id].add(r.consumable_id);
    });
    console.log('✓ HARDWARE_COMPAT loaded:', Object.keys(HARDWARE_COMPAT).length, 'devices');
  }catch(e){ console.warn('loadHardwareCompat:', e); }
}
async function loadBankingData(){
  try{
    if(typeof sb === 'undefined' || !sb) return;
    const acc = await sb.from('bank_accounts').select('*').eq('active', true).order('id');
    if(acc.data) BANK_ACCOUNTS = acc.data;
    const cutoff = new Date(Date.now() - 365*86400000).toISOString().slice(0,10);
    const tx = await sb.from('bank_transactions').select('*').gte('transaction_date', cutoff).order('transaction_date', {ascending:false}).limit(1000);
    if(tx.data) BANK_TRANSACTIONS = tx.data;
    const cfg = await sb.from('bank_aggregator_config').select('*').eq('active', true).maybeSingle();
    if(cfg.data) BANK_AGGREGATOR_CONFIG = cfg.data;
  }catch(e){
    console.warn('[banking] load failed:', e);
  }
}
async function loadShiftsExtensions(){
  try{
    if(typeof sb === 'undefined' || !sb) return;
    const sc = await sb.from('shift_schedules').select('*').eq('active', true);
    if(sc.data) SHIFT_SCHEDULES = sc.data;
    const ls = await sb.from('labor_settings').select('*').eq('id', 1).single();
    if(ls.data) Object.assign(LABOR_SETTINGS, ls.data);
  }catch(e){
    console.warn('[shifts ext] load failed:', e);
  }
}
async function loadCustomCategoryIcons(){
  try{
    const fromFn = (typeof _origFrom === 'function') ? _origFrom : (sb && sb.from ? sb.from.bind(sb) : null);
    if(!fromFn || !SHOP_ID){
      // Fallback: localStorage
      try{
        const ls = localStorage.getItem('vs_custom_category_icons');
        if(ls) CUSTOM_CATEGORY_ICONS = JSON.parse(ls) || {};
      }catch(_){}
      return;
    }
    const {data, error} = await fromFn('shop_settings')
      .select('value')
      .eq('shop_id', SHOP_ID)
      .eq('key', 'category_icons')
      .maybeSingle();
    if(error || !data) return;
    try{
      CUSTOM_CATEGORY_ICONS = JSON.parse(data.value) || {};
    }catch(_){
      CUSTOM_CATEGORY_ICONS = {};
    }
  }catch(e){
    console.warn('Load category icons failed:', e);
  }
}
async function loadAllData(){
  try{
    console.log('🔄 loadAllData started');
    
    console.log('Querying app_users...');
    const usersRes = await sb.from('app_users').select('*').eq('active',true);
    console.log('✓ app_users loaded:', usersRes.data?.length || 0, 'users');

    await loadHardwareCompat();

    const supRes = await sb.from('suppliers').select('*').order('name');
    
    console.log('Querying products...');
    // Load products in smaller batches to avoid timeout
    const prodRes = await sb.from('products')
      .select('id,barcode,name,category,price,cost,stock,min_stock,supplier_id,alt_supplier_id,updated_at,image_url,expiry_date,has_nicotine,nicotine_options,volume_ml,vat_rate,flavor_tags,shortfill_ml,product_type,base_type,vg_pct,pg_pct,nicshot_strength,default_nic_target')
      .order('name')
      .limit(2000); // Limit to 2000 products per load
    
    console.log('Querying customers...');
    const custRes = await sb.from('customers')
      .select('id,name,email,phone,address,city,postal_code,birthday,total_spent,visits,preferred_nicotine,loyalty_points,loyalty_tier,store_credit,loyalty_qr_token')
      .order('name')
      .limit(2000);
    
    console.log('Querying sales (90-day window)...');
    const salesRes = await sb.from('sales')
      .select('id,sale_date,total,payment_method,customer_id,user_id,notes', { count: 'exact' })
      .gte('sale_date', addDays(-90))
      .order('sale_date',{ascending:false});

    console.log('Querying all-time monthly totals...');
    const monthlyRes = await sb.from('sales')
      .select('sale_date,total')
      .not('sale_date','is',null);

    console.log('Querying sale_items (90-day window)...');
    const itemsRes = await sb.from('sale_items')
      .select('id,sale_id,product_id,quantity,unit_price')
      .in('sale_id', (salesRes.data||[]).map(s=>s.id));
    console.log('✓ sale_items loaded:', itemsRes.data?.length || 0, 'items');

    // ── Resilience: ανίχνευση αν τα δεδομένα είναι περιορισμένα στη μνήμη ──
    // Το Supabase επιστρέφει το ΣΥΝΟΛΙΚΟ πλήθος (count) μαζί με τα limited rows.
    // Αν φορτώθηκαν λιγότερα από όσα υπάρχουν, σηκώνουμε flag ώστε τα στατιστικά
    // να μην παρουσιάζονται ως πλήρη (αποφυγή σιωπηλά λάθος αποφάσεων).
    try {
      const salesLoaded = (salesRes.data||[]).length;
      const salesTotal = (typeof salesRes.count === 'number') ? salesRes.count : salesLoaded;
      window._DATA_LIMITED = {
        active: salesTotal > salesLoaded,
        salesLoaded: salesLoaded,
        salesTotal: salesTotal
      };
    } catch(_) { window._DATA_LIMITED = { active:false }; }

    // Supabase connected successfully → Inspector μπορεί τώρα να γράφει logs
    INSPECTOR.dbReady = true;
    INSPECTOR.flushQueue();

    // Detailed error reporting
    if(usersRes.error){ 
      console.error('app_users error:', usersRes.error);
      throw usersRes.error; 
    }
    if(supRes.error){ console.error('suppliers error:', supRes.error); throw supRes.error; }
    if(prodRes.error){ console.error('products error:', prodRes.error); throw prodRes.error; }
    if(custRes.error){ console.error('customers error:', custRes.error); throw custRes.error; }

    console.log('Mapping USERS...');
    USERS = (usersRes.data||[]).map(u=>({
      id:u.id, name:u.name, role:u.role, pin:u.pin, perms:u.permissions||[]
    }));
    console.log('✓ USERS mapped:', USERS.length);
    
    console.log('Mapping SUPPLIERS...');
    SUPPLIERS = (supRes.data||[]).map(s=>({
      id:s.id, name:s.name, contact:s.contact, phone:s.phone, email:s.email,
      city:s.city, address:s.address, notes:s.notes,
      country_type:s.country_type||'GR', vies_number:s.vies_number||null,
      website:s.website||null, country_code:s.country_code||null
    }));
    console.log('✓ SUPPLIERS mapped:', SUPPLIERS.length);
    
    console.log('Mapping PRODUCTS...');
    PRODUCTS = (prodRes.data||[]).map(p=>({
      id:p.id, barcode:p.barcode, name:p.name, category:p.category,
      price:parseFloat(p.price), cost:parseFloat(p.cost),
      stock:p.stock, minStock:p.min_stock,
      supplier:p.supplier_id, altSupplier:p.alt_supplier_id,
      expiry:p.expiry_date, hasNicotine:p.has_nicotine,
      nicotineOptions:p.nicotine_options||[], sales30d:0,
      volumeMl: p.volume_ml?parseFloat(p.volume_ml):null,
      image_url: p.image_url||null,
      imageUrl: p.image_url||null,
      vatRate: p.vat_rate!=null?parseInt(p.vat_rate):24,
      flavorTags: Array.isArray(p.flavor_tags)?p.flavor_tags:[],
      shortfillMl: p.shortfill_ml?parseFloat(p.shortfill_ml):null,
      productType: p.product_type||'longfill',
      baseType: p.base_type||null,
      vgPct: p.vg_pct!=null?parseInt(p.vg_pct):70,
      pgPct: p.pg_pct!=null?parseInt(p.pg_pct):30,
      nicshotStrength: p.nicshot_strength?parseInt(p.nicshot_strength):20,
      defaultNicTarget: p.default_nic_target?parseFloat(p.default_nic_target):3
    }));
    console.log('✓ PRODUCTS mapped:', PRODUCTS.length);
    
    console.log('Mapping CUSTOMERS...');
    CUSTOMERS = (custRes.data||[]).map(c=>({
      id:c.id, name:c.name, phone:c.phone, email:c.email,
      totalSpent:parseFloat(c.total_spent||0), visits:c.visits||0,
      lastVisit:c.last_visit, preferredNicotine:c.preferred_nicotine, orders:[],
      loyaltyPoints: c.loyalty_points||0,
      loyaltyTier: c.loyalty_tier||'bronze',
      birthday: c.birthday||null,
      storeCredit: parseFloat(c.store_credit||0),
      loyalty_qr_token: c.loyalty_qr_token||null,
      // Shipping fields (delivery / eshop)
      address: c.address||null,
      postalCode: c.postal_code||null,
      city: c.city||null,
      floor: c.floor||null,
      doorbellName: c.doorbell_name||null,
      deliveryNotes: c.delivery_notes||null
    }));
    console.log('✓ CUSTOMERS mapped:', CUSTOMERS.length);
    
    console.log('Mapping SALES...');
    // Μετατροπή sales σε flat list για συμβατότητα με το υπάρχον UI
    const saleMap = {};
    (salesRes.data||[]).forEach(s=>{saleMap[s.id]=s});
    // Pre-compute raw item sum per sale for proportional discount distribution
    const saleItemRawSums = {};
    (itemsRes.data||[]).forEach(function(i){
      saleItemRawSums[i.sale_id] = (saleItemRawSums[i.sale_id]||0) + parseFloat(i.unit_price)*(i.quantity||1);
    });
    SALES = (itemsRes.data||[]).map(i=>{
      const s = saleMap[i.sale_id];
      const itemRaw = parseFloat(i.unit_price)*(i.quantity||1);
      // Use sales.total (discounted) distributed proportionally across items
      const saleTotal = parseFloat(s?s.total:0)||0;
      const saleRaw = saleItemRawSums[i.sale_id]||itemRaw||1;
      const itemTotal = saleRaw>0 ? itemRaw*(saleTotal/saleRaw) : itemRaw;
      return {
        id:i.id, date:s?(s.sale_date||addDays(0)):addDays(0),
        productId:i.product_id, qty:i.quantity,
        price:parseFloat(i.unit_price), total:itemTotal,
        customerId:s?s.customer_id:null, nicotine:i.nicotine_mg,
        paymentMethod:s?(s.payment_method||'other'):'other'
      };
    });

    // Build all-time monthly totals from aggregate query
    SALES_MONTHLY_TOTALS = {};
    (monthlyRes.data||[]).forEach(function(s){
      if(!s.sale_date) return;
      var m = s.sale_date.slice(0,7);
      if(!SALES_MONTHLY_TOTALS[m]) SALES_MONTHLY_TOTALS[m]={total:0,count:0};
      SALES_MONTHLY_TOTALS[m].total += parseFloat(s.total)||0;
      SALES_MONTHLY_TOTALS[m].count++;
    });
    console.log('✓ SALES_MONTHLY_TOTALS:', Object.keys(SALES_MONTHLY_TOTALS).length, 'months');

    // Υπολογισμός sales30d για κάθε προϊόν
    const cutoff = new Date(today); cutoff.setDate(cutoff.getDate()-30);
    PRODUCTS.forEach(p=>{
      p.sales30d = SALES.filter(s=>s.productId===p.id && new Date(s.date)>=cutoff)
        .reduce((a,b)=>a+b.qty,0);
    });

    // Migration: ενοποίηση ορφανών κατηγοριών (case-insensitive)
    if(typeof migrateOrphanCategories === 'function'){
      migrateOrphanCategories().catch(e => console.warn('Category migration:', e));
    }
    
    // Page restore is handled EXCLUSIVELY by the session restore paths in init()
    // (both PIN login and auto-session restore call getInitialPage() → showPage() after shifts load)
    // Calling showPage() here races with session restore and causes redirect to dashboard.

    return true;
  }catch(err){
    console.error('Load error:', err);
    return false;
  }
}
async function logShopChange(category, entity, field, oldVal, newVal, note){
  try{
    if(typeof sb === 'undefined' || !SHOP_ID) return;
    var u = (typeof CURRENT_USER !== 'undefined' && CURRENT_USER) ? CURRENT_USER : {};
    var details = {
      category: category || 'other',          // 'price' | 'cost' | 'policy' | 'catalog' | 'supplier' | 'other'
      entity: entity || '',                    // π.χ. όνομα προϊόντος ή ρύθμισης
      field: field || '',                      // π.χ. 'price', 'minMarginPct'
      old_value: (oldVal !== undefined && oldVal !== null) ? String(oldVal) : '',
      new_value: (newVal !== undefined && newVal !== null) ? String(newVal) : '',
      note: note || '',
      user_id: u.id != null ? u.id : null,
      user_name: u.name || u.username || 'Άγνωστος',
      timestamp_client: new Date().toISOString()
    };
    await sb.from('activity_log').insert({
      shop_id: SHOP_ID,
      user_id: u.id != null ? u.id : null,
      action: 'shop_change',
      details: JSON.stringify(details)
    });
  }catch(_){ /* δεν μπλοκάρουμε τη ροή αν αποτύχει το log */ }
}
async function reloadProducts(){
  const {data,error} = await sb.from('products').select('*').order('name');
  if(error) return;
  PRODUCTS = (data||[]).map(p=>({
    id:p.id, barcode:p.barcode, name:p.name, category:p.category,
    price:parseFloat(p.price), cost:parseFloat(p.cost),
    stock:p.stock, minStock:p.min_stock,
    supplier:p.supplier_id, altSupplier:p.alt_supplier_id,
    expiry:p.expiry_date, hasNicotine:p.has_nicotine,
    nicotineOptions:p.nicotine_options||[],
    image_url: p.image_url||null,
    imageUrl: p.image_url||null,
    volumeMl: p.volume_ml?parseFloat(p.volume_ml):null,
    vatRate: p.vat_rate||24,
    flavorTags: Array.isArray(p.flavor_tags)?p.flavor_tags:[],
    shortfillMl: p.shortfill_ml?parseFloat(p.shortfill_ml):null,
    productType: p.product_type||'longfill',
    baseType: p.base_type||null,
    vgPct: p.vg_pct!=null?parseInt(p.vg_pct):70,
    pgPct: p.pg_pct!=null?parseInt(p.pg_pct):30,
    nicshotStrength: p.nicshot_strength?parseInt(p.nicshot_strength):20,
    defaultNicTarget: p.default_nic_target?parseFloat(p.default_nic_target):3,
    sales30d:0
  }));
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate()-30);
  PRODUCTS.forEach(p=>{
    p.sales30d = SALES.filter(s=>s.productId===p.id && new Date(s.date)>=cutoff).reduce((a,b)=>a+b.qty,0);
  });
  // Refresh bell badge after stock data updates
  if(typeof updateNotifDot==='function') updateNotifDot();
}
async function reloadCustomers(){
  const {data,error} = await sb.from('customers')
    .select('id,name,phone,email,total_spent,visits,last_visit,preferred_nicotine,loyalty_points,loyalty_tier,birthday,store_credit,address,postal_code,city,notes,loyalty_qr_token')
    .order('name');
  if(error) return;
  CUSTOMERS = (data||[]).map(c=>({
    id:c.id, name:c.name, phone:c.phone, email:c.email,
    totalSpent:parseFloat(c.total_spent||0), visits:c.visits||0,
    lastVisit:c.last_visit, preferredNicotine:c.preferred_nicotine, orders:[],
    loyaltyPoints: c.loyalty_points||0,
    loyaltyTier: c.loyalty_tier||'bronze',
    birthday: c.birthday||null,
    storeCredit: parseFloat(c.store_credit||0),
    loyalty_qr_token: c.loyalty_qr_token||null,
    // Shipping fields
    address: c.address||null,
    postalCode: c.postal_code||null,
    city: c.city||null,
    floor: c.floor||null,
    doorbellName: c.doorbell_name||null,
    deliveryNotes: c.delivery_notes||null
  }));
}
async function loadPluginSubscriptions(){
  try {
    var res = await sb.from('shop_plugin_subscriptions')
      .select('plugin_id,status,mode,current_period_end,cancel_at_period_end')
      .eq('shop_id', SHOP_ID);
    var map = {};
    (res.data || []).forEach(function(r){ map[r.plugin_id] = r; });
    PLUGIN_SUBS_CACHE = map;
    // Refresh any visible plugin gates now that we have authoritative data.
    try { if (typeof _applyPluginGates === 'function') _applyPluginGates(); } catch(_){}
    try { if (typeof refreshNav === 'function') refreshNav(); } catch(_){}
    return map;
  } catch(e) { console.warn('[PLUGIN-SUB] load failed:', e); return null; }
}

// Phase banking: BANK_ACCOUNTS, BANK_TRANSACTIONS, BANK_AGGREGATOR_CONFIG,
// BANKING_TAB, BANKING_FILTER_ACCOUNT, BANKING_FILTER_PERIOD, renderBanking,
// saveBankAccount + all banking-only helpers
var BANK_ACCOUNTS = [];      // { id, bank_name, account_alias, iban, current_balance, ... }
var BANK_TRANSACTIONS = [];  // { id, account_id, transaction_date, amount, description, ... }
var BANK_AGGREGATOR_CONFIG = null;
var BANKING_TAB = localStorage.getItem('bankingTab') || 'overview'; // persisted across refresh
var BANKING_FILTER_ACCOUNT = ''; // account_id filter for transactions tab
var BANKING_FILTER_PERIOD = 'thisMonth';

async function renderBanking(){
  document.getElementById('content').innerHTML = `<div class="page-head"><div class="page-title">Τράπεζες</div></div><div class="muted" style="padding:40px;text-align:center">Φόρτωση...</div>`;
  await loadBankingData();
  _renderBankingPage();
}

function _renderBankingPage(){
  const isMob = window.innerWidth <= 480;
  const tabs = [
    {id:'overview',     label:'Λογαριασμοί',   shortLabel:'Λογαρ.',   icon:'landmark'},
    {id:'transactions', label:'Κινήσεις',       shortLabel:'Κινήσεις', icon:'list'},
    {id:'reconcile',    label:'Συμφωνίες',      shortLabel:'Συμφωνίες',icon:'check-circle'},
    {id:'aggregator',   label:'Aggregator API', shortLabel:'Aggr.',    icon:'plug'},
    {id:'payment_apis', label:'Payment APIs',   shortLabel:'Payments', icon:'credit-card'}
  ];
  const tabsHtml = tabs.map(t => `
    <button class="shifts-tab ${BANKING_TAB===t.id?'active':''}" onclick="switchBankingTab('${t.id}')">
      <i data-lucide="${t.icon}" size="15"></i> ${isMob ? t.shortLabel : t.label}
    </button>
  `).join('');

  // Calculate totals
  const totalBalance = BANK_ACCOUNTS.reduce((a,b)=>a+(parseFloat(b.current_balance)||0),0);

  document.getElementById('content').innerHTML = `
    <div class="page-head">
      <div>
        <div class="page-title">🏦 Τράπεζες & Λογαριασμοί</div>
        <div class="page-sub">${BANK_ACCOUNTS.length} ${BANK_ACCOUNTS.length===1?'λογαριασμός':'λογαριασμοί'} • Συνολικό υπόλοιπο: <strong style="color:var(--accent)">${eur(totalBalance)}</strong></div>
      </div>
      <div class="flex gap-2" style="flex-wrap:wrap">
        <button class="btn btn-ghost" onclick="openImportStatementModal()"><i data-lucide="upload" size="16"></i> Εισαγωγή Statement</button>
        <button class="btn btn-primary" onclick="openBankAccountModal()"><i data-lucide="plus" size="16"></i> Νέος Λογαριασμός</button>
      </div>
    </div>
    <div class="shifts-tabs-bar">${tabsHtml}</div>
    <div id="bankingTabContent"></div>
  `;
  lucide.createIcons();
  _renderBankingTabContent();
}

function switchBankingTab(tab){
  BANKING_TAB = tab;
  localStorage.setItem('bankingTab', tab);
  document.querySelectorAll('.shifts-tab').forEach(b=>b.classList.remove('active'));
  _renderBankingPage();
}

function _renderBankingTabContent(){
  const c = document.getElementById('bankingTabContent');
  if(!c) return;
  switch(BANKING_TAB){
    case 'transactions': c.innerHTML = _renderBankingTransactionsTab(); break;
    case 'reconcile':    c.innerHTML = _renderBankingReconcileTab(); break;
    case 'aggregator':   c.innerHTML = _renderBankingAggregatorTab(); break;
    case 'payment_apis': c.innerHTML = _renderBankingPaymentAPIsTab(); break;
    default:             c.innerHTML = _renderBankingOverviewTab(); break;
  }
  setTimeout(()=>lucide.createIcons(), 50);
}

// === OVERVIEW TAB ===
function _renderBankingOverviewTab(){
  const infoBanner = `
    <div class="card mb-3" style="padding:14px 18px;background:linear-gradient(135deg,rgba(0,212,168,0.06),rgba(74,163,255,0.04));border-left:3px solid var(--accent)">
      <div class="flex gap-2 items-center mb-2"><i data-lucide="landmark" size="16" style="color:var(--accent)"></i><span class="fw-700">Λογαριασμοί &amp; Υπόλοιπα</span></div>
      <div class="text-sm" style="line-height:1.8;color:var(--text-1)">
        Εδώ καταχωρείς <strong>όλους τους τραπεζικούς λογαριασμούς</strong> της επιχείρησης — επαγγελματικούς, ταμιευτηρίου, πιστωτικές κάρτες, ακόμα και μετρητά ταμείου.<br>
        Κάθε λογαριασμός εμφανίζει <strong>τρέχον υπόλοιπο</strong> και τις πιο πρόσφατες κινήσεις του. Από εδώ μπορείς επίσης να κάνεις <strong>import bank statement</strong> (CSV/MT940) για να φορτώσεις κινήσεις χειροκίνητα — ή να συνδέσεις aggregator (tab <em>Aggregator API</em>) για αυτόματη ενημέρωση.
      </div>
    </div>`;

  if(BANK_ACCOUNTS.length === 0){
    return `
    <div class="card" style="padding:40px;text-align:center">
      <i data-lucide="landmark" size="48" style="color:var(--text-2);margin-bottom:12px"></i>
      <div class="fw-700 text-lg mb-2">Δεν έχεις προσθέσει λογαριασμούς ακόμα</div>
      <div class="text-sm muted mb-3">Πρόσθεσε τους τραπεζικούς λογαριασμούς της επιχείρησης για να παρακολουθείς ταμειακή ροή και κινήσεις.</div>
      <button class="btn btn-primary" onclick="openBankAccountModal()"><i data-lucide="plus" size="16"></i> Προσθήκη πρώτου λογαριασμού</button>
    </div>` + infoBanner;
  }

  return `
    <div class="bank-accounts-grid">
      ${BANK_ACCOUNTS.map(acc => {
        const bank = GREEK_BANKS.find(b=>b.code===acc.bank_name) || GREEK_BANKS.find(b=>b.name===acc.bank_name) || {name: acc.bank_name, color:'#6b7280'};
        const recentTx = BANK_TRANSACTIONS.filter(t=>t.account_id===acc.id).slice(0,3);
        return `
        <div class="bank-account-card" style="border-left:4px solid ${bank.color}">
          <div class="bank-acc-head">
            <div style="flex:1;min-width:0">
              <div class="bank-acc-name">${acc.account_alias || bank.name}</div>
              <div class="bank-acc-bank" style="color:${bank.color}">${bank.name}</div>
              ${acc.iban?`<div class="bank-acc-iban mono">${maskIBAN(acc.iban)}</div>`:''}
            </div>
            <div class="bank-acc-actions">
              <button class="icon-btn" onclick="openBankAccountModal(${acc.id})" title="Επεξεργασία"><i data-lucide="edit-2" size="14"></i></button>
              <button class="icon-btn" onclick="deleteBankAccount(${acc.id})" style="color:var(--danger)" title="Διαγραφή"><i data-lucide="trash-2" size="14"></i></button>
            </div>
          </div>
          <div class="bank-acc-balance">
            <div class="text-xs muted">Τρέχον Υπόλοιπο</div>
            <div class="bank-acc-balance-num" style="color:${parseFloat(acc.current_balance)>=0?'var(--accent)':'#ef4444'}">${eur(parseFloat(acc.current_balance)||0)}</div>
            ${acc.last_synced_at?`<div class="text-xs muted">Τελευταία ενημέρωση: ${new Date(acc.last_synced_at).toLocaleString('el-GR')}</div>`:''}
          </div>
          ${recentTx.length>0?`
          <div class="bank-acc-recent">
            <div class="text-xs fw-700 mb-1" style="color:var(--text-2)">Πρόσφατες κινήσεις</div>
            ${recentTx.map(t=>`
              <div class="bank-acc-tx">
                <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${t.description||'—'}</div>
                <div style="color:${parseFloat(t.amount)>=0?'var(--accent)':'#ef4444'};font-weight:700;flex-shrink:0">${parseFloat(t.amount)>=0?'+':''}${eur(parseFloat(t.amount)||0)}</div>
              </div>
            `).join('')}
          </div>`:'<div class="bank-acc-recent text-xs muted">Καμία κίνηση ακόμα</div>'}
          <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="BANKING_FILTER_ACCOUNT=${acc.id};switchBankingTab('transactions')"><i data-lucide="list" size="14"></i> Κινήσεις</button>
            <button class="btn btn-ghost btn-sm" onclick="openImportStatementModal(${acc.id})"><i data-lucide="upload" size="14"></i> Statement</button>
          </div>
        </div>
      `;}).join('')}
    </div>
  ` + infoBanner;
}

// === TRANSACTIONS TAB ===
function _renderBankingTransactionsTab(){
  let filtered = BANK_TRANSACTIONS;
  if(BANKING_FILTER_ACCOUNT) filtered = filtered.filter(t=>t.account_id===+BANKING_FILTER_ACCOUNT);

  const now = new Date();
  if(BANKING_FILTER_PERIOD === 'thisMonth'){
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
    filtered = filtered.filter(t=>t.transaction_date >= start);
  }else if(BANKING_FILTER_PERIOD === 'lastMonth'){
    const start = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,10);
    const end = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0,10);
    filtered = filtered.filter(t=>t.transaction_date >= start && t.transaction_date <= end);
  }else if(BANKING_FILTER_PERIOD === 'last30'){
    const start = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
    filtered = filtered.filter(t=>t.transaction_date >= start);
  }

  const totalIn = filtered.filter(t=>parseFloat(t.amount)>0).reduce((a,b)=>a+parseFloat(b.amount),0);
  const totalOut = filtered.filter(t=>parseFloat(t.amount)<0).reduce((a,b)=>a+parseFloat(b.amount),0);

  const txInfoBanner = `
    <div class="card mt-3" style="padding:14px 18px;background:linear-gradient(135deg,rgba(0,212,168,0.06),rgba(74,163,255,0.04));border-left:3px solid var(--accent)">
      <div class="flex gap-2 items-center mb-2"><i data-lucide="list" size="16" style="color:var(--accent)"></i><span class="fw-700">Κινήσεις Λογαριασμών</span></div>
      <div class="text-sm" style="line-height:1.8;color:var(--text-1)">
        Όλες οι χρεώσεις και πιστώσεις των τραπεζικών λογαριασμών σου. Οι κινήσεις προέρχονται είτε από <strong>manual import statement</strong> (κουμπί "Εισαγωγή Statement" πάνω δεξιά) είτε αυτόματα μέσω <strong>Aggregator API</strong>. Μπορείς επίσης να προσθέσεις κίνηση χειροκίνητα με <strong>+ Νέα Κίνηση</strong>. Φιλτράρισε ανά λογαριασμό ή χρονική περίοδο.
      </div>
    </div>`;

  return `
    <div class="flex gap-2 mb-3" style="flex-wrap:wrap">
      <select class="form-select" style="max-width:240px" onchange="BANKING_FILTER_ACCOUNT=this.value;_renderBankingTabContent()">
        <option value="">Όλοι οι λογαριασμοί</option>
        ${BANK_ACCOUNTS.map(a=>`<option value="${a.id}" ${BANKING_FILTER_ACCOUNT==a.id?'selected':''}>${a.account_alias||a.bank_name}</option>`).join('')}
      </select>
      <select class="form-select" style="max-width:180px" onchange="BANKING_FILTER_PERIOD=this.value;_renderBankingTabContent()">
        <option value="thisMonth" ${BANKING_FILTER_PERIOD==='thisMonth'?'selected':''}>Τρέχων μήνας</option>
        <option value="lastMonth" ${BANKING_FILTER_PERIOD==='lastMonth'?'selected':''}>Προηγούμενος μήνας</option>
        <option value="last30" ${BANKING_FILTER_PERIOD==='last30'?'selected':''}>Τελευταίες 30 ημέρες</option>
        <option value="all" ${BANKING_FILTER_PERIOD==='all'?'selected':''}>Όλα</option>
      </select>
      <button class="btn btn-primary btn-sm" onclick="openManualTransactionModal()"><i data-lucide="plus" size="14"></i> Νέα Κίνηση</button>
    </div>

    <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      <div class="kpi card" style="flex:1;min-width:160px;padding:12px"><div class="kpi-label">Σύνολο Εισροών</div><div class="kpi-value" style="color:var(--accent)">${eur(totalIn)}</div></div>
      <div class="kpi card" style="flex:1;min-width:160px;padding:12px"><div class="kpi-label">Σύνολο Εκροών</div><div class="kpi-value" style="color:#ef4444">${eur(Math.abs(totalOut))}</div></div>
      <div class="kpi card" style="flex:1;min-width:160px;padding:12px"><div class="kpi-label">Καθαρό</div><div class="kpi-value" style="color:${(totalIn+totalOut)>=0?'var(--accent)':'#ef4444'}">${eur(totalIn+totalOut)}</div></div>
      <div class="kpi card" style="flex:1;min-width:160px;padding:12px"><div class="kpi-label">Κινήσεις</div><div class="kpi-value">${filtered.length}</div></div>
    </div>

    ${filtered.length===0?`
      <div class="card" style="padding:30px;text-align:center;color:var(--text-2)"><i data-lucide="inbox" size="32"></i><div class="mt-2">Καμία κίνηση για την επιλεγμένη περίοδο</div></div>
    `:`
    <div class="card" style="padding:0;overflow-x:auto">
      <table class="tbl">
        <thead><tr><th>Ημ/νία</th><th>Λογαριασμός</th><th>Περιγραφή</th><th>Κατηγορία</th><th class="right">Ποσό</th><th></th></tr></thead>
        <tbody>${filtered.slice(0,200).map(t=>{
          const acc = BANK_ACCOUNTS.find(a=>a.id===t.account_id);
          const cat = BANK_CATEGORIES.find(c=>c.id===t.category) || BANK_CATEGORIES[BANK_CATEGORIES.length-1];
          const isIn = parseFloat(t.amount)>=0;
          return `<tr>
            <td class="mono text-sm">${new Date(t.transaction_date).toLocaleDateString('el-GR')}</td>
            <td class="text-sm">${acc?(acc.account_alias||acc.bank_name):'—'}</td>
            <td class="text-sm" style="max-width:280px;overflow:hidden;text-overflow:ellipsis">${t.description||'—'}${t.counterparty_name?`<div class="text-xs muted">${t.counterparty_name}</div>`:''}</td>
            <td><span class="chip" style="background:${cat.color}22;color:${cat.color};font-size:11px">${cat.label}</span></td>
            <td class="right mono fw-700" style="color:${isIn?'var(--accent)':'#ef4444'}">${isIn?'+':''}${eur(parseFloat(t.amount))}</td>
            <td><div class="flex gap-1">
              <button class="icon-btn" onclick="openManualTransactionModal(${t.id})" title="Επεξεργασία"><i data-lucide="edit-2" size="12"></i></button>
              <button class="icon-btn" onclick="deleteBankTransaction(${t.id})" style="color:var(--danger)" title="Διαγραφή"><i data-lucide="trash-2" size="12"></i></button>
            </div></td>
          </tr>`;
        }).join('')}</tbody>
      </table>
      ${filtered.length>200?`<div class="text-xs muted" style="text-align:center;padding:10px">Εμφάνιση πρώτων 200 από ${filtered.length} κινήσεων</div>`:''}
    </div>`}
  ` + txInfoBanner;
}

// === RECONCILE TAB ===
function _renderBankingReconcileTab(){
  const unmatched = BANK_TRANSACTIONS.filter(t=>!t.reconciled && parseFloat(t.amount)<0);
  const matched = BANK_TRANSACTIONS.filter(t=>t.reconciled);
  return `
    <div class="card mb-3" style="padding:14px 18px;background:linear-gradient(135deg,rgba(0,212,168,0.06),rgba(74,163,255,0.04));border-left:3px solid var(--accent)">
      <div class="flex gap-2 items-center mb-1"><i data-lucide="check-circle" size="16" style="color:var(--accent)"></i><span class="fw-700">Συμφωνίες Τραπεζικών Κινήσεων</span></div>
      <div class="text-sm muted">Σύγκρινε τραπεζικές κινήσεις με τιμολόγια αγορών/πωλήσεων για auto-reconciliation.</div>
    </div>
    <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:14px">
      <div class="kpi card" style="padding:12px"><div class="kpi-label">Συμφωνημένες</div><div class="kpi-value" style="color:var(--accent)">${matched.length}</div></div>
      <div class="kpi card" style="padding:12px"><div class="kpi-label">Εκκρεμείς</div><div class="kpi-value" style="color:#f59e0b">${unmatched.length}</div></div>
      <div class="kpi card" style="padding:12px"><div class="kpi-label">Σύνολο εκκρεμών</div><div class="kpi-value">${eur(Math.abs(unmatched.reduce((a,b)=>a+parseFloat(b.amount),0)))}</div></div>
    </div>

    <!-- Τι είναι το Auto-Reconciliation -->
    <div class="card mb-3">
      <div style="font-size:15px;font-weight:800;margin-bottom:12px">🔄 Τι κάνει το Auto-Reconciliation;</div>
      <div class="text-sm" style="line-height:1.8;color:var(--text-1)">
        Κάθε φορά που κάνεις <strong>import bank statement</strong> (ή συνδεθείς με aggregator), το σύστημα έχει μια λίστα τραπεζικών κινήσεων — π.χ. <em>"Χρέωση 450,00€ στις 15/05"</em>.<br><br>
        Το auto-reconciliation <strong>αντιστοιχεί αυτόματα</strong> κάθε τραπεζική κίνηση με το αντίστοιχο έγγραφο στο σύστημα:
      </div>
      <div style="display:grid;gap:8px;margin-top:14px">
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--bg-2);border-radius:8px">
          <span style="font-size:18px;flex-shrink:0">🧾</span>
          <div class="text-sm"><strong>Χρεώσεις → Τιμολόγια Αγορών</strong><br><span style="color:var(--text-2)">Πλήρωσες έναν προμηθευτή; Το σύστημα βρίσκει το τιμολόγιο με το ίδιο ποσό και ημερομηνία και το σημειώνει ως εξοφλημένο.</span></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--bg-2);border-radius:8px">
          <span style="font-size:18px;flex-shrink:0">💰</span>
          <div class="text-sm"><strong>Πιστώσεις → Εισπράξεις Πωλήσεων</strong><br><span style="color:var(--text-2)">Μπήκαν χρήματα στον λογαριασμό; Αντιστοιχίζονται με card terminal settlements ή online παραγγελίες.</span></div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;background:var(--bg-2);border-radius:8px">
          <span style="font-size:18px;flex-shrink:0">📅</span>
          <div class="text-sm"><strong>Πάγια Έξοδα → Ημερολόγιο Εξόδων</strong><br><span style="color:var(--text-2)">Ενοίκιο, ασφάλεια, πάγια; Αντιστοιχίζονται με τις εγγραφές στο Expense Calendar και σημειώνονται ως πληρωμένα.</span></div>
        </div>
      </div>
      <div style="margin-top:14px;padding:10px 12px;background:rgba(245,158,11,0.06);border-radius:8px;font-size:12px;color:#f59e0b;line-height:1.6">
        ⏳ <strong>Έρχεται σύντομα.</strong> Η λειτουργία ενεργοποιείται μόλις υπάρχουν τραπεζικές κινήσεις — είτε μέσω manual import statement (Εισαγωγή Statement) είτε μέσω σύνδεσης aggregator (Tink / Snappi / Salt Edge) από το tab <em>Aggregator API</em>.
      </div>
    </div>
  `;
}

// === AGGREGATOR TAB ===
function _renderBankingAggregatorTab(){
  const cfg = BANK_AGGREGATOR_CONFIG;
  const aggInfoBanner = `
    <div class="card mt-3" style="padding:14px 18px;background:linear-gradient(135deg,rgba(0,212,168,0.06),rgba(74,163,255,0.04));border-left:3px solid var(--accent)">
      <div class="flex gap-2 items-center mb-2"><i data-lucide="plug" size="16" style="color:var(--accent)"></i><span class="fw-700">Banking Aggregator API</span></div>
      <div class="text-sm" style="line-height:1.8;color:var(--text-1)">
        Αντί να ανεβάζεις χειροκίνητα bank statement κάθε μήνα, ο <strong>aggregator συνδέεται απευθείας με την τράπεζά σου</strong> (μέσω PSD2/Open Banking) και τραβάει αυτόματα τις κινήσεις — κάθε μέρα ή σε real-time.<br>
        Οι providers <strong>Tink, Snappi και Salt Edge</strong> είναι αδειοδοτημένοι διαμεσολαβητές (TPP) που έχουν ήδη συμφωνίες με τις ελληνικές τράπεζες. Δεν χρειάζεσαι δικές σου τραπεζικές συμφωνίες — απλώς εγγράφεσαι σε έναν από αυτούς.
      </div>
    </div>`;

  return `
    <div class="card mb-3">
      <div class="section-title">📡 Επιλογή Provider</div>
      <div class="text-sm muted mt-2 mb-3">Διάλεξε τον aggregator που θα χρησιμοποιείς. Κάθε provider έχει διαφορετικό κόστος και διαδικασία onboarding.</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">
        ${[
          {id:'tink', name:'Tink (by Visa)', desc:'EU-wide, ~€0.30-1/connection', recommended:true},
          {id:'snappi', name:'Snappi', desc:'Ελληνικός, support στα Ελληνικά', recommended:false},
          {id:'salt_edge', name:'Salt Edge', desc:'EU-wide, χαμηλό κόστος', recommended:false}
        ].map(p=>`
          <div class="card" style="padding:12px;cursor:pointer;border:2px solid ${cfg?.provider===p.id?'var(--accent)':'var(--border)'}" onclick="_selectAggregatorProvider('${p.id}')">
            <div class="flex gap-2 items-center mb-1"><strong>${p.name}</strong>${p.recommended?'<span class="chip chip-info" style="font-size:10px">Συνιστάται</span>':''}</div>
            <div class="text-xs muted">${p.desc}</div>
            ${cfg?.provider===p.id?'<div class="text-xs mt-2" style="color:var(--accent)">✓ Επιλεγμένο</div>':''}
          </div>
        `).join('')}
      </div>
    </div>

    <div class="card">
      <div class="section-title">🔑 Credentials Provider</div>
      <div class="text-sm muted mt-2 mb-3">Συμπλήρωσε τα credentials που σου έδωσε ο aggregator. Αυτά αποθηκεύονται encrypted.</div>
      <div class="form-row"><label class="form-label">Provider</label>
        <select class="form-select" id="agg_provider">
          <option value="">— επιλογή —</option>
          <option value="tink" ${cfg?.provider==='tink'?'selected':''}>Tink</option>
          <option value="snappi" ${cfg?.provider==='snappi'?'selected':''}>Snappi</option>
          <option value="salt_edge" ${cfg?.provider==='salt_edge'?'selected':''}>Salt Edge</option>
        </select>
      </div>
      <div class="form-row"><label class="form-label">Client ID</label><input class="form-input" id="agg_client_id" value="${cfg?.client_id||''}" placeholder="From provider dashboard"></div>
      <div class="form-row"><label class="form-label">Client Secret</label><input class="form-input" type="password" id="agg_client_secret" value="${cfg?.client_secret||''}" placeholder="••••••••••••" autocomplete="off"></div>
      <div class="form-row"><label class="form-label">API Key</label><input class="form-input" type="password" id="agg_api_key" value="${cfg?.api_key||''}" placeholder="••••••••••••" autocomplete="off"></div>
      <div class="form-row"><label class="form-label">Περιβάλλον</label>
        <select class="form-select" id="agg_env">
          <option value="sandbox" ${(cfg?.environment||'sandbox')==='sandbox'?'selected':''}>Sandbox</option>
          <option value="production" ${cfg?.environment==='production'?'selected':''}>Production</option>
        </select>
      </div>
      <div class="flex gap-2 mt-3" style="flex-wrap:wrap">
        <button class="btn btn-primary" onclick="saveAggregatorConfig()"><i data-lucide="save" size="16"></i> Αποθήκευση</button>
        <button class="btn btn-ghost" onclick="testAggregatorConnection()"><i data-lucide="zap" size="16"></i> Δοκιμή σύνδεσης</button>
      </div>

      <details style="margin-top:14px">
        <summary style="cursor:pointer;font-size:13px;color:var(--text-2);user-select:none">📖 Πώς να εγγραφώ;</summary>
        <div class="text-sm" style="background:var(--bg-2);padding:12px;border-radius:8px;margin-top:8px;line-height:1.7">
          <strong>Tink (Visa):</strong> <a href="https://tink.com" target="_blank" style="color:var(--accent)">tink.com</a> → Apply for developer access (1-2 εβδομάδες approval)<br>
          <strong>Snappi (Ελλάδα):</strong> <a href="https://snappi.gr" target="_blank" style="color:var(--accent)">snappi.gr</a> → Επικοινωνία για επιχειρηματική σύνδεση<br>
          <strong>Salt Edge:</strong> <a href="https://saltedge.com" target="_blank" style="color:var(--accent)">saltedge.com</a> → Sign up + KYC (3-5 ημέρες)
        </div>
      </details>
    </div>
  ` + aggInfoBanner;
}

// === PAYMENT APIs TAB ===
// Κεντρικό σημείο διαχείρισης payment provider APIs (Viva Wallet, Piraeus Pay, Stripe, Coinbase)
// Κάθε provider έχει: credentials, webhook secret, test/live toggle, status indicator
// και τα ακριβή fields που χρειάζεται το API του όταν ενεργοποιηθεί.
function _renderBankingPaymentAPIsTab(){
  // Load saved config per provider from localStorage
  function getCfg(id){ try{ return JSON.parse(localStorage.getItem('payapi_'+id)||'{}'); }catch(_){ return {}; } }
  function saveCfg(id){ return `_savePayApi('${id}')`; }

  const providers = [
    // ── ΕΛΛΗΝΙΚΕΣ ΠΛΑΤΦΟΡΜΕΣ ────────────────────────────────────────────
    {
      id: 'viva',
      name: 'Viva Wallet',
      icon: '🏦',
      color: '#00b4d8',
      desc: 'Ελληνική πλατφόρμα πληρωμών — POS, e-payments, IBAN transfers. Πλήρης υποστήριξη AADE/myDATA.',
      docsUrl: 'https://developer.vivawallet.com',
      fields: [
        {id:'merchant_id',    label:'Merchant ID',       type:'text',     ph:'Από Viva Wallet dashboard'},
        {id:'api_key',        label:'API Key',            type:'password', ph:'vk_live_••••••••'},
        {id:'api_secret',     label:'API Secret',         type:'password', ph:'vs_live_••••••••'},
        {id:'source_code',    label:'Source Code (POS)',  type:'text',     ph:'π.χ. 8905'},
        {id:'webhook_secret', label:'Webhook Secret',     type:'password', ph:'Από Viva Webhook Settings'},
        {id:'iban',           label:'IBAN Εισπράξεων',    type:'text',     ph:'GR16 .... (για auto-reconcile)'}
      ],
      webhookEvents: ['transaction.created','transaction.reversed','transaction.completed'],
      sandboxNote: 'Sandbox: demo.vivapayments.com/api — χρησιμοποίησε demo credentials για testing'
    },
    {
      id: 'piraeus',
      name: 'Piraeus Bank Pay',
      icon: '🏛️',
      color: '#0068b4',
      desc: 'Πληρωμές μέσω Τράπεζας Πειραιώς — POS terminal API, e-banking payments, payroll integration.',
      docsUrl: 'https://www.piraeusbank.gr/el/idiotes/digital-banking/piraeus-api',
      fields: [
        {id:'client_id',       label:'Client ID',          type:'text',     ph:'Από Piraeus Developer Portal'},
        {id:'client_secret',   label:'Client Secret',      type:'password', ph:'••••••••••••'},
        {id:'merchant_code',   label:'Merchant Code',      type:'text',     ph:'π.χ. M123456'},
        {id:'pos_terminal_id', label:'POS Terminal ID',    type:'text',     ph:'π.χ. T987654'},
        {id:'webhook_secret',  label:'Webhook Secret',     type:'password', ph:'Από Piraeus portal'},
        {id:'settlement_iban', label:'IBAN Διακανονισμού', type:'text',     ph:'GR16 0172 ....'}
      ],
      webhookEvents: ['payment.authorized','payment.captured','payment.refunded','chargeback.initiated'],
      sandboxNote: 'Sandbox: apiportal.piraeusbank.gr — Απαιτείται εγγραφή ως developer'
    },
    {
      id: 'eurobank',
      name: 'Eurobank Pay',
      icon: '🏦',
      color: '#001e62',
      desc: 'Eurobank e-Commerce & POS API — card acquiring, IRIS payments, business banking integration.',
      docsUrl: 'https://www.eurobank.gr/el/epixeiriseis/psifiakes-ypiresies',
      fields: [
        {id:'merchant_id',    label:'Merchant ID',        type:'text',     ph:'Από Eurobank Business portal'},
        {id:'api_key',        label:'API Key',             type:'password', ph:'••••••••••••'},
        {id:'shared_secret',  label:'Shared Secret',      type:'password', ph:'Από e-Commerce settings'},
        {id:'pos_mid',        label:'POS MID',             type:'text',     ph:'π.χ. 0000123456'},
        {id:'webhook_secret', label:'Webhook Secret',      type:'password', ph:''},
        {id:'settlement_iban',label:'IBAN Διακανονισμού',  type:'text',     ph:'GR16 0260 ....'}
      ],
      webhookEvents: ['payment.success','payment.failed','refund.completed','chargeback.received'],
      sandboxNote: 'Test environment: ecommerce-test.eurobank.gr — Ζήτα test credentials από Eurobank Business'
    },
    {
      id: 'alpha',
      name: 'Alpha Bank Pay',
      icon: '🏦',
      color: '#0a2240',
      desc: 'Alpha Bank e-Commerce — card acquiring, installments (δόσεις), Alpha Pay QR, business APIs.',
      docsUrl: 'https://www.alpha.gr/el/epixeiriseis/psifiakes-ypiresies/e-commerce',
      fields: [
        {id:'merchant_id',    label:'Merchant ID',        type:'text',     ph:'Από Alpha Business portal'},
        {id:'api_key',        label:'API Key',             type:'password', ph:'••••••••••••'},
        {id:'shared_secret',  label:'Shared Secret',      type:'password', ph:'Από Alpha e-Commerce'},
        {id:'pos_mid',        label:'POS MID',             type:'text',     ph:'π.χ. 0000654321'},
        {id:'installments',   label:'Μέγ. Δόσεις',        type:'text',     ph:'π.χ. 12'},
        {id:'settlement_iban',label:'IBAN Διακανονισμού',  type:'text',     ph:'GR16 0140 ....'}
      ],
      webhookEvents: ['payment.approved','payment.declined','refund.processed','installment.created'],
      sandboxNote: 'Sandbox: alphapaytest.gr — Επικοινωνία με Alpha Bank Business για πρόσβαση'
    },
    {
      id: 'ethniki',
      name: 'Εθνική Τράπεζα Pay',
      icon: '🏦',
      color: '#003876',
      desc: 'NBG Business Payments API — e-Commerce acquiring, i-bank Pay, NBG POS terminals.',
      docsUrl: 'https://www.nbg.gr/el/business/digital-services',
      fields: [
        {id:'merchant_id',    label:'Merchant ID',        type:'text',     ph:'Από NBG Business portal'},
        {id:'api_key',        label:'API Key',             type:'password', ph:'••••••••••••'},
        {id:'client_id',      label:'OAuth Client ID',    type:'text',     ph:'Από NBG Developer portal'},
        {id:'client_secret',  label:'OAuth Client Secret',type:'password', ph:'••••••••••••'},
        {id:'pos_tid',        label:'POS TID',             type:'text',     ph:'π.χ. T00012345'},
        {id:'settlement_iban',label:'IBAN Διακανονισμού',  type:'text',     ph:'GR16 0110 ....'}
      ],
      webhookEvents: ['transaction.authorized','transaction.settled','refund.initiated','dispute.opened'],
      sandboxNote: 'Developer portal: developer.nbg.gr — Δωρεάν sandbox για testing'
    },
    {
      id: 'optima',
      name: 'Optima Bank Pay',
      icon: '🏦',
      color: '#e6261f',
      desc: 'Optima Bank e-Commerce & POS — νέα ελληνική τράπεζα με σύγχρονο API, γρήγορο onboarding.',
      docsUrl: 'https://www.optimabank.gr/el/epixeiriseis',
      fields: [
        {id:'merchant_id',    label:'Merchant ID',        type:'text',     ph:'Από Optima Business portal'},
        {id:'api_key',        label:'API Key',             type:'password', ph:'••••••••••••'},
        {id:'api_secret',     label:'API Secret',          type:'password', ph:'••••••••••••'},
        {id:'webhook_secret', label:'Webhook Secret',      type:'password', ph:''},
        {id:'settlement_iban',label:'IBAN Διακανονισμού',  type:'text',     ph:'GR16 0430 ....'}
      ],
      webhookEvents: ['payment.completed','payment.failed','refund.completed'],
      sandboxNote: 'Επικοινωνία με Optima Bank Business για sandbox credentials'
    },
    // ── ΔΙΕΘΝΕΙΣ ΠΛΑΤΦΟΡΜΕΣ ─────────────────────────────────────────────
    {
      id: 'stripe',
      name: 'Stripe',
      icon: '💳',
      color: '#635bff',
      desc: 'Παγκόσμια πλατφόρμα — online payments, subscriptions, card present (Terminal), invoicing. Άριστο για e-commerce.',
      docsUrl: 'https://stripe.com/docs',
      fields: [
        {id:'publishable_key', label:'Publishable Key',        type:'text',     ph:'pk_live_••••••••'},
        {id:'secret_key',      label:'Secret Key',             type:'password', ph:'sk_live_••••••••'},
        {id:'webhook_secret',  label:'Webhook Signing Secret', type:'password', ph:'whsec_••••••••'},
        {id:'terminal_loc_id', label:'Terminal Location ID',   type:'text',     ph:'tml_••••• (για card present)'},
        {id:'account_id',      label:'Connected Account ID',   type:'text',     ph:'acct_••••• (αν χρησιμοποιείς Connect)'}
      ],
      webhookEvents: ['payment_intent.succeeded','payment_intent.payment_failed','charge.refunded','customer.created'],
      sandboxNote: 'Test mode: χρησιμοποίησε pk_test_ / sk_test_ keys. Δοκιμαστικές κάρτες: 4242 4242 4242 4242'
    },
    {
      id: 'paypal',
      name: 'PayPal',
      icon: '🅿️',
      color: '#003087',
      desc: 'PayPal Checkout & PayPal Here — διεθνείς πληρωμές, buyer protection, subscriptions.',
      docsUrl: 'https://developer.paypal.com',
      fields: [
        {id:'client_id',      label:'Client ID',         type:'text',     ph:'Από PayPal Developer dashboard'},
        {id:'client_secret',  label:'Client Secret',     type:'password', ph:'••••••••••••'},
        {id:'webhook_id',     label:'Webhook ID',        type:'text',     ph:'Από PayPal Webhooks'},
        {id:'currency',       label:'Νόμισμα',            type:'text',     ph:'EUR'}
      ],
      webhookEvents: ['PAYMENT.CAPTURE.COMPLETED','PAYMENT.CAPTURE.REFUNDED','CHECKOUT.ORDER.APPROVED'],
      sandboxNote: 'Sandbox: developer.paypal.com — Δημιούργησε sandbox accounts για testing'
    },
    {
      id: 'revolut',
      name: 'Revolut Business',
      icon: '🔵',
      color: '#0075ee',
      desc: 'Revolut Pay & Business API — instant payments, multi-currency, payment links, open banking.',
      docsUrl: 'https://developer.revolut.com',
      fields: [
        {id:'api_key',        label:'API Key',            type:'password', ph:'sk_live_••••••••'},
        {id:'client_id',      label:'OAuth Client ID',   type:'text',     ph:'Από Revolut Business portal'},
        {id:'jwt_private_key',label:'JWT Private Key',   type:'password', ph:'Από Revolut API settings'},
        {id:'webhook_secret', label:'Webhook Secret',    type:'password', ph:''},
        {id:'account_id',     label:'Account ID',        type:'text',     ph:'Για auto-reconcile'}
      ],
      webhookEvents: ['ORDER_COMPLETED','ORDER_AUTHORISED','REFUND_COMPLETED','PAYOUT_CREATED'],
      sandboxNote: 'Sandbox: sandbox-merchant.revolut.com — Πλήρες test environment'
    },
    // ── CRYPTO ────────────────────────────────────────────────────────────
    {
      id: 'coinbase',
      name: 'Coinbase Commerce',
      icon: '₿',
      color: '#f7931a',
      desc: 'Πληρωμές σε crypto (BTC, ETH, USDC, κλπ). Auto-convert σε EUR μέσω Coinbase. Ιδανικό για τεχνολόγους πελάτες.',
      docsUrl: 'https://docs.cloud.coinbase.com/commerce/docs',
      fields: [
        {id:'api_key',        label:'API Key',                type:'password', ph:'Από Coinbase Commerce Settings'},
        {id:'webhook_secret', label:'Webhook Shared Secret',  type:'password', ph:'Από Webhook subscriptions'},
        {id:'auto_convert',   label:'Auto-convert σε EUR',    type:'select',   options:['Ναι','Όχι']},
        {id:'accepted_coins', label:'Αποδεκτά Coins',         type:'text',     ph:'BTC,ETH,USDC,DOGE (comma-separated)'}
      ],
      webhookEvents: ['charge:confirmed','charge:failed','charge:delayed','charge:resolved'],
      sandboxNote: 'Δεν υπάρχει sandbox — δοκιμάσου με μικροπληρωμές σε testnet πριν live'
    }
  ];

  // Logo SVGs per provider (inline, monochrome white — rendered on dark bg)
  const LOGOS = {
    viva:     `<img src="https://www.google.com/s2/favicons?domain=vivawallet.com&sz=64"     style="width:28px;height:28px;object-fit:contain;border-radius:4px">`,
    piraeus:  `<img src="https://www.google.com/s2/favicons?domain=piraeusbank.gr&sz=64"     style="width:28px;height:28px;object-fit:contain;border-radius:4px">`,
    eurobank: `<img src="https://www.google.com/s2/favicons?domain=eurobank.gr&sz=64"        style="width:28px;height:28px;object-fit:contain;border-radius:4px">`,
    alpha:    `<img src="https://www.google.com/s2/favicons?domain=alpha.gr&sz=64"           style="width:28px;height:28px;object-fit:contain;border-radius:4px">`,
    ethniki:  `<img src="https://www.google.com/s2/favicons?domain=nbg.gr&sz=64"             style="width:28px;height:28px;object-fit:contain;border-radius:4px">`,
    optima:   `<img src="https://www.google.com/s2/favicons?domain=optimabank.gr&sz=64"      style="width:28px;height:28px;object-fit:contain;border-radius:4px">`,
    stripe:   `<img src="https://www.google.com/s2/favicons?domain=stripe.com&sz=64"         style="width:28px;height:28px;object-fit:contain;border-radius:4px">`,
    paypal:   `<img src="https://www.google.com/s2/favicons?domain=paypal.com&sz=64"         style="width:28px;height:28px;object-fit:contain;border-radius:4px">`,
    revolut:  `<img src="https://www.google.com/s2/favicons?domain=revolut.com&sz=64"        style="width:28px;height:28px;object-fit:contain;border-radius:4px">`,
    coinbase: `<img src="https://www.google.com/s2/favicons?domain=coinbase.com&sz=64"       style="width:28px;height:28px;object-fit:contain;border-radius:4px">`
  };

  // Check if a provider has any meaningful credentials saved
  function isConnected(cfg){
    if(!cfg || !cfg.enabled) return false;
    return !!(cfg.api_key || cfg.secret_key || cfg.client_id || cfg.merchant_id || cfg.publishable_key);
  }

  const accentColor = 'var(--accent)';

  return `<div style="display:flex;flex-direction:column;gap:8px">` +
  providers.map(p => {
    const cfg = getCfg(p.id);
    const connected = isConnected(cfg);
    const isLive = cfg.mode === 'live';
    const expanded = !!cfg._expanded;

    const statusBadge = connected
      ? (isLive
          ? `<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(0,255,136,0.12);color:var(--accent);font-weight:700;border:1px solid rgba(0,255,136,0.3)">🟢 Live</span>`
          : `<span style="font-size:11px;padding:3px 10px;border-radius:20px;background:rgba(245,158,11,0.12);color:#f59e0b;font-weight:700;border:1px solid rgba(245,158,11,0.3)">🟡 Test</span>`)
      : '';

    const connectedTick = connected
      ? `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:20px;height:20px;flex-shrink:0">
           <circle cx="10" cy="10" r="9" fill="rgba(0,255,136,0.15)" stroke="var(--accent)" stroke-width="1.5"/>
           <path d="M6 10l3 3 5-5" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
         </svg>`
      : `<div style="width:20px;height:20px;flex-shrink:0;border-radius:50%;border:1.5px solid var(--border)"></div>`;

    const logoHtml = LOGOS[p.id] || `<span style="font-size:20px">${p.icon}</span>`;

    return `
    <div id="payapi_card_${p.id}" style="background:var(--bg-1);border-radius:12px;border:1px solid ${connected?'rgba(0,255,136,0.2)':'var(--border)'};overflow:hidden;transition:border-color 0.2s">

      <!-- COLLAPSED HEADER — always visible -->
      <div onclick="_togglePayApiCard('${p.id}')" style="display:flex;align-items:center;gap:12px;padding:14px 16px;cursor:pointer;user-select:none">
        <!-- Logo pill -->
        <div style="width:44px;height:44px;border-radius:10px;background:var(--bg-2);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
          ${LOGOS[p.id] ? LOGOS[p.id] : `<span style="font-size:22px">${p.icon}</span>`}
        </div>
        <!-- Name + logo text -->
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span style="font-weight:800;font-size:14px;color:var(--text-1)">${p.name}</span>
            ${statusBadge}
          </div>
          <div style="font-size:11px;color:var(--text-2);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.desc}</div>
        </div>
        <!-- Tick + chevron -->
        <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
          ${connectedTick}
          <div id="payapi_chevron_${p.id}" style="transition:transform 0.25s;transform:rotate(${expanded?'90deg':'0deg'});color:var(--text-2)">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </div>
        </div>
      </div>

      <!-- EXPANDED BODY -->
      <div id="payapi_body_${p.id}" style="display:${expanded?'block':'none'};border-top:1px solid var(--border);padding:16px">

        <!-- Enable + mode toggles -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">
          <label style="display:flex;align-items:center;gap:7px;cursor:pointer;font-size:13px;font-weight:600">
            <input type="checkbox" id="payapi_${p.id}_enabled" ${cfg.enabled?'checked':''} onchange="_savePayApi('${p.id}')" style="width:16px;height:16px;accent-color:var(--accent)">
            Ενεργό
          </label>
          <div style="display:flex;gap:4px;margin-left:auto">
            <button onclick="_setPayApiMode('${p.id}','test')"
              style="padding:5px 14px;border-radius:6px;border:1px solid var(--border);cursor:pointer;font-size:12px;font-weight:700;background:${!isLive?'#f59e0b':'var(--bg-2)'};color:${!isLive?'#000':'var(--text-2)'}">
              Test
            </button>
            <button onclick="_setPayApiMode('${p.id}','live')"
              style="padding:5px 14px;border-radius:6px;border:1px solid var(--border);cursor:pointer;font-size:12px;font-weight:700;background:${isLive?'var(--accent)':'var(--bg-2)'};color:${isLive?'#000':'var(--text-2)'}">
              Live
            </button>
            <a href="${p.docsUrl}" target="_blank" style="padding:5px 12px;border-radius:6px;border:1px solid var(--border);font-size:12px;font-weight:600;color:var(--text-2);text-decoration:none;background:var(--bg-2);display:flex;align-items:center;gap:4px">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 6h10M7 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Docs
            </a>
          </div>
        </div>

        <!-- Credential fields -->
        <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
          ${p.fields.map(f => {
            const val = cfg[f.id] || '';
            if(f.type === 'select'){
              return `<div><label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">${f.label}</label>
                <select class="form-select" id="payapi_${p.id}_${f.id}" onchange="_savePayApi('${p.id}')">
                  ${(f.options||[]).map(o=>`<option ${val===o?'selected':''}>${o}</option>`).join('')}
                </select></div>`;
            }
            return `<div><label style="display:block;font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">${f.label}</label>
              <input class="form-input" type="${f.type}" id="payapi_${p.id}_${f.id}" value="${val}" placeholder="${f.ph}" autocomplete="off" onchange="_savePayApi('${p.id}')"></div>`;
          }).join('')}
        </div>

        <!-- Webhook info -->
        <div style="margin-top:14px;padding:10px 12px;background:var(--bg-2);border-radius:8px">
          <div style="font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:6px">🔗 WEBHOOK URL</div>
          <code style="font-size:10px;color:var(--accent);word-break:break-all;line-height:1.6">https://wopyucsdaeamywscxfzs.supabase.co/functions/v1/payment-webhook/${p.id}</code>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px">
            ${p.webhookEvents.map(ev=>`<span style="font-size:10px;padding:2px 7px;background:rgba(0,255,136,0.07);color:var(--accent);border-radius:4px;font-family:monospace">${ev}</span>`).join('')}
          </div>
        </div>

        <!-- Sandbox note -->
        <div style="margin-top:10px;padding:8px 12px;background:rgba(245,158,11,0.06);border-radius:8px;font-size:11px;color:#f59e0b;line-height:1.6">
          💡 ${p.sandboxNote}
        </div>

        <!-- Actions -->
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="_savePayApi('${p.id}')"><i data-lucide="save" size="13"></i> Αποθήκευση</button>
          <button class="btn btn-ghost btn-sm" onclick="_testPayApiConnection('${p.id}')"><i data-lucide="zap" size="13"></i> Δοκιμή</button>
          <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="_clearPayApi('${p.id}')"><i data-lucide="trash-2" size="13"></i> Εκκαθάριση</button>
        </div>
      </div>
    </div>`;
  }).join('') + `</div>`;
}

function _togglePayApiCard(id){
  const body = document.getElementById('payapi_body_'+id);
  const chevron = document.getElementById('payapi_chevron_'+id);
  if(!body) return;
  const isOpen = body.style.display !== 'none';
  body.style.display = isOpen ? 'none' : 'block';
  if(chevron) chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
  // persist expanded state
  try{
    const cfg = JSON.parse(localStorage.getItem('payapi_'+id)||'{}');
    cfg._expanded = !isOpen;
    localStorage.setItem('payapi_'+id, JSON.stringify(cfg));
  }catch(_){}
  if(!isOpen) setTimeout(()=>lucide.createIcons(),50);
}

function _savePayApi(id){
  try{
    const cfg = JSON.parse(localStorage.getItem('payapi_'+id)||'{}');
    cfg.enabled = !!document.getElementById('payapi_'+id+'_enabled')?.checked;
    // collect all input/select fields
    document.querySelectorAll('[id^="payapi_'+id+'_"]').forEach(el=>{
      const key = el.id.replace('payapi_'+id+'_','');
      if(key === 'enabled') return;
      if(key.endsWith('_test_btn') || key.endsWith('_live_btn')) return;
      cfg[key] = el.value;
    });
    localStorage.setItem('payapi_'+id, JSON.stringify(cfg));
    toast('✅ '+id+' αποθηκεύτηκε','success');
  }catch(e){ toast('Σφάλμα: '+e.message,'danger'); }
}

function _setPayApiMode(id, mode){
  try{
    const cfg = JSON.parse(localStorage.getItem('payapi_'+id)||'{}');
    cfg.mode = mode;
    localStorage.setItem('payapi_'+id, JSON.stringify(cfg));
    // Update button styles inline without full re-render
    const testBtn = document.getElementById('payapi_'+id+'_test_btn');
    const liveBtn = document.getElementById('payapi_'+id+'_live_btn');
    if(testBtn){ testBtn.style.background = mode==='test'?'#f59e0b':'var(--bg-2)'; testBtn.style.color = mode==='test'?'#000':'var(--text-2)'; }
    if(liveBtn){ liveBtn.style.background = mode==='live'?'var(--accent)':'var(--bg-2)'; liveBtn.style.color = mode==='live'?'#000':'var(--text-2)'; }
    toast((mode==='live'?'🟢 Live mode':'🟡 Test mode')+' — '+id,'info');
  }catch(e){}
}

function _clearPayApi(id){
  if(!confirm('Διαγραφή όλων των credentials του '+id+';')) return;
  localStorage.removeItem('payapi_'+id);
  switchBankingTab('payment_apis');
}

function _testPayApiConnection(id){
  const cfg = JSON.parse(localStorage.getItem('payapi_'+id)||'{}');
  if(!cfg.api_key && !cfg.secret_key && !cfg.client_id){
    toast('⚠️ Συμπλήρωσε πρώτα credentials','warn'); return;
  }
  // Placeholder — όταν υλοποιηθεί το Edge Function θα κάνει real ping
  toast('🔌 Test σύνδεσης '+id+' — Προσεχώς (Edge Function απαιτείται)','info');
}

// === BANK ACCOUNT CRUD ===
function openBankAccountModal(id){
  const acc = id ? BANK_ACCOUNTS.find(a=>a.id===id) : {bank_name:'piraeus', account_type:'business', source:'manual', current_balance:0, initial_balance:0};
  if(!acc){ toast('Δεν βρέθηκε ο λογαριασμός','danger'); return; }

  // Build bank picker grid
  const bankPickerHtml = `
    <div id="ba_bank_picker" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;max-height:260px;overflow-y:auto;padding:2px">
      ${GREEK_BANKS.map(b=>`
        <div class="ba-bank-opt ${b.code===(acc.bank_name||'piraeus')?'selected':''}"
             data-code="${b.code}"
             onclick="_selectBankOpt(this,'${b.code}')"
             style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;border-radius:10px;border:2px solid ${b.code===(acc.bank_name||'piraeus')?'var(--accent)':'var(--border)'};background:${b.code===(acc.bank_name||'piraeus')?'rgba(0,255,136,0.07)':'var(--bg-2)'};cursor:pointer;transition:all .15s;-webkit-tap-highlight-color:transparent">
          <img src="https://www.google.com/s2/favicons?domain=${_bankDomain(b.code)}&sz=64"
               style="width:32px;height:32px;border-radius:6px;object-fit:contain"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22><rect width=%2232%22 height=%2232%22 rx=%226%22 fill=%22%23333%22/><text x=%2216%22 y=%2221%22 text-anchor=%22middle%22 font-size=%2214%22 fill=%22white%22>${b.name.charAt(0)}</text></svg>'">
          <span style="font-size:10px;text-align:center;line-height:1.2;color:var(--text-1);font-weight:600;word-break:break-word">${b.name}</span>
        </div>
      `).join('')}
    </div>
    <input type="hidden" id="ba_bank" value="${acc.bank_name||'piraeus'}">
  `;

  openModal(`<div class="modal-head">
    <h3 class="fw-800 text-xl">${id?'Επεξεργασία':'Νέος'} Λογαριασμός</h3>
    <button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button>
  </div>
  <div class="modal-body">
    <div class="form-row">
      <label class="form-label">Τράπεζα *</label>
      ${bankPickerHtml}
    </div>
    <div class="form-row"><label class="form-label">Όνομα/Alias λογαριασμού</label><input class="form-input" id="ba_alias" value="${acc.account_alias||''}" placeholder="π.χ. Επαγγελματικός Πειραιώς"></div>
    <div class="form-row"><label class="form-label">IBAN</label><input class="form-input mono" id="ba_iban" value="${acc.iban||''}" placeholder="GR16 0110 1250 0000 0001 2300 695"></div>
    <div class="form-row"><label class="form-label">Τύπος</label>
      <select class="form-select" id="ba_type">
        <option value="business" ${acc.account_type==='business'?'selected':''}>Επιχειρηματικός</option>
        <option value="savings" ${acc.account_type==='savings'?'selected':''}>Ταμιευτηρίου</option>
        <option value="credit_card" ${acc.account_type==='credit_card'?'selected':''}>Πιστωτική Κάρτα</option>
        <option value="cash" ${acc.account_type==='cash'?'selected':''}>Μετρητά</option>
      </select>
    </div>
    ${!id?`
    <div class="form-row"><label class="form-label">Αρχικό Υπόλοιπο</label><input class="form-input" type="number" step="0.01" id="ba_init_balance" value="${acc.initial_balance||0}"></div>
    <div class="form-row"><label class="form-label">Ημ/νία Αρχικού Υπολοίπου</label><input class="form-input" type="date" id="ba_init_date" value="${new Date().toISOString().slice(0,10)}"></div>
    `:`
    <div class="form-row"><label class="form-label">Τρέχον Υπόλοιπο</label><input class="form-input" type="number" step="0.01" id="ba_balance" value="${acc.current_balance||0}"></div>
    `}
    <div class="form-row"><label class="form-label">Σημειώσεις</label><textarea class="form-input form-textarea" id="ba_notes" rows="2">${acc.notes||''}</textarea></div>
    <div class="flex gap-2 mt-3" style="justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Άκυρο</button>
      <button class="btn btn-primary" onclick="saveBankAccount(${id||'null'})"><i data-lucide="save" size="16"></i> Αποθήκευση</button>
    </div>
  </div>`);
  lucide.createIcons();
}

// Returns the correct domain for Google Favicons per bank code
function _bankDomain(code){
  const map = {
    piraeus:'piraeusbank.gr', eurobank:'eurobank.gr', alpha:'alpha.gr',
    ethniki:'nbg.gr', attica:'atticabank.gr', pancreta:'pancretabank.gr',
    optima:'optimabank.gr', epirus:'coop.gr', thessalia:'bankofthessaly.gr',
    viva:'vivawallet.com', bnp:'bnpparibas.gr', citibank:'citi.com',
    hsbc:'hsbc.com', deutsche:'db.com', ing:'ing.com',
    revolut:'revolut.com', wise:'wise.com', n26:'n26.com',
    monese:'monese.com', paypal:'paypal.com', cash:'', other:''
  };
  return map[code]||'';
}

// Handles bank selection in the custom picker
function _selectBankOpt(el, code){
  document.querySelectorAll('.ba-bank-opt').forEach(opt=>{
    opt.classList.remove('selected');
    opt.style.border = '2px solid var(--border)';
    opt.style.background = 'var(--bg-2)';
  });
  el.classList.add('selected');
  el.style.border = '2px solid var(--accent)';
  el.style.background = 'rgba(0,255,136,0.07)';
  const hidden = document.getElementById('ba_bank');
  if(hidden) hidden.value = code;
}

async function saveBankAccount(id){
  const $ = (i)=>document.getElementById(i)?.value;
  const iban = ($('ba_iban')||'').replace(/\s/g,'').toUpperCase();
  if(iban && !isValidIBAN(iban)){
    if(!confirm('Το IBAN δεν φαίνεται έγκυρο. Σίγουρα θες να συνεχίσεις;')) return;
  }
  const data = {
    bank_name: $('ba_bank'),
    account_alias: $('ba_alias') || null,
    iban: iban || null,
    account_type: $('ba_type'),
    notes: $('ba_notes') || null
  };
  if(id){
    data.current_balance = parseFloat($('ba_balance')) || 0;
  }else{
    data.initial_balance = parseFloat($('ba_init_balance')) || 0;
    data.initial_balance_date = $('ba_init_date');
    data.current_balance = data.initial_balance;
    data.source = 'manual';
  }
  try{
    if(id){
      const {error} = await sb.from('bank_accounts').update(data).eq('id', id);
      if(error) throw error;
      toast('✓ Ενημερώθηκε','success');
    }else{
      const {error} = await sb.from('bank_accounts').insert(data);
      if(error) throw error;
      toast('✓ Δημιουργήθηκε','success');
    }
    closeModal();
    await loadBankingData();
    _renderBankingPage();
  }catch(e){
    toast('Σφάλμα: '+e.message,'danger');
  }
}

async function deleteBankAccount(id){
  const acc = BANK_ACCOUNTS.find(a=>a.id===id);
  if(!acc) return;
  if(!confirm(`Διαγραφή λογαριασμού "${acc.account_alias||acc.bank_name}"; Θα διαγραφούν και όλες οι κινήσεις του.`)) return;
  try{
    const {error} = await sb.from('bank_accounts').delete().eq('id', id);
    if(error) throw error;
    toast('✓ Διαγράφηκε','success');
    await loadBankingData();
    _renderBankingPage();
  }catch(e){
    toast('Σφάλμα: '+e.message,'danger');
  }
}

// === MANUAL TRANSACTION ===
function openManualTransactionModal(id){
  const t = id ? BANK_TRANSACTIONS.find(x=>x.id===id) : {transaction_date:new Date().toISOString().slice(0,10), category:'other'};
  if(!t){ toast('Δεν βρέθηκε','danger'); return; }
  if(BANK_ACCOUNTS.length===0){ toast('Πρώτα δημιούργησε λογαριασμό','warn'); return; }
  openModal(`<div class="modal-head">
    <h3 class="fw-800 text-xl">${id?'Επεξεργασία':'Νέα'} Κίνηση</h3>
    <button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button>
  </div>
  <div class="modal-body">
    <div class="form-row"><label class="form-label">Λογαριασμός *</label>
      <select class="form-select" id="bt_account">
        ${BANK_ACCOUNTS.map(a=>`<option value="${a.id}" ${t.account_id===a.id?'selected':''}>${a.account_alias||a.bank_name}</option>`).join('')}
      </select>
    </div>
    <div class="form-row"><label class="form-label">Ημερομηνία *</label><input class="form-input" type="date" id="bt_date" value="${t.transaction_date}"></div>
    <div class="form-row"><label class="form-label">Ποσό * <span class="text-xs muted">(αρνητικό για χρέωση)</span></label><input class="form-input" type="number" step="0.01" id="bt_amount" value="${t.amount||''}"></div>
    <div class="form-row"><label class="form-label">Περιγραφή</label><input class="form-input" id="bt_description" value="${t.description||''}"></div>
    <div class="form-row"><label class="form-label">Όνομα αντισυμβαλλόμενου</label><input class="form-input" id="bt_counterparty" value="${t.counterparty_name||''}"></div>
    <div class="form-row"><label class="form-label">Κατηγορία</label>
      <select class="form-select" id="bt_category">
        ${BANK_CATEGORIES.map(c=>`<option value="${c.id}" ${t.category===c.id?'selected':''}>${c.label}</option>`).join('')}
      </select>
    </div>
    <div class="flex gap-2 mt-3" style="justify-content:flex-end">
      <button class="btn btn-ghost" onclick="closeModal()">Άκυρο</button>
      <button class="btn btn-primary" onclick="saveBankTransaction(${id||'null'})"><i data-lucide="save" size="16"></i> Αποθήκευση</button>
    </div>
  </div>`);
  lucide.createIcons();
}

async function saveBankTransaction(id){
  const $ = (i)=>document.getElementById(i)?.value;
  const data = {
    account_id: parseInt($('bt_account')),
    transaction_date: $('bt_date'),
    amount: parseFloat($('bt_amount')) || 0,
    description: $('bt_description') || null,
    counterparty_name: $('bt_counterparty') || null,
    category: $('bt_category'),
    source: 'manual'
  };
  if(!data.amount){ toast('Το ποσό δεν μπορεί να είναι 0','warn'); return; }
  try{
    if(id){
      const {error} = await sb.from('bank_transactions').update(data).eq('id', id);
      if(error) throw error;
    }else{
      const {error} = await sb.from('bank_transactions').insert(data);
      if(error) throw error;
    }
    // Update account balance
    await _recalculateAccountBalance(data.account_id);
    toast('✓ Αποθηκεύτηκε','success');
    closeModal();
    await loadBankingData();
    _renderBankingPage();
  }catch(e){
    toast('Σφάλμα: '+e.message,'danger');
  }
}

async function deleteBankTransaction(id){
  if(!confirm('Διαγραφή κίνησης;')) return;
  const t = BANK_TRANSACTIONS.find(x=>x.id===id);
  try{
    const {error} = await sb.from('bank_transactions').delete().eq('id', id);
    if(error) throw error;
    if(t) await _recalculateAccountBalance(t.account_id);
    toast('✓ Διαγράφηκε','success');
    await loadBankingData();
    _renderBankingPage();
  }catch(e){ toast('Σφάλμα: '+e.message,'danger'); }
}

// Recalculate account balance from transactions
async function _recalculateAccountBalance(accountId){
  try{
    const acc = BANK_ACCOUNTS.find(a=>a.id===accountId);
    if(!acc) return;
    const {data} = await sb.from('bank_transactions').select('amount').eq('account_id', accountId);
    const sumTx = (data||[]).reduce((a,b)=>a+parseFloat(b.amount||0),0);
    const newBalance = parseFloat(acc.initial_balance||0) + sumTx;
    await sb.from('bank_accounts').update({current_balance: newBalance}).eq('id', accountId);
  }catch(e){ console.warn('balance recalc failed:', e); }
}

// === CSV/STATEMENT IMPORT ===
function openImportStatementModal(accountId){
  if(BANK_ACCOUNTS.length===0){ toast('Πρώτα δημιούργησε λογαριασμό','warn'); return; }
  openModal(`<div class="modal-head">
    <h3 class="fw-800 text-xl">📥 Εισαγωγή Statement</h3>
    <button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button>
  </div>
  <div class="modal-body">
    <div class="form-row"><label class="form-label">Λογαριασμός *</label>
      <select class="form-select" id="imp_account">
        ${BANK_ACCOUNTS.map(a=>`<option value="${a.id}" ${accountId==a.id?'selected':''}>${a.account_alias||a.bank_name}</option>`).join('')}
      </select>
    </div>
    <div class="text-sm muted mb-3">Επίλεξε αρχείο CSV ή Excel που κατέβασες από την τράπεζά σου. Το σύστημα θα προσπαθήσει να ανιχνεύσει αυτόματα τη μορφή.</div>
    <div class="form-row">
      <input type="file" id="imp_file" accept=".csv,.txt,.xls,.xlsx" style="display:none" onchange="_handleStatementFile(event)">
      <button class="btn btn-primary" onclick="document.getElementById('imp_file').click()" style="width:100%"><i data-lucide="upload" size="16"></i> Επιλογή Αρχείου</button>
    </div>
    <div id="imp_preview"></div>

    <details style="margin-top:14px">
      <summary style="cursor:pointer;font-size:13px;color:var(--text-2);user-select:none">📖 Πώς κατεβάζω statement από την τράπεζα;</summary>
      <div class="text-sm" style="background:var(--bg-2);padding:12px;border-radius:8px;margin-top:8px;line-height:1.7">
        <strong>Πειραιώς (winbank):</strong> Λογαριασμοί → Επιλογή λογαριασμού → Κινήσεις → Εξαγωγή CSV<br>
        <strong>Eurobank (e-banking):</strong> Κινήσεις → Εξαγωγή → CSV/Excel<br>
        <strong>Alpha (myAlpha):</strong> Λογαριασμός → Κινήσεις → Λήψη CSV<br>
        <strong>Εθνική (i-bank):</strong> Λογαριασμοί → Κινήσεις → Εκτύπωση/Λήψη
      </div>
    </details>
  </div>`);
  lucide.createIcons();
}

async function _handleStatementFile(ev){
  const file = ev.target.files[0];
  if(!file) return;
  const preview = document.getElementById('imp_preview');
  preview.innerHTML = '<div class="text-sm muted" style="padding:14px;text-align:center"><i data-lucide="loader-2" style="animation:spin 1s linear infinite"></i> Ανάλυση αρχείου...</div>';
  lucide.createIcons();

  try{
    let txs = [];
    if(file.name.toLowerCase().endsWith('.csv') || file.name.toLowerCase().endsWith('.txt')){
      const text = await file.text();
      txs = _parseCSVStatement(text);
    }else{
      preview.innerHTML = '<div class="text-sm" style="color:#f59e0b;padding:10px">⚠️ Excel parsing έρχεται σύντομα. Προς το παρόν χρησιμοποίησε CSV από την τράπεζά σου.</div>';
      return;
    }
    if(txs.length===0){
      preview.innerHTML = '<div class="text-sm" style="color:#ef4444;padding:10px">❌ Δεν βρέθηκαν κινήσεις στο αρχείο. Έλεγξε αν το format είναι σωστό.</div>';
      return;
    }
    _showImportPreview(txs);
  }catch(e){
    preview.innerHTML = `<div class="text-sm" style="color:#ef4444;padding:10px">❌ Σφάλμα: ${e.message}</div>`;
  }
}

// Parse CSV statement (multi-format auto-detection)
function _parseCSVStatement(text){
  const lines = text.split(/\r?\n/).filter(l=>l.trim());
  if(lines.length<2) return [];

  // Detect delimiter
  const firstLine = lines[0];
  const delim = (firstLine.match(/;/g)||[]).length > (firstLine.match(/,/g)||[]).length ? ';' : ',';

  const splitRow = (row) => {
    const result = [];
    let cur = '', inQuotes = false;
    for(let i=0; i<row.length; i++){
      const ch = row[i];
      if(ch==='"'){ inQuotes = !inQuotes; continue; }
      if(ch===delim && !inQuotes){ result.push(cur.trim()); cur=''; continue; }
      cur += ch;
    }
    result.push(cur.trim());
    return result;
  };

  const headers = splitRow(lines[0]).map(h=>h.toLowerCase().replace(/[^a-zα-ωά-ώ ]/gi,'').trim());

  // Heuristic column matching (Greek + English)
  const findCol = (...patterns) => {
    for(const p of patterns){
      const idx = headers.findIndex(h => h.includes(p.toLowerCase()));
      if(idx>=0) return idx;
    }
    return -1;
  };

  const dateCol = findCol('ημερομηνία','date','ημ/νία','ημνια');
  const descCol = findCol('περιγραφή','description','αιτιολογία','αιτιολογια');
  const amountCol = findCol('ποσό','amount','ποσο');
  const debitCol = findCol('χρέωση','debit','χρεωση');
  const creditCol = findCol('πίστωση','credit','πιστωση');

  if(dateCol<0) throw new Error('Δεν βρέθηκε στήλη ημερομηνίας');

  const txs = [];
  for(let i=1; i<lines.length; i++){
    const row = splitRow(lines[i]);
    if(row.length<2) continue;

    const dateStr = row[dateCol];
    if(!dateStr) continue;

    // Parse date (DD/MM/YYYY or YYYY-MM-DD)
    let date = null;
    const m1 = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    const m2 = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if(m1){
      const yr = m1[3].length===2?'20'+m1[3]:m1[3];
      date = `${yr}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
    }else if(m2){
      date = `${m2[1]}-${m2[2].padStart(2,'0')}-${m2[3].padStart(2,'0')}`;
    }
    if(!date) continue;

    let amount = 0;
    if(amountCol>=0){
      amount = parseFloat((row[amountCol]||'').replace(/\./g,'').replace(',','.')) || 0;
    }else if(debitCol>=0 || creditCol>=0){
      const dbt = parseFloat((row[debitCol]||'0').replace(/\./g,'').replace(',','.')) || 0;
      const crd = parseFloat((row[creditCol]||'0').replace(/\./g,'').replace(',','.')) || 0;
      amount = crd - dbt;
    }

    if(!amount) continue;

    txs.push({
      transaction_date: date,
      amount: amount,
      description: descCol>=0 ? row[descCol] : '',
      category: amount>0 ? 'sales' : 'other',
      source: 'csv'
    });
  }
  return txs;
}

var _importPreviewTxs = [];
function _showImportPreview(txs){
  _importPreviewTxs = txs;
  const totalIn = txs.filter(t=>t.amount>0).reduce((a,b)=>a+b.amount,0);
  const totalOut = txs.filter(t=>t.amount<0).reduce((a,b)=>a+b.amount,0);
  document.getElementById('imp_preview').innerHTML = `
    <div class="card mt-3" style="padding:12px">
      <div class="text-sm fw-700 mb-2">✓ Βρέθηκαν ${txs.length} κινήσεις</div>
      <div class="flex gap-3 mb-2 text-xs"><span style="color:var(--accent)">Εισροές: ${eur(totalIn)}</span><span style="color:#ef4444">Εκροές: ${eur(Math.abs(totalOut))}</span></div>
      <div style="max-height:240px;overflow-y:auto;background:var(--bg-2);padding:8px;border-radius:6px;-webkit-overflow-scrolling:touch">
        ${txs.slice(0,50).map(t=>`
          <div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
            <span class="mono">${t.transaction_date}</span>
            <span style="flex:1;margin:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.description||'—'}</span>
            <span style="color:${t.amount>=0?'var(--accent)':'#ef4444'};font-weight:600">${t.amount>=0?'+':''}${eur(t.amount)}</span>
          </div>
        `).join('')}
        ${txs.length>50?`<div class="text-xs muted" style="text-align:center;padding:6px">+ ${txs.length-50} ακόμα</div>`:''}
      </div>
      <button class="btn btn-primary mt-3" onclick="_confirmImportTransactions()" style="width:100%"><i data-lucide="check" size="16"></i> Καταχώρηση όλων</button>
    </div>
  `;
  lucide.createIcons();
}

async function _confirmImportTransactions(){
  const accountId = parseInt(document.getElementById('imp_account')?.value);
  if(!accountId){ toast('Επίλεξε λογαριασμό','warn'); return; }
  if(_importPreviewTxs.length===0) return;

  toast(`Εισαγωγή ${_importPreviewTxs.length} κινήσεων...`,'success');
  try{
    const rows = _importPreviewTxs.map(t=>({...t, account_id: accountId}));
    const {error} = await sb.from('bank_transactions').insert(rows);
    if(error) throw error;
    await _recalculateAccountBalance(accountId);
    toast(`✓ Εισήχθησαν ${rows.length} κινήσεις`,'success');
    _importPreviewTxs = [];
    closeModal();
    await loadBankingData();
    _renderBankingPage();
  }catch(e){
    toast('Σφάλμα: '+e.message,'danger');
  }
}

// === AGGREGATOR CONFIG ===
function _selectAggregatorProvider(provider){
  document.getElementById('agg_provider').value = provider;
}

async function saveAggregatorConfig(){
  const $ = (i)=>document.getElementById(i)?.value;
  const data = {
    provider: $('agg_provider'),
    client_id: $('agg_client_id') || null,
    client_secret: $('agg_client_secret') || null,
    api_key: $('agg_api_key') || null,
    environment: $('agg_env') || 'sandbox',
    active: true
  };
  if(!data.provider){ toast('Επίλεξε provider','warn'); return; }
  try{
    // Deactivate other providers first
    await sb.from('bank_aggregator_config').update({active:false}).neq('provider','none');
    // Upsert this one
    const {error} = await sb.from('bank_aggregator_config').upsert(data, {onConflict:'provider'});
    if(error) throw error;
    toast('✓ Αποθηκεύτηκε. Όταν συνδεθεί το proxy server, θα ενεργοποιηθεί το auto-sync.','success');
    await loadBankingData();
    _renderBankingPage();
  }catch(e){ toast('Σφάλμα: '+e.message,'danger'); }
}

function testAggregatorConnection(){
  const provider = document.getElementById('agg_provider')?.value;
  if(!provider){ toast('Επίλεξε provider πρώτα','warn'); return; }
  openModal(`<div class="modal-head">
    <h3 class="fw-800 text-xl">📡 Δοκιμή ${provider}</h3>
    <button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button>
  </div>
  <div class="modal-body">
    <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);padding:12px;border-radius:8px;margin-bottom:12px">
      <div class="fw-700 mb-1" style="color:#f59e0b">⚠️ Απαιτείται Server Proxy</div>
      <div class="text-xs" style="color:#fcd34d;line-height:1.6">
        Όπως και η ΑΑΔΕ, οι banking aggregators δεν επιτρέπουν direct browser calls (CORS + OAuth flows).
        Χρειάζεται deployment Supabase Edge Function ως proxy.
      </div>
    </div>
    <div class="text-sm" style="line-height:1.7">
      <strong>Όταν θα είναι έτοιμο:</strong>
      <ul style="padding-left:20px">
        <li>Ο χρήστης πατάει "Σύνδεση τράπεζας"</li>
        <li>Ανακατευθύνεται στην τράπεζα για authorization (OAuth)</li>
        <li>Επιστρέφει στο ZyroNex με consent</li>
        <li>Auto-sync κινήσεων κάθε 24 ώρες</li>
      </ul>
    </div>
    <div class="flex gap-2 mt-3" style="justify-content:flex-end">
      <button class="btn btn-primary" onclick="closeModal()">Κλείσιμο</button>
    </div>
  </div>`);
  lucide.createIcons();
}

/* ============================================================
   DAILY / WEEKLY / MONTHLY REPORTS
   ============================================================ */
function buildDailyReportHTML(){
  const s = getSettings();
  const now = new Date();
  const todayISO = addDays(0);

  const todaySalesList = SALES.filter(sale=>sale.date===todayISO);
  const totalToday = todaySalesList.reduce((a,b)=>a+b.total,0);
  const qtyToday = todaySalesList.reduce((a,b)=>a+b.qty,0);
  const avgTicket = todaySalesList.length > 0 ? totalToday/todaySalesList.length : 0;

  // Top products
  const byProduct = {};
  todaySalesList.forEach(sale=>{
    if(!byProduct[sale.productId]) byProduct[sale.productId] = {qty:0, rev:0};
    byProduct[sale.productId].qty += sale.qty;
    byProduct[sale.productId].rev += sale.total;
  });
  const topProducts = Object.entries(byProduct).sort((a,b)=>b[1].rev-a[1].rev).slice(0,5);

  // Στατιστικά
  const yestTotal = SALES.filter(sale=>sale.date===addDays(-1)).reduce((a,b)=>a+b.total,0);
  const diff = yestTotal > 0 ? ((totalToday - yestTotal) / yestTotal * 100).toFixed(1) : 0;

  const outOfStockCount = PRODUCTS.filter(p=>p.stock===0).length;
  const lowStockCount = PRODUCTS.filter(p=>p.stock>0 && p.stock<=p.minStock).length;

  // Υπολογισμός ΦΠΑ
  let vat = 0;
  todaySalesList.forEach(sale=>{
    const p = PRODUCTS.find(x=>x.id===sale.productId);
    const rate = p?.vatRate ?? 24;
    const gross = sale.total;
    const net = gross / (1 + rate/100);
    vat += (gross - net);
  });

  return `
<h2 style="margin-top:0;color:#000">📊 Αναφορά Ημέρας — ${now.toLocaleDateString('el-GR')}</h2>

<div style="background:#f0f9ff;border-left:4px solid #4aa3ff;padding:15px;margin:20px 0">
  <h3 style="margin:0 0 10px 0">Περιληπτικά</h3>
  <table style="width:100%;font-size:14px">
    <tr><td style="padding:4px 0"><b>Τζίρος:</b></td><td style="text-align:right">${totalToday.toFixed(2).replace('.',',')} €</td></tr>
    <tr><td style="padding:4px 0">Πωλήσεις:</td><td style="text-align:right">${todaySalesList.length}</td></tr>
    <tr><td style="padding:4px 0">Τεμάχια:</td><td style="text-align:right">${qtyToday}</td></tr>
    <tr><td style="padding:4px 0">Μέσος Τζίρος/Πώληση:</td><td style="text-align:right">${avgTicket.toFixed(2).replace('.',',')} €</td></tr>
    <tr><td style="padding:4px 0">ΦΠΑ:</td><td style="text-align:right">${vat.toFixed(2).replace('.',',')} €</td></tr>
    <tr><td style="padding:4px 0">vs Χθες:</td><td style="text-align:right;color:${diff>=0?'#10b981':'#ef4444'}"><b>${diff>=0?'+':''}${diff}%</b></td></tr>
  </table>
</div>

<h3 style="margin-top:24px">🏆 Top Προϊόντα Ημέρας</h3>
${topProducts.length === 0 ? '<p style="color:#999">Καμία πώληση σήμερα</p>' :
  `<table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#1a1a1a;color:#fff">
      <th style="padding:8px;text-align:left">Προϊόν</th>
      <th style="padding:8px;text-align:right">Τμχ</th>
      <th style="padding:8px;text-align:right">Τζίρος</th>
    </tr></thead>
    <tbody>${topProducts.map(([pid,v])=>{
      const p = PRODUCTS.find(x=>x.id==pid);
      return `<tr style="border-bottom:1px solid #eee"><td style="padding:8px">${p?.name||'—'}</td><td style="padding:8px;text-align:right">${v.qty}</td><td style="padding:8px;text-align:right"><b>${v.rev.toFixed(2).replace('.',',')} €</b></td></tr>`;
    }).join('')}</tbody>
  </table>`}

${(outOfStockCount > 0 || lowStockCount > 0) ? `
<div style="background:#fff7ed;border-left:4px solid #f59e0b;padding:15px;margin:20px 0">
  <h3 style="margin:0 0 10px 0">⚠️ Alerts Αποθέματος</h3>
  ${outOfStockCount > 0 ? `<p style="margin:4px 0">🔴 ${outOfStockCount} εξαντλημένα προϊόντα</p>`:''}
  ${lowStockCount > 0 ? `<p style="margin:4px 0">🟡 ${lowStockCount} προϊόντα με χαμηλό stock</p>`:''}
</div>`:''}

<p style="margin-top:30px;color:#666;font-size:12px">Αυτή η αναφορά στάλθηκε αυτόματα από το ${s.shopName||'ZyroNex'}.</p>
  `;
}

async function sendTestReport(type){
  const s = getSettings();
  const to = s.reportEmail || s.email;
  if(!to){
    toast('Βάλε email στα settings πρώτα','warn');
    return;
  }

  toast('Αποστολή δοκιμαστικού...','warn');

  try{
    const bodyHtml = buildDailyReportHTML();
    const fullHtml = buildEmailTemplate('Αναφορά Ημέρας', bodyHtml);

    await sendEmail({
      to, subject: `📊 Αναφορά Ημέρας — ${new Date().toLocaleDateString('el-GR')}`,
      html: fullHtml,
      campaignName: 'daily_report_test'
    });

    toast('Η αναφορά στάλθηκε!','success');
  }catch(err){
    toast('Σφάλμα: '+err.message,'danger');
  }
}

function previewReport(){
  const html = buildEmailTemplate('Αναφορά Ημέρας', buildDailyReportHTML());
  const w = window.open('','_blank','width=700,height=800');
  if(!w){toast('Ο browser μπλόκαρε το popup','warn');return}
  w.document.write(html);
  w.document.close();
}

async function checkScheduledReports(){
  // Καλείται στην έναρξη και κάθε ώρα. Ελέγχει αν πρέπει να στείλει report
  const s = getSettings();
  if(!s.dailyReport && !s.weeklyReport && !s.monthlyReport) return;

  const now = new Date();
  const todayKey = now.toISOString().slice(0,10);
  const hour = now.getHours();
  const minute = now.getMinutes();
  const targetTime = s.dailyReportTime || '10:00';
  const [targetH, targetM] = targetTime.split(':').map(Number);

  const lastSentKey = 'lastDailyReportDate';
  const lastSent = localStorage.getItem(lastSentKey);

  // Daily report
  if(s.dailyReport && lastSent !== todayKey){
    // Έχει φτάσει η ώρα;
    if(hour > targetH || (hour === targetH && minute >= targetM)){
      try{
        await sendTestReport('daily');
        localStorage.setItem(lastSentKey, todayKey);
        console.log('Daily report sent');
      }catch(e){console.warn('Daily report failed:', e)}
    }
  }
}

// Phase vault: VAULT_STATE, VAULT_CUSTOM_CATS_KEY, VAULT_CATEGORIES,
// renderVault + all vault-only helpers
var VAULT_STATE = { path: [], loading: false };
var VAULT_CUSTOM_CATS_KEY = 'vault_custom_categories';

// ── Κατηγορίες με sub-template ───────────────────────────────────────────────
var VAULT_CATEGORIES = [
  { id:'suppliers',  label:'Τιμολόγια Προμηθευτών', icon:'📦', color:'#4aa3ff',
    perms:{ view:['*','purchases'], download:['*','purchases'], upload:['*','purchases'], delete:['*'] },
    desc:'Τιμολόγια, Δελτία Αποστολής, Προσφορές ανά προμηθευτή',
    subTemplate:['Τιμολόγια','Δελτία Αποστολής','Προσφορές','Συμφωνητικά','Λοιπά'] },
  { id:'licenses',   label:'Άδειες & Νομικά', icon:'🏛️', color:'#9b59ff',
    perms:{ view:['*'], download:['*'], upload:['*'], delete:['*'] },
    desc:'ΦΕΚ, άδεια λειτουργίας, νομικά έγγραφα', subTemplate:[] },
  { id:'contracts',  label:'Συμβόλαια', icon:'🤝', color:'#27ae60',
    perms:{ view:['*'], download:['*'], upload:['*'], delete:['*'] },
    desc:'Συμβόλαια προμηθευτών, ενοίκιο, εργασία', subTemplate:['Ενοίκιο','Προμηθευτές','Λοιπά'] },
  { id:'hr',         label:'Ανθρώπινο Δυναμικό', icon:'👥', color:'#1abc9c',
    perms:{ view:['*'], download:['*'], upload:['*'], delete:['*'] },
    desc:'Ανά υπάλληλο: ένσημα, μισθοδοσία, άδειες, αποζημίωση',
    subTemplate:['Ένσημα','Μισθοδοσία','Άδειες & Επιδόματα','Αποζημίωση','Σύμβαση Εργασίας','Λοιπά'] },
  { id:'accounting', label:'Λογιστικά', icon:'📊', color:'#e74c3c',
    perms:{ view:['*'], download:['*'], upload:['*'], delete:['*'] },
    desc:'Ισολογισμοί, φορολογικά, ΑADE', subTemplate:['Ισολογισμοί','Φορολογικές Δηλώσεις','ΑADE','Λοιπά'] },
  { id:'utilities',  label:'Λογαριασμοί ΔΕΚΟ', icon:'💡', color:'#f1c40f',
    perms:{ view:['*'], download:['*'], upload:['*'], delete:['*'] },
    desc:'Ρεύμα, Ύδρευση, Τηλεφωνία, Αέριο, Internet — ανά είδος & έτος',
    subTemplate:['Ρεύμα','Ύδρευση','Τηλεφωνία','Αέριο','Internet','Λοιπά'] },
  { id:'photos',     label:'Φωτογραφίες', icon:'📷', color:'#e67e22',
    perms:{ view:['*','warehouse','cashier'], download:['*','warehouse'], upload:['*','warehouse'], delete:['*'] },
    desc:'Φωτογραφίες προϊόντων, καταστήματος', subTemplate:[] },
  { id:'marketing',  label:'Marketing', icon:'📣', color:'#f39c12',
    perms:{ view:['*','campaigns','cashier'], download:['*','campaigns'], upload:['*','campaigns'], delete:['*'] },
    desc:'Banners, υλικά καμπάνιας, assets', subTemplate:[] },
  { id:'other',      label:'Διάφορα', icon:'📁', color:'#7f8c8d',
    perms:{ view:['*','warehouse','cashier'], download:['*','warehouse','cashier'], upload:['*','warehouse'], delete:['*'] },
    desc:'Λοιπά έγγραφα', subTemplate:[] },
];

var GR_MONTHS = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος',
                 'Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
// Build display map after categories and months are defined
setTimeout(function(){ _vaultBuildDisplayMap(); }, 0);

function _vaultGetAllCats() {
  var custom = [];
  try { custom = JSON.parse(localStorage.getItem(VAULT_CUSTOM_CATS_KEY) || '[]'); } catch(e){}
  return VAULT_CATEGORIES.concat(custom);
}

function _vaultCanAction(cat, action) {
  if (!CURRENT_USER) return false;
  if ((CURRENT_USER.perms||[]).includes('*')) return true;
  var userPerms = CURRENT_USER.perms || [];
  var allowed = (cat.perms && cat.perms[action]) ? cat.perms[action] : (Array.isArray(cat.perms) ? cat.perms : []);
  return allowed.some(function(p) { return p !== '*' && userPerms.includes(p); });
}

function _vaultCanAccess(cat) { return _vaultCanAction(cat, 'view'); }

// ── Βασικό render ─────────────────────────────────────────────────────────────
async function renderVault() {
  var c = document.getElementById('content');
  if (!c) return;
  // Restore path from sessionStorage if in-memory path is empty (e.g. after page refresh)
  if (VAULT_STATE.path.length === 0) {
    try {
      var saved = localStorage.getItem('vault_path');
      if (saved) {
        var parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) VAULT_STATE.path = parsed;
      }
    } catch(e) {}
  }
  if (VAULT_STATE.path.length === 0) {
    _vaultRenderHome(c);
  } else {
    await _vaultRenderFolder(c);
  }
}

// ── Home: grid κατηγοριών ─────────────────────────────────────────────────────
function _vaultRenderHome(c) {
  var allCats = _vaultGetAllCats();
  var accessible = allCats.filter(_vaultCanAccess);
  var isAdmin = CURRENT_USER && (CURRENT_USER.perms||[]).includes('*');

  var cards = accessible.map(function(cat) {
    return '<div onclick="vaultEnter(\'' + cat.id + '\')" style="background:var(--card-bg);border:1.5px solid var(--border);border-radius:14px;padding:20px 16px;cursor:pointer;-webkit-tap-highlight-color:transparent;min-height:100px;display:flex;flex-direction:column;justify-content:space-between" onmouseenter="this.style.borderColor=\'' + cat.color + '\';this.style.background=\'' + cat.color + '08\'" onmouseleave="this.style.borderColor=\'var(--border)\';this.style.background=\'var(--card-bg)\'">'
      + '<div style="font-size:32px;margin-bottom:8px">' + cat.icon + '</div>'
      + '<div><div style="font-weight:700;font-size:13px">' + cat.label + '</div>'
      + '<div style="font-size:11px;color:var(--text-2);margin-top:3px">' + cat.desc + '</div></div>'
      + '</div>';
  }).join('');

  c.innerHTML = '<div class="page-head">'
    + '<div><div class="page-title">🗄️ ZyroNex Vault</div>'
    + '<div class="page-sub">Κεντρική αποθήκη εγγράφων & αρχείων επιχείρησης</div></div>'
    + (isAdmin ? '<button class="btn btn-ghost" style="min-height:44px" onclick="_vaultAddCategory()"><i data-lucide="folder-plus" size="16"></i> Νέα Κατηγορία</button>' : '')
    + '</div>'
    + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;margin-top:4px">'
    + cards + '</div>';
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ── Navigate ──────────────────────────────────────────────────────────────────
function vaultEnter(segment) {
  try { segment = decodeURIComponent(segment); } catch(e) {}
  VAULT_STATE.path.push(segment);
  try { localStorage.setItem('vault_path', JSON.stringify(VAULT_STATE.path)); } catch(e) {}
  renderVault();
}

// ── Storage path builder ─────────────────────────────────────────────────────
// Supabase Storage rejects spaces in object keys (Invalid key error).
// Sanitize: replace spaces with underscores, keep the rest as-is (UTF-8 fine).
// VAULT_STATE.path always stores human-readable names (for display).
// Supabase Storage valid key chars: [a-zA-Z0-9_/!-.*'() &$@=;:+,?]
// Greek letters and % are NOT allowed. Transliterate Greek→Latin, spaces→underscore.
var _VAULT_GR_MAP = {
  'α':'a','β':'v','γ':'g','δ':'d','ε':'e','ζ':'z','η':'i','θ':'th',
  'ι':'i','κ':'k','λ':'l','μ':'m','ν':'n','ξ':'x','ο':'o','π':'p',
  'ρ':'r','σ':'s','ς':'s','τ':'t','υ':'y','φ':'f','χ':'ch','ψ':'ps','ω':'o',
  'Α':'A','Β':'V','Γ':'G','Δ':'D','Ε':'E','Ζ':'Z','Η':'I','Θ':'Th',
  'Ι':'I','Κ':'K','Λ':'L','Μ':'M','Ν':'N','Ξ':'X','Ο':'O','Π':'P',
  'Ρ':'R','Σ':'S','Τ':'T','Υ':'Y','Φ':'F','Χ':'Ch','Ψ':'Ps','Ω':'O',
  'ά':'a','έ':'e','ή':'i','ί':'i','ό':'o','ύ':'y','ώ':'o',
  'Ά':'A','Έ':'E','Ή':'I','Ί':'I','Ό':'O','Ύ':'Y','Ώ':'O',
  'ϊ':'i','ϋ':'y','ΐ':'i','ΰ':'y'
};
function _vaultSanitizeSeg(s) {
  var result = '';
  for (var i = 0; i < s.length; i++) {
    var ch = s[i];
    if (_VAULT_GR_MAP[ch] !== undefined) {
      result += _VAULT_GR_MAP[ch];
    } else if (/^[\w !\-\.\*\'\(\)&\$@=;:\+,\?]$/.test(ch)) {
      result += ch === ' ' ? '_' : ch;
    } else {
      result += '_';
    }
  }
  return result || '_';
}
// Reverse map: sanitized storage name → original Greek display label
// Built from all known Greek labels (subTemplates + months + category labels)
var _VAULT_DISPLAY_MAP = {};
function _vaultBuildDisplayMap() {
  var labels = [];
  // subTemplates from all categories
  VAULT_CATEGORIES.forEach(function(cat) {
    (cat.subTemplate||[]).forEach(function(t){ labels.push(t); });
    labels.push(cat.label);
  });
  // months
  GR_MONTHS.forEach(function(m){ labels.push(m); });
  // Build map: sanitized → original
  labels.forEach(function(label) {
    var key = _vaultSanitizeSeg(label);
    if (!_VAULT_DISPLAY_MAP[key]) _VAULT_DISPLAY_MAP[key] = label;
  });
}
function _vaultDisplayName(storageName) {
  if (!storageName) return storageName;
  return _VAULT_DISPLAY_MAP[storageName] || storageName;
}
function _vaultStoragePath() {
  return 'vault/' + SHOP_ID + '/' + VAULT_STATE.path.map(_vaultSanitizeSeg).join('/');
}
function _vaultStoragePathWith(name) {
  return _vaultStoragePath() + '/' + _vaultSanitizeSeg(name);
}


function _vaultBack() {
  VAULT_STATE.path.pop();
  try { localStorage.setItem('vault_path', JSON.stringify(VAULT_STATE.path)); } catch(e) {}
  renderVault();
}

function _vaultGoHome() {
  VAULT_STATE.path = [];
  try { localStorage.removeItem('vault_path'); } catch(e) {}
  renderVault();
}

function _vaultGoTo(depth) {
  VAULT_STATE.path = VAULT_STATE.path.slice(0, depth + 1);
  try { localStorage.setItem('vault_path', JSON.stringify(VAULT_STATE.path)); } catch(e) {}
  renderVault();
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────
function _vaultBreadcrumb() {
  var allCats = _vaultGetAllCats();
  var path = VAULT_STATE.path;
  var crumbs = '<span onclick="_vaultGoHome()" style="cursor:pointer;color:var(--text-2);font-size:12px;white-space:nowrap;-webkit-tap-highlight-color:transparent">🗄️ Vault</span>';
  for (var i = 0; i < path.length; i++) {
    var seg = path[i];
    var label = _vaultDisplayName(seg);
    if (i === 0) { var cat = allCats.find(function(x){return x.id===seg;}); if(cat) label = (cat.shortLabel || cat.label.split(' ')[0]); }
    var displayLabel = label.length > 16 ? label.substring(0,14) + '…' : label;
    var depth = i;
    if (i < path.length - 1) {
      crumbs += ' <span style="color:var(--text-2);font-size:11px">›</span> <span onclick="_vaultGoTo(' + depth + ')" style="cursor:pointer;color:var(--text-2);font-size:11px;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle;-webkit-tap-highlight-color:transparent" title="' + label + '">' + displayLabel + '</span>';
    } else {
      crumbs += ' <span style="color:var(--text-2);font-size:11px">›</span> <span style="font-size:11px;font-weight:700;max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle" title="' + label + '">' + displayLabel + '</span>';
    }
  }
  return '<div style="display:flex;align-items:center;flex-wrap:nowrap;overflow:hidden;gap:1px;min-width:0">' + crumbs + '</div>';
}

// ── Render folder (generic) ───────────────────────────────────────────────────
async function _vaultRenderFolder(c) {
  var path = VAULT_STATE.path;
  var allCats = _vaultGetAllCats();
  var cat = allCats.find(function(x){return x.id===path[0];});
  if (!cat || !_vaultCanAccess(cat)) { VAULT_STATE.path=[]; renderVault(); return; }
  var canUP  = _vaultCanAction(cat,'upload');
  var canDL  = _vaultCanAction(cat,'download');
  var canDEL = _vaultCanAction(cat,'delete');

  // Header
  c.innerHTML = '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;flex-wrap:nowrap;overflow:hidden">'
    + '<button class="btn btn-ghost" style="min-height:44px;min-width:44px;padding:6px;flex-shrink:0;-webkit-tap-highlight-color:transparent" onclick="_vaultBack()"><i data-lucide="arrow-left" size="18"></i></button>'
    + '<div style="flex:1;min-width:0;overflow:hidden">' + _vaultBreadcrumb() + '</div>'
    + (canUP ? '<button class="btn btn-primary" style="min-height:44px;padding:8px 12px;font-size:13px;flex-shrink:0;-webkit-tap-highlight-color:transparent" onclick="_vaultUploadFile()"><i data-lucide="upload" size="14"></i> <span class="vault-btn-label">Ανέβασμα</span></button>' : '')
    + '<button class="btn btn-ghost" style="min-height:44px;padding:8px 12px;font-size:13px;flex-shrink:0;-webkit-tap-highlight-color:transparent" onclick="_vaultNewFolder()"><i data-lucide="folder-plus" size="14"></i> <span class="vault-btn-label">Φάκελος</span></button>'
    + '</div>'
    + '<div id="vault-folder-content" style="margin-top:4px"><div style="text-align:center;padding:30px;color:var(--text-2)">⏳ Φόρτωση...</div></div>';

  if (typeof lucide !== 'undefined') lucide.createIcons();

  // Special case: suppliers root — show from PURCHASES + storage
  if (path[0] === 'suppliers' && path.length === 1) {
    await _vaultRenderSuppliersRoot();
    return;
  }

  // Generic: list storage path
  var storagePath = _vaultStoragePath();
  await _vaultListStoragePath(storagePath);
}

// ── Suppliers root: merge from PURCHASES data + storage ───────────────────────
async function _vaultRenderSuppliersRoot() {
  var cont = document.getElementById('vault-folder-content');
  if (!cont) return;

  // Get supplier folders from storage
  var storagePath = 'vault/' + SHOP_ID + '/suppliers';
  var storageItems = [];
  try {
    var res = await sb.storage.from('vault').list(storagePath, {limit:200});
    storageItems = (res.data || []).filter(function(x){return x.id===null||!x.metadata;});
  } catch(e) {}

  // Get unique suppliers from purchases
  var purchaseSuppliers = {};
  try {
    var r = await sb.from('purchases')
      .select('supplier_id, supplier_name')
      .eq('shop_id', SHOP_ID)
      .not('supplier_name', 'is', null);
    (r.data||[]).forEach(function(p){
      var name = (p.supplier_name||'').trim();
      if (name) purchaseSuppliers[name] = true;
    });
  } catch(e) {}

  // Also from SUPPLIERS array
  (SUPPLIERS||[]).forEach(function(s){ if(s.name) purchaseSuppliers[s.name] = true; });

  // Merge: real names from purchases are source of truth.
  // Map: sanitized storage key → real display name
  var sanitizedToReal = {};
  Object.keys(purchaseSuppliers).forEach(function(n){
    sanitizedToReal[_vaultSanitizeSeg(n)] = n;
  });
  (SUPPLIERS||[]).forEach(function(s){
    if(s.name) sanitizedToReal[_vaultSanitizeSeg(s.name)] = s.name;
  });

  // Build final set: real names + any storage folders without a purchase match
  var folderSet = {};
  Object.keys(sanitizedToReal).forEach(function(k){ folderSet[sanitizedToReal[k]] = true; });
  storageItems.forEach(function(x){
    if (!sanitizedToReal[x.name]) folderSet[x.name] = true; // unknown folder, show as-is
  });

  var names = Object.keys(folderSet).sort();

  if (names.length === 0) {
    cont.innerHTML = '<div class="card" style="text-align:center;padding:40px">'
      + '<div style="font-size:40px;margin-bottom:10px">📦</div>'
      + '<div class="fw-700 mb-2">Δεν υπάρχουν προμηθευτές ακόμα</div>'
      + '<div class="muted">Δημιούργησε φάκελο με το κουμπί «Φάκελος» ή ανέβασε τιμολόγιο</div>'
      + '</div>';
    return;
  }

  var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px">';
  names.forEach(function(name) {
    html += '<div onclick="vaultEnter(\'' + encodeURIComponent(name) + '\')" '
      + 'style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:14px 12px;cursor:pointer;-webkit-tap-highlight-color:transparent;text-align:center" '
      + 'onmouseenter="this.style.background=\'rgba(74,163,255,0.06)\'" onmouseleave="this.style.background=\'var(--card-bg)\'">'
      + '<div style="font-size:28px;margin-bottom:6px">📁</div>'
      + '<div style="font-size:12px;font-weight:600;word-break:break-word">' + _vaultDisplayName(name) + '</div>'
      + '</div>';
  });
  html += '</div>';
  cont.innerHTML = html;
}

// ── Generic storage lister ────────────────────────────────────────────────────
async function _vaultListStoragePath(storagePath) {
  var cont = document.getElementById('vault-folder-content');
  if (!cont) return;

  var allCats = _vaultGetAllCats();
  var cat = allCats.find(function(x){return x.id===VAULT_STATE.path[0];});
  var canUP  = cat ? _vaultCanAction(cat,'upload') : false;
  var canDL  = cat ? _vaultCanAction(cat,'download') : false;
  var canDEL = cat ? _vaultCanAction(cat,'delete') : false;

  var items = [];
  try {
    var res = await sb.storage.from('vault').list(storagePath, {limit:500, sortBy:{column:'name',order:'asc'}});
    items = (res.data || []).filter(function(x){return x.name !== '.emptykeep';});
  } catch(err) {
    cont.innerHTML = '<div style="color:var(--danger);padding:20px">Σφάλμα: ' + (err.message||'') + '</div>';
    return;
  }

  // Also inject supplier invoices if we're in suppliers/[name]/[doctype]
  var path = VAULT_STATE.path;
  if (path[0]==='suppliers' && path.length>=2) {
    await _vaultInjectPurchaseInvoices(storagePath, items);
    items = items.filter(function(x){return x.name !== '.emptykeep';});
    // Re-fetch after inject
    try {
      var res2 = await sb.storage.from('vault').list(storagePath, {limit:500, sortBy:{column:'name',order:'asc'}});
      items = (res2.data || []).filter(function(x){return x.name !== '.emptykeep';});
    } catch(e) {}
  }

  var folders = items.filter(function(x){return !x.metadata || x.id===null;});
  var files = items.filter(function(x){return x.metadata && x.id!==null;});

  if (folders.length === 0 && files.length === 0) {
    // Show subTemplate if available and at level 1 (cat root) or supplier root
    var subTpl = cat && cat.subTemplate && cat.subTemplate.length > 0 ? cat.subTemplate : [];
    if (subTpl.length > 0 && path.length <= 2) {
      cont.innerHTML = '<div class="muted mb-3" style="font-size:12px">Προτεινόμενη οργάνωση:</div>'
        + '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:16px">'
        + subTpl.map(function(t){
            return '<button class="btn btn-ghost" style="font-size:12px;padding:10px;min-height:44px;text-align:center" onclick="_vaultCreateSubFolder(\'' + encodeURIComponent(t) + '\')">'
              + '📁 ' + t + '</button>';
          }).join('')
        + '</div>'
        + '<div class="muted" style="font-size:11px;text-align:center">ή ανέβασε αρχεία κατευθείαν</div>';
      return;
    }
    cont.innerHTML = '<div class="card" style="text-align:center;padding:40px">'
      + '<div style="font-size:36px;margin-bottom:10px">📂</div>'
      + '<div class="fw-700 mb-2">Κενός φάκελος</div>'
      + '<div class="muted">Ανέβασε αρχεία ή δημιούργησε υποφάκελο</div>'
      + '</div>';
    return;
  }

  var html = '';

  // Folders
  if (folders.length > 0) {
    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;margin-bottom:16px">';
    folders.forEach(function(f) {
      var isAdmin = CURRENT_USER && (CURRENT_USER.perms||[]).includes('*');
      html += '<div style="position:relative">'
        + '<div onclick="vaultEnter(\'' + encodeURIComponent(_vaultDisplayName(f.name)) + '\')" '
        + 'style="background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:14px 12px;cursor:pointer;text-align:center;-webkit-tap-highlight-color:transparent" '
        + 'onmouseenter="this.style.background=\'rgba(155,89,255,0.06)\'" onmouseleave="this.style.background=\'var(--card-bg)\'">'
        + '<div style="font-size:28px;margin-bottom:6px">📁</div>'
        + '<div style="font-size:12px;font-weight:600;word-break:break-word">' + _vaultDisplayName(f.name) + '</div>'
        + '</div>'
        + (isAdmin ? '<button onclick="_vaultDeleteFolder(\'' + encodeURIComponent(f.name) + '\')" style="position:absolute;top:4px;right:4px;background:none;border:none;cursor:pointer;color:var(--danger);padding:4px;font-size:14px;line-height:1;-webkit-tap-highlight-color:transparent">✕</button>' : '')
        + '</div>';
    });
    html += '</div>';
  }

  // Files grouped by year/month
  if (files.length > 0) {
    // Group by year/month from created_at
    var groups = {};
    files.forEach(function(f) {
      var d = f.created_at ? new Date(f.created_at) : null;
      var key = d ? (d.getFullYear() + '_' + d.getMonth()) : 'other';
      var label = d ? (d.getFullYear() + ' — ' + GR_MONTHS[d.getMonth()]) : 'Χωρίς ημερομηνία';
      if (!groups[key]) groups[key] = {label:label, year:d?d.getFullYear():0, month:d?d.getMonth():0, files:[]};
      groups[key].files.push(f);
    });

    // Sort groups desc
    var sortedKeys = Object.keys(groups).sort(function(a,b){
      var ga=groups[a], gb=groups[b];
      return (gb.year*12+gb.month) - (ga.year*12+ga.month);
    });

    sortedKeys.forEach(function(key) {
      var grp = groups[key];
      html += '<div style="margin-bottom:16px">';
      html += '<div style="font-size:11px;font-weight:700;color:var(--text-2);letter-spacing:0.5px;margin-bottom:8px;padding:4px 0;border-bottom:1px solid var(--border)">'
        + '📅 ' + grp.label + ' <span style="color:var(--text-2);font-weight:400">(' + grp.files.length + ' αρχεία)</span></div>';
      html += '<div style="display:flex;flex-direction:column;gap:2px">';
      grp.files.forEach(function(f) {
        var ext = (f.name.split('.').pop()||'').toLowerCase();
        var icon = ext==='pdf'?'📄':['jpg','jpeg','png','webp','gif'].includes(ext)?'🖼️':['doc','docx'].includes(ext)?'📝':['xls','xlsx'].includes(ext)?'📊':'📎';
        var size = f.metadata&&f.metadata.size?(f.metadata.size>1048576?(f.metadata.size/1048576).toFixed(1)+' MB':Math.round(f.metadata.size/1024)+' KB'):'—';
        var enc = encodeURIComponent(f.name);
        var btns = '';
        if (['jpg','jpeg','png','pdf','webp'].includes(ext))
          btns += '<button onclick="_vaultPreview(\'' + enc + '\')" style="background:none;border:none;cursor:pointer;padding:6px;color:var(--text-2);-webkit-tap-highlight-color:transparent;min-width:36px;min-height:36px;font-size:16px" title="Προβολή">👁️</button>';
        if (canDL)
          btns += '<button onclick="_vaultDownload(\'' + enc + '\')" style="background:none;border:none;cursor:pointer;padding:6px;color:var(--text-2);-webkit-tap-highlight-color:transparent;min-width:36px;min-height:36px;font-size:16px" title="Λήψη">⬇️</button>'
                + '<button onclick="_vaultShare(\'' + enc + '\')" style="background:none;border:none;cursor:pointer;padding:6px;color:var(--text-2);-webkit-tap-highlight-color:transparent;min-width:36px;min-height:36px;font-size:16px" title="Κοινοποίηση">🔗</button>';
        if (canDEL)
          btns += '<button onclick="_vaultDeleteFile(\'' + enc + '\')" style="background:none;border:none;cursor:pointer;padding:6px;color:var(--danger);-webkit-tap-highlight-color:transparent;min-width:36px;min-height:36px;font-size:16px" title="Διαγραφή">🗑️</button>';
        var displayFileName = _vaultDisplayName(f.name);
        html += '<div style="display:flex;align-items:center;gap:8px;padding:10px;border-radius:10px;background:var(--card-bg);border:1px solid var(--border);margin-bottom:2px">'
          + '<span style="font-size:22px;flex-shrink:0">' + icon + '</span>'
          + '<div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;word-break:break-word">' + displayFileName + '</div>'
          + '<div style="font-size:11px;color:var(--text-2)">' + size + '</div></div>'
          + '<div style="display:flex;align-items:center;flex-shrink:0;gap:2px">' + btns + '</div>'
          + '</div>';
      });
      html += '</div></div>';
    });
  }

  cont.innerHTML = html;
}

// ── Inject purchase invoices into storage ─────────────────────────────────────
async function _vaultInjectPurchaseInvoices(storagePath, existingItems) {
  var path = VAULT_STATE.path;
  if (path.length < 2) return;
  var supplierName = decodeURIComponent(path[1]);
  // Only inject at supplier root level (path.length===2) in "Τιμολόγια" subfolder or root
  if (path.length !== 2) return;

  try {
    // Match by sanitized name — covers both 'Atmology' and 'ATMOLOGY Ο Ε' etc.
    var sanitizedSupplier = _vaultSanitizeSeg(supplierName);
    var r = await sb.from('purchases')
      .select('id,invoice_number,purchase_date,gross_amount,invoice_image_url,invoice_type,supplier_name')
      .eq('shop_id', SHOP_ID)
      .not('invoice_image_url','is',null)
      .order('purchase_date',{ascending:false});

    var allPurchases = (r.data||[]);
    // Filter: match if sanitized names are equal OR one contains the other (handles 'Atmology' vs 'ATMOLOGY Ο Ε')
    var purchases = allPurchases.filter(function(p){
      var ps = _vaultSanitizeSeg((p.supplier_name||'').toLowerCase());
      var ss = sanitizedSupplier.toLowerCase();
      return ps === ss || ps.indexOf(ss) >= 0 || ss.indexOf(ps) >= 0;
    });
    if (purchases.length === 0) { console.log('[Vault] 0 purchases for:', supplierName); return; }

    // Check which invoices already exist in storage
    var existingNames = {};
    existingItems.forEach(function(x){existingNames[x.name]=true;});

    for (var i=0; i<purchases.length; i++) {
      var p = purchases[i];
      if (!p.invoice_image_url) continue;
      var d = p.purchase_date ? new Date(p.purchase_date) : new Date();
      var yearSeg = String(d.getFullYear());
      var monthSeg = _vaultSanitizeSeg(GR_MONTHS[d.getMonth()]);
      var fileName = _vaultSanitizeSeg((p.invoice_number||('INV-'+p.id)) + '.pdf');
      var destPath = storagePath + '/Timologia/' + yearSeg + '/' + monthSeg + '/' + fileName;
      // Check existence
      var checkPath = storagePath + '/Timologia/' + yearSeg + '/' + monthSeg;
      var existing = {};
      try {
        var ex = await sb.storage.from('vault').list(checkPath,{limit:200});
        (ex.data||[]).forEach(function(x){existing[x.name]=true;});
      } catch(e){}
      if (existing[fileName]) continue;
      // Download from product-documents bucket and upload to vault
      try {
        var dlRes = await sb.storage.from('product-documents').download(p.invoice_image_url);
        if (dlRes.error || !dlRes.data) { toast('Download failed: '+p.invoice_image_url+' — '+(dlRes.error&&dlRes.error.message||'no data'),'danger',6000); continue; }
        await sb.storage.from('vault').upload(destPath, dlRes.data, {upsert:true, contentType:dlRes.data.type||'application/pdf'});
      } catch(e) { toast('⚠️ Copy failed: '+fileName+' — '+(e.message||e),'danger',6000); }
    }
  } catch(e) { console.warn('[Vault] inject error:', e); toast('Inject error: '+(e.message||e),'danger',5000); }
}

// ── Upload ────────────────────────────────────────────────────────────────────
function _vaultUploadFile() {
  var inp = document.createElement('input');
  inp.type='file'; inp.multiple=true; inp.accept='*/*';
  inp.style.cssText='position:fixed;left:-9999px;opacity:0';
  document.body.appendChild(inp);
  inp.onchange = async function(){
    var files = Array.from(inp.files||[]);
    document.body.removeChild(inp);
    if (!files.length) return;
    var storagePath = _vaultStoragePath();
    var ok=0;
    for (var i=0;i<files.length;i++) {
      var f = files[i];
      toast('⬆️ ' + (i+1) + '/' + files.length + ': ' + f.name,'info');
      try {
        var res = await sb.storage.from('vault').upload(storagePath+'/'+_vaultSanitizeSeg(f.name), f, {upsert:true});
        if (res.error) throw res.error;
        ok++;
      } catch(e){ toast('Σφάλμα: '+f.name+' — '+(e.message||''),'danger'); }
    }
    toast(ok+'/'+files.length+' αρχεία ανέβηκαν ✅','success');
    renderVault();
  };
  inp.click();
}

// ── New folder ────────────────────────────────────────────────────────────────
function _vaultNewFolder() {
  openModal('<div class="modal-head"><h3 class="fw-800">Νέος Φάκελος</h3>'
    + '<button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button></div>'
    + '<div class="modal-body" style="display:flex;flex-direction:column;gap:10px">'
    + '<div class="form-row"><label class="form-label">Όνομα φακέλου</label>'
    + '<input class="form-input" id="vf_name" placeholder="π.χ. 2026 ή Ένσημα" style="font-size:16px"></div>'
    + '<div class="flex gap-2 mt-2">'
    + '<button class="btn btn-primary" onclick="_vaultCreateFolder()"><i data-lucide="folder-plus" size="16"></i> Δημιουργία</button>'
    + '<button class="btn btn-ghost" onclick="closeModal()">Ακύρωση</button>'
    + '</div></div>');
  if (typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(function(){ var el=document.getElementById('vf_name'); if(el) el.focus(); },100);
}

async function _vaultCreateFolder() {
  var name = (document.getElementById('vf_name')||{}).value;
  if (!name||!name.trim()) { toast('Συμπλήρωσε όνομα','danger'); return; }
  name = name.trim();
  var storagePath = _vaultStoragePathWith(name) + '/.emptykeep';
  try {
    var res = await sb.storage.from('vault').upload(storagePath, new Blob(['']), {upsert:true});
    if (res.error) throw res.error;
    closeModal();
    toast('Φάκελος «' + name + '» δημιουργήθηκε ✅','success');
    renderVault();
  } catch(e){ toast('Σφάλμα: '+(e.message||''),'danger'); }
}

async function _vaultCreateSubFolder(encodedName) {
  var name = decodeURIComponent(encodedName);
  var storagePath = _vaultStoragePathWith(name) + '/.emptykeep';
  try {
    var res = await sb.storage.from('vault').upload(storagePath, new Blob(['']), {upsert:true});
    if (res.error) throw res.error;
    toast('Φάκελος «' + name + '» δημιουργήθηκε ✅','success');
    renderVault();
  } catch(e){ toast('Σφάλμα: '+(e.message||''),'danger'); }
}

// ── Download ──────────────────────────────────────────────────────────────────
async function _vaultDownload(encodedName) {
  var name = decodeURIComponent(encodedName);
  var path = _vaultStoragePathWith(name);
  try {
    var res = await sb.storage.from('vault').download(path);
    if (res.error) throw res.error;
    var url = URL.createObjectURL(res.data);
    var a = document.createElement('a'); a.href=url; a.download=name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){URL.revokeObjectURL(url);},3000);
  } catch(e){ toast('Σφάλμα: '+(e.message||''),'danger'); }
}

// ── Preview ───────────────────────────────────────────────────────────────────
async function _vaultPreview(encodedName) {
  var name = decodeURIComponent(encodedName);
  var path = _vaultStoragePathWith(name);
  try {
    var res = await sb.storage.from('vault').createSignedUrl(path, 3600);
    var url = res.data && res.data.signedUrl;
    if (!url) { toast('Δεν βρέθηκε URL','danger'); return; }
    var ext = name.split('.').pop().toLowerCase();
    var preview = '';
    if (['jpg','jpeg','png','gif','webp'].includes(ext)) {
      preview = '<img src="' + url + '" style="max-width:100%;max-height:65vh;border-radius:8px;display:block;margin:0 auto;-webkit-user-select:none">';
    } else if (ext === 'pdf') {
      // iOS Safari: iframe/object don't work for PDFs — use direct link + embed fallback
      preview = '<div style="text-align:center;padding:16px 0">'
        + '<a href="' + url + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#000;padding:12px 24px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;-webkit-tap-highlight-color:transparent;min-height:44px">📄 Άνοιγμα PDF</a>'
        + '</div>'
        + '<object data="' + url + '" type="application/pdf" style="width:100%;height:60vh;border:none;border-radius:8px;display:block">'
        + '<div style="text-align:center;padding:20px;color:var(--text-2);font-size:13px">Το PDF δεν μπορεί να εμφανιστεί inline.<br>Χρησιμοποίησε το κουμπί παραπάνω.</div>'
        + '</object>';
    } else {
      preview = '<div style="text-align:center;padding:30px">'
        + '<div style="font-size:48px;margin-bottom:12px">📎</div>'
        + '<a href="' + url + '" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:#000;padding:12px 24px;border-radius:10px;font-weight:700;font-size:15px;text-decoration:none;min-height:44px">⬇️ Λήψη αρχείου</a>'
        + '</div>';
    }
    openModal(
      '<div class="modal-head" style="padding:12px 16px">'
      + '<div style="font-size:13px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:calc(100% - 44px)">' + name + '</div>'
      + '<button class="icon-btn" onclick="closeModal()" style="min-width:44px;min-height:44px;flex-shrink:0"><i data-lucide="x" size="18"></i></button>'
      + '</div>'
      + '<div class="modal-body" style="padding:8px;overflow-y:auto;-webkit-overflow-scrolling:touch;max-height:80vh">' + preview + '</div>'
    );
    if (typeof lucide !== 'undefined') lucide.createIcons();
  } catch(e){ toast('Σφάλμα: '+(e.message||''),'danger'); }
}
// ── Share ─────────────────────────────────────────────────────────────────────
async function _vaultShare(encodedName) {
  var name = decodeURIComponent(encodedName);
  var path = _vaultStoragePathWith(name);
  try {
    var res = await sb.storage.from('vault').createSignedUrl(path, 3600);
    if (res.error) throw res.error;
    var url = res.data.signedUrl;
    if (navigator.share) {
      navigator.share({title:name, url:url});
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      toast('🔗 Link αντιγράφηκε! Ισχύει 1 ώρα','success');
    } else {
      openModal('<div class="modal-head"><h3 class="fw-800">Share Link</h3>'
        + '<button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button></div>'
        + '<div class="modal-body"><div class="form-row"><label class="form-label">Link (ισχύει 1 ώρα)</label>'
        + '<input class="form-input" value="'+url+'" readonly onclick="this.select()" style="font-size:12px"></div></div>');
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  } catch(e){ toast('Σφάλμα: '+(e.message||''),'danger'); }
}

// ── Delete file ───────────────────────────────────────────────────────────────
function _vaultDeleteFile(encodedName) {
  var name = decodeURIComponent(encodedName);
  openModal('<div class="modal-head"><h3 class="fw-800">Διαγραφή</h3>'
    + '<button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button></div>'
    + '<div class="modal-body">'
    + '<div class="muted mb-3">Διαγραφή: <b>'+name+'</b>; Δεν αναιρείται.</div>'
    + '<div class="flex gap-2">'
    + '<button class="btn btn-danger" onclick="_vaultConfirmDeleteFile(\''+encodeURIComponent(name)+'\')">Διαγραφή</button>'
    + '<button class="btn btn-ghost" onclick="closeModal()">Ακύρωση</button>'
    + '</div></div>');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function _vaultConfirmDeleteFile(encodedName) {
  var name = decodeURIComponent(encodedName);
  var path = _vaultStoragePathWith(name);
  try {
    var res = await sb.storage.from('vault').remove([path]);
    if (res.error) throw res.error;
    closeModal();
    toast('Διαγράφηκε ✅','success');
    renderVault();
  } catch(e){ toast('Σφάλμα: '+(e.message||''),'danger'); }
}

// ── Delete folder ─────────────────────────────────────────────────────────────
function _vaultDeleteFolder(encodedName) {
  var name = decodeURIComponent(encodedName);
  openModal('<div class="modal-head"><h3 class="fw-800">Διαγραφή Φακέλου</h3>'
    + '<button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button></div>'
    + '<div class="modal-body">'
    + '<div class="muted mb-3">Διαγραφή φακέλου <b>'+name+'</b> και <b>όλου του περιεχομένου</b>; Δεν αναιρείται.</div>'
    + '<div class="flex gap-2">'
    + '<button class="btn btn-danger" onclick="_vaultConfirmDeleteFolder(\''+encodeURIComponent(name)+'\')">Διαγραφή</button>'
    + '<button class="btn btn-ghost" onclick="closeModal()">Ακύρωση</button>'
    + '</div></div>');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function _vaultConfirmDeleteFolder(encodedName) {
  var name = decodeURIComponent(encodedName);
  var folderPath = _vaultStoragePathWith(name);
  try {
    // List all files recursively and delete
    var all = await sb.storage.from('vault').list(folderPath,{limit:500});
    var paths = (all.data||[]).map(function(x){return folderPath+'/'+x.name;});
    paths.push(folderPath+'/.emptykeep');
    if (paths.length>0) await sb.storage.from('vault').remove(paths);
    closeModal();
    toast('Φάκελος διαγράφηκε ✅','success');
    renderVault();
  } catch(e){ toast('Σφάλμα: '+(e.message||''),'danger'); }
}

// ── Add custom category ───────────────────────────────────────────────────────
function _vaultAddCategory() {
  openModal('<div class="modal-head"><h3 class="fw-800">Νέα Κατηγορία</h3>'
    + '<button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button></div>'
    + '<div class="modal-body" style="display:flex;flex-direction:column;gap:10px">'
    + '<div class="form-row"><label class="form-label">Emoji</label><input class="form-input" id="vcat_icon" placeholder="📁" maxlength="4" style="font-size:16px;width:80px"></div>'
    + '<div class="form-row"><label class="form-label">Όνομα *</label><input class="form-input" id="vcat_label" placeholder="π.χ. Ασφάλειες" style="font-size:16px"></div>'
    + '<div class="form-row"><label class="form-label">Περιγραφή</label><input class="form-input" id="vcat_desc" placeholder="π.χ. Ασφαλιστήρια συμβόλαια" style="font-size:16px"></div>'
    + '<div class="flex gap-2 mt-2">'
    + '<button class="btn btn-primary" onclick="_vaultSaveCategory()">Αποθήκευση</button>'
    + '<button class="btn btn-ghost" onclick="closeModal()">Ακύρωση</button>'
    + '</div></div>');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function _vaultSaveCategory() {
  var icon = (document.getElementById('vcat_icon')||{}).value||'📁';
  var label = ((document.getElementById('vcat_label')||{}).value||'').trim();
  var desc  = ((document.getElementById('vcat_desc')||{}).value||'').trim();
  if (!label) { toast('Συμπλήρωσε όνομα','danger'); return; }
  var custom = [];
  try { custom = JSON.parse(localStorage.getItem(VAULT_CUSTOM_CATS_KEY)||'[]'); } catch(e){}
  var id = 'cat_' + Date.now();
  custom.push({id:id, label:label, icon:icon.trim()||'📁', color:'#7f8c8d',
    perms:{view:['*'],download:['*'],upload:['*'],delete:['*']}, desc:desc, subTemplate:[]});
  localStorage.setItem(VAULT_CUSTOM_CATS_KEY, JSON.stringify(custom));
  closeModal();
  toast('Κατηγορία «'+label+'» δημιουργήθηκε ✅','success');
  renderVault();
}

// Phase customers: calcLoyaltyBurnRate, renderLoyaltyBurnRateCard,
// renderCustomers + helpers, CI_* + renderCustomerIntel + helpers
function calcLoyaltyBurnRate(customer){
  if(!customer) return null;
  const rates = typeof getPointRates === 'function' ? getPointRates() : {bronze:0.010};
  const tier = customer.loyaltyTier || 'bronze';
  const pointRate = typeof getPointValue === 'function' ? getPointValue(tier, rates) : 0.010;

  // Εκτίμηση πόντων που δόθηκαν (1 πόντος/€ spent)
  const totalPointsGiven = Math.floor(customer.totalSpent || 0);
  const pointsCost = Math.round(totalPointsGiven * pointRate * 100) / 100;

  // Store credit used (από sales history)
  const creditUsed = typeof SALES !== 'undefined'
    ? SALES.filter(s=>s.customerId===customer.id)
        .reduce((a,b)=>a+(b.store_credit_used||0),0)
    : 0;

  const totalLoyaltyCost = pointsCost + creditUsed;
  const netRevenue = (customer.totalSpent||0) - totalLoyaltyCost;
  const burnRatePct = customer.totalSpent > 0
    ? Math.round((totalLoyaltyCost/customer.totalSpent)*100*10)/10
    : 0;

  // Per-visit metrics
  const avgVisitValue = customer.visits > 0 ? (customer.totalSpent/customer.visits) : 0;
  const avgLoyaltyCostPerVisit = customer.visits > 0 ? (totalLoyaltyCost/customer.visits) : 0;

  return {
    totalSpent: customer.totalSpent||0,
    pointsGiven: totalPointsGiven,
    pointsCost,
    creditUsed,
    totalLoyaltyCost,
    netRevenue,
    burnRatePct,
    avgVisitValue,
    avgLoyaltyCostPerVisit,
    tier,
    isHealthy: burnRatePct < 15, // <15% is healthy
    isWarning: burnRatePct >= 15 && burnRatePct < 25,
    isDanger: burnRatePct >= 25
  };
}

function renderLoyaltyBurnRateCard(customer){
  const data = calcLoyaltyBurnRate(customer);
  if(!data) return '';

  const color = data.isDanger ? '#e74c3c' : (data.isWarning ? '#f39c12' : '#2ecc71');
  const status = data.isDanger ? '🔴 Υψηλό κόστος' : (data.isWarning ? '🟡 Προσοχή' : '🟢 Υγιές');

  return `
    <div style="padding:16px;background:linear-gradient(135deg,rgba(${data.isDanger?'231,76,60':data.isWarning?'243,156,18':'46,204,113'},0.08),transparent);
      border:1px solid rgba(${data.isDanger?'231,76,60':data.isWarning?'243,156,18':'46,204,113'},0.2);
      border-radius:12px;margin-top:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <div class="fw-700">⭐ Loyalty Burn Rate</div>
        <span style="font-size:12px;padding:3px 8px;border-radius:6px;background:rgba(${data.isDanger?'231,76,60':data.isWarning?'243,156,18':'46,204,113'},0.15);
          color:${color};font-weight:700">${status}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div style="padding:10px;background:var(--bg-2);border-radius:8px;text-align:center">
          <div class="text-xs muted">Συνολικός Τζίρος</div>
          <div class="fw-800" style="font-size:18px">${eur(data.totalSpent)}</div>
        </div>
        <div style="padding:10px;background:var(--bg-2);border-radius:8px;text-align:center">
          <div class="text-xs muted">Καθαρά Έσοδα</div>
          <div class="fw-800" style="font-size:18px;color:${color}">${eur(data.netRevenue)}</div>
        </div>
        <div style="padding:10px;background:var(--bg-2);border-radius:8px;text-align:center">
          <div class="text-xs muted">Κόστος Loyalty</div>
          <div class="fw-800" style="font-size:18px;color:#e74c3c">-${eur(data.totalLoyaltyCost)}</div>
        </div>
        <div style="padding:10px;background:var(--bg-2);border-radius:8px;text-align:center">
          <div class="text-xs muted">Burn Rate</div>
          <div class="fw-800" style="font-size:18px;color:${color}">${data.burnRatePct}%</div>
        </div>
      </div>

      <div style="padding:10px;background:var(--bg-1);border-radius:8px;font-size:13px;line-height:1.6">
        💡 <strong>${customer.name}</strong> σου άφησε <strong>${eur(data.totalSpent)}</strong>,
        αλλά του έδωσες <strong style="color:#e74c3c">${eur(data.totalLoyaltyCost)}</strong> σε πόντους/credits.
        Το πραγματικό σου κέρδος είναι <strong style="color:${color}">${eur(data.netRevenue)}</strong>
        (${100-data.burnRatePct}% του τζίρου).
      </div>

      ${data.isDanger ? `
      <div style="margin-top:10px;padding:8px 12px;background:rgba(231,76,60,0.1);border-radius:8px;font-size:12px;color:#e74c3c">
        ⚠️ Ο burn rate υπερβαίνει το 25%. Εξέτασε τη μείωση του ποσοστού επιβράβευσης για αυτόν τον πελάτη.
      </div>` : ''}
    </div>
  `;
}
function renderCustomers(){
  const tierEmoji = {bronze:'🥉', silver:'🥈', gold:'🥇', platinum:'💎'};
  const tierColor = {bronze:'#cd7f32', silver:'#c0c0c0', gold:'#ffd700', platinum:'#e5e4e2'};
  const html=`
  <div class="page-head">
    <div><div class="page-title">Πελάτες</div><div class="page-sub">${CUSTOMERS.length} ενεργοί • Συνολικός τζίρος: ${eur(CUSTOMERS.reduce((a,b)=>a+b.totalSpent,0))}</div></div>
    <div class="flex gap-2" style="flex-wrap:wrap">
      <button class="btn btn-ghost" onclick="showPage('campaigns')"><i data-lucide="mail" size="18"></i> Μαζικό Email</button>
      <button class="btn btn-ghost" onclick="_bulkGenerateLoyaltyQR()" id="bulkQRBtn" title="Δημιουργία QR για πελάτες χωρίς κωδικό"><i data-lucide="qr-code" size="18"></i> QR Loyalty</button>
      <button class="btn btn-primary" onclick="openCustomerModal()"><i data-lucide="user-plus" size="18"></i> Νέος Πελάτης</button>
    </div>
  </div>

  <div class="card mb-4" style="background:linear-gradient(135deg,rgba(0,212,168,0.08),rgba(74,163,255,0.08))">
    <div class="fw-700 mb-2">🎁 Πρόγραμμα Πιστότητας</div>
    <div class="loyalty-tiers-grid">
      ${['bronze','silver','gold','platinum'].map(t=>{
        const count = CUSTOMERS.filter(c=>c.loyaltyTier===t).length;
        const thresh = {bronze:'0-99', silver:'100-299', gold:'300-699', platinum:'700+'}[t];
        return `<div class="loyalty-tier-card" style="padding:10px;background:var(--bg-2);border-radius:10px;text-align:center">
          <div class="lt-emoji" style="font-size:22px">${tierEmoji[t]}</div>
          <div class="lt-name fw-700 text-sm" style="text-transform:capitalize">${t}</div>
          <div class="lt-thresh text-xs muted">${thresh} πόντοι</div>
          <div class="lt-count fw-800 mt-2" style="color:${tierColor[t]}">${count} πελάτες</div>
        </div>`;
      }).join('')}
    </div>
  </div>

  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr));width:100%;max-width:100%;box-sizing:border-box">
    ${CUSTOMERS.map(c=>`<div class="cust-card" onclick="openCustomerDetail(${c.id})">
      <div class="flex gap-3 items-center">${custAvatarHTML(c.name, 46, tierEmoji[c.loyaltyTier||'bronze'], null)}
      <div style="flex:1"><div class="fw-700">${c.name}</div><div class="text-xs muted">${c.phone||'—'}</div></div>
      <div class="text-right"><div class="fw-800" style="color:var(--accent)">${eur(c.totalSpent)}</div><div class="text-xs muted">${c.visits} επισκ.</div></div></div>
      <div class="divider"></div>
      <div class="flex justify-between text-xs"><span class="muted">Πόντοι</span><span class="fw-700" style="color:${tierColor[c.loyaltyTier||'bronze']}">${c.loyaltyPoints||0}</span></div>
      ${(c.storeCredit||0) > 0 ? `<div class="flex justify-between text-xs mt-1"><span class="muted">Store Credit</span><span class="fw-700" style="color:#4aa3ff">🏦 ${eur(c.storeCredit)}</span></div>` : ''}
      <div class="flex justify-between text-xs mt-2"><span class="muted">Τελ. επίσκεψη</span><span>${dateGR(c.lastVisit)}</span></div>
      ${c.preferredNicotine!=null?`<div class="flex justify-between text-xs mt-2"><span class="muted">Νικοτίνη προτίμ.</span><span class="chip chip-info">${c.preferredNicotine} mg</span></div>`:''}
    </div>`).join('')}
  </div>`;
  document.getElementById('content').innerHTML=html;lucide.createIcons();
}
/* ── Avatar Images (base64) ── */
var _AV_MALE   = 'data:image/png;base64,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';
var _AV_FEMALE = 'data:image/png;base64,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';

/* ═══════════════════════════════════════════════
   Customer 3D Avatar System
   Detects gender from Greek first name → renders
   stylized SVG male or female avatar with tier badge
═══════════════════════════════════════════════ */
const _FEMALE_ENDINGS = ['α','η','ώ','ού','ία','ενη','ίνα','ούλα','έλα','άνα','ύλα','ίκη','όνη','είρη','ώνη'];
const _FEMALE_NAMES = new Set([
  'μαρία','ελένη','γεωργία','αικατερίνη','κατερίνα','κατερίνη','αναστασία','σταματία',
  'σοφία','ειρήνη','ζωή','χριστίνα','βασιλική','βίκυ','δήμητρα','δήμητρη','νικολέτα',
  'αλεξάνδρα','αγγελική','παναγιώτα','θεοδώρα','ευαγγελία','βαγγελιώ','σταυρούλα',
  'χαρά','αθηνά','ασπασία','μελίνα','λένα','σάντρα','ιωάννα','γιάννα','αντωνία',
  'στέλλα','ελίνα','φωτεινή','ρένα','κική','λίτσα','μαριλένα','πόπη','βούλα',
  'ευθυμία','μαρίνα','μαριάννα','αρετή','θάλεια','καλλιόπη','ευδοξία','σεβαστή',
  'σπυριδούλα','δέσποινα','κλεοπάτρα','αρτεμισία','αφροδίτη','ηρώ','θεοφανία',
  'κωνσταντίνα','δανάη','ιφιγένεια','μυρτώ','αγλαΐα','ρόζα','νίνα','άννα','πηνελόπη'
]);

function _detectGender(fullName){
  if(!fullName) return 'male';
  const first = fullName.trim().split(/\s+/)[0].toLowerCase()
    .replace(/ά/g,'α').replace(/έ/g,'ε').replace(/ή/g,'η').replace(/ί/g,'ι')
    .replace(/ό/g,'ο').replace(/ύ/g,'υ').replace(/ώ/g,'ω');
  if(_FEMALE_NAMES.has(first)) return 'female';
  // Ending-based fallback
  for(const end of _FEMALE_ENDINGS){
    const e = end.replace(/ά/g,'α').replace(/έ/g,'ε').replace(/ή/g,'η')
      .replace(/ί/g,'ι').replace(/ό/g,'ο').replace(/ύ/g,'υ').replace(/ώ/g,'ω');
    if(first.endsWith(e)) return 'female';
  }
  return 'male';
}

function _custAvatarSVG(name, size, tierEmoji, tierColor){
  const gender = _detectGender(name);
  const initial = (name||'?')[0].toUpperCase();
  const s = size || 50;
  const isFemale = gender === 'female';

  // Color palette per gender
  const skinTone = '#FDBCB4';
  const hairColor = isFemale ? '#3d2314' : '#2c1810';
  const shirtColor = isFemale ? '#e879a0' : '#4a7fcb';
  const bgGrad1 = isFemale ? '#f9a8d4' : '#93c5fd';
  const bgGrad2 = isFemale ? '#ec4899' : '#3b82f6';

  const maleSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${s}" height="${s}">
      <defs>
        <linearGradient id="bg${s}m" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bgGrad1}"/>
          <stop offset="100%" stop-color="${bgGrad2}"/>
        </linearGradient>
        <clipPath id="circ${s}m"><circle cx="50" cy="50" r="50"/></clipPath>
      </defs>
      <!-- Background -->
      <circle cx="50" cy="50" r="50" fill="url(#bg${s}m)"/>
      <!-- Body/shirt -->
      <ellipse cx="50" cy="85" rx="28" ry="20" fill="${shirtColor}"/>
      <ellipse cx="50" cy="78" rx="22" ry="16" fill="${shirtColor}"/>
      <!-- Neck -->
      <rect x="43" y="58" width="14" height="12" rx="4" fill="${skinTone}"/>
      <!-- Head -->
      <ellipse cx="50" cy="46" rx="20" ry="22" fill="${skinTone}"/>
      <!-- Hair -->
      <ellipse cx="50" cy="28" rx="20" ry="12" fill="${hairColor}"/>
      <rect x="30" y="28" width="5" height="14" rx="3" fill="${hairColor}"/>
      <rect x="65" y="28" width="5" height="14" rx="3" fill="${hairColor}"/>
      <!-- Eyes -->
      <ellipse cx="43" cy="44" rx="3" ry="3.5" fill="#1a1a2e"/>
      <ellipse cx="57" cy="44" rx="3" ry="3.5" fill="#1a1a2e"/>
      <ellipse cx="44" cy="43" rx="1" ry="1" fill="white"/>
      <ellipse cx="58" cy="43" rx="1" ry="1" fill="white"/>
      <!-- Nose -->
      <path d="M50 48 Q48 52 50 53 Q52 52 50 48" fill="#e8a090" stroke="none"/>
      <!-- Mouth -->
      <path d="M44 57 Q50 61 56 57" stroke="#c0706a" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      <!-- Eyebrows -->
      <path d="M39 40 Q43 38 47 40" stroke="${hairColor}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M53 40 Q57 38 61 40" stroke="${hairColor}" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`;

  const femaleSVG = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${s}" height="${s}">
      <defs>
        <linearGradient id="bg${s}f" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${bgGrad1}"/>
          <stop offset="100%" stop-color="${bgGrad2}"/>
        </linearGradient>
      </defs>
      <!-- Background -->
      <circle cx="50" cy="50" r="50" fill="url(#bg${s}f)"/>
      <!-- Body/shirt -->
      <ellipse cx="50" cy="88" rx="30" ry="18" fill="${shirtColor}"/>
      <ellipse cx="50" cy="80" rx="24" ry="16" fill="${shirtColor}"/>
      <!-- Neck -->
      <rect x="44" y="59" width="12" height="11" rx="4" fill="${skinTone}"/>
      <!-- Head -->
      <ellipse cx="50" cy="45" rx="20" ry="22" fill="${skinTone}"/>
      <!-- Long hair back -->
      <ellipse cx="50" cy="50" rx="24" ry="30" fill="${hairColor}" opacity="0.9"/>
      <!-- Face overlay -->
      <ellipse cx="50" cy="45" rx="20" ry="22" fill="${skinTone}"/>
      <!-- Hair top -->
      <ellipse cx="50" cy="26" rx="21" ry="13" fill="${hairColor}"/>
      <!-- Side hair strands -->
      <ellipse cx="31" cy="50" rx="5" ry="18" fill="${hairColor}"/>
      <ellipse cx="69" cy="50" rx="5" ry="18" fill="${hairColor}"/>
      <!-- Eyes -->
      <ellipse cx="43" cy="43" rx="3.5" ry="4" fill="#1a1a2e"/>
      <ellipse cx="57" cy="43" rx="3.5" ry="4" fill="#1a1a2e"/>
      <ellipse cx="44.5" cy="42" rx="1.2" ry="1.2" fill="white"/>
      <ellipse cx="58.5" cy="42" rx="1.2" ry="1.2" fill="white"/>
      <!-- Lashes -->
      <path d="M39.5 40 Q43 37.5 46.5 39.5" stroke="#1a1a2e" stroke-width="1.5" fill="none"/>
      <path d="M53.5 39.5 Q57 37.5 60.5 40" stroke="#1a1a2e" stroke-width="1.5" fill="none"/>
      <!-- Nose -->
      <path d="M50 47 Q48 51 50 52 Q52 51 50 47" fill="#e8a090" stroke="none"/>
      <!-- Lips -->
      <path d="M44 57 Q50 60 56 57" stroke="#d4617a" stroke-width="2" fill="#e87a92" stroke-linecap="round"/>
      <path d="M44 57 Q50 55 56 57" stroke="#d4617a" stroke-width="1" fill="none" stroke-linecap="round"/>
      <!-- Cheeks blush -->
      <ellipse cx="38" cy="51" rx="5" ry="3" fill="#ffb3c1" opacity="0.5"/>
      <ellipse cx="62" cy="51" rx="5" ry="3" fill="#ffb3c1" opacity="0.5"/>
      <!-- Eyebrows (arched) -->
      <path d="M39 38.5 Q43 36 47 38" stroke="${hairColor}" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M53 38 Q57 36 61 38.5" stroke="${hairColor}" stroke-width="2" fill="none" stroke-linecap="round"/>
    </svg>`;

  return isFemale ? femaleSVG : maleSVG;
}

// Returns full avatar div with tier badge — uses real photo avatars
function custAvatarHTML(name, size, tierEmoji, tierColor){
  const s = size || 50;
  const gender = _detectGender(name);
  const src = gender === 'female' ? _AV_FEMALE : _AV_MALE;
  return `<div class="zn-cust-av" style="width:${s}px;height:${s}px;position:relative;flex-shrink:0">
    <img src="${src}" style="width:${s}px;height:${s}px;border-radius:50%;object-fit:cover;object-position:center 12%;display:block;flex-shrink:0">
    ${tierEmoji ? `<span style="position:absolute;bottom:-2px;right:-2px;font-size:${Math.round(s*0.28)}px;background:var(--bg-1);border-radius:50%;padding:0 2px;line-height:1.4">${tierEmoji}</span>` : ''}
  </div>`;
}

async function openCustomerDetail(id){
  const c=CUSTOMERS.find(x=>x.id===id);
  const custSales=SALES.filter(s=>s.customerId===id);
  const tierEmoji = {bronze:'🥉', silver:'🥈', gold:'🥇', platinum:'💎'}[c.loyaltyTier||'bronze'];
  const tierColor = {bronze:'#cd7f32', silver:'#c0c0c0', gold:'#ffd700', platinum:'#e5e4e2'}[c.loyaltyTier||'bronze'];
  const pts = c.loyaltyPoints||0;
  const tierThresholds = {bronze:100, silver:300, gold:700, platinum:null};
  const nextTierPts = tierThresholds[c.loyaltyTier||'bronze'];
  const avgPurchase = c.visits>0 ? c.totalSpent/c.visits : 0;
  const daysSinceLast = c.lastVisit ? Math.floor((Date.now()-new Date(c.lastVisit).getTime())/86400000) : null;

  // Φόρτωσε sale items για DNA tags
  await ciEnsureItems();
  const custItems = ciCustomerItems(id, CI_SALE_ITEMS_CACHE||[]);
  const dnaTags = ciBuildDnaTags(c, custItems);

  openModal(`<div class="modal-head">
    <div class="flex gap-3 items-center">
      ${custAvatarHTML(c.name, 54, tierEmoji, tierColor)}
      <div>
        <div class="fw-800 text-xl">${c.name}</div>
        <div class="text-xs muted">${c.phone||'—'} ${c.email?'• '+c.email:''}</div>
        <div class="text-xs mt-2" style="color:${tierColor};font-weight:700;text-transform:capitalize">${tierEmoji} ${c.loyaltyTier||'bronze'} Member • ${pts} πόντοι</div>
      </div>
    </div>
    <button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button></div>

  <div class="modal-body">
    <div class="grid kpi-grid">
      <div class="card kpi"><div class="kpi-label">Συνολικός Τζίρος</div><div class="kpi-value">${eur(c.totalSpent)}</div></div>
      <div class="card kpi"><div class="kpi-label">Επισκέψεις</div><div class="kpi-value">${c.visits}</div></div>
      <div class="card kpi"><div class="kpi-label">Μέση Αγορά</div><div class="kpi-value">${eur(avgPurchase)}</div></div>
      <div class="card kpi" style="background:linear-gradient(135deg,${tierColor}22,transparent)">
        <div class="kpi-label">Πόντοι Πιστότητας</div>
        <div class="kpi-value" style="color:${tierColor}">${pts}</div>
        ${nextTierPts?`<div class="kpi-sub muted">Απέχει ${nextTierPts-pts} από επόμενο tier</div>`:'<div class="kpi-sub">💎 Top tier!</div>'}
      </div>
      <div class="card kpi" style="background:linear-gradient(135deg,rgba(74,163,255,0.1),transparent)">
        <div class="kpi-label">🏦 Store Credit</div>
        <div class="kpi-value" style="color:#4aa3ff">${eur(c.storeCredit||0)}</div>
        <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px;margin-top:4px" onclick="_spManageCredit(${id})">
          + Προσθήκη
        </button>
      </div>
      <div class="card kpi" style="background:linear-gradient(135deg,rgba(0,212,168,0.1),transparent);cursor:pointer" onclick="closeModal();openCustomerLoyaltyQR(${id})">
        <div class="kpi-label">📱 Loyalty QR</div>
        ${(c.loyalty_qr_token||c.loyaltyQrToken)?`
          <div style="margin:8px auto;background:#fff;border-radius:8px;padding:6px;display:inline-block">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=ZYRONEX-LOYALTY:${c.loyalty_qr_token||c.loyaltyQrToken}&bgcolor=ffffff&color=0f172a&margin=0" width="80" height="80" style="display:block;border-radius:4px">
          </div>
          <div style="font-size:10px;color:var(--text-2);margin-top:2px">Πάτα για εκτύπωση</div>
        `:`
          <div style="font-size:11px;color:var(--text-2);margin:8px 0">Δεν υπάρχει QR</div>
          <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px" onclick="event.stopPropagation();_generateSingleQR(${id})">+ Δημιουργία</button>
        `}
      </div>
    </div>
    ${typeof renderLoyaltyBurnRateCard==='function' ? renderLoyaltyBurnRateCard(c) : ''}

    ${daysSinceLast!==null?`<div class="ai-box mt-4" style="padding:12px">
      <div class="flex gap-2 items-center">
        <i data-lucide="calendar-days" size="18" style="color:var(--info)"></i>
        <div class="text-sm">Τελευταία επίσκεψη: <b>${dateGR(c.lastVisit)}</b> (${daysSinceLast} ${daysSinceLast===1?'ημέρα':'ημέρες'} πριν)${daysSinceLast>=30?` <span class="chip chip-warn">Ανενεργός</span>`:''}</div>
      </div>
    </div>`:''}

    <div class="section-head mt-4">
      <div class="section-title"><i data-lucide="dna" size="16" style="vertical-align:-2px;margin-right:6px"></i>Customer DNA</div>
    </div>
    <div class="card" style="padding:14px 16px">
      <div class="flex gap-2" style="flex-wrap:wrap">
        ${dnaTags.map(tag=>`<span class="chip" style="font-size:13px;padding:4px 10px">${tag}</span>`).join('')}
      </div>
    </div>

    <div class="section-head mt-4"><div class="section-title">Ιστορικό Αγορών</div></div>
    <div style="max-height:300px;overflow-y:auto">
    <table class="tbl">
      <thead><tr><th>Ημερομηνία</th><th>Προϊόν</th><th>Ποσότητα</th><th>Νικοτίνη</th><th>Σύνολο</th></tr></thead>
      <tbody>${custSales.length===0
        ? '<tr><td colspan="5" class="muted" style="text-align:center;padding:20px">Δεν υπάρχουν καταγεγραμμένες αγορές</td></tr>'
        : custSales.slice(0,20).map(s=>{
            const p=PRODUCTS.find(x=>x.id===s.productId);
            return `<tr><td>${dateGR(s.date)}</td><td>${p?.name||'—'}</td><td>${s.qty}</td><td>${s.nicotine!=null?s.nicotine+' mg':'—'}</td><td class="fw-700">${eur(s.total)}</td></tr>`;
          }).join('')
      }</tbody>
    </table>
    </div>

    <div class="flex gap-2 mt-4" style="flex-wrap:wrap">
      ${c.email?`<button class="btn btn-primary" onclick="sendCustomerEmail(${id})"><i data-lucide="mail" size="16"></i> Αποστολή Email</button>`:''}
      <button class="btn btn-ghost" onclick="openCustomerEditModal(${id})"><i data-lucide="edit-2" size="16"></i> Επεξεργασία</button>
      <button class="btn btn-ghost" onclick="closeModal()">Κλείσιμο</button>
    </div>
  </div>`);
  lucide.createIcons();
}

async function addStoreCredit(customerId, amount, note){
  const c = CUSTOMERS.find(x=>x.id===customerId);
  if(!c) return;
  const newCredit = Math.max(0, (c.storeCredit||0) + amount);
  await _dbInvalidate('customers_'); sb.from('customers').update({store_credit: newCredit}).eq('id', customerId);
  c.storeCredit = newCredit;
  toast(`${amount>=0?'+':''}${eur(amount)} Store Credit → ${c.name} (υπόλοιπο: ${eur(newCredit)})`, 'success');
}

function _spManageCredit(customerId){
  const c = CUSTOMERS.find(x=>x.id===customerId);
  if(!c) return;
  openModal(`
    <div class="modal-head">
      <div class="modal-title">🏦 Store Credit: ${c.name}</div>
      <button class="modal-close" onclick="closeModal()"><i data-lucide="x"></i></button>
    </div>
    <div class="modal-body">
      <div style="text-align:center;padding:16px 0;margin-bottom:16px">
        <div class="text-xs muted">Τρέχον Υπόλοιπο</div>
        <div style="font-size:48px;font-weight:900;color:#4aa3ff">${eur(c.storeCredit||0)}</div>
      </div>
      <div class="form-row">
        <label class="form-label">Ποσό (+ για πρόσθεση, - για αφαίρεση)</label>
        <input class="form-input" type="number" id="creditAmount" step="0.01"
          placeholder="π.χ. 10 ή -5" style="font-size:20px;text-align:center">
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
        ${[5,10,20,50].map(v=>`<button class="btn btn-ghost" style="font-size:13px" onclick="document.getElementById('creditAmount').value=${v}">+${v}€</button>`).join('')}
      </div>
      <div class="form-row">
        <label class="form-label">Σημείωση</label>
        <input class="form-input" id="creditNote" placeholder="π.χ. Επιστροφή, Δώρο">
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModal()">Ακύρωση</button>
        <button class="btn btn-primary" onclick="_spSaveCredit(${customerId})">
          <i data-lucide="check" size="16"></i> Εφαρμογή
        </button>
      </div>
    </div>
  `);
}

async function _spSaveCredit(customerId){
  const amount = parseFloat(document.getElementById('creditAmount')?.value);
  if(!amount||isNaN(amount)){toast('Βάλε ποσό','warning');return;}
  closeModal();
  await addStoreCredit(customerId, amount, document.getElementById('creditNote')?.value||'');
  openCustomerDetail(customerId);
}

function openCustomerEditModal(id){
  const c = CUSTOMERS.find(x=>x.id===id);
  if(!c) return;
  closeModal();
  const hasShipping = !!(c.address || c.postalCode || c.city || c.floor || c.doorbellName || c.deliveryNotes);
  const hasWork = !!(c.company || c.workAddress || c.workPostal || c.workCity || c.workPhone);
  openModal(`<div class="modal-head">
    <h3 class="fw-800 text-xl">Επεξεργασία Πελάτη</h3>
    <button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button>
  </div>
  <div class="modal-body" style="display:flex;flex-direction:column;gap:10px">
    <div class="form-row"><label class="form-label">Ονοματεπώνυμο *</label><input class="form-input" id="ce_name" value="${c.name}"></div>
    <div class="form-grid">
      <div class="form-row"><label class="form-label">Τηλέφωνο</label><input class="form-input" id="ce_phone" value="${c.phone||''}" inputmode="tel"></div>
      <div class="form-row"><label class="form-label">Email</label><input class="form-input" id="ce_email" value="${c.email||''}" type="email"></div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label class="form-label">Γενέθλια 🎂</label><input class="form-input" id="ce_birthday" value="${c.birthday||''}" type="date"></div>
      <div class="form-row"><label class="form-label">ΑΦΜ</label><input class="form-input" id="ce_afm" value="${(c.afm||'').replace(/"/g,'&quot;')}" placeholder="π.χ. 123456789" inputmode="numeric" maxlength="12"></div>
    </div>
    <div class="form-row"><label class="form-label">Προτιμώμενη Νικοτίνη (mg)</label>
      <select class="form-select" id="ce_nic">
        <option value="">—</option>
        <option value="0" ${c.preferredNicotine===0?'selected':''}>0 mg</option>
        <option value="3" ${c.preferredNicotine===3?'selected':''}>3 mg</option>
        <option value="6" ${c.preferredNicotine===6?'selected':''}>6 mg</option>
        <option value="9" ${c.preferredNicotine===9?'selected':''}>9 mg</option>
        <option value="12" ${c.preferredNicotine===12?'selected':''}>12 mg</option>
        <option value="18" ${c.preferredNicotine===18?'selected':''}>18 mg</option>
      </select>
    </div>
    <div class="form-row"><label class="form-label">Σημειώσεις</label><textarea class="form-input" id="ce_notes" rows="2" placeholder="Ιδιαίτερες προτιμήσεις, σημειώσεις...">${(c.notes||'').replace(/</g,'&lt;')}</textarea></div>

    <div style="padding:8px 0;font-weight:700;font-size:12px;color:#9b59ff;letter-spacing:1px">🏠 ΔΙΕΥΘΥΝΣΗ ΚΑΤΟΙΚΙΑΣ</div>
    <div class="form-row"><label class="form-label">Οδός + Αριθμός</label><input class="form-input" id="ce_address" value="${(c.address||'').replace(/"/g,'&quot;')}" placeholder="π.χ. Πατησίων 76"></div>
    <div class="form-grid">
      <div class="form-row"><label class="form-label">Τ.Κ.</label><input class="form-input" id="ce_postal" value="${(c.postalCode||'').replace(/"/g,'&quot;')}" placeholder="10434" inputmode="numeric" maxlength="10"></div>
      <div class="form-row"><label class="form-label">Πόλη</label><input class="form-input" id="ce_city" value="${(c.city||'').replace(/"/g,'&quot;')}" placeholder="Αθήνα"></div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label class="form-label">Όροφος</label><input class="form-input" id="ce_floor" value="${(c.floor||'').replace(/"/g,'&quot;')}" placeholder="π.χ. 3ος"></div>
      <div class="form-row"><label class="form-label">Κουδούνι</label><input class="form-input" id="ce_doorbell" value="${(c.doorbellName||'').replace(/"/g,'&quot;')}" placeholder="π.χ. Παπαδόπουλος"></div>
    </div>
    <div class="form-row"><label class="form-label">Οδηγίες παράδοσης</label><textarea class="form-input" id="ce_delivery_notes" rows="2" placeholder="π.χ. Κτυπάει κουδούνι 2x">${(c.deliveryNotes||'').replace(/</g,'&lt;')}</textarea></div>
    <div style="padding:8px 0;font-weight:700;font-size:12px;color:#4aa3ff;letter-spacing:1px">🏢 ΔΙΕΥΘΥΝΣΗ ΕΡΓΑΣΙΑΣ</div>
    <div class="form-row"><label class="form-label">Εταιρεία</label><input class="form-input" id="ce_company" value="${(c.company||'').replace(/"/g,'&quot;')}" placeholder="π.χ. ABC ΕΠΕ"></div>
    <div class="form-row"><label class="form-label">Διεύθυνση Εργασίας</label><input class="form-input" id="ce_work_address" value="${(c.workAddress||'').replace(/"/g,'&quot;')}" placeholder="π.χ. Σταδίου 30"></div>
    <div class="form-grid">
      <div class="form-row"><label class="form-label">Τ.Κ. Εργασίας</label><input class="form-input" id="ce_work_postal" value="${(c.workPostal||'').replace(/"/g,'&quot;')}" placeholder="10563" inputmode="numeric" maxlength="10"></div>
      <div class="form-row"><label class="form-label">Πόλη Εργασίας</label><input class="form-input" id="ce_work_city" value="${(c.workCity||'').replace(/"/g,'&quot;')}" placeholder="Αθήνα"></div>
    </div>
    <div class="form-row"><label class="form-label">Τηλ. Εργασίας</label><input class="form-input" id="ce_work_phone" value="${(c.workPhone||'').replace(/"/g,'&quot;')}" placeholder="21xxxxxxxx" inputmode="tel"></div>
        <div class="flex gap-2 mt-2" style="flex-wrap:wrap">
      <button class="btn btn-primary btn-lg" onclick="saveCustomerEdit(${id})"><i data-lucide="save" size="16"></i> Αποθήκευση</button>
      <button class="btn btn-danger" onclick="deleteCustomer(${id})" style="margin-left:auto"><i data-lucide="trash-2" size="16"></i> Διαγραφή</button>
      <button class="btn btn-ghost" onclick="closeModal()">Ακύρωση</button>
    </div>
  </div>`);
  if(typeof lucide !== 'undefined') lucide.createIcons();
  setTimeout(function(){
    function mkT(hdrId,bodyId,arrId){
      var hdr=document.getElementById(hdrId);
      var body=document.getElementById(bodyId);
      var arr=document.getElementById(arrId);
      if(hdr&&body&&arr){
        hdr.addEventListener('click',function(){
          var open=body.style.display==='none';
          body.style.display=open?'flex':'none';
          arr.textContent=open?'▲':'▼';
        });
      }
    }
    mkT('ehdr_home','ebody_home','earr_home');
    mkT('ehdr_work','ebody_work','earr_work');
  },50);
}

async function saveCustomerEdit(id){
  const name = document.getElementById('ce_name').value.trim();
  const phone = document.getElementById('ce_phone').value.trim();
  const email = document.getElementById('ce_email').value.trim();
  const nicVal = document.getElementById('ce_nic').value;
  const preferred_nicotine = nicVal === '' ? null : parseInt(nicVal);
  const birthday = document.getElementById('ce_birthday').value || null;
  // Στοιχεία αποστολής (όλα προαιρετικά)
  const afm = document.getElementById('ce_afm')?.value.trim() || null;
  const notes = document.getElementById('ce_notes')?.value.trim() || null;
  const address = document.getElementById('ce_address')?.value.trim() || null;
  const postal_code = document.getElementById('ce_postal')?.value.trim() || null;
  const city = document.getElementById('ce_city')?.value.trim() || null;
  const floor = document.getElementById('ce_floor')?.value.trim() || null;
  const doorbell_name = document.getElementById('ce_doorbell')?.value.trim() || null;
  const delivery_notes = document.getElementById('ce_delivery_notes')?.value.trim() || null;
  const company = document.getElementById('ce_company')?.value.trim() || null;
  const work_address = document.getElementById('ce_work_address')?.value.trim() || null;
  const work_postal = document.getElementById('ce_work_postal')?.value.trim() || null;
  const work_city = document.getElementById('ce_work_city')?.value.trim() || null;
  const work_phone = document.getElementById('ce_work_phone')?.value.trim() || null;

  if(!name){toast('Συμπλήρωσε όνομα','danger');return}

  try{
    await _dbInvalidate('customers_');
    const res = await sb.from('customers').update({
      name, phone:phone||null, email:email||null, preferred_nicotine, birthday,
      afm, notes,
      address, postal_code, city, floor, doorbell_name, delivery_notes,
      company, work_address, work_postal, work_city, work_phone
    }).eq('id',id);
    if(res && res.error) throw res.error;
    await reloadCustomers();
    closeModal();
    renderCustomers();
    toast('Ενημερώθηκε','success');
  }catch(err){
    toast('Σφάλμα: '+err.message,'danger');
  }
}

async function deleteCustomer(id){
  const c = CUSTOMERS.find(x=>x.id===id);
  if(!c) return;
  showConfirm(`Διαγραφή πελάτη "${c.name}"; Οι αγορές του θα διατηρηθούν αλλά χωρίς σύνδεση.`, async ()=>{
    try{
      const {error} = await sb.from('customers').delete().eq('id',id);
      if(error) throw error;
      await reloadCustomers();
      closeModal();
      renderCustomers();
      toast('Διαγράφηκε','warn');
    }catch(err){
      toast('Σφάλμα: '+err.message,'danger');
    }
  });
}
/* ============================================================
   EMAIL SENDING end
   ============================================================ */
function openCustomerModal(){
  openModal('<div class="modal-head"><h3 class="fw-800 text-xl">Νέος Πελάτης</h3><button class="icon-btn" onclick="closeModal()"><i data-lucide="x" size="16"></i></button></div><div class="modal-body" style="display:flex;flex-direction:column;gap:10px"><div class="form-row"><label class="form-label">Ονοματεπώνυμο *</label><input class="form-input" id="c_name" placeholder="π.χ. Γιώργος Παπαδόπουλος"></div><div class="form-grid"><div class="form-row"><label class="form-label">Τηλέφωνο</label><input class="form-input" id="c_phone" placeholder="69xxxxxxxx" inputmode="tel"></div><div class="form-row"><label class="form-label">Email</label><input class="form-input" id="c_email" type="email" placeholder="email@example.com"></div></div><div class="form-grid"><div class="form-row"><label class="form-label">Γενέθλια 🎂</label><input class="form-input" id="c_birthday" type="date"></div><div class="form-row"><label class="form-label">ΑΦΜ</label><input class="form-input" id="c_afm" placeholder="123456789" inputmode="numeric" maxlength="12"></div></div><div class="form-row"><label class="form-label">Σημειώσεις</label><textarea class="form-input" id="c_notes" rows="2" placeholder="Προτιμήσεις, σημειώσεις..."></textarea></div><div style="padding:8px 0;font-weight:700;font-size:12px;color:#9b59ff;letter-spacing:1px">🏠 ΔΙΕΥΘΥΝΣΗ ΚΑΤΟΙΚΙΑΣ</div><div class="form-row"><label class="form-label">Οδός + Αριθμός</label><input class="form-input" id="c_address" placeholder="π.χ. Πατησίων 76"></div><div class="form-grid"><div class="form-row"><label class="form-label">Τ.Κ.</label><input class="form-input" id="c_postal" placeholder="10434" inputmode="numeric" maxlength="10"></div><div class="form-row"><label class="form-label">Πόλη</label><input class="form-input" id="c_city" placeholder="Αθήνα"></div></div><div class="form-grid"><div class="form-row"><label class="form-label">Όροφος</label><input class="form-input" id="c_floor" placeholder="π.χ. 3ος"></div><div class="form-row"><label class="form-label">Κουδούνι</label><input class="form-input" id="c_doorbell" placeholder="π.χ. Παπαδόπουλος"></div></div><div class="form-row"><label class="form-label">Οδηγίες παράδοσης</label><textarea class="form-input" id="c_delivery_notes" rows="2" placeholder="π.χ. Κτυπάει κουδούνι 2x"></textarea></div><div style="padding:8px 0;font-weight:700;font-size:12px;color:#4aa3ff;letter-spacing:1px">🏢 ΔΙΕΥΘΥΝΣΗ ΕΡΓΑΣΙΑΣ</div><div class="form-row"><label class="form-label">Εταιρεία</label><input class="form-input" id="c_company" placeholder="π.χ. ABC ΕΠΕ"></div><div class="form-row"><label class="form-label">Διεύθυνση Εργασίας</label><input class="form-input" id="c_work_address" placeholder="π.χ. Σταδίου 30"></div><div class="form-grid"><div class="form-row"><label class="form-label">Τ.Κ. Εργασίας</label><input class="form-input" id="c_work_postal" placeholder="10563" inputmode="numeric" maxlength="10"></div><div class="form-row"><label class="form-label">Πόλη Εργασίας</label><input class="form-input" id="c_work_city" placeholder="Αθήνα"></div></div><div class="form-row"><label class="form-label">Τηλ. Εργασίας</label><input class="form-input" id="c_work_phone" placeholder="21xxxxxxxx" inputmode="tel"></div><div class="flex gap-2 mt-2" style="flex-wrap:wrap"><button class="btn btn-primary btn-lg" onclick="saveCustomer()"><i data-lucide="user-plus" size="16"></i> Αποθήκευση</button><button class="btn btn-ghost" onclick="closeModal()">Ακύρωση</button></div></div>');
  if(typeof lucide !== 'undefined') lucide.createIcons();
}
async function saveCustomer(){
  const name = document.getElementById('c_name')?.value.trim();
  if(!name){toast('Συμπλήρωσε όνομα','danger');return;}
  try{
    await _dbInvalidate('customers_');
    // Auto-generate loyalty QR token για νέο πελάτη
    const _tmpToken = 'LYL-' + Date.now() + '-' + Math.random().toString(36).slice(2,8).toUpperCase();
    const res = await sb.from('customers').insert({
      name,
      phone: document.getElementById('c_phone')?.value.trim()||null,
      email: document.getElementById('c_email')?.value.trim()||null,
      birthday: document.getElementById('c_birthday')?.value||null,
      afm: document.getElementById('c_afm')?.value.trim()||null,
      notes: document.getElementById('c_notes')?.value.trim()||null,
      address: document.getElementById('c_address')?.value.trim()||null,
      postal_code: document.getElementById('c_postal')?.value.trim()||null,
      city: document.getElementById('c_city')?.value.trim()||null,
      floor: document.getElementById('c_floor')?.value.trim()||null,
      doorbell_name: document.getElementById('c_doorbell')?.value.trim()||null,
      delivery_notes: document.getElementById('c_delivery_notes')?.value.trim()||null,
      company: document.getElementById('c_company')?.value.trim()||null,
      work_address: document.getElementById('c_work_address')?.value.trim()||null,
      work_postal: document.getElementById('c_work_postal')?.value.trim()||null,
      work_city: document.getElementById('c_work_city')?.value.trim()||null,
      work_phone: document.getElementById('c_work_phone')?.value.trim()||null,
      total_spent:0, visits:0, last_visit:addDays(0),
      loyalty_qr_token: _tmpToken
    });
    if(res && res.error) throw res.error;
    await reloadCustomers();
    closeModal();renderCustomers();toast('Προστέθηκε','success');
  }catch(err){
    toast('Σφάλμα: '+err.message,'danger');
  }
}
var CI_TAB = 'dna'; // dna | coil | churner | flavor | tapering | birthdays
var CI_SELECTED_CUSTOMER = null;
var CI_SALE_ITEMS_CACHE = null; // lazy load

// Helper: πάρε όλα τα sale_items μία φορά και καθαρίστα τα σε δομή που χρησιμοποιούμε
async function ciEnsureItems(){
  if(CI_SALE_ITEMS_CACHE) return CI_SALE_ITEMS_CACHE;
  try{
    const {data, error} = await sb.from('sale_items').select('id,sale_id,product_id,quantity,unit_price');
    if(error) throw error;
    CI_SALE_ITEMS_CACHE = data || [];
    return CI_SALE_ITEMS_CACHE;
  }catch(e){
    CI_SALE_ITEMS_CACHE = [];
    return [];
  }
}

// Για κάθε πελάτη: όλες οι πωλήσεις του (από SALES)
function ciCustomerSales(customerId){
  return SALES.filter(s=>s.customer_id===customerId);
}

// Για κάθε πελάτη: όλα τα items που έχει αγοράσει (μέσω των sales του)
function ciCustomerItems(customerId, allItems){
  const saleIds = new Set(ciCustomerSales(customerId).map(s=>s.id));
  return allItems.filter(it=>saleIds.has(it.sale_id));
}

// Detection: ένα product είναι "coil" αν κατηγορία/όνομα υπονοεί
function ciIsCoil(product){
  if(!product) return false;
  const n = (product.name||'').toLowerCase();
  const c = (product.category||'').toLowerCase();
  return c.includes('αντιστάσ') || c.includes('coil') || n.includes('coil') || /\bmesh\b/.test(n);
}

// Detection: ένα product είναι "liquid" (για flavor profile)
function ciIsLiquid(product){
  if(!product) return false;
  const c = (product.category||'').toLowerCase();
  const n = (product.name||'').toLowerCase();
  return c.includes('υγρά') || c.includes('liquid') || n.includes('liquid') || n.includes('shake');
}

// Flavor guess από το όνομα του προϊόντος
function ciFlavorFamily(productName){
  const n = (productName||'').toLowerCase();
  if(/tobacco|καπν|virginia|ry4/.test(n)) return 'Tobacco';
  if(/menthol|mint|ice|cool|μέντα|παγωτ/.test(n)) return 'Menthol/Ice';
  if(/strawberry|φράουλ|berry|raspberry|βατόμ|blueberry|μύρτιλ/.test(n)) return 'Berry';
  if(/apple|μήλ|pear|αχλάδ/.test(n)) return 'Orchard';
  if(/mango|pineapple|ανανά|peach|ροδάκ|tropical/.test(n)) return 'Tropical';
  if(/custard|vanilla|βανίλ|cream|κρέμα/.test(n)) return 'Dessert/Cream';
  if(/cake|biscuit|cookie|donut|μπισκ/.test(n)) return 'Bakery';
  if(/coffee|καφέ|mocha/.test(n)) return 'Coffee';
  if(/cola|energy|redbull/.test(n)) return 'Beverage';
  if(/lemon|orange|πορτοκ|λεμ|citrus/.test(n)) return 'Citrus';
  return 'Άλλο';
}

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

// Phase scanner: SCANNER, SCANNER_MODE, startScanner, stopScanner,
// onScanSuccess + helpers, HID_SCANNER
var SCANNER = null;
var SCANNER_MODE = 'pos'; // 'pos' ή 'form'
var SCAN_CONTINUOUS = true;
var SCAN_HISTORY = [];
var LAST_SCAN = '';
var LAST_SCAN_TIME = 0;

function playBeep(){
  try{
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = 1200;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.15);
  }catch(e){}
}

function vibrate(){
  try{if(navigator.vibrate) navigator.vibrate(100)}catch(e){}
}

async function startScanner(mode){
  SCANNER_MODE = mode || 'pos';
  SCAN_CONTINUOUS = (mode === 'pos');
  SCAN_HISTORY = [];
  window.__useBackCamera = true; // ξεκινάμε με πίσω κάμερα

  // Δημιουργία overlay
  const overlay = document.createElement('div');
  overlay.className = 'scanner-overlay';
  overlay.id = 'scannerOverlay';
  overlay.innerHTML = `
    <div class="scanner-header">
      <div>
        <div class="scanner-title">📷 Σάρωση Barcode / QR</div>
        <div class="text-xs" style="color:#b6bcc8;margin-top:2px">${mode==='pos'?'Συνεχές σκανάρισμα':'Σάρωση για καταχώρηση'}</div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-ghost" onclick="switchCamera()" style="background:rgba(255,255,255,0.1);color:#fff;border:none" title="Εναλλαγή κάμερας">
          <i data-lucide="refresh-cw" size="18"></i>
        </button>
        <button class="btn btn-ghost" onclick="stopScanner()" style="background:rgba(255,255,255,0.1);color:#fff;border:none">
          <i data-lucide="x" size="18"></i> Κλείσιμο
        </button>
      </div>
    </div>
    <div class="scanner-area">
      <div id="qr-reader"></div>
    </div>
    <div class="scanner-footer">
      <div class="scanner-status" id="scannerStatus">Τοποθέτησε το barcode ή QR μπροστά στην κάμερα</div>
      <div id="scannerResult"></div>
      ${mode==='pos'?`<div style="margin-top:12px"><label style="color:#fff;display:inline-flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="continuousMode" checked onchange="SCAN_CONTINUOUS=this.checked">
        <span class="text-sm">Συνεχές σκανάρισμα (για πολλά προϊόντα)</span>
      </label></div>`:''}
      <div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.2)">
        <div class="text-xs" style="color:#b6bcc8;margin-bottom:6px">Ή πληκτρολόγησε χειροκίνητα:</div>
        <div style="display:flex;gap:6px">
          <input type="text" id="manualBarcode" placeholder="5201234567890" inputmode="numeric" style="flex:1;padding:10px 12px;background:rgba(255,255,255,0.1);color:#fff;border:1px solid rgba(255,255,255,0.2);border-radius:8px;font-family:monospace;font-size:14px" onkeypress="if(event.key==='Enter')submitManualBarcode()">
          <button class="btn btn-primary" onclick="submitManualBarcode()" style="padding:10px 14px">OK</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  lucide.createIcons();

  await startCameraNow();
}

async function startCameraNow(){
  try{
    // Cleanup παλιός scanner
    if(SCANNER){
      try{
        if(SCANNER.isScanning) await SCANNER.stop();
        SCANNER.clear();
      }catch(e){}
      SCANNER = null;
    }

    SCANNER = new Html5Qrcode('qr-reader');

    // Όλα τα formats που υποστηρίζουμε (barcodes + QR)
    const formats = [
      Html5QrcodeSupportedFormats.EAN_13,
      Html5QrcodeSupportedFormats.EAN_8,
      Html5QrcodeSupportedFormats.UPC_A,
      Html5QrcodeSupportedFormats.UPC_E,
      Html5QrcodeSupportedFormats.CODE_128,
      Html5QrcodeSupportedFormats.CODE_39,
      Html5QrcodeSupportedFormats.CODE_93,
      Html5QrcodeSupportedFormats.ITF,
      Html5QrcodeSupportedFormats.CODABAR,
      Html5QrcodeSupportedFormats.QR_CODE,
      Html5QrcodeSupportedFormats.DATA_MATRIX,
      Html5QrcodeSupportedFormats.PDF_417,
    ];

    // Responsive scan box
    const vw = window.innerWidth;
    const boxW = Math.min(300, vw - 80);
    const boxH = Math.round(boxW * 0.65);

    const config = {
      fps: 10,
      qrbox: {width: boxW, height: boxH},
      aspectRatio: 1.333,
      formatsToSupport: formats,
      disableFlip: false,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      },
      // Καλύτερη ανάγνωση για αργά barcode
      videoConstraints: {
        facingMode: window.__useBackCamera ? 'environment' : 'user',
        width: {ideal: 1280},
        height: {ideal: 720},
        focusMode: 'continuous',
        advanced: [{focusMode: 'continuous'}]
      }
    };

    // ΣΗΜΑΝΤΙΚΟ: Χρήση facingMode αντί για deviceId
    // Αυτό είναι πιο αξιόπιστο σε iPhone Safari
    const cameraConfig = window.__useBackCamera
      ? {facingMode: {exact: 'environment'}}  // Πίσω κάμερα
      : {facingMode: 'user'};                  // Μπροστινή κάμερα

    try{
      await SCANNER.start(cameraConfig, config, onScanSuccess, ()=>{});
    }catch(err1){
      // Fallback: κάποια iPhone δεν υποστηρίζουν 'exact', δοκιμάζουμε χωρίς
      console.warn('Exact mode failed, trying fallback:', err1);
      const fallbackConfig = window.__useBackCamera
        ? {facingMode: 'environment'}
        : {facingMode: 'user'};
      try{
        await SCANNER.start(fallbackConfig, config, onScanSuccess, ()=>{});
      }catch(err2){
        // Τελικό fallback: πάρε λίστα καμερών και διάλεξε χειροκίνητα
        console.warn('facingMode failed, trying device list:', err2);
        const devices = await Html5Qrcode.getCameras();
        if(devices.length === 0){
          throw new Error('Δεν βρέθηκε κάμερα στη συσκευή');
        }
        // Προτίμηση: back/rear/environment
        let cameraId = devices[devices.length - 1].id; // Συνήθως η τελευταία είναι η πίσω
        const backCamera = devices.find(d=>/back|rear|environment|πίσω/i.test(d.label||''));
        if(backCamera && window.__useBackCamera) cameraId = backCamera.id;
        const frontCamera = devices.find(d=>/front|user|selfie|μπροστ/i.test(d.label||''));
        if(frontCamera && !window.__useBackCamera) cameraId = frontCamera.id;

        await SCANNER.start(cameraId, config, onScanSuccess, ()=>{});
      }
    }

    const st = document.getElementById('scannerStatus');
    if(st){
      st.innerHTML = `<div style="color:var(--accent)">📷 Κάμερα ενεργή — σκανάρισε barcode ή QR</div>`;
    }
  }catch(err){
    console.error('Scanner error:', err);
    const st = document.getElementById('scannerStatus');
    if(st){
      st.innerHTML = `
        <div style="color:var(--danger)">
          ⚠️ Αποτυχία ενεργοποίησης κάμερας
          <div class="text-xs muted mt-2">${err.message||err}</div>
          <div class="text-xs muted mt-2">
            Βεβαιώσου ότι:
            • Έδωσες άδεια πρόσβασης στην κάμερα
            • Δεν την χρησιμοποιεί άλλη εφαρμογή
            • Η σελίδα φορτώνει μέσω HTTPS
          </div>
        </div>`;
    }
  }
}

async function switchCamera(){
  window.__useBackCamera = !window.__useBackCamera;
  const st = document.getElementById('scannerStatus');
  if(st){
    st.innerHTML = `<div class="muted">Εναλλαγή σε ${window.__useBackCamera?'πίσω':'μπροστινή'} κάμερα...</div>`;
  }
  await startCameraNow();
}

function submitManualBarcode(){
  const input = document.getElementById('manualBarcode');
  if(!input) return;
  const code = input.value.trim();
  if(!code) return;
  input.value = '';
  // Προσομοιώνουμε successful scan
  onScanSuccess(code, {decodedText: code});
}

async function onScanSuccess(decodedText, decodedResult){
  const now = Date.now();
  // Debounce: ignore duplicates within 1.5s
  if(decodedText === LAST_SCAN && now - LAST_SCAN_TIME < 1500) return;
  LAST_SCAN = decodedText;
  LAST_SCAN_TIME = now;

  playBeep();
  vibrate();

  // Display result
  const resultEl = document.getElementById('scannerResult');
  if(resultEl){
    resultEl.innerHTML = `<div class="scanner-result">✓ ${decodedText}</div>`;
  }

  if(SCANNER_MODE === 'form'){
    // Γέμισμα του πεδίου και κλείσιμο
    const input = document.getElementById('f_barcode');
    if(input) input.value = decodedText;
    setTimeout(()=>stopScanner(), 500);
  }else{
    // POS mode — προσπάθεια εύρεσης προϊόντος
    const product = PRODUCTS.find(p => p.barcode === decodedText);

    SCAN_HISTORY.unshift({code:decodedText, product, time:new Date()});

    if(product){
      document.getElementById('scannerStatus').innerHTML = `
        <div style="color:var(--ok)">✓ <b>${product.name}</b> — ${eur(product.price)} (stock: ${product.stock})</div>`;

      if(product.stock === 0){
        document.getElementById('scannerStatus').innerHTML = `<div style="color:var(--danger)">✗ <b>${product.name}</b> — ΕΞΑΝΤΛΗΜΕΝΟ</div>`;
      }else{
        // Προσθήκη στο καλάθι
        if(_productNeedsNicPicker(product)){
          // Για προϊόντα με νικοτίνη/αναμίξιμα υγρά, σταμάτα τον scanner
          stopScanner();
          setTimeout(()=>openNicotinePicker(product), 300);
          return;
        }
        const existing = CART.find(i=>i.productId === product.id);
        if(existing){
          if(existing.qty < product.stock) existing.qty++;
          else toast('Ανεπαρκές απόθεμα','warn');
        }else{
          CART.push({productId:product.id, qty:1, price:product.price, nicotine:null});
        }
        renderCart();
      }
    }else{
      document.getElementById('scannerStatus').innerHTML = `
        <div style="color:var(--warn)">⚠ Δεν βρέθηκε προϊόν με barcode: ${decodedText}</div>`;
    }

    // Αν δεν είναι continuous, σταμάτα
    if(!SCAN_CONTINUOUS){
      setTimeout(()=>stopScanner(), 800);
    }
  }
}

async function stopScanner(){
  try{
    if(SCANNER && SCANNER.isScanning){
      await SCANNER.stop();
      SCANNER.clear();
    }
  }catch(e){console.warn(e)}
  SCANNER = null;
  const overlay = document.getElementById('scannerOverlay');
  if(overlay) overlay.remove();
  LAST_SCAN = '';
  LAST_SCAN_TIME = 0;
}
var HID_SCANNER = {
  buffer: '',
  lastKeyTime: 0,
  CHAR_TIMEOUT: 50,        // ms between chars to count as "scanner speed"
  MIN_LENGTH: 4,           // minimum barcode length to accept
  enabled: false,

  init(){
    document.addEventListener('keydown', (e)=>this._onKey(e), true);
    this._refreshEnabled();
    // Re-check whenever settings might change
    window.addEventListener('storage', ()=>this._refreshEnabled());
  },

  _refreshEnabled(){
    try{
      const s = JSON.parse(localStorage.getItem('katastimaSettings') || '{}');
      this.enabled = s.scanner === 'usb' || s.scanner === 'bluetooth';
    }catch(_){
      this.enabled = false;
    }
  },

  _onKey(e){
    if(!this.enabled) return;

    // Don't capture when user is typing in an input/textarea/contenteditable
    // EXCEPT in POS where we want barcode-to-cart even with focus on search field
    const t = e.target;
    const isInputElement = t && (
      t.tagName === 'INPUT' ||
      t.tagName === 'TEXTAREA' ||
      t.tagName === 'SELECT' ||
      t.isContentEditable
    );
    const isInPOS = window.CURRENT_PAGE_ID === 'pos';
    if(isInputElement && !isInPOS) return;

    const now = Date.now();
    const delta = now - this.lastKeyTime;

    // If too much time passed, reset buffer (probably a new scan starting)
    if(delta > 200){
      this.buffer = '';
    }

    // Enter or Tab = end of barcode
    if(e.key === 'Enter' || e.key === 'Tab'){
      if(this.buffer.length >= this.MIN_LENGTH && this._looksLikeScanner()){
        e.preventDefault();
        e.stopPropagation();
        const code = this.buffer;
        this.buffer = '';
        this._emitBarcode(code);
      }else{
        // Not a scanner input, leave it alone
        this.buffer = '';
      }
      return;
    }

    // Only collect printable single chars
    if(e.key.length === 1){
      this.buffer += e.key;
      this.lastKeyTime = now;
    }
  },

  _looksLikeScanner(){
    // After Enter, check if the typing was fast enough to be a scanner.
    // If buffer has been growing with intervals < 50ms, it's a scanner.
    // Since we already filter by lastKeyTime continuously, anything that
    // reached MIN_LENGTH without resetting is fast typing or a scanner.
    // Conservative check: barcode must be alphanumeric and at least MIN_LENGTH.
    if(this.buffer.length < this.MIN_LENGTH) return false;
    // EAN/UPC are usually all digits; CODE128 can have letters. Accept both.
    return /^[\x20-\x7e]+$/.test(this.buffer);
  },

  _emitBarcode(code){
    // Always show a brief toast for visibility
    if(typeof toast === 'function'){
      toast(`📷 Scanned: ${code}`, 'info', 1500);
    }

    // If on POS, route through the existing camera handler so all
    // logic (product lookup, cart add, nicotine picker, beep) works identically.
    if(window.CURRENT_PAGE_ID === 'pos' && typeof onScanSuccess === 'function'){
      try{
        onScanSuccess(code, {result:{format:{formatName:'HID'}}});
      }catch(e){
        console.error('HID -> onScanSuccess error:', e);
      }
      return;
    }

    // If on Inventory page and a product form barcode field is open, fill it
    const formInput = document.getElementById('f_barcode');
    if(formInput && formInput.offsetParent !== null){
      formInput.value = code;
      formInput.dispatchEvent(new Event('input', {bubbles:true}));
      return;
    }

    // Otherwise, just log it — the user may be testing
    console.log('[HID Scanner] Code captured but no handler:', code);
  }
};
