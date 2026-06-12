# ZyroNex SPA — Migration Dependency Map (Phase 0)

> **Generated:** 2026-06-09  
> **Source file:** `/home/user/zyronex-app/index.html` — **74,957 lines** (vanilla JS, inline CSS, HTML, single-file production POS app)  
> **Total top-level declarations found:** ~1,982 (functions + vars + consts)  
> **Analysis method:** Targeted `grep` + `sed` passes, no full-file read.

---

## 1. SCRIPT STRUCTURE

| # | Line(s) | Type | Description |
|---|---------|------|-------------|
| 1 | 12 | Inline classic | Build metadata, console gate (`window.__ZN_BUILD`, `window.__ZN_DEBUG`), noop shim for `console.log` in production |
| 2 | 28 | Inline classic | Minimal PWA manifest injection (IIFE) — `navigator.serviceWorker.getRegistrations()` unregister + cache purge |
| 3 | 55 | Inline classic | iOS App Icons / theme-color meta tag injection |
| 4 | 90 | Inline classic | PWA `beforeinstallprompt` handler (`_pwaInstallPrompt`, `window._pwaInstall`); global error log (`window._errorLog`, `window.onerror`); `window._DEBUG` object |
| 5 | 276 | Inline classic | **Supabase readiness promise** — `window._supabaseReady = new Promise(...)`, polls every 50ms for `supabase.createClient`, times out after 160 checks. Exposes `window._resolveSupabase` |
| 6 | 310 | **External** | `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js` — provides global `supabase` |
| 7 | 312 | **External** | `https://cdn.jsdelivr.net/npm/dompurify@3.2.4/dist/purify.min.js` — provides global `DOMPurify` |
| 8 | 313 | Inline classic | `window.znClean()` and `window.znEscape()` — XSS sanitization helpers using DOMPurify |
| 9 | 327 | Inline classic | CDN-loaded guard — if `supabase` already present, resolve `_supabaseReady` immediately |
| 10 | 334 | Inline classic | Safari share-menu guard (`window._SAFARI_SHARE_OPEN`), `unhandledrejection` silencer, `navigator.share` override |
| 11 | 2568 | **External (async defer)** | `Chart.js 4.4.0` — `window.Chart` |
| 12 | 2569 | **External (async defer)** | `lucide 0.469.0` — `window.lucide` |
| 13 | 2570 | **External (async defer)** | `xlsx 0.18.5` — `window.XLSX` |
| 14 | 2571 | **External (async defer)** | `jsPDF 2.5.1` — `window.jspdf` |
| 15 | 2572 | **External (async defer)** | `jspdf-autotable 3.8.2` |
| 16 | 2573 | **External (async defer)** | `html5-qrcode 2.3.8` — `window.Html5QrcodeScanner` |
| 17 | 2574 | **External (async defer)** | `qrcodejs 1.0.0` — `window.QRCode` |
| 18 | 2575 | Inline classic | "NO JS FIXES NEEDED" placeholder (2 lines) |
| 19 | **2580–74957** | **Inline classic — MAIN BLOCK** | The bulk of application logic (~72,000 lines). Contains all globals, feature modules, render functions, init, DOMContentLoaded handlers. Broken into logical sub-regions (see Section 2). |

### Script block line ranges within the main block (approx.)

| Region | Approx. lines |
|--------|--------------|
| Global error catcher (second `window.onerror`) | 2580–2854 |
| Help system content (HELP_CONTENT, SECTION_HELP_CONTENT) | 2855–9213 |
| Oracle / AI advisor module | 9214–11128 |
| Brain (event engine, spot checks, notifications) | 11129–12762 |
| Compliance / TPD docs | 12763–13430 |
| Price War / supplier catalogs | 13431–14765 |
| Loyalty points, split payment, receipts, IRIS | 14766–16531 |
| Reservations, morning notifications | 16532–17096 |
| Photo import tool | 17097–17566 |
| Support tickets, HelpDesk | 17567–18068 |
| **Supabase config, sb/sbAuth clients, DB queue/cache** | 18069–18294 |
| Inspector DB proxy, INSPECTOR object | 18295–18588 |
| Core data arrays (USERS, PRODUCTS, SALES, CART…) | 18589–18631 |
| Shift/schedule/labor system | 18632–19565 |
| Categories manager | 19562–20132 |
| Data loading (loadAllData, reloadProducts…) | 20133–20412 |
| Core utils (eur, fmt, dateGR, toast, ZyroSec, can) | 20413–20688 |
| Plan/feature-flags system, signup flow | 20689–21828 |
| Inventory analytics helpers | 21829–22282 |
| Expense calendar, COMP_INSPECTOR | 21976–22880 |
| Login / PIN / session / logo | 23293–24062 |
| Router (PAGE_PERMS, showPage, goBack) | 24063–24641 |
| Product/category helpers, margin, EFK | 24709–25047 |
| Security audit (renderSecurity, runAutoFix) | 25048–25909 |
| Dashboard renderer | 25910–27028 |
| POS (renderPOS, addToCart, renderCart, checkout…) | 27029–29902 |
| SUNMI / hardware POS integration | 29903–30257 |
| Invoice parsing / OCR | 28212–29050 (nested) |
| Inventory (renderInventory, products CRUD) | 32841–36293 |
| Customers (renderCustomers, loyalty) | 36294–38091 |
| Cashbook + Reports | 37841–39612 |
| Shipments | 39413–39612 |
| BI (renderBI, aiBIAnalysis) | 39613–40007 |
| VAT report | 40008–40336 |
| Backup / Restore / Vault | 40337–40826 |
| Balance, AI features | 40827–41036 |
| Campaigns, alerts | 41037–41520 |
| ZN tab bar / hub navigation | 41521–41790 |
| Users management | 41791–42176 |
| Subscription / plan lifecycle | 42177–21477 |
| Settings renderer | 42602–43297 |
| Accountant export, AADE/MyData | 43379–44326 |
| Banking module | 44327–45506 |
| Reports scheduler, modals | 45507–45852 |
| AI (askClaude, getStoreContext, aiXxx helpers) | 45853–46114 |
| Scanner (startScanner, onScanSuccess) | 46115–46399 |
| App init (`async function init()`) | 46400–46522 |
| Inspector tool | 46523–46879 |
| Customer Intel (CI) | 46880–47703 |
| Mixology calculator | 47704–48396 |
| QR Guides, Battery Safety | 48397–48697 |
| EFK tax system | 48698–48833 |
| Batches (FIFO/expiry tracking) | 48834–49106 |
| MyData XML export | 49107–49417 |
| War Room / margin analytics | 49418–49820 |
| Hardware (warranty, guides) | 49820–50293 |
| Waste tracking | 50340–50600 |
| Competitors | 50601–51070 |
| Shifts (clockIn, clockOut, schedule) | 51128–52314 |
| Purchases (renderPurchases, OCR import) | 52315–53421 |
| Documents (invoice generator) | 53422–55264 |
| Purchases modal | 55264–55636 |
| Data Cleanup (supplier, prices, barcodes) | 55625–58555 |
| HID Scanner hardware | 58556–58679 |
| Onboarding tour | 58680–59116 |
| Onboarding checklist | 59117–59181 |
| Quick categories | 59182–59329 |
| Subscription lifecycle (SUB, SHOP_SUBSCRIPTION) | 59330–60132 |
| Export / PDF tools | 59725–60132 |
| Help center (renderHelp, helpNormalizeGreek) | 61069–62255 |
| Legal page | 61210–61488 |
| Audit Vault module | 62256–63725 |
| Online Orders integration | 63726–64724 |
| Pulse (social media studio, video editor) | 64725–65951 |
| Gift Cards | 65953–66044 |
| Age Verification | 66045–66195 |
| WhatsApp integration | 66196–66239 |
| GPS clock-in | 66240–66288 |
| Breakeven widget | 66289–66348 |
| DYPA (government subsidy tracker) | 66349–66439 |
| B2B Exchange marketplace | 66440–67915 |
| Settings categories/sections | 67916–68073 |
| TaxAgent AI (voice, VAT assistant) | 68074–68752 |
| ZyroBuilder site builder (ZB, ZBUI, ZNEshop, ZNOrders) | 68753–72419 |
| renderSiteBuilder | 72420–74957 |

