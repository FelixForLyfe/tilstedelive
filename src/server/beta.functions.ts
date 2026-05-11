import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

const BetaSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  org_type: z.enum(["sfo", "forening", "butik", "andet"]),
  org_name: z.string().max(200).optional(),
  role: z.string().max(100).optional(),
  message: z.string().max(1000).optional(),
});

export const submitBetaSignup = createServerFn({ method: "POST" })
  .validator((data: unknown) => BetaSchema.parse(data))
  .handler(async ({ data }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { error } = await supabase.from("beta_signups").insert({
      name: data.name,
      email: data.email,
      org_type: data.org_type,
      org_name: data.org_name ?? null,
      role: data.role ?? null,
      message: data.message ?? null,
      source: "landing",
    });

    if (error) {
      if (error.code === "23505") {
        throw new Error("Denne e-mail er allerede tilmeldt — tak!");
      }
      throw new Error("Kunne ikke gemme din tilmelding. Prøv igen.");
    }

    return { ok: true };
  });
