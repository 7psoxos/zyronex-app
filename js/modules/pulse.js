// pulse.js — lazy-loaded module for ZyroNex Pulse (Creative Studio)
// Dependencies (stay in zn-leaves.js): askClaude, toast, lucide, _escHtml
/* =============================== PULSE MODULE =============================== */
/* ═══════════════════════════════════════════════════════
   ZYRONIEX PULSE MODULE
   Tab 1: Photo Studio  (BG removal via @imgly CDN)
   Tab 2: Post Creator  (canvas-based post builder)
   Tab 3: Content Engine (SEO posts, keywords, captions)
═══════════════════════════════════════════════════════ */

/* ── State ── */
var PULSE = {
  view: 'home',            // home | studio | postcreator | content | video  /* pulseLauncherP1 */
  tab: 'studio',           // studio | postcreator | content
  // Photo Studio
  originalFile: null,
  originalDataUrl: null,
  processedDataUrl: null,
  processingBG: false,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  // Post Creator
  postImage: null,
  postText: '',
  postSubtext: '',
  postBg: '#1a1a2e',
  postTextColor: '#ffffff',
  postFormat: 'square',    // square|portrait|landscape|story
  // Text positions (0..1 relative to canvas)
  mainTextX: 0.5,
  mainTextY: 0.82,
  subTextX: 0.5,
  subTextY: 0.91,
  // Content Engine
  ceLoading: false,
  ceResults: null,
  ceKeywords: null,
};

/* ── Render main page ── */
var PULSE_TILES = [
  { id:'studio',      icon:'📸', label:'Photo Studio',   desc:'Αφαίρεση φόντου, ρυθμίσεις', color:'#6366f1' },
  { id:'postcreator', icon:'🎨', label:'Post Creator',   desc:'Δημιουργία post για social', color:'#f59e0b' },
  { id:'content',     icon:'✍️', label:'Content Engine', desc:'SEO, captions, hashtags', color:'#8b5cf6' },
  { id:'video',       icon:'🎬', label:'Video Studio',   desc:'Trim, crop, text, export', color:'#34d399' }
];

function _pulseBannerHTML() {
  return '<div class="pulse-header">' +
    '<div class="pulse-header-icon">✨</div>' +
    '<div class="pulse-header-text">' +
      '<h2>ZyroNex Pulse — Creative Studio</h2>' +
      '<p>Επεξεργασία φωτογραφιών, δημιουργία post & στοχευμένο content για social media</p>' +
    '</div>' +
  '</div>';
}

function _pulseHomeGridHTML() {
  return '<div class="sg-grid">' +
    PULSE_TILES.map(function(t) {
      return '<div class="sg-tile" onclick="pulseOpen(\'' + t.id + '\')" style="border-top:3px solid ' + t.color + '">' +
        '<div class="sg-icon">' + t.icon + '</div>' +
        '<div class="sg-label">' + t.label + '</div>' +
        '<div class="sg-desc">' + t.desc + '</div>' +
      '</div>';
    }).join('') +
  '</div>';
}

function renderPulse() {
  var c = document.getElementById('content');
  if (!c) return;
  if (!PULSE.view) PULSE.view = 'home';
  if (PULSE.view === 'home') {
    c.innerHTML = '<div class="pulse-page">' + _pulseBannerHTML() + _pulseHomeGridHTML() + '</div>';
    if (typeof lucide !== 'undefined') lucide.createIcons();
    return;
  }
  PULSE.tab = PULSE.view;
  c.innerHTML = '<div class="pulse-page">' + _pulseBannerHTML() +
    '<button class="pulse-back" onclick="pulseHome()" style="display:inline-flex;align-items:center;gap:6px;margin:4px 0 12px;background:rgba(255,255,255,.06);color:var(--text-1,#cdd6f4);border:1px solid rgba(255,255,255,.10);border-radius:10px;padding:9px 14px;font-size:14px;font-weight:700;cursor:pointer">← Πίσω στα εργαλεία</button>' +
    '<div id="pulseTabContent" style="overflow-x:hidden;max-width:100%"></div>' +
  '</div>';
  _pulseRenderTab();
}

function pulseOpen(id) { PULSE.view = id; PULSE.tab = id; renderPulse(); }
function pulseHome() { PULSE.view = 'home'; renderPulse(); }

function pulseSetTab(t) { pulseOpen(t); }

function _pulseRenderTab() {
  var wrap = document.getElementById('pulseTabContent');
  if (!wrap) return;
  if (PULSE.tab === 'studio')      wrap.innerHTML = _pulseStudioHTML();
  else if (PULSE.tab === 'postcreator') wrap.innerHTML = _pulsePostCreatorHTML();
  else if (PULSE.tab === 'video')  wrap.innerHTML = _pulseVideoStudioHTML();
  else                             wrap.innerHTML = _pulseContentEngineHTML();

  // Post-render bindings
  if (PULSE.tab === 'studio') _pulseStudioBind();
  else if (PULSE.tab === 'postcreator') _pulsePostCreatorBind();
  else if (PULSE.tab === 'video') {} // no bind needed
  else _pulseContentEngineBind();
}

/* ══════════════════════════════════════════════
   TAB 1 — PHOTO STUDIO
══════════════════════════════════════════════ */
function _pulseStudioHTML() {
  if (!PULSE.originalDataUrl) {
    return '<div class="ps-dropzone" id="psDropzone" onclick="document.getElementById(\'psFileIn\').click()">' +
      '<input type="file" id="psFileIn" accept="image/*" style="display:none" onchange="psLoadFile(this)">' +
      '<div class="ps-dropzone-icon">🖼️</div>' +
      '<p>Σύρε φωτογραφία εδώ ή κλίκαρε για επιλογή</p>' +
      '<small>JPG, PNG, WEBP — έως 20MB</small>' +
    '</div>';
  }

  return '<div class="ps-workspace">' +
    // Canvas area
    '<div>' +
      '<div class="ps-canvas-wrap" id="psCanvasWrap">' +
        '<img id="psPreviewImg" src="' + (PULSE.processedDataUrl || PULSE.originalDataUrl) + '" style="max-width:100%;max-height:480px;border-radius:8px;filter:brightness('+PULSE.brightness+'%) contrast('+PULSE.contrast+'%) saturate('+PULSE.saturation+'%)">' +
        (PULSE.processingBG ? '<div class="ps-loading-overlay"><div class="ps-spinner"></div><span style="color:#e2e8f0;font-size:13px">Αφαίρεση φόντου...</span></div>' : '') +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap">' +
        '<button class="ps-btn primary" style="flex:1;min-width:140px" onclick="psSendToPostCreator()">🎨 Στείλε στο Post Creator</button>' +
        '<button class="ps-btn" style="flex:1;min-width:120px" onclick="psDownload()">⬇️ Κατέβασε</button>' +
        '<button class="ps-btn" style="flex:1;min-width:100px" onclick="psReset()">🔄 Νέα Φωτό</button>' +
      '</div>' +
    '</div>' +
    // Tools panel
    '<div class="ps-tools">' +
      // BG Removal
      '<div class="ps-tool-group">' +
        '<div class="ps-tool-group-title">🪄 Αφαίρεση Φόντου</div>' +
        '<button class="ps-btn primary" id="psBgBtn" onclick="psRemoveBG()" ' + (PULSE.processingBG?'disabled':'') + '>✂️ Αφαίρεση Φόντου</button>' +
        (PULSE.processedDataUrl ? '<button class="ps-btn" style="margin-top:8px" onclick="psRevertOriginal()">↩️ Επαναφορά Πρωτοτύπου</button>' : '') +
        '<p style="font-size:11px;color:var(--text-2);margin:8px 0 0">Εκτελείται 100% στον browser σου — χωρίς upload</p>' +
      '</div>' +
      // Adjustments
      '<div class="ps-tool-group">' +
        '<div class="ps-tool-group-title">🎚️ Ρυθμίσεις</div>' +
        '<div class="ps-slider-row">' +
          '<div class="ps-slider-label"><span>Φωτεινότητα</span><span id="slBrVal">'+PULSE.brightness+'%</span></div>' +
          '<input type="range" class="ps-slider" id="slBr" min="50" max="200" value="'+PULSE.brightness+'" oninput="psAdjust(\'brightness\',this.value)">' +
        '</div>' +
        '<div class="ps-slider-row">' +
          '<div class="ps-slider-label"><span>Αντίθεση</span><span id="slCoVal">'+PULSE.contrast+'%</span></div>' +
          '<input type="range" class="ps-slider" id="slCo" min="50" max="200" value="'+PULSE.contrast+'" oninput="psAdjust(\'contrast\',this.value)">' +
        '</div>' +
        '<div class="ps-slider-row">' +
          '<div class="ps-slider-label"><span>Κορεσμός</span><span id="slSaVal">'+PULSE.saturation+'%</span></div>' +
          '<input type="range" class="ps-slider" id="slSa" min="0" max="200" value="'+PULSE.saturation+'" oninput="psAdjust(\'saturation\',this.value)">' +
        '</div>' +
        '<button class="ps-btn" style="margin-top:4px" onclick="psResetAdjustments()">↩️ Reset</button>' +
      '</div>' +
      // Export formats
      '<div class="ps-tool-group">' +
        '<div class="ps-tool-group-title">📐 Format Export</div>' +
        '<div class="ps-format-grid">' +
          '<button class="ps-format-btn" onclick="psExportFormat(1080,1080,this)">📷 1:1<br><small>Instagram</small></button>' +
          '<button class="ps-format-btn" onclick="psExportFormat(1080,1920,this)">📱 9:16<br><small>Story/Reel</small></button>' +
          '<button class="ps-format-btn" onclick="psExportFormat(1200,630,this)">🖥️ 1.9:1<br><small>Facebook</small></button>' +
          '<button class="ps-format-btn" onclick="psExportFormat(1280,720,this)">🎬 16:9<br><small>YouTube</small></button>' +
        '</div>' +
      '</div>' +
    '</div>' +
  '</div>';
}

