import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Sparkles,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  User,
  Clock,
  FileText,
  Building2,
  LogIn,
  Loader2,
  Mail,
  Baby,
  UserX,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { sletEgenKonto } from "@/server/deletion.functions";

export const Route = createFileRoute("/slet-data")({
  head: () => ({
    meta: [
      { title: "Slet mine data — Tilstede" },
      {
        name: "description",
        content:
          "Anmod om sletning af dine personoplysninger i Tilstede i henhold til GDPR artikel 17.",
      },
      { property: "og:title", content: "Slet mine data — Tilstede" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SletDataSide,
});

type Tilstand = "idle" | "bekræft" | "loading" | "succes" | "fejl";

const slettesKort = [
  { icon: User, tekst: "Din brugerkonto (e-mail og adgangskode)" },
  { icon: FileText, tekst: "Din profil (visningsnavn)" },
  { icon: Clock, tekst: "Dine tidsregistreringer som medarbejder" },
  { icon: Building2, tekst: "Dine organisationsmedlemskaber" },
];

const slettesIkkeKort = [
  {
    icon: Baby,
    tekst: "Børnedata og fremmøde­registreringer tilhører organisationen, ikke din konto.",
  },
  {
    icon: Building2,
    tekst: "Organisationer du har oprettet slettes ikke automatisk — overfør admin-rollen til en kollega først.",
  },
  {
    icon: FileText,
    tekst: "Arkiv-snapshots og daglige logs tilhører institutionen.",
  },
];

function LoggetUdVisning() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="glass rounded-2xl p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
          <LogIn className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-semibold">Log ind for selvbetjening</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Hvis du har en aktiv konto kan du logge ind og slette den med det samme. Det er den
          hurtigste måde.
        </p>
        <Link
          to="/login/personale"
          className="mt-4 inline-block rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
        >
          Log ind og slet konto
        </Link>
      </div>

      <div className="glass rounded-2xl p-6">
        <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
          <Mail className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-semibold">Send en anmodning via e-mail</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Skriv til os fra den e-mailadresse der er registreret på kontoen. Vi behandler din
          anmodning inden for 30 dage, som krævet af GDPR artikel 17.
        </p>
        <a
          href="mailto:support@tilstede.live?subject=Anmodning%20om%20datasletning&body=Hej%20Tilstede%2C%0A%0AJeg%20anmoder%20hermed%20om%20sletning%20af%20alle%20personoplysninger%20tilknyttet%20denne%20e-mailadresse%20i%20henhold%20til%20GDPR%20artikel%2017.%0A%0AMed%20venlig%20hilsen"
          className="mt-4 inline-block rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold transition hover:bg-surface-elevated"
        >
          Åbn e-mail
        </a>
      </div>
    </div>
  );
}

function SletFormular() {
  const { session, logUd } = useAuth();
  const navigate = useNavigate();
  const [tilstand, setTilstand] = useState<Tilstand>("idle");
  const [fejlBesked, setFejlBesked] = useState("");

  const startSletning = async () => {
    if (!session?.access_token) return;
    setTilstand("loading");
    try {
      await sletEgenKonto({ data: { accessToken: session.access_token } });
      await logUd();
      setTilstand("succes");
      setTimeout(() => navigate({ to: "/" }), 4000);
    } catch (err) {
      setFejlBesked(
        err instanceof Error ? err.message : "Noget gik galt. Prøv igen.",
      );
      setTilstand("fejl");
    }
  };

  if (tilstand === "succes") {
    return (
      <div className="glass rounded-2xl p-8 text-center fade-in">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
          <CheckCircle2 className="h-7 w-7 text-success" />
        </div>
        <h2 className="font-display text-xl font-bold">Din konto er slettet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Alle dine personoplysninger er fjernet. Du bliver omdirigeret til forsiden om et
          øjeblik.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/15">
          <Trash2 className="h-5 w-5 text-destructive" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Slet min konto</h2>
          <p className="text-xs text-muted-foreground">
            Logget ind som{" "}
            <span className="text-foreground">{session?.user?.email}</span>
          </p>
        </div>
      </div>

      {tilstand === "idle" && (
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Dette sletter din konto og alle personoplysninger der er direkte knyttet til
            den. Handlingen kan{" "}
            <span className="font-semibold text-foreground">ikke fortrydes</span>.
          </p>
          <button
            onClick={() => setTilstand("bekræft")}
            className="rounded-xl border border-destructive/50 bg-destructive/10 px-5 py-2.5 text-sm font-semibold text-destructive transition hover:bg-destructive/20"
          >
            Start sletning
          </button>
        </div>
      )}

      {tilstand === "bekræft" && (
        <div className="space-y-4 fade-in">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="text-sm">
              <p className="font-semibold text-foreground">Er du sikker?</p>
              <p className="mt-1 text-muted-foreground">
                Din konto, profil og tidsregistreringer slettes permanent med det samme.
                Børnedata og organisationsdata berøres ikke.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={startSletning}
              className="rounded-xl bg-destructive px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Ja, slet min konto permanent
            </button>
            <button
              onClick={() => setTilstand("idle")}
              className="rounded-xl bg-surface px-5 py-2.5 text-sm font-semibold transition hover:bg-surface-elevated"
            >
              Fortryd
            </button>
          </div>
        </div>
      )}

      {tilstand === "loading" && (
        <div className="flex items-center gap-3 py-2 text-sm text-muted-foreground fade-in">
          <Loader2 className="h-4 w-4 animate-spin" />
          Sletter din konto…
        </div>
      )}

      {tilstand === "fejl" && (
        <div className="space-y-3 fade-in">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-muted-foreground">{fejlBesked}</p>
          </div>
          <button
            onClick={() => setTilstand("idle")}
            className="rounded-xl bg-surface px-5 py-2.5 text-sm font-semibold transition hover:bg-surface-elevated"
          >
            Prøv igen
          </button>
        </div>
      )}
    </div>
  );
}

function IkkeAdminVisning({ email }: { email: string }) {
  const { logUd } = useAuth();
  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15">
          <UserX className="h-5 w-5 text-warning" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold">Selvbetjening kun for administratorer</h2>
          <p className="text-xs text-muted-foreground">Logget ind som <span className="text-foreground">{email}</span></p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        Din konto er oprettet som <span className="font-semibold text-foreground">medarbejder</span> i en
        organisation. Selvbetjeningssletning er kun tilgængelig for administratorer, da sletning af en
        medarbejderkonto kan påvirke organisationens data.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Du har to muligheder:
      </p>
      <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
        <li className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-primary">1.</span>
          <span>Bed din organisations administrator om at fjerne dig fra organisationen, og send derefter en sletningsanmodning til os via e-mail.</span>
        </li>
        <li className="flex items-start gap-2">
          <span className="mt-0.5 shrink-0 text-primary">2.</span>
          <span>Send en sletningsanmodning direkte til os — vi behandler den inden for 30 dage som krævet af GDPR artikel 17.</span>
        </li>
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        <a
          href="mailto:support@tilstede.live?subject=Anmodning%20om%20datasletning&body=Hej%20Tilstede%2C%0A%0AJeg%20anmoder%20hermed%20om%20sletning%20af%20alle%20personoplysninger%20tilknyttet%20denne%20e-mailadresse%20i%20henhold%20til%20GDPR%20artikel%2017.%0A%0AMed%20venlig%20hilsen"
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
        >
          <Mail className="h-4 w-4" /> Send sletningsanmodning via e-mail
        </a>
        <button
          onClick={logUd}
          className="rounded-xl bg-surface px-5 py-2.5 text-sm font-semibold transition hover:bg-surface-elevated"
        >
          Log ud
        </button>
      </div>
    </div>
  );
}

function SletDataSide() {
  const { user, loading } = useAuth();
  const [erAdmin, setErAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) { setErAdmin(null); return; }
    supabase
      .from("organization_members")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .eq("status", "active")
      .limit(1)
      .then(({ data }) => setErAdmin((data?.length ?? 0) > 0));
  }, [user]);

  const erLoggetInd = !loading && user !== null;
  const adminChecked = erLoggetInd && erAdmin !== null;

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
          <Link
            to="/privatlivspolitik"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Privatlivspolitik
          </Link>
          {erLoggetInd ? (
            <Link
              to="/app"
              className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              Tilbage til appen
            </Link>
          ) : (
            <Link
              to="/login/personale"
              className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
            >
              Log ind
            </Link>
          )}
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="container mx-auto px-6 py-14 text-center fade-in">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1 text-xs text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
          GDPR artikel 17 — Ret til sletning
        </div>
        <h1 className="mx-auto mt-6 max-w-2xl font-display text-4xl font-bold tracking-tight md:text-5xl">
          Slet mine data
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Du har ret til at få dine personoplysninger slettet. Her kan du enten slette din konto
          med det samme, eller sende en formel anmodning.
        </p>
      </section>

      {/* ── Hvad slettes / hvad slettes ikke ── */}
      <section className="container mx-auto grid gap-4 px-6 pb-8 md:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" />
            <h2 className="font-display text-base font-semibold">Hvad slettes?</h2>
          </div>
          <ul className="space-y-2">
            {slettesKort.map((p) => (
              <li key={p.tekst} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-destructive/15">
                  <p.icon className="h-3.5 w-3.5 text-destructive" />
                </div>
                <span className="text-muted-foreground">{p.tekst}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="glass rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <h2 className="font-display text-base font-semibold">Hvad slettes ikke?</h2>
          </div>
          <ul className="space-y-2">
            {slettesIkkeKort.map((p) => (
              <li key={p.tekst} className="flex items-start gap-3 text-sm">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-success/15">
                  <p.icon className="h-3.5 w-3.5 text-success" />
                </div>
                <span className="text-muted-foreground">{p.tekst}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Action ── */}
      <section className="container mx-auto px-6 pb-24">
        {loading || (erLoggetInd && !adminChecked) ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !erLoggetInd ? (
          <LoggetUdVisning />
        ) : erAdmin ? (
          <SletFormular />
        ) : (
          <IkkeAdminVisning email={user!.email ?? ""} />
        )}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/" className="hover:text-foreground">Forside</Link>
          <Link to="/privatlivspolitik" className="hover:text-foreground">Privatlivspolitik</Link>
          <Link to="/sikkerhed" className="hover:text-foreground">Sikkerhed</Link>
        </div>
        <p className="mt-3">Tilstede © {new Date().getFullYear()} — bygget til danske institutioner.</p>
      </footer>
    </div>
  );
}
