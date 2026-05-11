-- PostgREST needs a FK within the public schema to auto-join staff_checkins → profiles.
-- user_id already references auth.users; adding a second FK to profiles enables the relation.
ALTER TABLE public.staff_checkins
  ADD CONSTRAINT staff_checkins_user_profile_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
