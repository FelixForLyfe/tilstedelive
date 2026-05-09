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

// Silent audit — never throws, so a missing column won't break a panel action.
async function auditLog(
  userId: string,
  event: string,
  orgId?: string | null,
  meta?: Record<string, unknown>,
) {
  try {
    await (supabaseAdmin as any).from("audit_logs").insert({
      user_id: userId,
      action: "INSERT",
      action_type: "superadmin_action",
      table_name: "superadmin",
      record_id: null,
      org_id: orgId ?? null,
      metadata: { event, ...meta },
    });
  } catch {
    // audit failure is non-fatal
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function isMissingColumn(err: any): boolean {
  return (
    typeof err?.message === "string" &&
    (err.message.includes("does not exist") ||
      err.message.includes("column") ||
      err.code === "42703")
  );
}

function isMissingTable(err: any): boolean {
  return (
    typeof err?.message === "string" &&
    (err.message.includes("relation") ||
      err.message.includes("does not exist") ||
      err.code === "42P01")
  );
}

// ─── List all organisations ───────────────────────────────────────────────────

export const superadminListOrgs = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const user = await verifySuperadmin(data.accessToken);
    await auditLog(user.id, "SUPERADMIN_VISIT");

    // Try full select (includes gratis_reason added in migration 20260509220000)
    const full = await (supabaseAdmin as any)
      .from("organizations")
      .select(
        "id, name, org_type, subscription_tier, subscription_status, trial_ends_at, created_at, stripe_customer_id, stripe_subscription_id, gratis_reason",
      )
      .order("created_at", { ascending: false });

    // Fall back without gratis_reason if column not yet migrated
    if (full.error && isMissingColumn(full.error)) {
      const base = await (supabaseAdmin as any)
        .from("organizations")
        .select(
          "id, name, org_type, subscription_tier, subscription_status, trial_ends_at, created_at, stripe_customer_id, stripe_subscription_id",
        )
        .order("created_at", { ascending: false });
      if (base.error) throw new Error(base.error.message);
      return (base.data ?? []).map((o: any) => ({ ...o, gratis_reason: null }));
    }

    if (full.error) throw new Error(full.error.message);
    return (full.data ?? []).map((o: any) => ({ ...o, gratis_reason: o.gratis_reason ?? null }));
  });

// ─── Lightweight org list for dropdowns ──────────────────────────────────────

export const superadminListOrgNames = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await verifySuperadmin(data.accessToken);
    const { data: orgs, error } = await supabaseAdmin
      .from("organizations")
      .select("id, name")
      .order("name");
    if (error) throw new Error(error.message);
    return (orgs ?? []) as { id: string; name: string }[];
  });

// ─── Update org subscription (tier) ──────────────────────────────────────────

const TIERS = ["gratis", "basis", "pro", "organisation", "kommune", "special"] as const;
const STATUSES = ["active", "past_due", "canceled", "trialing", "expired", "gratis"] as const;

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

    const { error } = await (supabaseAdmin as any)
      .from("organizations")
      .update(patch)
      .eq("id", data.orgId);

    if (error) throw new Error(error.message);
    await auditLog(user.id, "SUPERADMIN_UPDATE_ORG", data.orgId, { patch });
    return { success: true };
  });

// ─── Extend trial ─────────────────────────────────────────────────────────────

export const superadminExtendTrial = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        orgId: z.string().uuid(),
        newTrialEndsAt: z.string().min(1),
        reason: z.string().trim().min(5, "Angiv venligst en årsag (min. 5 tegn)"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await verifySuperadmin(data.accessToken);

    const { data: org } = await (supabaseAdmin as any)
      .from("organizations")
      .select("trial_ends_at")
      .eq("id", data.orgId)
      .single();

    const { error } = await (supabaseAdmin as any)
      .from("organizations")
      .update({ trial_ends_at: data.newTrialEndsAt, subscription_status: "trialing" })
      .eq("id", data.orgId);

    if (error) throw new Error(error.message);

    await auditLog(admin.id, "SUPERADMIN_EXTEND_TRIAL", data.orgId, {
      old_trial_ends_at: org?.trial_ends_at ?? null,
      new_trial_ends_at: data.newTrialEndsAt,
      reason: data.reason,
    });

    return { success: true };
  });

// ─── Set subscription status override ────────────────────────────────────────

export const superadminSetOrgStatus = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        orgId: z.string().uuid(),
        subscriptionStatus: z.enum(STATUSES),
        gratisReason: z.string().trim().optional(),
        reason: z.string().trim().min(5, "Angiv venligst en årsag (min. 5 tegn)"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await verifySuperadmin(data.accessToken);

    const { data: org } = await (supabaseAdmin as any)
      .from("organizations")
      .select("subscription_status")
      .eq("id", data.orgId)
      .single();

    const patch: Record<string, unknown> = { subscription_status: data.subscriptionStatus };
    if (data.subscriptionStatus === "gratis" && data.gratisReason) {
      patch.gratis_reason = data.gratisReason;
    }

    const { error } = await (supabaseAdmin as any)
      .from("organizations")
      .update(patch)
      .eq("id", data.orgId);

    if (error) throw new Error(error.message);

    await auditLog(admin.id, "SUPERADMIN_SET_STATUS", data.orgId, {
      old_status: org?.subscription_status ?? null,
      new_status: data.subscriptionStatus,
      gratis_reason: data.gratisReason ?? null,
      reason: data.reason,
    });

    return { success: true };
  });

