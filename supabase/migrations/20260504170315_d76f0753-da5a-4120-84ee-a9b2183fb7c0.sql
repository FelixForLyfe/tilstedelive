
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS photo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('child-photos', 'child-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "child photos public read" ON storage.objects;
CREATE POLICY "child photos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'child-photos');

-- Org members can upload (path: <org_id>/<filename>)
DROP POLICY IF EXISTS "org members upload child photos" ON storage.objects;
CREATE POLICY "org members upload child photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'child-photos'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "org members update child photos" ON storage.objects;
CREATE POLICY "org members update child photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'child-photos'
  AND public.is_org_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "org admins delete child photos" ON storage.objects;
CREATE POLICY "org admins delete child photos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'child-photos'
  AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- Allow members to update notes on children (currently only admins can manage children)
DROP POLICY IF EXISTS "members update child notes" ON public.children;
CREATE POLICY "members update child notes"
ON public.children FOR UPDATE TO authenticated
USING (public.is_org_member(auth.uid(), organization_id))
WITH CHECK (public.is_org_member(auth.uid(), organization_id));
