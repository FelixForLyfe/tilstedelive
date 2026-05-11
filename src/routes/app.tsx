import { useState } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Home, Activity, Clock, ShieldCheck, Archive, LogOut, Sparkles, ChevronDown, ChevronRight, CreditCard, Settings, QrCode } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg, type BlockReason } from "@/contexts/OrgContext";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { createBillingPortalSession } from "@/server/stripe.functions";

export const Route = createFileRoute("/app")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });

    // Only enforce 2FA verification when the user has enrolled a factor (nextLevel = aal2)
    // but hasn't verified it in this session yet.
    // Do NOT redirect to setup-2fa here — aal1/aal1 is the normal state for users without MFA.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      throw redirect({ to: "/verify-2fa" });
    }
  },
  component: AppLayout,
});

function TrialBanner({ daysLeft }: { daysLeft: number }) {
  const urgent = daysLeft <= 3;
  return (
    <div className={`px-4 py-2.5 text-center text-sm font-medium ${
      urgent
        ? "bg-destructive/10 border-b border-destructive/20 text-destructive"
        : "bg-amber-500/10 border-b border-amber-500/20 text-amber-800 dark:text-amber-400"
    }`}>
      {urgent ? "⚠️" : "⏳"}{" "}
      Du har <strong>{daysLeft} {daysLeft === 1 ? "dag" : "dage"}</strong> tilbage af din 7-dages gratis prøveperiode.{" "}
      <Link to="/priser" className="underline hover:opacity-80">Vælg en plan →</Link>
    </div>
  );
}

function Paywall({
  reason,
  erAdmin,
  onBillingPortal,
  billingLoading,
}: {
  reason: BlockReason;
  erAdmin: boolean;
  onBillingPortal: () => Promise<void>;
  billingLoading: boolean;
}) {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="glass w-full max-w-lg rounded-3xl p-10 text-center shadow-card fade-in">
        {reason === "trial_expired" && (
          <>
            <div className="mb-4 text-5xl">⏰</div>
            <h2 className="font-display text-2xl font-bold">Din prøveperiode er udløbet</h2>
            <p className="mt-3 text-muted-foreground">
              Din 30 dages gratis prøveperiode er slut. Vælg en plan for at fortsætte med at bruge Tilstede.
            </p>
          </>
        )}
        {reason === "canceled" && (
          <>
            <div className="mb-4 text-5xl">📋</div>
            <h2 className="font-display text-2xl font-bold">Abonnement opsagt</h2>
            <p className="mt-3 text-muted-foreground">
              Dit abonnement er blevet opsagt. Vælg en ny plan for at genaktivere din adgang.
            </p>
          </>
        )}
        {reason === "past_due" && (
          <>
            <div className="mb-4 text-5xl">💳</div>
            <h2 className="font-display text-2xl font-bold">Betaling mislykkedes</h2>
            <p className="mt-3 text-muted-foreground">
              Vi kunne ikke trække betaling for dit abonnement. Opdater din betalingsmetode for at genoprette adgangen.
            </p>
          </>
        )}

        {erAdmin ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            {reason === "past_due" ? (
              <button
                onClick={onBillingPortal}
                disabled={billingLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
              >
                <CreditCard className="h-4 w-4" />
                {billingLoading ? "Åbner…" : "Opdater betalingsoplysninger"}
              </button>
            ) : (
              <Link
                to="/priser"
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                Se planer og priser <ChevronRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Kontakt din administrator for at genoprette adgangen.
          </p>
        )}
      </div>
    </div>
  );
}

function AppLayout() {
  const { user, logUd, session } = useAuth();
  const { medlemskaber, aktivOrg, aktivOrgId, vaelgOrg, erAdmin, loading, loadError, genindlaes, trialDaysLeft, isBlocked, blockReason } = useOrg();
  const { flags } = useFeatureFlags();
  const navigate = useNavigate();
  const path = useRouterState({ select: (r) => r.location.pathname });
  const openBillingPortal = useServerFn(createBillingPortalSession);
  const [billingLoading, setBillingLoading] = useState(false);

  const handleLogout = async () => {
    await logUd();
    navigate({ to: "/" });
  };

  const handleBillingPortal = async () => {
    if (!session || !aktivOrgId) return;
    setBillingLoading(true);
    try {
      const result = await openBillingPortal({
        data: {
          orgId: aktivOrgId,
          accessToken: session.access_token,
          returnUrl: window.location.href,
        },
      });
      if (result?.url) window.location.href = result.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Noget gik galt. Prøv igen.");
    } finally {
      setBillingLoading(false);
    }
  };

  const navItems = [
    ...(flags.status ? [{ to: "/app", label: "Status", icon: Home, exact: true }] : []),
    ...(flags.aktiviteter ? [{ to: "/app/aktiviteter", label: "Aktiviteter", icon: Activity }] : []),
    { to: "/app/logning", label: "Logning", icon: Clock },
    ...(flags.arbejdstidslog && flags.checkin_method !== "none" ? [{ to: "/checkin", label: "Tjek ind", icon: QrCode }] : []),
    ...(erAdmin ? [
      { to: "/app/arkiv", label: "Arkiv", icon: Archive },
      { to: "/app/admin", label: "Admin", icon: ShieldCheck },
      { to: "/app/indstillinger", label: "Indstillinger", icon: Settings },
    ] : []),
  ];

  const erAktiv = (to: string, exact?: boolean) => exact ? path === to : path.startsWith(to);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Indlæser…</div>;
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="glass max-w-md rounded-3xl p-8 text-center">
          <h2 className="font-display text-xl font-bold">Forbindelsesfejl</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Vi kunne ikke hente dine organisationsdata. Tjek din forbindelse og prøv igen.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={handleLogout} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">Log ud</button>
            <button onClick={genindlaes} className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Prøv igen</button>
          </div>
        </div>
      </div>
    );
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

      {trialDaysLeft !== null && !isBlocked && (
        <TrialBanner daysLeft={trialDaysLeft} />
      )}

      <main className="container mx-auto px-4 py-6 fade-in">
        {isBlocked ? (
          <Paywall
            reason={blockReason}
            erAdmin={erAdmin}
            onBillingPortal={handleBillingPortal}
            billingLoading={billingLoading}
          />
        ) : (
          <Outlet />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/90 backdrop-blur-xl">
        <div className={`container mx-auto grid max-w-2xl gap-1 px-2 py-2`} style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
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
