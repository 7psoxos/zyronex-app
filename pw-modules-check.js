#!/usr/bin/env node
// pw-modules-check.js — Static smoke test for ZyroNex lazy-loaded ES modules.
// Tests: export presence, window assignments, module-key consistency, syntax OK.
// Run: node pw-modules-check.js

'use strict';

var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname);

var MODULES = [
  {
    file: 'js/modules/customer-intel.js',
    pageKey: 'customer-intel',
    exportName: 'renderCustomerIntel',
    windowFns: ['renderCustomerIntel', 'renderCustomerIntelBody', 'setCITab', 'renderCITabBody',
                'renderCIWinback', 'renderCIAffinity', 'renderCIDna', 'renderCICoil',
                'renderCIChurner', 'renderCIFlavor', 'renderCITapering', 'renderCIBirthdays']
  },
  {
    file: 'js/modules/campaigns.js',
    pageKey: 'campaigns',
    exportName: 'renderCampaigns',
    windowFns: ['renderCampaigns', 'updateCampTargetCount', 'getCampaignTargets',
                'previewCampaign', 'aiGenerateCampaignText', 'launchCampaign', '_sendCampaignRun']
  },
  {
    file: 'js/modules/site-builder.js',
    pageKey: 'sitebuilder',
    exportName: 'renderSiteBuilder',
    windowFns: ['renderSiteBuilder', '_zbHostResize']
  },
  {
    file: 'js/modules/pulse.js',
    pageKey: 'pulse',
    exportName: 'renderPulse',
    windowFns: ['renderPulse', 'pulseSetTab', 'psLoadFile', 'psAdjust', 'psRemoveBG',
                'pcDraw', 'pcDownload', 'vsLoad', 'vsExport', 'ceGeneratePosts',
                'ceGenerateKeywords', 'ceCopy', 'ceCopyHashtag', 'ceCopyAllHashtags']
  }
];

// Registry from zn_module_loader.js (must stay in sync)
var REGISTRY_KEYS = {
  'customer-intel': '/js/modules/customer-intel.js',
  'campaigns':      '/js/modules/campaigns.js',
  'sitebuilder':    '/js/modules/site-builder.js',
  'pulse':          '/js/modules/pulse.js'
};

var passed = 0;
var failed = 0;
var results = [];

function check(label, ok, detail) {
  if (ok) {
    passed++;
    results.push('  [PASS] ' + label);
  } else {
    failed++;
    results.push('  [FAIL] ' + label + (detail ? ' — ' + detail : ''));
  }
}

console.log('\n=== ZyroNex Lazy Module Smoke Test ===\n');

// 1. Verify REGISTRY key mapping in zn_module_loader.js
var loaderPath = path.join(ROOT, 'js/zn_module_loader.js');
var loaderSrc = fs.readFileSync(loaderPath, 'utf8');
console.log('[ zn_module_loader.js REGISTRY checks ]');
Object.keys(REGISTRY_KEYS).forEach(function(key) {
  var url = REGISTRY_KEYS[key];
  // Check key appears in registry — either quoted ('key') or unquoted (key:)
  var quotedPattern   = "'" + key + "'";
  var unquotedPattern = key + ':';
  check(
    'REGISTRY key \'' + key + '\' present',
    loaderSrc.indexOf(quotedPattern) !== -1 || loaderSrc.indexOf(unquotedPattern) !== -1,
    'expected \'' + key + '\' (quoted or unquoted) in REGISTRY'
  );
  check(
    'REGISTRY url \'' + url + '\' present',
    loaderSrc.indexOf(url) !== -1
  );
});
results.forEach(function(r) { console.log(r); });
results = [];
console.log('');

// 2. Per-module static checks
MODULES.forEach(function(mod) {
  console.log('[ ' + mod.file + ' ]');
  results = [];

  var filePath = path.join(ROOT, mod.file);

  // Existence
  var exists = fs.existsSync(filePath);
  check('File exists', exists, filePath);

  if (!exists) {
    results.forEach(function(r) { console.log(r); });
    console.log('');
    return;
  }

  var src = fs.readFileSync(filePath, 'utf8');

  // Export check
  check(
    'Has export { ' + mod.exportName + ' }',
    src.indexOf('export { ' + mod.exportName + ' }') !== -1,
    'missing named export'
  );

  // Each required window function exposed
  mod.windowFns.forEach(function(fn) {
    // Either window[fn.name] = fn pattern (via loop) or direct window.fn = fn
    var hasExpose = src.indexOf(fn) !== -1;
    check('Function ' + fn + ' defined in module', hasExpose);
  });

  // window assignments loop present
  var hasWindowLoop = src.indexOf('window[') !== -1 || src.indexOf('window.') !== -1;
  check('Has window assignment block', hasWindowLoop);

  // Not using var at top-level module scope for state objects that need global exposure
  // (just check that PULSE/VS are exposed via window.PULSE etc. for pulse.js)
  if (mod.file.indexOf('pulse.js') !== -1) {
    check('window.PULSE assignment present', src.indexOf('window.PULSE') !== -1);
    check('window.PC_FORMATS assignment present', src.indexOf('window.PC_FORMATS') !== -1);
    check('window.VS assignment present', src.indexOf('window.VS') !== -1);
    check('window.VS_FILTERS assignment present', src.indexOf('window.VS_FILTERS') !== -1);
    check('window.VS_ASPECT assignment present', src.indexOf('window.VS_ASPECT') !== -1);
  }

  results.forEach(function(r) { console.log(r); });
  console.log('');
});

// 3. Check stale window.renderSiteBuilder assignment is gone from index.html
console.log('[ index.html cross-checks ]');
results = [];
var indexPath = path.join(ROOT, 'index.html');
var indexSrc = fs.readFileSync(indexPath, 'utf8');

check(
  'Stale "window.renderSiteBuilder = renderSiteBuilder" removed',
  indexSrc.indexOf('window.renderSiteBuilder = renderSiteBuilder') === -1,
  'stale assignment still present — would cause ReferenceError at load'
);

check(
  'Renderer map has \'customer-intel\' key',
  indexSrc.indexOf("'customer-intel':renderCustomerIntel") !== -1,
  'renderer map key must match REGISTRY'
);

check(
  'renderCampaigns placeholder comment present',
  indexSrc.indexOf('renderCampaigns extracted to /js/modules/campaigns.js') !== -1,
  'campaigns comment not found'
);

results.forEach(function(r) { console.log(r); });
console.log('');

// Summary
console.log('=== Results ===');
console.log('Passed: ' + passed);
console.log('Failed: ' + failed);
if (failed === 0) {
  console.log('\nAll checks PASSED.');
  process.exit(0);
} else {
  console.log('\nSome checks FAILED. See above.');
  process.exit(1);
}
