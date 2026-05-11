-- 2FA: backup codes table + org-level require_2fa toggle

create table if not exists public.backup_codes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  code_hash  text        not null,
  used       boolean     not null default false,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table public.backup_codes enable row level security;

-- Users can view their own backup code statuses (hashes are never exposed to clients)
create policy "users can view own backup codes"
  on public.backup_codes for select
  to authenticated
  using (user_id = auth.uid());

-- Service role can manage everything (used by server functions)
create policy "service role manages backup codes"
  on public.backup_codes for all
  to service_role
  using (true)
  with check (true);

create index if not exists backup_codes_user_idx on public.backup_codes (user_id, used);

-- Organisation-level 2FA enforcement
alter table public.organizations
  add column if not exists require_2fa boolean not null default false;
