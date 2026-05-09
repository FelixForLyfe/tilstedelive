-- Trial system: backfill existing organisations
-- trial_ends_at column was added in 20260509200000_superadmin.sql

-- 1. Set trial_ends_at = created_at + 30 days for all orgs that don't have it yet
UPDATE public.organizations
  SET trial_ends_at = created_at + INTERVAL '30 days'
  WHERE trial_ends_at IS NULL;

-- 2. Move free orgs (no Stripe subscription) from 'active' to 'trialing'
--    so the trial banner and expiry logic applies correctly
UPDATE public.organizations
  SET subscription_status = 'trialing'
  WHERE subscription_status = 'active'
    AND stripe_customer_id IS NULL
    AND subscription_tier = 'gratis';
