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

// ── Guard: skip if patches already applied ────────────────────────────────
if (src.includes('cache_control') || src.includes('ai_usage_log')) {
  console.log('Patches already present – nothing to do.');
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

// Replace system: body.system → system: _sys
if (/system\s*:\s*body\.system/.test(src)) {
  src = src.replace(/system\s*:\s*body\.system/g, 'system: _sys');
} else {
  console.warn('WARN: "system: body.system" not found – the caching normalization code was added but the outgoing payload may already spread body differently.');
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
