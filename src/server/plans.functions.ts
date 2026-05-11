import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function decodeJwtUserId(accessToken: string): string {
  const parts = accessToken.split(".");
  if (parts.length !== 3) throw new Error("Ugyldig session.");
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf-8"));
    if (!payload?.sub) throw new Error();
    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) throw new Error("Session udløbet. Log ind igen.");
    return payload.sub as string;
  } catch (e: any) {
    throw new Error(e?.message ?? "Ugyldig session.");
  }
}

export const redeemPlanKey = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      accessToken: z.string().min(1),
      orgId: z.string().uuid(),
      code: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const userId = decodeJwtUserId(data.accessToken);

    // Verify user is admin of the org
    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", userId)
      .eq("organization_id", data.orgId)
      .eq("status", "active")
      .single();

    if (membership?.role !== "admin") {
      throw new Error("Kun administratorer kan indløse aktiveringsnøgler.");
    }

    const normalizedCode = data.code.toUpperCase().trim();

    const { data: key, error: keyError } = await (supabaseAdmin as any)
      .from("plan_keys")
      .select("id, plan_type, used, label")
      .eq("code", normalizedCode)
      .single();

    if (keyError || !key) throw new Error("Ukendt aktiveringsnøgle. Kontrollér koden og prøv igen.");
    if (key.used) throw new Error("Denne nøgle er allerede blevet brugt.");

    const { error: markError } = await (supabaseAdmin as any)
      .from("plan_keys")
      .update({ used: true, used_by: data.orgId, used_at: new Date().toISOString() })
      .eq("id", key.id);
    if (markError) throw new Error(markError.message);

    const { error: orgError } = await (supabaseAdmin as any)
      .from("organizations")
      .update({
        subscription_tier: key.plan_type,
        subscription_status: "active",
        trial_ends_at: null,
      })
      .eq("id", data.orgId);
    if (orgError) throw new Error(orgError.message);

    return { planType: key.plan_type as string, label: (key.label ?? null) as string | null };
  });
