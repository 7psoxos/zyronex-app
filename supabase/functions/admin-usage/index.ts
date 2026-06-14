// admin-usage — super-admin-ONLY AI usage/cost aggregation from ai_usage_log.
// Locked: only requests whose shop_id is in SUPER_ADMIN_SHOP_IDS get data; everyone else 403.
// Reads ai_usage_log via the service role (anon never sees other shops' usage).

const SUPER_ADMIN_SHOP_IDS = ['c162329a-ecd9-44d3-b3fc-f107fe101590'];

// USD price per 1M tokens. cache_read = 0.1x input, cache_write = 1.25x input.
const PRICES: Record<string, { in: number; out: number }> = {
  'claude-opus-4-8': { in: 5, out: 25 },
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-sonnet-4-5': { in: 3, out: 15 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  // Fallback providers
  'gpt-5.5': { in: 5, out: 30 },
  'gemini-3-pro': { in: 2, out: 12 },
  'gemini-2.5-pro': { in: 1.25, out: 10 },
  'deepseek-chat': { in: 0.3, out: 1.2 },
};
const DEFAULT_PRICE = { in: 3, out: 15 };
const priceFor = (m: string) => PRICES[m] || DEFAULT_PRICE;

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

    const days = Math.min(Math.max(parseInt(body.days) || 30, 1), 365);
    const SB_URL = Deno.env.get('SUPABASE_URL');
    const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SB_URL || !SB_KEY) return json({ error: 'server not configured' }, 500);

    const since = new Date(Date.now() - days * 86400000).toISOString();
    const url =
      SB_URL +
      '/rest/v1/ai_usage_log?select=shop_id,model,tier,input_tokens,output_tokens,cache_read_input_tokens,cache_creation_input_tokens,created_at' +
      '&created_at=gte.' + encodeURIComponent(since) + '&limit=200000';
    const r = await fetch(url, { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } });
    const rows = await r.json();
    const list: any[] = Array.isArray(rows) ? rows : [];

    const cost = (row: any) => {
      const p = priceFor(row.model || '');
      return (
        ((row.input_tokens || 0) / 1e6) * p.in +
        ((row.output_tokens || 0) / 1e6) * p.out +
        ((row.cache_read_input_tokens || 0) / 1e6) * p.in * 0.1 +
        ((row.cache_creation_input_tokens || 0) / 1e6) * p.in * 1.25
      );
    };

    const totals = { calls: 0, input: 0, output: 0, cache_read: 0, cache_write: 0, cost: 0, cost_if_uncached: 0 };
    const byModel: Record<string, any> = {}, byFeature: Record<string, any> = {}, byShop: Record<string, any> = {};

    for (const row of list) {
      const c = cost(row);
      const p = priceFor(row.model || '');
      totals.calls++;
      totals.input += row.input_tokens || 0;
      totals.output += row.output_tokens || 0;
      totals.cache_read += row.cache_read_input_tokens || 0;
      totals.cache_write += row.cache_creation_input_tokens || 0;
      totals.cost += c;
      // saving = the 90% discount we got on cache_read tokens
      totals.cost_if_uncached += c + ((row.cache_read_input_tokens || 0) / 1e6) * p.in * 0.9;

      const mk = row.model || '?';
      (byModel[mk] = byModel[mk] || { model: mk, calls: 0, input: 0, output: 0, cache_read: 0, cost: 0 });
      byModel[mk].calls++; byModel[mk].input += row.input_tokens || 0; byModel[mk].output += row.output_tokens || 0;
      byModel[mk].cache_read += row.cache_read_input_tokens || 0; byModel[mk].cost += c;

      const fk = row.tier || '—';
      (byFeature[fk] = byFeature[fk] || { tier: fk, calls: 0, cost: 0 });
      byFeature[fk].calls++; byFeature[fk].cost += c;

      const sk = row.shop_id || '—';
      (byShop[sk] = byShop[sk] || { shop_id: sk, calls: 0, cost: 0 });
      byShop[sk].calls++; byShop[sk].cost += c;
    }

    return json({
      days,
      totals,
      cache_hit_pct: (totals.input + totals.cache_read) > 0 ? (totals.cache_read / (totals.input + totals.cache_read)) * 100 : 0,
      saved: totals.cost_if_uncached - totals.cost,
      by_model: Object.values(byModel).sort((a: any, b: any) => b.cost - a.cost),
      by_feature: Object.values(byFeature).sort((a: any, b: any) => b.cost - a.cost),
      by_shop: Object.values(byShop).sort((a: any, b: any) => b.cost - a.cost),
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
