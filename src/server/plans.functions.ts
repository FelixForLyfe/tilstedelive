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
      .select("id, plan_type, used, label, is_promo, max_uses, uses_count, expires_at")
      .eq("code", normalizedCode)
      .single();

    if (keyError || !key) throw new Error("Ukendt aktiveringsnøgle. Kontrollér koden og prøv igen.");

    // Check expiry
    if (key.expires_at && new Date(key.expires_at) < new Date()) {
      throw new Error("Denne aktiveringsnøgle er udløbet.");
    }

    const isPromo = key.is_promo ?? false;

    if (isPromo) {
      // Promo key: check usage limit
      const maxUses = key.max_uses as number | null;
      const usesCount = (key.uses_count ?? 0) as number;
      if (maxUses !== null && usesCount >= maxUses) {
        throw new Error("Denne kampagnekode har nået sit maksimale antal indløsninger.");
      }

      // Check org hasn't already redeemed this key
      const { data: existing } = await (supabaseAdmin as any)
        .from("plan_key_redemptions")
        .select("id")
        .eq("key_id", key.id)
        .eq("org_id", data.orgId)
        .maybeSingle();
      if (existing) throw new Error("Jeres organisation har allerede indløst denne kampagnekode.");

      // Record redemption and increment count
      await (supabaseAdmin as any)
        .from("plan_key_redemptions")
        .insert({ key_id: key.id, org_id: data.orgId });
      await (supabaseAdmin as any)
        .from("plan_keys")
        .update({ uses_count: usesCount + 1 })
        .eq("id", key.id);
    } else {
      // Single-use key
      if (key.used) throw new Error("Denne nøgle er allerede blevet brugt.");
      const { error: markError } = await (supabaseAdmin as any)
        .from("plan_keys")
        .update({ used: true, used_by: data.orgId, used_at: new Date().toISOString() })
        .eq("id", key.id);
      if (markError) throw new Error(markError.message);
    }

    const { error: orgError } = await (supabaseAdmin as any)
      .from("organizations")
      .update({ subscription_tier: key.plan_type, subscription_status: "active", trial_ends_at: null })
      .eq("id", data.orgId);
    if (orgError) throw new Error(orgError.message);

    return { planType: key.plan_type as string, label: (key.label ?? null) as string | null };
  });
