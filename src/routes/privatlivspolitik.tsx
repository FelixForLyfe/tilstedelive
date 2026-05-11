import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Sparkles,
  ScrollText,
  Building2,
  Database,
  Scale,
  ServerCog,
  Clock,
  ShieldCheck,
  Cookie,
  MessageSquare,
  Trash2,
  UserCheck,
  FileText,
  Lock,
  ChevronRight,
} from "lucide-react";

export const Route = createFileRoute("/privatlivspolitik")({
  head: () => ({
    meta: [
      { title: "Privatlivspolitik — Tilstede" },
      {
        name: "description",
        content:
          "Tilstedes privatlivspolitik: hvilke persondata vi behandler, hvorfor vi gør det, og dine rettigheder som registreret under GDPR.",
      },
      { property: "og:title", content: "Privatlivspolitik — Tilstede" },
      {
        property: "og:description",
        content:
          "Tilstedes privatlivspolitik: hvilke persondata vi behandler, hvorfor vi gør det, og dine rettigheder som registreret under GDPR.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PrivatlivsSide,
});

const rettigheder = [
  {
    icon: FileText,
    titel: "Indsigt (art. 15)",
    tekst: "Du kan til enhver tid anmode om en kopi af de personoplysninger, vi behandler om dig.",
  },
  {
    icon: UserCheck,
    titel: "Berigtigelse (art. 16)",
    tekst: "Du kan få urigtige eller ufuldstændige oplysninger om dig selv rettet.",
  },
  {
    icon: Trash2,
    titel: "Sletning (art. 17)",
    tekst: "Du kan anmode om at få dine oplysninger slettet, når de ikke længere er nødvendige.",
    link: { href: "/slet-data" },
  },
  {
    icon: Lock,
    titel: "Begrænsning (art. 18)",
    tekst: "Du kan kræve at behandlingen af dine oplysninger begrænses, mens en tvist afklares.",
  },
  {
    icon: Database,
    titel: "Dataportabilitet (art. 20)",
    tekst: "Du kan modtage dine oplysninger i et struktureret, maskinlæsbart format.",
  },
  {
    icon: MessageSquare,
    titel: "Indsigelse (art. 21)",
    tekst: "Du kan gøre indsigelse mod behandling baseret på legitim interesse.",
  },
];

const tredjeparter = [
  {
    navn: "Supabase Inc.",
    rolle: "Databehandler",
    formål: "Database, autentifikation og filopbevaring",
    sted: "EU-datacenter (Frankfurt)",
    link: "https://supabase.com/privacy",
  },
  {
    navn: "Vercel Inc.",
    rolle: "Databehandler",
    formål: "Hosting og levering af webapplikationen",
    sted: "EU-region (Frankfurt)",
    link: "https://vercel.com/legal/privacy-policy",
  },
];

const cookies = [
  {
    navn: "sb-*-auth-token",
    type: "Nødvendig",
    formål: "Supabase login-session — holder dig logget ind og validerer din identitet ved API-kald.",
    levetid: "Sessionbaseret / op til 7 dage",
  },
  {
    navn: "tilstede.aktivOrgId",
    type: "Nødvendig",
    formål: "Husker hvilken organisation du sidst arbejdede i. Gemmes i localStorage.",
    levetid: "Indtil browseren ryddes",
  },
  {
    navn: "tilstede:cookie-consent",
    type: "Nødvendig",
    formål: "Husker dit valg i cookie-banneret. Gemmes i localStorage.",
    levetid: "Indtil browseren ryddes",
  },
  {
    navn: "tilstede:install-dismissed",
    type: "Præference",
    formål: "Husker at du har afvist installationsforslaget (PWA-prompt).",
    levetid: "Indtil browseren ryddes",
  },
];

function AfsnitsKort({
  icon: Icon,
  titel,
  children,
}: {
  icon: React.ElementType;
  titel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-semibold">{titel}</h2>
      </div>
      <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

function PrivatlivsSide() {
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
          <Link to="/sikkerhed" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Sikkerhed</Link>
          <Link to="/login/personale" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Log ind</Link>
          <Link to="/signup" search={{ plan: undefined }} className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90">
            Start gratis
          </Link>
        </div>
      </header>

      <section className="container mx-auto px-6 py-14 text-center fade-in">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
          <ScrollText className="h-3.5 w-3.5 text-primary" />
          Sidst opdateret: maj 2026
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-bold tracking-tight md:text-5xl">
          Privatlivs&shy;politik
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Tilstede behandler personoplysninger med respekt for din privatlivsret. Her forklarer vi
          præcist hvilke data vi indsamler, hvorfor vi gør det, og hvad du kan kræve af os.
        </p>
      </section>

      <div className="container mx-auto grid gap-4 px-6 pb-10 md:grid-cols-2">

        {/* 1 — Dataansvarlig */}
        <AfsnitsKort icon={Building2} titel="1. Dataansvarlig">
          <p>Den dataansvarlige for behandling af personoplysninger i Tilstede er:</p>
          <div className="rounded-xl bg-surface/50 p-4 font-mono text-xs text-foreground">
            <p className="not-italic font-sans text-sm font-semibold">FPH</p>
            <p className="mt-1">CVR: 43252771</p>
            <p>Violvej 11, 1 · 4900 Nakskov</p>
            <p>E-mail: <a href="mailto:support@tilstede.live" className="text-primary hover:underline">support@tilstede.live</a></p>
          </div>
          <p>
            Institutioner og virksomheder der opretter en organisation i Tilstede er selvstændigt
            dataansvarlige for de oplysninger de registrerer om børn, medlemmer og medarbejdere.
            Tilstede handler i den forbindelse som databehandler på kundens vegne og leverer
            databehandleraftale på anmodning.
          </p>
        </AfsnitsKort>

        {/* 2 — Hvilke data */}
        <AfsnitsKort icon={Database} titel="2. Hvilke personoplysninger behandler vi?">
          <p className="font-medium text-foreground">Brugerkontodata (medarbejdere og admins):</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>E-mailadresse (bruges til login og invitationer)</li>
            <li>Visningsnavn / fulde navn</li>
            <li>Login-tidspunkter og sessionstokens (via Supabase Auth)</li>
            <li>To-faktor-autentifikationsnøgle (TOTP-seed, krypteret), hvis aktiveret</li>
          </ul>
          <p className="font-medium text-foreground">Fremmøde og tjek-ind (på kundens vegne):</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Tjek-ind og tjek-ud tidsstempler pr. medarbejder</li>
            <li>Lokation for tjek-ind (via QR-kode eller PIN)</li>
            <li>Vagtplan: vagttider, roller, tildelte medarbejdere</li>
            <li>Fremmøde på åbne og tildelte vagter</li>
            <li>Bytteaftaler, fraværsmeldinger og timebanksaldo</li>
          </ul>
          <p className="font-medium text-foreground">Børne- og deltageropplysninger (på kundens vegne):</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Fulde navn, CPR-nummer, adresse (valgfrit)</li>
            <li>Forældrenes kontaktoplysninger og lægeoplysninger (valgfrit)</li>
            <li>Allergier og særlige noter</li>
            <li>Fremmøderegistreringer og aktivitetstildelinger</li>
            <li>Profilbillede (valgfrit, privat lager)</li>
          </ul>
          <p className="font-medium text-foreground">Systemdata:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Dag-snapshots ved luk-dag (arkiv)</li>
            <li>QR-lokationer og bcrypt-hashede PIN-koder</li>
            <li>Betainteressetilmeldinger (navn, e-mail, organisationstype)</li>
          </ul>
        </AfsnitsKort>

        {/* 3 — Formål og retsgrundlag */}
        <AfsnitsKort icon={Scale} titel="3. Formål og retsgrundlag">
          <div className="space-y-3">
            <div className="rounded-xl bg-surface/50 p-3">
              <p className="font-medium text-foreground">Brugerkonti og login</p>
              <p className="mt-1">
                Formål: Oprette og administrere din adgang til Tilstede.<br />
                Retsgrundlag: Opfyldelse af aftale (GDPR art. 6, stk. 1, litra b).
              </p>
            </div>
            <div className="rounded-xl bg-surface/50 p-3">
              <p className="font-medium text-foreground">Fremmøde, tjek-ind og vagtplan</p>
              <p className="mt-1">
                Formål: Levere fremmøde-, tjek-ind- og vagtplanfunktioner til kunden.<br />
                Retsgrundlag: Opfyldelse af aftale med den dataansvarlige kunde (art. 6, stk. 1, litra b)
                samt eventuel retlig forpligtelse (art. 6, stk. 1, litra c).
              </p>
            </div>
            <div className="rounded-xl bg-surface/50 p-3">
              <p className="font-medium text-foreground">Betainteresse-tilmeldinger</p>
              <p className="mt-1">
                Formål: Kontakte interesserede virksomheder og institutioner forud for lancering.<br />
                Retsgrundlag: Samtykke (art. 6, stk. 1, litra a) — afgivet ved indsendelse af formularen.
                Slettes på anmodning.
              </p>
            </div>
            <div className="rounded-xl bg-surface/50 p-3">
              <p className="font-medium text-foreground">Cookies og localStorage</p>
              <p className="mt-1">
                Formål: Holde dig logget ind og huske dine præferencer.<br />
                Retsgrundlag: Berettiget interesse (nødvendige, art. 6, stk. 1, litra f) og
                samtykke (præference, art. 6, stk. 1, litra a).
              </p>
            </div>
          </div>
        </AfsnitsKort>

        {/* 4 — Tredjeparter */}
        <AfsnitsKort icon={ServerCog} titel="4. Databehandlere og tredjeparter">
          <p>
            Vi deler ikke dine oplysninger med tredjeparter til kommercielle formål.
            Vi anvender følgende databehandlere til at levere tjenesten:
          </p>
          <div className="space-y-2">
            {tredjeparter.map((p) => (
              <div key={p.navn} className="rounded-xl bg-surface/50 p-3">
                <p className="font-medium text-foreground">
                  {p.navn} — <span className="text-primary">{p.rolle}</span>
                </p>
                <p className="mt-0.5">{p.formål}</p>
                <p className="mt-0.5">Placering: {p.sted}</p>
                <a
                  href={p.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Privatlivspolitik <ChevronRight className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
          <p>
            Begge leverandører opbevarer data i EU og har indgået databehandleraftaler med
            Tilstede i overensstemmelse med GDPR kapitel V.
          </p>
        </AfsnitsKort>

        {/* 5 — Opbevaring og sletning */}
        <AfsnitsKort icon={Clock} titel="5. Opbevaring og sletning">
          <div className="space-y-2">
            <div className="rounded-xl bg-surface/50 p-3">
              <p className="font-medium text-foreground">Brugerkontodata</p>
              <p className="mt-0.5">
                Opbevares så længe kontoen er aktiv. Slettes inden for 30 dage efter anmodning.
              </p>
            </div>
            <div className="rounded-xl bg-surface/50 p-3">
              <p className="font-medium text-foreground">Tjek-ind og vagtplandata</p>
              <p className="mt-0.5">
                Opbevares af kunden efter eget valg. Admin kan slette enkeltposter eller alle data.
                Tilstede sletter automatisk al data, hvis organisationen slettes.
              </p>
            </div>
            <div className="rounded-xl bg-surface/50 p-3">
              <p className="font-medium text-foreground">Dag-snapshots (arkiv)</p>
              <p className="mt-0.5">
                Opbevares indtil admin sletter dem. Kan ikke genskabes efter sletning.
              </p>
            </div>
            <div className="rounded-xl bg-surface/50 p-3">
              <p className="font-medium text-foreground">Betainteresse-tilmeldinger</p>
              <p className="mt-0.5">
                Opbevares til lancering og slettes herefter, med mindre du aktivt opretter en konto.
                Send sletningsanmodning til support@tilstede.live.
              </p>
            </div>
          </div>
          <p>
            Du kan til enhver tid anmode om sletning via vores{" "}
            <Link to="/slet-data" className="text-primary hover:underline">
              side for datasletning
            </Link>.
          </p>
        </AfsnitsKort>

        {/* 6 — Cookies */}
        <AfsnitsKort icon={Cookie} titel="6. Cookies og lokal lagring">
          <p>
            Tilstede bruger udelukkende teknisk nødvendige og præferencecookies.
            Vi bruger ingen sporings-, reklame- eller analysecookies.
          </p>
          <div className="space-y-2">
            {cookies.map((c) => (
              <div key={c.navn} className="rounded-xl bg-surface/50 p-3">
                <p className="font-mono text-xs text-primary">{c.navn}</p>
                <p className="mt-1">
                  <span
                    className={
                      c.type === "Nødvendig"
                        ? "rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success"
                        : "rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning"
                    }
                  >
                    {c.type}
                  </span>
                </p>
                <p className="mt-1">{c.formål}</p>
                <p className="mt-0.5 text-xs">Levetid: {c.levetid}</p>
              </div>
            ))}
          </div>
          <p>
            Du kan til enhver tid ændre dit cookievalg ved at rydde dine browserdata eller kontakte os.
          </p>
        </AfsnitsKort>
      </div>

      {/* Rettigheder */}
      <section className="container mx-auto px-6 pb-10">
        <div className="glass rounded-3xl p-8 md:p-10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="font-display text-2xl font-bold">7. Dine rettigheder</h2>
          </div>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Som registreret har du en række rettigheder under GDPR. Du udøver dem ved at kontakte os på{" "}
            <a href="mailto:support@tilstede.live" className="text-primary hover:underline">
              support@tilstede.live
            </a>
            . Vi besvarer din anmodning inden for 30 dage.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rettigheder.map((r) => (
              <div key={r.titel} className="flex items-start gap-3 rounded-xl bg-surface/40 p-4 text-sm">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                  <r.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{r.titel}</p>
                  <p className="mt-1 text-muted-foreground">
                    {r.tekst}
                    {r.link && (
                      <>
                        {" "}
                        <Link to={r.link.href as any} className="text-primary hover:underline">
                          Se side for datasletning
                        </Link>.
                      </>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Klage & kontakt */}
      <section className="container mx-auto grid gap-4 px-6 pb-10 md:grid-cols-2">
        <div className="glass rounded-2xl p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
            <MessageSquare className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold">Klage til Datatilsynet</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Du har ret til at klage til Datatilsynet, hvis du mener at vi behandler dine
            personoplysninger i strid med databeskyttelseslovgivningen.
          </p>
          <div className="mt-4 rounded-xl bg-surface/50 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Datatilsynet</p>
            <p>Carl Jacobsens Vej 35, 2500 Valby</p>
            <p><a href="mailto:dt@datatilsynet.dk" className="text-primary hover:underline">dt@datatilsynet.dk</a></p>
            <p>Tlf.: +45 33 19 32 00</p>
            <a href="https://www.datatilsynet.dk" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              www.datatilsynet.dk <ChevronRight className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
            <ScrollText className="h-5 w-5" />
          </div>
          <h3 className="text-lg font-semibold">Ændringer til denne politik</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Vi opdaterer denne privatlivspolitik, når det er nødvendigt — f.eks. ved ændringer i
            lovgivning eller i den måde vi behandler data på. Datoen øverst på siden viser hvornår
            politikken sidst blev revideret.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Væsentlige ændringer varsles via e-mail til registrerede brugere mindst 14 dage inden ikrafttræden.
          </p>
        </div>
      </section>

      <section className="container mx-auto px-6 pb-24 text-center">
        <h2 className="font-display text-2xl font-bold">Spørgsmål om dine data?</h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
          Skriv til os, og vi vender tilbage inden for 2 hverdage.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="mailto:support@tilstede.live" className="rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02]">
            Kontakt support
          </a>
          <Link to="/slet-data" className="rounded-xl border border-border bg-surface px-6 py-3 font-semibold transition hover:bg-surface-elevated">
            Anmod om datasletning
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap justify-center gap-4">
          <Link to="/" className="hover:text-foreground">Forside</Link>
          <Link to="/sikkerhed" className="hover:text-foreground">Sikkerhed</Link>
          <Link to="/slet-data" className="hover:text-foreground">Slet mine data</Link>
        </div>
        <p className="mt-3">Tilstede © {new Date().getFullYear()} — bygget til danske organisationer.</p>
        <p className="mt-2 text-[10px] opacity-50">Tilstede er udviklet og drevet af FPH · CVR: 43252771 · Violvej 11, 1 - 4900 Nakskov · support@tilstede.live</p>
      </footer>
    </div>
  );
}
