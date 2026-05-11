-- Public reviews submitted from the landing page

create table if not exists public.public_reviews (
  id           uuid        primary key default gen_random_uuid(),
  stars        int         not null check (stars between 1 and 5),
  name         text,
  org_type     text,
  review_text  text,
  gdpr_consent boolean     not null default false,
  created_at   timestamptz not null default now(),
  approved     boolean     not null default false
);

alter table public.public_reviews enable row level security;

-- Anyone can submit (insert) if they gave GDPR consent
create policy "anyone can submit review"
  on public.public_reviews for insert
  to anon, authenticated
  with check (gdpr_consent = true);

-- Anyone can read approved reviews
create policy "anyone can read approved reviews"
  on public.public_reviews for select
  to anon, authenticated
  using (approved = true);

-- Service role can do everything (for superadmin management)
create policy "service role manages reviews"
  on public.public_reviews for all
  to service_role
  using (true)
  with check (true);

create index if not exists reviews_approved_idx on public.public_reviews (approved, created_at desc);
