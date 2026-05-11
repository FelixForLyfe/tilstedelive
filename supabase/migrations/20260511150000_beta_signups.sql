-- Beta interest / early adopter signups
-- Collected from the landing page "Vær med fra starten" section

create table if not exists public.beta_signups (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text not null,
  email       text not null,
  org_type    text not null,  -- sfo | forening | butik | andet
  org_name    text,
  role        text,           -- free text: "Leder", "Frivillig" etc.
  message     text,
  source      text default 'landing'
);

-- Emails must be unique so the same person can't submit twice
create unique index if not exists beta_signups_email_idx on public.beta_signups (email);

-- Public insert only — no read access (we read via service role in admin)
alter table public.beta_signups enable row level security;

create policy "anyone can sign up for beta"
  on public.beta_signups
  for insert
  to anon, authenticated
  with check (true);

-- Only service role can select (admin dashboard reads it)
create policy "service role reads all"
  on public.beta_signups
  for select
  to service_role
  using (true);
