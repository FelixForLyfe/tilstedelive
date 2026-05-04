import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  ShieldCheck,
  Lock,
  Users,
  KeyRound,
  Image as ImageIcon,
  Radio,
  FileLock2,
  EyeOff,
  ServerCog,
  CheckCircle2,
  ScrollText,
  BadgeCheck,
  Globe2,
} from "lucide-react";

export const Route = createFileRoute("/sikkerhed")({
  head: () => ({
    meta: [
      { title: "Sikkerhed — Tilstede" },
      {
        name: "description",
        content:
          "Sådan beskytter Tilstede jeres institutions data: kryptering, adgangskontrol pr. organisation, private billeder og GDPR-bevidst design.",
      },
      { property: "og:title", content: "Sikkerhed — Tilstede" },
      {
        property: "og:description",
        content:
          "Sådan beskytter Tilstede jeres institutions data: kryptering, adgangskontrol pr. organisation, private billeder og GDPR-bevidst design.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Sikkerhed — Tilstede" },
      {
        name: "twitter:description",
        content:
          "Sådan beskytter Tilstede jeres institutions data: kryptering, adgangskontrol pr. organisation og private billeder.",
      },
    ],
  }),
  component: SikkerhedSide,
});

const features = [
  {
    icon: Lock,
    title: "Krypteret forbindelse og lagring",
    body: "Al trafik mellem jeres enheder og Tilstede er krypteret med TLS. Databasen krypteres også på lager-niveau hos vores hosting-partner, så data aldrig ligger i klartekst.",
  },
  {
    icon: Users,
    title: "Adgangskontrol pr. organisation",
    body: "Hver institution er sin egen lukkede kreds. Row-Level Security i databasen sikrer at kun aktive medlemmer af jeres organisation kan se børn, fremmøde, noter og personaledata — også selvom nogen prøver at omgå appen.",
  },
  {
    icon: KeyRound,
    title: "Roller: admin og personale",
    body: "Personale kan registrere fremmøde, noter og aktiviteter. Følsomme handlinger — slet barn, luk dag, invitér nye brugere, redigér personoplysninger — kræver admin-rolle og håndhæves både i grænsefladen og i databasen.",
  },
  {
    icon: ImageIcon,
    title: "Private billeder af børn",
    body: "Fotos ligger i et privat lager. Når et billede vises, henter vi en tidsbegrænset, signeret link kun til den medarbejder der er logget ind. Linket udløber automatisk og kan ikke deles videre.",
  },
  {
    icon: FileLock2,
    title: "Sikre invitationer",
    body: "Invitationskoder kan ikke listes eller gættes. Når personale tilmelder sig, går koden gennem en valideret server-funktion, der tjekker udløb og engangsforbrug — så en gammel kode aldrig kan misbruges.",
  },
  {
    icon: Radio,
    title: "Real-time uden lækager",
    body: "Live-opdateringer mellem enheder er scopet til jeres organisation. Andre institutioner ser aldrig jeres ændringer — heller ikke gennem den underliggende real-time kanal.",
  },
];

