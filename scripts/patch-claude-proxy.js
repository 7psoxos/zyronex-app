#!/usr/bin/env node
// Applies two non-breaking patches to the downloaded claude-proxy function:
//   Patch A – prompt caching (adds cache_control to system)
//   Patch B – fire-and-forget usage logging to ai_usage_log
'use strict';

const fs   = require('fs');
const path = require('path');

const funcPath = path.join(process.cwd(), 'supabase', 'functions', 'claude-proxy', 'index.ts');
if (!fs.existsSync(funcPath)) {
  console.error('ERROR: Function not found at', funcPath);
  process.exit(1);
}

let src = fs.readFileSync(funcPath, 'utf8');
const original = src;

// ── Guard: fully patched = all three markers present in the correct order ─
// Correct form: caching block ends with `if (_sys) payload.system = _sys;`
// (post-normalization, so _sys is declared before use)
const fullyPatched = src.includes('cache_control')
  && src.includes('ai_usage_log')
  && src.includes('if (_sys) payload.system = _sys');
if (fullyPatched) {
  console.log('All patches already present – nothing to do.');
  process.exit(0);
}

// ── Targeted fix: partially-patched source ──────────────────────────────
// State A: cache_control present, _sys not yet wired into payload at all.
// State B: cache_control present BUT _sys used BEFORE its let declaration
//          (temporal dead zone bug from an earlier patch attempt).
if (src.includes('cache_control') && !src.includes('if (_sys) payload.system = _sys')) {
  // Fix state B: revert the wrong pre-caching assignment if present
  if (/\bif\s*\(system\)\s*payload\.system\s*=\s*_sys\s*;/.test(src)) {
    src = src.replace(
      /\bif\s*\(system\)\s*payload\.system\s*=\s*_sys\s*;/,
      'if (system) payload.system = system;'
    );
    console.log('Reverted pre-caching payload.system = _sys → back to system');
  }
  // Add post-normalization assignment right after the caching block closes
  // Match the closing brace of the else-if inside the caching block
  const cachingCloseRe = /(  \} \/\/ end of else-if|(\}\s*\n\s*)(const aiRes = await fetch))/;
  // Simpler: look for the last line of the _sys normalization block (the else-if closing brace)
  // then the fetch line right after it
  if (/let _sys = body\.system;/.test(src)) {
    src = src.replace(
      /(let _sys[\s\S]*?\}\s*\n)([ \t]*const \w+ = await fetch\s*\("https:\/\/api\.anthropic)/,
      (match, cachingBlock, fetchLine) => {
        return cachingBlock + '  if (_sys) payload.system = _sys;\n' + fetchLine;
      }
    );
    console.log('Applied targeted fix: added if (_sys) payload.system = _sys after caching block');
  }
  fs.writeFileSync(funcPath, src, 'utf8');
  console.log('Partial patch complete.');
  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────
// Patch A: Prompt Caching
// Insert normalization code just before the fetch to api.anthropic.com
// ─────────────────────────────────────────────────────────────────────────
const CACHING_CODE = [
  '  // prompt-caching: normalize system to array with cache_control',
  '  let _sys = body.system;',
  '  if (typeof _sys === \'string\' && _sys.length > 0) {',
  '    _sys = [{ type:\'text\', text: body.system, cache_control:{ type:\'ephemeral\' } }];',
  '  } else if (Array.isArray(_sys) && _sys.length > 0 && !_sys[_sys.length-1].cache_control) {',
  '    _sys[_sys.length-1] = { ..._sys[_sys.length-1], cache_control:{ type:\'ephemeral\' } };',
  '  }',
].join('\n');

// Match: optional whitespace + (const|let|var) varName = await fetch('https://api.anthropic.com/v1/messages'
const fetchRe = /(\n([ \t]*)(?:const|let|var)\s+\w+\s*=\s*await\s+fetch\s*\(\s*['"`]https:\/\/api\.anthropic\.com\/v1\/messages['"`])/;
if (fetchRe.test(src)) {
  src = src.replace(fetchRe, (match, fullLine, indent) => {
    return '\n' + CACHING_CODE + fullLine;
  });
} else {
  console.error('ERROR: Could not find fetch call to api.anthropic.com/v1/messages');
  process.exit(1);
}

// Case 1: inline object literal  { ..., system: body.system, ... }
if (/system\s*:\s*body\.system/.test(src)) {
  src = src.replace(/system\s*:\s*body\.system/g, 'system: _sys');
}

// Case 2: intermediate variable pattern  payload.system = <var>;
// (e.g. const system = body.system; ... payload.system = system;)
// Replace the assignment so it uses _sys instead.
if (/\bpayload\.system\s*=\s*\w+\s*;/.test(src)) {
  src = src.replace(/\bpayload\.system\s*=\s*\w+\s*;/, 'payload.system = _sys;');
} else if (!/system\s*:\s*body\.system/.test(original)) {
  // Neither pattern found — append a safety override right before the fetch
  // so _sys is always propagated regardless of how the payload was built.
  src = src.replace(
    /(\n[ \t]*)((?:const|let|var)\s+\w+\s*=\s*await\s+fetch\s*\(\s*['"`]https:\/\/api\.anthropic\.com\/v1\/messages['"`])/,
    (_m, indent, fetchLine) => '\n' + indent + '  if (_sys) payload.system = _sys;\n' + indent + fetchLine
  );
}

// Add anthropic-beta header for prompt caching (idempotent)
if (!src.includes('prompt-caching-2024-07-31')) {
  // Try single-quote version
  if (/'anthropic-version'/.test(src)) {
    src = src.replace(/'anthropic-version'/, "'anthropic-beta': 'prompt-caching-2024-07-31',\n        'anthropic-version'");
  } else if (/"anthropic-version"/.test(src)) {
    src = src.replace(/"anthropic-version"/, '"anthropic-beta": "prompt-caching-2024-07-31",\n        "anthropic-version"');
  } else {
    console.warn('WARN: anthropic-version header not found – skipping beta header insertion');
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Patch B: Fire-and-forget usage logging
// Insert after the line that assigns the parsed JSON response to `data`
// ─────────────────────────────────────────────────────────────────────────
const LOGGING_CODE = `
  // fire-and-forget per-shop usage logging
  try {
    const u = data && data.usage ? data.usage : null;
    if (u) {
      const SB_URL = Deno.env.get('SUPABASE_URL');
      const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const shopId = (body && (body.shop_id || body.shopId)) || req.headers.get('x-shop-id') || null;
      const tier = (body && body.tier) || null;
      if (SB_URL && SB_KEY) {
        fetch(SB_URL + '/rest/v1/ai_usage_log', {
          method:'POST',
          headers:{ 'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'return=minimal' },
          body: JSON.stringify({
            shop_id: shopId, model: body.model || null, tier,
            input_tokens: u.input_tokens||0, output_tokens: u.output_tokens||0,
            cache_read_input_tokens: u.cache_read_input_tokens||0,
            cache_creation_input_tokens: u.cache_creation_input_tokens||0
          })
        }).catch(()=>{});
      }
    }
  } catch(_e){ /* never break the AI call */ }`;

// Match: const|let|var data = await someVar.json()  (with optional semicolon)
const dataJsonRe = /(\n[ \t]*(?:const|let|var)\s+data\s*=\s*await\s+\w+\.json\(\)\s*;?)/;
if (dataJsonRe.test(src)) {
  src = src.replace(dataJsonRe, (match) => {
    // Ensure the statement ends with a semicolon before appending
    const stmt = match.trimEnd().endsWith(';') ? match.trimEnd() : match.trimEnd() + ';';
    return stmt + LOGGING_CODE;
  });
} else {
  console.error('ERROR: Could not find "const data = await X.json()"');
  process.exit(1);
}

// ── Final guard ──────────────────────────────────────────────────────────
if (src === original) {
  console.error('ERROR: Source unchanged after patching – something went wrong.');
  process.exit(1);
}

fs.writeFileSync(funcPath, src, 'utf8');
console.log('Patches A and B applied successfully to', funcPath);
