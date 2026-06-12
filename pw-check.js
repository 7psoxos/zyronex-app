const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = {};

  for (const [label, vw, vh] of [['desktop-1440', 1440, 900], ['mobile-390', 390, 844]]) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vw, height: vh });

    // Inject CSS overrides to simulate the Quick POS product view without a real app
    await page.setContent(`
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
/* ----------- copied selectors from index.html after fix ----------- */
:root{
  --bg-1:#1a1a2e;--bg-2:#16213e;--bg-3:#0f3460;
  --border:#2a2a4a;--text-0:#e0e0f0;--text-2:#666;
  --accent:#00d4a8;--warn:#f59e0b;
}
*{box-sizing:border-box}
body{background:#111;font-family:system-ui;margin:0;padding:16px}

/* Container */
.quick-pos-categories{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(130px,1fr));
  gap:8px;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  align-content:start;
  min-height:160px;
  flex:1;
}

/* CARD — after fix */
.quick-pos-product{
  background:var(--bg-2);
  border:1px solid var(--border);
  border-radius:12px;
  padding:6px 6px;
  cursor:pointer;
  display:flex;
  flex-direction:column;
  gap:3px;
  color:var(--text-0);
  transition:all 0.15s;
  -webkit-tap-highlight-color:transparent;
  text-align:left;
  font-family:inherit;
  min-height:175px;
  position:relative;
  align-items:stretch;
}

/* IMAGE */
.quick-pos-product-img{
  max-width:100%;max-height:80px;width:auto;height:auto;object-fit:contain;
  border-radius:8px;display:block;
  flex-shrink:0;
  background:rgba(0,0,0,0.12);
  margin:0 auto 2px;
  padding:4px;
  box-sizing:border-box;
}
.quick-pos-product-placeholder{
  display:flex;align-items:center;justify-content:center;
  height:56px;color:var(--text-2);font-size:26px;
  background:var(--bg-3);border-radius:8px;margin-bottom:2px;
}

/* NAME — after fix */
.quick-pos-product-name{
  font-size:12px;font-weight:600;line-height:1.25;
  color:var(--text-0);
  overflow:hidden;text-overflow:ellipsis;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  flex-shrink:0;
  min-height:30px;
}

/* PRICE */
.quick-pos-product-price{
  font-size:14px;font-weight:800;
  color:var(--accent);
  font-family:monospace;
}

/* BADGE */
.loy-badge{
  position:absolute;top:6px;left:6px;z-index:5;
  background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;
  font-weight:700;font-size:10px;line-height:1;
  padding:4px 7px;border-radius:999px;
  box-shadow:0 1px 4px rgba(0,0,0,.25);
  pointer-events:none;white-space:nowrap;
}

@media(max-width:900px){
  .quick-pos-categories{grid-template-columns:repeat(2,1fr);max-height:none}
}
</style>
</head>
<body>
<div class="quick-pos-categories" id="grid"></div>
<script>
var products = [
  {name:"Νικοτινούχα Βάση 50/50 6mg 500ml Long Fill Premium Quality", price:"8.50", badge:true},
  {name:"Elf Bar 600 Mango Ice 20mg", price:"6.90", badge:false},
  {name:"Vaporesso XROS 3 Nano Pod Kit 1000mAh", price:"29.99", badge:true},
  {name:"Short Fill Tropical Mix", price:"12.00", badge:false},
  {name:"Coil", price:"3.50", badge:false},
  {name:"Mango", price:"5.00", badge:true},
];
var g = document.getElementById('grid');
g.innerHTML = products.map(function(p){
  var mb = p.badge ? '<span class="loy-badge">🔥 ×2 ΠΟΝΤΟΙ</span>' : '';
  return '<button class="quick-pos-product"'+(p.badge?' style="position:relative"':'')+'>'+mb+
    '<div class="quick-pos-product-placeholder">📦</div>'+
    '<div class="quick-pos-product-name">'+p.name+'</div>'+
    '<div class="quick-pos-product-price">'+p.price+' €</div>'+
    '</button>';
}).join('');
</script>
</body>
</html>
    `);

    await page.screenshot({ path: `/home/user/zyronex-app/pw-${label}.png`, fullPage: false });

    // Get computed styles for first product card and its children
    const styles = await page.evaluate(() => {
      var card = document.querySelector('.quick-pos-product');
      if (!card) return { error: 'no card' };
      var nameEl = card.querySelector('.quick-pos-product-name');
      var priceEl = card.querySelector('.quick-pos-product-price');
      var badge = card.querySelector('.loy-badge');
      var cs = getComputedStyle;
      return {
        card: {
          minHeight: cs(card).minHeight,
          height: card.getBoundingClientRect().height,
          overflow: cs(card).overflow,
        },
        name: {
          minHeight: cs(nameEl).minHeight,
          height: nameEl.getBoundingClientRect().height,
          flexShrink: cs(nameEl).flexShrink,
          lineClamp: cs(nameEl).webkitLineClamp,
          overflowY: cs(nameEl).overflowY,
          scrollHeight: nameEl.scrollHeight,
          clientHeight: nameEl.clientHeight,
        },
        price: {
          top: priceEl.getBoundingClientRect().top,
          cardBottom: card.getBoundingClientRect().bottom,
          priceBottom: priceEl.getBoundingClientRect().bottom,
        },
        badge: badge ? {
          top: badge.getBoundingClientRect().top - card.getBoundingClientRect().top,
          left: badge.getBoundingClientRect().left - card.getBoundingClientRect().left,
          visible: badge.getBoundingClientRect().height > 0,
        } : null,
        overlap: {
          nameBR: nameEl.getBoundingClientRect().bottom,
          priceTR: priceEl.getBoundingClientRect().top,
          gap: priceEl.getBoundingClientRect().top - nameEl.getBoundingClientRect().bottom,
        }
      };
    });

    results[label] = styles;
    await page.close();
  }

  await browser.close();

  console.log('\n=== PLAYWRIGHT RESULTS ===');
  for (var k of Object.keys(results)) {
    console.log('\n--- ' + k + ' ---');
    var r = results[k];
    console.log('Card:  minHeight=' + r.card.minHeight + '  actualHeight=' + r.card.height.toFixed(1) + 'px  overflow=' + r.card.overflow);
    console.log('Name:  minHeight=' + r.name.minHeight + '  actualHeight=' + r.name.height.toFixed(1) + 'px  flexShrink=' + r.name.flexShrink + '  scrollH=' + r.name.scrollHeight + '  clientH=' + r.name.clientHeight);
    console.log('Price: gap after name = ' + r.overlap.gap.toFixed(1) + 'px (>0 = no overlap)');
    console.log('Badge: ' + (r.badge ? 'visible=' + r.badge.visible + ' top=' + r.badge.top.toFixed(1) + 'px left=' + r.badge.left.toFixed(1) + 'px' : 'none on first card'));
    var twoLines = r.name.clientHeight >= 28;
    console.log('2-line name fits: ' + (twoLines ? 'YES' : 'NO') + ' (clientHeight=' + r.name.clientHeight + ', need ≥28px)');
    console.log('No overlap: ' + (r.overlap.gap >= 0 ? 'YES gap=' + r.overlap.gap.toFixed(1) + 'px' : 'OVERLAP=' + r.overlap.gap.toFixed(1) + 'px'));
  }
})();
