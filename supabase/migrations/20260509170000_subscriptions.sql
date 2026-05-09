-- Subscription tracking for Stripe billing

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'gratis'
    CHECK (subscription_tier IN ('gratis', 'basis', 'pro', 'organisation')),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'active'
    CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing')),
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

CREATE INDEX IF NOT EXISTS orgs_stripe_customer_idx
  ON public.organizations (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
