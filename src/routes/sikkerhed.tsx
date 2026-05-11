import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  ShieldCheck,
  Lock,
  Users,
  KeyRound,
  Radio,
  FileLock2,
  EyeOff,
  ServerCog,
  CheckCircle2,
  ScrollText,
  BadgeCheck,
  Globe2,
  QrCode,
  Clock,
  Fingerprint,
} from "lucide-react";

export const Route = createFileRoute("/sikkerhed")({
  head: () => ({
    meta: [
      { title: "Sikkerhed — Tilstede" },
      {
        name: "description",
        content:
          "Tilstede er bygget med sikkerhed som fundament: kryptering, org-isoleret data, RLS i databasen, 2FA og GDPR-bevidst design.",
      },
      { property: "og:title", content: "Sikkerhed — Tilstede" },
      {
        property: "og:description",
        content:
          "Tilstede er bygget med sikkerhed som fundament: kryptering, org-isoleret data, RLS i databasen, 2FA og GDPR-bevidst design.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: SikkerhedSide,
});

const features = [
  {
    icon: Lock,
    title: "Krypteret forbindelse og lagring",
    body: "Al trafik krypteres med TLS/HTTPS. Databasen krypteres på lager-niveau hos Supabase (AES-256), så data aldrig ligger i klartekst — hverken under transport eller i hvile.",
  },
  {
    icon: Users,
    title: "Adgangskontrol pr. organisation",
    body: "Hver organisation er en lukket kreds. Row-Level Security (RLS) i PostgreSQL sikrer at kun aktive medlemmer af netop jeres organisation kan tilgå jeres fremmøde, vagtplan, tjek-ind-historik og personaldata — håndhævet direkte i databasen, ikke kun i appen.",
  },
  {
    icon: KeyRound,
    title: "Roller: admin og personale",
    body: "Personale kan registrere fremmøde og tjekke ind/ud. Kritiske handlinger — luk dag, invitér brugere, administrér vagtplan, se tidsregistreringer — kræver admin-rolle og valideres både i UI og på serveren.",
  },
  {
    icon: QrCode,
    title: "QR-kode og PIN check-in",
    body: "QR-koder er unikke per lokation og organisation. PIN-koder lagres som bcrypt-hash — den rå kode opbevares aldrig. Tjek-ind via QR eller PIN kræver en gyldig, aktiv session — uautoriserede kan ikke tjekke ind.",
  },
  {
    icon: Fingerprint,
    title: "To-faktor-godkendelse (2FA)",
    body: "Admins kan aktivere tidsbaseret éngangs-adgangskode (TOTP/2FA) på deres konto. Når 2FA er slået til, skal man både kende adgangskoden og have sin authenticator-app for at logge ind.",
  },
  {
    icon: FileLock2,
    title: "Sikre invitationer",
    body: "Invitationskoder kan ikke listes eller gættes. Koden valideres server-side med udløbstjek og engangsforbrug — en gammel eller brugt kode afvises altid.",
  },
  {
    icon: Radio,
    title: "Real-time uden lækager",
    body: "Live-opdateringer (fremmøde, vagtplan, tjek-ind) er scopet til jeres organisations ID. Andre organisationer ser aldrig jeres data — heller ikke via den underliggende real-time kanal.",
  },
  {
    icon: Clock,
    title: "Tidsregistrering og vagtplan",
    body: "Personalets tjek-ind, tjek-ud og vagtplaner gemmes med præcis tidsstempel og bruger-ID. Al historik er søgbar og eksporterbar af admin til løndokumentation.",
  },
  {
    icon: EyeOff,
    title: "Mindst mulig eksponering",
    body: "Følsomme felter (CPR, lægeoplysninger, noter) er skjult bag et bevidst klik. PIN-hashes og interne tokens vises aldrig i UI. Server-functions validerer adgang selvstændigt af klient-routing.",
  },
];

const owasp = [
  "Server-side inputvalidering med Zod-skemaer på alle server-funktioner — ingen rå data skrives direkte til databasen.",
  "Generiske fejlbeskeder ved login og oprettelse — angribere kan ikke afgøre om en e-mail eksisterer.",
  "Stærke adgangskoder kræves; glemte adgangskoder håndteres via verificeret e-mail-link.",
  "Alle roller og rettigheder valideres på serveren (createServerFn) — aldrig kun i browseren.",
  "PIN-koder hashes med bcrypt før lagring — den rå kode gemmes aldrig i databasen.",
  "Dag-snapshot ved luk-dag skaber et revisionsspor: hvem lukkede, hvornår og hvad var status.",
  "Supabase Auth med kort session-levetid og automatisk token-rotation.",
  "Vi følger principperne i OWASP Top 10 og ASVS for webapplikationer.",
];

function FeatureKort({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
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

function SikkerhedSide() {
  return (
    <div className="min-h-screen">
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Tilstede</span>
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link to="/" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Forside</Link>
          <Link to="/priser" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Priser</Link>
          <Link to="/login/personale" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Log ind</Link>
          <Link to="/signup" search={{ plan: undefined }} className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90">
            Start gratis
          </Link>
        </div>
      </header>

      <section className="container mx-auto px-6 py-16 text-center fade-in">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Sikkerhed bygget ind fra første linje kode
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold tracking-tight md:text-5xl">
          Jeres data er <span className="bg-gradient-primary bg-clip-text text-transparent">beskyttet</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Tilstede håndterer fremmøde, tjek-ind, vagtplaner og personaleoversigter — data der kræver respekt.
          Vi har bygget systemet efter tre principper: mindst mulig adgang, kryptering hele vejen, og
          fuldstændig adskillelse mellem organisationer.
        </p>
      </section>

      <section className="container mx-auto grid gap-4 px-6 pb-16 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <FeatureKort key={f.title} {...f} />
        ))}
      </section>

      <section className="container mx-auto px-6 pb-16">
        <div className="glass rounded-3xl p-8 md:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
              <ServerCog className="h-5 w-5" />
            </div>
            <h2 className="font-display text-2xl font-bold">Sikkerhedsprincipper vi følger</h2>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Tilstede er udviklet efter anerkendte sikkerhedsstandarder. Vi tester løbende mod de mest
            almindelige angrebsmønstre og opdaterer vores praksis når nye trusler opstår.
          </p>
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {owasp.map((punkt) => (
              <li key={punkt} className="flex items-start gap-3 rounded-xl bg-surface/40 p-3 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{punkt}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="container mx-auto px-6 pb-16">
        <div className="rounded-3xl border border-border bg-surface/40 p-8 backdrop-blur">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Compliance og infrastruktur
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">
              Bygget på en platform med internationale certificeringer
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              Tilstede hostes på Supabase (database og auth) og Vercel (hosting), begge med
              anerkendte sikkerheds- og databeskyttelsescertificeringer.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col items-center rounded-2xl border border-border bg-background p-6 text-center transition hover:shadow-soft">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <Globe2 className="h-7 w-7" />
              </div>
              <h3 className="font-display text-lg font-bold">GDPR</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Fuld overholdelse af EU's persondataforordning. Data opbevares i EU-datacenter og
                slettes på anmodning.
              </p>
            </div>
            <div className="flex flex-col items-center rounded-2xl border border-border bg-background p-6 text-center transition hover:shadow-soft">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <BadgeCheck className="h-7 w-7" />
              </div>
              <h3 className="font-display text-lg font-bold">SOC 2 Type II</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Uafhængigt auditerede kontroller hos Supabase og Vercel for sikkerhed,
                tilgængelighed og fortrolighed.
              </p>
            </div>
            <div className="flex flex-col items-center rounded-2xl border border-border bg-background p-6 text-center transition hover:shadow-soft">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <ScrollText className="h-7 w-7" />
              </div>
              <h3 className="font-display text-lg font-bold">ISO 27001</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Informationssikkerhedsledelse hos vores infrastrukturleverandører efter
                ISO/IEC 27001-standarden.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-6 pb-24 text-center">
        <h2 className="font-display text-2xl font-bold">Spørgsmål om sikkerhed eller GDPR?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Vi svarer gerne på konkrete spørgsmål om databehandling, opbevaring, databehandleraftaler og rettigheder.
          Skriv til os — vi vender tilbage hurtigst muligt.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="mailto:support@tilstede.live"
            className="rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02]"
          >
            Kontakt support
          </a>
          <Link to="/" className="rounded-xl border border-border bg-surface px-6 py-3 font-semibold transition hover:bg-surface-elevated">
            Tilbage til forsiden
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/" className="hover:text-foreground">Forside</Link>
          <Link to="/privatlivspolitik" className="hover:text-foreground">Privatlivspolitik</Link>
          <Link to="/priser" className="hover:text-foreground">Priser</Link>
        </div>
        <p className="mt-3">Tilstede © {new Date().getFullYear()} — bygget til danske organisationer.</p>
        <p className="mt-2 text-[10px] opacity-50">Tilstede er udviklet og drevet af FPH · CVR: 43252771 · Violvej 11, 1 - 4900 Nakskov · support@tilstede.live</p>
      </footer>
    </div>
  );
}
