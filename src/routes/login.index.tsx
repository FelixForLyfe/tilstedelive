import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, ShieldCheck, Users } from "lucide-react";

export const Route = createFileRoute("/login/")({
  component: LoginVaelg,
});

function LoginVaelg() {
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
          <p className="mt-1 text-sm text-muted-foreground">Vælg hvilken type konto du vil logge ind med.</p>

          <div className="mt-6 grid gap-3">
            <Link to="/login/admin"
              className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:bg-surface-elevated hover:shadow-glow">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Admin / Organisation</div>
                <div className="text-xs text-muted-foreground">Adgang til admin-dashboard og styring</div>
              </div>
            </Link>
            <Link to="/login/personale"
              className="group flex items-center gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:bg-surface-elevated hover:shadow-glow">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15 text-accent">
                <Users className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="font-semibold">Medarbejder / Frivillig</div>
                <div className="text-xs text-muted-foreground">Log ind med organisationens navn og din konto</div>
              </div>
            </Link>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Ingen konto?{" "}
            <Link to="/signup" className="font-semibold text-primary hover:underline">Opret organisation</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
