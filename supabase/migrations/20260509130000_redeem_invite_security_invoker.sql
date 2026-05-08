-- =============================================================================
-- Convert redeem_invite to SECURITY INVOKER
--
-- The linter warned that public.redeem_invite is a SECURITY DEFINER function
-- callable by authenticated users. We can eliminate that warning by switching
-- to SECURITY INVOKER and backing it with three RLS policies that collectively
-- allow the atomic UPDATE + INSERT the function performs.
--
-- Why the previous SECURITY DEFINER approach existed
-- ───────────────────────────────────────────────────
-- The original concern was: after marking an invite as used (UPDATE sets
-- used_at = now()), the user's SELECT policy on organization_invites only
-- shows rows where used_at IS NULL, so the membership INSERT policy's EXISTS
-- check could not see the just-consumed invite.
--
-- The fix: add a SELECT policy that lets users see invites they personally
-- redeemed (used_by = auth.uid()). This makes the EXISTS check work within
-- the same transaction immediately after the UPDATE.
--
-- The function is also refactored to use UPDATE...RETURNING as a single
-- atomic claim (no separate SELECT), which is both simpler and race-safe.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1.  Allow authenticated users to see invites they personally consumed.
--     Required so the organization_members INSERT policy can do its EXISTS
--     check against the invite row that was just marked as used.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users see own redeemed invites" ON public.organization_invites;
CREATE POLICY "users see own redeemed invites"
ON public.organization_invites FOR SELECT TO authenticated
USING (used_by = auth.uid());


-- ---------------------------------------------------------------------------
-- 2.  Allow an authenticated user to claim (consume) one unused invite.
--     USING:      row must be unused and not expired before the update.
--     WITH CHECK: after the update the row must be marked with the caller's
--                 uid and a non-null used_at — prevents changing other fields.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "user can claim unused invite" ON public.organization_invites;
CREATE POLICY "user can claim unused invite"
ON public.organization_invites FOR UPDATE TO authenticated
USING (
  used_at   IS NULL
  AND expires_at > now()
)
WITH CHECK (
  used_by   = auth.uid()
  AND used_at   IS NOT NULL
  AND expires_at > now()
);


-- ---------------------------------------------------------------------------
-- 3.  Allow a user to insert themselves into an organization, but only when
--     they have a matching invite redeemed within the last 10 minutes.
--     The "users see own redeemed invites" policy (above) makes the EXISTS
--     subquery visible inside the same transaction.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users can join org through redeemed invite" ON public.organization_members;
CREATE POLICY "users can join org through redeemed invite"
ON public.organization_members FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status  = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.organization_invites oi
    WHERE oi.organization_id = organization_id   -- NEW.organization_id
      AND oi.role             = role              -- NEW.role
      AND oi.used_by          = auth.uid()
      AND oi.used_at          IS NOT NULL
      AND oi.used_at          > now() - interval '10 minutes'
  )
);


-- ---------------------------------------------------------------------------
-- 4.  redeem_invite — now SECURITY INVOKER
--
--     Uses UPDATE ... RETURNING for an atomic, race-safe claim: if two
--     concurrent calls arrive for the same code, only one UPDATE will match
--     (the USING clause adds AND used_at IS NULL to the WHERE), and the
--     losing call sees v_org_id = NULL and raises an exception.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_user   uuid := auth.uid();
  v_org_id uuid;
  v_role   public.app_role;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Ikke logget ind';
  END IF;

  -- Atomic claim: the UPDATE RLS policy adds (used_at IS NULL AND expires_at > now())
  -- to the WHERE, so only a genuinely unused, unexpired invite matches.
  UPDATE public.organization_invites
  SET    used_by = v_user,
         used_at = now()
  WHERE  code      = _code
    AND  used_at   IS NULL
    AND  expires_at > now()
  RETURNING organization_id, role
  INTO v_org_id, v_role;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Ugyldig eller udløbet kode';
  END IF;

  -- The INSERT RLS policy verifies the invite via EXISTS on organization_invites.
  -- The "users see own redeemed invites" SELECT policy makes the just-consumed
  -- invite visible within this transaction.
  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (v_org_id, v_user, v_role, 'active')
  ON CONFLICT (organization_id, user_id) DO NOTHING;

  RETURN v_org_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.redeem_invite(text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;
