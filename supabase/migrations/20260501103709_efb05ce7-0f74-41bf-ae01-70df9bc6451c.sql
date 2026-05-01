-- 1) Trigger: automatisk daglig log når dagen lukkes/genåbnes
CREATE OR REPLACE FUNCTION public.handle_day_close()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendance jsonb;
  v_activities jsonb;
  v_employee jsonb;
  v_total int;
BEGIN
  -- Kun reager når is_closed netop er sat til true
  IF NEW.is_closed = true AND (OLD.is_closed IS DISTINCT FROM true) THEN
    -- Snapshot fremmøde
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'child_id', a.child_id,
      'child_name', c.full_name,
      'status', a.status,
      'checked_in_at', a.checked_in_at,
      'checked_out_at', a.checked_out_at,
      'leave_time', a.leave_time
    )), '[]'::jsonb), COALESCE(SUM(CASE WHEN a.checked_in_at IS NOT NULL THEN 1 ELSE 0 END), 0)
    INTO v_attendance, v_total
    FROM attendance_records a
    LEFT JOIN children c ON c.id = a.child_id
    WHERE a.organization_id = NEW.organization_id AND a.date = NEW.date;

    -- Snapshot aktiviteter
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
    INTO v_activities
    FROM (
      SELECT
        act.id AS activity_id,
        act.name AS activity_name,
        COUNT(asg.id)::int AS count,
        BOOL_OR(asg.status = 'completed') AS any_completed
      FROM activity_assignments asg
      JOIN activities act ON act.id = asg.activity_id
      WHERE asg.organization_id = NEW.organization_id AND asg.date = NEW.date
      GROUP BY act.id, act.name
    ) t;

    -- Snapshot personaletid (med navn/email fra profiles)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'user_id', e.user_id,
      'name', p.full_name,
      'email', p.email,
      'shift_started_at', e.shift_started_at,
      'shift_ended_at', e.shift_ended_at,
      'total_break_minutes', e.total_break_minutes,
      'status', e.status
    )), '[]'::jsonb)
    INTO v_employee
    FROM employee_time_logs e
    LEFT JOIN profiles p ON p.id = e.user_id
    WHERE e.organization_id = NEW.organization_id AND e.date = NEW.date;

    -- Upsert daily_log (overskriv hvis allerede eksisterer)
    INSERT INTO daily_logs (organization_id, date, closed_by, closed_at,
      attendance_snapshot, activities_snapshot, employee_time_snapshot, total_children_present)
    VALUES (NEW.organization_id, NEW.date, NEW.closed_by, COALESCE(NEW.closed_at, now()),
      v_attendance, v_activities, v_employee, COALESCE(v_total, 0))
    ON CONFLICT (organization_id, date) DO UPDATE SET
      closed_by = EXCLUDED.closed_by,
      closed_at = EXCLUDED.closed_at,
      attendance_snapshot = EXCLUDED.attendance_snapshot,
      activities_snapshot = EXCLUDED.activities_snapshot,
      employee_time_snapshot = EXCLUDED.employee_time_snapshot,
      total_children_present = EXCLUDED.total_children_present;
  END IF;
  RETURN NEW;
END;
$$;

-- Unique constraint så ON CONFLICT virker
CREATE UNIQUE INDEX IF NOT EXISTS daily_logs_org_date_uidx
  ON public.daily_logs (organization_id, date);

DROP TRIGGER IF EXISTS trg_handle_day_close ON public.day_status;
CREATE TRIGGER trg_handle_day_close
AFTER INSERT OR UPDATE ON public.day_status
FOR EACH ROW EXECUTE FUNCTION public.handle_day_close();

-- 2) Realtime: tilføj daily_logs + manglende tabeller, og sæt REPLICA IDENTITY FULL
ALTER TABLE public.daily_logs REPLICA IDENTITY FULL;
ALTER TABLE public.children REPLICA IDENTITY FULL;
ALTER TABLE public.activities REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.organization_members REPLICA IDENTITY FULL;
ALTER TABLE public.organization_invites REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'daily_logs') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_logs;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'organization_invites') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.organization_invites;
  END IF;
END $$;