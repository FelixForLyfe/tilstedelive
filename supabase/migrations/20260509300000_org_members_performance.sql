-- Performance: indexes on organization_members + simplified SELECT policy
--
-- Root cause of statement timeouts:
--   private.is_org_member() is called by the organizations RLS policy
--   ("members see their orgs") for every organisation row in the join
--   result.  Without an index on (user_id, organization_id, status) each
--   call does a full sequential scan of organization_members.
--
-- This migration:
--   1. Adds the missing indexes
--   2. Splits the single SELECT policy into two policies so PostgreSQL can
--      short-circuit on the cheap user_id = auth.uid() check and skip
--      private.is_org_member() entirely for the common login-time query
--      (WHERE user_id = <current user>).

-- ---------------------------------------------------------------------------
-- 1. Indexes
-- ---------------------------------------------------------------------------

-- Used by OrgContext query and by the "users see own memberships" policy
CREATE INDEX IF NOT EXISTS org_members_user_id_idx
  ON public.organization_members(user_id);

-- Used by private.is_org_member() — the function body filters on all three
CREATE INDEX IF NOT EXISTS org_members_user_org_status_idx
  ON public.organization_members(user_id, organization_id, status);

-- Used by private.is_org_admin() and org-scoped admin queries
CREATE INDEX IF NOT EXISTS org_members_org_id_idx
  ON public.organization_members(organization_id);

-- ---------------------------------------------------------------------------
-- 2. Split SELECT policy
--    Old: USING (private.is_org_member(...) OR user_id = auth.uid())
--         — PostgreSQL may evaluate the expensive function first.
--    New: two separate policies (Postgres ORs them); the cheap one fires
--         for every self-lookup (login flow) so the function is never called.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "members see members of their orgs" ON public.organization_members;

-- Users can always see their own membership rows (no function call)
CREATE POLICY "users see own memberships"
  ON public.organization_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Members can see co-members within the same organisation
CREATE POLICY "members see org co-members"
  ON public.organization_members FOR SELECT TO authenticated
  USING (private.is_org_member(auth.uid(), organization_id));
