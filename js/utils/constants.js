// ZyroNex modular extraction — utils/constants.js
// Pure data constants (zero app-internal deps). Loaded before zn-leaves.js.
// var-level for Safari TDZ-safety. Re-exported as window globals.

var CATALOG_TYPES = {
  manual:    { label:'Manual Import', icon:'📤', desc:'CSV / Excel / PDF upload' },
  api_rest:  { label:'REST API', icon:'🔌', desc:'JSON API (π.χ. WooCommerce, custom)' },
  api_woo:   { label:'WooCommerce', icon:'🛒', desc:'WooCommerce REST API v3' },
  csv_url:   { label:'CSV URL', icon:'🔗', desc:'Direct CSV/Excel link (auto-refresh)' },
  scrape:    { label:'Web Catalog', icon:'🌐', desc:'Manual από website (copy-paste)' }
};

var BANK_CATEGORIES = [
  {id:'sales',     label:'Πωλήσεις',     icon:'arrow-down', color:'#10b981'},
  {id:'purchase',  label:'Αγορά/Προμήθεια', icon:'shopping-cart', color:'#f59e0b'},
  {id:'salary',    label:'Μισθοδοσία',    icon:'users', color:'#8b5cf6'},
  {id:'rent',      label:'Ενοίκιο',       icon:'home', color:'#06b6d4'},
  {id:'utility',   label:'Λογαριασμοί ΔΕΚΟ', icon:'zap', color:'#eab308'},
  {id:'tax',       label:'Φόροι/ΦΠΑ',    icon:'landmark', color:'#ef4444'},
  {id:'transfer',  label:'Μεταφορά',      icon:'repeat', color:'#6b7280'},
  {id:'fees',      label:'Προμήθειες/Έξοδα τράπεζας', icon:'percent', color:'#a855f7'},
  {id:'other',     label:'Άλλο',          icon:'help-circle', color:'#64748b'}
];

var GREEK_BANKS = [
  // ── Ελληνικές Τράπεζες ─────────────────────────────────────────────────
  {code:'piraeus',    name:'Τράπεζα Πειραιώς',        bic:'PIRBGRAA', color:'#00aa3b'},
  {code:'eurobank',   name:'Eurobank',                 bic:'ERBKGRAA', color:'#001e62'},
  {code:'alpha',      name:'Alpha Bank',               bic:'CRBAGRAA', color:'#0a2240'},
  {code:'ethniki',    name:'Εθνική Τράπεζα',           bic:'ETHNGRAA', color:'#003876'},
  {code:'attica',     name:'Attica Bank',              bic:'ATTIGRAA', color:'#dd0a2e'},
  {code:'pancreta',   name:'Παγκρήτια Τράπεζα',        bic:'PANCGRAA', color:'#003366'},
  {code:'optima',     name:'Optima Bank',              bic:'IBOGGRAA', color:'#e6261f'},
  {code:'epirus',     name:'Συν. Τράπεζα Ηπείρου',     bic:'SBHTGRAA', color:'#0066b3'},
  {code:'thessalia',  name:'Τράπεζα Θεσσαλίας',        bic:'CRBKGRAA', color:'#004899'},
  {code:'viva',       name:'Viva Wallet',              bic:'VIVAGRA1', color:'#00b4d8'},
  // ── Ευρωπαϊκές / Διεθνείς με παρουσία στην Ελλάδα ────────────────────
  {code:'bnp',        name:'BNP Paribas',              bic:'BNPAGRAA', color:'#00965e'},
  {code:'citibank',   name:'Citibank',                 bic:'CITIGRAA', color:'#003b70'},
  {code:'hsbc',       name:'HSBC',                     bic:'MIDLGB22', color:'#db0011'},
  {code:'deutsche',   name:'Deutsche Bank',            bic:'DEUTDEDB', color:'#0018a8'},
  {code:'ing',        name:'ING',                      bic:'INGBNL2A', color:'#ff6200'},
  // ── Fintech / Neobanks ─────────────────────────────────────────────────
  {code:'revolut',    name:'Revolut',                  bic:'REVOGB22', color:'#0075ee'},
  {code:'wise',       name:'Wise',                     bic:'TRWIGB2L', color:'#163300'},
  {code:'n26',        name:'N26',                      bic:'NTSBDEB1', color:'#26c6da'},
  {code:'monese',     name:'Monese',                   bic:'',         color:'#6c47ff'},
  // ── Πληρωμές / Άλλο ───────────────────────────────────────────────────
  {code:'paypal',     name:'PayPal',                   bic:'',         color:'#003087'},
  {code:'cash',       name:'Μετρητά (Ταμείο)',          bic:'',         color:'#10b981'},
  {code:'other',      name:'Άλλο',                     bic:'',         color:'#6b7280'}
];

if(typeof window!=='undefined'){window.CATALOG_TYPES=CATALOG_TYPES;window.BANK_CATEGORIES=BANK_CATEGORIES;window.GREEK_BANKS=GREEK_BANKS;}
