// fleet-live.js — ZyroNex · Live Fleet Tracking (MapLibre GL JS + MapTiler)
// Scope: ONLY users whose role resolves to 'courier' (Διανομέας) or 'sales' (Εξωτερικός Πωλητής).
// Theme: DARK/LIGHT auto by Larisa sunrise/sunset (default), with manual user override (persisted).
// Deps (globals from zn-leaves/index.html): sb, SHOP_ID, USERS, toast, lucide, showPage
// ZyroNex rules: var at top-level (iOS Safari TDZ-safe); const/let only inside functions;
//                no inline onclick (addEventListener only); globals via window.* for safety.

var ZN_FLEET = { map:null, couriers:{}, ch:null, timer:null, follow:true, _lastDark:null };

// MapTiler key (public repo → ΠΡΟΣΘΕΣΕ Allowed-origins restriction στο MapTiler dashboard).
var ZN_MAPTILER_KEY = 'AorUxVk7o6wXBswkZCgD';
var ZN_LARISA = { lat:39.6390, lng:22.4191 };

/* ============================ MapLibre lazy loader ============================ */
function znEnsureMapLibre(){
  return new Promise(function(resolve, reject){
    if (window.maplibregl && window.maplibregl.Map) { resolve(window.maplibregl); return; }
    if (!document.getElementById('zn-maplibre-css')){
      var link = document.createElement('link');
      link.id = 'zn-maplibre-css'; link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }
    var existing = document.getElementById('zn-maplibre-js');
    if (existing){
      existing.addEventListener('load', function(){ resolve(window.maplibregl); });
      existing.addEventListener('error', function(){ reject(new Error('MapLibre load failed')); });
      if (window.maplibregl && window.maplibregl.Map) resolve(window.maplibregl);
      return;
    }
    var s = document.createElement('script');
    s.id = 'zn-maplibre-js';
    s.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
    s.onload = function(){ resolve(window.maplibregl); };
    s.onerror = function(){ reject(new Error('MapLibre load failed')); };
    document.head.appendChild(s);
  });
}

/* ============================ Theme: auto (sunrise/sunset) + manual override ============================ */
function _znStyleUrl(dark){
  var slug = dark ? 'streets-v2-dark' : 'streets-v2-light';
  return 'https://api.maptiler.com/maps/' + slug + '/style.json?key=' + ZN_MAPTILER_KEY;
}
// Standard Sunrise/Sunset algorithm (Almanac). Returns UTC Date objects (absolute time → tz-safe compare).
function _znSunTimes(date, lat, lng){
  var rad = Math.PI/180, deg = 180/Math.PI;
  var yStart = Date.UTC(date.getUTCFullYear(), 0, 0);
  var N = Math.floor((Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - yStart) / 86400000);
  var zenith = 90.833;
  function calc(isSunrise){
    var lngHour = lng / 15;
    var t = isSunrise ? N + ((6 - lngHour)/24) : N + ((18 - lngHour)/24);
    var M = (0.9856 * t) - 3.289;
    var L = M + (1.916*Math.sin(M*rad)) + (0.020*Math.sin(2*M*rad)) + 282.634; L = ((L%360)+360)%360;
    var RA = deg*Math.atan(0.91764*Math.tan(L*rad)); RA = ((RA%360)+360)%360;
    var Lq = Math.floor(L/90)*90, RAq = Math.floor(RA/90)*90; RA = (RA + (Lq - RAq)) / 15;
    var sinDec = 0.39782*Math.sin(L*rad), cosDec = Math.cos(Math.asin(sinDec));
    var cosH = (Math.cos(zenith*rad) - (sinDec*Math.sin(lat*rad))) / (cosDec*Math.cos(lat*rad));
    if (cosH > 1 || cosH < -1) return null; // πολικός day/night
    var H = isSunrise ? 360 - deg*Math.acos(cosH) : deg*Math.acos(cosH); H = H/15;
    var T = H + RA - (0.06571*t) - 6.622;
    var UT = (((T - lngHour) % 24) + 24) % 24;
    var hr = Math.floor(UT), mi = Math.floor((UT-hr)*60), se = Math.floor((((UT-hr)*60)-mi)*60);
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hr, mi, se));
  }
  return { sunrise: calc(true), sunset: calc(false) };
}
function _znIsDay(){
  var now = new Date();
  var s = _znSunTimes(now, ZN_LARISA.lat, ZN_LARISA.lng);
  if (!s.sunrise || !s.sunset) return true; // fallback: μέρα
  return now >= s.sunrise && now < s.sunset;
}
function _znGetTheme(){ try { return localStorage.getItem('zn_fleet_theme') || 'auto'; } catch(e){ return 'auto'; } }
function _znSetTheme(v){ try { localStorage.setItem('zn_fleet_theme', v); } catch(e){} }
function _znEffectiveDark(){
  var p = _znGetTheme();
  if (p === 'dark') return true;
  if (p === 'light') return false;
  return !_znIsDay(); // auto: σκούρο τη νύχτα, φωτεινό τη μέρα
}
function _znThemeIcon(){ var p=_znGetTheme(); return p==='dark'?'🌙':(p==='light'?'☀️':'🌓'); }
function _znThemeLabel(){ var p=_znGetTheme(); return p==='dark'?'Σκούρο':(p==='light'?'Φωτεινό':'Auto'); }

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

