
-- 1) Make child-photos bucket private
UPDATE storage.buckets SET public = false WHERE id = 'child-photos';

-- 2) Replace storage policies for child-photos: only org members may read; admins write
DROP POLICY IF EXISTS "child photos public read" ON storage.objects;
DROP POLICY IF EXISTS "members upload child photos" ON storage.objects;
DROP POLICY IF EXISTS "members update child photos" ON storage.objects;
DROP POLICY IF EXISTS "admins delete child photos" ON storage.objects;
DROP POLICY IF EXISTS "members read child photos" ON storage.objects;

CREATE POLICY "members read child photos"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'child-photos'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "members upload child photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'child-photos'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "members update child photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'child-photos'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "admins delete child photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'child-photos'
  AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 3) Tighten organization_invites: drop overly broad policies
DROP POLICY IF EXISTS "anyone can lookup unused codes" ON public.organization_invites;
DROP POLICY IF EXISTS "user can redeem own invite" ON public.organization_invites;
-- redeem_invite() (SECURITY DEFINER) is the only path to consume an invite

-- 4) Drop the broad members-update on children; daily notes already live on attendance_records
DROP POLICY IF EXISTS "members update child notes" ON public.children;

-- 5) Lock down internal SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_day_close() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
