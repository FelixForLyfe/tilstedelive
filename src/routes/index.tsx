import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import * as Accordion from "@radix-ui/react-accordion";
import { submitReview, listApprovedReviews, type PublicReview } from "@/server/reviews.functions";
import {
  CheckCircle2,
  ChevronDown,
  Menu,
  X,
  Sparkles,
  Star,
  MapPin,
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
  try { (window as any).gtag?.("event", "cta_click", { cta_location: location }); } catch {}
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
      setVal(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [active, target, duration]);
  return val;
}

function useRotating(items: string[], ms: number) {
  const [idx, setIdx] = useState(0);
  const [fade, setFade] = useState(true);
  useEffect(() => {
    const t = setInterval(() => {
      setFade(false);
      setTimeout(() => { setIdx((i) => (i + 1) % items.length); setFade(true); }, 350);
    }, ms);
    return () => clearInterval(t);
  }, [items.length, ms]);
  return { text: items[idx], fade };
}

// ─── CTA Button ───────────────────────────────────────────────────────────────

function CtaButton({ label = "Start 7 dages gratis prøve →", tracking, size = "default" }: {
  label?: string; tracking: string; size?: "default" | "lg";
}) {
  const cls = size === "lg"
    ? "inline-flex items-center gap-2 rounded-2xl bg-gradient-primary px-10 py-5 text-xl font-bold text-primary-foreground shadow-glow transition hover:scale-[1.03] hover:shadow-[0_20px_60px_-10px_oklch(0.72_0.18_195_/_0.55)] active:scale-[0.98]"
    : "inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02] hover:opacity-95 active:scale-[0.98]";
  return (
    <Link to="/signup" search={{ plan: undefined }} className={cls}
      data-cta={tracking} onClick={() => trackCta(tracking)}>
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
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? "border-b border-border/50 bg-background/80 backdrop-blur-xl shadow-card" : "bg-transparent"
    }`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Tilstede</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          <a href="#funktioner" className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">Funktioner</a>
          <a href="#brancher" className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">Brancher</a>
          <Link to="/priser" className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground">Priser</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login/personale" className="hidden rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition hover:text-foreground md:inline-flex">Log ind</Link>
          <Link to="/signup" search={{ plan: undefined }}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02] hover:opacity-95"
            data-cta="nav-cta" onClick={() => trackCta("nav-cta")}>
            Start gratis
          </Link>
          <button className="ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground md:hidden"
            onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
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

// ─── Graphic 1: Status screen mockup ─────────────────────────────────────────

const STATUS_MEMBERS = [
  { name: "Emma Hansen", first: "Emma", initials: "EH", color: "oklch(0.65 0.20 320)" },
  { name: "Lucas Petersen", first: "Lucas", initials: "LP", color: "oklch(0.72 0.18 250)" },
  { name: "Sofie Nielsen", first: "Sofie", initials: "SN", color: "oklch(0.72 0.18 195)" },
  { name: "Oliver Madsen", first: "Oliver", initials: "OM", color: "oklch(0.80 0.16 75)" },
  { name: "Ida Christensen", first: "Ida", initials: "IC", color: "oklch(0.65 0.23 25)" },
];
const STATUS_TIMES = ["08:15", "08:22", "08:34", "08:41", ""];

function StatusMockup() {
  // step 0 = [Emma,Lucas] present; step 1 = +Sofie; step 2 = +Oliver; then reset
  const [step, setStep] = useState(0);
  const [flipping, setFlipping] = useState<number | null>(null);

  const isPresent = (i: number) => i === 0 || i === 1 || (i === 2 && step >= 1) || (i === 3 && step >= 2);
  const presentCount = STATUS_MEMBERS.filter((_, i) => isPresent(i)).length;

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    if (step === 0) {
      t = setTimeout(() => {
        setFlipping(2);
        setTimeout(() => { setFlipping(null); setStep(1); }, 550);
      }, 2200);
    } else if (step === 1) {
      t = setTimeout(() => {
        setFlipping(3);
        setTimeout(() => { setFlipping(null); setStep(2); }, 550);
      }, 2200);
    } else {
      t = setTimeout(() => setStep(0), 2800);
    }
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="relative mx-auto select-none" style={{ width: 258 }}>
      <div className="absolute inset-0 -z-10 scale-[1.15] rounded-[3rem] blur-3xl"
        style={{ background: "oklch(0.72 0.18 195 / 0.22)" }} />
      {/* Phone shell */}
      <div style={{
        background: "oklch(0.12 0.02 260)",
        borderRadius: 44,
        padding: 10,
        boxShadow: "0 32px 72px -16px rgba(0,0,0,0.75), inset 0 0 0 1px oklch(1 0 0 / 0.08)",
      }}>
        {/* Screen */}
        <div style={{
          background: "var(--background)",
          borderRadius: 36,
          overflow: "hidden",
          minHeight: 500,
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Notch */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 28,
            background: "oklch(0.12 0.02 260)", borderRadius: "0 0 16px 16px", marginBottom: 2 }}>
            <div style={{ width: 60, height: 6, background: "oklch(0.25 0.02 260)", borderRadius: 6 }} />
          </div>
          {/* App content */}
          <div style={{ padding: "4px 12px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--foreground)", letterSpacing: "-0.02em" }}>Status</div>
                <div style={{ fontSize: 9.5, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Mandag 13. maj</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "oklch(0.72 0.18 150 / 0.15)",
                borderRadius: 20, padding: "3px 8px" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)", animation: "absentPulse 1.8s ease-in-out infinite" }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: "var(--success)" }}>Live</span>
              </div>
            </div>
            {/* Counter cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
              <div style={{ background: "var(--surface)", borderRadius: 14, padding: "9px 11px",
                border: "1px solid oklch(0.72 0.18 150 / 0.3)", transition: "all 0.4s" }}>
                <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "var(--font-display)", color: "var(--success)",
                  lineHeight: 1, transition: "all 0.5s" }}>{presentCount}</div>
                <div style={{ fontSize: 9, color: "var(--muted-foreground)", marginTop: 2 }}>Til stede</div>
              </div>
              <div style={{ background: "var(--surface)", borderRadius: 14, padding: "9px 11px",
                border: "1px solid oklch(0.65 0.23 25 / 0.25)", transition: "all 0.4s" }}>
                <div style={{ fontSize: 26, fontWeight: 900, fontFamily: "var(--font-display)", color: "var(--destructive)",
                  lineHeight: 1, transition: "all 0.5s" }}>{STATUS_MEMBERS.length - presentCount}</div>
                <div style={{ fontSize: 9, color: "var(--muted-foreground)", marginTop: 2 }}>Mangler</div>
              </div>
            </div>
            {/* Member cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {STATUS_MEMBERS.map((m, i) => {
                const present = isPresent(i);
                const isFlipping = flipping === i;
                const isLastAbsent = i === 4 && !present;
                return (
                  <div key={m.name} style={{
                    background: isFlipping ? "oklch(0.72 0.18 150 / 0.12)" : "color-mix(in oklab, var(--surface) 80%, transparent)",
                    borderRadius: 13,
                    padding: "8px 9px",
                    border: `1px solid ${present ? "oklch(0.72 0.18 150 / 0.35)" : isFlipping ? "oklch(0.72 0.18 150 / 0.3)" : "oklch(0.65 0.23 25 / 0.2)"}`,
                    backdropFilter: "blur(8px)",
                    transition: "border-color 0.45s, background 0.45s",
                    animation: isLastAbsent ? "absentPulse 2s ease-in-out infinite" : "none",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: "50%",
                        background: m.color, display: "flex", alignItems: "center",
                        justifyContent: "center", fontSize: 8, fontWeight: 700, color: "white", flexShrink: 0,
                      }}>{m.initials}</div>
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--foreground)",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.first}</span>
                    </div>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 3,
                      borderRadius: 20, padding: "2px 6px",
                      background: present ? "oklch(0.72 0.18 150 / 0.15)" : "oklch(0.65 0.23 25 / 0.15)",
                      transition: "background 0.45s",
                    }}>
                      <div style={{ width: 5, height: 5, borderRadius: "50%",
                        background: present ? "var(--success)" : "var(--destructive)",
                        transition: "background 0.45s",
                      }} />
                      <span style={{ fontSize: 8.5, fontWeight: 600,
                        color: present ? "var(--success)" : "var(--destructive)",
                        transition: "color 0.45s",
                      }}>{present ? "Til stede" : "Mangler"}</span>
                    </div>
                    {present && STATUS_TIMES[i] && (
                      <div style={{ fontSize: 8, color: "var(--muted-foreground)", marginTop: 3 }}>
                        · ind {STATUS_TIMES[i]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Graphic 2: QR check-in mockup ────────────────────────────────────────────

type QRPhase = "idle" | "entering" | "scanning" | "success";

function QRMockup() {
  const [phase, setPhase] = useState<QRPhase>("idle");

  useEffect(() => {
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    let t3: ReturnType<typeof setTimeout>;
    let t4: ReturnType<typeof setTimeout>;

    const run = () => {
      setPhase("idle");
      t1 = setTimeout(() => setPhase("entering"), 1400);
      t2 = setTimeout(() => setPhase("scanning"), 2100);
      t3 = setTimeout(() => setPhase("success"), 3100);
      t4 = setTimeout(run, 5800);
    };
    run();
    return () => { [t1, t2, t3, t4].forEach(clearTimeout); };
  }, []);

  return (
    <div className="relative mx-auto select-none" style={{ width: 258 }}>
      <div className="absolute inset-0 -z-10 scale-[1.15] rounded-[3rem] blur-3xl"
        style={{ background: "oklch(0.72 0.18 195 / 0.2)" }} />
      <div style={{
        background: "oklch(0.12 0.02 260)", borderRadius: 44, padding: 10,
        boxShadow: "0 32px 72px -16px rgba(0,0,0,0.75), inset 0 0 0 1px oklch(1 0 0 / 0.08)",
      }}>
        <div style={{ background: "var(--background)", borderRadius: 36, overflow: "hidden", minHeight: 500 }}>
          {/* Notch */}
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 28,
            background: "oklch(0.12 0.02 260)", borderRadius: "0 0 16px 16px", marginBottom: 2 }}>
            <div style={{ width: 60, height: 6, background: "oklch(0.25 0.02 260)", borderRadius: 6 }} />
          </div>

          {phase === "success" ? (
            // Success screen
            <div className="animate-mockup-in" style={{ padding: "20px 20px 24px", display: "flex", flexDirection: "column", alignItems: "center", minHeight: 460 }}>
              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--foreground)",
                alignSelf: "flex-start", marginBottom: 28, letterSpacing: "-0.02em" }}>Tjek ind</div>
              <div style={{ width: 72, height: 72, borderRadius: 22, background: "oklch(0.72 0.18 150 / 0.15)",
                display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="oklch(0.72 0.18 150)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--foreground)", marginBottom: 8 }}>Tjekket ind ✓</div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--muted-foreground)", marginBottom: 6 }}>
                <MapPin style={{ width: 11, height: 11 }} />
                Hoveddøren
              </div>
              <div style={{ marginTop: 16, background: "var(--surface)", borderRadius: 16, padding: "14px 18px", width: "100%", textAlign: "center" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)" }}>God vagt, Magnus! 👋</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>Tjekket ind kl. 08:03</div>
              </div>
              <div style={{ marginTop: 20, width: "100%", padding: "12px", background: "var(--gradient-primary)",
                borderRadius: 14, textAlign: "center", fontSize: 12, fontWeight: 700, color: "oklch(0.15 0.02 260)" }}>
                Tjek ud →
              </div>
            </div>
          ) : (
            // Scanner view
            <div style={{ padding: "8px 20px 20px", display: "flex", flexDirection: "column", minHeight: 460 }}>
              <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--foreground)",
                marginBottom: 10, letterSpacing: "-0.02em" }}>Tjek ind</div>
              <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginBottom: 14, display: "flex", alignItems: "center", gap: 4 }}>
                <MapPin style={{ width: 10, height: 10 }} /> Hoveddøren
              </div>
              {/* Scanner frame */}
              <div style={{ position: "relative", flex: 1, background: "oklch(0.10 0.015 260)",
                borderRadius: 16, overflow: "hidden", minHeight: 200 }}>
                {/* Corner marks */}
                {[
                  { top: 12, left: 12, borderTop: "2.5px solid var(--primary)", borderLeft: "2.5px solid var(--primary)", borderRadius: "6px 0 0 0" },
                  { top: 12, right: 12, borderTop: "2.5px solid var(--primary)", borderRight: "2.5px solid var(--primary)", borderRadius: "0 6px 0 0" },
                  { bottom: 12, left: 12, borderBottom: "2.5px solid var(--primary)", borderLeft: "2.5px solid var(--primary)", borderRadius: "0 0 0 6px" },
                  { bottom: 12, right: 12, borderBottom: "2.5px solid var(--primary)", borderRight: "2.5px solid var(--primary)", borderRadius: "0 0 6px 0" },
                ].map((s, i) => (
                  <div key={i} style={{ position: "absolute", width: 22, height: 22, ...s } as React.CSSProperties} />
                ))}
                {/* QR code */}
                {(phase === "entering" || phase === "scanning") && (
                  <div className="animate-slide-up" style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%, -50%)",
                  }}>
                    <QRCodeSVG size={96} />
                  </div>
                )}
                {/* Scan line */}
                {phase === "scanning" && (
                  <div style={{
                    position: "absolute", left: 28, right: 28, height: 2,
                    background: "linear-gradient(90deg, transparent, var(--success), transparent)",
                    borderRadius: 2, animation: "scanLine 0.9s ease-in-out forwards",
                  }} />
                )}
                {/* Instruction text */}
                {phase === "idle" && (
                  <div style={{ position: "absolute", bottom: 16, left: 0, right: 0,
                    textAlign: "center", fontSize: 10, color: "oklch(0.6 0.02 260)" }}>
                    Hold QR-koden op mod kameraet
                  </div>
                )}
              </div>
              {/* PIN fallback */}
              <div style={{ marginTop: 14, textAlign: "center", fontSize: 10, color: "var(--muted-foreground)" }}>
                eller brug PIN-kode
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 10 }}>
                {["1","2","3","4","5","6","7","8","9","","0","✓"].map((k) => (
                  <div key={k} style={{
                    height: 36, borderRadius: 10, background: k === "✓" ? "var(--gradient-primary)" : "var(--surface)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: k === "✓" ? 14 : 13, fontWeight: 600,
                    color: k === "✓" ? "oklch(0.15 0.02 260)" : "var(--foreground)",
                    border: k === "" ? "none" : "1px solid var(--border)",
                  }}>{k}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QRCodeSVG({ size }: { size: number }) {
  // A realistic QR-like SVG pattern
  const s = size / 7;
  const px = (col: number, row: number, w = 1, h = 1) => (
    <rect key={`${col}-${row}`} x={col * s} y={row * s} width={w * s - 1} height={h * s - 1}
      rx={1} fill="var(--foreground)" />
  );
  const eye = (ox: number, oy: number) => [
    px(ox, oy, 3, 3),
    <rect key={`e${ox}${oy}`} x={ox * s + 2} y={oy * s + 2} width={3 * s - 5} height={3 * s - 5}
      rx={1} fill="var(--background)" />,
    <rect key={`ei${ox}${oy}`} x={ox * s + 4} y={oy * s + 4} width={s - 4} height={s - 4} fill="var(--foreground)" />,
  ];
  const data = [[1,3],[2,3],[1,4],[3,4],[4,4],[0,5],[2,5],[4,5],[3,5],[4,3],[5,1],[5,2],[6,3],[5,4],[6,5],[3,6],[5,6]];
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <rect width={size} height={size} rx={4} fill="var(--background)" />
      {...eye(0, 0)}
      {...eye(4, 0)}
      {...eye(0, 4)}
      {data.map(([c, r]) => px(c, r))}
    </svg>
  );
}

// ─── Graphic 3: Admin overview mockup ─────────────────────────────────────────

const ADMIN_MEMBERS = [
  { name: "Emma Hansen", group: "2B", status: "present", avatar: "EH", color: "oklch(0.65 0.20 320)" },
  { name: "Lucas Petersen", group: "2A", status: "present", avatar: "LP", color: "oklch(0.72 0.18 250)" },
  { name: "Sofie Nielsen", group: "2B", status: "absent", avatar: "SN", color: "oklch(0.72 0.18 195)" },
  { name: "Oliver Madsen", group: "3A", status: "present", avatar: "OM", color: "oklch(0.80 0.16 75)" },
  { name: "Ida Christensen", group: "2A", status: "absent", avatar: "IC", color: "oklch(0.65 0.23 25)" },
  { name: "Mikkel Jensen", group: "3B", status: "present", avatar: "MJ", color: "oklch(0.72 0.18 280)" },
  { name: "Laura Andersen", group: "3A", status: "absent", avatar: "LA", color: "oklch(0.65 0.20 340)" },
  { name: "Noah Thomsen", group: "2B", status: "present", avatar: "NT", color: "oklch(0.72 0.18 160)" },
];

function AdminMockup() {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const [nowPresent, setNowPresent] = useState<Set<number>>(new Set());
  const absentRows = [2, 4, 6]; // Sofie, Ida, Laura
  const [absentIdx, setAbsentIdx] = useState(0);

  useEffect(() => {
    const cycle = () => {
      const row = absentRows[absentIdx % absentRows.length];
      setHighlighted(row);
      const t1 = setTimeout(() => {
        setNowPresent((prev) => new Set([...prev, row]));
        const t2 = setTimeout(() => { setHighlighted(null); setAbsentIdx((i) => i + 1); }, 1400);
        return t2;
      }, 800);
      return t1;
    };
    const t = setTimeout(cycle, 1800);
    return () => clearTimeout(t);
  }, [absentIdx]);

  return (
    <div className="relative select-none" style={{ maxWidth: 480 }}>
      <div className="absolute inset-0 -z-10 scale-[1.08] rounded-3xl blur-3xl"
        style={{ background: "oklch(0.72 0.18 195 / 0.15)" }} />
      {/* Browser/tablet chrome */}
      <div style={{
        background: "oklch(0.12 0.02 260)", borderRadius: 20, padding: "0 0 8px",
        boxShadow: "0 24px 56px -12px rgba(0,0,0,0.7), inset 0 0 0 1px oklch(1 0 0 / 0.07)",
      }}>
        {/* Browser bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px 8px" }}>
          {["oklch(0.65 0.23 25)","oklch(0.80 0.16 75)","oklch(0.72 0.18 150)"].map((c,i) => (
            <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
          ))}
          <div style={{ flex: 1, background: "oklch(0.20 0.02 260)", borderRadius: 8, padding: "4px 10px",
            fontSize: 9, color: "oklch(0.55 0.02 260)", textAlign: "center" }}>
            tilstede.live/app/admin
          </div>
        </div>
        {/* App content */}
        <div style={{ background: "var(--background)", margin: "0 8px", borderRadius: 14,
          padding: "12px 14px", minHeight: 280 }}>
          {/* Tab bar */}
          <div style={{ display: "flex", gap: 4, padding: "6px", background: "color-mix(in oklab, var(--surface) 75%, transparent)",
            borderRadius: 14, border: "1px solid color-mix(in oklab, var(--border) 80%, transparent)",
            marginBottom: 12, backdropFilter: "blur(12px)" }}>
            {["Deltagere","Personale","Aktiviteter","Tjek ind"].map((t, i) => (
              <div key={t} style={{
                padding: "5px 10px", borderRadius: 10, fontSize: 10, fontWeight: 600,
                background: i === 0 ? "var(--gradient-primary)" : "transparent",
                color: i === 0 ? "oklch(0.15 0.02 260)" : "var(--muted-foreground)",
                boxShadow: i === 0 ? "var(--shadow-soft)" : "none",
              }}>{t}</div>
            ))}
          </div>
          {/* Table */}
          <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 0,
              padding: "6px 10px", background: "var(--surface)",
              fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em",
              color: "var(--muted-foreground)", borderBottom: "1px solid var(--border)" }}>
              <span>Navn</span>
              <span style={{ paddingRight: 24 }}>Gruppe</span>
              <span>Status</span>
            </div>
            {ADMIN_MEMBERS.map((m, i) => {
              const isPresent = m.status === "present" || nowPresent.has(i);
              return (
                <div key={m.name} style={{
                  display: "grid", gridTemplateColumns: "1fr auto auto", gap: 0,
                  padding: "7px 10px", alignItems: "center",
                  borderBottom: i < ADMIN_MEMBERS.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background 0.4s",
                  background: highlighted === i ? "oklch(0.72 0.18 195 / 0.1)" : "transparent",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: m.color,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 7.5, fontWeight: 700, color: "white", flexShrink: 0 }}>{m.avatar}</div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{m.name}</span>
                  </div>
                  <span style={{ fontSize: 9.5, color: "var(--muted-foreground)", paddingRight: 20 }}>{m.group}</span>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 3,
                    padding: "2px 7px", borderRadius: 20,
                    background: isPresent ? "oklch(0.72 0.18 150 / 0.15)" : "oklch(0.65 0.23 25 / 0.12)",
                    transition: "all 0.45s",
                  }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%",
                      background: isPresent ? "var(--success)" : "var(--destructive)",
                      transition: "background 0.45s" }} />
                    <span style={{ fontSize: 8.5, fontWeight: 600,
                      color: isPresent ? "var(--success)" : "var(--destructive)",
                      transition: "color 0.45s" }}>
                      {isPresent ? "Til stede" : "Mangler"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Graphic 4: Vagtplan mockup ───────────────────────────────────────────────

const DAYS_SHORT = ["Man","Tir","Ons","Tor","Fre","Lør","Søn"];
const VP_SHIFTS = [
  { day: 0, time: "08:00–16:00", role: "Åbningsvagt", color: "oklch(0.72 0.18 195)", names: ["Emma H.","Lucas P."], published: true },
  { day: 1, time: "12:00–20:00", role: "Lukningsvagt", color: "oklch(0.65 0.20 320)", names: ["Sofie N."], published: true },
  { day: 2, time: "08:00–14:00", role: "Morgenshift", color: "oklch(0.80 0.16 75)", names: ["Oliver M."], published: false },
  { day: 3, time: "14:00–22:00", role: "Aftenvagt", color: "oklch(0.72 0.18 150)", names: ["Ida C.","Mikkel J."], published: true },
  { day: 4, time: "10:00–18:00", role: "Dagvagt", color: "oklch(0.65 0.20 320)", names: ["Laura A."], published: false },
  { day: 5, time: "08:00–16:00", role: "Weekend", color: "oklch(0.72 0.18 280)", names: ["Noah T."], published: true },
];

function VagtplanMockup() {
  const [publishedDays, setPublishedDays] = useState(new Set([0, 1, 3, 5]));
  const [publishing, setPublishing] = useState<number | null>(null);
  const unpublishedShifts = VP_SHIFTS.filter((s) => !publishedDays.has(s.day));
  const [pubIdx, setPubIdx] = useState(0);

  useEffect(() => {
    const toPublish = VP_SHIFTS.filter((s) => !publishedDays.has(s.day));
    if (toPublish.length === 0) {
      const t = setTimeout(() => { setPublishedDays(new Set([0, 1, 3, 5])); setPubIdx(0); }, 2000);
      return () => clearTimeout(t);
    }
    const next = toPublish[pubIdx % toPublish.length];
    const t = setTimeout(() => {
      setPublishing(next.day);
      const t2 = setTimeout(() => {
        setPublishedDays((prev) => new Set([...prev, next.day]));
        setPublishing(null);
        setPubIdx((i) => i + 1);
      }, 900);
      return () => clearTimeout(t2);
    }, 2200);
    return () => clearTimeout(t);
  }, [pubIdx, publishedDays]);

  return (
    <div className="relative select-none" style={{ maxWidth: 480 }}>
      <div className="absolute inset-0 -z-10 scale-[1.08] rounded-3xl blur-3xl"
        style={{ background: "oklch(0.72 0.18 195 / 0.15)" }} />
      <div style={{
        background: "oklch(0.12 0.02 260)", borderRadius: 20, padding: "0 0 8px",
        boxShadow: "0 24px 56px -12px rgba(0,0,0,0.7), inset 0 0 0 1px oklch(1 0 0 / 0.07)",
      }}>
        {/* Browser bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px 8px" }}>
          {["oklch(0.65 0.23 25)","oklch(0.80 0.16 75)","oklch(0.72 0.18 150)"].map((c,i) => (
            <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: c }} />
          ))}
          <div style={{ flex: 1, background: "oklch(0.20 0.02 260)", borderRadius: 8, padding: "4px 10px",
            fontSize: 9, color: "oklch(0.55 0.02 260)", textAlign: "center" }}>
            tilstede.live/app/vagtplan
          </div>
        </div>
        <div style={{ background: "var(--background)", margin: "0 8px", borderRadius: 14, padding: "12px 12px", minHeight: 260 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, fontFamily: "var(--font-display)", color: "var(--foreground)" }}>Vagtplan</div>
            <div style={{ display: "flex", gap: 5 }}>
              {["Uge","Måned"].map((t, i) => (
                <div key={t} style={{ padding: "4px 9px", borderRadius: 9, fontSize: 9.5, fontWeight: 600,
                  background: i === 0 ? "var(--gradient-primary)" : "var(--surface)",
                  color: i === 0 ? "oklch(0.15 0.02 260)" : "var(--muted-foreground)" }}>{t}</div>
              ))}
            </div>
          </div>
          {/* Week grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
            {DAYS_SHORT.map((d, i) => (
              <div key={d} style={{ textAlign: "center", fontSize: 8.5, fontWeight: 600,
                color: i === 2 ? "oklch(0.15 0.02 260)" : "var(--muted-foreground)",
                background: i === 2 ? "var(--primary)" : "transparent",
                borderRadius: 8, padding: "3px 2px", marginBottom: 3 }}>
                {d}
              </div>
            ))}
            {Array.from({ length: 7 }, (_, col) => {
              const shift = VP_SHIFTS.find((s) => s.day === col);
              const isPublished = publishedDays.has(col);
              const isPublishing = publishing === col;
              return (
                <div key={col} style={{ minHeight: 70, background: "var(--surface)", borderRadius: 10, padding: 3, position: "relative" }}>
                  {shift && (
                    <div style={{
                      padding: "4px 5px",
                      borderRadius: 7,
                      borderLeft: `2.5px solid ${shift.color}`,
                      background: isPublishing
                        ? `${shift.color}20`
                        : isPublished
                          ? "oklch(0.72 0.18 150 / 0.07)"
                          : "var(--background)",
                      border: `1px solid ${isPublished ? "oklch(0.72 0.18 150 / 0.35)" : "var(--border)"}`,
                      borderLeftColor: shift.color,
                      transition: "all 0.5s",
                    }}>
                      <div style={{ fontSize: 8, fontWeight: 700, color: "var(--foreground)", lineHeight: 1.2 }}>{shift.time.split("–")[0]}</div>
                      <div style={{ fontSize: 7.5, color: "var(--muted-foreground)", marginTop: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{shift.role}</div>
                      {shift.names.map((n) => (
                        <div key={n} style={{ fontSize: 7, color: "var(--muted-foreground)", marginTop: 1.5 }}>{n}</div>
                      ))}
                      {isPublished && (
                        <div style={{ marginTop: 3, fontSize: 7, fontWeight: 700, color: "var(--success)",
                          display: "flex", alignItems: "center", gap: 2 }}>
                          <svg width="6" height="6" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
                          Publiceret
                        </div>
                      )}
                      {!isPublished && !isPublishing && (
                        <div style={{ marginTop: 3, fontSize: 7, color: "var(--muted-foreground)" }}>Kladde</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HERO_LINES = [
  "Sofie fra 2B er ikke mødt ind i dag. Forældrene venter.",
  "3 medarbejdere har ikke tjekket ind. Vagten starter snart.",
  "14 ud af 22 børn er til stede. 8 mangler stadig.",
  "Ingen ved hvem der er på arbejde lige nu.",
];

function Hero() {
  const { text: heroLine, fade } = useRotating(HERO_LINES, 3200);
  return (
    <section className="relative overflow-hidden pt-32 pb-20 md:pt-40 md:pb-28">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/5" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/12 blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — text */}
          <div className="fade-in">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border/60 bg-surface/60 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Til SFO'er · Klubber · Butikker
            </div>
            <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
              Ved du præcist hvem der er til stede —{" "}
              <span className="bg-gradient-primary bg-clip-text text-transparent">lige nu?</span>
            </h1>
            <div className="mt-5 h-14 overflow-hidden">
              <p className={`text-base text-muted-foreground italic leading-relaxed transition-opacity duration-300 ${fade ? "opacity-100" : "opacity-0"}`}>
                "{heroLine}"
              </p>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <CtaButton label="Start 7 dages gratis prøve →" tracking="hero-primary" />
              <a href="#funktioner"
                className="inline-flex items-center gap-2 rounded-xl border border-border/60 bg-surface/60 px-6 py-3 font-semibold text-foreground backdrop-blur transition hover:bg-surface-elevated">
                Se hvordan det virker ↓
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><span>🔒</span> GDPR-sikret</span>
              <span className="flex items-center gap-1.5"><span>🇩🇰</span> Dansk support</span>
              <span className="flex items-center gap-1.5"><span>⚡</span> 5 min opsætning</span>
            </div>
          </div>
          {/* Right — Graphic 1 */}
          <div className="flex justify-center lg:justify-end">
            <StatusMockup />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Problem recognition ───────────────────────────────────────────────────────

const PROBLEM_CARDS = [
  {
    emoji: "🏫",
    label: "SFO & Fritidsklub",
    problem: "Et barn er ikke hentet. Du leder i papirlisterne — men hvem har egentlig skrevet hvad i dag?",
    solutions: ["Realtids fremmøde på din telefon","Øjeblikkelig oversigt over hvem der mangler","Dokumenteret historik til forældrene"],
  },
  {
    emoji: "⚽",
    label: "Forening & Sportsklub",
    problem: "Træneren spørger hvem der er til træning. Ingen ved det. Nogen afmeldte på WhatsApp, nogen til en anden — nogen mødte bare ikke op.",
    solutions: ["Medlemsfremmøde med QR-scanning","Se hvem der er ved at droppe ud","Dokumenteret deltagelse til kommunalt tilskud"],
  },
  {
    emoji: "🏪",
    label: "Butik & Virksomhed",
    problem: "En medarbejder er ikke mødt ind. Du opdager det en time for sent. Kunden har ventet.",
    solutions: ["Vagtplan med automatisk QR check-in","Øjeblikkelig besked når nogen ikke møder ind","Overblik over hele personalets tilstedeværelse"],
  },
];

function ProblemSection() {
  const { ref, inView } = useInView();
  return (
    <section className="py-20 md:py-28" id="brancher">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Kender du det?</h2>
        </div>
        <div ref={ref} className="grid gap-6 md:grid-cols-3">
          {PROBLEM_CARDS.map((c, i) => (
            <div key={c.label} className={`glass rounded-2xl p-7 transition-all duration-700 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`} style={{ transitionDelay: `${i * 120}ms` }}>
              <div className="mb-4 text-3xl">{c.emoji}</div>
              <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">{c.label}</div>
              <p className="mb-5 text-sm italic leading-relaxed text-muted-foreground">"{c.problem}"</p>
              <ul className="space-y-2.5">
                {c.solutions.map((s) => (
                  <li key={s} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Feature sections ──────────────────────────────────────────────────────────

function FeatureSection({
  id, tag, headline, body, bullets, graphic, reverse,
}: {
  id?: string; tag: string; headline: string; body: string;
  bullets: string[]; graphic: React.ReactNode; reverse?: boolean;
}) {
  const { ref, inView } = useInView(0.1);
  return (
    <section id={id} className="py-16 md:py-24 border-t border-border/30">
      <div className="mx-auto max-w-7xl px-6">
        <div ref={ref} className={`grid items-center gap-12 lg:grid-cols-2 lg:gap-16 transition-all duration-700 ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        } ${reverse ? "lg:[&>*:first-child]:order-2 lg:[&>*:last-child]:order-1" : ""}`}>
          {/* Text */}
          <div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">{tag}</div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{headline}</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">{body}</p>
            <ul className="mt-6 space-y-3">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <CtaButton label="Prøv gratis i 7 dage →" tracking={`feature-${tag}`} />
            </div>
          </div>
          {/* Graphic */}
          <div className="flex flex-col items-center gap-3">
            {graphic}
            <p className="text-xs text-muted-foreground/60 text-center">
              Demo-grafik — den rigtige funktion er endnu bedre.{" "}
              <Link to="/signup" search={{ plan: undefined }} className="text-primary hover:underline" onClick={() => trackCta(`feature-caption-${tag}`)}>Prøv gratis →</Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

const STATS = [
  { value: 5, suffix: " min", label: "Gennemsnitlig opsætningstid" },
  { value: 7, suffix: " dage", label: "Gratis prøveperiode" },
  { value: 0, suffix: " kr", label: "Opstartsgebyr" },
  { value: 100, suffix: "%", label: "Dansk support" },
];

function StatsBar() {
  const { ref, inView } = useInView();
  const counts = STATS.map((s) => useCounter(s.value, inView));
  return (
    <section className="border-y border-border/50 bg-surface/20 py-14">
      <div ref={ref} className="mx-auto grid max-w-4xl gap-8 px-6 sm:grid-cols-4">
        {STATS.map((s, i) => (
          <div key={s.label} className="text-center">
            <div className="font-display text-4xl font-black text-primary">
              {counts[i]}{s.suffix}
            </div>
            <div className="mt-1.5 text-sm text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Reviews section ──────────────────────────────────────────────────────────

const ORG_TYPE_OPTIONS = [
  { value: "sfo", label: "SFO / Fritidsklub" },
  { value: "sportsklub", label: "Sportsklub" },
  { value: "butik", label: "Butik" },
  { value: "andet", label: "Andet" },
];

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} type="button"
          onMouseEnter={() => setHover(s)} onMouseLeave={() => setHover(0)}
          onClick={() => onChange(s)}
          className="transition hover:scale-110 active:scale-95">
          <Star className={`h-7 w-7 transition-colors ${
            s <= (hover || value) ? "text-warning fill-warning" : "text-muted"
          }`} />
        </button>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: PublicReview }) {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex gap-0.5 mb-3">
        {[1, 2, 3, 4, 5].map((s) => (
          <Star key={s} className={`h-4 w-4 ${s <= review.stars ? "text-warning fill-warning" : "text-muted"}`} />
        ))}
      </div>
      {review.review_text && (
        <p className="text-sm leading-relaxed text-foreground mb-4">"{review.review_text}"</p>
      )}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{review.name || "Anonym"}</span>
        {review.org_type && (
          <>
            <span>·</span>
            <span>{ORG_TYPE_OPTIONS.find((o) => o.value === review.org_type)?.label ?? review.org_type}</span>
          </>
        )}
        <span>·</span>
        <span>{new Date(review.created_at).toLocaleDateString("da-DK", { month: "long", year: "numeric" })}</span>
      </div>
    </div>
  );
}

function ReviewsSection() {
  const { ref, inView } = useInView();
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [stars, setStars] = useState(0);
  const [name, setName] = useState("");
  const [orgType, setOrgType] = useState("");
  const [text, setText] = useState("");
  const [gdpr, setGdpr] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    listApprovedReviews({ data: {} }).then(setReviews).catch(() => {});
  }, []);

  const canSubmit = stars > 0 && gdpr;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setState("sending");
    setErrorMsg("");
    try {
      await submitReview({
        data: {
          stars,
          name: name.trim() || undefined,
          org_type: orgType as any || undefined,
          review_text: text.trim() || undefined,
          gdpr_consent: true,
        },
      });
      setState("done");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Noget gik galt. Prøv igen.");
      setState("error");
    }
  };

  return (
    <section className="py-20 md:py-28 border-t border-border/30">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Hvad synes vores brugere?</h2>
          <p className="mt-3 text-muted-foreground">
            Vi er nye — hjælp os med at blive bedre ved at dele din oplevelse.
          </p>
        </div>

        <div ref={ref} className={`grid gap-10 lg:grid-cols-2 transition-all duration-700 ${
          inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
          {/* Submit form */}
          <div className="glass rounded-3xl p-8">
            <h3 className="font-display text-xl font-bold mb-6">Del din oplevelse</h3>
            {state === "done" ? (
              <div className="py-8 text-center">
                <div className="text-4xl mb-4">🙏</div>
                <p className="font-semibold text-foreground">Tak for din anmeldelse!</p>
                <p className="mt-2 text-sm text-muted-foreground">Den vises når vi har godkendt den.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium">Stjerner <span className="text-destructive">*</span></label>
                  <StarRating value={stars} onChange={setStars} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Dit navn (valgfrit)</label>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Anonym"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-ring focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Organisationstype</label>
                  <select value={orgType} onChange={(e) => setOrgType(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none">
                    <option value="">Vælg type…</option>
                    {ORG_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-muted-foreground">Hvad bruger du Tilstede til? (valgfrit)</label>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000}
                    placeholder="Fortæl lidt om din oplevelse…"
                    className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:border-ring focus:outline-none" />
                </div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={gdpr} onChange={(e) => setGdpr(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
                  <span className="text-xs text-muted-foreground">
                    Jeg accepterer at min anmeldelse vises offentligt på tilstede.live. Ingen e-mail indsamles.
                  </span>
                </label>
                {state === "error" && (
                  <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{errorMsg}</p>
                )}
                <button type="submit" disabled={!canSubmit || state === "sending"}
                  className="w-full rounded-xl bg-gradient-primary py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-40">
                  {state === "sending" ? "Sender…" : "Del din oplevelse →"}
                </button>
              </form>
            )}
          </div>

          {/* Display reviews */}
          <div className="flex flex-col gap-4">
            {reviews.length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
                <div className="text-4xl mb-3">⭐</div>
                <p className="font-semibold text-foreground">Ingen anmeldelser endnu</p>
                <p className="mt-1 text-sm">Vær den første!</p>
              </div>
            ) : (
              reviews.slice(0, 4).map((r) => <ReviewCard key={r.id} review={r} />)
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

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
            <div key={p.id} className={`relative rounded-2xl p-6 transition-all duration-700 ${
              p.highlight ? "border-primary/40 bg-gradient-primary shadow-glow scale-[1.02]" : "glass"
            } ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              style={{ transitionDelay: `${i * 120}ms` }}>
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
              <p className={`text-xs ${p.highlight ? "text-primary-foreground/60" : "text-muted-foreground"}`}>ekskl. moms</p>
              <p className={`mt-1 text-xs ${p.highlight ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{p.tagline}</p>
              <ul className="mt-5 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className={`flex items-center gap-2 text-sm ${p.highlight ? "text-primary-foreground/90" : ""}`}>
                    <CheckCircle2 className={`h-4 w-4 shrink-0 ${p.highlight ? "text-primary-foreground" : "text-success"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/signup" search={{ plan: p.id }}
                className={`mt-6 flex w-full items-center justify-center rounded-xl py-2.5 text-sm font-semibold transition hover:opacity-90 ${
                  p.highlight ? "bg-primary-foreground text-primary" : "bg-gradient-primary text-primary-foreground shadow-glow"
                }`} data-cta={`pricing-${p.id}`} onClick={() => trackCta(`pricing-${p.id}`)}>
                Start gratis →
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          Alle priser er ekskl. moms. Ved betaling tillægges 25% moms.
        </p>
        <p className="mt-3 text-center text-sm text-muted-foreground">
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
            <div key={t.title} className={`glass rounded-2xl p-6 transition-all duration-700 ${
              inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`} style={{ transitionDelay: `${i * 100}ms` }}>
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
  { q: "Kræver det installation?", a: "Nej. Tilstede er en web-app — åbn den i browseren på din telefon, tablet eller computer. Ingen download nødvendig." },
  { q: "Kan jeg prøve det gratis?", a: "Ja, alle organisationer får 7 dages fuld adgang gratis. Ingen kreditkort krævet." },
  { q: "Hvad sker der efter prøveperioden?", a: "Du vælger det abonnement der passer dig, eller du opsiger uden binding og ingen betaling." },
  { q: "Er Tilstede GDPR-compliant?", a: "Ja. Vi behandler alle data i overensstemmelse med GDPR og kan levere en databehandleraftale til din organisation." },
  { q: "Virker det til både SFO og sportsklubber?", a: "Ja. Tilstede tilpasser sig din organisationstype og taler dit sprog — børn, medlemmer eller medarbejdere." },
  { q: "Hvad med kommuner og større organisationer?", a: "Kontakt os på support@tilstede.live for en skræddersyet aftale med SLA og prioriteret support." },
];

function FaqSection() {
  const { ref, inView } = useInView();
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">Ofte stillede spørgsmål</h2>
        </div>
        <div ref={ref} className={`transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
          <Accordion.Root type="single" collapsible className="space-y-2">
            {FAQS.map((faq) => (
              <Accordion.Item key={faq.q} value={faq.q} className="glass overflow-hidden rounded-2xl border border-border/50">
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

const FINAL_HEADLINES = [
  "Er du SFO-leder? Start gratis i dag.",
  "Driver du en sportsklub? Start gratis i dag.",
  "Har du ansatte? Start gratis i dag.",
  "Klar til at erstatte papirlisterne? Start gratis i dag.",
];

function FinalCta() {
  const { ref, inView } = useInView();
  const { text: headline, fade } = useRotating(FINAL_HEADLINES, 4000);
  return (
    <section className="relative overflow-hidden py-24 md:py-36">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/8" />
      <div className="pointer-events-none absolute left-1/4 top-0 h-[400px] w-[400px] rounded-full bg-primary/15 blur-[100px]" />
      <div ref={ref} className={`relative mx-auto max-w-3xl px-6 text-center transition-all duration-1000 ${
        inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      }`}>
        <div className={`font-display text-4xl font-bold sm:text-5xl transition-opacity duration-300 ${fade ? "opacity-100" : "opacity-0"}`}>
          {headline}
        </div>
        <p className="mx-auto mt-5 max-w-lg text-lg text-muted-foreground">
          Tilstede er klar til brug på 5 minutter. Ingen IT-afdeling. Ingen binding. Ingen kreditkort.
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

// ─── JSON-LD ──────────────────────────────────────────────────────────────────

const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Tilstede",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "description": "Fremmødesystem til SFO'er, sportsklubber og virksomheder. Hold styr på fremmøde, vagtplaner og tjek ind.",
  "offers": { "@type": "AggregateOffer", "priceCurrency": "DKK", "lowPrice": "299", "highPrice": "1199", "offerCount": "3" },
  "provider": {
    "@type": "Organization",
    "name": "FPH",
    "url": "https://tilstede.live",
    "contactPoint": { "@type": "ContactPoint", "email": "support@tilstede.live", "telephone": "+4581446660", "contactType": "customer support", "availableLanguage": "Danish" },
  },
  "featureList": ["Live fremmøde i realtid","QR-kode og PIN check-in","Vagtplan og personaleoversigt","Aktiviteter og grupper","GDPR-compliant datalagring","Fremmødehistorik og arkiv"],
  "inLanguage": "da",
});

// ─── Page ─────────────────────────────────────────────────────────────────────

function Forside() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />
      <div className="min-h-screen">
        <Nav />
        <main>
          {/* 2. Hero */}
          <Hero />
          {/* 3. Problem recognition */}
          <ProblemSection />
          {/* 4. Feature showcase — 4 alternating sections */}
          <FeatureSection
            id="funktioner"
            tag="🏫 SFO & Fritidsklub"
            headline="Se hvem der mangler — inden det bliver et problem"
            body="Når et barn ikke er tjekket ind, ved du det med det samme. Ikke en time senere når forældrene ringer. Hele personalet ser den samme live-liste."
            bullets={[
              "Live opdatering for hele personalet",
              "Farvekodet: til stede, mangler, sendt hjem",
              "Fuld historik gemt automatisk",
              "Søgbar dokumentation ved enhver forespørgsel",
            ]}
            graphic={<StatusMockup />}
          />
          <FeatureSection
            tag="⚽ Forening & 🏪 Butik"
            headline="Tjek ind på 3 sekunder — ingen app nødvendig"
            body="Hæng en QR-kode op ved indgangen. Personale og medlemmer scanner med deres telefon og er tjekket ind. Du ser det i realtid på din skærm."
            bullets={[
              "Virker på alle telefoner uden installation",
              "QR-kode eller PIN — du vælger",
              "Øjeblikkelig bekræftelse til medarbejderen",
              "Fungerer offline og synkroniserer automatisk",
            ]}
            graphic={<QRMockup />}
            reverse
          />
          <FeatureSection
            tag="Alle organisationstyper"
            headline="Alt samlet ét sted — altid opdateret"
            body="Se dine deltagere, grupper og aktiviteter i et rent overblik. Tilføj nye, rediger og hold styr på hvem der er aktive — alt fra din telefon."
            bullets={[
              "Deltagere og grupper organiseret overskueligt",
              "Se aktivitetslog og historik per person",
              "Tilføj og inviter personale med ét klik",
              "Fungerer på telefon, tablet og computer",
            ]}
            graphic={<AdminMockup />}
          />
          <FeatureSection
            tag="🏪 Butik & Virksomhed"
            headline="Vagtplanen publiceret — på 2 minutter"
            body="Træk og slip vagter ind på kalenderen. Tryk publicer. Alle medarbejdere får besked med det samme. Ingen forvirring, ingen WhatsApp-grupper."
            bullets={[
              "Drag-and-drop kalender",
              "Automatisk besked til personalet ved publicering",
              "Se hvem der har bekræftet deres vagt",
              "Eksporter timer til lønsystem",
            ]}
            graphic={<VagtplanMockup />}
            reverse
          />
          {/* 5. Stats */}
          <StatsBar />
          {/* 6. Reviews */}
          <ReviewsSection />
          {/* 7. Pricing */}
          <PricingTeaser />
          {/* 8. Security */}
          <SecuritySection />
          {/* 9. FAQ */}
          <FaqSection />
          {/* 10. Final CTA */}
          <FinalCta />
        </main>
        <Footer />
      </div>
    </>
  );
}
