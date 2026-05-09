-- =============================================================================
-- Audit logging
--
-- Tracks who does what to sensitive data and when. Database-level triggers
-- fire on INSERT/UPDATE/DELETE so the log cannot be bypassed from app code.
--
-- Design:
--   - Records user_id, action, table, record_id, org_id, and (for UPDATEs)
--     which *columns* changed — NOT the data values, to avoid duplicating
--     sensitive data like CPR numbers into the audit log.
--   - Immutable: no UPDATE or DELETE policy for any role.
--   - Org-scoped: admins read their org's logs via RLS; users read their own.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at     timestamptz NOT NULL DEFAULT now(),
  user_id        uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  action         text        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  table_name     text        NOT NULL,
  record_id      uuid,
  org_id         uuid        REFERENCES public.organizations(id) ON DELETE CASCADE,
  changed_fields text[]      -- column names whose values changed (UPDATE only)
);

CREATE INDEX IF NOT EXISTS audit_logs_org_created_at_idx
  ON public.audit_logs (org_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_logs_user_created_at_idx
  ON public.audit_logs (user_id, created_at DESC);


-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- Admins can read all log entries for their organisation
DROP POLICY IF EXISTS "admins read own org audit logs" ON public.audit_logs;
CREATE POLICY "admins read own org audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (private.is_org_admin(auth.uid(), org_id));

-- Any authenticated user can read their own events (data subject access requests)
DROP POLICY IF EXISTS "users read own audit events" ON public.audit_logs;
CREATE POLICY "users read own audit events"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Block direct writes from all application roles.
-- The trigger function runs as postgres (SECURITY DEFINER) and bypasses this.
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM PUBLIC;


-- ---------------------------------------------------------------------------
-- 3. Trigger function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.log_table_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_row     jsonb;
  v_old_row jsonb;
  v_record_id  uuid;
  v_org_id     uuid;
  v_changed    text[];
BEGIN
  -- Materialise rows as jsonb once
  v_row     := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  v_old_row := CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END;

  -- Primary key (assumes column named 'id')
  v_record_id := (v_row->>'id')::uuid;

  -- Organisation scoping
  IF TG_TABLE_NAME = 'organizations' THEN
    v_org_id := (v_row->>'id')::uuid;
  ELSE
    v_org_id := (v_row->>'organization_id')::uuid;
  END IF;

  -- For UPDATEs: record which columns changed (not values)
  IF TG_OP = 'UPDATE' THEN
    SELECT array_agg(k)
    INTO v_changed
    FROM (
      SELECT k
      FROM jsonb_object_keys(v_row) AS k
      WHERE v_row -> k IS DISTINCT FROM v_old_row -> k
        AND k <> 'updated_at'   -- suppress the noise column
    ) sub;
  END IF;

  INSERT INTO public.audit_logs
    (user_id, action, table_name, record_id, org_id, changed_fields)
  VALUES
    (auth.uid(), TG_OP, TG_TABLE_NAME, v_record_id, v_org_id, v_changed);

  RETURN NULL; -- AFTER trigger; return value is ignored
END;
$$;


-- ---------------------------------------------------------------------------
-- 4. Attach triggers to sensitive tables
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS audit_children ON public.children;
CREATE TRIGGER audit_children
  AFTER INSERT OR UPDATE OR DELETE ON public.children
  FOR EACH ROW EXECUTE FUNCTION private.log_table_change();

DROP TRIGGER IF EXISTS audit_org_members ON public.organization_members;
CREATE TRIGGER audit_org_members
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_members
  FOR EACH ROW EXECUTE FUNCTION private.log_table_change();

DROP TRIGGER IF EXISTS audit_invites ON public.organization_invites;
CREATE TRIGGER audit_invites
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_invites
  FOR EACH ROW EXECUTE FUNCTION private.log_table_change();

DROP TRIGGER IF EXISTS audit_day_status ON public.day_status;
CREATE TRIGGER audit_day_status
  AFTER INSERT OR UPDATE OR DELETE ON public.day_status
  FOR EACH ROW EXECUTE FUNCTION private.log_table_change();

DROP TRIGGER IF EXISTS audit_organizations ON public.organizations;
CREATE TRIGGER audit_organizations
  AFTER INSERT OR UPDATE OR DELETE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION private.log_table_change();

DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles
  AFTER INSERT OR UPDATE OR DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION private.log_table_change();
