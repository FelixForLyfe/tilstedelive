## Fix two security findings

### 1. Server-side MIME + size enforcement on `child-photos` bucket

Add a migration that sets `allowed_mime_types` and `file_size_limit` on the existing private bucket so Supabase Storage rejects spoofed uploads at the edge — the client checks in `BarnDetalje.tsx` and `app.admin.tsx` stay as UX guards.

```sql
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif'],
    file_size_limit = 5242880  -- 5 MB
WHERE id = 'child-photos';
```

No app code changes needed; existing uploads continue to work because they already match these limits.

### 2. SECURITY DEFINER functions callable by authenticated

Audit of the 7 SECURITY DEFINER functions in the project:

| Function | Caller | Action |
|---|---|---|
| `handle_new_user`, `handle_day_close`, `set_updated_at` | trigger only | EXECUTE already revoked (prior migration) — re-assert |
| `is_org_admin`, `is_org_member`, `is_day_closed` | referenced inside RLS policies on `children`, `attendance_records`, etc. | **Must remain executable** by `authenticated` — revoking breaks every RLS policy. Document as accepted risk. |
| `redeem_invite` | called via `supabase.rpc("redeem_invite", ...)` from `signup.personale.tsx` | **Must remain executable** by `authenticated` — that is the whole point of the invite flow. Already hardened: validates `auth.uid()`, expiry, and single-use. Document as accepted risk. |

Plan:
- Migration: re-`REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` on the three trigger-only functions (defensive, idempotent).
- Mark the linter finding as **ignored** with `security--manage_security_finding` and update `@security-memory` explaining that `is_org_*`, `is_day_closed`, and `redeem_invite` are intentionally callable by `authenticated` (RLS helpers cannot be `SECURITY INVOKER` without infinite RLS recursion against `organization_members`; `redeem_invite` is the documented RPC entry point with internal validation).

### Out of scope
No changes to UI, routing, auth flows, or unrelated tables. No client-side logic change for photo upload (server enforcement is added behind it).

### Files touched
- `supabase/migrations/<new>.sql` (bucket config + idempotent revokes)
- `mem://security` / security memory update
- Security finding marked as ignored with rationale