function _pulseStudioBind() {
  var dz = document.getElementById('psDropzone');
  if (dz) {
    dz.addEventListener('dragover', function(e) { e.preventDefault(); dz.classList.add('dragover'); });
    dz.addEventListener('dragleave', function() { dz.classList.remove('dragover'); });
    dz.addEventListener('drop', function(e) {
      e.preventDefault(); dz.classList.remove('dragover');
      var f = e.dataTransfer.files[0];
      if (f && f.type.startsWith('image/')) psLoadFileObj(f);
    });
  }
}

function psLoadFile(input) {
  if (input.files && input.files[0]) psLoadFileObj(input.files[0]);
}

function psLoadFileObj(file) {
  PULSE.originalFile = file;
  var reader = new FileReader();
  reader.onload = function(e) {
    PULSE.originalDataUrl = e.target.result;
    PULSE.processedDataUrl = null;
    PULSE.brightness = 100; PULSE.contrast = 100; PULSE.saturation = 100;
    _pulseRenderTab();
  };
  reader.readAsDataURL(file);
}

function psAdjust(type, val) {
  PULSE[type] = parseInt(val);
  var img = document.getElementById('psPreviewImg');
  if (img) img.style.filter = 'brightness('+PULSE.brightness+'%) contrast('+PULSE.contrast+'%) saturate('+PULSE.saturation+'%)';
  var labelId = {brightness:'slBrVal', contrast:'slCoVal', saturation:'slSaVal'}[type];
  var label = document.getElementById(labelId);
  if (label) label.textContent = val + '%';
}

function psResetAdjustments() {
  PULSE.brightness = 100; PULSE.contrast = 100; PULSE.saturation = 100;
  _pulseRenderTab();
}

function psRevertOriginal() {
  PULSE.processedDataUrl = null;
  _pulseRenderTab();
}

function psReset() {
  PULSE.originalFile = null; PULSE.originalDataUrl = null; PULSE.processedDataUrl = null;
  PULSE.brightness = 100; PULSE.contrast = 100; PULSE.saturation = 100;
  _pulseRenderTab();
}

async function psRemoveBG() {
  if (!PULSE.originalDataUrl || PULSE.processingBG) return;
  PULSE.processingBG = true;
  _pulseRenderTab();

  try {
    // Use dynamic ESM import — works in modern browsers without script tag
    if (!window._bgRemoveFn) {
      if(typeof toast==='function') toast('⏳ Φόρτωση μοντέλου (~40MB, μία φορά)...', 'info');
      var mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm');
      window._bgRemoveFn = mod.removeBackground;
    }

    if (!window._bgRemoveFn) throw new Error('Δεν φορτώθηκε το μοντέλο');

    // Convert dataURL to Blob
    var res = await fetch(PULSE.originalDataUrl);
    var blob = await res.blob();

    var resultBlob = await window._bgRemoveFn(blob, {
      model: 'small',
      output: { format: 'image/png' },
      progress: function(key, cur, total) {
        // optional progress — ignore
      }
    });

    var reader = new FileReader();
    reader.onload = function(e) {
      PULSE.processedDataUrl = e.target.result;
      PULSE.processingBG = false;
      _pulseRenderTab();
      if(typeof toast==='function') toast('✅ Φόντο αφαιρέθηκε!', 'success');
    };
    reader.readAsDataURL(resultBlob);

  } catch (err) {
    PULSE.processingBG = false;
    _pulseRenderTab();
    if(typeof toast==='function') toast('⚠️ Σφάλμα αφαίρεσης φόντου: ' + (err.message||String(err)), 'danger');
  }
}

function psDownload() {
  var src = PULSE.processedDataUrl || PULSE.originalDataUrl;
  if (!src) return;

  // Apply filters via canvas
  var img = new Image();
  img.onload = function() {
    var cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    var ctx = cv.getContext('2d');
    ctx.filter = 'brightness('+PULSE.brightness+'%) contrast('+PULSE.contrast+'%) saturate('+PULSE.saturation+'%)';
    ctx.drawImage(img, 0, 0);
    var a = document.createElement('a');
    a.download = 'zyroniex-pulse-' + Date.now() + '.png';
    a.href = cv.toDataURL('image/png');
    a.click();
  };
  img.src = src;
}

function psExportFormat(w, h, btn) {
  var src = PULSE.processedDataUrl || PULSE.originalDataUrl;
  if (!src) { if(typeof toast==='function') toast('Φόρτωσε φωτογραφία πρώτα', 'warning'); return; }
  document.querySelectorAll('.ps-format-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');

  var img = new Image();
  img.onload = function() {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    // Cover crop
    var scale = Math.max(w / img.width, h / img.height);
    var sw = img.width * scale, sh = img.height * scale;
    var sx = (w - sw) / 2, sy = (h - sh) / 2;
    ctx.filter = 'brightness('+PULSE.brightness+'%) contrast('+PULSE.contrast+'%) saturate('+PULSE.saturation+'%)';
    ctx.drawImage(img, sx, sy, sw, sh);
    var a = document.createElement('a');
    a.download = 'zyroniex-pulse-' + w + 'x' + h + '.jpg';
    a.href = cv.toDataURL('image/jpeg', 0.92);
    a.click();
  };
  img.src = src;
}

function psSendToPostCreator() {
  PULSE.postImage = PULSE.processedDataUrl || PULSE.originalDataUrl;
  pulseOpen('postcreator');
  if(typeof toast==='function') toast('✅ Φωτογραφία στάλθηκε στο Post Creator!', 'success');
}

/* ══════════════════════════════════════════════
   TAB 2 — POST CREATOR
══════════════════════════════════════════════ */
var PC_FORMATS = {
  square:    { w: 1080, h: 1080, label: 'Instagram 1:1' },
  portrait:  { w: 1080, h: 1350, label: 'Instagram 4:5' },
  story:     { w: 1080, h: 1920, label: 'Story 9:16' },
  landscape: { w: 1200, h: 630,  label: 'Facebook 1.9:1' }
};
var PC_COLORS = ['#1a1a2e','#16213e','#0f3460','#e94560','#f97316','#10b981','#8b5cf6','#ec4899','#06b6d4','#1e293b','#000000','#ffffff'];
var PC_FONTS = ['Inter, sans-serif', 'Georgia, serif', 'Courier New, monospace', '"Arial Black", sans-serif'];

