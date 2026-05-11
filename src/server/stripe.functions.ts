import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PRICE_IDS: Record<string, string | undefined> = {
  basis: process.env.STRIPE_PRICE_BASIS,
  pro: process.env.STRIPE_PRICE_PRO,
  organisation: process.env.STRIPE_PRICE_ORG,
};

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY er ikke konfigureret.");
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
}

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        plan: z.enum(["basis", "pro", "organisation"]),
        orgId: z.string().uuid(),
        accessToken: z.string().min(1),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const stripe = getStripe();

    const priceId = PRICE_IDS[data.plan];
    if (!priceId) throw new Error(`Stripe-pris for "${data.plan}" er ikke konfigureret.`);

    // Validate token and confirm user is admin of this org
    const {
      data: { user },
      error: authErr,
    } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !user) throw new Error("Ugyldig session.");

    const { data: membership, error: memberErr } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("organization_id", data.orgId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (memberErr || membership?.role !== "admin") {
      throw new Error("Kun administratorer kan ændre abonnement.");
    }

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name, stripe_customer_id")
      .eq("id", data.orgId)
      .single();

    // Reuse or create Stripe customer
    let customerId = org?.stripe_customer_id ?? undefined;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: org?.name ?? undefined,
        metadata: { org_id: data.orgId, user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin
        .from("organizations")
        .update({ stripe_customer_id: customerId })
        .eq("id", data.orgId);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      // org_id in both places: session.metadata (for checkout.session.completed)
      // and subscription metadata (for subscription.updated/deleted)
      metadata: { org_id: data.orgId },
      subscription_data: {
        metadata: { org_id: data.orgId },
      },
      automatic_tax: { enabled: true },
      locale: "da",
    });

    return { url: session.url };
  });

export const createBillingPortalSession = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        orgId: z.string().uuid(),
        accessToken: z.string().min(1),
        returnUrl: z.string().url(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const stripe = getStripe();

    const {
      data: { user },
      error: authErr,
    } = await supabaseAdmin.auth.getUser(data.accessToken);
    if (authErr || !user) throw new Error("Ugyldig session.");

    const { data: membership } = await supabaseAdmin
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", data.orgId)
      .eq("status", "active")
      .single();
    if (membership?.role !== "admin") throw new Error("Kun administratorer kan tilgå faktureringsportalen.");

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("stripe_customer_id")
      .eq("id", data.orgId)
      .single();

    if (!org?.stripe_customer_id) throw new Error("Intet Stripe-abonnement fundet.");

    const session = await stripe.billingPortal.sessions.create({
      customer: org.stripe_customer_id,
      return_url: data.returnUrl,
    });

    return { url: session.url };
  });
