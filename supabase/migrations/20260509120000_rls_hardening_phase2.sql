-- =============================================================================
-- RLS Hardening Phase 2
--
-- Fixes all Supabase security linter warnings:
--   • anon_security_definer_function_executable   — rls_auto_enable (dropped)
--   • authenticated_security_definer_function_executable
--       is_org_member, is_org_admin, is_day_closed — moved to private schema
--       redeem_invite — kept in public (intentionally callable, see note below)
--
-- Core strategy
-- ─────────────
-- The three helper functions MUST remain SECURITY DEFINER because they query
-- organization_members / day_status directly, and those tables have RLS
-- policies that call the same helpers → switching to SECURITY INVOKER would
-- cause infinite recursion at runtime.
--
-- Moving them to the `private` schema removes them from PostgREST's API
-- surface (PostgREST only exposes schemas listed in db-schemas, which defaults
-- to "public"). The authenticated role still needs EXECUTE so that RLS policy
-- expressions can invoke them at query time; this does NOT make them callable
-- via /rest/v1/rpc because they are not in the public schema.
--
-- redeem_invite stays in public as SECURITY DEFINER because:
--   1. It IS meant to be called by signed-in users (invite redemption flow).
--   2. SECURITY DEFINER is required for the atomic UPDATE+INSERT to bypass RLS
--      on organization_invites / organization_members; a SECURITY INVOKER
--      version cannot read the just-consumed invite row when checking the
--      membership INSERT policy, causing the entire redemption to fail.
--
-- This migration is idempotent — safe to run whether or not the earlier
-- phase-1 draft migration (20260508215000) was applied.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1.  Remove rls_auto_enable
--     This utility function was never meant to be a public RPC.
--     DROP IF EXISTS removes the function and all associated grants.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.rls_auto_enable();


-- ---------------------------------------------------------------------------
-- 2.  Create the private schema
--     PostgREST ignores schemas not listed in its db-schemas config.
--     authenticated needs USAGE + EXECUTE so RLS expressions can call these
--     functions; anon never reaches policies marked TO authenticated.
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS private;

REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 3.  Private SECURITY DEFINER helpers
--     SECURITY DEFINER → run as function owner (postgres) → bypass RLS on the
--     tables they query, breaking the recursion that would otherwise occur.
--     SET search_path = public pins the resolution to the public schema so
--     no search-path hijacking is possible.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_org_member(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id        = _user_id
      AND organization_id = _org_id
      AND status          = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_org_admin(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id        = _user_id
      AND organization_id = _org_id
      AND role            = 'admin'
      AND status          = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_day_closed(_org_id uuid, _date date)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_closed FROM public.day_status
     WHERE organization_id = _org_id AND date = _date),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION private.is_org_member(uuid, uuid)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_org_admin(uuid, uuid)   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION private.is_day_closed(uuid, date)  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.is_org_member(uuid, uuid)  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_org_admin(uuid, uuid)   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_day_closed(uuid, date)  TO authenticated, service_role;


-- ---------------------------------------------------------------------------
-- 4.  Rebuild every RLS policy that referenced public.is_* to use private.*
--     Pattern: DROP IF EXISTS (handles both fresh and post-phase-1 databases),
--              then CREATE with the private.* call.
-- ---------------------------------------------------------------------------

-- profiles -----------------------------------------------------------------
DROP POLICY IF EXISTS "users see profiles in shared orgs" ON public.profiles;
CREATE POLICY "users see profiles in shared orgs"
ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.organization_members om1
    JOIN public.organization_members om2
      ON om1.organization_id = om2.organization_id
    WHERE om1.user_id  = auth.uid()
      AND om2.user_id  = public.profiles.id
      AND om1.status   = 'active'
      AND om2.status   = 'active'
  )
);

-- organizations ------------------------------------------------------------
DROP POLICY IF EXISTS "members see their orgs" ON public.organizations;
DROP POLICY IF EXISTS "admins update org"       ON public.organizations;
DROP POLICY IF EXISTS "admins delete org"       ON public.organizations;

