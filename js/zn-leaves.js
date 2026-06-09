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
