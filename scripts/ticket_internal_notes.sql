-- ticket_internal_notes: operator-only notes per ticket. RLS-locked: anon/authenticated
-- have NO access -> merchants can never read them (not even via the API). Only the
-- service role (used by the admin-ticket-notes edge function) can read/write.
create table if not exists public.ticket_internal_notes (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null,
  body       text not null,
  author     text,
  created_at timestamptz default now()
);
alter table public.ticket_internal_notes enable row level security;
revoke all on public.ticket_internal_notes from anon, authenticated;
-- No anon/authenticated policies on purpose => only service_role reaches it.
create index if not exists tin_ticket_idx on public.ticket_internal_notes(ticket_id);
