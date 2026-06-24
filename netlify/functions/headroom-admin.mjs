// ── Headroom Admin aggregator — multi-tenant read + admin writes (service role) ──
// Admin-gated by ADMIN_API_KEY env. Deploys with git push. No SQL.
import { createClient } from '@supabase/supabase-js';
const CORS = { 'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Headers':'authorization, content-type, apikey',
  'Access-Control-Allow-Methods':'POST, OPTIONS' };
const json=(c,o)=>({statusCode:c,headers:{...CORS,'Content-Type':'application/json'},body:JSON.stringify(o)});

export function aggregate(usage, settings){
  // usage: rows {store_id,model,calls,raw_input_tokens,raw_output_tokens,compressed_input_tokens,raw_cost_usd,actual_cost_usd}
  const byStore={}, byModel={}; let g={saved:0,raw_cost:0,actual_cost:0,calls:0,raw_in:0,comp_in:0};
  for(const r of usage){
    const s=byStore[r.store_id] || (byStore[r.store_id]={store_id:r.store_id,calls:0,raw_in:0,comp_in:0,raw_cost:0,actual_cost:0,out:0});
    s.calls+=+r.calls||0; s.raw_in+=+r.raw_input_tokens||0; s.comp_in+=+r.compressed_input_tokens||0;
    s.raw_cost+=+r.raw_cost_usd||0; s.actual_cost+=+r.actual_cost_usd||0; s.out+=+r.raw_output_tokens||0;
    const m=byModel[r.model] || (byModel[r.model]={model:r.model,raw_cost:0,actual_cost:0,raw_in:0,comp_in:0,calls:0});
    m.raw_cost+=+r.raw_cost_usd||0; m.actual_cost+=+r.actual_cost_usd||0; m.raw_in+=+r.raw_input_tokens||0; m.comp_in+=+r.compressed_input_tokens||0; m.calls+=+r.calls||0;
    g.raw_cost+=+r.raw_cost_usd||0; g.actual_cost+=+r.actual_cost_usd||0; g.calls+=+r.calls||0;
    g.raw_in+=+r.raw_input_tokens||0; g.comp_in+=+r.compressed_input_tokens||0;
  }
  g.saved=Math.max(0,g.raw_in-g.comp_in);
  const setMap={}; (settings||[]).forEach(s=>setMap[s.store_id]=s);
  const stores=Object.values(byStore).map(s=>({ ...s,
    saved_tokens:Math.max(0,s.raw_in-s.comp_in),
    compression_pct: s.raw_in>0 ? +(100*(s.raw_in-s.comp_in)/s.raw_in).toFixed(1) : 0,
    settings: setMap[s.store_id] || null }));
  const models=Object.values(byModel).map(m=>({ ...m,
    compression_pct: m.raw_in>0 ? +(100*(m.raw_in-m.comp_in)/m.raw_in).toFixed(1):0 }));
  const roi = g.actual_cost>0 ? +(100*(g.raw_cost-g.actual_cost)/g.actual_cost).toFixed(1) : 0;
  return { global:{ ...g, saved_tokens:g.saved, roi_pct:roi,
           compression_pct: g.raw_in>0 ? +(100*(g.raw_in-g.comp_in)/g.raw_in).toFixed(1):0 },
           stores, models };
}

export async function handler(event){
  if(event.httpMethod==='OPTIONS') return {statusCode:204,headers:CORS,body:''};
  if(event.httpMethod!=='POST') return json(405,{error:'method_not_allowed'});
  const URL = process.env.SUPABASE_URL || 'https://wopyucsdaeamywscxfzs.supabase.co';
  const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const ANON = process.env.SUPABASE_ANON_KEY || '';
  const authz = (event.headers['authorization']||event.headers['Authorization']||'').replace(/^Bearer\s+/i,'').trim();
  if(!ANON || authz!==ANON) return json(403,{error:'admin_unauthorized'});
  try{
    const db=createClient(URL,SVC);
    const body=JSON.parse(event.body||'{}'); const action=body.action||'overview';
    if(action==='overview'){
      const since=body.since || new Date(Date.now()-30*864e5).toISOString().slice(0,10);
      const { data:usage } = await db.from('ai_proxy_usage').select('*').gte('usage_day',since);
      const { data:settings } = await db.from('ai_store_settings').select('*');
      return json(200, aggregate(usage||[], settings||[]));
    }
    if(action==='set_settings'){
      const { store_id, ai_enabled, monthly_token_limit, status, plan } = body;
      if(!store_id) return json(400,{error:'no_store_id'});
      const patch={ store_id, updated_at:new Date().toISOString() };
      if(ai_enabled!==undefined) patch.ai_enabled=!!ai_enabled;
      if(monthly_token_limit!==undefined) patch.monthly_token_limit=Math.max(0,parseInt(monthly_token_limit)||0);
      if(status!==undefined) patch.status=String(status);
      if(plan!==undefined) patch.plan=plan;
      const { error } = await db.from('ai_store_settings').upsert(patch,{onConflict:'store_id'});
      if(error) throw error;
      return json(200,{ ok:true });
    }
    return json(400,{error:'unknown_action'});
  }catch(err){ return json(500,{error:'admin_error',detail:String(err&&err.message||err)}); }
}
