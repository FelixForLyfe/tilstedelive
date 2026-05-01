import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/signup/")({
  component: SignupSide,
});

function SignupSide() {
  const navigate = useNavigate();
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

    const redirectUrl = `${window.location.origin}/login/admin`;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: redirectUrl, data: { full_name: navn || email } },
    });
    if (error) {
      setLoading(false);
      toast.error("Kunne ikke oprette konto", { description: error.message });
      return;
    }

    // Sørg for at sessionen er aktiv FØR vi skriver til DB (RLS bruger auth.uid())
    let userId = data.user?.id;
    if (!data.session) {
      // Auto-confirm er slået til, så vi kan logge ind direkte
      const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
      if (signInErr || !signIn.user) {
        setLoading(false);
        toast.error("Konto oprettet, men kunne ikke logge ind", { description: signInErr?.message });
        navigate({ to: "/login/admin" });
        return;
      }
      userId = signIn.user.id;
    }

    if (!userId) {
      setLoading(false);
      toast.error("Noget gik galt – prøv at logge ind");
      return;
    }

    // Vent til Supabase-klienten har en aktiv session (auth-header sættes async)
    let aktivSession = null;
    for (let i = 0; i < 20; i++) {
      const { data: s } = await supabase.auth.getSession();
      if (s.session?.access_token) { aktivSession = s.session; break; }
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!aktivSession) {
      setLoading(false);
      toast.error("Kunne ikke etablere session – prøv at logge ind");
      navigate({ to: "/login/admin" });
      return;
    }

    // Tjek om navnet allerede findes blandt brugerens orgs (sjælden race ved retry)
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .insert({ name: orgNavn.trim(), created_by: userId })
      .select("id, name").single();
    if (orgErr || !org) {
      setLoading(false);
      toast.error("Kunne ikke oprette organisationen", { description: orgErr?.message });
      return;
    }
    const { error: memErr } = await supabase
      .from("organization_members")
      .insert({ organization_id: org.id, user_id: userId, role: "admin", status: "active" });
    if (memErr) {
      setLoading(false);
      toast.error("Kunne ikke koble dig til organisationen", { description: memErr.message });
      return;
    }
    localStorage.setItem("tilstede.aktivOrgId", org.id);
    setLoading(false);
    toast.success(`Velkommen! "${org.name}" er klar.`);
    navigate({ to: "/app/admin" });
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
          <p className="mt-1 text-sm text-muted-foreground">Du bliver admin på et nyt dashboard som dit personale kan logge ind på.</p>

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
              <p className="mt-1 text-xs text-muted-foreground">Personalet bruger dette navn når de logger ind.</p>
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
              {loading ? "Opretter…" : "Opret organisation"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
            <p>
              Har du allerede en organisation?{" "}
              <Link to="/login/admin" className="font-semibold text-primary hover:underline">Admin-login</Link>
            </p>
            <p>
              Er du personale?{" "}
              <Link to="/signup/personale" className="font-semibold text-primary hover:underline">Opret personale-konto</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