CREATE POLICY "members see their orgs"
ON public.organizations FOR SELECT TO authenticated
USING (private.is_org_member(auth.uid(), id));

CREATE POLICY "admins update org"
ON public.organizations FOR UPDATE TO authenticated
USING (private.is_org_admin(auth.uid(), id));

CREATE POLICY "admins delete org"
ON public.organizations FOR DELETE TO authenticated
USING (private.is_org_admin(auth.uid(), id));

-- organization_members -----------------------------------------------------
DROP POLICY IF EXISTS "members see members of their orgs"          ON public.organization_members;
DROP POLICY IF EXISTS "admins add members"                          ON public.organization_members;
DROP POLICY IF EXISTS "admins update members"                       ON public.organization_members;
DROP POLICY IF EXISTS "admins remove members"                       ON public.organization_members;
DROP POLICY IF EXISTS "users can join org through redeemed invite"  ON public.organization_members;

CREATE POLICY "members see members of their orgs"
ON public.organization_members FOR SELECT TO authenticated
USING (private.is_org_member(auth.uid(), organization_id) OR user_id = auth.uid());

CREATE POLICY "admins add members"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (private.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "admins update members"
ON public.organization_members FOR UPDATE TO authenticated
USING (private.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "admins remove members"
ON public.organization_members FOR DELETE TO authenticated
USING (private.is_org_admin(auth.uid(), organization_id));

-- (creator can self-add as admin policy has no helper-function references
--  and is intentionally left untouched)

-- categories ---------------------------------------------------------------
DROP POLICY IF EXISTS "members see categories"  ON public.categories;
DROP POLICY IF EXISTS "admins manage categories" ON public.categories;

CREATE POLICY "members see categories"
ON public.categories FOR SELECT TO authenticated
USING (private.is_org_member(auth.uid(), organization_id));

CREATE POLICY "admins manage categories"
ON public.categories FOR ALL TO authenticated
USING     (private.is_org_admin(auth.uid(), organization_id))
WITH CHECK(private.is_org_admin(auth.uid(), organization_id));

-- children -----------------------------------------------------------------
DROP POLICY IF EXISTS "members see children"       ON public.children;
DROP POLICY IF EXISTS "admins manage children"     ON public.children;
DROP POLICY IF EXISTS "members update child notes" ON public.children;

CREATE POLICY "members see children"
ON public.children FOR SELECT TO authenticated
USING (private.is_org_member(auth.uid(), organization_id));

CREATE POLICY "admins manage children"
ON public.children FOR ALL TO authenticated
USING     (private.is_org_admin(auth.uid(), organization_id))
WITH CHECK(private.is_org_admin(auth.uid(), organization_id));

-- attendance_records -------------------------------------------------------
DROP POLICY IF EXISTS "members see attendance"    ON public.attendance_records;
DROP POLICY IF EXISTS "members insert attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "members update attendance" ON public.attendance_records;
DROP POLICY IF EXISTS "admins delete attendance"  ON public.attendance_records;

CREATE POLICY "members see attendance"
ON public.attendance_records FOR SELECT TO authenticated
USING (private.is_org_member(auth.uid(), organization_id));

CREATE POLICY "members insert attendance"
ON public.attendance_records FOR INSERT TO authenticated
WITH CHECK (
  private.is_org_member(auth.uid(), organization_id)
  AND NOT private.is_day_closed(organization_id, date)
);

CREATE POLICY "members update attendance"
ON public.attendance_records FOR UPDATE TO authenticated
USING (
  private.is_org_member(auth.uid(), organization_id)
  AND NOT private.is_day_closed(organization_id, date)
);

CREATE POLICY "admins delete attendance"
ON public.attendance_records FOR DELETE TO authenticated
USING (private.is_org_admin(auth.uid(), organization_id));

-- activities ---------------------------------------------------------------
DROP POLICY IF EXISTS "members see activities"  ON public.activities;
DROP POLICY IF EXISTS "admins manage activities" ON public.activities;

CREATE POLICY "members see activities"
ON public.activities FOR SELECT TO authenticated
USING (private.is_org_member(auth.uid(), organization_id));

CREATE POLICY "admins manage activities"
ON public.activities FOR ALL TO authenticated
USING     (private.is_org_admin(auth.uid(), organization_id))
WITH CHECK(private.is_org_admin(auth.uid(), organization_id));

-- activity_assignments -----------------------------------------------------
DROP POLICY IF EXISTS "members see assignments"    ON public.activity_assignments;
DROP POLICY IF EXISTS "members insert assignments" ON public.activity_assignments;
DROP POLICY IF EXISTS "members update assignments" ON public.activity_assignments;
DROP POLICY IF EXISTS "admins delete assignments"  ON public.activity_assignments;

CREATE POLICY "members see assignments"
ON public.activity_assignments FOR SELECT TO authenticated
USING (private.is_org_member(auth.uid(), organization_id));

CREATE POLICY "members insert assignments"
ON public.activity_assignments FOR INSERT TO authenticated
WITH CHECK (
  private.is_org_member(auth.uid(), organization_id)
  AND NOT private.is_day_closed(organization_id, date)
);

CREATE POLICY "members update assignments"
ON public.activity_assignments FOR UPDATE TO authenticated
USING (
  private.is_org_member(auth.uid(), organization_id)
  AND NOT private.is_day_closed(organization_id, date)
);

CREATE POLICY "admins delete assignments"
ON public.activity_assignments FOR DELETE TO authenticated
USING (private.is_org_admin(auth.uid(), organization_id));

-- employee_time_logs -------------------------------------------------------
DROP POLICY IF EXISTS "user sees own time logs"   ON public.employee_time_logs;
DROP POLICY IF EXISTS "user inserts own time log" ON public.employee_time_logs;
DROP POLICY IF EXISTS "user updates own time log" ON public.employee_time_logs;
DROP POLICY IF EXISTS "admins delete time logs"   ON public.employee_time_logs;

CREATE POLICY "user sees own time logs"
ON public.employee_time_logs FOR SELECT TO authenticated
USING (user_id = auth.uid() OR private.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "user inserts own time log"
ON public.employee_time_logs FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND private.is_org_member(auth.uid(), organization_id)
);

CREATE POLICY "user updates own time log"
ON public.employee_time_logs FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  AND private.is_org_member(auth.uid(), organization_id)
);

CREATE POLICY "admins delete time logs"
ON public.employee_time_logs FOR DELETE TO authenticated
USING (private.is_org_admin(auth.uid(), organization_id));

-- daily_logs ---------------------------------------------------------------
DROP POLICY IF EXISTS "admins see daily logs"    ON public.daily_logs;
DROP POLICY IF EXISTS "admins manage daily logs" ON public.daily_logs;

CREATE POLICY "admins see daily logs"
ON public.daily_logs FOR SELECT TO authenticated
USING (private.is_org_admin(auth.uid(), organization_id));

CREATE POLICY "admins manage daily logs"
ON public.daily_logs FOR ALL TO authenticated
USING     (private.is_org_admin(auth.uid(), organization_id))
WITH CHECK(private.is_org_admin(auth.uid(), organization_id));

-- day_status ---------------------------------------------------------------
DROP POLICY IF EXISTS "members see day status"  ON public.day_status;
DROP POLICY IF EXISTS "admins manage day status" ON public.day_status;

CREATE POLICY "members see day status"
ON public.day_status FOR SELECT TO authenticated
USING (private.is_org_member(auth.uid(), organization_id));

CREATE POLICY "admins manage day status"
ON public.day_status FOR ALL TO authenticated
USING     (private.is_org_admin(auth.uid(), organization_id))
WITH CHECK(private.is_org_admin(auth.uid(), organization_id));

-- organization_invites -----------------------------------------------------
-- Clean up all previously created invite policies (various iterations):
DROP POLICY IF EXISTS "admins manage invites"                ON public.organization_invites;
DROP POLICY IF EXISTS "anyone can lookup unused codes"        ON public.organization_invites;
DROP POLICY IF EXISTS "user can redeem own invite"            ON public.organization_invites;
DROP POLICY IF EXISTS "authenticated can view redeemable invite" ON public.organization_invites;
DROP POLICY IF EXISTS "authenticated can redeem invite row"   ON public.organization_invites;

CREATE POLICY "admins manage invites"
ON public.organization_invites FOR ALL TO authenticated
USING     (private.is_org_admin(auth.uid(), organization_id))
WITH CHECK(private.is_org_admin(auth.uid(), organization_id));

-- Authenticated users may SELECT unused invites to look up a code before
-- calling redeem_invite(). They cannot see consumed or expired invites.
CREATE POLICY "authenticated can view redeemable invite"
ON public.organization_invites FOR SELECT TO authenticated
USING (used_at IS NULL AND expires_at > now());

-- storage.objects (child-photos bucket) ------------------------------------
-- Drop every naming variant that appeared across migration history:
DROP POLICY IF EXISTS "child photos public read"          ON storage.objects;
DROP POLICY IF EXISTS "members read child photos"         ON storage.objects;
DROP POLICY IF EXISTS "members upload child photos"       ON storage.objects;
DROP POLICY IF EXISTS "org members upload child photos"   ON storage.objects;
DROP POLICY IF EXISTS "members update child photos"       ON storage.objects;
DROP POLICY IF EXISTS "org members update child photos"   ON storage.objects;
DROP POLICY IF EXISTS "admins update child photos"        ON storage.objects;
DROP POLICY IF EXISTS "admins delete child photos"        ON storage.objects;
DROP POLICY IF EXISTS "org admins delete child photos"    ON storage.objects;

CREATE POLICY "members read child photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'child-photos'
  AND private.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "members upload child photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'child-photos'
  AND private.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "admins update child photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'child-photos'
  AND private.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'child-photos'
  AND private.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "admins delete child photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'child-photos'
  AND private.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- realtime.messages --------------------------------------------------------
DROP POLICY IF EXISTS "members read own org realtime topics"      ON realtime.messages;
DROP POLICY IF EXISTS "members write own org realtime topics"     ON realtime.messages;
DROP POLICY IF EXISTS "members can read own org realtime topics"  ON realtime.messages;
DROP POLICY IF EXISTS "members can write own org realtime topics" ON realtime.messages;

CREATE POLICY "members read own org realtime topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  topic LIKE 'org:%'
  AND private.is_org_member(auth.uid(), NULLIF(split_part(topic, ':', 2), '')::uuid)
);

CREATE POLICY "members write own org realtime topics"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  topic LIKE 'org:%'
  AND private.is_org_member(auth.uid(), NULLIF(split_part(topic, ':', 2), '')::uuid)
);


-- ---------------------------------------------------------------------------
-- 5.  Drop public helper functions
--     All policies have been updated above; DROP removes associated grants.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.is_org_member(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_org_admin(uuid, uuid);
DROP FUNCTION IF EXISTS public.is_day_closed(uuid, date);


-- ---------------------------------------------------------------------------
-- 6.  Restore redeem_invite as SECURITY DEFINER in public
--     (reverts any SECURITY INVOKER version from the phase-1 draft)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invite public.organization_invites%ROWTYPE;
  v_user   uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  SELECT * INTO v_invite
  FROM public.organization_invites
  WHERE code      = _code
    AND used_at   IS NULL
    AND expires_at > now()
  LIMIT 1;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Ugyldig eller udløbet kode';
  END IF;

  UPDATE public.organization_invites
  SET used_by = v_user, used_at = now()
  WHERE id = v_invite.id;

  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_invite.organization_id, v_user, v_invite.role, 'active')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN v_invite.organization_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_invite(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;
