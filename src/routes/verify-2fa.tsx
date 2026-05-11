import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, Loader2, KeyRound, Mail, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { verifyBackupCode } from "@/server/mfa.functions";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export const Route = createFileRoute("/verify-2fa")({
  head: () => ({ meta: [{ title: "Bekræft 2FA — Tilstede" }] }),
  component: Verify2FA,
});

type Metode = "totp" | "email";

function Verify2FA() {
  const navigate = useNavigate();

  const [klar, setKlar] = useState(false);
  const [metode, setMetode] = useState<Metode>("totp");
  const [hasBegge, setHasBegge] = useState(false);
  const [totpFactorId, setTotpFactorId] = useState<string | null>(null);
  const [emailFactorId, setEmailFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  // Backup code mode
  const [visBackup, setVisBackup] = useState(false);
  const [backupKode, setBackupKode] = useState("");
  const [backupLoading, setBackupLoading] = useState(false);

  // Email resend cooldown
  const [resendCooldown, setResendCooldown] = useState(0);

  // ─── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function start() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/login" }); return; }

      setUserEmail(session.user?.email ?? null);

      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") { navigate({ to: "/app" }); return; }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      const allFactors = (factors as any)?.all ?? [];

      const totp = allFactors.find((f: any) => f.factor_type === "totp");
      const email = allFactors.find((f: any) => f.factor_type === "email");

      if (!totp && !email) {
        navigate({ to: "/setup-2fa" });
        return;
      }

      setTotpFactorId(totp?.id ?? null);
      setEmailFactorId(email?.id ?? null);
      setHasBegge(!!(totp && email));

      // Default to TOTP if available, otherwise email
      const valgtMetode: Metode = totp ? "totp" : "email";
      setMetode(valgtMetode);

      // For email: auto-send challenge on load
      if (valgtMetode === "email" && email) {
        await sendEmailChallenge(email.id);
      }

      setKlar(true);
    }
    start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // ─── Resend countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ─── Email challenge helpers ─────────────────────────────────────────────────
  async function sendEmailChallenge(fId: string) {
    const { data: ch, error } = await supabase.auth.mfa.challenge({ factorId: fId });
    if (error || !ch) {
      toast.error("Kunne ikke sende kode. Prøv igen.");
      return;
    }
    setChallengeId(ch.id);
    setResendCooldown(60);
  }

  const skiftTilEmail = async () => {
    if (!emailFactorId) return;
    setMetode("email");
    setCode("");
    setChallengeId(null);
    await sendEmailChallenge(emailFactorId);
  };

  const skiftTilTotp = () => {
    setMetode("totp");
    setCode("");
    setChallengeId(null);
  };

  const gensend = async () => {
    if (!emailFactorId || resendCooldown > 0 || loading) return;
    setLoading(true);
    await sendEmailChallenge(emailFactorId);
    setCode("");
    toast.success("Ny kode sendt.");
    setLoading(false);
  };

  // ─── Verify OTP ─────────────────────────────────────────────────────────────
  const bekræft = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);

    const factorId = metode === "totp" ? totpFactorId : emailFactorId;
    if (!factorId) { setLoading(false); return; }

    let chalId = challengeId;
    if (metode === "totp" || !chalId) {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr || !ch) {
        toast.error("Kunne ikke starte verifikation. Prøv igen.");
        setLoading(false);
        return;
      }
      chalId = ch.id;
    }

    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId: chalId!, code });
    if (error) {
      toast.error("Forkert kode. Prøv igen.");
      setCode("");
      setLoading(false);
      return;
    }

    navigate({ to: "/app" });
  };

  // ─── Verify backup code ──────────────────────────────────────────────────────
  const bekræftBackup = async (e: FormEvent) => {
    e.preventDefault();
    if (!backupKode.trim()) return;
    setBackupLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session mangler.");

      await verifyBackupCode({ data: { accessToken: session.access_token, code: backupKode.trim() } });

      // Refresh session: all factors were deleted server-side, so aal1 is now sufficient
      await supabase.auth.refreshSession();
      toast.success("Backup-kode godkendt. 2FA er midlertidigt deaktiveret — opsæt det igen for fuld sikkerhed.");
      navigate({ to: "/app" });
    } catch (err: any) {
      toast.error(err?.message ?? "Ugyldig backup-kode.");
      setBackupLoading(false);
    }
  };

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (!klar) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm fade-in">
        {/* Logo */}
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold">Tilstede</span>
        </Link>

        <div className="glass rounded-3xl p-8 shadow-card">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Tofaktorautentifikation
          </div>

          {/* ── Backup code mode ── */}
          {visBackup ? (
            <>
              <h1 className="font-display text-2xl font-bold">Brug backup-kode</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Indtast en af dine 8-tegns backup-koder.
              </p>

              <form onSubmit={bekræftBackup} className="mt-6 space-y-4">
                <input
                  type="text"
                  value={backupKode}
                  onChange={(e) => setBackupKode(e.target.value.toUpperCase())}
                  placeholder="ABCDE-FGHIJ"
                  autoFocus
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 font-mono text-center text-lg tracking-widest placeholder:text-sm placeholder:tracking-normal focus:border-ring focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={backupLoading || !backupKode.trim()}
                  className="w-full rounded-xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
                >
                  {backupLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Tjekker…
                    </span>
                  ) : (
                    "Brug backup-kode"
                  )}
                </button>
              </form>

              <button
                type="button"
                onClick={() => { setVisBackup(false); setBackupKode(""); }}
                className="mt-3 w-full rounded-xl py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                ← Brug min 2FA-metode i stedet
              </button>
            </>
          ) : (
            <>
              {/* ── TOTP mode ── */}
              {metode === "totp" && (
                <>
                  <h1 className="font-display text-2xl font-bold">Bekræft din identitet</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Åbn din autentifikator-app og indtast den 6-cifrede kode.
                  </p>

                  <div className="mt-4 flex items-center gap-3 rounded-xl bg-surface/50 p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary">
                      <KeyRound className="h-4 w-4 text-primary-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Koden skifter hvert 30. sekund. Brug den nyeste kode fra appen.
                    </p>
                  </div>

                  <form onSubmit={bekræft} className="mt-6 space-y-4">
                    <div>
                      <label className="text-sm font-medium">Kode fra autentifikator-app</label>
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
                        "Bekræft og fortsæt"
                      )}
                    </button>
                  </form>

                  {hasBegge && emailFactorId && (
                    <button
                      type="button"
                      onClick={skiftTilEmail}
                      className="mt-3 w-full rounded-xl py-2 text-sm text-primary hover:underline"
                    >
                      <Mail className="mr-1 inline h-3.5 w-3.5" />
                      Modtag kode på email i stedet
                    </button>
                  )}
                </>
              )}

              {/* ── Email mode ── */}
              {metode === "email" && (
                <>
                  <h1 className="font-display text-2xl font-bold">Tjek din email</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Vi har sendt en 6-cifret kode til{" "}
                    <span className="font-medium text-foreground">{userEmail}</span>.
                  </p>

                  <div className="mt-4 flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/20 p-3">
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                    <p className="text-xs text-muted-foreground">
                      Koden udløber om 10 minutter.
                    </p>
                  </div>

                  <form onSubmit={bekræft} className="mt-5 space-y-4">
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
                        "Bekræft og fortsæt"
                      )}
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={gensend}
                    disabled={loading || resendCooldown > 0}
                    className="mt-3 w-full rounded-xl py-2 text-sm text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RefreshCw className="mr-1 inline h-3.5 w-3.5" />
                    {resendCooldown > 0 ? `Gensend om ${resendCooldown}s` : "Send koden igen"}
                  </button>

                  {hasBegge && totpFactorId && (
                    <button
                      type="button"
                      onClick={skiftTilTotp}
                      className="mt-1 w-full rounded-xl py-2 text-sm text-muted-foreground hover:text-foreground"
                    >
                      Brug autentifikator-app i stedet
                    </button>
                  )}
                </>
              )}

              {/* Backup code link */}
              <button
                type="button"
                onClick={() => { setVisBackup(true); setCode(""); }}
                className="mt-4 w-full rounded-xl py-2 text-xs text-muted-foreground hover:text-foreground"
              >
                Brug en backup-kode i stedet →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
