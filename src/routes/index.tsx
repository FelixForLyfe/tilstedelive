import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import {
  Sparkles,
  Users,
  Bell,
  Activity,
  Clock,
  Shield,
  GraduationCap,
  Trophy,
  Dumbbell,
  Compass,
  Baby,
  Building2,
  CheckCircle2,
  ChevronRight,
  Archive,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: Forside,
});

function Feature({ icon: Icon, title, body }: { icon: React.ElementType; title: string; body: string }) {
  return (
    <div className="glass rounded-2xl p-6 transition hover:shadow-glow">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

const USE_CASES = [
  {
    icon: GraduationCap,
    label: "Skole / SFO",
    tagline: "Tjek børn ind og ud, hjemsendelsesalarmer og klassevis overblik.",
    terms: ["Børn", "Klasser", "Hjemsendelsesalarmer"],
  },
  {
    icon: Baby,
    label: "Daginstitution",
    tagline: "Live fremmøde pr. gruppe, CPR-håndtering og sikker datalagring.",
    terms: ["Børn", "Grupper", "GDPR-compliant"],
  },
  {
    icon: Trophy,
    label: "Sportsklub",
    tagline: "Holdbaseret fremmøde til træning, stævner og klubaftener.",
    terms: ["Medlemmer", "Hold", "Træningsfremmøde"],
  },
  {
    icon: Dumbbell,
    label: "Fitnesscenter",
    tagline: "Tjek medlemmer ind til hold og sessioner — ingen papirslister.",
    terms: ["Medlemmer", "Hold", "Sessioner"],
  },
  {
    icon: Compass,
    label: "Spejder / Ungdom",
    tagline: "Patruljebaseret overblik over hvem der mødte op til mødet.",
    terms: ["Spejdere", "Patruljer", "Mødefremmøde"],
  },
  {
    icon: Building2,
    label: "Andet",
    tagline: "Tilpasses din organisation — terminologi og regler følger med.",
    terms: ["Deltagere", "Grupper", "Aktiviteter"],
  },
];

function Forside() {
  return (
    <div className="min-h-screen">
      {/* ── Header ── */}
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Tilstede</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/sikkerhed" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Sikkerhed</Link>
          <Link to="/priser" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Priser</Link>
          <Link to="/login/personale" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Log ind</Link>
          <Link to="/signup" className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90">
            Start gratis prøveperiode
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="container mx-auto px-6 py-20 text-center fade-in">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success glow-pulse" />
          Live fremmøde i realtid
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl font-bold tracking-tight md:text-6xl">
          Hold styr på{" "}
          <span className="bg-gradient-primary bg-clip-text text-transparent">
            hvem der er til stede
          </span>{" "}
          – uanset hvor.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Uanset om det er børn i SFO, spejdere til møde, hold til træning eller medlemmer til
          fitness — Tilstede giver dig live fremmøde, alarmer og fuld historik med ét klik.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            to="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02]"
          >
            Start 30 dages gratis prøveperiode <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            to="/login/personale"
            className="rounded-xl border border-border bg-surface px-6 py-3 font-semibold transition hover:bg-surface-elevated"
          >
            Log ind
          </Link>
        </div>

        {/* Trust badges */}
        <div className="mx-auto mt-10 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          {["30 dages gratis prøveperiode", "Ingen kreditkort krævet", "GDPR-compliant", "Dansk support"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" /> {t}
            </span>
          ))}
        </div>
      </section>

      {/* ── Use cases ── */}
      <section className="container mx-auto px-6 pb-20">
        <div className="mb-8 text-center">
          <h2 className="font-display text-3xl font-bold">Til alle typer organisationer</h2>
          <p className="mt-2 text-muted-foreground">
            Vælg din type ved oprettelse — sproget og reglerne tilpasses automatisk.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((uc) => {
            const Icon = uc.icon;
            return (
              <div key={uc.label} className="glass rounded-2xl p-5 transition hover:shadow-glow">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-base font-semibold">{uc.label}</h3>
                </div>
                <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{uc.tagline}</p>
                <div className="flex flex-wrap gap-1.5">
                  {uc.terms.map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="container mx-auto px-6 pb-24">
        <div className="mb-8 text-center">
          <h2 className="font-display text-3xl font-bold">Alt hvad du har brug for</h2>
          <p className="mt-2 text-muted-foreground">
            Enkelt nok til daglig brug. Komplet nok til de krav I stilles overfor.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Feature
            icon={Users}
            title="Live fremmøde"
            body="Hele teamet ser samme liste. Tjek ind og ud opdateres på tværs af enheder med det samme."
          />
          <Feature
            icon={Bell}
            title="Alarmer og beskeder"
            body="Få lyd og besked præcis når nogen skal hjem, forlader træning eller ikke er mødt op."
          />
          <Feature
            icon={Activity}
            title="Grupper og aktiviteter"
            body="Organiser deltagere i hold, klasser eller patruljer og tildel dem til aktiviteter med ét klik."
          />
          <Feature
            icon={Clock}
            title="Personalets arbejdstid"
            body="Personalet starter vagt, holder pause og slutter vagt. Admin ser timesedlen samlet."
          />
          <Feature
            icon={Shield}
            title="Sikkert og GDPR-compliant"
            body="Data er org-isoleret og sikret med 2FA. CPR og følsomme felter vises kun der, de er relevante."
          />
          <Feature
            icon={Archive}
            title="Historik og arkiv"
            body="Luk dagen og gem et fuldstændigt snapshot. Alt er søgbart og tilgængeligt når I har brug for det."
          />
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="container mx-auto px-6 pb-24">
        <div className="glass rounded-3xl p-10 text-center shadow-card">
          <h2 className="font-display text-3xl font-bold">Klar til at komme i gang?</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Opret din organisation på under 2 minutter og få 30 dages fuld adgang — ingen kreditkort krævet.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              to="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              Start 30 dages gratis prøveperiode <ChevronRight className="h-4 w-4" />
            </Link>
            <Link
              to="/priser"
              className="rounded-xl border border-border bg-surface px-6 py-3 font-semibold transition hover:bg-surface-elevated"
            >
              Se priser
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/sikkerhed" className="hover:text-foreground">Sikkerhed</Link>
          <Link to="/privatlivspolitik" className="hover:text-foreground">Privatlivspolitik</Link>
          <Link to="/priser" className="hover:text-foreground">Priser</Link>
          <Link to="/slet-data" className="hover:text-foreground">Slet mine data</Link>
        </div>
        <p className="mt-3">Tilstede © {new Date().getFullYear()} — bygget til danske organisationer.</p>
      </footer>
    </div>
  );
}
