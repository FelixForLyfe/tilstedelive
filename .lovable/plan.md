## Sikkerhedshærdning + ny "Sikkerhed"-side

### Del 1 — Sikkerhedshærdning (uændret fra forrige plan)

Lukker alle aktuelle scanner-fund:

**Database-migration:**
- Gør `child-photos` bucket privat; ny RLS der kun tillader org-medlemmer at læse
- Fjern `anyone can lookup unused codes` og `user can redeem own invite` policies på `organization_invites` (al indløsning går nu via eksisterende `redeem_invite()` SECURITY DEFINER)
- Fjern `members update child notes` på `children` (daglige noter ligger på `attendance_records`, så personale behøver ikke længere UPDATE-adgang til følsomme børnefelter)
- Aktivér RLS på `realtime.messages` og scope topic-abonnementer til brugerens organisationer
- REVOKE EXECUTE på interne SECURITY DEFINER-funktioner (`handle_new_user`, `handle_day_close`, `set_updated_at`) fra `public/anon/authenticated`

**Kode-ændringer:**
- `BarnDetalje.tsx` + `app.admin.tsx` + `app.index.tsx`: skift fra `getPublicUrl` til `createSignedUrl(sti, 3600)`; gem storage-sti (ikke URL) i `children.photo_url`
- `src/server/organization.functions.ts`: zod-validering af input, generisk fejlbesked ved duplikat-email (forhindrer enumeration), detaljeret server-side log
- `src/routes/app.tsx`: fjern SSR short-circuit i `beforeLoad`; sæt `Cache-Control: no-store, private` på beskyttede ruter
- Sikre at admin-handlinger (`lukDag`, `genaaben`, rolle-skift, invite-oprettelse) er beskyttet både af RLS og UI-gates (de er allerede dækket af `is_org_admin` policies — verificeres)

### Del 2 — Ny "/sikkerhed" landing page

**Ny rute:** `src/routes/sikkerhed.tsx`

Forklarer på dansk, i et roligt og tillidsvækkende sprog (ikke teknisk jargon for slutbrugeren), hvilken sikkerhed der er integreret. Strukturen:

1. **Hero** — "Din institutions data er beskyttet" + kort intro
2. **Hvad vi beskytter** — børneoplysninger, CPR, lægekontakter, fotos, personale-tider
3. **Hvordan det fungerer** (4–6 kort med ikoner fra lucide-react):
   - **Krypteret forbindelse** — TLS i transit, krypteret database
   - **Adgangskontrol pr. organisation** — Row-Level Security; kun medlemmer af jeres organisation kan se jeres data
   - **Rolle-baseret rettighedsstyring** — admin vs. personale; følsomme handlinger kræver admin
   - **Private billeder** — fotos af børn ligger i en privat bucket og hentes med tidsbegrænsede signerede links
   - **Sikre invitationer** — invite-koder kan kun indløses gennem en valideret server-funktion, ikke listes
   - **Real-time isolation** — live-opdateringer er scopet til jeres organisation
4. **OWASP & best practices** — kort sektion: "Vi følger OWASP Top 10 og ASVS-controls" med bullets om input-validering, server-side autorisation, audit-logs
5. **Daglig drift** — automatisk dag-lukning logger snapshot, daglige noter er pr. dag, arkiv er admin-only
6. **Kontakt / spørgsmål** — link til support

**Navigation:**
- Tilføj "Sikkerhed"-link i landing-page headeren (`src/routes/index.tsx` eller fælles header-komponent — vi inspicerer først hvor nav ligger)
- Footer-link

**Metadata (head()):**
- title: "Sikkerhed — Tilstede"
- description: "Sådan beskytter Tilstede jeres institutions data: kryptering, adgangskontrol og GDPR-bevidst design."
- og:title, og:description, twitter-tags

**Design:**
- Bruger eksisterende design-tokens og komponenter (Card, Badge, ikoner)
- Ingen nye farver eller fonts; følger nuværende landing page stil
- Responsivt grid for "Hvordan det fungerer"-kortene

### Verifikation

- Kør `security--run_security_scan` igen efter migration
- Manuel test: personale-konto kan ikke SELECT på invites, ikke UPDATE cpr_number, ikke hente foto uden auth
- Ny `/sikkerhed`-rute renderer og er linket fra landing page

### Hvad der IKKE ændres

- Eksisterende UI/UX, designsystem, farver, fonts
- App-funktionalitet (fremmøde, aktiviteter, arkiv, dag-lukning)
- Eksisterende RLS-politikker på domæne-tabeller (de er korrekte)
- Routing-struktur for `/app/*`
