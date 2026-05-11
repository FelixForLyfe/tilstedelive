-- Add Stripe Price ID to custom_plans so checkout can use custom pricing

ALTER TABLE public.custom_plans
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
