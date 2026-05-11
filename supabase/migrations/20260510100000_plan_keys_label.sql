-- Add optional label/description to plan keys
ALTER TABLE public.plan_keys
  ADD COLUMN IF NOT EXISTS label TEXT;
