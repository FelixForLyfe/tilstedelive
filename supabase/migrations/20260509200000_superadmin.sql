-- ============================================================================
-- Superadmin panel infrastructure
-- ============================================================================

-- 1. Role column on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'superadmin'));

-- 2. Assign the known superadmin
UPDATE public.profiles
  SET role = 'superadmin'
  WHERE id = 'd63bcc48-ade2-4f3c-affe-e7f1cfe8440f';

-- 3. is_superadmin helper (SECURITY INVOKER — runs as the calling user)
CREATE OR REPLACE FUNCTION public.is_superadmin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = 'superadmin'
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_superadmin(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_superadmin(uuid) TO authenticated;

-- 4. Extend audit_logs with superadmin columns
ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS action_type TEXT NOT NULL DEFAULT 'db_trigger'
    CHECK (action_type IN ('db_trigger', 'superadmin_action')),
  ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Superadmin can read all audit logs (cross-org)
DROP POLICY IF EXISTS "superadmin read all audit logs" ON public.audit_logs;
CREATE POLICY "superadmin read all audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- 5. Add trial_ends_at to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- 6. Extend subscription_tier to include superadmin-only plan types
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_tier_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_subscription_tier_check
    CHECK (subscription_tier IN ('gratis', 'basis', 'pro', 'organisation', 'kommune', 'special'));

-- 7. Extend subscription_status to include 'expired'
ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_subscription_status_check
    CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'trialing', 'expired'));

-- 8. Superadmin cross-org RLS policies

DROP POLICY IF EXISTS "superadmin read all orgs"   ON public.organizations;
CREATE POLICY "superadmin read all orgs"
  ON public.organizations FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "superadmin update all orgs" ON public.organizations;
CREATE POLICY "superadmin update all orgs"
  ON public.organizations FOR UPDATE TO authenticated
  USING       (public.is_superadmin(auth.uid()))
  WITH CHECK  (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "superadmin read all members" ON public.organization_members;
CREATE POLICY "superadmin read all members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "superadmin read all profiles" ON public.profiles;
CREATE POLICY "superadmin read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.is_superadmin(auth.uid()));

-- 9. plan_keys table
CREATE TABLE IF NOT EXISTS public.plan_keys (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE,
  plan_type   TEXT        NOT NULL
                CHECK (plan_type IN ('basis', 'pro', 'organisation', 'kommune', 'special')),
  used        BOOLEAN     NOT NULL DEFAULT FALSE,
  used_by     UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  used_at     TIMESTAMPTZ,
  created_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plan_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_keys FORCE ROW LEVEL SECURITY;

-- Superadmins manage all keys; org admins may redeem via server function (service role)
DROP POLICY IF EXISTS "superadmin manage plan keys" ON public.plan_keys;
CREATE POLICY "superadmin manage plan keys"
  ON public.plan_keys FOR ALL TO authenticated
  USING      (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));
