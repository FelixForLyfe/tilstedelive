import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Sparkles, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/signup/personale")({
  component: TeamSignup,
});

function TeamSignup() {
  const navigate = useNavigate();
  const { genindlaes } = useOrg();
  const [navn, setNavn] = useState("");
  const [kode, setKode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const renKode = kode.trim().toUpperCase();
    if (!renKode) {
      setLoading(false);
      toast.error("Indtast invitations-koden du har fået fra din administrator");
      return;
    }

    // 1) Opret konto
    const redirectUrl = `${window.location.origin}/login/personale`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: navn || email } },
    });
    if (error || !data.user) {
      setLoading(false);
      toast.error("Kunne ikke oprette konto", { description: error?.message });
      return;
    }

    // 2) Vent på session
    let aktivSession = null;
    for (let i = 0; i < 30; i++) {
      const { data: s } = await supabase.auth.getSession();
      if (s.session?.access_token) { aktivSession = s.session; break; }
      await new Promise((r) => setTimeout(r, 100));
    }

    if (!aktivSession) {
      setLoading(false);
      toast.success("Konto oprettet", { description: "Log ind for at indløse din invitations-kode." });
      navigate({ to: "/login/personale" });
      return;
    }

    // 3) Indløs invitations-kode
    const { error: redeemErr } = await supabase.rpc("redeem_invite", { _code: renKode });
    setLoading(false);
    if (redeemErr) {
      toast.error("Kunne ikke indløse kode", {
        description: redeemErr.message.includes("Ugyldig")
          ? "Koden er ugyldig eller udløbet. Bed din administrator om en ny kode."
          : redeemErr.message,
      });
      navigate({ to: "/app" });
      return;
    }

    await genindlaes();
    toast.success("Velkommen", { description: "Du er nu tilføjet til organisationen." });
    navigate({ to: "/app" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md fade-in">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold">Tilstede</span>
        </Link>

        <div className="glass rounded-3xl p-8 shadow-card">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
            <KeyRound className="h-3.5 w-3.5" /> Invitations-kode
          </div>
          <h1 className="font-display text-2xl font-bold">Opret din konto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Brug invitations-koden fra din administrator for at tilmelde dig organisationen.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Dit fulde navn</label>
              <input
                required
                value={navn}
                onChange={(e) => setNavn(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Invitations-kode</label>
              <input
                required
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                placeholder="Fx ABC123XY"
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm font-mono uppercase tracking-widest focus:border-ring focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Koden finder du i invitationen fra din administrator.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">E-mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Adgangskode</label>
              <PasswordInput
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Opretter konto…" : "Opret konto og tilmeld organisation"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Har du allerede en konto?{" "}
            <Link to="/login/personale" className="font-semibold text-primary hover:underline">
              Log ind
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
