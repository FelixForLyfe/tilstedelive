import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/login/admin")({
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !signIn.user) {
      setLoading(false);
      toast.error("Login fejlede", { description: "Forkert e-mail eller adgangskode." });
      return;
    }
    // Tjek at brugeren faktisk er admin i mindst én organisation
    const { data: medlem } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", signIn.user.id)
      .eq("role", "admin")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (!medlem) {
      await supabase.auth.signOut();
      setLoading(false);
      toast.error("Ingen admin-adgang", {
        description: "Denne konto er ikke admin på en organisation. Brug personale-login eller opret en organisation.",
      });
      return;
    }

    localStorage.setItem("tilstede.aktivOrgId", medlem.organization_id);
    setLoading(false);
    toast.success("Velkommen, admin");
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
          <h1 className="font-display text-2xl font-bold">Admin-login</h1>
          <p className="mt-1 text-sm text-muted-foreground">Log ind på din organisations dashboard.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">E-mail</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium">Adgangskode</label>
              <PasswordInput required value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50">
              {loading ? "Logger ind…" : "Log ind som admin"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
            <p>
              Ingen organisation endnu?{" "}
              <Link to="/signup" search={{ plan: undefined }} className="font-semibold text-primary hover:underline">Opret en</Link>
            </p>
            <p>
              Er du personale?{" "}
              <Link to="/login/personale" className="font-semibold text-primary hover:underline">Personale-login</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