/* ============================ Smooth marker (rAF lerp + bearing) ============================ */
// MapLibre: setLngLat([lng,lat]). HTML markers ΕΠΙΖΟΥΝ του setStyle (δεν χρειάζονται re-add στο theme swap).
function ZNSmoothMarker(map, lng, lat, el){
  var maplibregl = window.maplibregl;
  var marker = new maplibregl.Marker({ element: el, anchor:'center' }).setLngLat([lng, lat]).addTo(map);
  var fLng=lng, fLat=lat, tLng=lng, tLat=lat, t0=0, dur=0, raf=null, bearing=0;
  function frame(now){
    var k = dur ? Math.min((now - t0)/dur, 1) : 1;
    var clng = fLng + (tLng - fLng)*k;
    var clat = fLat + (tLat - fLat)*k;
    marker.setLngLat([clng, clat]);
    var rot = el.querySelector('.zn-courier-rot');
    if (rot) rot.style.transform = 'rotate('+bearing+'deg)';
    if (ZN_FLEET.follow && ZN_FLEET.map && Object.keys(ZN_FLEET.couriers).length===1){
      ZN_FLEET.map.easeTo({ center:[clng, clat], duration:300 });
    }
    if (k < 1) raf = requestAnimationFrame(frame);
  }
  return {
    marker: marker, el: el,
    getLngLat: function(){ var ll = marker.getLngLat(); return [ll.lng, ll.lat]; },
    moveTo: function (nlng, nlat, headingDeg, ms){
      var cur = marker.getLngLat(); fLng=cur.lng; fLat=cur.lat; tLng=nlng; tLat=nlat;
      if (typeof headingDeg === 'number'){ bearing = headingDeg; }
      else { var dy=tLat-fLat, dx=tLng-fLng; if (dx||dy) bearing = (Math.atan2(dx, dy)*180/Math.PI + 360) % 360; }
      dur = ms || 1000; t0 = performance.now();
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    destroy: function (){ if (raf) cancelAnimationFrame(raf); try { marker.remove(); } catch(e){} }
  };
}

/* ============================ UI (full-screen map + glass panel) ============================ */
function znCourierPin(row){
  var u = _znUserById(row.courier_id);
  var kind = u ? _znRoleKind(u.role) : 'courier';
  var glyph = kind==='sales' ? '💼' : '🛵';
  return '<div class="zn-courier-rot">'+glyph+'</div>';
}
function _znMakeMarkerEl(row){
  var d = document.createElement('div');
  d.className = 'zn-courier-icon';
  d.innerHTML = znCourierPin(row);
  return d;
}

function znFleetLiveHTML(){
  return ''
  + '<div id="znFleetWrap">'
  +   '<div id="znMap"></div>'
  +   '<button id="znFlBack" class="zn-fl-fab zn-fl-back" type="button" aria-label="Πίσω"><i data-lucide="arrow-left"></i></button>'
  +   '<button id="znFlRecenter" class="zn-fl-fab zn-fl-recenter" type="button" aria-label="Κεντράρισμα"><i data-lucide="locate-fixed"></i></button>'
  +   '<button id="znFlTheme" class="zn-fl-fab zn-fl-theme" type="button" aria-label="Θέμα χάρτη">'
  +     '<span id="znFlThemeIcon">🌓</span><span id="znFlThemeLbl">Auto</span></button>'
  +   '<div id="znFlErr"></div>'
  +   '<div class="zn-fleet-panel" id="znFleetPanel">'
  +     '<div class="zn-fleet-head">🛵 Live Διανομές & Πωλητές</div>'
  +     '<div id="znFleetList" class="zn-fleet-list"></div>'
  +   '</div>'
  +   '<style>'
  +     '#znFleetWrap{position:fixed;inset:0;z-index:2000}'
  +     '#znMap{position:absolute;inset:0;width:100%;height:100%;z-index:1;background:#0b0e14}'
  +     '.zn-fl-fab{position:absolute;z-index:2100;height:46px;min-width:46px;border-radius:14px;border:1px solid rgba(255,255,255,.14);'
  +       'background:rgba(18,22,33,.72);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);color:#e8edf6;'
  +       'display:flex;align-items:center;justify-content:center;gap:6px;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.45);'
  +       'font-family:inherit;font-size:13px;font-weight:700;padding:0 10px}'
  +     '.zn-fl-fab:active{transform:scale(.94)}'
  +     '.zn-fl-back{top:calc(12px + env(safe-area-inset-top));left:12px;width:46px;padding:0}'
  +     '.zn-fl-recenter{top:calc(12px + env(safe-area-inset-top));right:12px;width:46px;padding:0}'
  +     '.zn-fl-theme{top:calc(70px + env(safe-area-inset-top));right:12px}'
  +     '.zn-fl-theme #znFlThemeIcon{font-size:18px;line-height:1}'
  +     '#znFlErr{display:none;position:absolute;left:12px;right:12px;top:calc(126px + env(safe-area-inset-top));z-index:2200;'
  +       'background:rgba(120,22,22,.94);color:#fff;font-size:12px;line-height:1.45;padding:10px 12px;border-radius:12px;'
  +       'border:1px solid rgba(255,255,255,.18);word-break:break-word}'
  +     '.zn-fleet-panel{position:absolute;left:12px;right:12px;bottom:12px;z-index:2050;max-height:46vh;overflow:auto;'
  +       'padding:16px;border-radius:22px;background:rgba(18,22,33,.62);'
  +       '-webkit-backdrop-filter:blur(22px) saturate(140%);backdrop-filter:blur(22px) saturate(140%);'
  +       'border:1px solid rgba(255,255,255,.10);box-shadow:0 12px 40px rgba(0,0,0,.5);'
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
  +     '.zn-courier-icon{filter:drop-shadow(0 4px 8px rgba(0,0,0,.5));will-change:transform}'
  +     '.zn-courier-rot{font-size:30px;line-height:42px;width:42px;text-align:center;transition:transform .3s ease-out}'
  +     '.maplibregl-ctrl-attrib{font-size:9px;background:rgba(11,14,20,.55)!important}'
  +     '.maplibregl-ctrl-attrib a{color:rgba(232,237,246,.6)!important}'
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
      if (c && c.sm && ZN_FLEET.map){ ZN_FLEET.follow = true; ZN_FLEET.map.easeTo({ center:c.sm.getLngLat(), zoom:16, duration:500 }); }
    });
  }
}

