// site-builder.js — lazy-loaded module for Site Builder
// Dependencies (stay in zn-leaves.js): ZNEshop, ZBUI, toast, lucide, isPluginActive, showPage, SUPABASE_URL, SUPABASE_KEY, SHOP_ID, ZN_JWT_SHOP_ID, PRODUCTS
// === SITE-BUILDER MODULE ===
function _zbHostResize(){
  try{
    var host = document.getElementById('zbHost');
    if(!host) return;
    var topbar = document.querySelector('.topbar');
    var toolbar = document.getElementById('zbToolbar');
    var hint = document.getElementById('zbMobileHint');
    var topH = topbar ? topbar.getBoundingClientRect().bottom : 60;
    var toolH = toolbar ? toolbar.offsetHeight : 52;
    var hintH = (hint && hint.offsetParent) ? hint.offsetHeight : 0;
    var navH = 60; // app bottom nav
    var safeBot = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0') || 0;
    var available = window.innerHeight - topH - toolH - hintH - navH - safeBot - 8;
    host.style.height = Math.max(320, available) + 'px';
  } catch(_){}
}

function renderSiteBuilder(){
  var c = document.getElementById('content');
  if(!c) return;
  var mobileHint = window.innerWidth <= 820
    ? '<div id="zbMobileHint" style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 14px;background:rgba(251,191,36,0.12);border-bottom:1px solid rgba(251,191,36,0.3);font-size:13px;color:var(--text-1)">'+
        '<span>💡 Ο Site Builder λειτουργεί καλύτερα από υπολογιστή.</span>'+
        '<button onclick="var h=document.getElementById(\'zbMobileHint\');if(h){h.remove();_zbHostResize();}" style="background:none;border:none;font-size:18px;cursor:pointer;color:var(--text-2);line-height:1;padding:0 4px;min-width:28px;min-height:28px" aria-label="Κλείσιμο">✕</button>'+
      '</div>'
    : '';
  c.innerHTML =
    '<div id="zbToolbar" style="display:flex;gap:8px;padding:10px 12px;background:var(--bg-1);border-bottom:1px solid var(--border);align-items:center;flex-wrap:wrap">'+
      '<button class="btn btn-primary" id="zbSyncBtn" style="min-height:40px"><i data-lucide="refresh-cw" size="15"></i> Συγχρονισμός προϊόντων</button>'+
      '<span id="zbSyncStatus" style="font-size:12px;color:var(--text-2)"></span>'+
    '</div>'+
    mobileHint +
    '<style>#zbHost .zbui-mobiletabs{padding-bottom:calc(60px + env(safe-area-inset-bottom,0px)) !important}</style>'+
    '<div id="zbHost" style="min-height:320px;border-radius:12px;overflow:hidden"></div>';
  try{
    ZBUI.demoProducts = function(){
      var src = (window.PRODUCTS||[]);
      return src.slice(0,48).map(function(p){
        return { id:p.id, name:p.name||'Προϊόν', price:String(p.price!=null?p.price:0), image:p.image||p.img||'', badge:p.badge||'', stock:(p.stock!=null?p.stock:null) };
      });
    };
  }catch(e){}
  ZBUI.onExit = function(){ try { if(typeof showPage==='function') showPage('dashboard'); } catch(e){} };
  ZBUI.mount(document.getElementById('zbHost'));
  _zbHostResize();
  var _zbResizeHandler = function(){ _zbHostResize(); };
  window.addEventListener('resize', _zbResizeHandler);
  window.addEventListener('orientationchange', _zbResizeHandler);
  // Clean up on exit
  var _zbOrigExit = ZBUI.onExit;
  ZBUI.onExit = function(){
    window.removeEventListener('resize', _zbResizeHandler);
    window.removeEventListener('orientationchange', _zbResizeHandler);
    try { _zbOrigExit(); } catch(e){}
  };
  setTimeout(function(){
    try{
      if(ZBUI.state && ZBUI.state.site){
        var feat = {
          supabaseUrl: (typeof SUPABASE_URL!=='undefined'?SUPABASE_URL:''),
          anonKey: (typeof SUPABASE_KEY!=='undefined'?SUPABASE_KEY:''),
          shopId: window.ZN_JWT_SHOP_ID || (typeof SHOP_ID!=='undefined'?SHOP_ID:''),
          ageMin: 18,
          storeName: (ZBUI.state.site.name||'Eshop')
        };
        ZBUI.state.site.ecom = Object.assign(ZBUI.state.site.ecom||{}, {
          checkoutEndpoint: feat.supabaseUrl + '/functions/v1/storefront-checkout',
          anonKey: feat.anonKey, shopId: feat.shopId
        });
        ZBUI.state.site.features = feat;  // περνά στο export (age gate, advisor, enhanced)
      }
    }catch(e){}
  }, 400);
  var sb1 = document.getElementById('zbSyncBtn');
  if(sb1) sb1.onclick = async function(){
    var st = document.getElementById('zbSyncStatus');
    sb1.disabled = true; if(st) st.textContent = '⏳ Συγχρονισμός...';
    try{
      var r = await ZNEshop.syncProducts({});
      if(st) st.textContent = r.ok ? ('✓ Συγχρονίστηκαν '+r.synced+' προϊόντα') : ('⚠️ '+(r.error||'σφάλμα'));
      if(typeof toast==='function') toast(r.ok?('✓ '+r.synced+' προϊόντα στο eshop'):'⚠️ Σφάλμα συγχρονισμού', r.ok?'success':'error');
    }catch(e){ if(st) st.textContent='⚠️ σφάλμα'; }
    sb1.disabled = false;
    try{ lucide.createIcons(); }catch(_){}
  };
  try{ lucide.createIcons(); }catch(_){}
}

// Expose all functions globally after lazy load
(function() {
  var toExport = [_zbHostResize, renderSiteBuilder];
  var i;
  for (i = 0; i < toExport.length; i++) {
    if (typeof toExport[i] === 'function') { window[toExport[i].name] = toExport[i]; }
  }
})();
export { renderSiteBuilder };