---

## 2. GLOBAL SURFACE

### Core Data Globals

| Name | Line | Notes |
|------|------|-------|
| `USERS` | 18589 | Array: app_users |
| `SUPPLIERS` | 18590 | Array: suppliers |
| `PRODUCTS` | 18591 | Array: products (limit 2000) |
| `CUSTOMERS` | 18592 | Array: customers |
| `SALES` | 18593 | Array: sales |
| `SALES_MONTHLY_TOTALS` | 18594 | `{YYYY-MM: {total,count}}` |
| `CART` | 18595 | Array: current POS cart items |
| `CURRENT_USER` | 18596 | Active logged-in user |
| `SELECTED_USER_ID` | 18599 | PIN screen selection |
| `PIN_BUFFER` | 18598 | Active PIN input |
| `_appReady` | 18597 | Boolean: post-login |
| `NICOTINE_LEVELS` | 20133 | `[0,3,6,9,12,18,20]` |
| `today` | 20134 | `new Date()` at load time |
| `DEFAULT_CATEGORIES` | 19562 | Array of default product categories |
| `CATEGORIES` | 19566 | IIFE reading from localStorage |
| `RESERVATIONS` | 16644 | Array: loaded from localStorage |
| `SHIFT_SCHEDULES` | 18664 | Array: shift schedule rows |
| `BANK_ACCOUNTS` | 18668 | Array |
| `BANK_TRANSACTIONS` | 18669 | Array |
| `BANK_AGGREGATOR_CONFIG` | 18670 | Object or null |
| `BANK_CATEGORIES` | 18672 | Array |
| `GREEK_BANKS` | 18684 | Array |
| `LABOR_SETTINGS` | 18770 | Object |
| `ROLE_ICONS` | 18602 | Map role → emoji/key |
| `DAY_NAMES_GR` | 18781 | Greek day names |
| `DAY_NAMES_GR_SHORT` | 18782 | Short day names |

### Supabase / DB Globals

| Name | Line | Notes |
|------|------|-------|
| `SUPABASE_URL` | 18069 | Hardcoded URL |
| `SUPABASE_KEY` | 18070 | Anon key |
| `sb` | 18141 | Main `supabase.createClient(...)` — no session, custom fetch |
| `sbAuth` | 18173 | Auth-only client with `persistSession: true` |
| `SHOP_ID` | 18222 | Hardcoded UUID (updated on login) |
| `DEVELOPER_SHOP_IDS` | 18250 | Array of dev shop UUIDs |
| `TABLES_WITHOUT_SHOP_ID` | 18257 | Array of system tables |
| `_origFrom` | 18267 | Saved reference before `sb.from` is monkey-patched |
| `INSPECTOR` | 18295 | DB proxy object with auto shop_id injection |
| `_DB_QUEUE` | 18075 | Request queue array |
| `_DB_ACTIVE` | 18076 | Active request counter |
| `_MEM_CACHE` | 18077 | In-memory cache object |
| `_CACHE_TTL` | 18078 | Cache expiry map |
| `_DB_MAX_CONCURRENT` | 18074 | `6` |
| `AI_ENDPOINT` | 45853 | Template literal using `SUPABASE_URL` |

### Router / Navigation Globals

