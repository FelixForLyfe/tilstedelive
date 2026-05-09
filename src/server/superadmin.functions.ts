import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
