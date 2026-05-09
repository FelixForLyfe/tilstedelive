-- Add organisation type to support multiple verticals (schools, sports clubs, etc.)

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS org_type TEXT NOT NULL DEFAULT 'skole_sfo'
    CHECK (org_type IN ('skole_sfo', 'sportsklub', 'fitnesscenter', 'spejder', 'daginstitution', 'andet'));

COMMENT ON COLUMN public.organizations.org_type IS
  'Determines the terminology used in the UI. Affects labels for members, groups, and activities.';
