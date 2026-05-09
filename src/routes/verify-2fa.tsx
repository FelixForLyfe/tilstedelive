import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ShieldCheck, Sparkles, Loader2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

function Verify2FA() {
  const navigate = useNavigate();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [klar, setKlar] = useState(false);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function start() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/login" }); return; }

      // Already verified — go to app
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.currentLevel === "aal2") { navigate({ to: "/app" }); return; }

      // No factor enrolled — needs setup first
      const { data: factors } = await supabase.auth.mfa.listFactors();
      if (!factors?.totp || factors.totp.length === 0) {
        navigate({ to: "/setup-2fa" });
        return;
      }

      setFactorId(factors.totp[0].id);
      setKlar(true);
    }
    start();
  }, [navigate]);

  const bekræft = async (e: FormEvent) => {
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

    navigate({ to: "/app" });
  };

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
          {/* Header */}
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Tofaktorautentifikation
          </div>
          <h1 className="font-display text-2xl font-bold">Bekræft din identitet</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Åbn din autentifikator-app og indtast den 6-cifrede kode.
          </p>

          <div className="mt-5 flex items-center gap-3 rounded-xl bg-surface/50 p-3">
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
                  <Loader2 className="h-4 w-4 animate-spin" /> Bekræfter…
                </span>
              ) : (
                "Bekræft og fortsæt"
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Mistet adgang til din autentifikator-app?{" "}
            <a href="mailto:support@tilstede.live" className="text-primary hover:underline">
              Kontakt support
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
