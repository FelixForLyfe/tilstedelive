import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ORG_TYPES = ["skole_sfo", "sportsklub", "fitnesscenter", "spejder", "daginstitution", "andet"] as const;

const createOrganizationSchema = z.object({
  fullName: z.string().trim().min(1, "Navn er påkrævet").max(120),
  orgName: z.string().trim().min(1, "Organisationens navn er påkrævet").max(120),
  orgType: z.enum(ORG_TYPES).default("skole_sfo"),
  email: z.string().trim().toLowerCase().email("Ugyldig e-mail").max(254),
  password: z.string().min(8, "Adgangskoden skal være mindst 8 tegn").max(128),
});

const GENERIC_ERR = "Kunne ikke oprette organisationen. Prøv igen eller kontakt support.";
const RATE_ERR = "For mange forsøg. Prøv igen om lidt.";

// In-memory per-IP rate limit: max 5 signups / 10 min per IP.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const ipHits = new Map<string, number[]>();

function checkRate(ip: string): boolean {
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_MAX) {
    ipHits.set(ip, arr);
    return false;
  }
  arr.push(now);
  ipHits.set(ip, arr);
  // Light cleanup
  if (ipHits.size > 5000) {
    for (const [k, v] of ipHits) {
      const fresh = v.filter((t) => now - t < RATE_WINDOW_MS);
      if (fresh.length === 0) ipHits.delete(k);
      else ipHits.set(k, fresh);
    }
  }
  return true;
}

export const createOrganizationAdmin = createServerFn({ method: "POST" })
  .inputValidator((data) => createOrganizationSchema.parse(data))
  .handler(async ({ data }) => {
    let ip = "unknown";
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    } catch {
      // ignore
    }
    if (!checkRate(ip)) {
      throw new Error(RATE_ERR);
    }
    try {
      const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName },
      });

      if (userError || !userResult.user) {
        // Generic error to avoid email enumeration
        console.error("[createOrganizationAdmin] auth.createUser failed", userError?.message);
        throw new Error(GENERIC_ERR);
      }

      const userId = userResult.user.id;

      const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
        id: userId,
        email: data.email,
        full_name: data.fullName,
      });

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.error("[createOrganizationAdmin] profiles upsert failed", profileError.message);
        throw new Error(GENERIC_ERR);
      }

      const { data: org, error: orgError } = await supabaseAdmin
        .from("organizations")
        .insert({ name: data.orgName, org_type: data.orgType, created_by: userId })
        .select("id, name")
        .single();

      if (orgError || !org) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.error("[createOrganizationAdmin] organizations insert failed", orgError?.message);
        throw new Error(GENERIC_ERR);
      }

      const { error: memberError } = await supabaseAdmin.from("organization_members").insert({
        organization_id: org.id,
        user_id: userId,
        role: "admin",
        status: "active",
      });

      if (memberError) {
        await supabaseAdmin.from("organizations").delete().eq("id", org.id);
        await supabaseAdmin.auth.admin.deleteUser(userId);
        console.error("[createOrganizationAdmin] members insert failed", memberError.message);
        throw new Error(GENERIC_ERR);
      }

      return { organizationId: org.id, organizationName: org.name };
    } catch (err) {
      if (err instanceof z.ZodError) throw err;
      if (err instanceof Error && err.message === GENERIC_ERR) throw err;
      console.error("[createOrganizationAdmin] unexpected", err);
      throw new Error(GENERIC_ERR);
    }
  });
