import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const sletEgenKonto = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ accessToken: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    // Validate token server-side — never trust client-supplied user IDs
    const { data: { user }, error: authError } =
      await supabaseAdmin.auth.getUser(data.accessToken);

    if (authError || !user) {
      throw new Error("Ugyldig session. Log ind igen og prøv igen.");
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (error) {
      console.error("[sletEgenKonto] deleteUser failed", error.message);
      throw new Error(
        "Sletning mislykkedes. Prøv igen eller kontakt support@tilstede.live.",
      );
    }
  });
