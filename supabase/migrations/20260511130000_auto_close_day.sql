-- Add auto-close columns to org_feature_flags
ALTER TABLE public.org_feature_flags
  ADD COLUMN IF NOT EXISTS auto_close_day  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_close_time time    NOT NULL DEFAULT '22:00';

-- -----------------------------------------------------------------------
-- Function: auto_close_days()
-- Runs via pg_cron every minute. Finds organisations whose auto_close_time
-- matches the current Danish time (minute precision) and closes their day
-- if not already closed. The day_status trigger automatically writes to
-- audit_logs (with user_id = NULL to signal a system action).
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.auto_close_days()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec          RECORD;
  today_dk     date;
  now_time_dk  time;
BEGIN
  today_dk    := (NOW() AT TIME ZONE 'Europe/Copenhagen')::date;
  now_time_dk := date_trunc('minute', (NOW() AT TIME ZONE 'Europe/Copenhagen')::time);

  FOR rec IN
    SELECT f.organization_id, f.auto_close_time
    FROM   public.org_feature_flags f
    WHERE  f.auto_close_day = true
      AND  date_trunc('minute', f.auto_close_time) = now_time_dk
  LOOP
    -- Only close if not already closed today
    IF NOT EXISTS (
      SELECT 1
      FROM   public.day_status
      WHERE  organization_id = rec.organization_id
        AND  date            = today_dk
        AND  is_closed       = true
    ) THEN
      INSERT INTO public.day_status (organization_id, date, is_closed, closed_at)
      VALUES (rec.organization_id, today_dk, true, NOW())
      ON CONFLICT (organization_id, date) DO UPDATE
        SET is_closed  = true,
            closed_at  = NOW(),
            closed_by  = NULL;  -- NULL signals auto-close (no human user)
    END IF;
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------
-- pg_cron schedule — runs every minute.
-- PREREQUISITE: enable the pg_cron extension in
--   Supabase Dashboard → Database → Extensions → pg_cron
-- The job is idempotent; re-running this migration is safe because
-- cron.schedule() replaces any existing job with the same name.
-- -----------------------------------------------------------------------
SELECT cron.schedule(
  'auto-close-days',          -- job name
  '* * * * *',                -- every minute
  'SELECT public.auto_close_days()'
);
