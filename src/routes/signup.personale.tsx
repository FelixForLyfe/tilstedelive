import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup/personale")({
  component: PersonaleSignup,
});

function PersonaleSignup() {
  const navigate = useNavigate();
  const [navn, setNavn] = useState("");
  const [orgNavn, setOrgNavn] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const redirectUrl = `${window.location.origin}/login/personale`;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: navn || email } },
    });
    if (error || !data.user) {
      setLoading(false);
      toast.error("Kunne ikke oprette konto", { description: error?.message });
      return;
    }

    setLoading(false);
    toast.success("Konto oprettet", {
      description: `Bed admin på "${orgNavn}" om at tilføje dig. Derefter kan du logge ind.`,
    });
    navigate({ to: "/login/personale" });
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
            <Users className="h-3.5 w-3.5" /> Personale
          </div>
          <h1 className="font-display text-2xl font-bold">Opret personale-konto</h1>
          <p className="mt-1 text-sm text-muted-foreground">Når kontoen er oprettet, skal en admin tilføje dig til organisationen.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Dit fulde navn</label>
              <input required value={navn} onChange={(e) => setNavn(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium">Organisationens navn</label>
              <input required value={orgNavn} onChange={(e) => setOrgNavn(e.target.value)}
                placeholder="Fx Solsikkens SFO"
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium">E-mail</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium">Adgangskode</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50">
              {loading ? "Opretter…" : "Opret konto"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Har du allerede en konto?{" "}
            <Link to="/login/personale" className="font-semibold text-primary hover:underline">Log ind</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
