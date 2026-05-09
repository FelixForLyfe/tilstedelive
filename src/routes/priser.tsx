import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  Sparkles,
  Check,
  ChevronRight,
  Mail,
  Zap,
  Building2,
  Star,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { createCheckoutSession } from "@/server/stripe.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/priser")({
  head: () => ({
    meta: [
      { title: "Priser — Tilstede" },
      {
        name: "description",
        content:
          "Enkel og gennemsigtig prissætning til skoler, sportsklubber, fitnesscenter og mere. Start gratis.",
      },
      { property: "og:title", content: "Priser — Tilstede" },
    ],
  }),
  component: PriserSide,
});

type Plan = {
  id: "basis" | "pro" | "organisation";
  navn: string;
  pris: number;
  tagline: string;
  fremhævet: boolean;
  features: string[];
};

const PLANER: Plan[] = [
  {
    id: "basis",
    navn: "Basis",
    pris: 299,
    tagline: "Til mindre organisationer der kommer i gang.",
    fremhævet: false,
    features: [
      "Op til 50 deltagere",
      "1 lokation",
      "Live fremmøde",
      "Aktiviteter og grupper",
      "Personalets arbejdstidslog",
      "Historik og arkiv",
      "E-mail support",
    ],
  },
  {
    id: "pro",
    navn: "Pro",
    pris: 599,
    tagline: "Til voksende organisationer med flere hold.",
    fremhævet: true,
    features: [
      "Ubegrænsede deltagere",
      "Op til 3 lokationer",
      "Alt fra Basis",
      "Avanceret statistik",
      "Prioriteret support",
      "2FA-håndhævelse",
      "Revisionslog (audit log)",
    ],
  },
  {
    id: "organisation",
    navn: "Organisation",
    pris: 1199,
    tagline: "Til store institutioner og organisationer.",
    fremhævet: false,
    features: [
      "Ubegrænsede deltagere",
      "Ubegrænsede lokationer",
      "Alt fra Pro",
      "Dedikeret support",
      "SLA-garanti",
      "Tilpasset onboarding",
      "Faktura (EAN mulig)",
    ],
  },
];

function PlanKort({ plan, onVælg, loading }: { plan: Plan; onVælg: (id: Plan["id"]) => void; loading: boolean }) {
  return (
    <div
      className={`relative flex flex-col rounded-3xl p-8 transition ${
        plan.fremhævet
          ? "bg-gradient-primary text-primary-foreground shadow-glow ring-2 ring-primary"
          : "glass shadow-card"
      }`}
    >
      {plan.fremhævet && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-bold text-primary-foreground shadow-glow ring-2 ring-background">
          Mest populær
        </div>
      )}

      <div className="mb-1 flex items-center gap-2">
        {plan.id === "basis" && <Zap className="h-5 w-5" />}
        {plan.id === "pro" && <Star className="h-5 w-5" />}
        {plan.id === "organisation" && <Building2 className="h-5 w-5" />}
        <h3 className="font-display text-xl font-bold">{plan.navn}</h3>
      </div>

      <div className="mt-4 flex items-end gap-1">
        <span className="font-display text-4xl font-bold">{plan.pris}</span>
        <span className={`mb-1 text-sm ${plan.fremhævet ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
          DKK/md
        </span>
      </div>
      <p className={`mt-1 text-sm ${plan.fremhævet ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
        {plan.tagline}
      </p>

      <ul className="mt-6 flex-1 space-y-2.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm">
            <Check
              className={`mt-0.5 h-4 w-4 shrink-0 ${plan.fremhævet ? "text-primary-foreground" : "text-success"}`}
            />
            <span className={plan.fremhævet ? "text-primary-foreground/90" : ""}>{f}</span>
          </li>
        ))}
      </ul>

      <button
        onClick={() => onVælg(plan.id)}
        disabled={loading}
        className={`mt-8 w-full rounded-xl px-4 py-3 font-semibold transition disabled:opacity-50 ${
          plan.fremhævet
            ? "bg-white text-primary hover:bg-white/90"
            : "bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
        }`}
      >
        {loading ? "Åbner checkout…" : `Vælg ${plan.navn}`}
      </button>
    </div>
  );
}

