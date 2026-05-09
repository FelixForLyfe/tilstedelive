-- Security & GDPR: gdpr_requests table + auth security helper function

-- GDPR requests tracker (Art. 15 / 16 / 17 requests).
-- Contains requester email — personal data.
-- Retention policy: anonymise email after resolution + 3 years (manual / pg_cron).
CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_email TEXT        NOT NULL CHECK (char_length(requester_email) <= 320),
  org_id          UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  request_type    TEXT        NOT NULL DEFAULT 'deletion'
                    CHECK (request_type IN ('deletion', 'export', 'rectification')),
  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'in_progress', 'completed', 'rejected')),
  notes           TEXT        CHECK (char_length(notes) <= 2000),
  received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gdpr_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin manage gdpr_requests" ON public.gdpr_requests;
CREATE POLICY "superadmin manage gdpr_requests"
  ON public.gdpr_requests FOR ALL TO authenticated
  USING      (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

CREATE INDEX IF NOT EXISTS gdpr_requests_status_idx   ON public.gdpr_requests (status);
CREATE INDEX IF NOT EXISTS gdpr_requests_received_idx ON public.gdpr_requests (received_at DESC);

-- Auth security summary: aggregates failed login events from the Supabase auth audit log.
-- SECURITY DEFINER so it can read auth.audit_log_entries (owned by postgres).
-- Returns JSONB with aggregate counts only — no individual emails, passwords or session tokens.
CREATE OR REPLACE FUNCTION public.superadmin_auth_security_summary()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'failed_24h',   COALESCE(COUNT(*) FILTER (WHERE created_at > now() - interval '24 hours'), 0),
    'failed_7d',    COALESCE(COUNT(*), 0),
    'unique_ips_7d', COALESCE(COUNT(DISTINCT ip_address), 0)
  )
  INTO result
  FROM auth.audit_log_entries
  WHERE created_at > now() - interval '7 days'
    AND (
      (payload->>'action' = 'login'             AND (payload->>'error') IS NOT NULL)
      OR payload->>'action' = 'user_signin_failed'
      OR payload->>'action' = 'failed_login'
    );
  RETURN COALESCE(result, '{"failed_24h":0,"failed_7d":0,"unique_ips_7d":0}'::jsonb);
EXCEPTION WHEN OTHERS THEN
  RETURN '{"failed_24h":0,"failed_7d":0,"unique_ips_7d":0}'::jsonb;
END;
$$;
