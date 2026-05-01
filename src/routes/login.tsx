import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginSide,
});

function LoginSide() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("Kunne ikke logge ind", { description: error.message });
      return;
    }
    toast.success("Velkommen tilbage");
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
          <h1 className="font-display text-2xl font-bold">Log ind</h1>
          <p className="mt-1 text-sm text-muted-foreground">Velkommen tilbage. Indtast din e-mail og adgangskode.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div>
              <label className="text-sm font-medium">E-mail</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none" />
            </div>
            <div>
              <label className="text-sm font-medium">Adgangskode</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:border-ring focus:outline-none" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50">
              {loading ? "Logger ind…" : "Log ind"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Har du ikke en konto?{" "}
            <Link to="/signup" className="font-semibold text-primary hover:underline">Opret organisation</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
