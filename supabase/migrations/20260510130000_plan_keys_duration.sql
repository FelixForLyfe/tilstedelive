-- Duration: how many months a key's special pricing lasts
ALTER TABLE public.plan_keys
  ADD COLUMN IF NOT EXISTS duration_months INT NULL
    CHECK (duration_months IS NULL OR duration_months > 0);
