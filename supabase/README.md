# Tilstede — Database Security Documentation

This document covers the complete security architecture of the Tilstede Supabase database: Row Level Security (RLS), authentication, encryption, and known considerations.

---

## Table of Contents

1. [Row Level Security (RLS)](#1-row-level-security-rls)
2. [Private Schema Helper Functions](#2-private-schema-helper-functions)
3. [RLS Policies by Table](#3-rls-policies-by-table)
4. [Authentication & Invite Flow](#4-authentication--invite-flow)
5. [Encryption](#5-encryption)
6. [Security Considerations & Recommendations](#6-security-considerations--recommendations)
7. [Applying Migrations](#7-applying-migrations)

---

## 1. Row Level Security (RLS)

### What is RLS?

Row Level Security is a PostgreSQL feature that restricts which rows a database role can see or modify. Every query from the application automatically has an invisible `WHERE` clause added by the database engine based on the current user's identity and the active policies.

In Tilstede, RLS is the **primary authorization layer**. Even if the application code has a bug or a user sends a crafted API request, the database will only return or modify rows the user is permitted to access.

### Access model

Tilstede is a **multi-tenant, organization-scoped** system. Every piece of data belongs to an organization. Access is determined by two things:

| Role | Description |
|------|-------------|
| `anon` | Unauthenticated. No access to any table. |
| `authenticated` + `employee` | Signed-in staff member. Can read org data and manage attendance/activities/time logs for their own organization only. |
| `authenticated` + `admin` | Signed-in administrator. Full CRUD within their organization, plus invite management and archive access. |

The role (`admin` / `employee`) is stored in the `organization_members` table, not in the JWT. The helper functions read this at query time.

### RLS is enabled on all tables

```
public.profiles
public.organizations
public.organization_members
public.organization_invites
public.categories
public.children
public.attendance_records
public.activities
public.activity_assignments
public.employee_time_logs
public.daily_logs
public.day_status
storage.objects          (child-photos bucket)
realtime.messages        (org:* broadcast/presence topics)
```

---

## 2. Private Schema Helper Functions

### Why a private schema?

Helper functions used inside RLS policies must not be directly callable via the REST API (`/rest/v1/rpc/`). PostgREST only exposes functions in schemas listed in its `db-schemas` configuration, which defaults to `public`. Functions in the `private` schema are invisible to PostgREST and therefore cannot be called from outside the database.

### Why SECURITY DEFINER?

The three helper functions query `organization_members` and `day_status`, which themselves have RLS policies that call the same helpers. If the helpers ran as SECURITY INVOKER (with the caller's privileges), PostgreSQL would evaluate the RLS policy → call the helper → apply RLS on the queried table → call the helper again → **infinite recursion**.

`SECURITY DEFINER` makes the function run as its owner (`postgres`), which bypasses RLS. This breaks the recursion while still enforcing access control through the calling policy.

```
query on organizations
  └─ RLS policy: private.is_org_member(auth.uid(), id)
       └─ SECURITY DEFINER: queries organization_members WITHOUT RLS
            (no recursion)
```

### Function reference

| Function | Schema | Returns | Description |
|----------|--------|---------|-------------|
| `private.is_org_member(user_id, org_id)` | private | boolean | True if the user has an `active` membership in the org |
| `private.is_org_admin(user_id, org_id)` | private | boolean | True if the user has an `active admin` membership |
| `private.is_day_closed(org_id, date)` | private | boolean | True if the day has been closed (prevents modifications) |
| `public.redeem_invite(code)` | public | uuid | Consumes an invite code and adds the user to the org |

### Why redeem_invite stays in public

`redeem_invite` is **intentionally callable** by authenticated users via the REST API — it is the invite redemption endpoint. It runs as **SECURITY INVOKER** (migration `20260509130000`), meaning it executes with the caller's privileges and is subject to RLS.

Three supporting RLS policies make this work:

1. **`user can claim unused invite`** (UPDATE on `organization_invites`) — lets the caller atomically mark an unused, unexpired invite as theirs via `UPDATE ... RETURNING`.
2. **`users see own redeemed invites`** (SELECT on `organization_invites`) — lets the caller see the invite they just consumed (`used_by = auth.uid()`), which is required for the next step.
3. **`users can join org through redeemed invite`** (INSERT on `organization_members`) — lets the caller insert themselves, gated by an `EXISTS` check that the invite was redeemed within the last 10 minutes.

The function uses `UPDATE ... RETURNING` for a race-safe atomic claim: if two concurrent calls arrive for the same code, only one UPDATE matches (the `used_at IS NULL` guard), and the losing call gets NULL back and raises an exception.

---

## 3. RLS Policies by Table

### `public.profiles`

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| users see own profile | SELECT | authenticated | `id = auth.uid()` |
| users see profiles in shared orgs | SELECT | authenticated | Both users have an `active` membership in at least one shared org |
| users update own profile | UPDATE | authenticated | `id = auth.uid()` |

### `public.organizations`

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| members see their orgs | SELECT | authenticated | `is_org_member(uid, id)` |
| anyone can create org | INSERT | authenticated | `created_by = auth.uid()` |
| admins update org | UPDATE | authenticated | `is_org_admin(uid, id)` |
| admins delete org | DELETE | authenticated | `is_org_admin(uid, id)` |

### `public.organization_members`

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| members see members of their orgs | SELECT | authenticated | `is_org_member(uid, org_id)` OR `user_id = auth.uid()` |
| creator can self-add as admin | INSERT | authenticated | `user_id = uid` AND `role = admin` AND user created the org |
| admins add members | INSERT | authenticated | `is_org_admin(uid, org_id)` |
| users can join org through redeemed invite | INSERT | authenticated | `user_id = auth.uid()` AND `status = active` AND EXISTS redeemed invite within last 10 minutes |
| admins update members | UPDATE | authenticated | `is_org_admin(uid, org_id)` |
| admins remove members | DELETE | authenticated | `is_org_admin(uid, org_id)` |

### `public.organization_invites`

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| admins manage invites | ALL | authenticated | `is_org_admin(uid, org_id)` |
| authenticated can view redeemable invite | SELECT | authenticated | `used_at IS NULL AND expires_at > now()` |
| users see own redeemed invites | SELECT | authenticated | `used_by = auth.uid()` |
| user can claim unused invite | UPDATE | authenticated | USING: `used_at IS NULL AND expires_at > now()` / WITH CHECK: `used_by = auth.uid() AND used_at IS NOT NULL` |

The last two policies were added by migration `20260509130000` to support the SECURITY INVOKER `redeem_invite` function. Users cannot INSERT or DELETE invites directly; only admins can do that via the `admins manage invites` policy.

### `public.categories`

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| members see categories | SELECT | authenticated | `is_org_member` |
| admins manage categories | ALL | authenticated | `is_org_admin` |

### `public.children`

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| members see children | SELECT | authenticated | `is_org_member` |
| admins manage children | ALL | authenticated | `is_org_admin` |

> **Note:** All staff members can read children records (including sensitive fields like `cpr_number`, `allergies`, `doctor_phone`). If finer-grained column visibility is needed, consider column-level privileges or application-side filtering. See [Section 6](#6-security-considerations--recommendations).

### `public.attendance_records`

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| members see attendance | SELECT | authenticated | `is_org_member` |
| members insert attendance | INSERT | authenticated | `is_org_member` AND NOT `is_day_closed` |
| members update attendance | UPDATE | authenticated | `is_org_member` AND NOT `is_day_closed` |
| admins delete attendance | DELETE | authenticated | `is_org_admin` |

The `is_day_closed` check prevents staff from modifying attendance records after an admin has closed the day.

### `public.activities` / `public.activity_assignments`

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| members see activities/assignments | SELECT | authenticated | `is_org_member` |
| admins manage activities | ALL | authenticated | `is_org_admin` |
| members insert/update assignments | INSERT/UPDATE | authenticated | `is_org_member` AND NOT `is_day_closed` |
| admins delete assignments | DELETE | authenticated | `is_org_admin` |

### `public.employee_time_logs`

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| user sees own time logs | SELECT | authenticated | `user_id = auth.uid()` OR `is_org_admin` |
| user inserts own time log | INSERT | authenticated | `user_id = auth.uid()` AND `is_org_member` |
| user updates own time log | UPDATE | authenticated | `user_id = auth.uid()` AND `is_org_member` |
| admins delete time logs | DELETE | authenticated | `is_org_admin` |

Employees can only see and modify their own time entries. Admins can see all entries for their org.

### `public.daily_logs`

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| admins see daily logs | SELECT | authenticated | `is_org_admin` |
| admins manage daily logs | ALL | authenticated | `is_org_admin` |

Daily logs are archive snapshots written by the `handle_day_close` trigger and are read-only in practice.

### `public.day_status`

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| members see day status | SELECT | authenticated | `is_org_member` |
| admins manage day status | ALL | authenticated | `is_org_admin` |

### `storage.objects` (child-photos bucket)

The `child-photos` bucket is **private** (not publicly readable). File paths follow the convention `<org_id>/<filename>`.

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| members read child photos | SELECT | authenticated | `is_org_member(uid, path_org_id)` |
| members upload child photos | INSERT | authenticated | `is_org_member(uid, path_org_id)` |
| admins update child photos | UPDATE | authenticated | `is_org_admin(uid, path_org_id)` |
| admins delete child photos | DELETE | authenticated | `is_org_admin(uid, path_org_id)` |

The org ID in the file path is extracted at policy evaluation time via `storage.foldername(name)[1]::uuid`.

### `realtime.messages` (broadcast / presence)

Only topics prefixed with `org:<uuid>` are scoped by organization. PostgreSQL-change topics bypass this policy and inherit security from the source table's own RLS.

| Policy | Operation | Who | Condition |
|--------|-----------|-----|-----------|
| members read own org realtime topics | SELECT | authenticated | topic matches `org:<org_id>` AND `is_org_member` |
| members write own org realtime topics | INSERT | authenticated | topic matches `org:<org_id>` AND `is_org_member` |

---

## 4. Authentication & Invite Flow

### How authentication works

Tilstede uses Supabase Auth with email + password. On successful login, Supabase issues a **JWT** signed with the project's secret. Every API request includes this JWT in the `Authorization: Bearer <token>` header. The Supabase API gateway validates the signature and injects the `authenticated` role and `auth.uid()` into the database session, making the user's UUID available to all RLS policies.

```
Client                Supabase API         PostgreSQL
  │  POST /auth/v1/token    │                   │
  │─────────────────────────▶                   │
  │       JWT ◀─────────────│                   │
  │                         │                   │
  │  GET /rest/v1/children   │                   │
  │  Authorization: Bearer … │                   │
  │─────────────────────────▶                   │
  │                         │  SET role = 'authenticated'
  │                         │  SET request.jwt.claims = …
  │                         │──────────────────▶│
  │                         │  SELECT * FROM children
  │                         │  [RLS filters rows automatically]
  │                         │◀──────────────────│
  │       JSON rows ◀───────│                   │
```

### Invite-only registration

New staff members cannot self-register. The flow is:

1. Admin creates an invite via the app → generates a random code stored in `organization_invites` with a 14-day expiry.
2. Admin shares the code with the new employee out-of-band.
3. Employee visits `/signup/personale`, creates an account with email + password.
4. After signup, the app calls `POST /rest/v1/rpc/redeem_invite` with the code.
5. `redeem_invite()` atomically claims the invite with `UPDATE ... RETURNING` and inserts the user into `organization_members`.

The function is **SECURITY INVOKER** — it runs with the caller's privileges and is backed by three RLS policies:

| Policy | Table | Purpose |
|--------|-------|---------|
| `user can claim unused invite` | `organization_invites` | Allows the UPDATE that marks the invite as used |
| `users see own redeemed invites` | `organization_invites` | Lets the user SELECT their just-consumed invite (needed for the next check) |
| `users can join org through redeemed invite` | `organization_members` | Allows the INSERT, verified by EXISTS on the redeemed invite |

The entire redemption is a single atomic database function — no partial states are possible.

### Server-side auth middleware

Protected server routes (TanStack Start server functions) use `src/integrations/supabase/auth-middleware.ts`. This middleware:
- Reads the `Authorization: Bearer <token>` header.
- Calls `auth.getClaims()` to validate the JWT server-side.
- Injects `userId` and `claims` into the route context.
- Returns 401 if the token is missing or invalid.

---

## 5. Encryption

### Encryption at rest

| Layer | Mechanism |
|-------|-----------|
| PostgreSQL disk | AES-256 block-level encryption managed by Supabase infrastructure |
| Supabase Auth password hashes | bcrypt with cost factor 10 (managed by GoTrue) |
| JWT signing secret | HS256, stored as a Supabase project secret |

All data written to the PostgreSQL database is encrypted at rest by the underlying Supabase/cloud infrastructure. This is transparent to the application and requires no code.

### Encryption in transit

| Layer | Mechanism |
|-------|-----------|
| Client ↔ Supabase API | TLS 1.2+ enforced by Supabase |
| Server ↔ Supabase API | TLS 1.2+ (same endpoint) |
| Vercel edge ↔ browser | TLS 1.2+ with HSTS |

`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` is sent on every response, forcing HTTPS permanently once the browser has seen the header. The domain is eligible for browser HSTS preload lists.

### HTTP security headers

Security headers are enforced at two layers so that both SSR-rendered HTML and static assets (JS, CSS, images, manifest) are covered:

**Layer 1 — `vercel.json` headers block**
Applied by Vercel's edge to **every response before routing**, including static files served directly from the CDN that never reach the SSR function.

**Layer 2 — `src/lib/security-headers.ts`**
Applied by the TanStack Start server for SSR-rendered routes via `setResponseHeaders` inside the root `beforeLoad` hook. These overlap with the `vercel.json` headers and allow future route-specific customisation (e.g. per-route CSP nonces).

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'` | Restricts which origins can load resources. `frame-ancestors 'none'` prevents the page from being embedded (clickjacking). `object-src 'none'` blocks Flash/plugins. |
| `X-Frame-Options` | `DENY` | Clickjacking protection for older browsers that do not understand CSP `frame-ancestors`. |
| `X-Content-Type-Options` | `nosniff` | Prevents browsers from MIME-sniffing responses away from the declared `Content-Type`, blocking content-type confusion attacks. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sends full path to same-origin requests; sends only the origin to cross-origin HTTPS; sends nothing to HTTP. Prevents URL leakage. |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=()` | Restricts browser feature access. Camera is allowed for the app itself; microphone and geolocation are fully disabled. |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Enforces HTTPS for 2 years across all subdomains. |
| `Cross-Origin-Resource-Policy` | `same-origin` | Prevents other origins from loading these resources in no-cors mode — blocks hotlinking of images, JS, and CSS from third-party sites. |
| `Cross-Origin-Opener-Policy` | `same-origin` | Isolates the browsing context from cross-origin popups and windows, preventing cross-origin `window.opener` attacks. |

> **Note on static asset CORS:** Vercel's CDN adds `Access-Control-Allow-Origin: *` to static files at the platform level — this cannot be overridden via `vercel.json`. It is intentional CDN behaviour for publicly cacheable assets and does not expose sensitive data. `Cross-Origin-Resource-Policy: same-origin` provides the meaningful browser-level cross-domain protection.

### Application-level encryption

There is **no column-level encryption** in the current implementation. All data is stored in plaintext in PostgreSQL (protected by disk-level AES-256 and RLS, but readable by anyone with direct database access such as a service role key or superuser).

Fields that contain personally identifiable information (PII):

| Table | Column | Content |
|-------|--------|---------|
| `children` | `cpr_number` | Danish CPR number (national ID) |
| `children` | `parent_1_phone`, `parent_2_phone` | Parent phone numbers |
| `children` | `doctor_phone` | Doctor contact |
| `children` | `address` | Home address |
| `children` | `allergies`, `special_notes` | Medical/care notes |
| `profiles` | `email` | User email |
| `employee_time_logs` | (via profile join) | Staff identity |

See [Section 6](#6-security-considerations--recommendations) for recommendations.

---

## 6. Security Considerations & Recommendations

### Scanner / linter findings

| Finding | Tool | Status | Resolution |
|---------|------|--------|------------|
| Content Security Policy header not set | OWASP ZAP | ✅ Resolved | CSP applied via `vercel.json` to all responses including static assets |
| Missing anti-clickjacking header | OWASP ZAP | ✅ Resolved | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` applied via `vercel.json` |
| X-Content-Type-Options header missing | OWASP ZAP | ✅ Resolved | `X-Content-Type-Options: nosniff` applied via `vercel.json` |
| Cross-domain misconfiguration | OWASP ZAP | ✅ Resolved | `Cross-Origin-Resource-Policy: same-origin` applied via `vercel.json` |
| `is_org_member` / `is_org_admin` / `is_day_closed` SECURITY DEFINER | Supabase linter | ✅ Resolved | Moved to `private` schema (invisible to PostgREST REST API) |
| `redeem_invite` SECURITY DEFINER callable by authenticated | Supabase linter | ✅ Resolved | Converted to SECURITY INVOKER (migration `20260509130000`) |
| Leaked password protection disabled | Supabase linter | ⚠️ Action required | Must be toggled in the Supabase dashboard (see below) |

### Leaked password protection (action required)

The Supabase linter reports this as disabled. Enable it in the Supabase dashboard:

> **Dashboard → Authentication → Providers → Email → Password → Enable "Protect against compromised passwords"**

This checks new passwords against the [HaveIBeenPwned](https://haveibeenpwned.com/Passwords) database (via a k-anonymity API — the full password is never sent). Users are prevented from registering with known-breached passwords.

This cannot be enabled via a SQL migration; it must be set in the dashboard or via the Supabase Management API.

### redeem_invite

`redeem_invite` is now **SECURITY INVOKER** (migration `20260509130000`). The linter warning for this function is resolved. It is backed by three RLS policies that together enforce the invite redemption flow without requiring elevated privileges (see [Section 4](#4-authentication--invite-flow)).

### CPR number encryption (recommended)

Danish CPR numbers are national identifiers (equivalent to SSN). Storing them in plaintext is compliant with current setup (protected by RLS and disk encryption) but consider encrypting them at the column level using the `pgcrypto` extension:

```sql
-- Example: store encrypted
UPDATE children
SET cpr_number = encode(encrypt(cpr_number::bytea, 'your-key'::bytea, 'aes'), 'base64');

-- Retrieve decrypted
SELECT convert_from(decrypt(decode(cpr_number, 'base64'), 'your-key'::bytea, 'aes'), 'utf8')
FROM children WHERE id = '...';
```

For production use, the encryption key should come from a secret manager (not hardcoded). Supabase Vault (`vault.secrets`) can store and retrieve secrets securely within functions.

### Staff access to sensitive child data

Currently all `employee` role members can read **all fields** on the `children` table, including CPR numbers and medical notes. If stricter access is needed:

- Grant `admin` access to sensitive columns only via column-level privileges
- Or separate sensitive columns into a `children_sensitive` table with admin-only RLS policies
- Or perform field filtering in the application tier before returning data to the UI

### Service role key

The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS. It is used server-side (`src/integrations/supabase/client.server.ts`) for admin operations. **Never expose it to the client.** It must only be used in server-side code and must be stored as a secret (Vercel environment variable / Supabase Edge Function secret), never committed to source control.

The `.env` file containing this key is in `.gitignore`. Verify it is never committed:
```bash
git log --all --full-history -- .env
```

---

## 7. Applying Migrations

Migrations are in `supabase/migrations/` and should be applied in filename order.

### Apply to the live project

```bash
# Install Supabase CLI if needed
npm install -g supabase

# Link to the live project (run once)
supabase link --project-ref lihwlthdjimofgqdpuph

# Push all pending migrations
supabase db push
```

### Apply the phase 2 hardening migration specifically

```bash
supabase db push --include-all
```

Or apply it manually via the Supabase SQL editor:

1. Open the Supabase dashboard → SQL Editor
2. Paste the contents of `20260509120000_rls_hardening_phase2.sql`
3. Run

### Verify in the Supabase linter

After applying, go to:
> **Dashboard → Database → Linter**

The following warnings should be resolved:
- ✅ `rls_auto_enable` — dropped
- ✅ `is_org_member`, `is_org_admin`, `is_day_closed` — moved to private schema, no longer in linter scope
- ✅ `redeem_invite` — converted to SECURITY INVOKER (migration `20260509130000`)
- ⚠️ `auth_leaked_password_protection` — requires dashboard toggle (see Section 6)

### Migration history

| File | Description |
|------|-------------|
| `20260501030831_*` | Initial schema: all tables, enums, triggers, helper functions, RLS policies |
| `20260501030847_*` | Tighten search_path on trigger functions; revoke EXECUTE on helpers from all roles |
| `20260501030902_*` | Grant EXECUTE on helpers to authenticated |
| `20260501095556_*` | Reset auth users (dev only) |
| `20260501101633_*` | Add organization_invites table, redeem_invite() function |
| `20260501103709_*` | Add handle_day_close() trigger (auto-snapshot on day close) |
| `20260501103723_*` | Revoke EXECUTE on handle_day_close from public |
| `20260501104244_*` | Add auto-checkout of present children on day close |
| `20260501104541_*` | Make child-photos bucket private; lock down invite policies; restrict EXECUTE on internal functions |
| `20260504170315_*` | Add photo_url + notes columns to children; add storage RLS policies |
| `20260504171052_*` | Restrict storage UPDATE to admins; add realtime.messages RLS |
| `20260504172440_*` | Further revokes on helpers; fix realtime policy naming |
| `20260504173627_*` | Fix realtime write policy name |
| `20260504174707_*` | Remove upload/delete storage policies (accidentally over-restricted) |
| `20260504174919_*` | (empty) |
| `20260504174934_*` | (empty) |
| `20260504181639_*` | Set child-photos MIME type and size limits |
| `20260508215000_rls_hardening_phase1` | Draft hardening — superseded by phase 2 |
| `20260509120000_rls_hardening_phase2` | Private schema helpers, full policy rebuild, storage policies restored |
| **`20260509130000_redeem_invite_security_invoker`** | **Convert redeem_invite to SECURITY INVOKER with supporting RLS policies** |
