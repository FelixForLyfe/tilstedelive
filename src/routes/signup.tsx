import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup")({
  component: SignupSide,
});

type Mode = "admin" | "employee";

function SignupSide() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("admin");
  const [navn, setNavn] = useState("");
  const [orgNavn, setOrgNavn] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === "admin" && !orgNavn.trim()) {
      toast.error("Angiv navn på din organisation");
      return;
    }
    setLoading(true);

    const redirectUrl = `${window.location.origin}/app`;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: navn || email } },
    });
    if (error) {
      setLoading(false);
      toast.error("Kunne ikke oprette konto", { description: error.message });
      return;
    }
    if (!data.session) {
      setLoading(false);
      toast.success("Konto oprettet", { description: "Bekræft din e-mail og log derefter ind." });
      navigate({ to: "/login" });
      return;
    }

    if (mode === "admin") {
      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .insert({ name: orgNavn.trim(), created_by: data.user!.id })
        .select("id").single();
      if (orgErr || !org) {
        setLoading(false);
        toast.error("Konto oprettet, men organisation fejlede", { description: orgErr?.message });
        return;
      }
      const { error: memErr } = await supabase
        .from("organization_members")
        .insert({ organization_id: org.id, user_id: data.user!.id, role: "admin", status: "active" });
      if (memErr) {
        setLoading(false);
        toast.error("Kunne ikke koble dig til organisationen", { description: memErr.message });
        return;
      }
      localStorage.setItem("tilstede.aktivOrgId", org.id);
    }

    toast.success(mode === "admin" ? "Velkommen! Din organisation er klar." : "Konto oprettet – afventer at en admin tilføjer dig");
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
          <h1 className="font-display text-2xl font-bold">Opret konto</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vælg om du opretter en organisation eller registrerer dig som personale.</p>

          <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-surface p-1">
            <button type="button" onClick={() => setMode("admin")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "admin" ? "bg-gradient-primary text-primary-foreground shadow-soft" : "text-muted-foreground"}`}>
              Admin / Opret organisation
            </button>
            <button type="button" onClick={() => setMode("employee")}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mode === "employee" ? "bg-gradient-primary text-primary-foreground shadow-soft" : "text-muted-foreground"}`}>
              Personale
            </button>
          </div>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">Dit fulde navn</label>
              <input required value={navn} onChange={(e) => setNavn(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none" />
            </div>
            {mode === "admin" && (
              <div>
                <label className="text-sm font-medium">Organisationens navn</label>
                <input required value={orgNavn} onChange={(e) => setOrgNavn(e.target.value)}
                  placeholder="Fx Solsikkens SFO"
                  className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none" />
              </div>
            )}
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

            {mode === "employee" && (
              <p className="rounded-xl border border-border bg-surface/60 p-3 text-xs text-muted-foreground">
                Din konto oprettes uden adgang til en organisation. En admin skal tilføje dig før du kan se fremmøde.
              </p>
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50">
              {loading ? "Opretter…" : "Opret konto"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Har du allerede en konto?{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">Log ind</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
