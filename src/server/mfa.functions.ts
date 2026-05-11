import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createHash, randomBytes } from "crypto";

// Safe alphabet: no I/O/0/1 to avoid visual confusion
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function genCode(): string {
  const bytes = randomBytes(10);
  const chars = Array.from({ length: 10 }, (_, i) => ALPHABET[bytes[i] % ALPHABET.length]);
  return chars.slice(0, 5).join("") + "-" + chars.slice(5).join("");
}

function hashCode(raw: string): string {
  return createHash("sha256")
    .update(raw.replace(/-/g, "").toUpperCase())
    .digest("hex");
}

async function getUser(accessToken: string) {
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !user) throw new Error("Ugyldig session.");
  return user;
}

// ─── Generate 8 backup codes (deletes any existing ones first) ────────────────

export const generateBackupCodes = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const user = await getUser(data.accessToken);

    await (supabaseAdmin as any).from("backup_codes").delete().eq("user_id", user.id);

    const codes = Array.from({ length: 8 }, genCode);

    const { error } = await (supabaseAdmin as any).from("backup_codes").insert(
      codes.map((c) => ({ user_id: user.id, code_hash: hashCode(c) })),
    );
    if (error) throw new Error("Kunne ikke gemme backup-koder.");

    return { codes }; // Plaintext — shown only once
  });

// ─── Verify a backup code → marks used + deletes all MFA factors ──────────────

export const verifyBackupCode = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ accessToken: z.string().min(1), code: z.string().min(1) }).parse(d),
  )
  .handler(async ({ data }) => {
    const user = await getUser(data.accessToken);
    const hash = hashCode(data.code);

    const { data: found } = await (supabaseAdmin as any)
      .from("backup_codes")
      .select("id")
      .eq("user_id", user.id)
      .eq("code_hash", hash)
      .eq("used", false)
      .maybeSingle();

    if (!found) throw new Error("Ugyldig eller allerede brugt backup-kode.");

    await (supabaseAdmin as any)
      .from("backup_codes")
      .update({ used: true, used_at: new Date().toISOString() })
      .eq("id", found.id);

    // Remove all MFA factors so the session is no longer required to be aal2
    const { data: mfaData } = await (supabaseAdmin.auth.admin.mfa as any).listFactors({
      userId: user.id,
    });
    const allFactors: Array<{ id: string }> = mfaData?.all ?? [];
    for (const f of allFactors) {
      await (supabaseAdmin.auth.admin.mfa as any).deleteFactor({
        id: f.id,
        userId: user.id,
      });
    }

    return { ok: true };
  });

// ─── Backup code count (for settings page display) ───────────────────────────

export const getBackupCodeStatus = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const user = await getUser(data.accessToken);

    const { count: total } = await (supabaseAdmin as any)
      .from("backup_codes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { count: unused } = await (supabaseAdmin as any)
      .from("backup_codes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("used", false);

    return { total: total ?? 0, unused: unused ?? 0 };
  });

// ─── Disable all MFA + delete backup codes ───────────────────────────────────

export const disableMfa = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    const user = await getUser(data.accessToken);

    await (supabaseAdmin as any).from("backup_codes").delete().eq("user_id", user.id);

    const { data: mfaData } = await (supabaseAdmin.auth.admin.mfa as any).listFactors({
      userId: user.id,
    });
    const allFactors: Array<{ id: string }> = mfaData?.all ?? [];
    for (const f of allFactors) {
      await (supabaseAdmin.auth.admin.mfa as any).deleteFactor({
        id: f.id,
        userId: user.id,
      });
    }

    return { ok: true };
  });
