import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, CheckCircle2, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/checkout/succes")({
  head: () => ({ meta: [{ title: "Tak for din tilmelding — Tilstede" }] }),
  component: CheckoutSucces,
});

const PLAN_NAVNE: Record<string, string> = {
  basis: "Basis",
  pro: "Pro",
  organisation: "Organisation",
};

function CheckoutSucces() {
  const search = typeof window !== "undefined"
    ? Object.fromEntries(new URLSearchParams(window.location.search))
    : {};
  const planNavn = PLAN_NAVNE[search.plan ?? ""] ?? "dit abonnement";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center fade-in">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold">Tilstede</span>
        </Link>

        <div className="glass rounded-3xl p-10 shadow-card">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 className="h-8 w-8 text-success" />
          </div>
          <h1 className="font-display text-2xl font-bold">Betalingen lykkedes!</h1>
          <p className="mt-3 text-muted-foreground">
            Tak fordi du valgte <span className="font-semibold text-foreground">{planNavn}</span>. Dit
            abonnement er nu aktivt — du kan gå direkte til appen.
          </p>
          <Link
            to="/app"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            Gå til appen <ChevronRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            En kvittering er sendt til din e-mail af Stripe. Spørgsmål?{" "}
            <a href="mailto:support@tilstede.live" className="text-primary hover:underline">
              support@tilstede.live
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
