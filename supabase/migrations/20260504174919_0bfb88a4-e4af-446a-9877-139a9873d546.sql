DROP POLICY IF EXISTS "members can write own org realtime topics" ON realtime.messages;
CREATE POLICY "members write own org realtime topics"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  topic LIKE 'org:%'
  AND public.is_org_member(auth.uid(), NULLIF(split_part(topic, ':', 2), '')::uuid)
);