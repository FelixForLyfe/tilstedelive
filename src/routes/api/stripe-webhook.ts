import { createAPIFileRoute } from "@tanstack/react-start/api";
import Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Tier = "gratis" | "basis" | "pro" | "organisation";

const PRICE_TO_TIER: Record<string, Tier> = {
  [process.env.STRIPE_PRICE_BASIS ?? ""]: "basis",
  [process.env.STRIPE_PRICE_PRO ?? ""]: "pro",
  [process.env.STRIPE_PRICE_ORG ?? ""]: "organisation",
};

function resolveTier(sub: Stripe.Subscription): Tier {
  const priceId = (sub.items.data[0]?.price as Stripe.Price)?.id ?? "";
  return PRICE_TO_TIER[priceId] ?? "basis";
}

export const APIRoute = createAPIFileRoute("/api/stripe-webhook")({
  POST: async ({ request }) => {
    const secret = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret || !webhookSecret) {
      return new Response("Stripe not configured", { status: 500 });
    }

    const stripe = new Stripe(secret, { apiVersion: "2025-04-30.basil" });
    const sig = request.headers.get("stripe-signature");
    if (!sig) return new Response("Missing signature", { status: 400 });

    let event: Stripe.Event;
    try {
      const body = await request.text();
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      console.error("[stripe-webhook] signature verification failed", err);
      return new Response("Invalid signature", { status: 400 });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          if (session.mode !== "subscription") break;

          const orgId = session.subscription_data?.metadata?.org_id
            ?? (session.metadata as Record<string, string>)?.org_id;
          if (!orgId) break;

          const sub = await stripe.subscriptions.retrieve(session.subscription as string, {
            expand: ["items.data.price"],
          });

          await supabaseAdmin
            .from("organizations")
            .update({
              stripe_subscription_id: sub.id,
              subscription_tier: resolveTier(sub),
              subscription_status: sub.status === "active" ? "active" : "trialing",
            })
            .eq("id", orgId);
          break;
        }

        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          const orgId = sub.metadata?.org_id;
          if (!orgId) break;

          const status =
            sub.status === "active" ? "active"
            : sub.status === "past_due" ? "past_due"
            : sub.status === "trialing" ? "trialing"
            : "canceled";

          await supabaseAdmin
            .from("organizations")
            .update({
              subscription_tier: resolveTier(sub as any),
              subscription_status: status,
            })
            .eq("id", orgId);
          break;
        }

        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          const orgId = sub.metadata?.org_id;
          if (!orgId) break;

          await supabaseAdmin
            .from("organizations")
            .update({
              subscription_tier: "gratis",
              subscription_status: "canceled",
              stripe_subscription_id: null,
            })
            .eq("id", orgId);
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error("[stripe-webhook] handler error", err);
      return new Response("Handler error", { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  },
});
