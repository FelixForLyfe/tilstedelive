# Verification & Security Validation Plan

A read-only audit pass across the app — no feature changes. Any issue found is fixed in a follow-up after your approval.

## 1. Static code & dependency audit
- Run `bun audit` (or `npm audit`) for known CVEs in dependencies.
- `rg` for risky patterns: `dangerouslySetInnerHTML`, `eval(`, `Math.random` (security contexts), `process.env` in client code, `supabaseAdmin` imports outside `*.server.ts`.
- Confirm `src/integrations/supabase/client.server.ts` is never imported from client code.

## 2. Database & RLS review
- `supabase--linter` for misconfigurations.
- Re-read RLS on every table (children, attendance_records, daily_logs, organization_invites, organization_members, employee_time_logs, profiles) and verify least-privilege.
- Confirm `SECURITY DEFINER` functions have `search_path = public` and revoked public EXECUTE where appropriate.
- Verify `child-photos` bucket is private and signed-URL flow still works.

## 3. Server function & route hardening
- Re-check every `createServerFn` for: Zod input validation, generic error messages (no enumeration), `requireSupabaseAuth` middleware where needed.
- Check `/api/public/*` routes for signature verification + Zod validation.
- Confirm no PII in `console.log` / thrown errors.

## 4. Auth flow validation (manual via browser tool)
- Desktop (1280) + mobile (390) viewports:
  - Signup (admin + employee invite redemption)
  - Login / logout
  - Password reset path exists at `/reset-password`
  - Session persistence + `onAuthStateChange` listener
- Verify password min length 8, HIBP check enabled.

## 5. Feature regression smoke tests
- `/app` status page: filter toggle "kun tilstede", category filter, search, daily-note "X" button next to time.
- `/app/admin`: child CRUD, photo upload (signed URL), invite code generation (CSPRNG).
- `/app/logning` (current page): daily logs render correctly.
- Day-close trigger writes snapshot + auto-checkout still works.
- Realtime subscription scoped to user's org.

## 6. Headers, CORS, CSRF
- Verify `__root.tsx` SSR sets: HSTS, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy.
- Add CSP header check (currently missing — flag if absent).
- Confirm server functions are same-origin (no CORS needed); `/api/public/*` uses explicit allowlist.
- CSRF: TanStack server functions are POST + same-origin + Supabase JWT — confirm no cookie-only auth endpoints exist.

## 7. Rate limiting check
- Inspect server functions for rate limiting on auth-adjacent endpoints (`createOrganizationAdmin`, `redeem_invite`).
- Flag if missing — Supabase auth has built-in throttling but custom server fns may not.

## 8. Console, accessibility, responsive
- `code--read_console_logs` after browser walkthrough — expect 0 errors/warnings (ignore the known `RESET_BLANK_CHECK` from Lovable harness).
- Tab-order / aria checks on key forms (login, signup, BarnDetalje).
- Viewport tests at 390 / 768 / 1280.

## 9. Security scan
- `security--run_security_scan` for the final report.
- Triage findings: mark fixed / ignore with justification + update security memory.

## Deliverable
A single report listing: pass/fail per section, exact file:line for any finding, and a prioritized remediation list. No code changes in this pass — fixes happen after you approve the report.

Approve to switch to build mode and execute.