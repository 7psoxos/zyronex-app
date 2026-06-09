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
  admin: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAABWGlDQ1BJQ0MgUHJvZmlsZQAAeJx9kLFLw1AQxr9WpaB1EB0cHDKJQ5SSCro4tBVEcQhVweqUvqapkMZHkiIFN/+Bgv+BCs5uFoc6OjgIopPo5uSk4KLleS+JpCJ6j+N+fO+74zggOW5wbvcDqDu+W1zKK5ulLSX1jAS9IAzm8Zyur0r+rj/j/T703k7LWb///43Biukxqp+UGcZdH0ioxPqezyXvE4+5tBRxS7IV8onkcsjngWe9WCC+JlZYzagQvxCr5R7d6uG63WDRDnL7tOlsrMk5lBNYxA48cNgw0IQCHdk//LOBv4BdcjfhUp+FGnzqyZEiJ5jEy3DAMAOVWEOGUpN3ju53F91PjbWDJ2ChI4S4iLWVDnA2Rydrx9rUPDAyBFy1ueEagdRHmaxWgddTYLgEjN5Qz7ZXzWrh9uk8MPAoxNskkDoEui0hPo6E6B5T8wNw6XwBA6diE8HYWhMAAFx3SURBVHjanf13mKRXdfaN/vaTKlfn3JNzzkEzCiMJlLNEEEHkaMCAXzBOgG1sYww2BnwwGJMFEghQTqMwI2lyznmmc+7q6opP3Pv88VQHYZ/v/a7Tc/XVM9U13VU7rHCve91LNM/aqkSqmj/5138jmYrwu+99m3P79+HZNkrXESiEEED4qSFQAgQCoQkQGkIJEAI0gdC08HtCC/+fEGiaVvl3+IkQCDH9OZXHJv8fUPm7mvy7AAWghf+Gyr9BIQGFUgIhFEKAUqBQ4XOURCqJqnwKAUpKkArF1ONKqvDpSqLk1OMoiVIKhar8P1n5veHPV0oBsvJiVOVL5TWhUDIgmqxl3c23cc/7P8T5U2d57rvfJW4IRFXbVep9f/8PzFg4m3/9+AfJ9/WQSqXRhUBpGkLo4aJMvHFB5UOApqEJgUBDCVHZIw1N0yYXUGhi8meAhjaxaZVN0IQ2uQFA5bmissja5CaFe6mh6RoIhVQKoSbOhaCyUygpCWSAkhKBmFx4kEgZTKwPKBU+LoPJBZaVhVQqQMpgclNBweSGTCyqAhUglUIphZhcdBATPxsJUqBQBNKjUCjQvnINn/3O9znw/Evse+y3GEuu3caqTev554+8n3J/NzU1NeEGCw2hFOG7rLxRBFKocJErJ1VVNgYBaBpU1kKbOKXTbsLkjahcKDHxFyobrIWbhhJoQp98jkCAUBTLeTKZURzHRQVeePoECE3D0C2i0RjVVVVE4wmU0FHSBxW+PoVAaDooP1x8JvZcC29LZcNU5c1qmoZSikD4CKXQdB0VSCBAoKO0AKE0hAoQUk1ex4mbp0TldgiJEhq6MKmrrePK0QP8+uv/xEN/8WXO7j+IcfVtt3Fy3z56zp2mvroWP1AgFSUnTzQaRVM6AQFM3gSF0HRkxTxoVE6vEAglEZXTjy5AM9BEeOonN2HizU2efB1N6AimFhxVuUWV26ZrBn7gMjY6xNWbFzNn1kzMWATNiuH5GrbtUi6V6enp4+D+w7Q2z8K0EkihEFp4RFRlcScWGxmeXDQFEjSdikkKF14pASrAlDoKKJSLRHUTqYFdKmNFdARUbpVCBkF4YCumBzVpgMKN1Qx8CfV19Rzf9Tpjw0Ms2bwZo3XuAl757S8xZYASAoVHNFbL2g33cObsblwnTzyeRE2e+sqJ1vTK6SY8WUyYk/Cr45RQMkCbNC0Tpkebdis0DCOCoRvhLVcVs1Q5faGpAV3XGctmSSZ0vvPtvwdhUvIDXKmxd88xPF+hFNx0WwNdHX9FdmyY5tYUShno05yFQiIDDWEohFAEgUHguwhNC32BkGgqtPNKSKQUSAGBHmXNDdu4fOoY/niJ62+8naOnXqdoj6IJAyn90HQFAYjQPIW3KbxpuqbjOmU8z8bQdAKnRNfFs7TNmYNhmDpeMR9edSUIfEWiro41a66np+cSOeWRSKaQFQcoNKOy6KF/0DQN3bAQWuUk6+GJz4wMEnjOlMPVDBBi0mQZmolh6riuQ093J9U1tTQ2tuJ5cnLDQocqMK0Imcwo121djK9ZnLnQSywaQUqNjss9lMouxbLNsmWCJcuW8dILrzLTtAC/4ijDDZBSYkYgmxlkeLCf5tZ2YokkgZT4no8QFSdNENp4RPhvTWfRuvX0d3dQzrm0ts/m1Pn9mEEUKxJBBn7oL6R8s9+onH/DMFBK4blu+DOlTymXp2lGAmPCHkoR7phpGoxmuvjxT/8aFTgYpk52fAypKk6Q8PRPOE8lPVzHQTcMdM1AGAJNWGi6Xtmk0AkjdAA0TcM0o3iuTceFi5Tyo1y/bSNHj1/Etm1mzVmI9BW6YaLrOp5yKJXKjI6OsnHTGtyKmZOAZukYloHueSQTEUrFPIuXLOXJJ56jWMqTiKfC5yoIfB/DhN7uC+Tzw6xZv5qDBw6j6RFmzJhNLBLH9X2CwEFpCoGOhkIIC993+c23v4lGgJIBT/zhh2SLGQLKE54u/JBqKhJSFb9QCRLCaHLi4dB5KSEwqIRkGqFDU4CuQzSqYduCeKKKRKqqsgEC0NF0HV0LN8Dzy4wODaBrIHSBrhloIrzuOpEwmtEMBDqmaYImGOrrpa/7Eps3LePTf/oX3PyWbby6cy8PPfQ5CAJa2mYzOjrA6OgwdqlMMq6zZnk711y9icxonng8RjKZoKtzkHy+SCqVwnd9ctlx5i+cx8ZNa7l0/gqlUhlD16muqqehvp7+/h4y2QG++Nd/wZw5c7jt7gGee+oZ9u7ZR3VVHY1NrQhh4XluJXoTBNJHR5CK6pTtEtWpJv7841/n+7/6JoPZDhKxKvzACc2WVEjlowggqJg9ITA0jVIhh10uomk6Sgb4gU8gFeI7+4fUkz/4Dgef+C3JqiqUUmiagaJipyfCO20qmjCExPE9LMNCGCa6pk+edE1oKN3EiCQQgY+uW2i6gWEY5HPjdHVcYFZbDZ/77Ae56767cNDp7R9l7uwm9u18g3e981O4rqS9vYFNV61j27UbWbFyMW0zZ6JZcbI5lysdvTzzzPM8/run8X3J5i2bWbF8CclklKqaOqqraygUinR1dnL65EnOnDpNX08vkajJV7/2NQIFRw4fZtaMdubNn0PHlQ4e/sXD9Hb3MmvWfBKJKrwgQEkfKf1KTuDjBx6B51MTbySTH0LghEHWhOOuGB2tcgskYaisKYXvu0jpoWuC0UyGB77wZWavWI/47r4h9cQPv8PBx39DqroaKQk3QNPCH1SJwTWhV2J9BcqiuqmdfGYQGThoholAQ9fDiGT2og1ce+PdPP3Yj3GdPNFoitHhftzyKO9515187BPvI5qupW9oDN9XaIaB7ZSZO6OJPTt20ts7wI03bqOqvg6lR5BSMDaa5/ChYzz++PO8/OKrSK/MXXfdgBWP89xzr+I4imVLl7JoyQJq6xuIJRLE4jGqq9LEolE6Ll+iuaUZKQNOHDtBKpnE9Rxc16W5uYXm5ia2v/AiO17ZSW1tIzW1TfiBhwwClAoQysfxbaIqxk2rbmXHsRfJaTkiRjzMESomXCiFXcrheU4lyVMgg8m8QBOCTGaMB77wZWYuW4uhqKzptPxq4ouaSIDQUSo0OX7gk65t4X2f+AqPP/IDLpzcRcKKTDpow5SMZ4c4eXQPrluezJNGhgd42/3b+Ie/+wJHLw3h5kexTANDD5OfWCTGla4hlq3fyJqtUYrlgJG8oK+nk9d37OTpJ57h9JHTNLRU86kP3c273nMPS5Yt5NJggY/8yUM89/QL/PbRZzn8i/20tLSwZNlSZsyezUgihmma1NfVMp7N0tvXSzIVJ/ADhKZhRaIMDAzT29/PHXffSyRi8exTz1NX1xJGbJpElwLPk8hAoRs6VfEqdM1EFzq60FBG6B8DKRFIAqXwfR+NMAOXSlaiMTGZK4kwKsAI4YQQXlDTohQqC68BvpL4SsdAhSGiX+by+VPYxRyWFQ1DMcJY3rR07EKO86cOIABdN0FAdU0d+w4c40LfCK4vEYaOlDIM1YIQHqhKJ9G0CONjRU6dPM9TTzzL80+/SGF4gJXrl/LNf/0C9993K+3NjeSAgbLNE89fIZWs4/o7H+It976Nw3v38tTvnmDnjlfQRISlK5azbPkiVOCg6TrxWAzHtpEyhBCUAMsysR2f7Pg4V65cIZlIo+sWfhBgCRNH+kTq6jAdl3wuw/aRvYxqJUw9hmdGUIEfJqCaBgpiVY3E0pXsWYbZdqkwjOcW0IRZ8YsCoRRGBUapeHMF0gdNR0kNXQNPBiRqWnjgHZ/m1e2/o/vyUcp2iaf/8As0aWNFIihhoelxwEHXNAwzRiKRplQshNmmEtTWN3P25AHOnj7DouWrGRjJEbN0IlaERDqGrkFX1wDbt+/gqSde5NThE1SlTe6583oefPA+Nl27EdM0GVNwoeygm6Fjl1qcnn6NKz0Z4klYMP8a/u7frme0/xLbn32R7c/t4OFfHqapvpmlyxcxa/YsUqkkCoXrukgZ4PgulhXDLjtcOHue1tZ5Yd6jWyjpUQ407njoAxzauYOeU2e464Mf5Hc/+G+qUrWkG5pxyyUC30NKr+KMJSqQyEAiAw/T0Oi6cJLMwBU0dIQII0YAYwLOQoTps1IBvhQoYRHggwgI/ICR4UFc30UhsOJprr/jPRzd+wr9V84wa958br/rvTz1+C8ZHe7EFBq+56FpBugCiSCVqkLXo/z213/gW/9xDUU7IBmNMjw8zGs73uCZp7bzxs69+K7PNVet5DPf+ytuuvV62lqbyAFjrksEMARYhk542cGXCnRBujqFbgoudbicPTdGW0sT9733U7zj/e/j5NFDPPfkdva+cYCdO1+jva2V+Yvm09rSQiwew5EejbUzOH3yJOWyTVVNPYHU0TRFyXFZu/FaDjz/Gl3nTmBp8KMv/y1KBQzZ53BlGJoiPZQMwqRMTd1qGUhsxyYWi2KZZggYahpaJZE1mMREmIpyrDR3v+tTHNy1nctn9uIEoxx99VXyxWEMPYQJtFgNmhlFN8C2i1y+eI7AdzEq8btuGgQKJIpIxGJsbARNBCxavICx4SG2P7uT13fuZtcbB8hnsixeNIsv/Ol7uO/em1m0fBEakAF6g4CErlNrWex+Yz+pqMmitavIBBIhFIhwg5WhiNQ4qMIIC5YtYWykxBt7BzENnVmzt/D5r1xDMdfL3jd288qzL/P6zlcJXEnbrDba2ttpqG2lrraWSDTC2FiG+qbZlIpllq7fgu249F84RyoaxZc+mh/gA5GIhSk9pNRQgUASQKCDCoE8xy6TbGjintvfzf6dz9B/5QzRWKSSX4S+15gIn8IYKozzUT5jY2N4rk0gPRLROt5+8+d4ftcvOHHlJWJKEAThThu6hVMucuHcCWynjGFGQDPRjQiWZmHqOrmxUXo7L7Fw0VxOne7iG6tvopTJ0Dp3Bu+89wbuf9vtbNi8hkQkQhYY8DzipkkaGC0UeeHVPfz6kWfZv2cfTz77M2yhIZBYhkYkZlIqazglj4YWk59965vUV1Xz1vvuYNm6Nfh+kv6uAmfOZoknEyxedx8bb7ib0eFODr/2Ortefp3DB/axZ8dOVq9ez5yZc+ju6cSworTOWkrgSgYuX6YqXYPrO2i+TaD76JWFD9FbkEIPwU8U0new7TIEinQ0zYr1d3HhxHF6LhxHiEgFdglDVGNy4YVWATQVvu1wZc8BcuODmIaFL0tc7DtBrjiKVknpdQJEBbXUDRNQRKxYiMPpenj1yiX6MiP093bg2wXOnsmTGRrkwXfewa133siaLeuoTqcpAQOOixlIanWNKtPk7LFTPP77F/jD71+mdzhPuejx4Q/exuplizhfdklFTbLDWQb7M1TVVuG4LhEryU233sG3/+bvObzrMI3tjVx38zbWX38NbYvmMTwoOHJ2lPxogZp0iiVb3sHWO99BcayHs4cPsevVN+g420OhVOD8ycOMZ0ZJ1zSSTleh6QZRXSfQDTzPxvOYPLiVVAAlBL7vkIjUsnXVNRw5vZNyocxg9yh2yQYhJy1NiAcqjImsOSyGhM43Fkmybcvd7D78NKcu9+PKIjuOPIzjlLEicaST5/yRNyhkh9A0jcB3GBm6ggwkhWKR3Pg4pcI4QgQ0N9Rw83Ur2XzVaq7aupFFq5ZhxWPkgJwTMO4GVFk6dRGLvq5ennthJ089+RK7953E9iOsXr+J5nlxjh98jYfedw+FSpyWEIKdR/o4c6KTt9w+H9OOMjpYYN22a5i1YC7CsRC+xc+/+3N+9f2fsmTtYq6+6QYWrduMvryF3m6Hw4eGcQolGurjzFtyKxtvuItycZSLZ05y4tARzh47RWfHMdySRyQSI11dQ1UyhTAMNN1A1yyCCdQhULiOg+8HVFe3c+f1n6Cvr4uLo5cpF2w8xwUVVJBWNZk5G2qyqhR+aLqOG9g8+8bPyRVHiESik+GlH2igwuufH+lD+jbCMPGcEn29nfh2iYb6NJvXLWTDhtVs2LiapSsWU9fUQACMAwO2C65H0jKpjehkB4Z59bX9PPP4C+x4dR9jYznq2hey+fr7mL9wMYlkgt8/8jBbNyxi3doVdLkBccukbHucvVDGtRXF8TGq6moYz+UxY3VsuXErT/zs92zddjtz5i9muL+HjpOnOfrqP5GqS7B08xo23nAjm7ZswDTn0N9T4PiJAQqvlUhWWcycu4a73nsNb/9owOjoAB3nznLq0HEuHD/Nxc6TGErQ2DSTmobWsIqmKfSIRfvs+fRcPovnegz2Z/AcBUqjXCjhe34Y3iumKm1UTJASUzgQKsT7leGhmxoiMND0SIhe6iYqCNAMi1g0guOUw9pBsUSpkOUf/vGLvOPBexBV1aALihIyTsBIySMW0anSNZqiFoP9g+x84zDPPfUSr+/Yw0jvMFZtA4tXbuaGJauorq6jZJcZGOxj+FgfvR3n+eevfAUPgR1IkpbBwaO9jOYNTMOi63I369rqMG2T/p4S1991O0/+/BHOHN9LffMcUlUNbN52G45dZLCvm1N7LrLv+f3UNteweusGNl53FVuuXYEy2hjosem4NMqhg50E0qelrYG2Wdu484O3YEZ8fDvHv/3ZFxjrHaa6oR3djOCWXJpnLuCdD32aX/zwHyl0D1N2fKRmIDQTp+gQKIXQxJtKpUpoGGICnWOiOqUQSIr5PIH0QnBNF7ieg1IKw4ggBAyPDKIJHccukC+Mo2kGc5cuJFNdQ9dojqp4hNpEhNqYjpsv03P0Mi/sOcJrOw+w/9AJBgfHiaVrmb9gFdfdupKG1lZcL2BkaIhLF87g+R6pWJS+KxdYOL+R6956DQO+xLQMbNflwLEMupXAtEz6e4dwykXiqSjZjMPsDQvYcuMWdr+wm6qaBgbzeQYHdaqqamifvZiFy9dRyufp67rCoVeOsePxHaTrkixauZhVW9excOkqlq9bSDEPe7fvZudvH0HhYsYNVm9egu/5eE6Z/PgoVTVhxqy5BuV+F93XMaMxiCk0S8c0Iui4FbTBmKwsKgVSqhCKmEQgJut0Cte2EboIa7BK4Xl2CDcIE9OyAAM/8MiNZ/ACG00YFG2fcVcRj0bwe3t5/MWdnDp+nmOHTtHROYDtCWrqm5i3cCPX3LKAmvo6QOPMiaO8/OITFHM5DF1j8fJVtMyYTamYo7vrIn/xF+/HSMTJlsrUxWOcPTvM4AgkaxRmKiA7ENB5pYvlG1ZQdgMy45LbHryfV556hXK5QDJZh+87XD53iJOHCxjROM1ts2hrn0vLrAU45RKjQ31cONbBoZ1H0KLQMrOZmXNmc/LwIdpbm0im0rglj2PbL2EFEs0QjGcGSaVqMU2DfLaPvbueoFQYxQlK7Dr6O7KlfqQ/ztFDvyef68EwDKaFnCDAmCifTT44jdEgKvXaEMs3wvRZ01BKwzRMisUCQeDxlhuv4cknngdNEPiS6liEhx99gm9/+VvE2xbR1jaXa27cQl1LM/FEAhUosmMZert7KRfznDq4mz/56D0sXzGXXQfP8ZtHX6CltZ2+7h5qauLc+8576JcSDAM3CNh/ZBQPjfal1aQa5/L6Yyfp6hhgydp5JKojjA6XWbZuA0vXLKbzUj+1dU0MD/eyfNVCHnzXvRQLeb7/Hz/h3Kks1bX1RGIpaupbaGxuxfNsxkaGGB/t5/XHX2Ddtet48OMfI5/JceDVnVwpdrBi/TXs2/UaruOQy2eprW3AdmxOX9xP4OUBRc/QGUp2BiltHHsY3yuFhIRpdXIhwAh9QaUYLQSiUngREyhapeQbUi9CFoRCR9NNhgdHuPGG9dx192089qvHUUIQKIEXQCKZQE9Uc9Ot9xCNVVMq5xgdGWV4YICLp4/T39/FvIVLGM/mEaLMRz/5HtJ1VTQvXMMTT+7g4IHdZDMZHnxgGzNmz+BcqUw6HuPypUEudpVI1lWRrNYwrTjVLUnGBsfp7Oxi9oolFIc9bGLc++77+Ic//xcG+rrp7+3iY596Nzfe8hYMJC+/uIOXX96HUAHjY2ewIiY1dY0YRpRoNEHbrAXYdolkMslA3ygjXSNcPHuBzktXaG5ZQqqujvYZczi87wA1NU1ErDSJeJSR0RBnammdQaEwhCTCnLnLcc4WGc+WEZqBphloE39kJSTSKr5AVewTmh6yFCqMhbBWG/oJ07BwHJuyPc5DH3gQiQ6aSVDBlbwANNMg8H1kIOnuusJATxfSLnL+xEEsLcN/fuf/ENHGWDg7wfe//7dYVVUMjINmRPjqP36ZDZvXQlDiPe9/gHGlUCLkKB0+PELR05m9uJFjL73MCw//koUbZxP4kgtnulGaS7zKZDBT5LrbbqKptYZYPMqXv/a3bLnuOoZGxhgYGedDf/JR7nngNtJpnS//3Z+xZGk7/V2XEIFLYXyEfHYU3w+IJZOkq9PE4zGqq6pJxBNU1aTxXMmqLdeSqKomOzqMQDI8PBg62cDl7NkjBBUYe//+5ygWRjFNvWJh9EppchILmsKDhFJIJK5TJmJFEbqocKFCpFTTdHTDoKvrEtu2bWTDls08/MunwDJQUmIqCAKJYVlhGVwGWJaOoSwG+3pwykP88tf/zaqVC1h/3XXMaK1BAS+8tJ8Ll3qRvmD+vLl0dXSxdcta1m5czVnHIxG1GOjNcv5KgVgqTlOjzm+eeZ6e7j6uufvtJBtjjA2XGRsYonXeDDLjNtGGBu649yZ+9ZMnaG9r5+ihE4wMD5BOp1m+Ygkf/9NP0j+QIZWKsGz1cv7sU3/G8EAfTc1tOHaRXDZLf98gJ48eY/BSL729feRyOTqvnGOov5vOcxdYsmQ++3fvobquDjNiEvgSoUmiEQsvCMszWtRDBjIkTFSICyGBQmFok4yFcBsCFWASpa15DmO5YZSu0M0YmmaiGQa60FEB+L5PqVwiO17AsIwQjAoCTE0QANFoNNwAFRq4QAUIXeGrgO6eYVLNM0mla3j2xd18999+gu/pxBJpEIrHf/sUJ4+d5Gc/+XscIZCBJCbg7KlBio5g6eJaBi+f5OLx05RKZTpPH2Pu6tmcfuMKl890M2txG2YsSveYx90P3s8jP/kd3/jHfySVrsaKGHiOy8M//SW33HkLV229mqH+EexCjnLJJhKNksvl8IIiN9x6NfFEBK84SuuMNDU1GxjPFHAKDksWzGXfzuco5EawzAQykOHaCIGcYH5oRph8SQ81WTueSryUqlTPQkZZmGQFfkA62cQDd3yWpvq5JBJJmppmUt/QSmNTO7F4HIRg7uwF7H7jCJ//1OepScYwtPCNiXAXScRiYJgh8icESilmtM/ELkmeePxpGuojvLr9Vf7yC99g0YL1rFm7kVQqRXNzC54LSxfP4rqbrqHX84lFLMZzBS51FEgkIsyfn+bVx59CBoJkNMbup55i9vwG4lVxhvpKDA+MkkyZjORs6hcvZNtN1zI42M+MGTOoq61n2bIVbN54Db/79e959cUXaWxs4OjhYwz0jTCjfT7j2Sxv/8D93PbO+7np3vu48ZabmTVvPo0trRiRKKlkimgkwVtuuo3q6lqqq+qIxtIodIRmoJsRdN1ArzADEWaF5xSy+hSKIAiTNKPifcNvAoahM57v4Td/+HeyhX4wwXMUumGhmyaGZoDSicRSrFy9hTdeP0pfzxiRaAK7XMZAYPuSSCwSmiuhMC2Tge5Bzh7vpFTIcMc9d9DbO8a3/+U/2bbtdkZGB9n1+g4MzUAJRTaT4Stf/ThBIkEmX6Y+FYaeYzlonZ3AdwbZ/9IemlpmIpCc3n+AwlAnMxc103F6mEune9g4ox5PCHqykjsfup/nHt/Oa69sxw8kMvBZunwpt9x0Gy8+t52VK1ayYcNGnn7yeS5dOU8gXWqqaziy7xTz5y7Atgu88MSLxGMRhvt7ccolsmN5mmfMIV5VReAYCN1C0z1QCsfJIWRYxg2EP8kRQmOSJiNVaB20yQSsEvVowkIS0NV/FMfPk07VUl1dR7qqhpqqOuLROAqFH0CqqpllK7YyPJrH9TwK5RJKQNGR6JEo4OP5DkLX6eo8x5YtS/nW977OslWree6pl7CMKhy7yCvbn6Whtp45c+dTlaqitbWGtzxwO5dsH08zyBUdTp0ZR+qwcFEde59/kXLOpbq2mXi6Hg2D3c89w8JVrVhxwXBvgdxoHisapXOozLwNG1ixdhGu69Da0k5DYyPHjx1lcKCPOTPmsHfPXqpSVbz3ve9l67WbMHSdPa/vZXCgk/NnD3PmzFHqmmrwAxfPc/FdiWnFGey7Qn5sGN2IhCdf10G3aJ63iljdDIIJTtSUi0VTYgoPqvDwKsTesF6phEA3kmzceAuJRC1jYwNkRnoYHehgeLCbXH4cIUKuZCAF6aoG0qlqAj+gUCjiKsiXPLRIFCld7FKl/IfiQ5/4ADfccit2KaDzUgc1tTVcuXyOuGURiycoO0V6ujt56y3XkW5vZjjvoJk6Fy6MMjjkU1MXx7LKvPib52lpm42mR0AqZs5cwIGX96DJHG1zanAcRcf5ASyhKPs+Wd/ivvc8QGk8i+f5RCNpqqrq6OrsorqqitHhUQr5Mo217Vx39U1ErSi6abF6yyYa585k3prlzFi9nPkb1jFv9VrmLl7L4rVXs2LzeiJRC12zMIwoUkKsupG73vtZlm64HtdxQx4VqoI2T3BjRRh5ahraZP6FQAt552iahu06CE1HFwZeEEAyiaeYRj/R0TUdz/XwHBsE5PIlAOxyQCSZwjItnLId/mKpUygG5MbLeLaDZUZCQhgTTDgo5PIYRsCdD95FbzlAYeA7LmdOZ7ADjXnLWji1dz/DfVkUcO70Ea5cOU+xmMcZL3Bkx8ssWTeLAEF/R4ZSsUwkEuFKb45NN7+V9vntZMdGMI0omm4iEfgBaMLCLUvwNGTZB+Uxo7WertESZy8VefWpHQxd7ubskVP0XbzCaCZPUSYpotPQ2jhJqdR1HTuX4ZUnf8X543ux9JDeo+sCzZh2GwjrwZZpoCklJqEggUIogQxczp07QuB7eK6kfc0qPvuL/2bOxk3YJRtN00MSmCbwvBKuW9mA8Ty6At/2iSeSpKtS2HYJTdcxjCjf+ufv8d/f/zH58Rxz5s5iLDPMrBlzsV0X2y4yMjzCtds2MX/dMvqzDsLQ6e8ZZ2zMZ8asWhpiPo//+FGc7BjIPN/43hf55o/+joYZ1QSByzO/+B3loQHa2uvxXZOBjhFMNHJ5F5Wo5e533sVYNovr25SKJebNnc9oZpTamjpcV7F37+s8+uhPGRvPcMNNW7nzgx9k653voqm5iS///V9x3VveyrIly5izZDmbbn+Qm97zLhatWIhtOyFNX4DmefSfP0ppuBdTN5G+opSzcW1/8qAJIdC1kGWohSTYSkleiUkCrmWZaELHMi1c26P7wiXKhSK6UalrAqauUSpkSSUtGupqGBsexhSgBQHReJRkdRq7XAYUrW1tjAzl+PXPH2HX67tZumQZ8bhBsVjixptupZAr4Nrj3P++++lzFIFmUJc2GO8t4Y+Nsv+ZX/GJOx4g09XFX/z9J9lz+A+sWL+WMSfN3373R3zu7/6alGXyV+9+iB2/+hHlwU5KgxmqYxbJSILL3QVuve9OampiDPR3sXbtWiKRCCOjoyyav5LL58/y8qtPM5QZRddMikWbbG6c5x/7CfmRHp783SOcPXmKc+ev0HXpBOeO7sdxXOxyqbL4Yf9DIAR1DTOIxqpxA5+kSPLRrZ9gY8tGHN9FaGa4xoS+wJhiDoeXQxJgoAOKQHkY0QhjF7r5w9e+A55PKlmFYVkIJcmNDXD+7DE2bVpCTW2awf4BhAwI3ADNTJGurmZ8ZJzA8xCaRltbG+OZQQ7uP8iKlau47/57+NEPf87cuQtJplJU181k1Vuu5VJJR+THeeGpnfzqP3/N8OVu5s+p5W++8AHe+5F3ky86/Nt//IpXth+ht7Ofles28da77+Rv/v0nnDjwMtufeJztv/h3YrWN9F+8k/XX3EghlqJh9UKuvWkzLz25i3Qqya7du7j9tgfwizEunbmEF/i0tM1hZHAAzdBQhTLFwXP85MffYmA0h26eREmd9tYG9p04S8S8PyTvqgBD19B1I6QzegqpAgKlqInXcfv625DCY2/v6xiajtBCqr/0AwwxWQiogG8Vn6BPNE0oMEyTVeu2cOHkUexClpGufjKjA8TjOjPa07z7fe/gD797luOnTlK2HVw3wJcG1XU1dF++hAx8FBrDQ/0YUYOrr93GxY4eohGTD370/Tz31AucO3eSv/3Ol+nuHeZfv/TPnNyzm6gQ3Hz7W3nfd7/EtqvW0pUZ5xvf/Ck7XjtOQIx0ogG3eJ7XnnmcM4f2sXzj1Vx301v48r/eRl/PeXY+/zw7fvMrnvvpj2metYTCx97Dgx/4AE88/BRnTp7gbfe9H+HU0Hl6kHkzVnLm8nFGR/tDTpCU+IEkna4iUl/N0796gj3PvEFL22xsP+RX5R0PJRQ9fRfBhESsBt2IgAaaphONJBm0h/g/j/wVWXsYK5YgQFUQZ4Hv+mFRftpjIW6tKWxZwtQSRDBCqkoQoGsafV0XaWxO8pnPfoaFi5dQW99CPJHg6SdfYnwkw/h4Adv1KJYVNU0NlEtH0TSBaZq4uomSGrnxHI2tbfT3DdLUUEttXQ3NLTXc9Pa7+M//z2Ocfmk73/r+P3LLXbeiRyxOHDjGp770TQ4e7aambhYaFq11krmLqtlyzTs4f+QUu3Yc4fjuXZzct4/WWTPYdN213HDPB7nx/vfRceoEP/v2t3jsR4/wy8e+z4ar15Hpc9A8i6G+QarjNQTKwfcCYtEkwjRIp1NEEgkMYWAKnbYZs1m4cJDseBnD1NCFQboqhRIam7duJpas5fjhE7S3zw/Jy4aBYej4CNxqE3vUR3cVSpuqBfiBj6HkZNMUSiikBroraUvPJOcXQvaaDPDckPVbKOZ42413cu/b38nJUxfp7h0lHnepbWigMJ4lmxlDEic77tHU3orrlsKN1Q1SqRrsUpGf//ePufHmt7Bnz16iVoT+gX7e9sG7IBlhqD/L0tUreNc77uYr3/gB25/bS6AlaJ6xhPXX3MmhXc9wxy0reOfHP0BnpkQ+43Db297L9a+9wr997XtEzHqGOq7w6OkTWPEkMxav4f6HPsKsZauxx336eiXvfug9fPajX+CZ537GeK7EisUbOX/5RGi/61oYGurltZd340QuMdDVwcM/+TWdl0co5fJ0nDtLdqiH0UGbV375Cy4cPc2G9XfTNnM5xw6fQNO1SZa6EBpS6tRUNZHLjWKLHDqywoqAQAahEw5bdcI2PM9xaKuezXc+9B/cs+ZebLsS9QQBigChKRzXp6NriGLRQdMFuqFR39AETsDo8DCWaZAfd2hqn4mSPk65jK7p2OUydY0tpKpqeeKJp0AIsuMZpHS54e330DGoCDxJoKCvUGL7M3toX3Q1q7fezKz58zm09xVWrmzi3Z/5IP/8jR/z0ds+wOff/nG++sVvUT9rM+/66LsYGLxIOp2mvqEJUwRcOPoGTj6HV7KJWCbnT4+zatUWFi6eyeWus8RTFodP7UIaita2eQRe2Buwb9dhRGGQq69dx4VT58iODuMFNrW1aXw7oKk2xeDps3ScvoIW+OA7aCKkmigZoJCTAY3t2Igg7IRDTND8Q9KWpuRUQV4BhmEyXs7y8pEXOd97AcO0KvmAFjLdCJ1HECg8N6BQKDOWGcUyLTAjDPX2k4pHKeXKNDS1YVoGxdwohq4RBC6u65JMV7Nw4XIaG9spFW2uessWUjMX0tPtgQ9+4OMKnar6BnTDoJDPUcrnyA1187aH3sGvf7ODJ3/8B+a0LiSqWRx48Rl+9aNHmbPgGhqaa8kX8mGTh64Ti8fxvbCJRAD5kYBcJsrb3nYfdskjnW5k9tzF1Ne143mSQEkkPvFEDCVdLN2kKlGH7wRkx8YZHRkll8szMjJGvuhjxBMEgUTTAPSw900pECHDHKEhfYlUQaVbrIKGBqCUNgXGTTR26JrJmJfhB7t+zOHBE0SiscpVCnlAgpApfOliJ8ePneLc6XOcOXmGfK6AmUjRe6WLVMKinC+TqKojVZVkPDOMbugESqKQBH6Ij5QKRRzX4Y73vI2+QRenJJCuj+PYFAOF53q4pZBvWi7a1NQlaZozm+MHzjBv0QoaWtoxLIvaqhoGLp8BVU1d40xcz0EIhQoCVKDwyi522UbXLBJ6kq7T49x5+x00NtcyODQcNp0IjagZIRqNEDgOm665ipFMhmP7D3LiwCF0XzJ/znwMpZMwFJYmWLPuOppmzEY3dNKpagzdIBoxsSwz7M6c6CT1g8mumYmkTSHQNDME4yaaMyd6AaSvs2TVJsZGBslnBzEM8Dw37ACUHnbZoVAo4zkeWtTCV5JYPEFNVQ2dlzowDIFT9DDMOuqbmxgbHKGpfV5lk1WFg6QY7O9h2drFLF67nr2HCiQS9Ri6ju062H4YGXh2GeknwbfJZkbY8dzrXDh+hkzPIHZ2hN6uy/h2kSCQnDq4m/GRDNL3UAT40kPXY2hSEjguiWiKdDTCUJciLhq575638l8/eoqW5hYyI0OMjA1h6pDP9LP39d3UNzbQWF9NqVgmMzzEQN8Aw8PDaErhSYPTJ/YzOjjIq688y8kTxxkduohTHiWZqqOurils40LhB25Y7KpAbqHZDxCIihOegCPkRLe7xHMDKmuAUjKkKfpeyHl0bVwnBKZMK0wqNNOirq6OjksdOK6D70o8R6d97lw6z7+GphuhL5ESXRg4TpFMZpBPvOvjZAsRgkIZMwGGEcVxFI4bIrCuU8YtFjhz8BXmz6vj6EvPsXlpA9aqFlylWL9lJkHg43k+Hd0v0T63lmx2NKTMAFbEImLoBK5LPBLHEGCqGGcP57j/znv45c+f5NKFY0SqLK65fS2+74O/jGI+T26kH1PTQpaz9FGBy9xFzSANdF1w6tjL1FRVY5gaA0MXaGqrJZZM4pRHObL/MEtXbCEIfByvHNZDKhvCJCABhpz0ARPd6QoNHT9wEMoPd8uXBI4dckENi3K+wJyZs1AKSuUChWwehENdfTX7D+5nPDOCaerkMw6zFy1lxxMvoqTCtGJ4ThHNEAwO9tI4o4nV19zA+dPjmBi44y5jIy6uo+OUbBIJi3JBMtzfzbKlM/iPX/0LZSACOEAAnO+HseEA5Xk44zbVEcFrT/ya3/3qMarTdcRjaaIB4PkMDeQojjvEhEnnyREWL5zPtq3refrZJ/niV7/L/BUryfYMkYxbRDSBIQS6pjAMQcSysIywP45AgnQwYxEe/c3TLFi4GiuWwPEVejTOosUt/Pvf/y1vPLuLecvXEfhupYFPoEQQUh1UKPEQsqNVpcNPVBqalSLwPAJ/gkon8X0fqQSpdDX7du3CcV0WLltOe9tM6mbNYjQ7Rjqdxh0fZ7Crk1RqPqP9OWbNWYJm6pTy45hWFLccMilGBod492c/jOfVMtY/SFUygWX6LFmxkBMHA0aH8lRV15IbHUOgSLfUcUUpektlTN0kYQg6j1zg1MEBGtrWks352ANl6k1FIlqNpun4vkdVIoUquThlm/ZZbZgxDzfjo5Uteo6Xedfdb+Pp554nnynx+E8f4+LxU0QTMTQNDF3DNCaAR4EWtrnQ2tJMU8sMqqqTvPXGa3n0N0+wePkG/EBilx0unj7Jgx/5BBfOXGK0v5f22dUVPQs56W+FDJNeQ8iKVICYaNAIn+B7TsVzKzQNpJIEgaShdS6xeDVnTl3m4L4joDwWLF7I+z76Sbpr6kEzuHTmFFfdsIZTVzpZvGYGNXV1ZIZ6qW1qRylFfjxDLJXkhjvvovNchqiMgetQGh+gtTVN4Hl0d4zQ0NrG2ZM9xGJJXNfHRVBWGlbUoOvIGf7qnveTH3d46HNfY+bibQyUcugxA+lIdAyk59FQ3Uh2cJRiKceC+Y34fj/Ki5KOGPSdz7L2xmUsWrqIJ375c5qbZrJgyWIc24EglCiQ0kcpiZQS6fuoQHL0wGGWr5J4Xisdls9V65fxw//6KXW19TiuTW7Upru3j/U33MgzP36U9lmLkEqG9lxOddGjFJpiqjhQqRQjUDhuERV4k8IZKghtVSRSTfvcVazadAtbr7+fFWuv5ezZ82SGh2hrb6eqtoELp88QTxiU8zaBijJ7wTwG+jrCFk7lMdTXxda3XEtV/Wxy/SVS0QjjfcP87j9f5IXf7gPH4PyJU7S2z8Ypj+HbNo4nyduKfN6nbAsGBnN4tiJmRRgZGMLN+jhDDn7OQzkK5TsEvkdTuo2eS5fQhGLX84d55L+fYKi3h1TEwvRMhi+VieoJPvE3n6dxfgsH9+wkoptYZoQAOQkRhHIKoQ2vranjzOnjBL7L628colTyGO3vo+dyF12XOsiPjZEfLiA9gWYQds6oKWZ0CPkogiBAkxU4OqzaVEpnQsN37RDDqfSOoRRCaPjKp2y7uI5HIKI0tiwmGqump7uT+oY6mpqbuXLmAr6XwzAsxgZclq/ZSHE8g/I9As/Fc2xuvO9uus8XEY6FJgN6Ll4hHUlSFaslEani0M43iFa1YEV1StlRHD9gPCcpjsNQj8ucpetYf+N1VNc3sWLl1Yx0Z1FFHz9vE9g+rl0iHo/SWtXO+UsniFppaqtaqamppX+0H4VDwjIZ7XHJDZUJUjHe9S//yE3vv48Tx/dSzI+TiMTCUFaFZUykRFbkCEBQyBVACQoFG9MwMUyT2fMWoZsRCAI0paH0UAZBTEcbRIg8q0CiTYpWTCobVCr2cqJtX1TUWmToIyrPnXhc02LU1rVy5uxpYpEIzS0tDA/00Xulg4bGagY6hpm/eAPxdJriWIZcZpz561bQNnstHSezCCIM9gwy2DsYRlPRCMvWb6bj3EnGhsdYtGQto2O9oDRK45LiSEA+45Ibg5IdkB3PUhj2CHIefqGIN+5iKo2CnWXZnBWYDpzrPcaGJZtpjlUjhGKkPEb/cD8RdHQZ8p0MoHu0zOb3fZJP/utXGCgM0XmlAytqhYIcMpSwUYQQQuCHLax+4IU5TbHM/OWLeOgTf8JnvvS3aAY4pRKGZk7yQUUFhp6Q/kGJMBMOT364BbKiCSRliP2oyqOe54YdfxON2xVMI1Aaja2z6bjcjW07tLS3IZAc37+HxuY0+ZE8qWQbC1etpq/7EpnsKLfc/zZGegOCPGi+pOPcBdySi5mKcP2dm5k1rxG8EvtffZkVG7cRjUcZ6RokUrZRjkFhVFIYtWlsncWcWSspDuWRhRKykGdGQ4L+/g4iusW1K6/n1Pl95O1h6mrj3LZlFY2WhRvYXBy8jBQ+UU1DaFDIF0gnY3QM5rDmr+FL//FNqtqrGOztJWIYlQ2QBEEQwjJSEgR++Cl9lFA0t85hsD9Cb2cNM9oWkstlMcxIRSEmDG4mQM8JJRVtmsjTlHMQYcu9LiSGLtANgaYpDFPHNHUs08Q0dQxTJ1A+TQ3tFPNlTp08zczZs2lsaubw3j0kExqWbpLptVmzcRv57Ahts9tZve5G+s9kSccTlPNZRoYG8SQsXb+U44e389N/+3uSEYtjb2zHdwLecuvdnD91ll9945tUeaPURSOMjtlsvuX9bLr6gxRGFZYXsHHVHLp79/LkC7/hvpvuokqrZtfJF4klozz89I95/cjzXLVsGZrnMlAaZaSQIWrpxKNJHv7uj8leukBDYw0nXtrNo9/7GXc8eB/FUi4MSiobIIPwq1IQBD4yUCgZahGNDJS4cHwIr6TIjxfQ9AgSSTKVpKW1jUQiUZGJkJOiU4aSalJeS1Ra63UgPz5Kueyg6yaGGWHMHEPTzTB9NuLohommWVTX1JLL9OO5Jaqrq9B1k3nzFrN3zx6GBkIzdP54D0u3bkaPxtl47TZK+Rj2aJFEo0V/Vy/SD0jWpGibVcUfHnmSRE0a3YqSyw7x4h8e4Z3v/xjnTh/m5Gv76Dx7jq0338HKq9+KW9IJXJO5rQl02c+Lux7hlX0vsGrZQu7e/A5++/Tv6C/0UJWuRjXqPLvvBW5cfwt1yTQZz+biSCcLZ65B1y2u3baVJ7/3n7ztL/+SxtntaPZyim4YCXmeRxDIqb7finKW74ebIdDQhKK/4yy1K+ZRLBQZHOilrqUa09Cprq/Dsix0Q3E5lw2zYRmWfw0lQVQcsVQKIXRKpTy1Lc3ccf1NmJEIumEglI5CQ2IglIEUGslYnN2vPMfZozv4wCc+RUNDAydOnKK9vR2lXF5/6Xmuv+FDnD7ciVNq47q73sOSlTfQfXIEQ7NwSgUGBwbQlMaiVfMZGDxP54WLNNRUI5QiEtE4vud52mbO4/b7Psij4/9OOefx8qO/Ye/zT7N561vQbYMdJw7S03eKsdw4ixbM5DPv+DyHDp1k+9GnMEyDQAXEzAjnBy5wpvs4axbMZ8fJ0/QUM+T9MkEQ0L5wARfPXOb1R3/Lje//OPWzFjB0+GV810UGsgLDBJPSZUKBX8mVpNRIxFMMD3ezc8fPccsB667ahgbohkFbayu2Y3Ph3PBUl0zF92oTOmiTcJCmUbJt1m7cwIzZMxkcGGQ8kyU7FmL945ks4+PjOGWbno7zHDvwBne/4+3MW7CYQ4eOgFToZoT29nZ2vfocUitQVZ3k0uEu7nrnJ4nHZlAcsolFDUYGeymXXIQVYd6ydl5//gks3SBQiuHRIZra2rl621U8/fB3OX/qMve/85Mkq1LEEzFEIHj29z/nD7//Dhc7j1CwyyyaN48vvO9LdF/M86Pn/oP2WbNYOG8JuUwG6QVYsQhPvf4US+a1kY5YONLnxFAHQpPksgUSqWqczBhe3iMzYIctRoTlRSllpTYiJ0217/lIFYAGuhmnpq6VRDJOS0sbESuB43qk01U0NNZy9MghRoaHEZogCILJPjFjStsmTMg0ZIhZSMGxA/vZ8fJrzJgzBw0TTYuGJsi0SCSrOXn4DayoxeYt17Jn7z4MoREEPr4wmTd/Ea8+/wRnj+1mxvwtnDpwjkxnAbcYYOoWgW8zODBI4AfMWDyDXL6PE3vfIBbRkfh85POfo3XeciJWhFw2z+9+9i/ccvdHuf2ej7Fr5+NcOLuP+voGchkDzy5w9Zot3Hf9ezh69Dy/eeHHpJtSXH/dbRhSY938Vbx6YAdKExy9cpJsYYglM9o50tnFxf5+xgpFpBTYxSJViSiBo8JcwquobFWSsYoAY9jtKEOZMhQYIRaNrmsgYpTtIp508KWiqamWdDpOZmQQQ4Sh53T1Rk3KCX200BdIBKJCpBJCY+GKedz74VuYtWgB8xYvZc7ihcyaP5/2uQtYv2UbY5lRDh/YS3NjI7btgBK4jk1NXSPp2iZ2bv8D9Y1REokYXSc7yQ0VMAzBWHaUcqmEAuYumcHenc/ilEPlLtOKsmzj1fh6FKFZbLr2eixT8cLjP+DFpx9l7brbueXOj5NIN9PY0MRH3vlJbr3qIZ558RV+9sx3yfqjbNq0lZp0DUIZLJm5gtp4DZoQOPhs3/8SaxfNR5MKJwiwfR8hFYEXIH2FLAcEpQDlhLCxkgp8iQgqIbuSCCHwgwkpm5BBPpoZYiw7wujYEOVSHg3F0OAg8+bOpX1GK4XCeJhCBKpC2GKCFzQJh1Y2omLfAo/ieImzR64QOBLPLuHbNr7rUMhmaWxqY968Jbz03ONUp1MIQyeQFVUR3WDZ8tVcOXeK7s4TzFnQQjFXpFQoEkiPkeFhfAmpuhqiSZeDr28nmUqj6xFcx8Mr2dRXV+F6PlV1jdTW1bF8xWKO73+SR3/+NQrjNrfc+gne9/a/wC2k+eGvvsPTe35K44w6aqpraGxuw3cCGlLVFTEOF00YpBIpnj/4Krrm0l5fh+v7CAGeL/H8AOUrKAVQDIlaQmmTAn8TyidShpi+9IOQdg6oIEA3LWqa2mhqm4PnBuhAX18/b7xxgA9/5GMkU3FspzSZbwkhKk16EzGQVEgRKph4nocARvpGObXnXFh61Aw0zUToJhomZiRJY9siLp05wYH9u1i6ch3nz1wgGU/iBYq2GbOpqT/N808/zCc//U90XASnXGTEdSnkc7iuy/Lly7h45gCZgQGaWtoBKBfGefg//4OqmjrWX3M9Te2tzFq0gP7OQa596z3s3/0KTzzyLeYtXIcOdF8+ji3HWbZqNbbt0NxWT22iiUL/MLsu7aNUKjCSz2IYJoau0z/Wx86Tb7B+wSYuvN6NlAG+F+C5MpSgLAdQCFCemnSYE6GnlIqIZYZUft+vnNmwrwJ09GgKIWyUkgSeTzKeZO/eAyxbvpgPf/zjfOvr36iYn1C+U6MCNKlJxVc1KVDquj7V9TXMXjiP1plzaWmfTVPbDJpa22hqa6OmvpEZ81ewavON7Nj+HJqQNDbW4XkuthMKOS1btZoLJw5w6vQ+2ua0kh0bJ5vJhM0cEYvWOdXs3fEssXgi1H3QBIlkkounTrDjid+y75Vn8co+N99xH0p4DI2OcOOtDzB/6WK6e45wpWs/tU3VbN16CwiLfGGcm266ndJQno7LZ3jujWc5dPEwUg/QQ8lcEskEz+x5mYaqFGkrghe4BNLHl34otFpSyEIATqhhOrE+UgahSKFuYJkmruuGKHGgkL5EaAaJdJpSaRzPdULqo+dh6AZHjh7nmmu3sWLVqrBGLMIDr4UKfyFXUU1274U77vs+sSqLxRtbKNo5bNvFdlwcJ8BxQxOlJ+Ks33Yr1Q2zefapp1iwaAHxdJrFCxcyb948tl5zLTPnzuH3j/6QuuY40VQsVJuVGrMXzCI73MGlM6fC5r0KNUzTLapqGmicNZcjhw5SGBulbCs++qnPEIsGHNr/GvFEmqXL1rFkyVpq6pq4fPk8vnT56Mc/TWnEQbo2+07sJpmOk0qmMYURZvxKkYgmOTdwjlOdJ1k7fz6O51VUbiW60qAYIAsBojwhZVwJGTV90nREo1Fcx8ENXHzXJ5AB0UQVumEy1H0JXRPoesj+9/yARCKOrgs2bb0aoWkEno8MKj6Aic5tGUZEAoXnhmhiMZPn1P7zCD9ASBehfDQVqkFpQiKkB1hcf9O9XL5whYP797Nw3mwunj/Nz378Qx5/7DE2XrWJQqafXbseZ901y/EJC+ZzFsxk32uv4NoFIhFzsm1nApgtlxwWLl2NpkcY7B+nszvPve/4EHfeezfJhIbv5gk8m3hC48abruO9D36Ysa4S2UyWWCTOgtmLcG0HGXhI6VcwHbD0GOiC5/e/wLK5s7Equne6FAhfR+Z91LiHcCbUwkKilSY0PNcNuxsNE891UZ4k8AK8wMWK6GSGeijns8SjMUzDBAyiUZOFC2ZTLBZoaGgkXVVN2fHwA1VRS1HTdJErEr6+5yElZAZHCYKzYRiq62i6ha5HMcwIphFjdGgUw4hTVZNm3pK1PP/0c7z60isoLGbNns/w8CD7DxynZeYsXnj6t6xcvYW5S+dw5tBZLp69zMq117Bnx+OUnTJ1je1kRzNULiWe61DXUIfnmZSLLlEtSXfXOPGq2Wx761wMLQj59oGBW3DpvTCEpRRRLUZMRZk/cyG7Tu4K5YXR8DxFfU09BbuIKS1u3Xorhy+eRRlhdcr3JTKAoBQgSx6YIfY1qaDo+wR+GHrquo4MTUhl3RSBU2RoeBCjItwRqgzDpo1raKirpbuzuwLpx/A9H6VEpSCjJgUtJ6+b53l4XkCiKkn7jLm4noNeYTnrWhShmxhGDISBYURAt1i9ftuk2F1Ty1ya2+fRefE0I72d9PWfI2Iofv6jb/Gxz32T7q40l05fZHXDaj7wqb/ih9/8a+LJBtrnLqK3qxsFVNXW8NoLz+AWfdas28qunU9RKI2zbMVG0tUteGUHTUpims5Ypo/TZw6D63PLVXdwoe8Uf3j1UeKJBFIqpCdpqGnD9ov09Xbxxfs/j2nU8cq5l4hEIkjHw/M8CBTK8VGOVymch4vruW7FCQcVBzrhGwRShVHf2HAfTnEcoYVRZKkYMG/eLDZtXs/ly1fIjGWIRuPIwK8QdEFTk0XhilxwxQQFQUAgJbFEAt2wQNMrIqiSQHoo6eP7LnrEAstAMzV802Duqs3MmLcCiUmhUEQJk+VrN9PaNpdUKsVA71mee/yHbNq2ikjc4vieY9TWr+TtH/ozeq9coTCeZ8GS1XgKNCGorarlwK6X+fVPvs3pk/vp7bzI44/+GIVLNJ4mqsXQfcmzz/6Wy91nudJ3kV8+/UMee/XXaDGdWDQC0qS9cR6+crnceY53X/9eZrWu4rHXt4OpId2QSItUaEojcH2U64XOVUkCb6LLcZraSUWpXQZhXqAJnVIxF8p2IpCBjx8EGDpcunSZU6fPh/WRTIZ8oYBlWZWK2DQTFMa5YVYsAxmGWEFA4NlI18F3bDynhGsXsUs5XDsf8iQNjVgqSrI6QSRqhuk5PpoWELglyo7PwiVraGqdRWNTK3t3PMO5E9u59vYtWKbFsX2nWLD0Bm5/4MNcPH2UwcFOli1fj49JIHTqG5qRaNQ1ttDYMoNoLMa5U0cwAhvD9+jv60QzNGqrwoY5X1ck01VErCjK15nTtgRXeVzuOM8DW9/GVWtu4bG9O3AJWN68gLpUNY4XNhiqIIz+fDcsP0o/LMVO+Kcw7q/kBRVcKJRv1tF1vcKG00PzYuj09PRx6MAxIpEosWiMPbt24Tk2uhHKfBpyGhYtmFL/DgIfJQX5bBYdPSw8aGEbpqYqssSaycjwAKYZx4zE0fUoZiQGUpKqqgn15qTH6OgQKJ9AJGhsXcTM+cv5/W9+yp98cTbrb1jOkTeOc3TXcVZvvA03UGx/7PtIp8z6Lddz+uRhCmMjpJJpfAmuHRCPRziy71XOHtmHIcENHMyoge+HCuZWNI7vuESNBPPmLGFwuJOzHae555p3cNPmB3jyjZcpqhJrZi1mXkMDIyN9CKVwXYcgCCpJqA++rNQAQgfONHsvJ8C0iiy+EBpKQlDZpAktaU1oNLe0kE4neOG5Zzh9/CiGFrYoIUINvKlpEJOInCLw/ZA+V9GTFnoYCShNw9AsdE1HExXhIiOKYVpomo5haQRBeKuKxRw19VFWrV5IXX2Csu2SGbOJW9Vohs6vf/oDPvzZLzF/zQLOHTjJod0HWbH+Fqqqa3nsF9/Cdl22vOVOOq90cvHkIZJRA6lrmJEYdXVxlPTw7CIR00TDQJMh+ckulmmtncOcGYs423GUix2nefDG93DN2tt4cs/L5IMca9oWsWXZCr79m38l442joQhcm0D6eH4IsomKVQhkMCnQLaWP7/sYhhFK9YsJnSWTaDSBVIJ0sgbLihFIn3S6irbWZn732CMcObCHqnSSou9O1hWMCRxIqBD3mOgVUIHC833iySSJVBLHtUNxbt3A0M1Q70C3sGJphBGZ7KK3rChKSrLZMbZt3sQd92ylpSUdZn0CPB+6OkaobUjy24d/x29//t/c+c4PMGvlfC4fO83JgwdZuWETH/v81/n5D77Oi79/hBvvfpCGGW0ceOV5VLFAIh4Pu/f1CIHng/QQBDiujaZirJy/lap0NXuPvUo2n+HT7/0i85pX8eSuVygERVa0zGPb2rX819M/odfLUlPThELH913QFIEPrgdWECKh4UQNH4TA9srUNtSHsj1aWEkMN0enqXkmMoBisQwCokYI4Xuew6XzZ4iaZghDyxDC8DwfTVU04yYgaVXxAWHpTeI7DqVikXK5RLlcxC4VKBXylIs5XKdMvKqaZF0N6YZqapobqG5qIFABmzYt5oMfuZVUOsHF8/0cPXSFo4c76OvO0NJSz+atq7jp9luJmQbPPfYwDW0p5q1ZjO/ZHNl3AE018pkv/ivp6joe/9G3yPV3c/P976Fx7hKy40U8z0egI5RG4CtKhTKNqblcs/p2/MDh6Vd/jVQBf/Hpf6KxfjFP7NpOiRJrZi/muvXr+dWrj3OlnOGqa99KKlWHJRTxqjgbN25kLDOGbogwwpkoxAOOY1PX0MyMWXMYyYxg6gaBLwn8UAU3M5ohn89j6IIgsFEEDA+PkB3LsnDhIlzPexMPVwYS/Zpb/vSrl88eYLj/HFbEDGcIBB5VNTUoBIXcOLqm4Tk2vufhez6B7+H7oZB1fiyDnRvHLZYoZ8exS0USEZ33feABhCE4eewC2dESriMpl13y4yVGRwukapLYDkSsFMO9XZw9cYw1m9dT1dDI2OAwwz1DuIHBDbfciQx8dj3/a0aG+7n6+juZs2QVfYPDlLJZ/HKehF7FVavuYFbrAg6c2MGxcy+zYvk1fOQ9f0lH9xC7Du9C1xQbF69l/sw2frvj91wp9NI+Zz7JVDW9XecZGOrl/vveTqGvkZ7LHYwUjpNOR7ncdRjL0isswBLrNm4mXyjS09UZTtBQirbWWZw6dZLrrr2J7t4errn2aoQeIV/I0d/fSXNLO5GIyYVzZ4hYBuWyw7xlW0hUNWCEXXsTw2tUqGlZEdlAiTAfcCtZpPJDjWRdR9dNhDCIJkx0wyAet1i6dB619XWkqtOka5J0XOzFLSqsqIUQCj9Q2E6AbRewomPUpKJ4gc/WG97C3ldf5Xc/+SG3P/heVmzayJHd+xi6cpnc8ChX3/QQS5av4dc//Vd+8d2vceO97+WBhz7OqYMH8TqHWTJjMZc6T/PMG48gLMW7H/wbFszewM7duxkc6SZmRbhq6VbiaY2Lzgk+9Be309bWRGYkx2tvnOKVUonN19+Ak2+l50KWVNxE8yOYlqqYnmhohpQiEomQSsfRNBGG40oLy5VKhgpYhs6Ol1+luW0BibhFxDSIRaMcOXgOy4pMTROpmHtDVVpTJ5IwSVgTUDK8fjU1dTS3tE/CqAqFJgysSJRoPI3QTdpnzeTB99zD/HmtIMB1FdlsjkKhhNDB9wM8zyYWj5JKV2GXbOx8gVg0SSJm4ngem6/bxoHdr/PID77NVdfdzqatWziy5xC57DC7X3yV5WtX8ud/9wOefuLnvPzoTzi07zXuvfeDBCLN75//GQOjZ1m57hbuvev9ZEdKPPfyM9hegepEmrdedTPZwiBadYnPfu5DCAX5fJmWtnaWrl7BjldeYf6qjZzb7YOSNDS1s6C2jRff+BmRaEWYXFdELIvTp05y7/0P0tvTR19PB77jIYOwSeW1154nnkiiaSaRaAw0ha6ZnDh6mN7uTkzLrDS5VOiOQg9FzCZk48RkMjY5DoggCCgVC5TdcmWGmEDXgzDWFTbVdXHe8c77qK6p4cDBs7iOQyKeoL6hjmg0Srnk4jg21dVJWttaKDs2qVSMUqEAymPtukXs3n2cy109zJq/kGx2hBef+AVDa7q54ea3c+nCZboudnLswFG6O2q4484Ps2Hj9fzuV//JT/79r0FJahtbef9H/4H2liXs33eI7t6LofTZzIVcs24L+469TiEyxFfe+yVOHO+lfzCHQFAuF4iaJhgG42WPVG0TRqAzVjrPc888gaJMIp4iX8zhujZCwJULFzl0cD+zZs9lsG8g7PmSAk0YVNfUYttlHMcmkAGWHmFgsA/HKWEYGkr6lclRYUCiazqGnEZPV9N6ZYIgpNK5tk25VMQP3ErYOTFHQBBIxXXXX0cylWbHK3uQgcQ0TKQao1CwqampIeeVEQLaZ7TS19fPSCZLc2MDc+bOCLXpPIkZifKLn/2Bk6c7SNU2snR5nNOndtPff4X73/ZRWlpaOHrwGKODg7z45AvMXbaEj332n9j3xrO4ZZstm2/n8qUunnzqDzjlAkkrwdVrr2ZWawOPPvsTTl46yD9+66v092U4sO80mmESqKByE8s4dkDEiCCrHE4efYGLl/aTTEXQtATZ8QwLFs1nxaqVSF9y/tw59u/dzeq1m6ipqWNooLeyqJLx7DBWxKC2LmxQt0wdlIdhiIps5USfhqqQ2oyJPuGKcZkYRFYZXoNSlMtlTMuqULYCDNOcbERLJZLMnT+Hro4OxkZzJGJRSsUy8Xgcz5OMjIziOB7JZISybTM2liNiREkmqjl98hLFcona+jpmzZ3Bths2cPrkOUDj4oWLLF25lisXz/Of3/0btt38AFuuu54LZzu4dOEUJ/cd4NKpBEtXbgCpePGF7eTHhtDQWThrEVev28qVjqP88w++jW9IFq9YTjRezemTp6ip1lmxaj5W1GQ8W+L4kfMQBJw/sJeeyx0IN0trWyO5bA7bLfORT3yYW+68ndx4kWK+yMbNWzmw/wAH9h8mnU5jRSNYphnG9IZGU1MrQSDCsVxUtIIm68BTOt1KhtL+BhVKippgvKkpbC6QPolEjEjExPN9EokUSgPLjBKxQnJW4CsK+TJC+RRLpXAikR8Qi8UwDIHrubiuTUNDE4EPxUKBscxJCsUyuq7T0z3I6NA4y1cuZdHiecTjUTou9fCLn/+GuYuWMNTXw/NP/oKTR/dy863v5aotN3Ly6EEymX4O7XoN1yvjuy6NNS1cs/FqklGdx5/5Lw6f3U3r7Fm0zVxILBEjMzZOVVWSjZtXksuNk80USSST3HXfW8jnM7z20k7w8ni+h+O4xNIJPvmRT7Nh0wYunLtEMVdmPJtFNwxmzJxLJpOnp7urMsYqbO2KxaKMjGQJAkVzWyMovcI6DCbRZqnUZFYNcqpTXlTUE4USFVq2RPkK17HDBjsVqqQLoaMCgW5GKOTy9PUNUlNdg+t6mJaJ7/s4jsPw8Aj19fXYZQ/bKXPu3CXS6TR2OR8OyVECz3aQStHb3Ue5aNPd1YnrOaxavYp77r2Dn/zoYWrrW4nHIlw+f4Iffu/P2HzVrWzYcD+jY4s4d+YgQupsWrua+bNnc+T4S7zw6m+RQrJg+SoS6Xp0M8Ky5cuIJ5K0tTdz9Mh5MqPjlMo25bJLc2sdW6++mvVr1/HySy+TGc5QXVXN+s0baWpp5diRs2RHRnnllRfp7e5l/sLFLFu+kmg0jibCsV9SKXRDQ9PB9VxKxTKOnScWDTX4pJQVfExVcosglIVzbfStN336qx3nDzLYezbUA5UgVUAilcYyI+RyOWQ4DALXcXErODZoKKGTz5dYtXoVpXKJYj5fSdcVhUKRIAiwrCiO7TE6kmFsbJzAlzi2Q6lQJJ8rUCqWcB0Hu1RCBhLXdjl14jQ1tQ3UNzRx8coFpDKorqrD1H1On9zFyRM7qa9vZMXSq1g0ez7j45386rFvsP/4Tupa2mifs4hooprm1ja2bNlIY1Mj0pfkckX8wKexqY76+hqE8BkeyvL6a3uIRWOsWrWKppZ26pua0XSTwd5hhgdHePH5Z+nruYKhwfDQCMlEiqrqarJjGUZHx5gzZx7HThzED0KWXDJZS2vLDE6d3EcQ2BW/6FdmzIDjuMxbvIVEuhFDTA0PCBMLEUrslsslqpprmBWbEzbvaeEkPZQIKYqGSTSWYDwzxvYXXmDVmjUgJaVSMWRVRCJ4nofj2ESjUQQC27GxC+G0Cc8PIV4/CPk1pqmjG6EenanHOXL4OE1NTWzasJGuzi5GR4ao1eeRqmpkqP8yzz31LVpaF2HpBp2dp0k3NLFk5UYSqVqqamqZN38ebe0tCCAznAFNoQkIlGSgf5iFC+cwa+ZMIpFBHLvEgQNH6e8boq62jng8TqCBLwVXOrpRgUbESlMs5vG9Mj09nUgBVzqusGDecgaHxqipbqa1fSa6ZhAon9NnDjKeHSSeSOAHfkUtV1WUKNUkHcuY8MoKNSmspGk6xfw4VwqFisifxmSZSgsdjKZrGHqERFUNI0M9XDx3htr6+gpmHkK3QRD23SqlKgUKG6dsIwOvohU7MbJwGkGYCeURwTHXwzBNIlYE13VxbBddM2lsWUi6upGRoS7GA5/Zi1aRTDUggXwhh1KSY0ezHDlcIdIGfvhVgK4baJrGyRlt3HP/ncyePZt0VZqWliYKhTKpdAqUYHhklN6eAcYyY8TjVaRTtaCFML1hWvR2ZZg/bx2xuMWB/W+QTiXo7rpEoThOuTyOJiCeSBBUYIyw4qJPG3UlgAADpU1OHEUoCCrjBPSw+oNUFcyl0mMpAQKCQOLjYNsFcmMRcmPDDPf3YJrW5K8Lh1x6uK6LbYedldJXk5s6MU9SE1Mjb5VQk9NVhWZMDaTTNHRNx5+cQZmkuWVR2KkgdMqlcsg6VorRYr4SUAT4fgCENBDdCIeLSiXp7+lieGiAO+65nQUL57Ng4WL8AHLZcUYGB+nv6eLg3r2cPX2UwHPQNZ2IFSWWSJFIVFOVrqWQH+Xs2cNowiMzEkLQumEQMSuqKYF6U2tuaIKmjQZGVBKxaYyIyVxATkuZJ9Q8RGWkc6XgEH5f4jtlso6NYWYxDGuSPTAxd3fidGtCoJlMkcAmBjVPE8vRJmYWK0D5Fbx9giIoJxUY3aAiq0xQeXnT4jtCWAAIdTkn3lvgV3pVBIbQOHv6FOfOnqaltYWm5mYSiRSlYoGh/j6GhwdChl9VVaUhw8XzHMZz/Yxmegh8BSIgFo2iaeFgnonFnphbOfF7hZjSiZverCGVxAhXWk1r1pbh6ZUaaJWGAtTk9IdwUSt/U1PTroUgBOk8f2pY89Tg4KnnTWsKDzUDw58rJ4ZGT9yAycmtlbxEhOpqkyMVRajpK5WabP+RarLFJKSNaxMsi0qvl5pUx0YIiFghu6234yJdl85Nxum6JjBMHV2A55XDBjsVKkrqegxlTfVPh1O4VaULUkzrAg4txXSIf0qeVUwIh070CU9wg6Z9s7LQ4WDLyjUKj2I41Liy6BOa0kpNTUCdGtMhK6c5JPyGOYaa7MihMp9Yx8CTTjiNz9RAGqHEY+ATKBXOLNZ0LDOK0lSFJa7CPqyIFe6hCsfxSuUiXYlu6gSeh0JhaWY4/0U30HQTIQWe8gh8iWnomKaBZRmT9Bw52R2pJqtg0wkLTDrRKRBTTTkxpqqMgjcpE6upqeMoha50DComYlo9bLIqhhJhXVhM7TgqtN1SqsoJVdMw7umyH3/8IoKKhajQPFDhxGsUju+ip9IIAW4uj2VYeL5LNFmFacUnj8R4ZhTNkyQSCbSIhRVLURgZxbJMfAJwfIRlEKtNkRsZIJGqQ2g6+bERqhpqKRbKeMUiphVBi8WJ1yYoZAbRJJOZ/yRdf+K+/9HiT5iTKQug3rQBE49Njy4n5gUIMTUxfKIlXpuYhy7eNMjkzWZn6oVMW2gx9WKnWjB503MmCtdSBlP0x4n5KZX/4wUBeiLG57/5Q/78Oz/BSCRwvTKFUom3f+xP+fKPHubPv/vffO1Hv+QffvwzVl5zNUNDfSxcvZKv/+LnzFy+lNz4CDqKfHmc9/z5X/EnX/0HMpkx3vapz/DQ//lLxkYGePdn/pzP/sv3IGIyOtrHphvfyt9897/QrRiua6NkUKn9Vm5BpSlPTmNCTB2yCR82/SZUJvn8Xz8mWsBk2GU08eMm0ND/8SHkm6s4Sk46bDHhF5T6o8+prvBJ36jCBE1OKMfKSjNIvsCG62+jtqmZeFU9V99+N8ViEV0q4rV1ZLMZvvuXn+M7f/NnDPT286f/9M/MWrSYfL6IE01wz0c+jREzGRnoZP0NN7H2hhspKxM0AytZhZWqAqHjYzFr9Qo+9KWv4DkOZc/FM6Nhh4vvTZYew0857YRPf3/TIAX55tsyxTKfPlJ4ul505YZVMDclFZquhaJwlWrwNDSUP/pB0wYVM2H3pv8CJl98aGrU5AuaTvwN/58/eYpk4KNHo9x079vY8Ydf84cffJvb7n8XyZp6fN9D1wV+PkPHiSOc2buL7/3VnzE8PMb6bW/FswuMjZSpbp7BtrvfDkaEW9/1Yfp7RjArJFwRyFAYVSlilkHvxX5WbL6WBz72fxgbGcFzPHy/TBBUOkCnHxQp38QYnLIEUxs0ZWr++OCKyQDiTZsyMTeSkBEhZcCkvpaoDPT8HxdAiEl79ibmxGSHfRDeksrn1HV9szbC5ONKm4xkSoUSS9dvoX72AoZ7BxgZGiRW08zqa6/HtUsIKZAB6KZOPBbBc0vYBR9haOHts/M8+5MfsuGGu/nwV77NSP8Ah195gXQ8XunnUpPDNGPRKF0nDvLTb/4ztz70MVbfcB/F8WKIe00zOeEhkm82GcjKwk/5tIlMdmKBJ9ZI/C9rOOE7pvrkxSTxQfufI0zevGv/vzZjwkdMP+VKqWkvUE2jujONeyRRwkdKF1dJrr7jAYrjNne840He84k/JZ8dZ8tb7wTNDHU5vZCl5wE33PdeWmc1c3LfLlQgiERj7HnhMXquXOTau2/m9//1bYLSGEGlk92XAV4gQWjYXkDUMnn5kX9nz4tPs3LTFspFO9RVmlw49b8suvofPuB/X59pi1yZD/A/10xMsurCKDGYEGyqSBRMTFGatlthtVL9P/gUjem9xqqSdb45CpiKGBAKHY1SscTStZu44aa38O2/+yr7Xn4WTWks3nQVf/n1f2P5VVsZH89w1VXX8Q8PP0EskSBd28QzD/+ck7te4No7HqQ2EUcXkpd//QPyQ51cObaXW9/+duLxGCCIRiwS8SgoLxwiYZloms5vvvO3NLbPZNacBRUdN/FHzvTNJvjNB1P8z2DlTRv35hM//e/hfJipRu1ABojPfe2semP7Tzi2/xFiiVRISJ2YJVNJJaam0fN/3Yjpt2X6hk6GcIAhFGXHo23efOYsWMLe13aCU0bXNXzNYMW6zQz3dmBEojS0zUAJAwJFX+clei6dxdA16pvbWbh8JYd2v4ZTzE+GebOXrqC+toE9rz7P8g2bMSIRjrz+Mmu3XI/t2Jw/dgAhBOmmNhYtW82RXTtAeWhC/9/f1v/tff+/+qjkSkg0TVAslLn57j+npnk+4qNf3KsuXTrEa09/nVS6miAIpmVsITqqJqYN/7+4CVNXUP3RZkz7HmGC5tgOvhuQSCbQDG1ymlyhVMIywp/hOU5oDoSGaUaIR5OhlJnvUnacsPCjG5OBgG2Hyl6xuEnZDusOkYSFU3ARQmAlIhgYOL6HZ4fVO1WZnfDHTvD/n8UX/8vST/+OJhTFkscDD30Dx/MwLp7dzZJV1/PG9hp8v4SpRyuh5rQTrKaEVhTyf/4qpU0LN5nSn+PNjwkxGe+ilCIWtRAxQaAkgVTolQw5lUqEBQgB0Xhi6ndJga9C/qeuG6RT0cnmi4kFi0YtECaBkiQTCZTSUCognqp04EiFJMA0DCLpKgJf8sfBn3pTJqv+n5dbyGkyZGqaJM2ba+whpd3ALpeobljMjPbFvPzCL9DztvzqytU3Ut+4gNMnX0cID6FrU/ZLTVM5q4R3lYHz016b+h92cTrndMLBTVqyCQXBidkyipDhVtlcJUN1rnAikZz6SjAFlIigUuQIpmWxExGNRMiQLBviOGIyoQpLsGIy3JxaOPHm96L4XyM/prVxhbG9fNPjionB2OFXMQkUariOj27V8rYH/5piYZwj+3+PqG1ep5ra13PvO77E2TN7eeOVn5LLDmBUwC/EVHQj/vhgTH/NE8JOlf5iMcGy0MI3LRQILXzTYtoNmjJwTAYColJ3mMTtpo/6mxYKhs6s0sWCCtkakzynEKmVU0+tvDpt6sZWbvr0GWqT/VGV0zLxisJvVoIJMe2AhZ3bbzI5YlJ/L6TxCGGgpKChaQ633vVh6htmsf25/2Jo4Bj/XzA+mdpliWIbAAAAAElFTkSuQmCC",
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
