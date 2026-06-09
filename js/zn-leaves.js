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
