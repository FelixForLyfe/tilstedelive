import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, Copy, Check, Loader2, KeyRound, Smartphone, ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

type Fase = "indlaes" | "klar" | "fejl";

const trin = [
  { nr: 1, ikon: Smartphone, label: "Download autentifikator-app", tekst: "Brug Google Authenticator, Authy, 1Password eller en anden TOTP-app." },
  { nr: 2, ikon: ScanLine, label: "Scan QR-koden", tekst: "Åbn appen og scan koden herunder. Alternativt kan du indtaste nøglen manuelt." },
  { nr: 3, ikon: KeyRound, label: "Bekræft med kode", tekst: "Appen viser en 6-cifret kode der skifter hvert 30. sekund. Skriv den ind nedenfor." },
];

function Setup2FA() {
  const navigate = useNavigate();
  const [fase, setFase] = useState<Fase>("indlaes");
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [kopieret, setKopieret] = useState(false);

  useEffect(() => {
    async function start() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/login" }); return; }

      // Already fully verified — go to app
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") { navigate({ to: "/app" }); return; }

      // Already has a factor — should verify instead of re-enrol
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (factors?.totp && factors.totp.length > 0) {
        navigate({ to: "/verify-2fa" });
        return;
      }

      // Begin enrolment
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        issuer: "Tilstede",
        friendlyName: "Tilstede",
      });

      if (error || !data) {
        console.error("[setup-2fa] enroll error", error?.message);
        setFase("fejl");
        return;
      }

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setFase("klar");
    }
    start();
  }, [navigate]);

  const aktiver = async (e: FormEvent) => {
    e.preventDefault();
    if (!factorId || code.length !== 6) return;
    setLoading(true);

    const { data: challenge, error: challengeErr } =
      await supabase.auth.mfa.challenge({ factorId });

    if (challengeErr || !challenge) {
      toast.error("Kunne ikke starte verifikation. Prøv igen.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });

    if (error) {
      toast.error("Forkert kode. Prøv igen.");
      setCode("");
      setLoading(false);
      return;
    }

    toast.success("Tofaktorautentifikation aktiveret");
    navigate({ to: "/app" });
  };

  const kopierSecret = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret).catch(() => {});
    setKopieret(true);
    setTimeout(() => setKopieret(false), 2000);
  };

  if (fase === "indlaes") {
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
          {/* Header */}
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Tofaktor­autentifikation
          </div>
          <h1 className="font-display text-2xl font-bold">Opsæt 2FA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tilstede kræver tofaktorautentifikation for at beskytte følsomme data om børn og personale.
          </p>

          {/* Steps */}
          <div className="mt-6 space-y-3">
            {trin.map((t) => {
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

          {/* QR code */}
          {qrCode && (
            <div className="mt-6 flex flex-col items-center gap-3">
              <div className="rounded-2xl bg-white p-3 shadow-soft">
                <img
                  src={qrCode}
                  alt="QR-kode til autentifikator-app"
                  className="h-44 w-44 block"
                />
              </div>

              {/* Manual entry */}
              <details className="w-full">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Kan du ikke scanne? Indtast nøglen manuelt
                </summary>
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-surface/50 px-3 py-2">
                  <code className="flex-1 break-all font-mono text-xs text-primary">{secret}</code>
                  <button
                    type="button"
                    onClick={kopierSecret}
                    className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                    aria-label="Kopiér nøgle"
                  >
                    {kopieret ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </details>
            </div>
          )}

          {/* OTP input */}
          <form onSubmit={aktiver} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Bekræftelseskode fra appen</label>
              <div className="mt-2 flex justify-center">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={setCode}
                  autoFocus
                >
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

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Mister du adgang til din autentifikator-app, skal du kontakte{" "}
            <a href="mailto:support@tilstede.live" className="text-primary hover:underline">
              support@tilstede.live
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