// ─── Dashboard data ───────────────────────────────────────────────────────────

export const superadminGetDashboard = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await verifySuperadmin(data.accessToken);

    // Orgs — try with gratis_reason, fall back without
    const orgsResult = await (async () => {
      const r = await (supabaseAdmin as any)
        .from("organizations")
        .select("id, name, org_type, subscription_tier, subscription_status, trial_ends_at, stripe_customer_id, created_at, gratis_reason")
        .order("created_at", { ascending: false });
      if (r.error && isMissingColumn(r.error)) {
        const fb = await (supabaseAdmin as any)
          .from("organizations")
          .select("id, name, org_type, subscription_tier, subscription_status, trial_ends_at, stripe_customer_id, created_at")
          .order("created_at", { ascending: false });
        return { data: (fb.data ?? []).map((o: any) => ({ ...o, gratis_reason: null })), error: fb.error };
      }
      return r;
    })();

    const [{ data: members }, { count: totalAttendance }, { count: totalTimeLogs }] =
      await Promise.all([
        supabaseAdmin
          .from("organization_members")
          .select("organization_id, user_id")
          .eq("status", "active"),
        supabaseAdmin.from("attendance_records").select("*", { count: "exact", head: true }),
        supabaseAdmin.from("employee_time_logs").select("*", { count: "exact", head: true }),
      ]);

    const orgMemberCounts: Record<string, number> = {};
    for (const m of members ?? []) {
      orgMemberCounts[m.organization_id] = (orgMemberCounts[m.organization_id] ?? 0) + 1;
    }

    let costs: unknown[] = [];
    try {
      const { data: c } = await (supabaseAdmin as any)
        .from("monthly_costs")
        .select("id, month, category, amount_dkk, note")
        .order("month", { ascending: false })
        .limit(24);
      costs = c ?? [];
    } catch {
      // monthly_costs table may not exist yet
    }

    return {
      orgs: (orgsResult.data ?? []) as DashboardOrg[],
      orgMemberCounts,
      totalMembers: (members ?? []).length,
      totalAttendanceRecords: totalAttendance ?? 0,
      totalTimeLogs: totalTimeLogs ?? 0,
      costs: costs as MonthlyCost[],
    };
  });

export type DashboardOrg = {
  id: string;
  name: string;
  org_type: string;
  subscription_tier: string;
  subscription_status: string;
  trial_ends_at: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  gratis_reason: string | null;
};

export type MonthlyCost = {
  id: string;
  month: string;
  category: string;
  amount_dkk: number;
  note: string | null;
};

// ─── Save monthly costs ───────────────────────────────────────────────────────

export const superadminSaveMonthlyCosts = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        month: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ugyldig dato"),
        costs: z
          .array(
            z.object({
              category: z.string().trim().min(1),
              amount_dkk: z.number().int().min(0),
              note: z.string().optional(),
            }),
          )
          .max(20),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await verifySuperadmin(data.accessToken);

    await (supabaseAdmin as any).from("monthly_costs").delete().eq("month", data.month);

    if (data.costs.length > 0) {
      const { error } = await (supabaseAdmin as any).from("monthly_costs").insert(
        data.costs.map((c) => ({
          month: data.month,
          category: c.category,
          amount_dkk: c.amount_dkk,
          note: c.note ?? null,
        })),
      );
      if (error) throw new Error(error.message);
    }

    await auditLog(admin.id, "SUPERADMIN_SAVE_COSTS", null, {
      month: data.month,
      entries: data.costs.length,
      total_dkk: data.costs.reduce((s, c) => s + c.amount_dkk, 0),
    });

    return { success: true };
  });

// ─── List users ───────────────────────────────────────────────────────────────

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

    // Table missing — migration 20260509200000 not yet applied
    if (error && isMissingTable(error)) return [];
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

    let code = generateCode();
    let inserted = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { error } = await (supabaseAdmin as any).from("plan_keys").insert({
        code,
        plan_type: data.planType,
        created_by: user.id,
      });
      if (!error) {
        inserted = true;
        break;
      }
      if (isMissingTable(error)) {
        throw new Error("plan_keys-tabellen eksisterer ikke endnu. Kør migration 20260509200000.");
      }
      if (error.code !== "23505") throw new Error(error.message);
      code = generateCode();
    }
    if (!inserted) throw new Error("Kunne ikke generere unik nøgle. Prøv igen.");

    await auditLog(user.id, "SUPERADMIN_GENERATE_KEY", null, { code, plan_type: data.planType });
    return { code };
  });

