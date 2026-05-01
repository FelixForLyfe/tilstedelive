import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const createOrganizationSchema = z.object({
  fullName: z.string().trim().min(1, "Navn er påkrævet"),
  orgName: z.string().trim().min(1, "Organisationens navn er påkrævet"),
  email: z.string().trim().email("Ugyldig e-mail"),
  password: z.string().min(6, "Adgangskoden skal være mindst 6 tegn"),
});

export const createOrganizationAdmin = createServerFn({ method: "POST" })
  .inputValidator((data) => createOrganizationSchema.parse(data))
  .handler(async ({ data }) => {
    const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });

    if (userError || !userResult.user) {
      throw new Error(userError?.message ?? "Kunne ikke oprette konto");
    }

    const userId = userResult.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: data.email,
      full_name: data.fullName,
    });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Kontoen kunne ikke gøres klar");
    }

    const { data: org, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({ name: data.orgName, created_by: userId })
      .select("id, name")
      .single();

    if (orgError || !org) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(orgError?.message ?? "Kunne ikke oprette organisationen");
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
      throw new Error(memberError.message);
    }

    return { organizationId: org.id, organizationName: org.name };
  });