import { createFileRoute, Link, Outlet, useNavigate, useRouterState, redirect } from "@tanstack/react-router";

import { Home, Activity, Clock, ShieldCheck, Archive, LogOut, Sparkles, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });

    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      throw redirect({ to: "/verify-2fa" });
    }
    if (aal?.nextLevel === "aal1" && aal.currentLevel === "aal1") {
      throw redirect({ to: "/setup-2fa" });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { user, logUd } = useAuth();
  const { medlemskaber, aktivOrg, aktivOrgId, vaelgOrg, erAdmin, loading } = useOrg();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });

  // Begge roller (admin + personale) lander på status-siden, hvor man tjekker børn ind/ud.

  const handleLogout = async () => {
    await logUd();
    navigate({ to: "/" });
  };

  const navItems = [
    { to: "/app", label: "Status", icon: Home, exact: true },
    { to: "/app/aktiviteter", label: "Aktiviteter", icon: Activity },
    { to: "/app/logning", label: "Logning", icon: Clock },
    ...(erAdmin ? [
      { to: "/app/arkiv", label: "Arkiv", icon: Archive },
      { to: "/app/admin", label: "Admin", icon: ShieldCheck },
    ] : []),
  ];

  const erAktiv = (to: string, exact?: boolean) => exact ? path === to : path.startsWith(to);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Indlæser…</div>;
  }

  if (!aktivOrgId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass max-w-md rounded-3xl p-8 text-center">
          <h2 className="font-display text-xl font-bold">Ingen organisation</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Din konto er ikke koblet til en organisation endnu. Bed en admin om at tilføje dig, eller opret din egen organisation.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={handleLogout} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">Log ud</button>
            <Link to="/signup" className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Opret organisation</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <Link to="/app" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="hidden font-display text-lg font-bold sm:inline">Tilstede</span>
          </Link>

          <div className="flex flex-1 items-center justify-end gap-2">
            {medlemskaber.length > 1 ? (
              <div className="relative">
                <select
                  value={aktivOrgId}
                  onChange={(e) => vaelgOrg(e.target.value)}
                  className="appearance-none rounded-xl border border-border bg-surface py-2 pl-3 pr-9 text-sm font-medium focus:border-ring focus:outline-none"
                >
                  {medlemskaber.map((m) => (
                    <option key={m.organization_id} value={m.organization_id}>
                      {m.organizations?.name ?? "Organisation"}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            ) : (
              <span className="hidden rounded-xl bg-surface px-3 py-2 text-sm font-medium md:inline">{aktivOrg?.organizations?.name}</span>
            )}

            <span className="hidden rounded-full bg-surface px-3 py-1 text-xs text-muted-foreground sm:inline">
              {erAdmin ? "Admin" : "Personale"} · {user?.email}
            </span>

            <button onClick={handleLogout} title="Log ud"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-surface text-muted-foreground hover:text-foreground">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 fade-in">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl">
        <div className="container mx-auto grid max-w-2xl grid-cols-5 gap-1 px-2 py-2">
          {navItems.map((it) => {
            const Icon = it.icon;
            const aktiv = erAktiv(it.to, it.exact);
            return (
              <Link key={it.to} to={it.to}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-medium transition ${
                  aktiv ? "bg-gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:text-foreground"
                }`}>
                <Icon className="h-5 w-5" />
                {it.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
