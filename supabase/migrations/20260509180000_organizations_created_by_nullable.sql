-- Allow created_by to be NULL on organizations.
--
-- When the original creator exercises GDPR right-to-erasure (artikel 17),
-- their auth.users row is deleted. The foreign key is set to ON DELETE SET NULL
-- so the organisation itself is preserved while the personal reference is cleared.
--
-- This migration was applied manually via the Supabase dashboard; recorded here
-- to keep migration history accurate.

ALTER TABLE public.organizations
  ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.organizations
  DROP CONSTRAINT IF EXISTS organizations_created_by_fkey;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;
