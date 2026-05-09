import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Shield,
  Building2,
  Users,
  Key,
  FileText,
  AlertTriangle,
  RefreshCw,
  Search,
  X,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { superadminListOrgs, superadminUpdateOrg } from "@/server/superadmin.functions";
import { ORG_TYPE_LABELS } from "@/lib/terminology";
import { toast } from "sonner";

export const Route = createFileRoute("/superadmin")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: SuperadminPanel,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type Org = {
  id: string;
  name: string;
  org_type: string;
  subscription_tier: string;
  subscription_status: string;
  trial_ends_at: string | null;
  created_at: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  gratis: "Gratis",
  basis: "Basis",
  pro: "Pro",
  organisation: "Organisation",
  kommune: "Kommune",
  special: "Special",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  trialing: "Prøveperiode",
  past_due: "Forfaldent",
  canceled: "Annulleret",
  expired: "Udløbet",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/15 text-success",
  trialing: "bg-primary/15 text-primary",
  past_due: "bg-warning/15 text-warning",
  canceled: "bg-muted text-muted-foreground",
  expired: "bg-destructive/15 text-destructive",
};

const TABS = [
  { id: "orgs", label: "Organisationer", icon: Building2 },
  { id: "users", label: "Brugere", icon: Users },
  { id: "keys", label: "Plan-nøgler", icon: Key },
  { id: "log", label: "Handlingslog", icon: FileText },
] as const;

type Tab = (typeof TABS)[number]["id"];

// ─── Root component ───────────────────────────────────────────────────────────

function SuperadminPanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("orgs");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [editOrg, setEditOrg] = useState<Org | null>(null);

  const loadOrgs = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate({ to: "/login" });
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();

    if ((profile as any)?.role !== "superadmin") {
      navigate({ to: "/" });
      return;
    }

    try {
      const data = await superadminListOrgs({
        data: { accessToken: session.access_token },
      });
      setOrgs(data as Org[]);
    } catch {
      toast.error("Kunne ikke indlæse organisationer");
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const handleSaveOrg = async (patch: {
    subscriptionTier?: string;
    subscriptionStatus?: string;
    trialEndsAt?: string | null;
  }) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session || !editOrg) return;
    await superadminUpdateOrg({
      data: {
        accessToken: session.access_token,
        orgId: editOrg.id,
        subscriptionTier: patch.subscriptionTier as any,
        subscriptionStatus: patch.subscriptionStatus as any,
        trialEndsAt: patch.trialEndsAt,
      },
    });
    toast.success("Organisation opdateret");
    setEditOrg(null);
    loadOrgs();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Indlæser…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-destructive to-orange-600 shadow-sm">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-display text-base font-bold leading-none">Superadmin</h1>
              <p className="text-xs text-muted-foreground">Tilstede</p>
            </div>
          </div>
          <button
            onClick={() => navigate({ to: "/" })}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Tilbage
          </button>
        </div>
      </header>

      {/* GDPR reminder */}
      <div className="border-b border-warning/30 bg-warning/5 px-4 py-2.5">
        <div className="container mx-auto flex items-center gap-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Adgang til persondata må kun ske ved legitime supportformål jf. GDPR artikel 6. Alle
          handlinger logges.
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const aktiv = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  aktiv
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
                {tab.id !== "orgs" && (
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Snart
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {activeTab === "orgs" && (
          <OrgsTab orgs={orgs} onEdit={setEditOrg} onRefresh={loadOrgs} />
        )}

        {activeTab !== "orgs" && (
          <div className="glass rounded-2xl p-12 text-center text-muted-foreground">
            <p className="font-display text-lg font-semibold">Kommer snart</p>
            <p className="mt-1 text-sm">Denne sektion er under udvikling.</p>
          </div>
        )}
      </div>

      {editOrg && (
        <EditOrgModal
          org={editOrg}
          onClose={() => setEditOrg(null)}
          onSave={handleSaveOrg}
        />
      )}
    </div>
  );
}

// ─── Organisations tab ────────────────────────────────────────────────────────

