-- Security hardening: remove externally callable SECURITY DEFINER RPCs,
-- tighten policy checks, and keep invite redemption within RLS constraints.

-- 1) Remove legacy helper if it exists (flagged by linter in some environments)
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.rls_auto_enable();

-- 2) Convert exposed helper functions to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND organization_id = _org_id
      AND role = 'admin'
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_day_closed(_org_id uuid, _date date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT is_closed
      FROM public.day_status
      WHERE organization_id = _org_id
        AND date = _date
    ),
    false
  );
$$;

-- 3) Tighten shared-profile policy to active memberships only
DROP POLICY IF EXISTS "users see profiles in shared orgs" ON public.profiles;
CREATE POLICY "users see profiles in shared orgs"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om1
    JOIN public.organization_members om2
      ON om1.organization_id = om2.organization_id
    WHERE om1.user_id = auth.uid()
      AND om2.user_id = public.profiles.id
      AND om1.status = 'active'
      AND om2.status = 'active'
  )
);

-- 4) RLS-native invite redemption support
DROP POLICY IF EXISTS "admins manage invites" ON public.organization_invites;
DROP POLICY IF EXISTS "authenticated can view redeemable invite" ON public.organization_invites;
DROP POLICY IF EXISTS "authenticated can redeem invite row" ON public.organization_invites;
DROP POLICY IF EXISTS "users can join org through redeemed invite" ON public.organization_members;

CREATE POLICY "admins manage invites"
ON public.organization_invites
FOR ALL
TO authenticated
USING (public.is_org_admin(auth.uid(), organization_id))
WITH CHECK (public.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "authenticated can view redeemable invite"
ON public.organization_invites
FOR SELECT
TO authenticated
USING (
  used_at IS NULL
  AND expires_at > now()
);

CREATE POLICY "authenticated can redeem invite row"
ON public.organization_invites
FOR UPDATE
TO authenticated
USING (
  used_at IS NULL
  AND expires_at > now()
)
WITH CHECK (
  used_by = auth.uid()
  AND used_at IS NOT NULL
  AND expires_at > now()
);

CREATE POLICY "users can join org through redeemed invite"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.organization_invites oi
    WHERE oi.organization_id = organization_id
      AND oi.role = role
      AND oi.used_by = auth.uid()
      AND oi.used_at IS NOT NULL
      AND oi.expires_at > now()
      AND oi.used_at > now() - interval '10 minutes'
  )
);

-- 5) Redeem function stays client-callable, but no longer escalates privileges
CREATE OR REPLACE FUNCTION public.redeem_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org_id uuid;
  v_role public.app_role;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  UPDATE public.organization_invites
  SET used_by = v_user, used_at = now()
  WHERE code = _code
    AND used_at IS NULL
    AND expires_at > now()
  RETURNING organization_id, role
  INTO v_org_id, v_role;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Ugyldig eller udløbet kode';
  END IF;

  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_org_id, v_user, v_role, 'active')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN v_org_id;
END;
$$;

-- 6) Explicit execute grants/revokes for exposed functions
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_day_closed(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_invite(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_day_closed(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;
