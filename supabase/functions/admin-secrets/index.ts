// admin-secrets — super-admin-ONLY management of provider API keys (fallback).
// Stores keys in the RLS-locked provider_keys table via the service role.
// NEVER returns full keys: reads return a masked status (last 4 chars only).

const SUPER_ADMIN_SHOP_IDS = ['c162329a-ecd9-44d3-b3fc-f107fe101590'];

const mask = (v: string | null | undefined) =>
  v && String(v).length > 0 ? '••••' + String(v).slice(-4) : null;

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-shop-id',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (o: unknown, status = 200) =>
    new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const shopId = body.shop_id || req.headers.get('x-shop-id');
    if (!shopId || SUPER_ADMIN_SHOP_IDS.indexOf(shopId) === -1) {
      return json({ error: 'forbidden' }, 403);
    }

    const SB_URL = Deno.env.get('SUPABASE_URL');
    const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SB_URL || !SB_KEY) return json({ error: 'server not configured' }, 500);
    const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

    const action = body.action || 'get';

    if (action === 'set') {
      // Upsert only the fields provided. Empty string clears a key. undefined = leave as-is.
      const k = body.keys || {};
      const m = body.models || {};
      const patch: Record<string, unknown> = { id: 'global', updated_at: new Date().toISOString() };
      if (k.gemini !== undefined) patch.gemini_api_key = k.gemini || null;
      if (k.openai !== undefined) patch.openai_api_key = k.openai || null;
      if (k.deepseek !== undefined) patch.deepseek_api_key = k.deepseek || null;
      if (m.gemini !== undefined) patch.gemini_model = m.gemini || null;
      if (m.openai !== undefined) patch.openai_model = m.openai || null;
      if (m.deepseek !== undefined) patch.deepseek_model = m.deepseek || null;
      if (body.order !== undefined) patch.fallback_order = body.order || null;

      const r = await fetch(SB_URL + '/rest/v1/provider_keys?on_conflict=id', {
        method: 'POST',
        headers: { ...H, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(patch),
      });
      if (!r.ok) return json({ error: 'write failed: ' + (await r.text()).slice(0, 160) }, 500);
      return json({ ok: true });
    }

    // action === 'get' -> masked status only
    const r = await fetch(SB_URL + '/rest/v1/provider_keys?id=eq.global&select=*', { headers: H });
    const rows = await r.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    return json({
      keys: {
        gemini: mask(row?.gemini_api_key),
        openai: mask(row?.openai_api_key),
        deepseek: mask(row?.deepseek_api_key),
      },
      models: {
        gemini: row?.gemini_model || '',
        openai: row?.openai_model || '',
        deepseek: row?.deepseek_model || '',
      },
      order: row?.fallback_order || 'gemini,openai,deepseek',
      updated_at: row?.updated_at || null,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