function OrgsTab({
  orgs,
  onEdit,
  onRefresh,
}: {
  orgs: Org[];
  onEdit: (o: Org) => void;
  onRefresh: () => void;
}) {
  const [soeg, setSoeg] = useState("");
  const filtrede = soeg
    ? orgs.filter((o) => o.name.toLowerCase().includes(soeg.toLowerCase()))
    : orgs;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Organisationer</h2>
          <p className="text-sm text-muted-foreground">{orgs.length} registrerede</p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated"
        >
          <RefreshCw className="h-4 w-4" /> Opdater
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={soeg}
          onChange={(e) => setSoeg(e.target.value)}
          placeholder="Søg organisation…"
          className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm focus:border-ring focus:outline-none"
        />
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left">Organisation</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Prøve udløber</th>
                <th className="px-4 py-3 text-left">Oprettet</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtrede.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Ingen organisationer
                  </td>
                </tr>
              ) : (
                filtrede.map((org, i) => (
                  <tr
                    key={org.id}
                    className={`border-b border-border/50 transition hover:bg-surface/40 ${
                      i % 2 !== 0 ? "bg-surface/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-medium">{org.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ORG_TYPE_LABELS[org.org_type as keyof typeof ORG_TYPE_LABELS] ??
                        org.org_type}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {TIER_LABELS[org.subscription_tier] ?? org.subscription_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          STATUS_COLORS[org.subscription_status] ??
                          "bg-muted text-muted-foreground"
                        }`}
                      >
                        {STATUS_LABELS[org.subscription_status] ?? org.subscription_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {org.trial_ends_at
                        ? new Date(org.trial_ends_at).toLocaleDateString("da-DK")
                        : "–"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(org.created_at).toLocaleDateString("da-DK")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {org.stripe_subscription_id && (
                          <a
                            href={`https://dashboard.stripe.com/subscriptions/${org.stripe_subscription_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Åbn i Stripe"
                            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button
                          onClick={() => onEdit(org)}
                          className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-elevated"
                        >
                          Rediger
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Edit org modal ───────────────────────────────────────────────────────────

function EditOrgModal({
  org,
  onClose,
  onSave,
}: {
  org: Org;
  onClose: () => void;
  onSave: (patch: {
    subscriptionTier?: string;
    subscriptionStatus?: string;
    trialEndsAt?: string | null;
  }) => Promise<void>;
}) {
  const [tier, setTier] = useState(org.subscription_tier);
  const [status, setStatus] = useState(org.subscription_status);
  const [trialEndsAt, setTrialEndsAt] = useState(
    org.trial_ends_at ? org.trial_ends_at.slice(0, 10) : "",
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const origTrialDate = org.trial_ends_at?.slice(0, 10) ?? "";
      await onSave({
        subscriptionTier: tier !== org.subscription_tier ? tier : undefined,
        subscriptionStatus: status !== org.subscription_status ? status : undefined,
        trialEndsAt:
          trialEndsAt !== origTrialDate ? (trialEndsAt || null) : undefined,
      });
    } catch {
      toast.error("Kunne ikke gemme ændringer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass w-full max-w-md space-y-4 rounded-t-3xl p-5 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Rediger abonnement
            </p>
            <h3 className="font-display text-lg font-bold">{org.name}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Plan
            </label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(TIER_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Prøveperiode udløber
            </label>
            <input
              type="date"
              value={trialEndsAt}
              onChange={(e) => setTrialEndsAt(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Lad stå tomt for ingen prøveperiode.
            </p>
          </div>
        </div>

        {(org.stripe_customer_id || org.stripe_subscription_id) && (
          <div className="rounded-xl border border-border bg-surface/50 p-3 text-xs text-muted-foreground">
            {org.stripe_customer_id && (
              <p>
                Kunde:{" "}
                <a
                  href={`https://dashboard.stripe.com/customers/${org.stripe_customer_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono underline hover:text-foreground"
                >
                  {org.stripe_customer_id}
                </a>
              </p>
            )}
            {org.stripe_subscription_id && (
              <p className="mt-0.5">
                Abonnement:{" "}
                <a
                  href={`https://dashboard.stripe.com/subscriptions/${org.stripe_subscription_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono underline hover:text-foreground"
                >
                  {org.stripe_subscription_id}
                </a>
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-surface py-2 text-sm font-medium hover:bg-surface-elevated"
          >
            Annullér
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 rounded-xl bg-gradient-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Gemmer…" : "Gem ændringer"}
          </button>
        </div>
      </div>
    </div>
  );
}
