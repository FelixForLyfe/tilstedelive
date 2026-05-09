-- Operations: app_settings key-value store + database stats helper

-- Generic key-value settings for the application (e.g. maintenance_mode).
-- Only superadmins can read or write via RLS.
CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT        PRIMARY KEY,
  value       JSONB       NOT NULL DEFAULT 'null'::jsonb,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "superadmin manage app_settings" ON public.app_settings;
CREATE POLICY "superadmin manage app_settings"
  ON public.app_settings FOR ALL TO authenticated
  USING      (public.is_superadmin(auth.uid()))
  WITH CHECK (public.is_superadmin(auth.uid()));

-- Seed default settings
INSERT INTO public.app_settings (key, value, description)
VALUES
  ('maintenance_mode',   'false'::jsonb, 'When true, non-superadmin users see a maintenance banner'),
  ('maintenance_message', '"Tilstede er midlertidigt utilgængeligt pga. planlagt vedligehold. Vi er tilbage snart."'::jsonb, 'Message shown during maintenance'),
  ('max_trial_days',    '14'::jsonb,    'Default trial length in days for new sign-ups')
ON CONFLICT (key) DO NOTHING;

-- Database stats helper: table row counts + sizes for the public schema.
-- SECURITY DEFINER so it can read pg_catalog as postgres owner.
-- Returns aggregate schema statistics only — no row data.
CREATE OR REPLACE FUNCTION public.superadmin_db_stats()
RETURNS TABLE(
  table_name  TEXT,
  row_count   BIGINT,
  total_bytes BIGINT,
  total_size  TEXT
)
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT
    t.relname::TEXT                           AS table_name,
    t.reltuples::BIGINT                       AS row_count,
    pg_total_relation_size(t.oid)             AS total_bytes,
    pg_size_pretty(pg_total_relation_size(t.oid)) AS total_size
  FROM pg_class t
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relkind = 'r'
  ORDER BY pg_total_relation_size(t.oid) DESC;
$$;
