// admin-ticket-notes — super-admin-ONLY internal ticket notes (private from merchants).
// Reads/writes ticket_internal_notes via the service role. 403 for anyone else.

const SUPER_ADMIN_SHOP_IDS = ['c162329a-ecd9-44d3-b3fc-f107fe101590'];

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
    if (!shopId || SUPER_ADMIN_SHOP_IDS.indexOf(shopId) === -1) return json({ error: 'forbidden' }, 403);

    const SB_URL = Deno.env.get('SUPABASE_URL');
    const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!SB_URL || !SB_KEY) return json({ error: 'server not configured' }, 500);
    const H = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };

    const ticketId = body.ticket_id;
    if (!ticketId) return json({ error: 'ticket_id required' }, 400);
    const action = body.action || 'list';

    if (action === 'add') {
      const text = (body.body || '').toString().trim();
      if (!text) return json({ error: 'body required' }, 400);
      const r = await fetch(SB_URL + '/rest/v1/ticket_internal_notes', {
        method: 'POST',
        headers: { ...H, Prefer: 'return=minimal' },
        body: JSON.stringify({ ticket_id: ticketId, body: text, author: body.author || 'Admin' }),
      });
      if (!r.ok) return json({ error: 'write failed: ' + (await r.text()).slice(0, 160) }, 500);
      return json({ ok: true });
    }

    // list
    const r = await fetch(
      SB_URL + '/rest/v1/ticket_internal_notes?ticket_id=eq.' + encodeURIComponent(ticketId) +
      '&select=id,body,author,created_at&order=created_at.asc',
      { headers: H },
    );
    const notes = await r.json();
    return json({ notes: Array.isArray(notes) ? notes : [] });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
