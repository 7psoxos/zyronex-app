#!/usr/bin/env node
// Applies Patch C (multi-provider fallback) to the downloaded+A+B-patched claude-proxy function.
// Idempotent: if markers already present, exits 0 immediately.
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

// ── Guard: fully patched ─────────────────────────────────────────────────────
if (src.includes('_anthropicFetchError') && src.includes('callFallback') && src.includes('./fallback.ts')) {
  console.log('Fallback patch already present – nothing to do.');
  process.exit(0);
}

// ── 1. Add import at top (before Deno.serve) ─────────────────────────────────
const IMPORT_LINE = 'import { callFallback, shouldFallback } from "./fallback.ts";\n';
if (!src.includes('./fallback.ts')) {
  if (src.includes('\nDeno.serve(')) {
    src = src.replace(/(\nDeno\.serve\()/, '\n' + IMPORT_LINE + '$1');
  } else {
    src = IMPORT_LINE + src;
  }
}

// ── 2. Wrap the Anthropic fetch in an inner try/catch ────────────────────────
// The fetch call looks like:
//   const aiRes = await fetch("https://api.anthropic.com/v1/messages", { ... });
// We match from "const aiRes = await fetch(" through the closing "});"
const fetchRe = /([ \t]*)(const aiRes = await fetch\("https:\/\/api\.anthropic\.com\/v1\/messages",[\s\S]*?\n[ \t]*\}\s*\)\s*;)/;
if (!fetchRe.test(src)) {
  console.error('ERROR: Could not locate Anthropic fetch call to wrap in try/catch.');
  process.exit(1);
}
src = src.replace(fetchRe, (_match, indent, fetchCall) => {
  return (
    indent + '// deno-lint-ignore no-explicit-any\n' +
    indent + 'let aiRes: any = null;\n' +
    indent + 'let _anthropicFetchError: unknown = null;\n' +
    indent + 'try {\n' +
    indent + '  ' + fetchCall.trim().replace(/\n/g, '\n  ' + indent) + '\n' +
    indent + '} catch (_err) { _anthropicFetchError = _err; }'
  );
});

// ── 3. Insert fallback block before `const data = await aiRes` ───────────────
const FALLBACK_BLOCK = `
  // Patch C: multi-provider fallback – fires when Anthropic is unavailable/overloaded
  if (_anthropicFetchError || shouldFallback(aiRes?.status ?? 500)) {
    const _fbPayload = { model: body.model, system: body.system, messages, max_tokens };
    const _fb = await callFallback(_fbPayload);
    if (_fb !== null) {
      try {
        const _fbu = _fb.usage;
        if (_fbu) {
          const SB_URL = Deno.env.get('SUPABASE_URL');
          const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
          const shopId = (body && (body.shop_id || body.shopId)) || req.headers.get('x-shop-id') || null;
          if (SB_URL && SB_KEY) {
            fetch(SB_URL + '/rest/v1/ai_usage_log', {
              method:'POST',
              headers:{'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'return=minimal'},
              body: JSON.stringify({
                shop_id: shopId, model: (_fb._fallback && _fb._fallback.model) || null,
                tier: (body && body.tier) || 'fallback',
                input_tokens: _fbu.input_tokens||0, output_tokens: _fbu.output_tokens||0,
                cache_read_input_tokens: 0, cache_creation_input_tokens: 0
              })
            }).catch(()=>{});
          }
        }
      } catch(_e){ /* never break */ }
      return new Response(JSON.stringify(_fb), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    // Fallback exhausted. If the fetch threw, return a 500; otherwise fall through
    // to return the original Anthropic error response unchanged.
    if (_anthropicFetchError) {
      return new Response(JSON.stringify({ error: String(_anthropicFetchError) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
  }`;

const dataRe = /(\n[ \t]*const data = await aiRes\.json\(\)\s*;?)/;
if (!dataRe.test(src)) {
  console.error('ERROR: Could not find "const data = await aiRes.json()" to insert fallback block before.');
  process.exit(1);
}
src = src.replace(dataRe, (match) => FALLBACK_BLOCK + match);

// ── Final guard ──────────────────────────────────────────────────────────────
if (src === original) {
  console.error('ERROR: Source unchanged after fallback patching.');
  process.exit(1);
}

fs.writeFileSync(funcPath, src, 'utf8');
console.log('Patch C (fallback) applied successfully to', funcPath);