function PriserSide() {
  const { session } = useAuth();
  const { aktivOrgId } = useOrg();
  const navigate = useNavigate();
  const startCheckout = useServerFn(createCheckoutSession);
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleVælg = async (planId: Plan["id"]) => {
    if (!session) {
      navigate({ to: "/signup", search: { plan: planId } as any });
      return;
    }
    if (!aktivOrgId) {
      toast.error("Ingen aktiv organisation. Opret eller vælg en organisation først.");
      return;
    }

    setLoadingPlan(planId);
    try {
      const origin = window.location.origin;
      const result = await startCheckout({
        data: {
          plan: planId,
          orgId: aktivOrgId,
          accessToken: session.access_token,
          successUrl: `${origin}/checkout/succes?plan=${planId}`,
          cancelUrl: `${origin}/priser`,
        },
      });
      if (result?.url) {
        window.location.href = result.url;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt. Prøv igen.");
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Tilstede</span>
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link to="/" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            Forside
          </Link>
          {session ? (
            <Link
              to="/app"
              className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              Til appen
            </Link>
          ) : (
            <Link
              to="/signup"
              className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              Opret gratis
            </Link>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="container mx-auto px-6 py-16 text-center fade-in">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success" />
          Ingen bindingsperiode
        </div>
        <h1 className="mx-auto mt-5 max-w-2xl font-display text-4xl font-bold tracking-tight md:text-5xl">
          Enkel prissætning,{" "}
          <span className="bg-gradient-primary bg-clip-text text-transparent">ingen overraskelser</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Samme pris uanset organisationstype. Skol SFO, sportsklub eller fitnesscenter — du betaler for
          funktioner, ikke for hvem du er.
        </p>
      </section>

      {/* ── Pricing cards ── */}
      <section className="container mx-auto px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          {PLANER.map((plan) => (
            <PlanKort
              key={plan.id}
              plan={plan}
              onVælg={handleVælg}
              loading={loadingPlan === plan.id}
            />
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Alle priser er ekskl. moms. Fakturering sker månedligt. Opsig når som helst.
        </p>
      </section>

      {/* ── Enterprise ── */}
      <section className="container mx-auto px-6 pb-24">
        <div className="glass rounded-3xl p-8 shadow-card md:flex md:items-center md:gap-10">
          <div className="mb-6 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow md:mb-0">
            <Building2 className="h-7 w-7 text-primary-foreground" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold">Kommune eller stor institution?</h2>
            <p className="mt-2 text-muted-foreground">
              Har I brug for EAN-fakturering, databehandleraftale, særlige sikkerhedskrav eller en
              rammeaftale for flere afdelinger? Kontakt os for et skræddersyet tilbud.
            </p>
          </div>
          <div className="mt-6 shrink-0 md:mt-0">
            <a
              href="mailto:support@tilstede.live?subject=Tilbud%20til%20kommune%2Finstitution&body=Hej%20Tilstede%2C%0A%0AVi%20er%20interesserede%20i%20et%20tilbud%20til%20vores%20organisation.%0A%0AOrganisationsnavn%3A%0AAntal%20afdelinger%3A%0AAntal%20brugere%20ca.%3A%0A%0AMed%20venlig%20hilsen"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              <Mail className="h-4 w-4" /> Kontakt os for et tilbud
            </a>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="container mx-auto px-6 pb-24">
        <h2 className="mb-8 text-center font-display text-3xl font-bold">Ofte stillede spørgsmål</h2>
        <div className="mx-auto max-w-2xl space-y-4">
          {[
            {
              q: "Hvad sker der efter prøveperioden?",
              a: "Når de 30 dage er gået, spærres adgang til appen. Du vælger en plan og betaler via Stripe — herefter åbnes adgangen med det samme. Dine data og historik er bevaret.",
            },
            {
              q: "Kan jeg skifte plan undervejs?",
              a: "Ja, du kan opgradere eller nedgradere når som helst via Stripe-portalen. Ændringen træder i kraft med det samme.",
            },
            {
              q: "Hvad sker der med mine data hvis jeg opsiger?",
              a: "Dine data forbliver i 30 dage efter opsigelse, så du kan eksportere dem. Herefter slettes alt permanent i overensstemmelse med GDPR.",
            },
            {
              q: "Tilbyder I databehandleraftale (DPA)?",
              a: "Ja. Skriv til support@tilstede.live, så sender vi en DPA pr. e-mail.",
            },
            {
              q: "Virker det til alle organisationstyper?",
              a: "Ja. Tilstede understøtter skoler, SFO'er, sportsklubber, fitnesscenter, spejdergrupper og mere. Terminologien tilpasses din type.",
            },
          ].map((faq) => (
            <div key={faq.q} className="glass rounded-2xl p-6">
              <h3 className="font-semibold">{faq.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="container mx-auto px-6 pb-24">
        <div className="glass rounded-3xl p-10 text-center shadow-card">
          <h2 className="font-display text-3xl font-bold">Start gratis i dag</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Opret din organisation og prøv alle funktioner i 30 dage. Ingen kreditkort krævet.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            Start 30 dages gratis prøveperiode <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/" className="hover:text-foreground">Forside</Link>
          <Link to="/sikkerhed" className="hover:text-foreground">Sikkerhed</Link>
          <Link to="/privatlivspolitik" className="hover:text-foreground">Privatlivspolitik</Link>
          <Link to="/slet-data" className="hover:text-foreground">Slet mine data</Link>
        </div>
        <p className="mt-3">Tilstede © {new Date().getFullYear()} — bygget til danske organisationer.</p>
      </footer>
    </div>
  );
}