function _pulsePostCreatorHTML() {
  var fmt = PC_FORMATS[PULSE.postFormat];
  // Responsive preview: max width = screen width minus padding (~320px safe)
  // Max height = 420px so it fits on mobile screen
  var maxW = 320, maxH = 420;
  var scale = Math.min(maxW / fmt.w, maxH / fmt.h);
  var pw = Math.round(fmt.w * scale), ph = Math.round(fmt.h * scale);

  return '<div class="pc-layout">' +
    // Preview canvas
    '<div class="pc-canvas-area">' +
      '<div style="padding:10px 14px 0;display:flex;align-items:center;justify-content:space-between">' +
        '<span style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:.6px">Προεπισκόπηση Post</span>' +
        '<span style="font-size:11px;color:#f97316;font-weight:600;background:rgba(249,115,22,.1);border:1px solid rgba(249,115,22,.2);border-radius:5px;padding:2px 8px">' + fmt.label + ' · ' + fmt.w + '×' + fmt.h + '</span>' +
      '</div>' +
      '<div class="pc-preview-wrap" id="pcPreviewWrap" style="height:'+(ph+20)+'px;position:relative">' +
        '<canvas id="pcCanvas" width="'+pw+'" height="'+ph+'" style="border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,.5);touch-action:none"></canvas>' +
        '<div id="pcEmptyHint" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;pointer-events:none;opacity:0.5">' +
          '<div style="font-size:36px">🎨</div>' +
          '<div style="font-size:12px;color:#e2e8f0;text-align:center">Γράψε τίτλο ή πρόσθεσε<br>φωτογραφία για preview</div>' +
        '</div>' +
        '<div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.6);color:#f97316;font-size:10px;padding:3px 10px;border-radius:20px;pointer-events:none;white-space:nowrap">✋ Σύρε το κείμενο όπου θέλεις</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;padding:10px 14px 14px;flex-wrap:wrap">' +
        '<button class="ps-btn primary" style="flex:1;min-width:140px" onclick="pcDownload()">⬇️ Κατέβασε Post</button>' +
        '<button class="ps-btn" style="flex:1;min-width:120px" onclick="pcCopyToStudio()">📸 Από Studio</button>' +
      '</div>' +
    '</div>' +
    // Controls
    '<div class="pc-controls">' +
      // Format
      '<div class="pc-section">' +
        '<div class="pc-section-title">📐 Format</div>' +
        '<div class="ps-format-grid">' +
          Object.keys(PC_FORMATS).map(function(k) {
            return '<button class="ps-format-btn'+(PULSE.postFormat===k?' active':'')+'" onclick="pcSetFormat(\''+k+'\')">'+PC_FORMATS[k].label+'</button>';
          }).join('') +
        '</div>' +
      '</div>' +
      // Text
      '<div class="pc-section">' +
        '<div class="pc-section-title">✍️ Κείμενο</div>' +
        '<textarea class="pc-input" id="pcMainText" rows="2" placeholder="Κύριος τίτλος..." oninput="PULSE.postText=this.value;pcDraw()">'+PULSE.postText+'</textarea>' +
        '<textarea class="pc-input" id="pcSubText" rows="2" placeholder="Υποτίτλος / περιγραφή..." style="margin-top:8px" oninput="PULSE.postSubtext=this.value;pcDraw()">'+PULSE.postSubtext+'</textarea>' +
      '</div>' +
      // Background
      '<div class="pc-section">' +
        '<div class="pc-section-title">🎨 Φόντο & Χρώματα</div>' +
        '<div style="margin-bottom:8px"><span class="ce-label">Φόντο</span>' +
        '<div class="pc-color-row" id="pcBgColors">' +
          PC_COLORS.map(function(col) {
            return '<div class="pc-color-swatch'+(PULSE.postBg===col?' sel':'')+'" style="background:'+col+'" onclick="pcSetBg(\''+col+'\')" title="'+col+'"></div>';
          }).join('') +
        '</div></div>' +
        '<div><span class="ce-label">Κείμενο</span>' +
        '<div class="pc-color-row" id="pcTextColors">' +
          ['#ffffff','#f8fafc','#e2e8f0','#1e293b','#f97316','#10b981','#ec4899','#8b5cf6','#06b6d4','#fbbf24','#ef4444','#000000'].map(function(col) {
            return '<div class="pc-color-swatch'+(PULSE.postTextColor===col?' sel':'')+'" style="background:'+col+'" onclick="pcSetTextColor(\''+col+'\')" title="'+col+'"></div>';
          }).join('') +
        '</div></div>' +
      '</div>' +
      // Image upload
      '<div class="pc-section">' +
        '<div class="pc-section-title">🖼️ Φωτογραφία</div>' +
        (PULSE.postImage
          ? '<img src="'+PULSE.postImage+'" style="width:100%;border-radius:8px;max-height:100px;object-fit:cover;margin-bottom:8px">' +
            '<button class="ps-btn" onclick="PULSE.postImage=null;pcDraw();_pulseRenderTab()">🗑 Αφαίρεση</button>'
          : '<button class="ps-btn" onclick="document.getElementById(\'pcImgIn\').click()">➕ Πρόσθεσε Φωτό</button>') +
        '<input type="file" id="pcImgIn" accept="image/*" style="display:none" onchange="pcLoadImg(this)">' +
      '</div>' +
    '</div>' +
  '</div>';
}

function _pulsePostCreatorBind() {
  setTimeout(function(){ pcDraw(); _pcInitDrag(); }, 50);
}

function pcSetFormat(f) {
  PULSE.postFormat = f;
  _pulseRenderTab();
}

function pcSetBg(c) {
  PULSE.postBg = c;
  document.querySelectorAll('#pcBgColors .pc-color-swatch').forEach(function(s) {
    s.classList.toggle('sel', s.title === c);
  });
  pcDraw();
}

function pcSetTextColor(c) {
  PULSE.postTextColor = c;
  document.querySelectorAll('#pcTextColors .pc-color-swatch').forEach(function(s) {
    s.classList.toggle('sel', s.title === c);
  });
  pcDraw();
}

function pcLoadImg(input) {
  if (!input.files || !input.files[0]) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    PULSE.postImage = e.target.result;
    _pulseRenderTab();
  };
  reader.readAsDataURL(input.files[0]);
}

function pcCopyToStudio() {
  if (PULSE.processedDataUrl || PULSE.originalDataUrl) {
    PULSE.postImage = PULSE.processedDataUrl || PULSE.originalDataUrl;
    _pulseRenderTab();
    if(typeof toast==='function') toast('✅ Φωτό από Photo Studio!', 'success');
  } else {
    if(typeof toast==='function') toast('Ανέβασε φωτό στο Photo Studio πρώτα', 'warning');
  }
}

/* ── Offscreen 4K render canvas ── */
var _pcOffscreen = null;

function _pcGetOffscreen() {
  var fmt = PC_FORMATS[PULSE.postFormat];
  // Always 4K: max side = 3840, maintain aspect
  var maxPx = 3840;
  var scale = Math.min(maxPx / fmt.w, maxPx / fmt.h, 1);
  // For 1080-based formats → 3x = 3240px (near 4K), good enough
  var W = Math.round(fmt.w * (maxPx / Math.max(fmt.w, fmt.h)));
  var H = Math.round(fmt.h * (maxPx / Math.max(fmt.w, fmt.h)));
  if (!_pcOffscreen || _pcOffscreen.width !== W || _pcOffscreen.height !== H) {
    _pcOffscreen = document.createElement('canvas');
    _pcOffscreen.width  = W;
    _pcOffscreen.height = H;
  }
  return {cv: _pcOffscreen, W: W, H: H};
}

