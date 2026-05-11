import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { submitBetaSignup } from "@/server/beta.functions";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  Sparkles,
  Shield,
  Clock,
  Zap,
  Users,
  QrCode,
  Calendar,
  BarChart3,
  LogIn,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tilstede — Fremmødesystem til SFO'er, klubber og virksomheder" },
      {
        name: "description",
        content:
          "Hold styr på fremmøde, vagtplaner og tjek ind. Bruges af SFO'er, sportsklubber og butikker i Danmark. Start gratis — ingen kreditkort.",
      },
      { property: "og:title", content: "Tilstede — Fremmødesystem til SFO'er, klubber og virksomheder" },
      { property: "og:description", content: "Hold styr på fremmøde, vagtplaner og tjek ind. Start gratis." },
      { property: "og:type", content: "website" },
      { name: "robots", content: "index, follow" },
    ],
  }),
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: Forside,
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function trackCta(location: string) {
  try {
    (window as any).gtag?.("event", "cta_click", { cta_location: location });
  } catch {}
}

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function useCounter(target: number, active: boolean, duration = 1800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, duration]);
  return val;
}

// ─── CTA Button ───────────────────────────────────────────────────────────────

function CtaButton({ label = "Start 7 dages gratis prøve →", tracking, size = "default" }: {
  label?: string;
  tracking: string;
  size?: "default" | "lg";
}) {
  const cls = size === "lg"
    ? "inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-10 py-5 text-xl font-bold text-primary-foreground shadow-glow transition hover:scale-[1.03] hover:shadow-[0_20px_60px_-10px_oklch(0.72_0.18_195_/_0.55)] active:scale-[0.98]"
    : "inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02] hover:opacity-95 active:scale-[0.98]";
  return (
    <Link
      to="/signup"
      search={{ plan: undefined }}
      className={cls}
      data-cta={tracking}
      onClick={() => trackCta(tracking)}
    >
      {label}
    </Link>
  );
}

// ─── Sticky Nav ───────────────────────────────────────────────────────────────

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border/50 bg-background/80 backdrop-blur-xl shadow-card"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Tilstede</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex">
          <a href="#funktioner" className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">Funktioner</a>
          <a href="#brancher" className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">Brancher</a>
          <Link to="/priser" className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">Priser</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/login/personale" className="hidden rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground md:inline-flex">
            Log ind
          </Link>
          <Link
            to="/signup"
            search={{ plan: undefined }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02] hover:opacity-95"
            data-cta="nav-cta"
            onClick={() => trackCta("nav-cta")}
          >
            Start gratis
          </Link>
          <button
            className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-border/50 bg-background/95 backdrop-blur-xl md:hidden">
          <div className="flex flex-col gap-1 px-6 py-4">
            <a href="#funktioner" className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface" onClick={() => setMenuOpen(false)}>Funktioner</a>
            <a href="#brancher" className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface" onClick={() => setMenuOpen(false)}>Brancher</a>
            <Link to="/priser" className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface" onClick={() => setMenuOpen(false)}>Priser</Link>
            <Link to="/login/personale" className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-surface" onClick={() => setMenuOpen(false)}>Log ind</Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ─── Hero phone mockup ─────────────────────────────────────────────────────────

const CHECKIN_NAMES = [
  { name: "Emma Larsen", time: "08:14" },
  { name: "Lucas Pedersen", time: "08:17" },
  { name: "Sofie Nielsen", time: "08:22" },
  { name: "Oliver Hansen", time: "08:25" },
  { name: "Ida Christensen", time: "08:31" },
];

