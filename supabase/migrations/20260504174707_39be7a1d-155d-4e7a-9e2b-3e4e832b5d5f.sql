REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_day_close() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_org_admin(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_day_closed(uuid, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_invite(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invite(text) TO authenticated;

DROP POLICY IF EXISTS "org members update child photos" ON storage.objects;

DROP POLICY IF EXISTS "members can read own org realtime topics" ON realtime.messages;
CREATE POLICY "members read own org realtime topics"
ON realtime.messages FOR SELECT TO authenticated
USING (
  topic LIKE 'org:%'
  AND public.is_org_member(auth.uid(), NULLIF(split_part(topic, ':', 2), '')::uuid)
);