/* ============================ Main render ============================ */
async function renderFleetLive(){
  if (typeof window.ZN_FLEET_CLEANUP === 'function'){ try { window.ZN_FLEET_CLEANUP(); } catch(e){} }

  var maplibregl;
  try { maplibregl = await znEnsureMapLibre(); }
  catch(e){
    var c0 = document.getElementById('content');
    if (c0) c0.innerHTML = '<div class="card" style="padding:40px;text-align:center"><h2>🗺️ Live Διανομές</h2><p style="color:var(--danger)">Ο χάρτης δεν φόρτωσε (δίκτυο). Δοκίμασε refresh.</p></div>';
    return;
  }

  var content = document.getElementById('content');
  if (!content) return;
  // sentinel μέσα στο #content: όταν ο router αλλάξει σελίδα → cleanup του body-level overlay.
  content.innerHTML = '<div id="znFleetSentinel" style="display:none"></div>';

  // full-screen overlay ΚΑΤΕΥΘΕΙΑΝ στο body (έξω από containing blocks του app).
  var prev = document.getElementById('znFleetWrap');
  if (prev && prev.parentNode) prev.parentNode.removeChild(prev);
  var tmp = document.createElement('div');
  tmp.innerHTML = znFleetLiveHTML();
  var wrap = tmp.firstElementChild;
  document.body.appendChild(wrap);
  if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();

  // ρητές px διαστάσεις πριν το init (iOS-safe), μετά map.resize().
  function _setDims(){
    var w = window.innerWidth, h = window.innerHeight;
    var wEl = document.getElementById('znFleetWrap');
    var mEl = document.getElementById('znMap');
    if (wEl){ wEl.style.width = w + 'px'; wEl.style.height = h + 'px'; }
    if (mEl){ mEl.style.width = w + 'px'; mEl.style.height = h + 'px'; }
  }
  _setDims();

  var map = new maplibregl.Map({
    container: 'znMap',
    style: _znStyleUrl(_znEffectiveDark()),
    center: [ZN_LARISA.lng, ZN_LARISA.lat], // [lng,lat]
    zoom: 13,
    attributionControl: true,
    dragRotate: false,
    pitchWithRotate: false
  });
  ZN_FLEET.map = map; ZN_FLEET.couriers = {}; ZN_FLEET.follow = true; ZN_FLEET._lastDark = _znEffectiveDark();

  // Διάγνωση: αν το style δεν φορτώσει (403 key/origin ή 404 slug), δείξε το ΑΚΡΙΒΕΣ σφάλμα
  // και κάνε μία φορά fallback στο σίγουρο streets-v2 (baseline) ώστε να επιβεβαιωθεί ότι το key δουλεύει.
  function _znErr(msg){ var b = document.getElementById('znFlErr'); if (b){ b.style.display='block'; b.textContent = msg; } }
  function _znErrClear(){ var b = document.getElementById('znFlErr'); if (b){ b.style.display='none'; b.textContent=''; } }
  var _znFellBack = false;
  map.on('error', function(e){
    var err = e && e.error ? e.error : e;
    var msg = (err && (err.message || err.status)) ? (err.message || ('HTTP '+err.status)) : 'unknown';
    var styleNotReady = false;
    try { styleNotReady = !ZN_FLEET.map.isStyleLoaded(); } catch(_){ styleNotReady = true; }
    if (styleNotReady && !_znFellBack){
      _znFellBack = true;
      _znErr('Το dark/light style δεν φόρτωσε ('+msg+'). Δοκιμάζω baseline streets-v2…');
      try { map.setStyle('https://api.maptiler.com/maps/streets-v2/style.json?key=' + ZN_MAPTILER_KEY); } catch(_){}
    } else if (styleNotReady){
      _znErr('Σφάλμα χάρτη (key/origin;): ' + msg);
    }
  });
  map.on('styledata', function(){ if (ZN_FLEET.map && ZN_FLEET.map.isStyleLoaded()) _znErrClear(); });
  setTimeout(function(){
    try { if (ZN_FLEET.map && !ZN_FLEET.map.isStyleLoaded() && !_znFellBack){
      _znFellBack = true;
      _znErr('Το style δεν φόρτωσε σε 6s — δοκιμάζω baseline streets-v2…');
      map.setStyle('https://api.maptiler.com/maps/streets-v2/style.json?key=' + ZN_MAPTILER_KEY);
    } } catch(_){}
  }, 6000);

  function _resize(){ if (ZN_FLEET.map){ try { _setDims(); ZN_FLEET.map.resize(); } catch(e){} } }
  map.on('load', _resize);
  requestAnimationFrame(_resize);
  setTimeout(_resize, 200);
  setTimeout(_resize, 600);
  ZN_FLEET._onResize = function(){ _resize(); };
  window.addEventListener('resize', ZN_FLEET._onResize);
  if (window.ResizeObserver){
    ZN_FLEET._ro = new ResizeObserver(function(){ _resize(); });
    try { ZN_FLEET._ro.observe(document.getElementById('znMap')); } catch(e){}
  }

  map.on('dragstart', function(){ ZN_FLEET.follow = false; });

  var backBtn = document.getElementById('znFlBack');
  if (backBtn) backBtn.addEventListener('click', function(){
    if (typeof window.ZN_FLEET_CLEANUP === 'function') window.ZN_FLEET_CLEANUP();
    if (typeof window.showPage === 'function') window.showPage('dashboard');
  });
  var rc = document.getElementById('znFlRecenter');
  if (rc) rc.addEventListener('click', function(){ ZN_FLEET.follow = true; _znFit(); });

  // theme toggle: Auto → Σκούρο → Φωτεινό → Auto (persist + live setStyle)
  function _applyThemeUI(){
    var ic = document.getElementById('znFlThemeIcon'); if (ic) ic.textContent = _znThemeIcon();
    var lb = document.getElementById('znFlThemeLbl'); if (lb) lb.textContent = _znThemeLabel();
  }
  function _applyThemeStyle(){
    var dark = _znEffectiveDark();
    ZN_FLEET._lastDark = dark;
    if (ZN_FLEET.map){ try { ZN_FLEET.map.setStyle(_znStyleUrl(dark)); } catch(e){} }
  }
  _applyThemeUI();
  var themeBtn = document.getElementById('znFlTheme');
  if (themeBtn) themeBtn.addEventListener('click', function(){
    var cur = _znGetTheme();
    var next = cur==='auto' ? 'dark' : (cur==='dark' ? 'light' : 'auto');
    _znSetTheme(next); _applyThemeUI(); _applyThemeStyle();
  });

  function _znFit(){
    var ks = Object.keys(ZN_FLEET.couriers);
    if (!ks.length) return;
    if (ks.length === 1){ map.easeTo({ center: ZN_FLEET.couriers[ks[0]].sm.getLngLat(), zoom:15, duration:500 }); return; }
    var b = new maplibregl.LngLatBounds();
    ks.forEach(function(k){ b.extend(ZN_FLEET.couriers[k].sm.getLngLat()); });
    try { map.fitBounds(b, { padding:60, maxZoom:16, duration:500 }); } catch(e){}
  }

  function upsert(row){
    if (!row || row.lat==null || row.lng==null) return;
    if (!_znIsTracked(row.courier_id)) return;           // ΜΟΝΟ couriers + sales
    var k = row.shift_id || row.courier_id;
    if (!ZN_FLEET.couriers[k]){
      ZN_FLEET.couriers[k] = { sm: ZNSmoothMarker(map, row.lng, row.lat, _znMakeMarkerEl(row)) };
    }
    var hd = (typeof row.heading === 'number') ? row.heading : undefined;
    ZN_FLEET.couriers[k].sm.moveTo(row.lng, row.lat, hd, 1200);
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

  function subscribe(){
    return window.sb.channel('zn-fleet-live')
      .on('postgres_changes', { event:'*', schema:'public', table:'courier_locations' }, function(p){
        if (p && p.new) upsert(p.new);
      })
      .subscribe(function(status){
        if (status === 'SUBSCRIBED') loadInitial(); // reconnect-gap → re-fetch
      });
  }
  ZN_FLEET.ch = subscribe();

  ZN_FLEET.timer = setInterval(function(){
    if (!document.getElementById('znFleetSentinel')){ if (typeof window.ZN_FLEET_CLEANUP === 'function') window.ZN_FLEET_CLEANUP(); return; }
    // auto theme: άλλαξε dark/light στη δύση/ανατολή όσο ο χρήστης είναι σε Auto
    if (_znGetTheme()==='auto'){
      var d = _znEffectiveDark();
      if (d !== ZN_FLEET._lastDark){ ZN_FLEET._lastDark = d; try { map.setStyle(_znStyleUrl(d)); } catch(e){} }
    }
    var now = Date.now();
    Object.keys(ZN_FLEET.couriers).forEach(function(k){
      var c = ZN_FLEET.couriers[k];
      if (!c.data) return;
      var stale = (now - new Date(c.data.updated_at).getTime())/1000 > 30;
      if (c.sm && c.sm.el) c.sm.el.style.opacity = stale ? '0.45' : '1';
    });
    znRenderStops();
  }, 5000);

  window.ZN_FLEET_CLEANUP = function(){
    try { if (ZN_FLEET.ch) window.sb.removeChannel(ZN_FLEET.ch); } catch(e){}
    if (ZN_FLEET.timer){ clearInterval(ZN_FLEET.timer); ZN_FLEET.timer = null; }
    if (ZN_FLEET._onResize){ try { window.removeEventListener('resize', ZN_FLEET._onResize); } catch(e){} ZN_FLEET._onResize = null; }
    if (ZN_FLEET._ro){ try { ZN_FLEET._ro.disconnect(); } catch(e){} ZN_FLEET._ro = null; }
    try { Object.keys(ZN_FLEET.couriers).forEach(function(k){ ZN_FLEET.couriers[k].sm.destroy(); }); } catch(e){}
    ZN_FLEET.couriers = {};
    try { if (ZN_FLEET.map){ ZN_FLEET.map.remove(); ZN_FLEET.map = null; } } catch(e){}
    var w = document.getElementById('znFleetWrap'); if (w && w.parentNode) w.parentNode.removeChild(w);
    ZN_FLEET.ch = null;
  };
  window.addEventListener('beforeunload', function(){ if (typeof window.ZN_FLEET_CLEANUP === 'function') window.ZN_FLEET_CLEANUP(); });
}

/* ============================ Exports ============================ */
(function(){
  var fns = [renderFleetLive, znEnsureMapLibre, znFleetLiveHTML, znRenderStops,
             ZNSmoothMarker, znCourierPin, _znStyleUrl, _znSunTimes, _znIsDay,
             _znEffectiveDark, _znRoleKind, _znUserById, _znIsTracked, _znEsc];
  var i;
  for (i=0;i<fns.length;i++){ if (typeof fns[i]==='function') window[fns[i].name] = fns[i]; }
  window.ZN_FLEET = ZN_FLEET;
})();

export { renderFleetLive };