| Name | Line | Notes |
|------|------|-------|
| `showPage` | 24185 | Master page router; pushes to `_pageHistory` |
| `window._pageHistory` | 24232 | Stack array, max 60 entries |
| `PAGE_PERMS` | 24063 | Map: page → required permission |
| `goBack` | 24412 | Pops `_pageHistory` |
| `_updateBackBtn` | 24360 | Updates back button visibility |
| `applyPermissionsToSidebar` | 24475 | Hides sidebar items by perms |
| `_showPageInternal` | 24503 | Actual page render dispatcher |
| `getInitialPage` | 24642 | Determines first page after login |
| `firstAllowedPage` | 24128 | Finds first page the user can access |
| `_originalShowPageForPlan` | 21346 | Saved reference before plan interceptor wraps `showPage` |

### POS Globals

| Name | Line | Notes |
|------|------|-------|
| `POS_CATEGORY` | 27029 | Current category filter, default `'✨ Top'` |
| `POS_SEARCH` | 27030 | Search string |
| `POS_MODE` | 27058 | `'scanner' \| 'quick'` (localStorage) |
| `POS_QUICK_CAT` | 27059 | Selected category in quick mode |
| `POS_QUICK_BUFFER` | 27060 | Numpad input buffer |
| `POS_FEEDBACK` | 27850 | Object with `init()`, sound/vibration feedback |
| `INVOICE_ARCHIVE` | 27958 | Object: invoice history state |
| `SUNMI` | 29903 | Hardware POS integration object with `init()` |
| `SPLIT_PAYMENTS` | 14802 | Array: split payment methods |
| `SPLIT_TOTAL` | 14803 | Number |
| `SPLIT_CUSTOMER` | 14804 | Customer ref for split payment |
| `PAYMENT_HANDLERS` | 15503 | Object: method → handler map |
| `renderPOS` | 27068 | Renders full POS page |
| `renderPOSGrid` | 27724 | Renders product grid in POS |
| `renderPOSScannerBody` | 27113 | Scanner mode body |
| `renderPOSQuickBody` | 27243 | Quick mode body |
| `addToCart` | 28637 | Adds product to `CART` |
| `renderCart` | 29050 | Renders cart sidebar |
| `quickPosCashPayment` | 15129 | Direct cash checkout |
| `quickPosCardPayment` | 15206 | Card checkout |
| `quickPosIrisPayment` | 15220 | IRIS payment |
| `openSplitPayment` | 15583 | Opens split payment modal |
| `checkout` | (within renderCart/payment flow) | Triggered via payment handlers |
| `scanSubmit` | 27795 | Barcode scan → addToCart |
| `SCANNER` | 46115 | html5-qrcode scanner instance |
| `SCANNER_MODE` | 46116 | `'pos' \| 'form'` |
| `HID_SCANNER` | 58556 | Object: hardware barcode scanner with `init()` |

### Reports / Cashbook Globals

| Name | Line | Notes |
|------|------|-------|
| `renderReports` | 38092 | Main reports page; contains nested `getSalesForRange()` |
| `getSalesForRange` | 38104 | **Nested function** inside `renderReports` — not a top-level global |
| `renderCashbook` | 37841 | Cashbook view |
| `renderBI` | 39613 | Business Intelligence page |
| `aiBIAnalysis` | 39914 | Sends SALES snapshot to Claude |
| `renderVAT` | 40008 | VAT report page |
| `todaySales` | 23211 | Sum of today's sales from `SALES` |
| `salesRangeSum` | 23234 | Sum for last N days |
| `getSalesSummary` | 23260 | Cached aggregate (TTL cache) |
| `_SALES_SUMMARY_CACHE` | 23258 | Memoization store |

### UI Utils Globals

| Name | Line | Notes |
|------|------|-------|
| `eur` | 20413 | `(n) => n.toFixed(2).replace('.',',')+' €'` |
| `fmt` | 20414 | `Intl.NumberFormat('el-GR')` formatter |
| `dateGR` | 20415 | `(s) => new Date(s).toLocaleDateString('el-GR')` |
| `sup` | 20416 | `(id) => SUPPLIERS.find(s=>s.id===id)` — depends on `SUPPLIERS` |
| `daysTo` | 20417 | Depends on `today` |
| `addDays` | 20135 | Depends on `today` |
| `toast` | 20442 | Arrow fn; uses `_toastQueue` / `_processToastQueue` |
| `_toastQueue` | 20419 | Queue array |
| `_toastActive` | 20420 | Boolean flag |
| `_processToastQueue` | 20421 | Drain function |
| `openModal` | 45648 | Generic modal open |
| `closeModal` | 45723 | Generic modal close |
| `showConfirm` | 45827 | Confirm dialog |
| `helpNormalizeGreek` | 62139 | Strip accents, lowercase |
| `_normalizeForIconMatch` | 19642 | Similar normalizer for icons |
| `_escHtml` | 65936 | HTML escape (multiple definitions in file) |
| `escapeHtml` | 63652 | Another HTML escape |
| `formatMarkdown` | 39992 | Markdown→HTML mini-renderer |
| `formatAIText` | 46062 | Formats Claude response text |
| `znClean` | 313 | DOMPurify-based sanitizer (window-level) |
| `znEscape` | 313 | Plain text escape (window-level) |
| `money` / `eur` | 20413 | Same function |
| `can` | 20682 | Permission check: `(perm) => CURRENT_USER && ...` |

### Init / Lifecycle Globals

| Name | Line | Notes |
|------|------|-------|
| `init` | 46400 | Main async init — calls `initTheme`, renders login, calls `loadAllData` on success |
| `loadAllData` | 20140 | Async; loads all Supabase tables into globals |
| `reloadProducts` | 20357 | Async partial reload |
| `reloadCustomers` | 20389 | Async partial reload |
| `logShopChange` | 20333 | Audit logging to Supabase |
| `initPlanSystem` | 21813 | Plan subscription + feature gates bootstrap |
| `initSubscriptionLifecycle` | 60133 | Full sub lifecycle init |
| `loadSubscription` | 59354 | Loads shop subscription record |
| `loadBankingData` | 18713 | Loads banking tables |
| `loadShiftsExtensions` | 18784 | Loads shift extension data |
| `loadPluginSubscriptions` | 20975 | Loads plugin sub cache |
| `initReservations` | 16962 | Loads reservations |
| `loadCustomCategoryIcons` | 19761 | Loads icons from Supabase Storage |
| `loadLogoFromSupabase` | 23416 | Loads shop logo |
| `_brainAutoInit` | 12745 | Starts Brain polling after login |
| `brainStartPolling` | 12477 | Sets up `BRAIN_POLL_TIMER` |
| `inspectorAutoScanOnLogin` | 46862 | Auto DB scan on login |
| `checkAndPromptClockIn` | 18872 | Called after login |
| `_maybeTriggerOnboarding` | 59182 | Triggers tour if first time |
| `ZyroSec` | 20453 | Security monitor IIFE object |

