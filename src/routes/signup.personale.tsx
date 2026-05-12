import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/signup/personale")({
  component: TeamSignup,
});

function TeamSignup() {
  const navigate = useNavigate();
  const [navn, setNavn] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

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

    const { data: sessionData } = await supabase.auth.getSession();
    setLoading(false);

    if (sessionData.session) {
      toast.success("Konto oprettet!", { description: "Tilføj nu din organisation med en invitations-kode." });
      navigate({ to: "/app" });
    } else {
      toast.success("Bekræft din e-mail", {
        description: "Vi har sendt dig en bekræftelsesmail. Log ind herefter.",
      });
      navigate({ to: "/login/personale" });
    }
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
          <h1 className="font-display text-2xl font-bold">Opret din konto</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Opret en gratis konto og tilknyt dig en organisation med en invitations-kode bagefter.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Dit fulde navn</label>
              <input
                required
                value={navn}
                onChange={(e) => setNavn(e.target.value)}
                placeholder="Fx Mette Jensen"
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none"
              />
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
              <p className="mt-1 text-xs text-muted-foreground">Mindst 8 tegn.</p>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Opretter konto…" : "Opret konto"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
            <p>
              Har du allerede en konto?{" "}
              <Link to="/login/personale" className="font-semibold text-primary hover:underline">
                Log ind
              </Link>
            </p>
            <p>
              Er du administrator?{" "}
              <Link to="/login/admin" className="font-semibold text-primary hover:underline">
                Admin-login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
