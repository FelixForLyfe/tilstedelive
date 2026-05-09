import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const FORBIDDEN = "Ingen adgang.";

async function verifySuperadmin(accessToken: string) {
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !user) throw new Error(FORBIDDEN);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if ((profile as any)?.role !== "superadmin") throw new Error(FORBIDDEN);
  return user;
}

async function auditLog(
  userId: string,
  event: string,
  orgId?: string | null,
  meta?: Record<string, unknown>,
) {
  await (supabaseAdmin as any).from("audit_logs").insert({
    user_id: userId,
    action: "INSERT",
    action_type: "superadmin_action",
    table_name: "superadmin",
    record_id: null,
    org_id: orgId ?? null,
    metadata: { event, ...meta },
  });
}

// ─── List all organisations ───────────────────────────────────────────────────

export const superadminListOrgs = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const user = await verifySuperadmin(data.accessToken);
    await auditLog(user.id, "SUPERADMIN_VISIT");

    const { data: orgs, error } = await supabaseAdmin
      .from("organizations")
      .select(
        "id, name, org_type, subscription_tier, subscription_status, trial_ends_at, created_at, stripe_customer_id, stripe_subscription_id",
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return orgs ?? [];
  });

// ─── Update org subscription ──────────────────────────────────────────────────

const TIERS = ["gratis", "basis", "pro", "organisation", "kommune", "special"] as const;
const STATUSES = ["active", "past_due", "canceled", "trialing", "expired"] as const;

export const superadminUpdateOrg = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        orgId: z.string().uuid(),
        subscriptionTier: z.enum(TIERS).optional(),
        subscriptionStatus: z.enum(STATUSES).optional(),
        trialEndsAt: z.string().nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await verifySuperadmin(data.accessToken);

    const patch: Record<string, unknown> = {};
    if (data.subscriptionTier !== undefined) patch.subscription_tier = data.subscriptionTier;
    if (data.subscriptionStatus !== undefined) patch.subscription_status = data.subscriptionStatus;
    if (data.trialEndsAt !== undefined) patch.trial_ends_at = data.trialEndsAt;

    if (Object.keys(patch).length === 0) return { success: true };

    const { error } = await supabaseAdmin
      .from("organizations")
      .update(patch)
      .eq("id", data.orgId);

    if (error) throw new Error(error.message);

    await auditLog(user.id, "SUPERADMIN_UPDATE_ORG", data.orgId, { patch });
    return { success: true };
  });

// ─── List users (minimal data — email + org + role only) ─────────────────────

export const superadminListUsers = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await verifySuperadmin(data.accessToken);

    const { data: members, error } = await supabaseAdmin
      .from("organization_members")
      .select("user_id, role, created_at, organization_id, organizations(name)")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) throw new Error(error.message);

    // Fetch emails in a separate batch to avoid cross-schema join complexity
    const userIds = [...new Set((members ?? []).map((m) => m.user_id))];
    const { data: profiles } = userIds.length
      ? await supabaseAdmin.from("profiles").select("id, email").in("id", userIds)
      : { data: [] };

    const emailMap: Record<string, string> = Object.fromEntries(
      (profiles ?? []).map((p) => [p.id, p.email ?? "–"]),
    );

    return (members ?? []).map((m) => ({
      userId: m.user_id,
      orgId: m.organization_id,
      email: emailMap[m.user_id] ?? "–",
      orgName: (m as any).organizations?.name ?? "–",
      role: m.role as string,
      createdAt: m.created_at as string,
    }));
  });

// ─── Delete user ──────────────────────────────────────────────────────────────

export const superadminDeleteUser = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        userId: z.string().uuid(),
        reason: z.string().trim().min(5, "Angiv venligst en årsag (min. 5 tegn)"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await verifySuperadmin(data.accessToken);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);

    await auditLog(admin.id, "SUPERADMIN_DELETE_USER", null, {
      deleted_user_id: data.userId,
      reason: data.reason,
    });

    return { success: true };
  });

// ─── List plan keys ───────────────────────────────────────────────────────────

export const superadminListPlanKeys = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await verifySuperadmin(data.accessToken);

    const { data: keys, error } = await (supabaseAdmin as any)
      .from("plan_keys")
      .select("id, code, plan_type, used, used_at, created_at, used_by, organizations(name)")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (keys ?? []).map((k: any) => ({
      id: k.id as string,
      code: k.code as string,
      planType: k.plan_type as string,
      used: k.used as boolean,
      usedAt: k.used_at as string | null,
      usedByOrgName: k.organizations?.name as string | null,
      createdAt: k.created_at as string,
    }));
  });

// ─── Generate plan key ────────────────────────────────────────────────────────

const KEY_PLAN_TYPES = ["basis", "pro", "organisation", "kommune", "special"] as const;

function generateCode(): string {
  const hex = randomBytes(8).toString("hex").toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}`;
}

export const superadminGeneratePlanKey = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        planType: z.enum(KEY_PLAN_TYPES),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await verifySuperadmin(data.accessToken);

    // Collision is astronomically unlikely but retry once if it happens
    let code = generateCode();
    let inserted = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await (supabaseAdmin as any).from("plan_keys").insert({
        code,
        plan_type: data.planType,
        created_by: user.id,
      });
      if (!error) { inserted = true; break; }
      if (error.code !== "23505") throw new Error(error.message); // not a dupe
      code = generateCode();
    }
    if (!inserted) throw new Error("Kunne ikke generere unik nøgle. Prøv igen.");

    await auditLog(user.id, "SUPERADMIN_GENERATE_KEY", null, {
      code,
      plan_type: data.planType,
    });

    return { code };
  });

// ─── List superadmin audit log ────────────────────────────────────────────────

export const superadminListAuditLog = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await verifySuperadmin(data.accessToken);

    const { data: logs, error } = await (supabaseAdmin as any)
      .from("audit_logs")
      .select("id, created_at, user_id, action, org_id, metadata")
      .eq("action_type", "superadmin_action")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    // Resolve org names in one batch
    const orgIds = [
      ...new Set(
        (logs ?? []).filter((l: any) => l.org_id).map((l: any) => l.org_id as string),
      ),
    ];
    let orgMap: Record<string, string> = {};
    if (orgIds.length > 0) {
      const { data: orgs } = await supabaseAdmin
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);
      orgMap = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
    }

    return (logs ?? []).map((l: any) => ({
      id: l.id as string,
      createdAt: l.created_at as string,
      event: (l.metadata?.event ?? l.action) as string,
      orgName: l.org_id ? (orgMap[l.org_id] ?? "Ukendt org") : null,
      metadata: l.metadata as Record<string, unknown> | null,
    }));
  });