// ─── List superadmin audit log ────────────────────────────────────────────────

export const superadminListAuditLog = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await verifySuperadmin(data.accessToken);

    // Try with action_type filter (requires migration 20260509200000)
    const result = await (supabaseAdmin as any)
      .from("audit_logs")
      .select("id, created_at, user_id, action, org_id, metadata")
      .eq("action_type", "superadmin_action")
      .order("created_at", { ascending: false })
      .limit(200);

    // action_type column not migrated yet — return recent logs without filter
    let logs: any[] = [];
    if (result.error && isMissingColumn(result.error)) {
      const fb = await (supabaseAdmin as any)
        .from("audit_logs")
        .select("id, created_at, user_id, action, org_id")
        .order("created_at", { ascending: false })
        .limit(50);
      logs = fb.data ?? [];
    } else if (result.error) {
      throw new Error(result.error.message);
    } else {
      logs = result.data ?? [];
    }

    const orgIds = [...new Set(logs.filter((l) => l.org_id).map((l) => l.org_id as string))];
    let orgMap: Record<string, string> = {};
    if (orgIds.length > 0) {
      const { data: orgs } = await supabaseAdmin
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);
      orgMap = Object.fromEntries((orgs ?? []).map((o) => [o.id, o.name]));
    }

    return logs.map((l: any) => ({
      id: l.id as string,
      createdAt: l.created_at as string,
      event: (l.metadata?.event ?? l.action) as string,
      orgName: l.org_id ? (orgMap[l.org_id] ?? "Ukendt org") : null,
      metadata: (l.metadata ?? null) as Record<string, unknown> | null,
    }));
  });

// ─── Custom plans ─────────────────────────────────────────────────────────────

export type CustomPlan = {
  id: string;
  organization_id: string;
  org_name: string | null;
  name: string;
  price_dkk: number;
  description: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  created_at: string;
};

const CUSTOM_PLAN_STATUSES = ["active", "expired", "cancelled"] as const;

export const superadminListCustomPlans = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await verifySuperadmin(data.accessToken);

    const { data: plans, error } = await (supabaseAdmin as any)
      .from("custom_plans")
      .select("id, organization_id, name, price_dkk, description, start_date, end_date, status, created_at, organizations(name)")
      .order("created_at", { ascending: false });

    if (error && isMissingTable(error)) return [] as CustomPlan[];
    if (error) throw new Error(error.message);

    return (plans ?? []).map((p: any) => ({
      id: p.id as string,
      organization_id: p.organization_id as string,
      org_name: (p.organizations?.name ?? null) as string | null,
      name: p.name as string,
      price_dkk: p.price_dkk as number,
      description: (p.description ?? null) as string | null,
      start_date: p.start_date as string,
      end_date: (p.end_date ?? null) as string | null,
      status: p.status as string,
      created_at: p.created_at as string,
    })) as CustomPlan[];
  });

export const superadminCreateCustomPlan = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        organizationId: z.string().uuid(),
        name: z.string().trim().min(1, "Plannavn er påkrævet"),
        price_dkk: z.number().int().min(0),
        description: z.string().trim().optional(),
        start_date: z.string().min(1, "Startdato er påkrævet"),
        end_date: z.string().nullable().optional(),
        status: z.enum(CUSTOM_PLAN_STATUSES).default("active"),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await verifySuperadmin(data.accessToken);

    const { error } = await (supabaseAdmin as any).from("custom_plans").insert({
      organization_id: data.organizationId,
      name: data.name,
      price_dkk: data.price_dkk,
      description: data.description ?? null,
      start_date: data.start_date,
      end_date: data.end_date ?? null,
      status: data.status,
      created_by: admin.id,
    });

    if (error) throw new Error(error.message);

    await auditLog(admin.id, "SUPERADMIN_CREATE_CUSTOM_PLAN", data.organizationId, {
      plan_name: data.name,
      price_dkk: data.price_dkk,
      start_date: data.start_date,
    });

    return { success: true };
  });

export const superadminUpdateCustomPlan = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        accessToken: z.string().min(1),
        planId: z.string().uuid(),
        name: z.string().trim().min(1),
        price_dkk: z.number().int().min(0),
        description: z.string().trim().optional(),
        start_date: z.string().min(1),
        end_date: z.string().nullable().optional(),
        status: z.enum(CUSTOM_PLAN_STATUSES),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const admin = await verifySuperadmin(data.accessToken);

    const { error } = await (supabaseAdmin as any)
      .from("custom_plans")
      .update({
        name: data.name,
        price_dkk: data.price_dkk,
        description: data.description ?? null,
        start_date: data.start_date,
        end_date: data.end_date ?? null,
        status: data.status,
      })
      .eq("id", data.planId);

    if (error) throw new Error(error.message);

    await auditLog(admin.id, "SUPERADMIN_UPDATE_CUSTOM_PLAN", null, {
      plan_id: data.planId,
      new_status: data.status,
    });

    return { success: true };
  });