### Feature Area: BI / Oracle / Brain

| Name | Line | Notes |
|------|------|-------|
| `ORACLE_MESSAGE` | 9214 | Cached message text |
| `ORACLE_LOADING` | 9215 | Boolean |
| `ORACLE_PENDING` | 9216 | Pending actions |
| `ORACLE_BILLS` | 9217 | Recurring bills array |
| `renderOracle` | 10504 | Oracle page renderer |
| `oracleRefresh` | 10680 | Force refresh |
| `_oracleGenerateMessage` | 9359 | Async; calls `askClaude` |
| `BRAIN_FILTER` | 11551 | `'all'` or category filter |
| `BRAIN_EVENTS_CACHE` | 11552 | Cached event list |
| `BRAIN_POLL_TIMER` | 12187 | Polling interval reference |
| `renderBrain` | 12005 | Brain page renderer |
| `brainGenerateMorningBriefing` | 12553 | Async; calls `askClaude` |
| `WEATHER_DATA` | 9887 | Cached weather response |
| `TRENDS_DATA` | 10209 | Cached trend data |

### Feature Area: Vault / Compliance / Audit

| Name | Line | Notes |
|------|------|-------|
| `VAULT_STATE` | 53822 | `{path, loading}` |
| `VAULT_CATEGORIES` | 53826 | Array of folder categories |
| `renderVault` | 53881 | Vault page renderer |
| `COMPLIANCE_FILTER` | 12763 | Filter state |
| `renderCompliance` | 12912 | Compliance page renderer |
| `AUDIT_STATE` | 62335 | Object with current audit flow state |
| `AUDIT_TYPES` | 62282 | Map of audit type configs |
| `renderAuditVault` | 62349 | Async renderer |
| `auditStartFlow` | 62467 | Async |

### Feature Area: Campaigns / Notifications

| Name | Line | Notes |
|------|------|-------|
| `renderCampaigns` | 40930 | Campaigns page |
| `launchCampaign` | 41121 | Async; sends emails/SMS |
| `renderAlerts` | 41296 | Alerts page |
| `updateNotifDot` | 41254 | Updates notification badge |

### Feature Area: ZyroBuilder Site Builder

| Name | Line | Notes |
|------|------|-------|
| `ZB` | 69017 | Main site builder config/state `const` |
| `ZBUI` | 70724 | UI component library `const` |
| `ZNEshop` | 72125 | E-shop management `const` |
| `ZNOrders` | 72274 | Online orders handler `const` |
| `renderSiteBuilder` | 72420 | Page renderer |
| `WIDGET_CATALOG` | 71356 | Array of widget definitions |
| `ONLINE_ORDERS` | 63736 | Var: online orders state object |

### Feature Area: Price War / Exchange

| Name | Line | Notes |
|------|------|-------|
| `PRICE_WAR_CATALOGS` | 13431 | Map: supplierId → catalog items |
| `PRICE_WAR_ALERTS` | 13432 | Comparison results |
| `renderPriceWar` | 13928 | Async renderer |
| `priceWarSync` | 13865 | Async sync per supplier |
| `_exchTab` | 66442 | Exchange tab state |
| `renderExchange` | 66447 | Async exchange renderer |

### Feature Area: Plan / Permissions

| Name | Line | Notes |
|------|------|-------|
| `PLAN_FEATURES` | 20689 | Nested map: plan → feature → boolean |
| `ZYRONEX_PLUGINS` | 20813 | Array of plugin definitions |
| `PLUGIN_SUBS_CACHE` | 20973 | Map: plugin_id → sub info |
| `can` | 20682 | Permission shorthand |
| `planHas` | 21218 | Feature flag check |
| `getPlanLimit` | 21225 | Numeric limit |
| `isPluginUsable` | 21083 | Full plugin gating |
| `SUB` | 59330 | Subscription state |
| `SHOP_SUBSCRIPTION` | 59340 | Current sub record |

---

## 3. CROSS-REFERENCE GRAPH

