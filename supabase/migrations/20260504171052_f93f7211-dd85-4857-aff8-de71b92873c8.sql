
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS daily_note text;
ALTER TABLE public.children DROP COLUMN IF EXISTS notes;