function _pcRenderToCanvas(targetCanvas, W, H, onDone) {
  var ctx = targetCanvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  if (PULSE.postImage) {
    var img = new Image();
    img.onload = function() {
      var iw = img.naturalWidth  || img.width;
      var ih = img.naturalHeight || img.height;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (!PULSE.postText && !PULSE.postSubtext) {
        // No text: COVER — fill entire canvas, crop if needed
        var scale = Math.max(W / iw, H / ih);
        var dw = iw * scale, dh = ih * scale;
        var dx = (W - dw) / 2, dy = (H - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
      } else {
        // Has text: fill top 80%, leave space for text at bottom
        var scale2 = Math.max(W / iw, (H * 0.8) / ih);
        var dw2 = iw * scale2, dh2 = ih * scale2;
        var dx2 = (W - dw2) / 2, dy2 = 0;
        // Background fill first
        ctx.fillStyle = PULSE.postBg;
        ctx.fillRect(0, 0, W, H);
        ctx.drawImage(img, dx2, dy2, dw2, dh2);
        // Gradient at bottom for text readability
        var grad = ctx.createLinearGradient(0, H * 0.55, 0, H);
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, 'rgba(0,0,0,0.75)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
        _pcDrawTextHR(ctx, W, H);
        if (onDone) onDone();
        return;
      }

      // Subtle vignette for cover mode
      var vig = ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.8);
      vig.addColorStop(0,'rgba(0,0,0,0)');
      vig.addColorStop(1,'rgba(0,0,0,0.25)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);

      _pcDrawTextHR(ctx, W, H);
      if (onDone) onDone();
    };
    img.onerror = function() {
      ctx.fillStyle = PULSE.postBg;
      ctx.fillRect(0, 0, W, H);
      _pcDrawTextHR(ctx, W, H);
      if (onDone) onDone();
    };
    img.src = PULSE.postImage;
  } else {
    // No image — solid background
    ctx.fillStyle = PULSE.postBg;
    ctx.fillRect(0, 0, W, H);
    var grad2 = ctx.createLinearGradient(0, 0, W, H);
    grad2.addColorStop(0, 'rgba(0,0,0,0)');
    grad2.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad2;
    ctx.fillRect(0, 0, W, H);
    _pcDrawTextHR(ctx, W, H);
    if (onDone) onDone();
  }
}

function _pcDrawTextHR(ctx, W, H) {
  // Scale font relative to W so it's always crisp at any resolution
  var mainSize = Math.round(W * 0.065);
  var subSize  = Math.round(W * 0.038);

  ctx.textAlign = 'center';

  if (PULSE.postText) {
    ctx.font = 'bold ' + mainSize + 'px Inter, Arial, sans-serif';
    ctx.fillStyle = PULSE.postTextColor;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = Math.round(W * 0.008);
    var words = PULSE.postText.split(' '), line = '', lines = [], maxW = W * 0.85;
    for (var i = 0; i < words.length; i++) {
      var test = line + words[i] + ' ';
      if (ctx.measureText(test).width > maxW && line) { lines.push(line.trim()); line = words[i] + ' '; }
      else line = test;
    }
    if (line) lines.push(line.trim());
    var mx = W * PULSE.mainTextX;
    var my = H * PULSE.mainTextY;
    lines.forEach(function(l, idx) {
      ctx.fillText(l, mx, my + idx * mainSize * 1.35);
    });
    ctx.shadowBlur = 0;
  }

  if (PULSE.postSubtext) {
    ctx.font = 'normal ' + subSize + 'px Inter, Arial, sans-serif';
    ctx.fillStyle = PULSE.postTextColor;
    ctx.globalAlpha = 0.88;
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = Math.round(W * 0.005);
    ctx.fillText(PULSE.postSubtext.substring(0, 120), W * PULSE.subTextX, H * PULSE.subTextY);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  // Watermark — small, elegant
  ctx.textAlign = 'right';
  ctx.font = 'bold ' + Math.round(W * 0.022) + 'px Inter, Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.shadowBlur = 0;
  ctx.fillText('ZyroNex', W * 0.97, H * 0.975);
}

function pcDraw() {
  var cv = document.getElementById('pcCanvas');
  if (!cv) return;

  // Show/hide empty hint
  var hint = document.getElementById('pcEmptyHint');
  if (hint) hint.style.display = (PULSE.postText || PULSE.postImage) ? 'none' : 'flex';

  // Render at 4K offscreen
  var off = _pcGetOffscreen();
  _pcRenderToCanvas(off.cv, off.W, off.H, function() {
    // Copy scaled-down to preview canvas (antialiased)
    var ctx2 = cv.getContext('2d');
    ctx2.clearRect(0, 0, cv.width, cv.height);
    ctx2.imageSmoothingEnabled = true;
    ctx2.imageSmoothingQuality = 'high';
    ctx2.drawImage(off.cv, 0, 0, cv.width, cv.height);
  });
}

function _pcDrawText(ctx, w, h) { _pcDrawTextHR(ctx, w, h); } // alias for compat

function pcDownload() {
  var fmt = PC_FORMATS[PULSE.postFormat];
  var off = _pcGetOffscreen();

  if(typeof toast==='function') toast('⏳ Δημιουργία 4K εικόνας...', 'info');

  _pcRenderToCanvas(off.cv, off.W, off.H, function() {
    // Export as high-quality PNG (lossless) for social media
    var dataUrl = off.cv.toDataURL('image/png');
    var a = document.createElement('a');
    a.download = 'zyroniex-pulse-' + PULSE.postFormat + '-' + off.W + 'x' + off.H + '.png';
    a.href = dataUrl;
    a.click();
    if(typeof toast==='function') toast('✅ 4K post αποθηκεύτηκε! (' + off.W + '×' + off.H + 'px)', 'success');
  });
}

/* ── Canvas drag-to-position text ── */
function _pcInitDrag() {
  var cv = document.getElementById('pcCanvas');
  if (!cv || cv._dragInit) return;
  cv._dragInit = true;
  var dragging = null; // 'main' | 'sub'
  var startX, startY, startPX, startPY;

  function getCanvasXY(e) {
    var rect = cv.getBoundingClientRect();
    var touch = e.touches ? e.touches[0] : e;
    return {
      x: (touch.clientX - rect.left) / rect.width,
      y: (touch.clientY - rect.top)  / rect.height
    };
  }

  function hitTest(pos) {
    // Check if near main text or subtext
    var mainDist = Math.abs(pos.y - PULSE.mainTextY) + Math.abs(pos.x - PULSE.mainTextX);
    var subDist  = Math.abs(pos.y - PULSE.subTextY)  + Math.abs(pos.x - PULSE.subTextX);
    if (!PULSE.postText && !PULSE.postSubtext) return null;
    if (PULSE.postText && mainDist < 0.12) return 'main';
    if (PULSE.postSubtext && subDist < 0.1) return 'sub';
    // Default: drag whatever exists
    if (PULSE.postText) return 'main';
    return null;
  }

  function onStart(e) {
    if (!PULSE.postText && !PULSE.postSubtext) return;
    var pos = getCanvasXY(e);
    dragging = hitTest(pos);
    if (dragging) {
      startX = pos.x; startY = pos.y;
      startPX = dragging === 'main' ? PULSE.mainTextX : PULSE.subTextX;
      startPY = dragging === 'main' ? PULSE.mainTextY : PULSE.subTextY;
      e.preventDefault();
    }
  }
  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    var pos = getCanvasXY(e);
    var nx = Math.max(0.05, Math.min(0.95, startPX + (pos.x - startX)));
    var ny = Math.max(0.05, Math.min(0.98, startPY + (pos.y - startY)));
    if (dragging === 'main') { PULSE.mainTextX = nx; PULSE.mainTextY = ny; }
    else                     { PULSE.subTextX  = nx; PULSE.subTextY  = ny; }
    pcDraw();
  }
  function onEnd() { dragging = null; }

  cv.addEventListener('mousedown',  onStart, {passive:false});
  cv.addEventListener('mousemove',  onMove,  {passive:false});
  cv.addEventListener('mouseup',    onEnd);
  cv.addEventListener('touchstart', onStart, {passive:false});
  cv.addEventListener('touchmove',  onMove,  {passive:false});
  cv.addEventListener('touchend',   onEnd);
  cv.style.cursor = 'move';
  cv.title = 'Σύρε το κείμενο όπου θέλεις';
}


/* ══════════════════════════════════════════════════════════════
   TAB 4 — ZYRONIEX VIDEO STUDIO (FULL EMBEDDED)
   Timeline trim, text overlay, filters, crop, export MP4
   100% in-browser via ffmpeg.wasm — no external links
══════════════════════════════════════════════════════════════ */

/* ── CSS inject ── */
var VS = {
  file:null, videoUrl:null, duration:0,
  trimStart:0, trimEnd:0,
  volume:100, speed:1,
  aspectRatio:'original',
  filter:'none',
  brightness:100, contrast:100, saturation:100,
  textTracks:[],
  processing:false, progress:0,
  outputUrl:null,
  ffmpegLoaded:false, _ffmpeg:null,
  _tlDrag:null
};

var VS_FILTERS=[
  {id:'none',     label:'Κανένα',  css:''},
  {id:'vivid',    label:'Vivid',   css:'saturate(1.6) contrast(1.1) '},
  {id:'warm',     label:'Warm',    css:'sepia(0.3) saturate(1.3) brightness(1.05) '},
  {id:'cool',     label:'Cool',    css:'hue-rotate(200deg) saturate(0.9) '},
  {id:'dramatic', label:'Dramatic',css:'contrast(1.4) saturate(0.7) '},
  {id:'fade',     label:'Fade',    css:'contrast(0.85) saturate(0.75) brightness(1.1) '},
  {id:'noir',     label:'Noir',    css:'grayscale(1) contrast(1.2) '},
  {id:'golden',   label:'Golden',  css:'sepia(0.5) saturate(1.5) hue-rotate(-15deg) '},
];
var VS_ASPECT={
  'original':{w:0,h:0,label:'Αρχικό'},
  '9:16':{w:1080,h:1920,label:'Reel 9:16'},
  '1:1':{w:1080,h:1080,label:'Square 1:1'},
  '16:9':{w:1920,h:1080,label:'Landscape'},
  '4:5':{w:1080,h:1350,label:'Portrait 4:5'},
};

/* ── Main render ── */
function _pulseVideoStudioHTML(){
  if(!VS.file) return _vsDropHTML();
  if(VS.processing) return _vsLoadHTML();
  if(VS.outputUrl) return _vsResultHTML();
  return _vsEditorHTML();
}

function _vsDropHTML(){
  return '<div class="vs-dropzone" id="vsDZ" onclick="document.getElementById(\'vsIn\').click()">'
    +'<input type="file" id="vsIn" accept="video/*" style="display:none" onchange="vsLoad(this)">'
    +'<div style="font-size:52px;margin-bottom:14px">🎬</div>'
    +'<p style="margin:0 0 6px;color:var(--text-0);font-size:15px;font-weight:700">Ανέβασε βίντεο</p>'
    +'<p style="margin:0 0 14px;color:var(--text-2);font-size:12px">MP4 · MOV · WEBM · AVI</p>'
    +'<div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center">'
    +['✂️ Trim','📐 Crop','✍️ Text','🎨 Filters','🔊 Volume','⚡ Speed','📤 Export 4K'].map(function(x){
      return '<span style="font-size:11px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.25);color:#a78bfa;padding:3px 10px;border-radius:20px">'+x+'</span>';
    }).join('')
    +'</div></div>';
}

function _vsEditorHTML(){
  var flt=VS_FILTERS.find(function(f){return f.id===VS.filter;})||VS_FILTERS[0];
  var css=flt.css+'brightness('+VS.brightness+'%) contrast('+VS.contrast+'%) saturate('+VS.saturation+'%)';
  var sp=VS.duration>0?VS.trimStart/VS.duration*100:0;
  var ep=VS.duration>0?VS.trimEnd/VS.duration*100:100;
  var fw=(ep-sp).toFixed(2);

  return '<div class="vs-editor">'
    // Preview
    +'<div class="vs-preview-row" id="vsPR">'
      +'<video id="vsV" src="'+VS.videoUrl+'" style="filter:'+css+'" playsinline webkit-playsinline'
        +' onloadedmetadata="vsOnMeta(this)" ontimeupdate="vsOnTime(this)"></video>'
      +'<div class="vs-overlay-container" id="vsOC">'+_vsOvHTML()+'</div>'
    +'</div>'
    // Toolbar
    +'<div class="vs-toolbar">'
      +'<button class="vs-tool-btn" id="vsPlayBtn" onclick="vsPP()">▶️ Play</button>'
      +'<button class="vs-tool-btn" onclick="vsAddText()">✍️ +Κείμενο</button>'
      +'<button class="vs-tool-btn" onclick="vsReset()">🔄 Reset</button>'
      +'<button class="vs-tool-btn red" onclick="VS.file=null;VS.videoUrl=null;VS.outputUrl=null;VS.textTracks=[];_vsRE()">🗑 Νέο</button>'
      +'<span style="margin-left:auto;font-size:11px;color:var(--text-2);flex-shrink:0" id="vsTimeLbl">'+_vsT(VS.trimStart)+' – '+_vsT(VS.trimEnd)+'</span>'
    +'</div>'
    // Timeline
    +'<div class="vs-timeline-wrap">'
      +'<div style="font-size:10px;color:var(--text-2);margin-bottom:6px;font-weight:700;text-transform:uppercase;letter-spacing:.5px">Timeline · Σύρε τα handles για Trim</div>'
      +'<div class="vs-tl-track" id="vsTL" onclick="vsTLClick(event)">'
        +'<div class="vs-tl-fill" style="left:'+sp.toFixed(2)+'%;width:'+fw+'%"></div>'
        +'<div class="vs-tl-handle" id="vsTLLeft" style="left:'+sp.toFixed(2)+'%;transform:translateX(-50%)" ontouchstart="vsTLD(event,\'l\')" onmousedown="vsTLD(event,\'l\')"></div>'
        +'<div class="vs-tl-handle" id="vsTLRight" style="left:'+ep.toFixed(2)+'%;transform:translateX(-50%)" ontouchstart="vsTLD(event,\'r\')" onmousedown="vsTLD(event,\'r\')"></div>'
        +'<div class="vs-tl-head" id="vsTLHead" style="left:'+sp.toFixed(2)+'%"></div>'
      +'</div>'
      +'<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-2);margin-top:4px">'
        +'<span>'+_vsT(0)+'</span><span>'+_vsT(VS.duration/2)+'</span><span>'+_vsT(VS.duration)+'</span>'
      +'</div>'
    +'</div>'
    // Controls
    +'<div class="vs-controls">'
      // Trim
      +'<div class="vs-ctrl-row">'
        +'<div><label class="vs-label">▶️ Έναρξη (sec)</label><input type="number" class="vs-input" id="vsSec" min="0" step="0.1" value="'+VS.trimStart.toFixed(1)+'" oninput="VS.trimStart=Math.max(0,Math.min(+this.value,VS.trimEnd-0.1));vsUTL()"></div>'
        +'<div><label class="vs-label">⏹ Τέλος (sec)</label><input type="number" class="vs-input" id="vsEec" min="0" step="0.1" value="'+VS.trimEnd.toFixed(1)+'" oninput="VS.trimEnd=Math.max(VS.trimStart+0.1,Math.min(+this.value,VS.duration));vsUTL()"></div>'
      +'</div>'
      // Volume + Speed
      +'<div class="vs-ctrl-row">'
        +'<div><label class="vs-label">🔊 Ήχος: <span id="vsVL">'+VS.volume+'%</span></label>'
          +'<input type="range" class="vs-slider" min="0" max="200" value="'+VS.volume
          +'" oninput="VS.volume=+this.value;document.getElementById(\'vsVL\').textContent=VS.volume+\'%\';var v=document.getElementById(\'vsV\');if(v)v.volume=Math.min(1,VS.volume/100)"></div>'
        +'<div><label class="vs-label">⚡ Speed</label>'
          +'<select class="vs-select" onchange="VS.speed=+this.value;var v=document.getElementById(\'vsV\');if(v)v.playbackRate=VS.speed">'
          +[0.25,0.5,1,1.5,2].map(function(s){return '<option value="'+s+'"'+(VS.speed===s?' selected':'')+'>'+s+'x'+(s===1?' (Normal)':'')+'</option>';}).join('')
          +'</select></div>'
      +'</div>'
      // Aspect ratio
      +'<div><label class="vs-label">📐 Format / Aspect Ratio</label>'
        +'<div style="display:flex;flex-wrap:wrap;gap:6px">'
        +Object.keys(VS_ASPECT).map(function(k){
          return '<button class="vs-tool-btn'+(VS.aspectRatio===k?' active':'')+'" onclick="VS.aspectRatio=\''+k+'\';_vsRE()">'+VS_ASPECT[k].label+'</button>';
        }).join('')+'</div></div>'
      // Filters
      +'<div><label class="vs-label">🎨 Φίλτρα</label>'
        +'<div class="vs-filter-grid">'
        +VS_FILTERS.map(function(f){
          return '<button class="vs-filter-btn'+(VS.filter===f.id?' active':'')+'" onclick="VS.filter=\''+f.id+'\';vsAF()">'+f.label+'</button>';
        }).join('')+'</div></div>'
      // Adjustments
      +'<div><label class="vs-label">✨ Εικόνα</label>'
        +'<div style="display:flex;flex-direction:column;gap:8px">'
        +[['brightness','Φωτεινότητα',50,200],['contrast','Αντίθεση',50,200],['saturation','Κορεσμός',0,200]].map(function(p){
          return '<div style="display:flex;align-items:center;gap:10px">'
            +'<span style="font-size:11px;color:var(--text-2);width:88px;flex-shrink:0">'+p[1]+'</span>'
            +'<input type="range" class="vs-slider" style="flex:1" min="'+p[2]+'" max="'+p[3]+'" value="'+VS[p[0]]+'"'
            +' oninput="VS.'+p[0]+'=+this.value;vsAF();document.getElementById(\'vsA_'+p[0]+'\').textContent=VS.'+p[0]+'+\'%\'">'
            +'<span style="font-size:11px;color:var(--text-2);width:38px;text-align:right" id="vsA_'+p[0]+'">'+VS[p[0]]+'%</span>'
            +'</div>';
        }).join('')+'</div></div>'
      // Text tracks
      +(VS.textTracks.length>0
        ?'<div><label class="vs-label">✍️ Text Overlays (σύρε στο video)</label>'
          +'<div style="display:flex;flex-direction:column;gap:6px">'
          +VS.textTracks.map(function(t,i){
            return '<div class="vs-text-item">'
              +'<input type="text" value="'+t.text.replace(/"/g,'&quot;').replace(/'/g,'&#39;')+'" oninput="VS.textTracks['+i+'].text=this.value;vsROv()" placeholder="Κείμενο...">'
              +'<input type="color" value="'+t.color+'" style="width:34px;height:34px;border:1px solid var(--border);border-radius:6px;cursor:pointer;padding:2px;background:rgba(255,255,255,.1);flex-shrink:0" oninput="VS.textTracks['+i+'].color=this.value;vsROv()">'
              +'<input type="range" min="14" max="80" value="'+t.size+'" style="width:60px;flex-shrink:0" class="vs-slider" oninput="VS.textTracks['+i+'].size=+this.value;vsROv()">'
              +'<button onclick="VS.textTracks.splice('+i+',1);_vsRE()" style="background:transparent;border:none;color:#ef4444;cursor:pointer;font-size:18px;padding:0 4px;flex-shrink:0;min-height:36px;min-width:28px">×</button>'
              +'</div>';
          }).join('')
          +'</div></div>'
        :'')
    +'</div>'
    // Export
    +'<div style="padding:12px;border-top:1px solid var(--border)">'
      +'<button class="vs-export-btn" onclick="vsExport()">📤 Export MP4 · '+_vsT(VS.trimEnd-VS.trimStart)+' · '+(VS_ASPECT[VS.aspectRatio]||{label:'Αρχικό'}).label+'</button>'
      +'<div style="font-size:11px;color:var(--text-2);text-align:center;margin-top:6px">Trim: '+_vsT(VS.trimStart)+' → '+_vsT(VS.trimEnd)+'</div>'
    +'</div>'
  +'</div>';
}

function _vsLoadHTML(){
  return '<div style="display:flex;flex-direction:column;align-items:center;gap:16px;padding:48px 20px">'
    +'<div class="vs-spin"></div>'
    +'<div style="font-size:14px;font-weight:600;color:var(--text-1)" id="vsProgLbl">Φόρτωση επεξεργαστή βίντεο...</div>'
    +'<div class="vs-prog-bar" style="width:100%;max-width:320px"><div class="vs-prog-fill" id="vsProgFl"></div></div>'
    +'<div style="font-size:11px;color:var(--text-2);text-align:center;line-height:1.6">Επεξεργασία 100% στη συσκευή σου<br>Χωρίς upload · Χωρίς server</div>'
  +'</div>';
}

function _vsResultHTML(){
  return '<div style="display:flex;flex-direction:column;gap:14px">'
    +'<div style="background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.3);border-radius:10px;padding:12px;display:flex;align-items:center;gap:10px">'
      +'<span style="font-size:24px">✅</span><span style="font-size:13px;font-weight:700;color:#10b981">Βίντεο έτοιμο για download!</span>'
    +'</div>'
    +'<video src="'+VS.outputUrl+'" controls playsinline webkit-playsinline style="width:100%;border-radius:10px;max-height:300px;background:#000"></video>'
    +'<div style="display:flex;gap:10px;flex-wrap:wrap">'
      +'<a href="'+VS.outputUrl+'" download="zyroniex-video-'+Date.now()+'.mp4" style="flex:1;min-width:140px;padding:13px;border-radius:10px;background:linear-gradient(135deg,#8b5cf6,#06b6d4);color:#fff;font-size:13px;font-weight:700;text-align:center;text-decoration:none;display:block">⬇️ Κατέβασε MP4</a>'
      +'<button onclick="VS.outputUrl=null;_vsRE()" style="padding:13px 16px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text-1);font-size:13px;cursor:pointer;font-family:inherit">✂️ Νέα Επεξεργασία</button>'
      +'<button onclick="VS.file=null;VS.videoUrl=null;VS.outputUrl=null;VS.textTracks=[];_vsRE()" style="padding:13px 16px;border-radius:10px;border:1px solid var(--border);background:var(--surface);color:var(--text-2);font-size:13px;cursor:pointer;font-family:inherit">🔄 Νέο βίντεο</button>'
    +'</div>'
  +'</div>';
}

function _vsOvHTML(){
  return VS.textTracks.map(function(t,i){
    return '<div class="vs-overlay-text" id="vsOT'+i+'" style="left:'+(t.x*100).toFixed(1)+'%;top:'+(t.y*100).toFixed(1)+'%;font-size:'+t.size+'px;color:'+t.color+'"'
      +' ontouchstart="vsODS(event,'+i+')" onmousedown="vsODS(event,'+i+')">'+t.text+'</div>';
  }).join('');
}

/* ── Helpers ── */
function _vsT(s){if(!s||isNaN(s))return'0:00';var m=Math.floor(s/60),sc=Math.floor(s%60);return m+':'+(sc<10?'0':'')+sc;}
function _vsRE(){var w=document.getElementById('pulseTabContent');if(w){w.innerHTML=_pulseVideoStudioHTML();setTimeout(function(){vsBindTL();var v=document.getElementById('vsV');if(v){v.volume=Math.min(1,VS.volume/100);v.playbackRate=VS.speed;}},60);}}
function vsROv(){var oc=document.getElementById('vsOC');if(oc)oc.innerHTML=_vsOvHTML();_vsBindOvDrag();}

/* ── Load ── */
function vsLoad(inp){
  if(!inp.files||!inp.files[0])return;
  VS.file=inp.files[0]; VS.videoUrl=URL.createObjectURL(VS.file);
  VS.outputUrl=null; VS.textTracks=[]; VS.trimStart=0; VS.trimEnd=0;
  _vsRE();
}
function vsOnMeta(el){
  VS.duration=el.duration||0;
  if(!VS.trimEnd||VS.trimEnd>VS.duration)VS.trimEnd=VS.duration;
  vsUTL();
}
function vsOnTime(el){
  if(VS.duration<=0)return;
  var pct=el.currentTime/VS.duration*100;
  var h=document.getElementById('vsTLHead');if(h)h.style.left=pct.toFixed(2)+'%';
  if(el.currentTime>=VS.trimEnd){el.currentTime=VS.trimStart;}
}
function vsPP(){
  var v=document.getElementById('vsV');if(!v)return;
  if(v.paused){if(v.currentTime<VS.trimStart||v.currentTime>=VS.trimEnd)v.currentTime=VS.trimStart;v.play();var b=document.getElementById('vsPlayBtn');if(b)b.textContent='⏸ Pause';}
  else{v.pause();var b=document.getElementById('vsPlayBtn');if(b)b.textContent='▶️ Play';}
}
function vsTLClick(e){
  var tl=document.getElementById('vsTL');if(!tl||VS.duration<=0)return;
  var r=tl.getBoundingClientRect();
  var t=((e.clientX-r.left)/r.width)*VS.duration;
  var v=document.getElementById('vsV');if(v)v.currentTime=t;
}
function vsUTL(){
  var sp=VS.duration>0?VS.trimStart/VS.duration*100:0;
  var ep=VS.duration>0?VS.trimEnd/VS.duration*100:100;
  var fill=document.querySelector('.vs-tl-fill');
  var lh=document.getElementById('vsTLLeft'),rh=document.getElementById('vsTLRight');
  if(fill){fill.style.left=sp.toFixed(2)+'%';fill.style.width=(ep-sp).toFixed(2)+'%';}
  if(lh)lh.style.left=sp.toFixed(2)+'%';
  if(rh)rh.style.left=ep.toFixed(2)+'%';
  var si=document.getElementById('vsSec'),ei=document.getElementById('vsEec');
  if(si)si.value=VS.trimStart.toFixed(1);if(ei)ei.value=VS.trimEnd.toFixed(1);
  var tl=document.getElementById('vsTimeLbl');if(tl)tl.textContent=_vsT(VS.trimStart)+' – '+_vsT(VS.trimEnd);
}
function vsBindTL(){
  var tl=document.getElementById('vsTL');if(!tl||tl._b)return;tl._b=true;
  function gx(e){return e.touches?e.touches[0].clientX:e.clientX;}
  function mv(e){
    if(!VS._tlDrag)return;
    e.preventDefault();
    var r=tl.getBoundingClientRect();
    var p=Math.max(0,Math.min(1,(gx(e)-r.left)/r.width));
    var t=p*VS.duration;
    if(VS._tlDrag==='l')VS.trimStart=Math.min(t,VS.trimEnd-0.1);
    else VS.trimEnd=Math.max(t,VS.trimStart+0.1);
    vsUTL();
  }
  function up(){VS._tlDrag=null;}
  document.addEventListener('mousemove',mv,{passive:false});
  document.addEventListener('touchmove',mv,{passive:false});
  document.addEventListener('mouseup',up);
  document.addEventListener('touchend',up);
}
function vsTLD(e,side){e.preventDefault();e.stopPropagation();VS._tlDrag=side;}
function vsAF(){
  var flt=VS_FILTERS.find(function(f){return f.id===VS.filter;})||VS_FILTERS[0];
  var css=flt.css+'brightness('+VS.brightness+'%) contrast('+VS.contrast+'%) saturate('+VS.saturation+'%)';
  var v=document.getElementById('vsV');if(v)v.style.filter=css;
}
function vsReset(){VS.filter='none';VS.brightness=100;VS.contrast=100;VS.saturation=100;_vsRE();}
function vsAddText(){
  VS.textTracks.push({id:Date.now(),text:'ZyroNex',x:.05,y:.1,size:32,color:'#ffffff'});
  _vsRE();
}

/* ── Text overlay drag ── */
function vsODS(e,i){
  e.preventDefault();e.stopPropagation();
  var el=document.getElementById('vsOT'+i);
  var pr=document.getElementById('vsPR');
  if(!el||!pr)return;
  var rr=pr.getBoundingClientRect();
  var sx=e.touches?e.touches[0].clientX:e.clientX;
  var sy=e.touches?e.touches[0].clientY:e.clientY;
  var px=VS.textTracks[i].x,py=VS.textTracks[i].y;
  function mv(ev){
    var cx=ev.touches?ev.touches[0].clientX:ev.clientX;
    var cy=ev.touches?ev.touches[0].clientY:ev.clientY;
    VS.textTracks[i].x=Math.max(0,Math.min(.9,px+(cx-sx)/rr.width));
    VS.textTracks[i].y=Math.max(0,Math.min(.9,py+(cy-sy)/rr.height));
    el.style.left=(VS.textTracks[i].x*100).toFixed(1)+'%';
    el.style.top=(VS.textTracks[i].y*100).toFixed(1)+'%';
  }
  function up(){document.removeEventListener('mousemove',mv);document.removeEventListener('touchmove',mv);document.removeEventListener('mouseup',up);document.removeEventListener('touchend',up);}
  document.addEventListener('mousemove',mv,{passive:false});
  document.addEventListener('touchmove',mv,{passive:false});
  document.addEventListener('mouseup',up);
  document.addEventListener('touchend',up);
}
function _vsBindOvDrag(){}

/* ── Export via ffmpeg.wasm ── */
async function vsExport(){
  if(!VS.file||VS.processing)return;
  VS.processing=true;VS.outputUrl=null;
  _vsRE();
  function lbl(t){var e=document.getElementById('vsProgLbl');if(e)e.textContent=t;}
  function prg(p){var e=document.getElementById('vsProgFl');if(e)e.style.width=Math.round(p*100)+'%';}
  try{
    lbl('Φόρτωση ffmpeg.wasm...');prg(0.05);
    if(!VS._ffmpeg){
      var m=await import('https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js');
      VS._ffmpeg=new (m.FFmpeg||m.default)();
    }
    var ff=VS._ffmpeg;
    if(!VS.ffmpegLoaded){
      lbl('Φόρτωση WASM core (~30MB, μία φορά)...');prg(0.1);
      var util=await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js');
      var toBlob=util.toBlobURL;
      var base='https://cdn.jsdelivr.net/npm/@ffmpeg/core-mt@0.12.6/dist/esm';
      await ff.load({
        coreURL:  await toBlob(base+'/ffmpeg-core.js','text/javascript'),
        wasmURL:  await toBlob(base+'/ffmpeg-core.wasm','application/wasm'),
        workerURL:await toBlob(base+'/ffmpeg-core.worker.js','text/javascript'),
      });
      VS.ffmpegLoaded=true;
    }
    lbl('Ανέβασμα αρχείου...');prg(0.2);
    var util2=await import('https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js');
    await ff.writeFile('in.mp4',await util2.fetchFile(VS.file));
    ff.on('progress',function(p){prg(0.25+(p.progress||0)*0.7);lbl('Επεξεργασία: '+Math.round((p.progress||0)*100)+'%');});
    lbl('Επεξεργασία βίντεο...');prg(0.25);
    var dur=VS.trimEnd-VS.trimStart;
    var args=['-i','in.mp4','-ss',VS.trimStart.toFixed(3),'-t',dur.toFixed(3)];
    var asp=VS_ASPECT[VS.aspectRatio];
    if(VS.aspectRatio!=='original'&&asp.w&&asp.h){
      var vf='scale='+asp.w+':'+asp.h+':force_original_aspect_ratio=decrease,pad='+asp.w+':'+asp.h+':(ow-iw)/2:(oh-ih)/2:color=black';
      args=args.concat(['-vf',vf]);
    }
    args=args.concat(['-c:v','libx264','-crf','16','-preset','fast','-c:a','aac','-b:a','192k','-movflags','+faststart','out.mp4']);
    await ff.exec(args);
    lbl('Φινάλισμα...');prg(0.97);
    var out=await ff.readFile('out.mp4');
    VS.outputUrl=URL.createObjectURL(new Blob([out.buffer],{type:'video/mp4'}));
    VS.processing=false;_vsRE();
    if(typeof toast==='function')toast('✅ Βίντεο έτοιμο!','success');
  }catch(err){
    VS.processing=false;_vsRE();
    console.error('vsExport:',err);
    if(typeof toast==='function')toast('⚠️ '+(err.message||String(err)),'danger');
  }
}


/* ── Content Engine HTML functions (restored) ── */
function _pulseContentEngineHTML() {
  return '<div class="ce-layout">'
    +'<div class="ce-input-area">'
      +'<div class="ce-form-row">'
        +'<div><label class="ce-label">📦 Προϊόν / Θέμα</label><input type="text" class="ce-text" id="ceProduct" placeholder="π.χ. Lost Mary 600 Strawberry Ice" style="width:100%;box-sizing:border-box"></div>'
        +'<div><label class="ce-label">📱 Πλατφόρμα</label><select class="ce-select" id="cePlatform"><option value="all">Όλες</option><option value="instagram">Instagram</option><option value="facebook">Facebook</option><option value="tiktok">TikTok</option></select></div>'
      +'</div>'
      +'<div class="ce-form-row">'
        +'<div><label class="ce-label">🎯 Στόχος</label><select class="ce-select" id="ceGoal"><option value="awareness">Brand Awareness</option><option value="promo">Προσφορά</option><option value="launch">Νέο Προϊόν</option><option value="engagement">Engagement</option><option value="educational">Ενημερωτικό</option></select></div>'
        +'<div><label class="ce-label">🗣️ Τόνος</label><select class="ce-select" id="ceTone"><option value="friendly">Φιλικός</option><option value="professional">Επαγγελματικός</option><option value="exciting">Hype</option><option value="informative">Ενημερωτικός</option></select></div>'
      +'</div>'
      +'<div style="margin-bottom:14px"><label class="ce-label">💡 Extra (προαιρετικό)</label><textarea class="ce-text" id="ceExtra" rows="2" placeholder="π.χ. Νέα άφιξη, μόνο αυτή την εβδομάδα..." style="width:100%;box-sizing:border-box"></textarea></div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
        +'<button class="ce-generate-btn" onclick="ceGeneratePosts()" id="ceBtnPosts">'+(PULSE.ceLoading?'<span class="ce-loading-dots"><span></span><span></span><span></span></span>':'✍️ Δημιούργησε Posts')+'</button>'
        +'<button class="ce-generate-btn" style="background:linear-gradient(135deg,#8b5cf6,#06b6d4)" onclick="ceGenerateKeywords()">🔍 Keywords & Hashtags</button>'
      +'</div>'
    +'</div>'
    +'<div id="ceResultsWrap">'
      +(!PULSE.ceResults&&!PULSE.ceKeywords
        ?'<div class="ce-empty"><div class="icon">✨</div><p>Συμπλήρωσε τη φόρμα και επίλεξε τι θέλεις να δημιουργήσεις.</p></div>'
        :(PULSE.ceResults?_pulseCeResultsHTML(PULSE.ceResults):'')+(PULSE.ceKeywords?_pulseCeKeywordsHTML(PULSE.ceKeywords):''))
    +'</div>'
  +'</div>';
}

function _pulseContentEngineBind() {}

function _pulseCeResultsHTML(results) {
  var platforms=[{key:'instagram',icon:'📸',label:'Instagram'},{key:'facebook',icon:'👥',label:'Facebook'},{key:'tiktok',icon:'🎵',label:'TikTok'}];
  var html='<div class="ce-results">';
  platforms.forEach(function(p){
    var data=results[p.key];if(!data)return;
    html+='<div class="ce-result-card">'
      +'<div class="ce-result-header"><div class="ce-result-platform">'+p.icon+' '+p.label+'</div><button class="ce-copy-btn" id="cpBtn_'+p.key+'" onclick="ceCopy(\''+p.key+'\')">Αντιγραφή</button></div>'
      +'<div class="ce-result-body"><div class="ce-result-text" id="ceText_'+p.key+'">'+_escHtml(data.caption||'')+'</div>'
      +'<div class="ce-hashtags">'+(data.hashtags||[]).map(function(h){return'<span class="ce-hashtag" onclick="ceCopyHashtag(this)">'+_escHtml(h)+'</span>';}).join('')+'</div>'
      +'</div></div>';
  });
  return html+'</div>';
}

function _pulseCeKeywordsHTML(kw) {
  if(!kw||!kw.primary)return'';
  return '<div class="ce-result-card" style="margin-top:16px">'
    +'<div class="ce-result-header"><div class="ce-result-platform">🔍 Keywords & Hashtags</div><button class="ce-copy-btn" onclick="ceCopyAllHashtags()">Αντιγραφή όλων</button></div>'
    +'<div style="padding:10px 0">'
    +(kw.primary&&kw.primary.length?'<div style="padding:8px 14px 4px"><span style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase">🔥 High Volume</span></div><div class="ce-kw-grid">'+kw.primary.map(function(k){return'<span class="ce-kw-pill high" onclick="ceCopyHashtag(this)">'+_escHtml(k)+'</span>';}).join('')+'</div>':'')
    +(kw.secondary&&kw.secondary.length?'<div style="padding:8px 14px 4px"><span style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase">📈 Medium</span></div><div class="ce-kw-grid">'+kw.secondary.map(function(k){return'<span class="ce-kw-pill med" onclick="ceCopyHashtag(this)">'+_escHtml(k)+'</span>';}).join('')+'</div>':'')
    +(kw.niche&&kw.niche.length?'<div style="padding:8px 14px 4px"><span style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase">🎯 Niche</span></div><div class="ce-kw-grid">'+kw.niche.map(function(k){return'<span class="ce-kw-pill low" onclick="ceCopyHashtag(this)">'+_escHtml(k)+'</span>';}).join('')+'</div>':'')
    +(kw.seo_title?'<div style="padding:12px 14px 0"><span class="ce-label">SEO Title</span><div style="font-size:13px;color:var(--text-1);padding:8px;background:rgba(255,255,255,.05);border-radius:8px">'+_escHtml(kw.seo_title)+'</div></div>':'')
    +'</div></div>';
}


async function ceGeneratePosts() {
  var product = (document.getElementById('ceProduct')||{}).value || '';
  var platform = (document.getElementById('cePlatform')||{}).value || 'all';
  var goal = (document.getElementById('ceGoal')||{}).value || 'awareness';
  var tone = (document.getElementById('ceTone')||{}).value || 'friendly';
  var extra = (document.getElementById('ceExtra')||{}).value || '';

  if (!product.trim()) { if(typeof toast==='function') toast('Γράψε προϊόν ή θέμα', 'warning'); return; }

  PULSE.ceLoading = true;
  PULSE.ceResults = null;
  _pulseRenderTab();

  var wrap = document.getElementById('ceResultsWrap');
  if (wrap) wrap.innerHTML = '<div class="ce-loading"><div class="ce-loading-dots"><span></span><span></span><span></span></div><span>ZyroNex δημιουργεί posts...</span></div>';

  var targetPlatforms = platform === 'all' ? ['instagram','facebook','tiktok'] : [platform];
  var toneMap = {friendly:'φιλικό και casual',professional:'επαγγελματικό',exciting:'ενθουσιώδες και hype',informative:'ενημερωτικό'};
  var goalMap = {awareness:'brand awareness',promo:'προώθηση προσφοράς/έκπτωσης',launch:'ανακοίνωση νέου προϊόντος',engagement:'δημιουργία αλληλεπίδρασης',educational:'ενημέρωση κοινού'};

  var systemPrompt = 'Είσαι expert social media manager για κατάστημα vape στην Ελλάδα. Δημιουργείς posts που μοιάζουν ΑΠΟΛΥΤΑ ΦΥΣΙΚΑ — σαν να τα έγραψε άνθρωπος. ΚΑΝΟΝΕΣ ΑΚΥΡΩΣΗΣ: ΠΟΤΕ μη χρησιμοποιείς τη λέξη "AI", "τεχνητή νοημοσύνη", "machine learning" ή οποιοδήποτε συνώνυμο. Αντί αυτού γράφε "ZyroNex" όταν χρειάζεται attribution. Τα posts πρέπει να είναι authentic, να μοιάζουν 100% γραμμένα από άνθρωπο, με φυσικές εκφράσεις στα ελληνικά.';

  var userPrompt = 'Δημιούργησε social media posts για: "' + product + '"\n' +
    'Στόχος: ' + goalMap[goal] + '\n' +
    'Τόνος: ' + toneMap[tone] + '\n' +
    (extra ? 'Extra: ' + extra + '\n' : '') +
    'Πλατφόρμες: ' + targetPlatforms.join(', ') + '\n\n' +
    'Απάντησε ΜΟΝΟ σε JSON (χωρίς markdown, χωρίς backticks):\n' +
    '{\n' +
    targetPlatforms.map(function(p) {
      var maxLen = p==='instagram'?2200:p==='facebook'?63206:p==='tiktok'?2200:2200;
      var hashCount = p==='instagram'?20:p==='facebook'?5:p==='tiktok'?10:15;
      return '"'+p+'":{"caption":"caption μέχρι '+maxLen+' chars, φυσικό ύφος, emojis, call-to-action","hashtags":["'+hashCount+' hashtags στα ελληνικά και αγγλικά"]}';
    }).join(',\n') +
    '\n}';

  try {
    var raw = await askClaude([{role:'user', content: userPrompt}], systemPrompt, 2000);
    var clean = raw.replace(/```json|```/g,'').trim();
    var parsed = JSON.parse(clean);
    PULSE.ceResults = parsed;
    PULSE.ceLoading = false;
    _pulseRenderTab();
  } catch(err) {
    PULSE.ceLoading = false;
    _pulseRenderTab();
    var w2 = document.getElementById('ceResultsWrap');
    if (w2) w2.innerHTML = '<div class="ce-empty"><div class="icon">⚠️</div><p>Σφάλμα δημιουργίας: ' + _escHtml(err.message) + '</p></div>';
  }
}

async function ceGenerateKeywords() {
  var product = (document.getElementById('ceProduct')||{}).value || '';
  if (!product.trim()) { if(typeof toast==='function') toast('Γράψε προϊόν ή θέμα', 'warning'); return; }

  var wrap = document.getElementById('ceResultsWrap');
  if (wrap) wrap.innerHTML = '<div class="ce-loading"><div class="ce-loading-dots"><span></span><span></span><span></span></div><span>ZyroNex αναλύει keywords...</span></div>';

  var systemPrompt = 'Είσαι SEO και social media expert για vape καταστήματα στην Ελλάδα. Αναλύεις keywords και hashtags για μέγιστη οργανική εμβέλεια. ΚΑΝΟΝΕΣ: ΠΟΤΕ μη αναφέρεις "AI" ή "τεχνητή νοημοσύνη". Απάντα ΜΟΝΟ σε JSON.';

  var userPrompt = 'Δημιούργησε keyword και hashtag analysis για το vape προϊόν: "' + product + '"\n\n' +
    'Απάντησε ΜΟΝΟ σε JSON (χωρίς markdown):\n' +
    '{\n' +
    '"primary": ["10 high-volume hashtags στα ελληνικά/αγγλικά"],\n' +
    '"secondary": ["15 medium hashtags"],\n' +
    '"niche": ["10 niche/targeted hashtags"],\n' +
    '"seo_title": "SEO-optimized τίτλος για το post (max 60 chars)"\n' +
    '}';

  try {
    var raw = await askClaude([{role:'user', content: userPrompt}], systemPrompt, 1500);
    var clean = raw.replace(/```json|```/g,'').trim();
    var parsed = JSON.parse(clean);
    PULSE.ceKeywords = parsed;
    _pulseRenderTab();
  } catch(err) {
    if (wrap) wrap.innerHTML = '<div class="ce-empty"><div class="icon">⚠️</div><p>Σφάλμα: ' + _escHtml(err.message) + '</p></div>';
  }
}

function ceCopy(platform) {
  var el = document.getElementById('ceText_' + platform);
  var btn = document.getElementById('cpBtn_' + platform);
  if (!el) return;
  // Gather hashtags too
  var hashtags = [];
  var card = el.closest('.ce-result-card');
  if (card) card.querySelectorAll('.ce-hashtag').forEach(function(h) { hashtags.push(h.textContent); });
  var text = el.textContent + (hashtags.length ? '\n\n' + hashtags.join(' ') : '');
  navigator.clipboard.writeText(text).then(function() {
    if (btn) { btn.textContent = '✅ Αντιγράφηκε'; btn.classList.add('copied'); setTimeout(function() { btn.textContent='Αντιγραφή'; btn.classList.remove('copied'); }, 2000); }
  }).catch(function() { if(typeof toast==='function') toast('Αντιγραφή αποτυχία', 'danger'); });
}

function ceCopyHashtag(el) {
  navigator.clipboard.writeText(el.textContent).then(function() {
    if(typeof toast==='function') toast('📋 ' + el.textContent + ' αντιγράφηκε!', 'success');
  }).catch(function(){});
}

function ceCopyAllHashtags() {
  if (!PULSE.ceKeywords) return;
  var all = [].concat(PULSE.ceKeywords.primary||[], PULSE.ceKeywords.secondary||[], PULSE.ceKeywords.niche||[]);
  navigator.clipboard.writeText(all.join(' ')).then(function() {
    if(typeof toast==='function') toast('📋 Όλα τα hashtags αντιγράφηκαν!', 'success');
  }).catch(function(){});
}

// Expose all functions globally after lazy load
var _pulseExports = [renderPulse, pulseSetTab, pulseOpen, pulseHome, _pulseBannerHTML, _pulseHomeGridHTML, _pulseRenderTab, _pulseStudioHTML, _pulseStudioBind, psLoadFile, psLoadFileObj, psAdjust, psResetAdjustments, psRevertOriginal, psReset, psRemoveBG, psDownload, psExportFormat, psSendToPostCreator, _pulsePostCreatorHTML, _pulsePostCreatorBind, pcSetFormat, pcSetBg, pcSetTextColor, pcLoadImg, pcCopyToStudio, _pcGetOffscreen, _pcRenderToCanvas, _pcDrawTextHR, pcDraw, _pcDrawText, pcDownload, _pcInitDrag, _pulseVideoStudioHTML, _vsDropHTML, _vsEditorHTML, _vsLoadHTML, _vsResultHTML, _vsOvHTML, _vsT, _vsRE, vsROv, vsLoad, vsOnMeta, vsOnTime, vsPP, vsTLClick, vsUTL, vsBindTL, vsTLD, vsAF, vsReset, vsAddText, vsODS, _vsBindOvDrag, vsExport, _pulseContentEngineHTML, _pulseContentEngineBind, _pulseCeResultsHTML, _pulseCeKeywordsHTML, ceGeneratePosts, ceGenerateKeywords, ceCopy, ceCopyHashtag, ceCopyAllHashtags];
(function() {
  var i;
  for (i = 0; i < _pulseExports.length; i++) {
    if (typeof _pulseExports[i] === 'function') { window[_pulseExports[i].name] = _pulseExports[i]; }
  }
  window.PULSE = PULSE;
  window.PC_FORMATS = PC_FORMATS;
  window.PC_COLORS = PC_COLORS;
  window.PC_FONTS = PC_FONTS;
  window.VS = VS;
  window.VS_FILTERS = VS_FILTERS;
  window.VS_ASPECT = VS_ASPECT;
})();
export { renderPulse };