```
POS
  → toast (utils)
  → PRODUCTS (data) — addToCart reads PRODUCTS by id
  → CUSTOMERS (data) — cart shows customer, loyalty points
  → CART (data) — renderCart, addToCart mutate CART
  → SALES (data) — checkout writes to SALES
  → sb (Supabase) — checkout saves sale record
  → can (auth) — permission checks on checkout
  → eur, fmt (utils) — price formatting in renderCart
  → showPage (router) — post-checkout navigation
  → SUPPLIERS (data) — sup() used for product display
  → SCANNER (scanner) — scan triggers addToCart

ORACLE
  → askClaude (AI) — _oracleGenerateMessage, _oracleAnswerQuestion
  → SALES (data) — _oracleBusinessSnapshot reads SALES
  → PRODUCTS (data) — _oracleBusinessSnapshot, _matchProducts
  → CUSTOMERS (data) — _oracleRegularCustomers
  → sb (Supabase) — _oracleExecuteAction writes to DB
  → toast (utils) — user feedback
  → showPage (router) — oracle action buttons
  → WEATHER_DATA (oracle-internal)
  → ORACLE_BILLS (oracle-internal)
  → ORACLE_PENDING (oracle-internal)

BRAIN
  → SALES (data) — _brainEventsFromSales
  → PRODUCTS (data) — _brainEventsFromStock, _brainEventsFromMissingML
  → CUSTOMERS (data) — _brainEventsFromCustomers
  → ORACLE_BILLS (oracle) — _brainEventsFromBills
  → ORACLE_PENDING (oracle) — _brainEventsFromPending
  → WEATHER_DATA (oracle) — _brainEventsFromWeather
  → askClaude (AI) — brainGenerateMorningBriefing
  → toast (utils)
  → showPage (router)
  → sb (Supabase) — bulk spot check saves

REPORTS / BI
  → SALES (data) — renderReports, getSalesForRange, renderBI
  → PRODUCTS (data) — inventory value, margins
  → CUSTOMERS (data) — customer revenue
  → SUPPLIERS (data) — purchase reports
  → eur, fmt, dateGR (utils)
  → askClaude (AI) — aiBIAnalysis
  → sb (Supabase) — getSalesSummary loads from DB
  → renderCashbook → SALES + eur
  → Chart.js (external) — BI charts

ROUTER (showPage)
  → _pageHistory (router-internal)
  → PAGE_PERMS (router-internal)
  → can (auth)
  → CURRENT_USER (data)
  → planHas / isPluginUsable (plan)
  → _showPageInternal → all render functions
  → applyPermissionsToSidebar
  → lucide.createIcons() (external)

AUTH / LOGIN
  → sbAuth (Supabase) — znVerifyShopAuth, znShopLogin
  → sb (Supabase) — loadAllData after login
  → SHOP_ID (config)
  → CURRENT_USER (data) — set on submitPin
  → loadAllData (init)
  → showPage (router)
  → toast (utils)
  → saveSession / getSavedSession (localStorage)

CUSTOMERS
  → sb (Supabase) — CRUD operations
  → SALES (data) — total_spent computation
  → PRODUCTS (data) — preferred products
  → toast (utils)
  → eur (utils)
  → can (auth)
  → showPage (router)
  → renderCustomers → CUSTOMERS array

VAULT / COMPLIANCE
  → sb (Supabase) — _compLoadDocs, _vaultListStoragePath (Storage API)
  → PRODUCTS (data) — lists products needing docs
  → SHOP_ID (config)
  → can (auth)
  → toast (utils)
  → renderVault → VAULT_STATE (vault-internal)

PLAN SYSTEM
  → sb (Supabase) — loadSubscription
  → SHOP_ID (config)
  → showPage (router) — monkey-patches showPage
  → toast (utils)
  → CURRENT_USER (data)
  → window.renderSettings (settings) — monkey-patches renderSettings
```

---

## 4. TOP-LEVEL EXECUTION RISKS

These statements execute code **at parse/load time**, outside any function or DOMContentLoaded. They create load-order dependencies critical for ESM migration.

| Line | Statement | Depends On |
|------|-----------|------------|
| 12 | `window.__ZN_DEBUG = /[?&]debug=1/.test(location.search)...` | `location` (browser) |
| 20 | IIFE: `(function(){ navigator.serviceWorker.getRegistrations()... })()` | `navigator.serviceWorker` |
| 92 | `var _pwaInstallPrompt = null` | nothing |
| 93 | `window.addEventListener('beforeinstallprompt', ...)` | browser event system |
| 116 | `window._errorLog = []` | nothing |
| 125 | `window.onerror = function(...)` | browser |
| 143 | `window.addEventListener('unhandledrejection', ...)` | browser |
| 167 | `window._DEBUG = { logs:[], errors:[], startTime: Date.now() }` | `Date.now()` |
| 278 | `window._supabaseReady = new Promise(...)` with polling `setTimeout` | browser, `supabase` CDN load |
| 336 | `window._SAFARI_SHARE_OPEN = false` + `navigator.share` override | `navigator` |
| 2581 | Second `window.onerror` (in `<body>`) | browser |
| 2859 | `var HELP_LANG = localStorage.getItem('helpLang') \|\| 'el'` | `localStorage` |
| 4209 | `var HELPDESK_LANG = localStorage.getItem('helpLang') \|\| 'el'` | `localStorage` |
| 10073 | `window.getWeatherSeasonalContext = getWeatherSeasonalContext` | function `getWeatherSeasonalContext` must be defined above |
| 13862 | `window._pwAutoDetectScrape = _pwAutoDetectScrape` | function defined above |
| 18253 | `window.IS_DEVELOPER_OWNER = DEVELOPER_SHOP_IDS.includes(SHOP_ID)` | `DEVELOPER_SHOP_IDS` (line 18250), `SHOP_ID` (line 18222) |
| 18267 | `var _origFrom = sb.from.bind(sb)` | `sb` (line 18141) — supabase CDN must be loaded |
| 19562 | `var DEFAULT_CATEGORIES = [...]` | nothing |
| 19566 | `var CATEGORIES = (() => { localStorage.getItem(...) })()` | `localStorage`, `DEFAULT_CATEGORIES` |
| 20134 | `var today = new Date()` | `Date` — **risk**: stale across midnight if page stays open |
| 20135 | `var addDays = (d) => {...}` | `today` (line 20134) — captures `today` at declaration |
| 21346 | `var _originalShowPageForPlan = window.showPage \|\| function(){}` | `showPage` must be defined earlier (it is, at 24185) — **ordering bug risk**: `showPage` defined AFTER this line |
| 23162 | `var originalRenderSettings = window.renderSettings` | `renderSettings` must exist — defined at 42602, so this is fine |
| 23351 | `var _CACHED_LOGO_URL = (() => { localStorage.getItem(LOGO_KEY) })()` | `LOGO_KEY` (line 23350) |
| 27058 | `var POS_MODE = localStorage.getItem('vs_pos_mode') \|\| 'scanner'` | `localStorage` |
| 41462 | `var _znTabTapOrig = znTabTap` | `znTabTap` must exist — defined at 41642 (AFTER this) — **ordering risk** |
| 43207 | `var _renderSettingsInline = renderSettings` | `renderSettings` at 42602 — OK |
| 44327 | `var BANKING_TAB = localStorage.getItem('bankingTab') \|\| 'overview'` | `localStorage` |
| 62332 | `var AUDIT_EFK_RATE = (typeof EFK_RATE_PER_ML !== 'undefined') ? EFK_RATE_PER_ML : 0.10` | `EFK_RATE_PER_ML` (line 48698) — safe with `typeof` guard |
| 66196 | `var WA_CONFIG = JSON.parse(localStorage.getItem('wa_config') \|\| '{}')` | `localStorage` |
| 66240 | `var GPS_CONFIG = JSON.parse(localStorage.getItem('gps_config') \|\| '...')` | `localStorage` |
| 66289 | `var BREAKEVEN_CONFIG = JSON.parse(localStorage.getItem('breakeven_config') \|\| '...')` | `localStorage` |

