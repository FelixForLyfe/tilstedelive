import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  Loader2,
  KeyRound,
  Smartphone,
  ScanLine,
  Mail,
  Download,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { generateBackupCodes } from "@/server/mfa.functions";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const Route = createFileRoute("/setup-2fa")({
  head: () => ({ meta: [{ title: "Opsæt 2FA — Tilstede" }] }),
  component: Setup2FA,
});

type Fase =
  | "indlaes"
  | "valg"
  | "opsaet-email"
  | "opsaet-totp"
  | "backup"
  | "fejl";

const TOTP_TRIN = [
  { nr: 1, ikon: Smartphone, label: "Download autentifikator-app", tekst: "Brug Google Authenticator, Authy, 1Password eller en anden TOTP-app." },
  { nr: 2, ikon: ScanLine, label: "Scan QR-koden", tekst: "Åbn appen og scan koden herunder. Alternativt kan du indtaste nøglen manuelt." },
  { nr: 3, ikon: KeyRound, label: "Bekræft med kode", tekst: "Appen viser en 6-cifret kode der skifter hvert 30. sekund. Skriv den ind nedenfor." },
];

function Setup2FA() {
  const navigate = useNavigate();

  const [fase, setFase] = useState<Fase>("indlaes");
  // TOTP state
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  // Email state
  const [emailChallengeId, setEmailChallengeId] = useState<string | null>(null);
  const [emailResendCooldown, setEmailResendCooldown] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  // Shared
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [kopieret, setKopieret] = useState(false);
  // Backup codes
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupKopieret, setBackupKopieret] = useState(false);
  const [backupBekraeftet, setBackupBekraeftet] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  useEffect(() => {
    async function start() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/login" }); return; }

      setUserEmail(session.user?.email ?? null);

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") { navigate({ to: "/app" }); return; }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const allFactors = factors?.all ?? [];
      if (allFactors.length > 0) {
        navigate({ to: "/verify-2fa" });
        return;
      }

      setFase("valg");
    }
    start();
  }, [navigate]);

  // ─── Resend countdown for email OTP ────────────────────────────────────────
  useEffect(() => {
    if (emailResendCooldown <= 0) return;
    const t = setTimeout(() => setEmailResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [emailResendCooldown]);

  // ─── Pick Email ─────────────────────────────────────────────────────────────
  const valgEmail = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "email" as any,
      issuer: "Tilstede",
    });
    if (error || !data) {
      toast.error("Kunne ikke starte email-opsætning. Prøv igen.");
      setLoading(false);
      return;
    }
    setFactorId(data.id);

    // Trigger first challenge → sends email OTP
    const { data: challenge, error: chalErr } = await supabase.auth.mfa.challenge({
      factorId: data.id,
    });
    if (chalErr || !challenge) {
      toast.error("Kunne ikke sende kode til din email. Prøv igen.");
      setLoading(false);
      return;
    }
    setEmailChallengeId(challenge.id);
    setEmailResendCooldown(60);
    setLoading(false);
    setFase("opsaet-email");
  };

  // ─── Resend email OTP ───────────────────────────────────────────────────────
  const gensendEmail = async () => {
    if (!factorId || emailResendCooldown > 0) return;
    setLoading(true);
    const { data: challenge, error } = await supabase.auth.mfa.challenge({ factorId });
    if (error || !challenge) {
      toast.error("Kunne ikke gensende kode. Prøv igen.");
    } else {
      setEmailChallengeId(challenge.id);
      setEmailResendCooldown(60);
      setCode("");
      toast.success("Ny kode sendt til din email.");
    }
    setLoading(false);
  };

  // ─── Pick TOTP ──────────────────────────────────────────────────────────────
  const valgTotp = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      issuer: "Tilstede",
      friendlyName: "Tilstede",
    });
    if (error || !data) {
      toast.error("Kunne ikke starte opsætning. Prøv igen.");
      setLoading(false);
      return;
    }
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setFactorId(data.id);
    setLoading(false);
    setFase("opsaet-totp");
  };

  // ─── Verify (shared for both methods) ──────────────────────────────────────
  const aktiver = async (e: FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setLoading(true);

    let challengeId = emailChallengeId;

    if (fase === "opsaet-totp" || !challengeId) {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr || !ch) {
        toast.error("Kunne ikke starte verifikation. Prøv igen.");
        setLoading(false);
        return;
      }
      challengeId = ch.id;
    }

    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: challengeId!, code });
    if (error) {
      toast.error("Forkert kode. Prøv igen.");
      setCode("");
      setLoading(false);
      return;
    }

    // Enrollment verified — now generate backup codes
    await visBackupKoder();
  };

  // ─── Generate and show backup codes ────────────────────────────────────────
  const visBackupKoder = async () => {
    setBackupLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session mangler.");
      const result = await generateBackupCodes({ data: { accessToken: session.access_token } });
      setBackupCodes(result.codes);
      setFase("backup");
    } catch {
      toast.error("Kunne ikke oprette backup-koder. Kontakt support.");
      navigate({ to: "/app" });
    } finally {
      setBackupLoading(false);
      setLoading(false);
    }
  };

  const kopierSecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret).catch(() => {});
    setKopieret(true);
    setTimeout(() => setKopieret(false), 2000);
  };

  const kopierBackupKoder = async () => {
    const text = backupCodes.join("\n");
    await navigator.clipboard.writeText(text).catch(() => {});
    setBackupKopieret(true);
    setTimeout(() => setBackupKopieret(false), 2000);
  };

  const downloadBackupKoder = () => {
    const content = [
      "Tilstede — Backup-koder til 2FA",
      "=================================",
      "Gem disse koder et sikkert sted.",
      "Hver kode kan kun bruges én gang.",
      "",
      ...backupCodes,
      "",
      `Genereret: ${new Date().toLocaleDateString("da-DK")}`,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tilstede-backup-koder.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (fase === "indlaes" || backupLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (fase === "fejl") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass w-full max-w-md rounded-3xl p-8 text-center shadow-card">
          <p className="text-destructive">Opsætning mislykkedes. Prøv at logge ind igen.</p>
          <Link to="/login/personale" className="mt-4 inline-block text-sm text-primary hover:underline">
            Gå til login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md fade-in">
        {/* Logo */}
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold">Tilstede</span>
        </Link>

        <div className="glass rounded-3xl p-8 shadow-card">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Tofaktor­autentifikation
          </div>

          {/* ── Step 1: Method selection ── */}
          {fase === "valg" && (
            <>
              <h1 className="font-display text-2xl font-bold">Aktivér 2FA</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Vælg din foretrukne metode til tofaktor-godkendelse.
              </p>

              <div className="mt-6 space-y-3">
                <button
                  onClick={valgEmail}
                  disabled={loading}
                  className="flex w-full items-start gap-4 rounded-2xl border border-border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">Email-kode</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Modtag en 6-cifret engangskode på din email.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {userEmail ?? "Din tilknyttede email"}
                    </p>
                  </div>
                </button>

                <button
                  onClick={valgTotp}
                  disabled={loading}
                  className="flex w-full items-start gap-4 rounded-2xl border border-border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-primary/5 disabled:opacity-50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                    <Smartphone className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold">Autentifikator-app</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Brug Google Authenticator, Microsoft Authenticator eller lignende.
                    </p>
                  </div>
                </button>
              </div>

              {loading && (
                <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Forbereder opsætning…
                </div>
              )}
            </>
          )}

          {/* ── Step 2a: Email OTP setup ── */}
          {fase === "opsaet-email" && (
            <>
              <h1 className="font-display text-2xl font-bold">Bekræft email</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Vi har sendt en 6-cifret kode til{" "}
                <span className="font-medium text-foreground">{userEmail}</span>.
              </p>

              <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 p-3">
                <Mail className="h-4 w-4 shrink-0 text-primary" />
                <p className="text-xs text-muted-foreground">
                  Tjek din indbakke — koden udløber om 10 minutter.
                </p>
              </div>

              <form onSubmit={aktiver} className="mt-5 space-y-4">
                <div>
                  <label className="text-sm font-medium">6-cifret kode fra email</label>
                  <div className="mt-2 flex justify-center">
                    <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="h-12 w-11 text-lg" />
                        <InputOTPSlot index={1} className="h-12 w-11 text-lg" />
                        <InputOTPSlot index={2} className="h-12 w-11 text-lg" />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} className="h-12 w-11 text-lg" />
                        <InputOTPSlot index={4} className="h-12 w-11 text-lg" />
                        <InputOTPSlot index={5} className="h-12 w-11 text-lg" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full rounded-xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Bekræfter…
                    </span>
                  ) : (
                    "Bekræft kode"
                  )}
                </button>
              </form>

              <button
                type="button"
                onClick={gensendEmail}
                disabled={loading || emailResendCooldown > 0}
                className="mt-3 w-full rounded-xl py-2 text-sm text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                {emailResendCooldown > 0
                  ? `Gensend om ${emailResendCooldown}s`
                  : "Send koden igen"}
              </button>

              <button
                type="button"
                onClick={() => { setFase("valg"); setCode(""); setFactorId(null); setEmailChallengeId(null); }}
                className="mt-1 w-full rounded-xl py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                ← Vælg en anden metode
              </button>
            </>
          )}

          {/* ── Step 2b: TOTP setup ── */}
          {fase === "opsaet-totp" && (
            <>
              <h1 className="font-display text-2xl font-bold">Opsæt 2FA</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Tilstede kræver tofaktorautentifikation for at beskytte følsomme data.
              </p>

              <div className="mt-5 space-y-3">
                {TOTP_TRIN.map((t) => {
                  const Icon = t.ikon;
                  return (
                    <div key={t.nr} className="flex items-start gap-3 rounded-xl bg-surface/50 p-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-xs font-bold text-primary-foreground">
                        {t.nr}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{t.label}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{t.tekst}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {qrCode && (
                <div className="mt-6 flex flex-col items-center gap-3">
                  <div className="rounded-2xl bg-white p-3 shadow-soft">
                    <img src={qrCode} alt="QR-kode til autentifikator-app" className="h-44 w-44 block" />
                  </div>
                  <details className="w-full">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      Kan du ikke scanne? Indtast nøglen manuelt
                    </summary>
                    <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface/50 px-3 py-2">
                      <code className="flex-1 break-all font-mono text-xs text-primary">{secret}</code>
                      <button type="button" onClick={kopierSecret}
                        className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                        aria-label="Kopiér nøgle">
                        {kopieret ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </details>
                </div>
              )}

              <form onSubmit={aktiver} className="mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium">Bekræftelseskode fra appen</label>
                  <div className="mt-2 flex justify-center">
                    <InputOTP maxLength={6} value={code} onChange={setCode} autoFocus>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} className="h-12 w-11 text-lg" />
                        <InputOTPSlot index={1} className="h-12 w-11 text-lg" />
                        <InputOTPSlot index={2} className="h-12 w-11 text-lg" />
                      </InputOTPGroup>
                      <InputOTPSeparator />
                      <InputOTPGroup>
                        <InputOTPSlot index={3} className="h-12 w-11 text-lg" />
                        <InputOTPSlot index={4} className="h-12 w-11 text-lg" />
                        <InputOTPSlot index={5} className="h-12 w-11 text-lg" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || code.length !== 6}
                  className="w-full rounded-xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Aktiverer…
                    </span>
                  ) : (
                    "Aktivér tofaktorautentifikation"
                  )}
                </button>
              </form>

              <button
                type="button"
                onClick={() => { setFase("valg"); setCode(""); setFactorId(null); setQrCode(null); setSecret(null); }}
                className="mt-3 w-full rounded-xl py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                ← Vælg en anden metode
              </button>
            </>
          )}

          {/* ── Step 3: Backup codes ── */}
          {fase === "backup" && (
            <>
              <h1 className="font-display text-2xl font-bold">Gem dine backup-koder</h1>

              <div className="mt-3 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/8 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-warning-foreground">
                  <strong>Disse koder vises kun én gang.</strong> Gem dem et sikkert sted — du kan ikke gendanne dem, hvis du mister dem.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {backupCodes.map((c) => (
                  <div key={c} className="rounded-lg border border-border bg-surface px-3 py-2 text-center font-mono text-sm tracking-widest text-foreground">
                    {c}
                  </div>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={kopierBackupKoder}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm transition hover:bg-surface"
                >
                  {backupKopieret ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  {backupKopieret ? "Kopieret!" : "Kopiér alle"}
                </button>
                <button
                  type="button"
                  onClick={downloadBackupKoder}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5 text-sm transition hover:bg-surface"
                >
                  <Download className="h-4 w-4" />
                  Download .txt
                </button>
              </div>

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface/40 p-3">
                <input
                  type="checkbox"
                  checked={backupBekraeftet}
                  onChange={(e) => setBackupBekraeftet(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                />
                <span className="text-sm leading-snug">
                  Jeg har gemt mine backup-koder et sikkert sted
                </span>
              </label>

              <button
                type="button"
                disabled={!backupBekraeftet}
                onClick={() => navigate({ to: "/app" })}
                className="mt-4 w-full rounded-xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-40"
              >
                Gå til appen →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
