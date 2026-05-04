import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createOrganizationAdmin } from "@/server/organization.functions";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/signup/")({
  component: SignupSide,
});

function SignupSide() {
  const navigate = useNavigate();
  const opretOrganisation = useServerFn(createOrganizationAdmin);
  const [navn, setNavn] = useState("");
  const [orgNavn, setOrgNavn] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!orgNavn.trim()) {
      toast.error("Angiv navn på din organisation");
      return;
    }
    setLoading(true);

    try {
      const org = await opretOrganisation({
        data: { fullName: navn || email, orgName: orgNavn.trim(), email, password },
      });
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr) throw signInErr;

      localStorage.setItem("tilstede.aktivOrgId", org.organizationId);
      navigate({ to: "/app/admin" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Prøv igen om lidt.";
      toast.error("Kunne ikke oprette organisation", { description: message });
    } finally {
      setLoading(false);
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
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> Admin
          </div>
          <h1 className="font-display text-2xl font-bold">Opret organisation</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Du bliver admin på et nyt dashboard som dit personale kan logge ind på.
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
              <label className="text-sm font-medium">Organisationens navn</label>
              <input
                required
                value={orgNavn}
                onChange={(e) => setOrgNavn(e.target.value)}
                placeholder="Fx Solsikkens SFO"
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Personalet bruger dette navn når de logger ind.
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
              {loading ? "Opretter…" : "Opret organisation"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
            <p>
              Har du allerede en organisation?{" "}
              <Link to="/login/admin" className="font-semibold text-primary hover:underline">
                Admin-login
              </Link>
            </p>
            <p>
              Er du personale?{" "}
              <Link to="/signup/personale" className="font-semibold text-primary hover:underline">
                Opret personale-konto
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