### Critical ordering issue:
- **Line 21346**: `var _originalShowPageForPlan = window.showPage || function(){}` — `showPage` is defined at line 24185 (3,000 lines **later**). In classic scripts this is safe due to hoisting of `function` declarations, but if split into ESM modules in the wrong order this will assign `undefined`/fallback prematurely.
- **Line 41462**: `var _znTabTapOrig = znTabTap` — `znTabTap` is both defined at 41463 (immediately after, a re-definition) AND earlier at 41642. The first definition is being captured here, which is intentional but fragile.

---

## 5. LEAF CANDIDATES

These have **zero dependencies on app-internal globals** and can be extracted first.

| Name | Line | Why it's a leaf |
|------|------|----------------|
| `eur` | 20413 | Pure formatter: `(n) => n.toFixed(2).replace('.',',')+' €'` — no deps |
| `fmt` | 20414 | Pure `Intl.NumberFormat` wrapper — no deps |
| `dateGR` | 20415 | Pure `Date.toLocaleDateString` wrapper — no deps |
| `addDays` | 20135 | Depends only on `today` (a `new Date()` at load time); extract as `addDays(d, from=new Date())` |
| `formatMarkdown` | 39992 | Pure string transform — no app deps |
| `helpNormalizeGreek` | 62139 | Pure string function — no deps |
| `_normalizeForIconMatch` | 19642 | Pure string function — no deps |
| `_escHtml` / `escapeHtml` | 65936, 63652 | Pure HTML escape — no deps (two duplicate implementations) |
| `escapeRegExp` | 62134 | Pure regex escape — no deps |
| `_xmlEscape` | 49300 | Pure XML escape — no deps |
| `formatHours` | 18863 | Pure number → `"Xh Ym"` string |
| `predictDaysLeft` | 23202 | Reads `p` (product object) only — no global state |
| `SUPABASE_URL` | 18069 | Constant string |
| `SUPABASE_KEY` | 18070 | Constant string |
| `SHOP_ID` | 18222 | Constant UUID (updated at login, but initialization is safe) |
| `AI_ENDPOINT` | 45853 | Template literal from `SUPABASE_URL` — leaf if extracted alongside |
| `znClean` / `znEscape` | 313 | Depends only on `DOMPurify` (external CDN) |
| `NICOTINE_LEVELS` | 20133 | Pure constant array |
| `DEFAULT_CATEGORIES` | 19562 | Pure constant array |
| `EFK_RATE_PER_ML` | 48698 | Pure numeric constant `0.10` |
| `ACCT_MONTHS_GR` | 43379 | Pure array of month names |
| `DAY_NAMES_GR` | 18781 | Pure array |
| `DAY_NAMES_GR_SHORT` | 18782 | Pure array |
| `GREEK_HOLIDAYS` | 10076 | Pure constant object |
| `NICOTINE_LEVELS` | 20133 | Pure array |
| `WASTE_REASONS` | 50344 | Pure constant map |
| `CATALOG_TYPES` | 13437 | Pure constant map |
| `DOC_TYPES` | 12766 | Pure constant map |
| `sb` + `sbAuth` init | 18141, 18173 | Depends only on `supabase` CDN + `SUPABASE_URL/KEY` — safe if those constants are co-extracted |
| `toast` | 20442 | Depends only on `_toastQueue`/`_toastActive`/`_processToastQueue` and `document.getElementById('toastHost')` — extract as a micro-module |

---

## 6. PROPOSED EXTRACTION ORDER

Leaf-first. Later modules depend on earlier ones.

