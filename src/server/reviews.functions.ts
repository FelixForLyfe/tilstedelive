import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PublicReview = {
  id: string;
  stars: number;
  name: string | null;
  org_type: string | null;
  review_text: string | null;
  created_at: string;
};

const ORG_TYPES = ["sfo", "sportsklub", "butik", "andet"] as const;

// ─── Public: submit review ─────────────────────────────────────────────────────

export const submitReview = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        stars: z.number().int().min(1).max(5),
        name: z.string().max(100).optional(),
        org_type: z.enum(ORG_TYPES).optional(),
        review_text: z.string().max(2000).optional(),
        gdpr_consent: z.literal(true),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { error } = await (supabaseAdmin as any).from("public_reviews").insert({
      stars: data.stars,
      name: data.name?.trim() || null,
      org_type: data.org_type || null,
      review_text: data.review_text?.trim() || null,
      gdpr_consent: true,
      approved: false,
    });
    if (error) throw new Error("Kunne ikke gemme anmeldelse. Prøv igen.");
    return { ok: true };
  });

// ─── Public: list approved reviews ────────────────────────────────────────────

export const listApprovedReviews = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({}).parse(d))
  .handler(async () => {
    const { data, error } = await (supabaseAdmin as any)
      .from("public_reviews")
      .select("id, stars, name, org_type, review_text, created_at")
      .eq("approved", true)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return [] as PublicReview[];
    return (data ?? []) as PublicReview[];
  });

// ─── Superadmin helpers ────────────────────────────────────────────────────────

async function verifySuperadminForReviews(accessToken: string) {
  const {
    data: { user },
    error,
  } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !user) throw new Error("Ugyldig session.");
  const { data: ok } = await (supabaseAdmin as any).rpc("is_superadmin", { uid: user.id });
  if (!ok) throw new Error("Kun superadmins kan gøre dette.");
  return user;
}

// ─── Superadmin: list all reviews ─────────────────────────────────────────────

export const superadminListReviews = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ accessToken: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await verifySuperadminForReviews(data.accessToken);
    const { data: reviews, error } = await (supabaseAdmin as any)
      .from("public_reviews")
      .select("id, stars, name, org_type, review_text, gdpr_consent, approved, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (reviews ?? []) as (PublicReview & { approved: boolean; gdpr_consent: boolean })[];
  });

// ─── Superadmin: approve review ────────────────────────────────────────────────

export const superadminApproveReview = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ accessToken: z.string().min(1), reviewId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifySuperadminForReviews(data.accessToken);
    const { error } = await (supabaseAdmin as any)
      .from("public_reviews")
      .update({ approved: true })
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Superadmin: reject (delete) review ───────────────────────────────────────

export const superadminDeleteReview = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ accessToken: z.string().min(1), reviewId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data }) => {
    await verifySuperadminForReviews(data.accessToken);
    const { error } = await (supabaseAdmin as any)
      .from("public_reviews")
      .delete()
      .eq("id", data.reviewId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
