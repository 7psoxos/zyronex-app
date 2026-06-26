// fleet-live.js — ZyroNex · Live Fleet Tracking (Multi-drop, Leaflet)
// Scope: ONLY users whose role resolves to 'courier' (Διανομέας) or 'sales' (Εξωτερικός Πωλητής).
// Deps (globals from zn-leaves/index.html): sb, SHOP_ID, USERS, toast, lucide, showPage
// ZyroNex rules: var at top-level (iOS Safari TDZ-safe); const/let only inside functions;
//                no inline onclick (addEventListener only); globals via window.* for safety.

var ZN_FLEET = { map:null, couriers:{}, ch:null, timer:null, follow:true, _tl:null };

/* ============================ Leaflet lazy loader ============================ */
function znEnsureLeaflet(){
  return new Promise(function(resolve, reject){
    if (window.L && window.L.map) { resolve(window.L); return; }
    if (!document.getElementById('zn-leaflet-css')){
      var link = document.createElement('link');
      link.id = 'zn-leaflet-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    var existing = document.getElementById('zn-leaflet-js');
    if (existing){
      existing.addEventListener('load', function(){ resolve(window.L); });
      existing.addEventListener('error', function(){ reject(new Error('Leaflet load failed')); });
      if (window.L && window.L.map) resolve(window.L);
      return;
    }
    var s = document.createElement('script');
    s.id = 'zn-leaflet-js';
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.onload = function(){ resolve(window.L); };
    s.onerror = function(){ reject(new Error('Leaflet load failed')); };
    document.head.appendChild(s);
  });
}

/* ============================ Role scoping helpers ============================ */
function _znRoleKind(role){
  var r = (role||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
  if (r.indexOf('εξωτερικ')>-1 || r.indexOf('πωλ')>-1 || r.indexOf('sales')>-1) return 'sales';
  if (r.indexOf('διανομ')>-1 || r.indexOf('courier')>-1) return 'courier';
  return 'other';
}
function _znUserById(id){
  var arr = window.USERS || [];
  for (var i=0;i<arr.length;i++){ if (arr[i].id===id) return arr[i]; }
  return null;
}
function _znIsTracked(courierId){
  var u = _znUserById(courierId);
  if (!u) return false;
  var k = _znRoleKind(u.role);
  return k==='courier' || k==='sales';
}
function _znEsc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ====================== Tile engine: load-balance + 429 failover ====================== */
// Stadia: domain-auth free (whitelist το domain στο dashboard → κανένα key στον κώδικα).
// CARTO: εντελώς keyless. MapTiler: μόνο με paid key (raster = paid) — προαιρετικό.
var ZN_TILE_PROVIDERS = [
  { id:'stadia', url:'https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png',
    opts:{ maxZoom:20, attribution:'&copy; Stadia Maps &copy; OpenMapTiles &copy; OSM' } },
  { id:'carto',  url:'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    opts:{ maxZoom:20, subdomains:'abcd', attribution:'&copy; CARTO &copy; OSM' } }
];

function _znTileLayerClass(){
  if (ZN_FLEET._tl) return ZN_FLEET._tl;
  var L = window.L;
  // 429-aware tile layer: fetch αντί για <img src> ώστε να διαβάζουμε το πραγματικό HTTP status.
  ZN_FLEET._tl = L.TileLayer.extend({
    createTile: function (coords, done){
      var img = document.createElement('img');
      var self = this;
      var url = this.getTileUrl(coords);
      var ctrl = (typeof AbortController!=='undefined') ? new AbortController() : null;
      img._abort = ctrl;
      fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(function (res){
        if (res.status === 429){ self.fire('ratelimit'); throw new Error('429'); }
        if (!res.ok) throw new Error('HTTP '+res.status);
        return res.blob();
      }).then(function (blob){
        var obj = URL.createObjectURL(blob);
        img.onload = function(){ URL.revokeObjectURL(obj); done(null, img); };
        img.src = obj;
      }).catch(function (err){ done(err, img); });
      return img;
    },
    _abortTile: function (tile){ if (tile && tile._abort){ try { tile._abort.abort(); } catch(e){} } }
  });
  return ZN_FLEET._tl;
}

function znMakeProviderManager(map){
  var L = window.L;
  var Cls = _znTileLayerClass();
  var failed = {};
  var layer = null;
  function mount(i){
    var p = ZN_TILE_PROVIDERS[i];
    if (layer) { try { map.removeLayer(layer); } catch(e){} }
    layer = new Cls(p.url, p.opts);
    var hits = 0;
    layer.on('ratelimit', function(){ hits++; if (hits>=3){ failed[p.id]=true; next(); } });
    layer.on('tileerror', function(){ hits++; if (hits>=8){ failed[p.id]=true; next(); } });
    layer.addTo(map);
  }
  function next(){
    var avail = ZN_TILE_PROVIDERS.map(function(_,i){ return i; })
      .filter(function(i){ return !failed[ZN_TILE_PROVIDERS[i].id]; });
    if (!avail.length){ failed = {}; avail = [0]; }
    mount(avail[0]);
  }
  mount(Math.floor(Math.random()*ZN_TILE_PROVIDERS.length)); // 50/50 load-balance ανά session
  return { current:function(){ return layer; } };
}

/* ============================ Smooth marker (rAF lerp + bearing) ============================ */
function ZNSmoothMarker(map, latlng, html){
  var L = window.L;
  var icon = L.divIcon({ className:'zn-courier-icon', html:html, iconSize:[42,42], iconAnchor:[21,21] });
  var marker = L.marker(latlng, { icon:icon, interactive:false }).addTo(map);
  var from = L.latLng(latlng), to = L.latLng(latlng), t0 = 0, dur = 0, raf = null, bearing = 0;
  function frame(now){
    var k = dur ? Math.min((now - t0)/dur, 1) : 1;
    var lat = from.lat + (to.lat - from.lat)*k;
    var lng = from.lng + (to.lng - from.lng)*k;
    marker.setLatLng([lat, lng]);
    var el = marker.getElement();
    if (el){ var rot = el.querySelector('.zn-courier-rot'); if (rot) rot.style.transform = 'rotate('+bearing+'deg)'; }
    // auto-follow μόνο όταν παρακολουθούμε έναν διανομέα και ο χρήστης δεν έχει σύρει τον χάρτη
    if (ZN_FLEET.follow && ZN_FLEET.map && Object.keys(ZN_FLEET.couriers).length===1){
      ZN_FLEET.map.panTo([lat, lng], { animate:true, duration:0.3, easeLinearity:0.5 });
    }
    if (k < 1) raf = requestAnimationFrame(frame);
  }
  return {
    marker: marker,
    moveTo: function (lat, lng, headingDeg, ms){
      from = marker.getLatLng(); to = L.latLng(lat, lng);
      if (typeof headingDeg === 'number'){ bearing = headingDeg; }
      else { var dy = to.lat-from.lat, dx = to.lng-from.lng; if (dx||dy) bearing = (Math.atan2(dx, dy)*180/Math.PI + 360) % 360; }
      dur = ms || 1000; t0 = performance.now();
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    destroy: function (){ if (raf) cancelAnimationFrame(raf); try { map.removeLayer(marker); } catch(e){} }
  };
}

/* ============================ UI (full-screen map + glass panel) ============================ */
function znCourierPin(row){
  var u = _znUserById(row.courier_id);
  var kind = u ? _znRoleKind(u.role) : 'courier';
  var glyph = kind==='sales' ? '💼' : '🛵';
  return '<div class="zn-courier-rot">'+glyph+'</div>';
}

function znFleetLiveHTML(){
  return ''
  + '<div id="znFleetWrap">'
  +   '<div id="znMap"></div>'
  +   '<button id="znFlBack" class="zn-fl-fab zn-fl-back" type="button" aria-label="Πίσω"><i data-lucide="arrow-left"></i></button>'
  +   '<button id="znFlRecenter" class="zn-fl-fab zn-fl-recenter" type="button" aria-label="Κεντράρισμα"><i data-lucide="locate-fixed"></i></button>'
  +   '<div class="zn-fleet-panel" id="znFleetPanel">'
  +     '<div class="zn-fleet-head">🛵 Live Διανομές & Πωλητές</div>'
  +     '<div id="znFleetList" class="zn-fleet-list"></div>'
  +   '</div>'
  +   '<style>'
  +     '#znFleetWrap{position:fixed;inset:0;z-index:1400}'
  +     '#znMap{position:absolute;inset:0;z-index:1;background:#0b0e14}'
  +     '.zn-fl-fab{position:absolute;z-index:1500;width:44px;height:44px;border-radius:14px;border:1px solid rgba(255,255,255,.12);'
  +       'background:rgba(18,22,33,.6);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:#e8edf6;'
  +       'display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.4)}'
  +     '.zn-fl-fab:active{transform:scale(.94)}'
  +     '.zn-fl-back{top:calc(12px + env(safe-area-inset-top));left:12px}'
  +     '.zn-fl-recenter{bottom:calc(50vh + 20px);right:12px}'
  +     '.zn-fleet-panel{position:absolute;left:12px;right:12px;bottom:12px;z-index:1450;max-height:46vh;overflow:auto;'
  +       'padding:16px;border-radius:22px;background:rgba(18,22,33,.55);'
  +       '-webkit-backdrop-filter:blur(22px) saturate(140%);backdrop-filter:blur(22px) saturate(140%);'
  +       'border:1px solid rgba(255,255,255,.10);box-shadow:0 12px 40px rgba(0,0,0,.45);'
  +       'padding-bottom:calc(16px + env(safe-area-inset-bottom))}'
  +     '.zn-fleet-head{font-weight:800;font-size:15px;color:#fff;margin-bottom:10px}'
  +     '.zn-fleet-empty{color:rgba(232,237,246,.6);font-size:13px;padding:10px 0}'
  +     '.zn-stop{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);cursor:pointer}'
  +     '.zn-stop:last-child{border-bottom:none}'
  +     '.zn-stop-dot{width:12px;height:12px;border-radius:50%;flex:none;background:#3b82f6}'
  +     '.zn-stop-active .zn-stop-dot{box-shadow:0 0 0 0 rgba(59,130,246,.6);animation:znPulse 1.6s infinite}'
  +     '.zn-stale .zn-stop-dot{background:#6b7280;animation:none}'
  +     '.zn-stop-main{flex:1;min-width:0}'
  +     '.zn-stop-name{font-weight:700;color:#fff;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'
  +     '.zn-stop-sub{font-size:11px;color:rgba(232,237,246,.6)}'
  +     '.zn-stop-go{color:rgba(232,237,246,.4);font-size:20px}'
  +     '.zn-courier-icon{filter:drop-shadow(0 4px 8px rgba(0,0,0,.5))}'
  +     '.zn-courier-rot{font-size:30px;line-height:42px;text-align:center;transition:transform .3s ease-out}'
  +     '@keyframes znPulse{70%{box-shadow:0 0 0 12px rgba(59,130,246,0)}100%{box-shadow:0 0 0 0 rgba(59,130,246,0)}}'
  +   '</style>'
  + '</div>';
}

function znRenderStops(){
  var list = document.getElementById('znFleetList');
  if (!list) return;
  var keys = Object.keys(ZN_FLEET.couriers).filter(function(k){
    return ZN_FLEET.couriers[k].data && _znIsTracked(ZN_FLEET.couriers[k].data.courier_id);
  });
  if (!keys.length){
    list.innerHTML = '<div class="zn-fleet-empty">Κανένας ενεργός διανομέας ή πωλητής αυτή τη στιγμή.</div>';
    return;
  }
  var now = Date.now();
  list.innerHTML = keys.map(function(k){
    var c = ZN_FLEET.couriers[k];
    var d = c.data;
    var u = _znUserById(d.courier_id);
    var name = u ? u.name : '—';
    var kind = u ? _znRoleKind(u.role) : 'courier';
    var age = (now - new Date(d.updated_at).getTime())/1000;
    var stale = age > 30;
    var badge = kind==='sales' ? 'Πωλητής' : 'Διανομέας';
    var sub = stale ? ('εκτός σήματος · '+Math.round(age)+'s') : 'live';
    return '<div class="zn-stop '+(stale?'zn-stale':'zn-stop-active')+'" data-cid="'+_znEsc(k)+'">'
      + '<span class="zn-stop-dot"></span>'
      + '<div class="zn-stop-main"><div class="zn-stop-name">'+_znEsc(name)+'</div>'
      + '<div class="zn-stop-sub">'+badge+' · '+sub+'</div></div>'
      + '<div class="zn-stop-go">&rsaquo;</div></div>';
  }).join('');
  var nodes = list.querySelectorAll('.zn-stop');
  for (var i=0;i<nodes.length;i++){
    nodes[i].addEventListener('click', function(){
      var k = this.getAttribute('data-cid');
      var c = ZN_FLEET.couriers[k];
      if (c && c.sm && ZN_FLEET.map){ ZN_FLEET.follow = true; ZN_FLEET.map.setView(c.sm.marker.getLatLng(), 16, { animate:true }); }
    });
  }
}

/* ============================ Main render ============================ */
async function renderFleetLive(){
  // idempotent re-entry: καθάρισε τυχόν προηγούμενο instance (channels/rAF/markers)
  if (typeof window.ZN_FLEET_CLEANUP === 'function'){ try { window.ZN_FLEET_CLEANUP(); } catch(e){} }

  var L;
  try { L = await znEnsureLeaflet(); }
  catch(e){
    var c0 = document.getElementById('content');
    if (c0) c0.innerHTML = '<div class="card" style="padding:40px;text-align:center"><h2>🗺️ Live Διανομές</h2><p style="color:var(--danger)">Ο χάρτης δεν φόρτωσε (δίκτυο). Δοκίμασε refresh.</p></div>';
    return;
  }

  var content = document.getElementById('content');
  if (!content) return;
  content.innerHTML = znFleetLiveHTML();
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();

  var map = L.map('znMap', { zoomControl:false, attributionControl:true }).setView([39.6390, 22.4191], 14); // Λάρισα default
  L.control.zoom({ position:'topright' }).addTo(map);
  ZN_FLEET.map = map; ZN_FLEET.couriers = {}; ZN_FLEET.follow = true;
  znMakeProviderManager(map);

  map.on('dragstart', function(){ ZN_FLEET.follow = false; }); // χειροκίνητο pan → σταμάτα follow

  var backBtn = document.getElementById('znFlBack');
  if (backBtn) backBtn.addEventListener('click', function(){
    if (typeof window.ZN_FLEET_CLEANUP === 'function') window.ZN_FLEET_CLEANUP();
    if (typeof window.showPage === 'function') window.showPage('dashboard');
  });
  var rc = document.getElementById('znFlRecenter');
  if (rc) rc.addEventListener('click', function(){ ZN_FLEET.follow = true; _znFit(); });

  function _znFit(){
    var ks = Object.keys(ZN_FLEET.couriers);
    if (!ks.length) return;
    if (ks.length === 1){ map.setView(ZN_FLEET.couriers[ks[0]].sm.marker.getLatLng(), 15, { animate:true }); return; }
    var pts = ks.map(function(k){ return ZN_FLEET.couriers[k].sm.marker.getLatLng(); });
    map.fitBounds(L.latLngBounds(pts).pad(0.25));
  }

  function upsert(row){
    if (!row || row.lat==null || row.lng==null) return;
    if (!_znIsTracked(row.courier_id)) return;           // ΜΟΝΟ couriers + sales
    var k = row.shift_id || row.courier_id;
    if (!ZN_FLEET.couriers[k]){
      ZN_FLEET.couriers[k] = { sm: ZNSmoothMarker(map, [row.lat, row.lng], znCourierPin(row)) };
    }
    var hd = (typeof row.heading === 'number') ? row.heading : undefined;
    ZN_FLEET.couriers[k].sm.moveTo(row.lat, row.lng, hd, 1200);
    ZN_FLEET.couriers[k].data = row;
    znRenderStops();
  }

  async function loadInitial(){
    try {
      var res = await window.sb.from('courier_locations').select('*');
      if (res && res.data){ res.data.forEach(upsert); _znFit(); }
    } catch(e){}
  }
  await loadInitial();

  // Realtime: Postgres Changes baseline (απλό· για κλίμακα → Broadcast-from-DB, ίδιος upsert)
  function subscribe(){
    return window.sb.channel('zn-fleet-live')
      .on('postgres_changes', { event:'*', schema:'public', table:'courier_locations' }, function(p){
        if (p && p.new) upsert(p.new);
      })
      .subscribe(function(status){
        // reconnect-gap: το Postgres Changes δεν εγγυάται delivery· κάνε re-fetch σε κάθε (re)subscribe
        if (status === 'SUBSCRIBED') loadInitial();
      });
  }
  ZN_FLEET.ch = subscribe();

  // stale-detection + αυτο-καθαρισμός όταν ο χρήστης φύγει από τη σελίδα
  ZN_FLEET.timer = setInterval(function(){
    if (!document.getElementById('znMap')){ if (typeof window.ZN_FLEET_CLEANUP === 'function') window.ZN_FLEET_CLEANUP(); return; }
    var now = Date.now();
    Object.keys(ZN_FLEET.couriers).forEach(function(k){
      var c = ZN_FLEET.couriers[k];
      if (!c.data) return;
      var stale = (now - new Date(c.data.updated_at).getTime())/1000 > 30;
      var el = c.sm.marker.getElement();
      if (el) el.style.opacity = stale ? '0.45' : '1';
    });
    znRenderStops();
  }, 5000);

  // cleanup (removeChannel είναι κρίσιμο: leaked channels = #1 αιτία connection limits)
  window.ZN_FLEET_CLEANUP = function(){
    try { if (ZN_FLEET.ch) window.sb.removeChannel(ZN_FLEET.ch); } catch(e){}
    if (ZN_FLEET.timer){ clearInterval(ZN_FLEET.timer); ZN_FLEET.timer = null; }
    try { Object.keys(ZN_FLEET.couriers).forEach(function(k){ ZN_FLEET.couriers[k].sm.destroy(); }); } catch(e){}
    ZN_FLEET.couriers = {};
    try { if (ZN_FLEET.map){ ZN_FLEET.map.remove(); ZN_FLEET.map = null; } } catch(e){}
    ZN_FLEET.ch = null;
  };
  window.addEventListener('beforeunload', function(){ if (typeof window.ZN_FLEET_CLEANUP === 'function') window.ZN_FLEET_CLEANUP(); });
}

/* ============================ Exports ============================ */
(function(){
  var fns = [renderFleetLive, znEnsureLeaflet, znFleetLiveHTML, znRenderStops,
             znMakeProviderManager, ZNSmoothMarker, znCourierPin,
             _znRoleKind, _znUserById, _znIsTracked, _znEsc, _znTileLayerClass];
  var i;
  for (i=0;i<fns.length;i++){ if (typeof fns[i]==='function') window[fns[i].name] = fns[i]; }
  window.ZN_FLEET = ZN_FLEET;
  window.ZN_TILE_PROVIDERS = ZN_TILE_PROVIDERS;
})();

export { renderFleetLive };