```
1.  utils/constants.js
    — NICOTINE_LEVELS, DEFAULT_CATEGORIES, EFK_RATE_PER_ML, ACCT_MONTHS_GR,
      DAY_NAMES_GR, DAY_NAMES_GR_SHORT, GREEK_HOLIDAYS, WASTE_REASONS,
      CATALOG_TYPES, DOC_TYPES, BANK_CATEGORIES, GREEK_BANKS
    — Zero deps. Pure data. Safe.

2.  utils/formatters.js
    — eur, fmt, dateGR, formatHours, addDays (convert to pure function)
    — Depends on nothing. Safe. Remove closure over `today`; pass date explicitly.

3.  utils/string.js
    — helpNormalizeGreek, _normalizeForIconMatch, _escHtml/escapeHtml,
      escapeRegExp, _xmlEscape, formatMarkdown, formatAIText
    — Zero deps. Pure string transforms. Safe.

4.  utils/sanitize.js (thin wrapper)
    — znClean, znEscape
    — Depends on DOMPurify (external CDN). Import DOMPurify as esm.sh module.
    — Risk: DOMPurify must load before this module is consumed.

5.  config/supabase.js
    — SUPABASE_URL, SUPABASE_KEY, SHOP_ID, AI_ENDPOINT, DEVELOPER_SHOP_IDS,
      TABLES_WITHOUT_SHOP_ID, _DB_MAX_CONCURRENT
    — Pure constants. Safe. SHOP_ID is overwritten after login so export as
      mutable binding or use a getter.

6.  config/supabase-client.js
    — sb, sbAuth, _dbEnqueue, _dbDrain, _dbCached, _dbInvalidate, _pooledFetch
    — Depends on config/supabase.js + supabase CDN. Must run after CDN resolves.
    — Risk: sb.from monkey-patch (_origFrom, INSPECTOR) must also move here.

7.  utils/toast.js
    — _toastQueue, _toastActive, _processToastQueue, toast
    — Depends on DOM (#toastHost). Safe if DOM ready, but must load before any
      module that calls toast(). Risk: DOMContentLoaded ordering.

8.  data/store.js
    — USERS, SUPPLIERS, PRODUCTS, CUSTOMERS, SALES, SALES_MONTHLY_TOTALS,
      CART, CURRENT_USER, SELECTED_USER_ID, PIN_BUFFER, _appReady, CATEGORIES
    — Depends on utils/constants.js (DEFAULT_CATEGORIES) and localStorage.
    — Risk: CATEGORIES IIFE reads localStorage at module init time — safe.

9.  auth/permissions.js
    — can, PAGE_PERMS, PLAN_FEATURES, ROLE_ICONS, ZYRONEX_PLUGINS,
      planHas, getPlanLimit, isPluginUsable, isPluginActive, planGuard
    — Depends on data/store.js (CURRENT_USER), config/supabase.js (SHOP_ID).
    — Risk: plan interceptor monkey-patches showPage — must run AFTER router.js.

10. auth/session.js
    — SESSION_KEY, SESSION_DAYS, saveSession, clearSession, getSavedSession,
      LOGO_KEY, _CACHED_LOGO_URL, getCustomLogo, setCustomLogo
    — Depends on localStorage. _CACHED_LOGO_URL IIFE reads localStorage — safe.

11. data/loader.js
    — loadAllData, reloadProducts, reloadCustomers, logShopChange, loadBankingData,
      loadShiftsExtensions, loadPluginSubscriptions, loadCustomCategoryIcons
    — Depends on config/supabase-client.js (sb), data/store.js (USERS…),
      auth/session.js (SHOP_ID), utils/toast.js.
    — Risk: large async function; must await sb ready. Keep single module.

12. router/router.js
    — showPage, _pageHistory, goBack, _updateBackBtn, PAGE_PERMS,
      applyPermissionsToSidebar, _showPageInternal, getInitialPage, firstAllowedPage
    — Depends on auth/permissions.js (can, planHas), data/store.js (CURRENT_USER),
      utils/toast.js.
    — Risk: monkey-patched by plan system and settings. Export showPage then
      let consumer modules call applyPlanInterceptor() explicitly.

13. ui/modal.js
    — openModal, closeModal, showConfirm, _enforceModalLayout
    — Depends on DOM only. Safe.

14. auth/login.js
    — renderLogin, selectUser, pressPin, submitPin, updatePinDisplay, logout,
      SELECTED_USER_ID, PIN_BUFFER, _doLogout
    — Depends on sbAuth (supabase-client), data/loader.js, router/router.js,
      utils/toast.js, auth/session.js.
    — Risk: PIN flow is entangled with shift clock-in (checkAndPromptClockIn).

15. categories/categories.js
    — CATEGORIES, saveCategories, addCategory, renameCategory, deleteCategory,
      resetCategoriesToDefault, moveCategory, renderCategoriesManager,
      getCategoryIcon, getDefaultIconKey, uploadCategoryIcon, migrateOrphanCategories
    — Depends on data/store.js (PRODUCTS), config/supabase-client.js (sb),
      utils/toast.js.
    — Risk: CATEGORIES is a mutable global modified by multiple modules (POS, settings).

16. features/pos.js
    — renderPOS, renderPOSGrid, addToCart, renderCart, setPOSCat, updatePOSSearch,
      scanSubmit, POS_CATEGORY, POS_SEARCH, POS_MODE
    — Depends on data/store.js (PRODUCTS, CART, CUSTOMERS), config/supabase-client.js,
      utils/formatters.js, utils/toast.js, router/router.js.
    — Risk: Largest coupling hub. Split into pos-grid.js + cart.js if possible.

17. features/payment.js
    — SPLIT_PAYMENTS, PAYMENT_HANDLERS, openSplitPayment, quickPosCashPayment,
      quickPosCardPayment, _generateReceiptHTML, _printReceiptQueue
    — Depends on features/pos.js (CART, renderCart), data/store.js, utils/toast.js,
      config/supabase-client.js, loyalty (calcLoyaltyBurnRate).
    — Risk: Tightly coupled to POS checkout flow. Extract after pos.js.

18. features/customers.js
    — renderCustomers, renderCustomerIntel, CI_*, calcLoyaltyBurnRate, renderLoyaltyBurnRateCard
    — Depends on data/store.js (CUSTOMERS, SALES), config/supabase-client.js,
      utils/formatters.js, utils/toast.js.
    — Risk: Customer Intel has lazy-loaded sale items cache (ciEnsureItems).

19. features/inventory.js
    — renderInventory, totalInventoryValue, lowStockList, outOfStockList, expiringList,
      deadStockList, getAtRiskProducts, getMarginErosionAlerts
    — Depends on data/store.js (PRODUCTS, SUPPLIERS), utils/formatters.js, utils/toast.js,
      config/supabase-client.js, categories/categories.js.
    — Risk: Many sub-features (batches, waste, EFK) are intertwined.

20. features/reports.js
    — renderReports, renderCashbook, renderBI, renderVAT, aiBIAnalysis, getSalesSummary,
      todaySales, salesRangeSum
    — Depends on data/store.js (SALES, PRODUCTS, CUSTOMERS), utils/formatters.js,
      ai/claude.js (askClaude), Chart.js (external async).
    — Risk: Chart.js is async defer — must guard with `if(window.Chart)` or lazy-render.

21. ai/claude.js
    — askClaude, getStoreContext, AI_ENDPOINT, aiAnalyzeInventory, aiGenerateOffers,
      aiPricingSuggestions, aiCustomerAnalysis, aiDemandForecast, aiChat
    — Depends on config/supabase.js (SUPABASE_URL), data/store.js (PRODUCTS, SALES…),
      utils/toast.js.
    — Risk: AI_ENDPOINT is a template literal from SUPABASE_URL. Keep in same module or
      import SUPABASE_URL.

22. features/oracle.js
    — ORACLE_*, renderOracle, oracleRefresh, _oracleGenerateMessage, _oracleAnswerQuestion
    — Depends on ai/claude.js, data/store.js, utils/toast.js, router/router.js.
    — Risk: oracle loads weather + trends data (async); tight coupling to WEATHER_DATA, TRENDS_DATA.

23. features/brain.js
    — BRAIN_*, renderBrain, brainStartPolling, brainGenerateMorningBriefing, _brainCollectAllEvents
    — Depends on oracle.js (ORACLE_BILLS, ORACLE_PENDING, WEATHER_DATA), data/store.js,
      ai/claude.js, utils/toast.js.
    — Risk: Polling timer needs clean teardown on logout.

24. features/shifts.js
    — SHIFTS_CACHE, renderShifts, clockIn, clockOut, renderShiftAdminOverview,
      LABOR_SETTINGS, checkAndPromptClockIn, SHIFT_SCHEDULES
    — Depends on data/store.js (USERS, CURRENT_USER), config/supabase-client.js,
      utils/toast.js, utils/formatters.js, GPS (gpsClockIn).
    — Risk: Ergani integration (async external API calls). Entangled with login flow.

25. features/scanner.js
    — SCANNER, SCANNER_MODE, startScanner, stopScanner, onScanSuccess, HID_SCANNER
    — Depends on html5-qrcode (async defer), features/pos.js (addToCart), utils/toast.js.
    — Risk: html5-qrcode is async defer — must wait for it before calling startScanner.

26. features/vault.js
    — VAULT_STATE, VAULT_CATEGORIES, renderVault, _vaultRenderFolder, _vaultUploadFile
    — Depends on config/supabase-client.js (sb Storage), auth/permissions.js (can),
      utils/toast.js.
    — Risk: Supabase Storage path encoding (_vaultSanitizeSeg) is tightly coupled.

27. features/compliance.js
    — COMPLIANCE_FILTER, renderCompliance, complianceUploadFile, complianceGenerateReport
    — Depends on data/store.js (PRODUCTS), config/supabase-client.js (sb Storage),
      utils/toast.js, auth/permissions.js (can).

28. features/purchases.js
    — PURCHASES_CACHE, renderPurchases, openInvoiceScanner, importInvoiceToPurchases,
      callInvoiceOCR
    — Depends on data/store.js (SUPPLIERS, PRODUCTS), config/supabase-client.js,
      ai/claude.js (OCR analysis), utils/toast.js.
    — Risk: Invoice OCR is a large async workflow with many nested helpers.

29. features/banking.js
    — BANK_ACCOUNTS, BANK_TRANSACTIONS, renderBanking, saveBankAccount, loadBankingData
    — Depends on data/store.js, config/supabase-client.js, utils/formatters.js.

30. features/audit.js
    — AUDIT_STATE, AUDIT_TYPES, renderAuditVault, auditStartFlow, auditExportZip
    — Depends on data/store.js, features/compliance.js, features/batches.js,
      config/supabase-client.js, utils/toast.js.
    — Risk: Audit references many other feature modules for data gathering.

31. features/subscription.js
    — SUB, SHOP_SUBSCRIPTION, loadSubscription, initSubscriptionLifecycle, renderSubBanner,
      showUpgradePrompt, applyPlanInterceptor, startPlanSync
    — Depends on config/supabase-client.js, router/router.js (monkey-patches showPage),
      utils/toast.js.
    — Risk: Monkey-patches showPage and renderSettings at module init — must load
      AFTER router.js and settings.js.

32. features/settings.js
    — renderSettings, saveSettings, getSettings, saveIrisConfig, renderPointRatesSettings
    — Depends on nearly all other modules (touches categories, users, plan, banking, EFK…).
    — Risk: Highest fan-in module in the entire app. Extract last.

33. features/site-builder.js
    — ZB, ZBUI, ZNEshop, ZNOrders, renderSiteBuilder, WIDGET_CATALOG, grabTemplate
    — Depends on config/supabase-client.js (sb Storage), ai/claude.js, utils/formatters.js.
    — Risk: Self-contained enough but large. ZB/ZBUI use `const` so no hoisting issues.

34. features/pulse.js
    — PULSE, renderPulse, psRemoveBG, ceGeneratePosts, ceGenerateKeywords, VS (video studio)
    — Depends on ai/claude.js, utils/toast.js, optional Canvas API.
    — Risk: Relatively isolated but uses Canvas — test on mobile.

35. features/exchange.js
    — _exchTab, renderExchange, _exchSubmitListing, _exchOpenChat, _exchRegister
    — Depends on config/supabase-client.js, data/store.js, ai/claude.js, utils/toast.js.
    — Risk: Multi-step wizard with image uploads to Supabase Storage.
```

### Migration Strategy Notes

- **Phase 0 (this document):** Analysis only. No changes to index.html.
- **Phase 1:** Extract leaves 1–7 (pure utils, constants, toast, sanitize) as ESM modules. Add `<script type="module">` shim that imports them and re-exports to `window.*` for backward compatibility.
- **Phase 2:** Extract config (8–10). Test Supabase client init as isolated module.
- **Phase 3:** Extract data layer (11–14). This unlocks decoupling of all feature modules.
- **Phase 4:** Extract router, auth, then features one at a time (15–35).
- **Key invariant:** Until full migration, every extracted module must re-export its public API to `window.*` to avoid breaking the remaining inline code.
- **Blocking risk:** The `window._supabaseReady` promise pattern and the monkey-patching of `showPage`/`renderSettings`/`znTabTap` must be preserved or refactored before splitting those modules.
