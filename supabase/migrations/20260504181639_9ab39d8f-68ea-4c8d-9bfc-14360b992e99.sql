UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'],
    file_size_limit = 5242880
WHERE id = 'child-photos';

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_day_close() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;