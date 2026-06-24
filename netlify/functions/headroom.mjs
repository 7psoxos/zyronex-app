// ── ZyroNex Headroom AI Proxy — Netlify Function (scale-to-zero, no VPS) ──
// Deploys with the normal git push. Needs ONE env var: SUPABASE_SERVICE_ROLE_KEY
// (service-role key MUST live server-side; placing it in client code would be a breach).
import { createClient } from '@supabase/supabase-js';
import { assertStoreMatch, evaluateGate, priceUsd, compressContext } from './headroom-logic.mjs';

// SAFETY FLAG: false = PASSTHROUGH (forward original body unchanged; AI output identical;
// record real cost + PROJECTED savings). Flip to true to actually compress (real savings)
// only after per-feature live testing.
var COMPRESS_ACTIVE = false;

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wopyucsdaeamywscxfzs.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const ANON_KEY     = process.env.SUPABASE_ANON_KEY || '';
const CORS = { 'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, x-store-id, content-type, apikey',
  'Access-Control-Allow-Methods':'POST, OPTIONS' };
const json = (code,obj)=>({ statusCode:code, headers:{...CORS,'Content-Type':'application/json'}, body:JSON.stringify(obj) });

export async function handler(event){
  if(event.httpMethod==='OPTIONS') return { statusCode:204, headers:CORS, body:'' };
  if(event.httpMethod!=='POST')    return json(405,{error:'method_not_allowed'});
  try{
    const storeHeader = event.headers['x-store-id'] || event.headers['X-Store-ID'];
    const authz = event.headers['authorization'] || event.headers['Authorization'] || '';
    const token = authz.replace(/^Bearer\s+/i,'').trim();
    if(!token) return json(401,{error:'no_token'});

    // ── AUTH ─────────────────────────────────────────────────────────────
    // Trusted single-shop mode: the app calls with the public anon key (no per-user
    // JWT yet) + X-Store-ID. Accept it (documented single-shop posture). When real
    // multi-tenant per-user login lands, those calls carry a user JWT -> strict path
    // below verifies the signature AND that the JWT shop_id matches X-Store-ID.
    let storeId;
    if(ANON_KEY && token === ANON_KEY){
      if(!storeHeader) return json(400,{error:'no_store_header'});
      storeId = String(storeHeader);
    } else {
      const auth = createClient(SUPABASE_URL, ANON_KEY||SERVICE_KEY);
      const { data:userRes, error:uErr } = await auth.auth.getUser(token);
      if(uErr || !userRes || !userRes.user) return json(401,{error:'invalid_token'});
      let shopClaim=null;
      try{ shopClaim = JSON.parse(Buffer.from(token.split('.')[1],'base64').toString()).shop_id || null; }catch(_){}
      const m = assertStoreMatch(shopClaim, storeHeader);
      if(!m.ok) return json(m.code,{error:m.reason});
      storeId = m.storeId;
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);   // server-side only

    // ── GATE (subscription / limit) ──────────────────────────────────────
    const { data:settings } = await db.from('ai_store_settings').select('*').eq('store_id',storeId).maybeSingle();
    const firstOfMonth = new Date(); firstOfMonth.setUTCDate(1); firstOfMonth.setUTCHours(0,0,0,0);
    const { data:usageRows } = await db.from('ai_proxy_usage')
      .select('compressed_input_tokens,raw_output_tokens').eq('store_id',storeId)
      .gte('usage_day', firstOfMonth.toISOString().slice(0,10));
    const monthlyTokens = (usageRows||[]).reduce((a,r)=>a+(r.compressed_input_tokens||0)+(r.raw_output_tokens||0),0);
    const gate = evaluateGate(settings, monthlyTokens);
    if(!gate.allow){
      try{ await db.from('ai_proxy_log').insert({ store_id:storeId, event:'blocked', detail:{reason:gate.reason} }); }catch(_){}
      return json(gate.code,{error:gate.reason, reason:gate.reason, blocked:true});
    }

    // ── METRICS (never alters the payload unless COMPRESS_ACTIVE) ─────────
    const body = JSON.parse(event.body||'{}');
    const model = body.model || 'claude-sonnet-4-6';
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const { data:ctxRows } = await db.from('ai_proxy_context').select('ctx_key,ctx_value').eq('store_id',storeId);
    const storedCtx = {}; (ctxRows||[]).forEach(r=>{ try{ storedCtx[r.ctx_key]=(r.ctx_value&&r.ctx_value.text)||''; }catch(_){} });
    const comp = compressContext(messages, storedCtx);

    // ── FORWARD to claude-proxy ──────────────────────────────────────────
    // PASSTHROUGH: send event.body verbatim so the model sees EXACTLY what the app sent.
    const fwdBody = COMPRESS_ACTIVE ? JSON.stringify({ ...body, messages: comp.messages }) : event.body;
    const aiResp = await fetch(SUPABASE_URL+'/functions/v1/claude-proxy',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'apikey':(ANON_KEY||token)},
      body: fwdBody
    });
    const aiText = await aiResp.text();
    let aiJson={}; try{ aiJson=JSON.parse(aiText); }catch(_){ aiJson={}; }
    const outTokens = (aiJson.usage&&(aiJson.usage.output_tokens||aiJson.usage.completion_tokens)) || 0;

    // ── COST + RECORD (best-effort; must never break the AI response) ─────
    const sentInTokens = COMPRESS_ACTIVE ? comp.compInTokens : comp.rawInTokens;
    const rawCost    = priceUsd(model, comp.rawInTokens, outTokens);  // baseline (no Headroom)
    const actualCost = priceUsd(model, sentInTokens,     outTokens);  // what we actually sent
    try{
      await db.rpc('headroom_record_usage',{ p_store:storeId, p_model:model,
        p_raw_in:comp.rawInTokens, p_raw_out:outTokens, p_comp_in:sentInTokens,
        p_raw_cost:rawCost, p_actual_cost:actualCost });
      await db.from('ai_proxy_log').insert({ store_id:storeId, model, event:'call',
        raw_tokens:comp.rawInTokens, comp_tokens:sentInTokens,
        detail:{ mode: COMPRESS_ACTIVE?'compress':'passthrough',
                 projected_saved: comp.savedTokens, raw_cost:rawCost, actual_cost:actualCost } });
    }catch(_){ /* never block the AI response on a stats failure */ }

    // Return claude-proxy's response VERBATIM (zero behavioral change for the app).
    return { statusCode: aiResp.status,
      headers:{ ...CORS, 'Access-Control-Expose-Headers':'X-Headroom', 'X-Headroom':'pass',
        'Content-Type': aiResp.headers.get('content-type')||'application/json' },
      body: aiText };
  }catch(err){
    return json(500,{error:'headroom_error', detail:String(err&&err.message||err)});
  }
}