const owasp = [
  "Server-side validering af alle input med skemaer (Zod) — ingen rå data går i databasen.",
  "Generiske fejlbeskeder ved login og oprettelse — så angribere ikke kan finde ud af om en e-mail findes.",
  "Stærke adgangskoder kræves (mindst 8 tegn), og glemte adgangskoder håndteres via verificeret e-mail.",
  "Roller og rettigheder valideres altid på serveren, aldrig kun i browseren.",
  "Følsomme handlinger logges via dag-snapshot, så I kan dokumentere hvad der skete hvornår.",
  "Vi følger principperne i OWASP Top 10 og ASVS-controls for webapplikationer.",
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
          <Link to="/login/personale" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Personale</Link>
          <Link to="/signup" className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90">Opret organisation</Link>
        </div>
      </header>

      <section className="container mx-auto px-6 py-16 text-center fade-in">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" />
          Sikkerhed bygget ind fra første linje kode
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold tracking-tight md:text-5xl">
          Jeres institutions data er <span className="bg-gradient-primary bg-clip-text text-transparent">beskyttet</span>.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Tilstede håndterer følsomme oplysninger om børn, forældre og personale. Vi har derfor bygget appen
          omkring tre principper: mindst mulig adgang, kryptering hele vejen, og en tydelig adskillelse mellem
          organisationer.
        </p>
      </section>

      <section className="container mx-auto grid gap-4 px-6 pb-16 md:grid-cols-2 lg:grid-cols-3">
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
            <h2 className="font-display text-2xl font-bold">Best practices vi følger</h2>
          </div>
          <p className="mt-4 max-w-3xl text-sm text-muted-foreground">
            Tilstede er udviklet efter anerkendte sikkerhedsstandarder for webapplikationer. Vi tester løbende mod
            de mest almindelige angrebsmønstre.
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

      <section className="container mx-auto grid gap-4 px-6 pb-16 md:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
            <EyeOff className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold">Kun det nødvendige vises</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            CPR-numre, lægekontakter og andre følsomme oplysninger ligger skjult bag et bevidst klik. Personale
            ser dem først når de aktivt åbner et barns profil — aldrig som en del af den daglige oversigt.
          </p>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold">Daglig drift med spor</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Når dagen lukkes, gemmes et signeret snapshot af fremmøde, aktiviteter og personaletid i arkivet.
            Kun admin kan se og slette arkivet, og hver lukning bærer den ansvarlige admins navn og tidspunkt.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-6 pb-24 text-center">
        <h2 className="font-display text-2xl font-bold">Spørgsmål om sikkerhed eller GDPR?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Vi svarer gerne på konkrete spørgsmål om databehandling, opbevaring og rettigheder. Skriv til os, så
          vender vi tilbage hurtigst muligt.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            href="mailto:support@tilstede.live"
            className="rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02]"
          >
            Kontakt support
          </a>
          <Link
            to="/"
            className="rounded-xl border border-border bg-surface px-6 py-3 font-semibold transition hover:bg-surface-elevated"
          >
            Tilbage til forsiden
          </Link>
        </div>
      </section>

      <section className="container mx-auto px-6 pb-16">
        <div className="rounded-3xl border border-border bg-surface/40 p-8 backdrop-blur">
          <div className="mb-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Compliance & certificeringer
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">
              Bygget på en platform, der lever op til internationale standarder
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
              Tilstede hostes på infrastruktur, der løbende auditeres mod anerkendte sikkerheds- og
              databeskyttelsesstandarder.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col items-center rounded-2xl border border-border bg-background p-6 text-center transition hover:shadow-soft">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <Globe2 className="h-7 w-7" />
              </div>
              <h3 className="font-display text-lg font-bold">GDPR</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Fuld overholdelse af EU's persondataforordning. Data opbevares i EU og slettes på anmodning.
              </p>
            </div>
            <div className="flex flex-col items-center rounded-2xl border border-border bg-background p-6 text-center transition hover:shadow-soft">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <BadgeCheck className="h-7 w-7" />
              </div>
              <h3 className="font-display text-lg font-bold">SOC 2 Type II</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Uafhængigt auditerede kontroller for sikkerhed, tilgængelighed og fortrolighed.
              </p>
            </div>
            <div className="flex flex-col items-center rounded-2xl border border-border bg-background p-6 text-center transition hover:shadow-soft">
              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
                <ScrollText className="h-7 w-7" />
              </div>
              <h3 className="font-display text-lg font-bold">ISO 27001</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Informationssikkerhedsledelse efter den internationale ISO/IEC 27001-standard.
              </p>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Tilstede © {new Date().getFullYear()} – bygget til danske institutioner.
      </footer>
    </div>
  );
}
