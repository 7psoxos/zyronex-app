// ── Headroom pure logic (no I/O) — shared by the Edge Function + tests ──
// Per-model pricing, USD per 1,000,000 tokens. Configurable.
export const PRICING = {
  'claude-opus-4-8':              { in: 15.00, out: 75.00 },
  'claude-sonnet-4-6':            { in:  3.00, out: 15.00 },
  'claude-haiku-4-5-20251001':    { in:  0.80, out:  4.00 },
  'or:openai/gpt-4o-mini':        { in:  0.15, out:  0.60 },
  'or:deepseek/deepseek-chat':    { in:  0.27, out:  1.10 },
  'or:meta-llama/llama-3.3-70b-instruct': { in: 0.59, out: 0.79 },
  'or:google/gemini-2.0-flash':   { in:  0.075, out: 0.30 },
  '_default':                     { in:  3.00, out: 15.00 }
};
export function priceUsd(model, inTok, outTok){
  const p = PRICING[model] || PRICING['_default'];
  return (Number(inTok||0)/1e6)*p.in + (Number(outTok||0)/1e6)*p.out;
}
// Rough token estimate (chars/4). Deterministic; used only for compression accounting.
export function estTokens(s){ return Math.ceil((String(s||'').length)/4); }

// SECURITY: the request store header MUST equal the verified JWT shop claim.
// Returns {ok:true,storeId} or {ok:false,code,reason}. Never throws on bad input.
export function assertStoreMatch(jwtShopId, headerStoreId){
  if(!jwtShopId)    return { ok:false, code:401, reason:'no_shop_claim' };
  if(!headerStoreId)return { ok:false, code:400, reason:'no_store_header' };
  if(String(jwtShopId) !== String(headerStoreId))
                    return { ok:false, code:403, reason:'cross_tenant_blocked' };
  return { ok:true, storeId:String(headerStoreId) };
}
// SUBSCRIPTION/limit gate. settings may be null (not configured -> active/unlimited).
export function evaluateGate(settings, monthlyTokens){
  if(!settings) return { allow:true };
  if(settings.ai_enabled === false)      return { allow:false, code:403, reason:'ai_disabled' };
  if(settings.status === 'suspended')    return { allow:false, code:403, reason:'suspended' };
  if(settings.status === 'past_due')     return { allow:false, code:402, reason:'past_due' };
  const lim = Number(settings.monthly_token_limit||0);
  if(lim > 0 && Number(monthlyTokens||0) >= lim)
                                         return { allow:false, code:429, reason:'limit_exceeded' };
  return { allow:true };
}
// HEADROOM COMPRESSION (lossless-safe): dedup identical blocks + collapse whitespace +
// replace any block already persisted in the store's context with a short reference.
// Returns { messages, rawInTokens, compInTokens, savedTokens }. NEVER drops unique info.
export function compressContext(messages, storedCtx){
  storedCtx = storedCtx || {};
  const rawInTokens = messages.reduce((a,m)=>a+estTokens(m.content),0);
  const seen = new Set();
  const out = [];
  for(const m of messages){
    let c = String(m.content==null?'':m.content);
    c = c.replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();   // whitespace
    const key = m.role+'|'+c;
    if(seen.has(key)) continue;                                      // exact dup -> drop
    seen.add(key);
    // if this exact block is persisted server-side, send a tiny reference instead
    const ref = Object.keys(storedCtx).find(k => storedCtx[k] === c);
    if(ref && c.length > 40){ out.push({ role:m.role, content:'[[ctx:'+ref+']]' }); }
    else { out.push({ role:m.role, content:c }); }
  }
  const compInTokens = out.reduce((a,m)=>a+estTokens(m.content),0);
  return { messages:out, rawInTokens, compInTokens, savedTokens: Math.max(0, rawInTokens-compInTokens) };
}
