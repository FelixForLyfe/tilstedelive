-- BI support: org_notes table + last-activity helper function

-- Internal CRM notes per organisation.
-- GDPR notice: only organisational contact info, never personal data about children or end users.
-- Retention: 2 years (manual cleanup or pg_cron).

CREATE TABLE IF NOT EXISTS public.org_notes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  note            TEXT        NOT NULL CHECK (char_length(note) <= 2000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.org_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_notes FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin manage org_notes" ON public.org_notes;
CREATE POLICY "superadmin manage org_notes"
  ON public.org_notes FOR ALL TO authenticated
  USING      (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE INDEX IF NOT EXISTS org_notes_org_idx ON public.org_notes (organization_id);
CREATE INDEX IF NOT EXISTS org_notes_created_at_idx ON public.org_notes (created_at);

-- Aggregate helper: last attendance record timestamp per organisation.
-- Returns only organisation_id + timestamp — no individual user or child data.
-- SECURITY INVOKER so it runs as the calling role (service role for superadmin use).
CREATE OR REPLACE FUNCTION public.superadmin_org_last_activity()
RETURNS TABLE(organization_id UUID, last_activity TIMESTAMPTZ)
LANGUAGE SQL
SECURITY INVOKER
STABLE
AS $$
  SELECT organization_id, MAX(created_at) AS last_activity
  FROM public.attendance_records
  GROUP BY organization_id
$$;
