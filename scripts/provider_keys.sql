-- provider_keys: holds AI fallback provider API keys, set from the admin UI.
-- RLS-locked: anon/authenticated have NO access; only the service role (used by the
-- admin-secrets and claude-proxy edge functions) can read/write.
create table if not exists public.provider_keys (
  id               text primary key default 'global',
  gemini_api_key   text,
  openai_api_key   text,
  deepseek_api_key text,
  gemini_model     text,
  openai_model     text,
  deepseek_model   text,
  fallback_order   text,
  updated_at       timestamptz default now()
);

alter table public.provider_keys enable row level security;
revoke all on public.provider_keys from anon, authenticated;
-- No anon/authenticated policies are created on purpose => only service_role reaches it.

insert into public.provider_keys (id) values ('global') on conflict (id) do nothing;
