-- Promo / multi-use support for plan_keys

ALTER TABLE public.plan_keys
  ADD COLUMN IF NOT EXISTS is_promo    BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS max_uses    INT         NULL,
  ADD COLUMN IF NOT EXISTS uses_count  INT         NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ NULL;

-- Track per-org redemptions (prevents double-redeeming same code)
CREATE TABLE IF NOT EXISTS public.plan_key_redemptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key_id       UUID        NOT NULL REFERENCES public.plan_keys(id) ON DELETE CASCADE,
  org_id       UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (key_id, org_id)
);
ALTER TABLE public.plan_key_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_key_redemptions FORCE ROW LEVEL SECURITY;