function PhoneMockup() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    setVisible(0);
    const ids: ReturnType<typeof setTimeout>[] = [];
    CHECKIN_NAMES.forEach((_, i) => {
      ids.push(setTimeout(() => setVisible(i + 1), 600 + i * 900));
    });
    const reset = setTimeout(() => {
      setVisible(0);
      CHECKIN_NAMES.forEach((_, i) => {
        ids.push(setTimeout(() => setVisible(i + 1), 600 + i * 900));
      });
    }, 600 + CHECKIN_NAMES.length * 900 + 2000);
    return () => { ids.forEach(clearTimeout); clearTimeout(reset); };
  }, []);

  return (
    <div className="relative mx-auto w-[260px] select-none">
      {/* Glow behind phone */}
      <div className="absolute inset-0 -z-10 scale-110 rounded-[3rem] bg-primary/20 blur-3xl" />
      {/* Phone frame */}
      <div className="relative overflow-hidden rounded-[2.5rem] border-[6px] border-border/60 bg-surface shadow-card">
        {/* Notch */}
        <div className="flex h-6 items-center justify-center bg-surface">
          <div className="h-1.5 w-14 rounded-full bg-border/60" />
        </div>
        {/* Screen */}
        <div className="min-h-[480px] bg-background px-3 pb-6 pt-3">
          {/* App header */}
          <div className="mb-3 flex items-center justify-between">
            <span className="font-display text-sm font-bold">Fremmøde</span>
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">Live</span>
          </div>
          {/* Stats row */}
          <div className="mb-3 grid grid-cols-2 gap-1.5">
            <div className="rounded-xl bg-success/10 px-2.5 py-2 text-center">
              <p className="text-lg font-bold text-success">{visible}</p>
              <p className="text-[10px] text-muted-foreground">Til stede</p>
            </div>
            <div className="rounded-xl bg-muted px-2.5 py-2 text-center">
              <p className="text-lg font-bold">{CHECKIN_NAMES.length - visible}</p>
              <p className="text-[10px] text-muted-foreground">Mangler</p>
            </div>
          </div>
          {/* Check-in list */}
          <div className="space-y-1.5">
            {CHECKIN_NAMES.map((c, i) => (
              <div
                key={c.name}
                className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface px-2.5 py-2 transition-all duration-500"
                style={{
                  opacity: i < visible ? 1 : 0.25,
                  transform: i < visible ? "translateX(0)" : "translateX(-8px)",
                }}
              >
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all duration-300 ${
                  i < visible ? "bg-success/20 text-success" : "bg-muted text-muted-foreground"
                }`}>
                  {i < visible ? "✓" : c.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-[11px] font-medium">{c.name}</p>
                </div>
                {i < visible && (
                  <span className="text-[10px] text-muted-foreground">{c.time}</span>
                )}
              </div>
            ))}
          </div>
        </div>
        {/* Home indicator */}
        <div className="flex h-5 items-center justify-center bg-surface">
          <div className="h-1 w-24 rounded-full bg-border/40" />
        </div>
      </div>
    </div>
  );
}

// ─── Hero section ─────────────────────────────────────────────────────────────

const SWITCHER = ["SFO'er og fritidsklubber", "Sportsklubber og foreninger", "Butikker og virksomheder"];

function Hero() {
  const [switchIdx, setSwitchIdx] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setSwitchIdx((i) => (i + 1) % SWITCHER.length);
        setFade(true);
      }, 300);
    }, 2800);
    return () => clearInterval(iv);
  }, []);

  return (
    <section className="relative overflow-hidden pt-28 pb-20 md:pt-36 md:pb-28">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[100px]" />
      <div className="pointer-events-none absolute -top-20 right-1/4 h-[400px] w-[400px] rounded-full bg-accent/8 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left */}
          <div>
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm">
              <span className="h-2 w-2 rounded-full bg-success" style={{ boxShadow: "0 0 0 0 oklch(0.72 0.18 150 / 0.5)", animation: "glowPulse 2s ease-in-out infinite" }} />
              Live fremmøde i realtid
            </div>

            <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl xl:text-6xl">
              Stop med at tælle<br />
              <span className="bg-gradient-primary bg-clip-text text-transparent">børn på fingre</span><br />
              og vagter i Excel.
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Tilstede er det enkle fremmødesystem til SFO'er, sportsklubber og butikker — se hvem der er til stede <em>lige nu</em>, direkte på din telefon.
            </p>

            {/* Text switcher */}
            <div className="mt-4 flex items-center gap-2 text-base font-medium">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              <span
                className="transition-opacity duration-300"
                style={{ opacity: fade ? 1 : 0 }}
              >
                {SWITCHER[switchIdx]}
              </span>
            </div>

            {/* CTA */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <CtaButton tracking="hero-primary" />
              <Link
                to="/login/personale"
                className="rounded-xl border border-border px-6 py-3 text-center font-semibold transition hover:bg-surface"
              >
                Log ind
              </Link>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Ingen kreditkort. Ingen binding. Opsig når som helst.
            </p>

            {/* Trust row */}
            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
              {[
                { icon: Shield, text: "GDPR-sikret" },
                { icon: Sparkles, text: "Dansk support" },
                { icon: Zap, text: "Op og køre på 5 min" },
                { icon: CheckCircle2, text: "Ingen binding" },
              ].map(({ icon: Icon, text }) => (
                <span key={text} className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5 text-primary" /> {text}
                </span>
              ))}
            </div>
          </div>

          {/* Right — phone mockup */}
          <div className="flex justify-center lg:justify-end">
            <PhoneMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Beta / Early adopter signup ──────────────────────────────────────────────

const ORG_TYPES = [
  { value: "sfo", label: "🏫 Skole / SFO / Daginstitution" },
  { value: "forening", label: "⚽ Forening / Sportsklub" },
  { value: "butik", label: "🏪 Butik / Virksomhed" },
  { value: "andet", label: "🏢 Andet" },
] as const;

type BetaState = "idle" | "submitting" | "done" | "error";

function BetaSignupSection() {
  const { ref, inView } = useInView();
  const [state, setState] = useState<BetaState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    org_type: "sfo" as "sfo" | "forening" | "butik" | "andet",
    org_name: "",
    role: "",
    message: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email) return;
    setState("submitting");
    setErrorMsg("");
    try {
      await submitBetaSignup({
        data: {
          name: form.name,
          email: form.email,
          org_type: form.org_type,
          org_name: form.org_name || undefined,
          role: form.role || undefined,
          message: form.message || undefined,
        },
      });
      setState("done");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Noget gik galt. Prøv igen.");
      setState("error");
    }
  };

  return (
    <section className="border-y border-border/50 bg-surface/20 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">

          {/* Left — pitch */}
          <div
            ref={ref}
            className={`transition-all duration-700 ${inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"}`}
          >
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              🚀 Vi er i gang — bliv en af de første
            </div>
            <h2 className="font-display text-3xl font-bold sm:text-4xl">
              Vil du være med til<br />
              <span className="bg-gradient-primary bg-clip-text text-transparent">at forme Tilstede?</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Vi er nye og har endnu ingen kunder — og det er præcis derfor vi søger
              <strong className="text-foreground"> dig</strong>. Bliv pilotbruger og få:
            </p>
            <ul className="mt-5 space-y-3">
              {[
                { emoji: "🆓", text: "6 måneder gratis adgang til Pro-planen" },
                { emoji: "🎯", text: "Direkte indflydelse på hvilke funktioner vi bygger" },
                { emoji: "🇩🇰", text: "Personlig onboarding på dansk — vi hjælper dig i gang" },
                { emoji: "⭐", text: "For evigt rabat som early adopter, når vi lancerer fuldt" },
              ].map((item) => (
                <li key={item.text} className="flex items-start gap-3 text-sm">
                  <span className="text-xl leading-tight">{item.emoji}</span>
                  <span className="text-foreground/90">{item.text}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              Vi kontakter dig inden for 48 timer. Ingen forpligtelse.
            </p>
          </div>

          {/* Right — form */}
          <div
            className={`transition-all duration-700 delay-200 ${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"}`}
          >
            {state === "done" ? (
              <div className="glass rounded-3xl p-8 text-center">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-success/15 text-4xl">
                  🎉
                </div>
                <h3 className="font-display text-2xl font-bold">Tak — vi glæder os!</h3>
                <p className="mt-3 text-muted-foreground">
                  Vi har modtaget din tilmelding og kontakter dig inden for 48 timer.
                </p>
                <p className="mt-5 text-sm font-semibold text-primary">
                  Velkommen ombord, {form.name.split(" ")[0]}!
                </p>
              </div>
            ) : (
              <form onSubmit={submit} className="glass rounded-3xl p-6 sm:p-8 space-y-4">
                <h3 className="font-display text-xl font-bold">Ja tak, jeg vil testes!</h3>
                <p className="text-sm text-muted-foreground">
                  Udfyld formularen — vi er i kontakt inden for 48 timer.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Dit navn *</label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => set("name", e.target.value)}
                      placeholder="Mads Hansen"
                      required
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-ring focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">E-mail *</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set("email", e.target.value)}
                      placeholder="mads@sfo.dk"
                      required
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-ring focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Din type organisation *</label>
                    <select
                      value={form.org_type}
                      onChange={(e) => set("org_type", e.target.value as any)}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-ring focus:outline-none"
                    >
                      {ORG_TYPES.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Navn på organisation</label>
                    <input
                      type="text"
                      value={form.org_name}
                      onChange={(e) => set("org_name", e.target.value)}
                      placeholder="Nakskov SFO"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-ring focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Din rolle</label>
                    <input
                      type="text"
                      value={form.role}
                      onChange={(e) => set("role", e.target.value)}
                      placeholder="Leder, frivillig, ejer…"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-ring focus:outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Hvad er dit største problem med fremmøde i dag? (valgfrit)</label>
                    <textarea
                      value={form.message}
                      onChange={(e) => set("message", e.target.value)}
                      rows={3}
                      placeholder="Vi bruger Excel og det er et rod…"
                      className="w-full resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-ring focus:outline-none"
                    />
                  </div>
                </div>

                {state === "error" && (
                  <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={state === "submitting" || !form.name || !form.email}
                  className="w-full rounded-xl bg-gradient-primary py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
                >
                  {state === "submitting" ? "Sender…" : "Tilmeld mig som pilotbruger →"}
                </button>
                <p className="text-center text-xs text-muted-foreground">
                  Vi deler aldrig dine oplysninger med tredjeparter.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Pain → Solution ──────────────────────────────────────────────────────────

function PainSolution() {
  const { ref, inView } = useInView();

  const steps = [
    {
      emoji: "❌",
      label: "FØR Tilstede",
      bg: "border-destructive/20 bg-destructive/5",
      title: "Papirslister og Excel-vagter",
      body: "Glemte blyanter, forældede lister og ingen ved hvem der mangler — eller hvornår vagten slutter.",
    },
    {
      emoji: "✅",
      label: "MED Tilstede",
      bg: "border-success/20 bg-success/5",
      title: "Overblik på din telefon",
      body: "Alle børn og medarbejdere tjekket ind på sekunder. Realtidsopdatering på tværs af hele teamet.",
    },
    {
      emoji: "⚡",
      label: "KOM I GANG",
      bg: "border-primary/20 bg-primary/5",
      title: "5 minutter til I er live",
      body: "Opret din organisation, inviter personalet, og start med fremmøde — ingen IT-afdeling nødvendig.",
    },
  ];

  return (
    <section id="funktioner" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-14 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Sådan gør Tilstede din hverdag lettere
          </h2>
          <p className="mt-3 text-muted-foreground">Fra kaos til overblik — på under 5 minutter.</p>
        </div>

        <div
          ref={ref}
          className="grid gap-6 md:grid-cols-3"
        >
          {steps.map((s, i) => (
            <div
              key={s.label}
              className={`rounded-2xl border p-6 transition-all duration-700 ${s.bg} ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className="mb-4 text-3xl">{s.emoji}</div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{s.label}</p>
              <h3 className="mb-2 font-display text-lg font-bold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Feature branche tabs ─────────────────────────────────────────────────────

type BrancheTab = "sfo" | "forening" | "butik";

function AppMockup({ type }: { type: BrancheTab }) {
  if (type === "sfo") {
    return (
      <div className="glass rounded-2xl p-4 font-sans text-xs">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">Fremmøde — mandag</span>
          <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">Live</span>
        </div>
        <div className="mb-2 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-success/10 py-2"><p className="text-lg font-bold text-success">18</p><p className="text-[10px] text-muted-foreground">Til stede</p></div>
          <div className="rounded-xl bg-amber-500/10 py-2"><p className="text-lg font-bold text-amber-500">4</p><p className="text-[10px] text-muted-foreground">Mangler</p></div>
          <div className="rounded-xl bg-muted py-2"><p className="text-lg font-bold">3</p><p className="text-[10px] text-muted-foreground">Hjem</p></div>
        </div>
        {[
          { name: "Emma L.", status: "ind", time: "08:14" },
          { name: "Lucas P.", status: "ind", time: "08:17" },
          { name: "Sofie N.", status: "hjem", time: "13:30" },
          { name: "Oliver H.", status: "mangler", time: "" },
        ].map((c) => (
          <div key={c.name} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface">
            <div className={`h-2 w-2 shrink-0 rounded-full ${c.status === "ind" ? "bg-success" : c.status === "hjem" ? "bg-amber-500" : "bg-muted-foreground/30"}`} />
            <span className="flex-1 font-medium">{c.name}</span>
            <span className="text-muted-foreground">{c.time || "—"}</span>
          </div>
        ))}
      </div>
    );
  }
  if (type === "forening") {
    return (
      <div className="glass rounded-2xl p-4 font-sans text-xs">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold">Træningsmøde — tirsdag</span>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">QR aktiv</span>
        </div>
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
          <QrCode className="h-10 w-10 text-primary" />
          <div>
            <p className="font-semibold">Scan ved indgangen</p>
            <p className="text-muted-foreground">Medlemmer tjekker selv ind</p>
          </div>
        </div>
        {[
          { name: "Mads K.", hold: "U14 drenge", time: "18:02" },
          { name: "Julie R.", hold: "U14 piger", time: "18:05" },
          { name: "Thomas B.", hold: "Senior", time: "18:11" },
          { name: "Anna S.", hold: "U14 piger", time: "18:14" },
        ].map((m) => (
          <div key={m.name} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface">
            <LogIn className="h-3 w-3 text-success" />
            <span className="flex-1 font-medium">{m.name}</span>
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{m.hold}</span>
            <span className="text-muted-foreground">{m.time}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="glass rounded-2xl p-4 font-sans text-xs">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-semibold">Vagtplan — denne uge</span>
        <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">Publiceret</span>
      </div>
      <div className="mb-2 grid grid-cols-3 gap-1.5 text-center text-[10px]">
        {["Man", "Tir", "Ons", "Tor", "Fre", "Lør"].map((d, i) => (
          <div key={d} className={`rounded-lg py-1.5 ${i === 2 ? "bg-primary/20 font-semibold text-primary" : "bg-muted text-muted-foreground"}`}>
            <p>{d}</p>
            <p className="font-semibold">{12 + i}</p>
          </div>
        ))}
      </div>
      {[
        { name: "Mia T.", shift: "08:00–16:00", status: "ind" },
        { name: "Jonas L.", shift: "12:00–20:00", status: "venter" },
        { name: "Sara B.", shift: "08:00–14:00", status: "ud" },
      ].map((e) => (
        <div key={e.name} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
          <div className={`h-2 w-2 shrink-0 rounded-full ${e.status === "ind" ? "bg-success" : e.status === "ud" ? "bg-muted-foreground/40" : "bg-amber-500"}`} />
          <span className="flex-1 font-medium">{e.name}</span>
          <span className="font-mono text-muted-foreground">{e.shift}</span>
        </div>
      ))}
    </div>
  );
}

const TABS: { id: BrancheTab; label: string; emoji: string }[] = [
  { id: "sfo", label: "Skole & SFO", emoji: "🏫" },
  { id: "forening", label: "Forening & Klub", emoji: "⚽" },
  { id: "butik", label: "Butik & Virksomhed", emoji: "🏪" },
];

const TAB_CONTENT: Record<BrancheTab, { features: { icon: React.ElementType; title: string; body: string }[] }> = {
  sfo: {
    features: [
      { icon: Users, title: "Fremmøde på sekunder", body: "Se hvem der er mødt op, hvem der mangler og hvem der er sendt hjem — alt i realtid. Hele teamet ser den samme liste." },
      { icon: CheckCircle2, title: "Luk dagen med ét klik", body: "Arkivér dagens fremmøde automatisk. Al historik gemt og søgbar til enhver tid — klar til dokumentation og forældrekontakt." },
      { icon: BarChart3, title: "Aktiviteter og grupper", body: "Organiser børn i klasser og grupper. Tildel aktiviteter og hold styr på deltagelse med et simpelt overblik." },
    ],
  },
  forening: {
    features: [
      { icon: QrCode, title: "Medlemsfremmøde via QR", body: "Hæng en QR-kode op ved indgangen. Medlemmer tjekker selv ind til træning — du ser det i realtid på din telefon." },
      { icon: BarChart3, title: "Aktivitetsoversigt", body: "Hold styr på hvilke aktiviteter der er populære og hvem der deltager. Nem dokumentation til kommunen." },
      { icon: Users, title: "Simpel administration", body: "Tilføj medlemmer, opret hold og se historik — alt fra din telefon. Ingen IT-afdeling nødvendig." },
    ],
  },
  butik: {
    features: [
      { icon: Calendar, title: "Vagtplan der virker", body: "Planlæg vagter, publicér til personalet og se hvem der møder op — alt i ét system uden WhatsApp-grupper." },
      { icon: QrCode, title: "QR og PIN check-in", body: "Hæng en QR-kode op ved indgangen. Personale tjekker selv ind — du ser det i realtid med tidsstempler." },
      { icon: Clock, title: "Overblik over personalet", body: "Se hvem der er mødt ind, hvem der er på vej og hvem der ikke har vist op. Tidsregistrering klar til løn." },
    ],
  },
};

function BrancheTabs() {
  const [active, setActive] = useState<BrancheTab>("sfo");
  const [prevActive, setPrevActive] = useState<BrancheTab | null>(null);
  const [fading, setFading] = useState(false);
  const { ref, inView } = useInView();

  const switchTab = useCallback((id: BrancheTab) => {
    if (id === active) return;
    setFading(true);
    setTimeout(() => {
      setPrevActive(active);
      setActive(id);
      setFading(false);
    }, 180);
  }, [active]);

  const content = TAB_CONTENT[active];

  return (
    <section id="brancher" className="py-20 md:py-28" ref={ref}>
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            Tilstede passer til din organisation
          </h2>
          <p className="mt-3 text-muted-foreground">
            Vælg din type — sproget og funktionerne tilpasses automatisk.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="mb-10 flex justify-center">
          <div className="glass inline-flex gap-1 rounded-2xl p-1.5">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                  active === t.id
                    ? "bg-gradient-primary text-primary-foreground shadow-soft"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.emoji} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div
          className="transition-opacity duration-200"
          style={{ opacity: fading ? 0 : 1 }}
        >
          <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-12">
            {/* Features list */}
            <div className="space-y-5">
              {content.features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className={`flex gap-4 rounded-2xl border border-border/50 bg-surface/40 p-5 transition-all duration-500 ${
                      inView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6"
                    }`}
                    style={{ transitionDelay: `${i * 100}ms` }}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold">{f.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Mockup */}
            <div
              className={`transition-all duration-500 ${inView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"}`}
              style={{ transitionDelay: "200ms" }}
            >
              <AppMockup type={active} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatNumber({ target, suffix = "", active }: { target: number; suffix?: string; active: boolean }) {
  const val = useCounter(target, active);
  return <span>{val}{suffix}</span>;
}

function StatsBar() {
  const { ref, inView } = useInView(0.3);
  const stats = [
    { value: 5, suffix: " min", label: "Gennemsnitlig opsætningstid" },
    { value: 100, suffix: "%", label: "Dansk support" },
    { value: 7, suffix: " dage", label: "Gratis prøveperiode" },
    { value: 0, suffix: " kr", label: "Opstartsgebyr" },
  ];

  return (
    <section className="border-y border-border/50 bg-surface/20 py-16">
      <div ref={ref} className="mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`text-center transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <p className="font-display text-4xl font-bold text-primary sm:text-5xl">
                <StatNumber target={s.value} suffix={s.suffix} active={inView} />
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Testimonials replaced by BetaSignupSection above — add real quotes here when collected

// ─── Pricing teaser ───────────────────────────────────────────────────────────

const PLANS = [
  {
    id: "basis",
    name: "Basis",
    price: 299,
    tagline: "Op til 50 medlemmer · 1 lokation",
    highlight: false,
    features: ["Op til 50 deltagere", "1 lokation", "QR & PIN check-in", "Fremmødehistorik", "Dansk support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 599,
    tagline: "Ubegrænset medlemmer · Op til 3 lokationer",
    highlight: true,
    features: ["Ubegrænsede deltagere", "Op til 3 lokationer", "Vagtplan", "Aktiviteter & grupper", "Prioriteret support"],
  },
  {
    id: "organisation",
    name: "Organisation",
    price: 1199,
    tagline: "Ubegrænset alt · Prioriteret support",
    highlight: false,
    features: ["Ubegrænset alt", "Ubegrænsede lokationer", "Tidlig adgang til nye funktioner", "Dedikeret support", "SLA-garanti"],
  },
];

function PricingTeaser() {
  const { ref, inView } = useInView();
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-4 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Enkel og gennemsigtig prissætning</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Alle priser ekskl. moms · Ingen binding · Opsig når som helst
          </p>
        </div>

        <div ref={ref} className="mt-10 grid gap-5 md:grid-cols-3">
          {PLANS.map((p, i) => (
            <div
              key={p.id}
              className={`relative rounded-2xl p-6 transition-all duration-700 ${
                p.highlight
                  ? "border-primary/40 bg-gradient-primary shadow-glow scale-[1.02]"
                  : "glass"
              } ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              {p.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-primary/40 bg-primary px-3 py-0.5 text-[11px] font-bold text-primary-foreground shadow-glow">
                  Mest populær
                </div>
              )}
              <p className={`text-sm font-semibold ${p.highlight ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{p.name}</p>
              <div className="mt-2 flex items-baseline gap-1">
                <span className={`font-display text-4xl font-bold ${p.highlight ? "text-primary-foreground" : ""}`}>{p.price}</span>
                <span className={`text-sm ${p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>kr/md</span>
              </div>
              <p className={`mt-1 text-xs ${p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{p.tagline}</p>

              <ul className="mt-5 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className={`flex items-center gap-2 text-sm ${p.highlight ? "text-primary-foreground/90" : ""}`}>
                    <CheckCircle2 className={`h-4 w-4 shrink-0 ${p.highlight ? "text-primary-foreground" : "text-success"}`} />
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to="/signup"
                search={{ plan: p.id }}
                className={`mt-6 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold transition hover:opacity-90 ${
                  p.highlight
                    ? "bg-primary-foreground text-primary"
                    : "bg-gradient-primary text-primary-foreground shadow-glow"
                }`}
                data-cta={`pricing-${p.id}`}
                onClick={() => trackCta(`pricing-${p.id}`)}
              >
                Start gratis →
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          Stor organisation eller kommune?{" "}
          <a href="mailto:support@tilstede.live" className="font-semibold text-primary hover:underline">
            Kontakt os for et tilbud →
          </a>
        </p>
      </div>
    </section>
  );
}

// ─── Security trust ───────────────────────────────────────────────────────────

const TRUST = [
  { emoji: "🔒", title: "GDPR-sikret", body: "Alle data behandles i overensstemmelse med GDPR. Dansk databehandleraftale tilgængelig på forespørgsel." },
  { emoji: "🇩🇰", title: "Dansk support", body: "Vi er et dansk produkt med dansk support. Ring eller skriv — vi svarer samme dag." },
  { emoji: "☁️", title: "Sikker infrastruktur", body: "Hostet på Supabase og Vercel med SOC 2-certificering og krypteret datatransmission." },
  { emoji: "📋", title: "Fuld historik", body: "Al fremmøde og aktivitet gemmes sikkert og er søgbar til enhver tid." },
];

function SecuritySection() {
  const { ref, inView } = useInView();
  return (
    <section className="border-t border-border/50 bg-surface/20 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Bygget til dansk lovgivning</h2>
          <p className="mt-3 text-muted-foreground">Sikkerhed og compliance er ikke et eftertanke — det er fundamentet.</p>
        </div>
        <div ref={ref} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((t, i) => (
            <div
              key={t.title}
              className={`glass rounded-2xl p-6 transition-all duration-700 ${
                inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              }`}
              style={{ transitionDelay: `${i * 100}ms` }}
            >
              <div className="mb-3 text-3xl">{t.emoji}</div>
              <h3 className="mb-2 font-display font-semibold">{t.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{t.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "Kræver det installation?",
    a: "Nej. Tilstede er en web-app — åbn den i browseren på din telefon, tablet eller computer. Ingen download nødvendig.",
  },
  {
    q: "Kan jeg prøve det gratis?",
    a: "Ja, alle organisationer får 7 dages fuld adgang gratis. Ingen kreditkort krævet.",
  },
  {
    q: "Hvad sker der efter prøveperioden?",
    a: "Du vælger det abonnement der passer dig, eller du opsiger uden binding og ingen betaling.",
  },
  {
    q: "Er Tilstede GDPR-compliant?",
    a: "Ja. Vi behandler alle data i overensstemmelse med GDPR og kan levere en databehandleraftale til din organisation.",
  },
  {
    q: "Virker det til både SFO og sportsklubber?",
    a: "Ja. Tilstede tilpasser sig din organisationstype og taler dit sprog — børn, medlemmer eller medarbejdere.",
  },
  {
    q: "Hvad med kommuner og større organisationer?",
    a: "Kontakt os på support@tilstede.live for en skræddersyet aftale med SLA og prioriteret support.",
  },
];

function FaqSection() {
  const { ref, inView } = useInView();
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Ofte stillede spørgsmål</h2>
        </div>
        <div
          ref={ref}
          className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
        >
          <Accordion.Root type="single" collapsible className="space-y-2">
            {FAQS.map((faq) => (
              <Accordion.Item
                key={faq.q}
                value={faq.q}
                className="glass overflow-hidden rounded-2xl border border-border/50"
              >
                <Accordion.Header>
                  <Accordion.Trigger className="group flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold transition hover:text-primary [&[data-state=open]>svg]:rotate-180">
                    {faq.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300" />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                  <p className="px-5 pb-5 leading-relaxed text-muted-foreground">{faq.a}</p>
                </Accordion.Content>
              </Accordion.Item>
            ))}
          </Accordion.Root>
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────

function FinalCta() {
  const { ref, inView } = useInView();
  return (
    <section className="relative overflow-hidden py-24 md:py-36">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/8" />
      <div className="pointer-events-none absolute left-1/4 top-0 h-[400px] w-[400px] rounded-full bg-primary/15 blur-[100px]" />

      <div
        ref={ref}
        className={`relative mx-auto max-w-3xl px-6 text-center transition-all duration-1000 ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
        }`}
      >
        <h2 className="font-display text-4xl font-bold sm:text-5xl md:text-6xl">
          Klar til at prøve{" "}
          <span className="bg-gradient-primary bg-clip-text text-transparent">Tilstede?</span>
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-lg text-muted-foreground">
          Kom i gang på 5 minutter. Gratis i 7 dage. Ingen kreditkort.
        </p>
        <div className="mt-10">
          <CtaButton label="Opret gratis konto →" tracking="final-cta" size="lg" />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-5 text-sm text-muted-foreground">
          {["Ingen binding", "Dansk support", "GDPR-sikret"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-success" /> {t}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border/50 bg-surface/20 py-12">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-8 flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">Tilstede</span>
          </Link>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <a href="#funktioner" className="hover:text-foreground transition">Funktioner</a>
            <Link to="/priser" className="hover:text-foreground transition">Priser</Link>
            <a href="#brancher" className="hover:text-foreground transition">Brancher</a>
            <Link to="/privatlivspolitik" className="hover:text-foreground transition">Privatlivspolitik</Link>
            <Link to="/sikkerhed" className="hover:text-foreground transition">Sikkerhed</Link>
            <a href="mailto:support@tilstede.live" className="hover:text-foreground transition">Om os</a>
          </nav>
        </div>
        <div className="border-t border-border/50 pt-6 text-center text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Tilstede · <a href="mailto:support@tilstede.live" className="hover:text-foreground transition">support@tilstede.live</a> · <a href="tel:+4581446660" className="hover:text-foreground transition">+45 81 44 66 60</a></p>
          <p className="mt-1 opacity-50">Tilstede er udviklet og drevet af FPH · CVR: 43252771 · Violvej 11, 1 – 4900 Nakskov</p>
        </div>
      </div>
    </footer>
  );
}

// ─── JSON-LD structured data ──────────────────────────────────────────────────

const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Tilstede",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Fremmødesystem til SFO'er, sportsklubber og virksomheder. Hold styr på fremmøde, vagtplaner og tjek ind.",
  "offers": {
    "@type": "AggregateOffer",
    "priceCurrency": "DKK",
    "lowPrice": "299",
    "highPrice": "1199",
    "offerCount": "3",
  },
  "provider": {
    "@type": "Organization",
    "name": "FPH",
    "url": "https://tilstede.live",
    "contactPoint": {
      "@type": "ContactPoint",
      "email": "support@tilstede.live",
      "telephone": "+4581446660",
      "contactType": "customer support",
      "availableLanguage": "Danish",
    },
  },
  "featureList": [
    "Live fremmøde i realtid",
    "QR-kode og PIN check-in",
    "Vagtplan og personaleoversigt",
    "Aktiviteter og grupper",
    "GDPR-compliant datalagring",
    "Fremmødehistorik og arkiv",
  ],
  "inLanguage": "da",
});

// ─── Page ─────────────────────────────────────────────────────────────────────

function Forside() {
  return (
    <>
      {/* Structured data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON_LD }}
      />

      <div className="min-h-screen">
        <Nav />
        <main>
          <Hero />
          <BetaSignupSection />
          <PainSolution />
          <BrancheTabs />
          <StatsBar />
          <PricingTeaser />
          <SecuritySection />
          <FaqSection />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </>
  );
}
