-- Custom plans table for bespoke per-organisation agreements

CREATE TABLE IF NOT EXISTS public.custom_plans (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            TEXT        NOT NULL,
  price_dkk       INTEGER     NOT NULL DEFAULT 0,
  description     TEXT,
  start_date      DATE        NOT NULL,
  end_date        DATE,
  status          TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'expired', 'cancelled')),
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_plans FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin manage custom plans" ON public.custom_plans;
CREATE POLICY "superadmin manage custom plans"
  ON public.custom_plans FOR ALL TO authenticated
  USING      (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE INDEX IF NOT EXISTS custom_plans_org_idx ON public.custom_plans (organization_id);
