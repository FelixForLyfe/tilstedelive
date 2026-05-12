import { useState, type FormEvent } from "react";
import { createFileRoute, Link, Outlet, useNavigate, useRouterState, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Home, Activity, Clock, ShieldCheck, Archive, LogOut, Sparkles, ChevronDown, ChevronRight, CreditCard, Settings, QrCode, CalendarDays, KeyRound, Building2, Plus } from "lucide-react";
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

    // Enforce 2FA verification if the user has enrolled a factor but hasn't verified this session.
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      throw redirect({ to: "/verify-2fa" });
    }

    // If the user's organisation requires 2FA and they have no factors enrolled, send them to setup.
    const orgId = localStorage.getItem("tilstede.aktivOrgId");
    if (orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("require_2fa")
        .eq("id", orgId)
        .maybeSingle();
      if (org?.require_2fa && aal?.nextLevel !== "aal2") {
        throw redirect({ to: "/setup-2fa" });
      }
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
    ...(flags.vagtplan ? [{ to: "/app/vagtplan", label: "Vagtplan", icon: CalendarDays }] : []),
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
      <JoinOrganisationScreen
        user={user}
        orgs={medlemskaber}
        onSelectOrg={(id) => { vaelgOrg(id); }}
        onJoined={genindlaes}
        onLogout={handleLogout}
      />
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

// ─── Join / Org-picker screen ────────────────────────────────────────────────

type Membership = {
  organization_id: string;
  organizations?: { id: string; name: string } | null;
};

function JoinOrganisationScreen({
  user,
  orgs,
  onSelectOrg,
  onJoined,
  onLogout,
}: {
  user: any;
  orgs: Membership[];
  onSelectOrg: (id: string) => void;
  onJoined: () => Promise<void>;
  onLogout: () => void;
}) {
  const [kode, setKode] = useState("");
  const [loading, setLoading] = useState(false);

  const redeemCode = async (e: FormEvent) => {
    e.preventDefault();
    const renKode = kode.trim().toUpperCase();
    if (!renKode) return;
    setLoading(true);
    const { error } = await supabase.rpc("redeem_invite", { _code: renKode });
    setLoading(false);
    if (error) {
      toast.error("Ugyldig kode", {
        description: error.message.includes("Ugyldig")
          ? "Koden er ugyldig eller udløbet. Bed din administrator om en ny kode."
          : error.message,
      });
      return;
    }
    toast.success("Du er nu tilknyttet organisationen!");
    await onJoined();
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-12">
      <div className="w-full max-w-md space-y-4 fade-in">
        {/* Greeting */}
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold">
            Hej{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(" ")[0]}` : ""}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Vælg en organisation eller tilføj en ny.</p>
        </div>

        {/* Existing orgs */}
        {orgs.length > 0 && (
          <div className="glass rounded-2xl p-4 shadow-card">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> Dine organisationer
            </p>
            <div className="space-y-2">
              {orgs.map((m) => (
                <button
                  key={m.organization_id}
                  onClick={() => onSelectOrg(m.organization_id)}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium transition hover:bg-surface-elevated"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <span>{m.organizations?.name ?? "Organisation"}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Add organisation with invite code */}
        <div className="glass rounded-2xl p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10">
              <Plus className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="font-semibold">Tilføj organisation</p>
              <p className="text-xs text-muted-foreground">Brug invitations-koden fra din administrator.</p>
            </div>
          </div>
          <form onSubmit={redeemCode} className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <input
                required
                value={kode}
                onChange={(e) => setKode(e.target.value.toUpperCase())}
                placeholder="Fx ABC123XY"
                className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm font-mono uppercase tracking-widest focus:border-ring focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !kode.trim()}
              className="w-full rounded-xl bg-gradient-primary px-4 py-2.5 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "Tilføjer…" : "Tilknyt organisation"}
            </button>
          </form>
        </div>

        {/* Footer actions */}
        <div className="flex justify-center gap-4 text-sm text-muted-foreground">
          <Link to="/signup" search={{ plan: undefined }}
            className="hover:text-foreground">Opret ny organisation</Link>
          <span>·</span>
          <button onClick={onLogout} className="hover:text-foreground">Log ud</button>
        </div>
      </div>
    </div>
  );
}
