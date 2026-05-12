-- Allow 'button' as checkin method in feature flags
ALTER TABLE public.org_feature_flags
  DROP CONSTRAINT IF EXISTS org_feature_flags_checkin_method_check;
ALTER TABLE public.org_feature_flags
  ADD CONSTRAINT org_feature_flags_checkin_method_check
  CHECK (checkin_method IN ('none', 'qr', 'pin', 'both', 'button'));

-- Allow 'button' as checkin type in staff_checkins
ALTER TABLE public.staff_checkins
  DROP CONSTRAINT IF EXISTS staff_checkins_checkin_type_check;
ALTER TABLE public.staff_checkins
  ADD CONSTRAINT staff_checkins_checkin_type_check
  CHECK (checkin_type IN ('qr', 'pin', 'button'));

-- Add break tracking column
ALTER TABLE public.staff_checkins
  ADD COLUMN IF NOT EXISTS on_break_since timestamptz;
