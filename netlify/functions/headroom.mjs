// ── ZyroNex Headroom AI Proxy — Netlify Function (scale-to-zero, no VPS) ──
// Deploys with the normal git push. Needs ONE env var: SUPABASE_SERVICE_ROLE_KEY
// (service-role key MUST live server-side; placing it in client code would be a breach).
import { createClient } from '@supabase/supabase-js';
import { assertStoreMatch, evaluateGate, priceUsd, compressContext } from './headroom-logic.mjs';

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

    // 1) VERIFY the JWT signature (not just decode) via Supabase, then read shop_id claim.
    const auth = createClient(SUPABASE_URL, ANON_KEY||SERVICE_KEY);
    const { data:userRes, error:uErr } = await auth.auth.getUser(token);
    if(uErr || !userRes || !userRes.user) return json(401,{error:'invalid_token'});
    let shopClaim=null;
    try{ shopClaim = JSON.parse(Buffer.from(token.split('.')[1],'base64').toString()).shop_id || null; }catch(_){}

    // 2) SECURITY: header store must equal the verified JWT shop claim (cross-tenant block).
    const m = assertStoreMatch(shopClaim, storeHeader);
    if(!m.ok) return json(m.code,{error:m.reason});
    const storeId = m.storeId;

    const db = createClient(SUPABASE_URL, SERVICE_KEY);   // server-side only

    // 3) Subscription / limit gate
    const { data:settings } = await db.from('ai_store_settings').select('*').eq('store_id',storeId).maybeSingle();
    const firstOfMonth = new Date(); firstOfMonth.setUTCDate(1); firstOfMonth.setUTCHours(0,0,0,0);
    const { data:usageRows } = await db.from('ai_proxy_usage')
      .select('compressed_input_tokens,raw_output_tokens').eq('store_id',storeId)
      .gte('usage_day', firstOfMonth.toISOString().slice(0,10));
    const monthlyTokens = (usageRows||[]).reduce((a,r)=>a+(r.compressed_input_tokens||0)+(r.raw_output_tokens||0),0);
    const gate = evaluateGate(settings, monthlyTokens);
    if(!gate.allow){
      await db.from('ai_proxy_log').insert({ store_id:storeId, event:'blocked', detail:{reason:gate.reason} });
      return json(gate.code,{error:gate.reason, reason:gate.reason, blocked:true});
    }

    // 4) Compress context (persisted per-store context loaded from DB)
    const body = JSON.parse(event.body||'{}');
    const model = body.model || 'claude-sonnet-4-6';
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const { data:ctxRows } = await db.from('ai_proxy_context').select('ctx_key,ctx_value').eq('store_id',storeId);
    const storedCtx = {}; (ctxRows||[]).forEach(r=>{ try{ storedCtx[r.ctx_key]= (r.ctx_value&&r.ctx_value.text)||''; }catch(_){} });
    const comp = compressContext(messages, storedCtx);

    // 5) Forward to the existing AI proxy (claude-proxy) with compressed messages
    const aiResp = await fetch(SUPABASE_URL+'/functions/v1/claude-proxy',{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':'Bearer '+(ANON_KEY||token),'apikey':ANON_KEY},
      body: JSON.stringify({ ...body, messages: comp.messages })
    });
    const aiText = await aiResp.text();
    let aiJson={}; try{ aiJson=JSON.parse(aiText); }catch(_){ aiJson={ raw:aiText }; }
    const outTokens = (aiJson.usage&&(aiJson.usage.output_tokens||aiJson.usage.completion_tokens)) || 0;

    // 6) Cost: raw (no Headroom) vs actual (with Headroom)
    const rawCost    = priceUsd(model, comp.rawInTokens, outTokens);
    const actualCost = priceUsd(model, comp.compInTokens, outTokens);

    // 7) ATOMIC usage record (race-free RPC) + append-only audit log
    await db.rpc('headroom_record_usage',{ p_store:storeId, p_model:model,
      p_raw_in:comp.rawInTokens, p_raw_out:outTokens, p_comp_in:comp.compInTokens,
      p_raw_cost:rawCost, p_actual_cost:actualCost });
    await db.from('ai_proxy_log').insert({ store_id:storeId, model, event:'call',
      raw_tokens:comp.rawInTokens, comp_tokens:comp.compInTokens,
      detail:{ saved:comp.savedTokens, raw_cost:rawCost, actual_cost:actualCost } });

    return json(aiResp.status, { ...aiJson,
      headroom:{ saved_tokens:comp.savedTokens, raw_in:comp.rawInTokens, comp_in:comp.compInTokens,
                 raw_cost_usd:rawCost, actual_cost_usd:actualCost } });
  }catch(err){
    return json(500,{error:'headroom_error', detail:String(err&&err.message||err)});
  }
}
