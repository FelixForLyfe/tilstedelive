import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Users, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PasswordInput } from "@/components/ui/password-input";
import { trackEvent } from "@/lib/posthog";

export const Route = createFileRoute("/login/personale")({
  component: TeamLogin,
});

function TeamLogin() {
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
      trackEvent("login_failed", { method: "personale" });
      toast.error("Login fejlede", { description: "Forkert e-mail eller adgangskode." });
      return;
    }

    // Auto-select org if the user belongs to exactly one
    const { data: medlemskaber } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", signIn.user.id)
      .eq("status", "active");

    if (medlemskaber?.length === 1) {
      localStorage.setItem("tilstede.aktivOrgId", medlemskaber[0].organization_id);
    }

    setLoading(false);
    trackEvent("login_success", { method: "personale" });
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
            <Users className="h-3.5 w-3.5" /> Personale
          </div>
          <h1 className="font-display text-2xl font-bold">Log ind</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log ind med din e-mail og adgangskode.
          </p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
              {loading ? "Logger ind…" : "Log ind"}
            </button>
          </form>

          <div className="mt-6 space-y-2 text-center text-sm text-muted-foreground">
            <p>
              Ny bruger?{" "}
              <Link to="/signup/personale" className="font-semibold text-primary hover:underline">
                Opret konto
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
