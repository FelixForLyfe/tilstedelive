import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createOrganizationSchema = z.object({
  fullName: z.string().trim().min(1, "Navn er påkrævet").max(120),
  orgName: z.string().trim().min(1, "Organisationens navn er påkrævet").max(120),
  email: z.string().trim().toLowerCase().email("Ugyldig e-mail").max(254),
  password: z.string().min(8, "Adgangskoden skal være mindst 8 tegn").max(128),
});

const GENERIC_ERR = "Kunne ikke oprette organisationen. Prøv igen eller kontakt support.";

export const createOrganizationAdmin = createServerFn({ method: "POST" })
  .inputValidator((data) => createOrganizationSchema.parse(data))
  .handler(async ({ data }) => {
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
        .insert({ name: data.orgName, created_by: userId })
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
