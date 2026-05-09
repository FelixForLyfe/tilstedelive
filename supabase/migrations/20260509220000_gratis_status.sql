-- Gratis status, gratis_reason column, and monthly_costs table

-- 1. Add 'gratis' to subscription_status enum
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_subscription_status_check
    CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing', 'expired', 'gratis'));

-- 2. gratis_reason: document why an org got free access
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS gratis_reason TEXT;

-- 3. monthly_costs: manual cost tracking for the business dashboard
CREATE TABLE IF NOT EXISTS public.monthly_costs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  month       DATE        NOT NULL,
  category    TEXT        NOT NULL,
  amount_dkk  INTEGER     NOT NULL DEFAULT 0,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month, category)
);
ALTER TABLE public.monthly_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_costs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin manage monthly costs" ON public.monthly_costs;
CREATE POLICY "superadmin manage monthly costs"
  ON public.monthly_costs FOR ALL TO authenticated
  USING      (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));
