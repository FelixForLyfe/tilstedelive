
-- 1) Restrict storage UPDATE on child-photos to admins (was: any org member)
DROP POLICY IF EXISTS "members update child photos" ON storage.objects;

CREATE POLICY "admins update child photos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'child-photos'
  AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'child-photos'
  AND public.is_org_admin(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 2) RLS on realtime.messages — restrict subscriptions to topics owned by user's orgs.
-- Convention: any topic prefixed with "org:<uuid>" is scoped to that organization.
-- postgres_changes uses internal topics that already inherit table RLS, so we
-- only restrict broadcast/presence topics under the org: namespace.
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members can read own org realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "members can write own org realtime topics" ON realtime.messages;

CREATE POLICY "members can read own org realtime topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  -- Allow internal postgres_changes topics (RLS already enforced on source tables)
  topic NOT LIKE 'org:%'
  OR public.is_org_member(
    auth.uid(),
    NULLIF(split_part(topic, ':', 2), '')::uuid
  )
);

CREATE POLICY "members can write own org realtime topics"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  topic NOT LIKE 'org:%'
  OR public.is_org_member(
    auth.uid(),
    NULLIF(split_part(topic, ':', 2), '')::uuid
  )
);
