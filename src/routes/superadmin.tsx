import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
  Copy,
  Check,
  Trash2,
  Plus,
  ClipboardList,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  superadminListOrgs,
  superadminUpdateOrg,
  superadminListUsers,
  superadminDeleteUser,
  superadminListPlanKeys,
  superadminGeneratePlanKey,
  superadminListAuditLog,
} from "@/server/superadmin.functions";
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

type UserRow = {
  userId: string;
  orgId: string;
  email: string;
  orgName: string;
  role: string;
  createdAt: string;
};

type PlanKey = {
  id: string;
  code: string;
  planType: string;
  used: boolean;
  usedAt: string | null;
  usedByOrgName: string | null;
  createdAt: string;
};

type AuditEntry = {
  id: string;
  createdAt: string;
  event: string;
  orgName: string | null;
  metadata: Record<string, unknown> | null;
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

const ROLE_LABELS: Record<string, string> = { admin: "Admin", employee: "Medarbejder" };

const KEY_PLAN_TYPES = ["basis", "pro", "organisation", "kommune", "special"] as const;

const EVENT_LABELS: Record<string, string> = {
  SUPERADMIN_VISIT: "Besøgte panel",
  SUPERADMIN_UPDATE_ORG: "Opdaterede organisation",
  SUPERADMIN_DELETE_USER: "Slettede bruger",
  SUPERADMIN_IMPERSONATE: "Impersonerede organisation",
  SUPERADMIN_RESET_TRIAL: "Nulstillede prøveperiode",
  SUPERADMIN_GENERATE_KEY: "Genererede plan-nøgle",
};

const TABS = [
  { id: "orgs", label: "Organisationer", icon: Building2 },
  { id: "users", label: "Brugere", icon: Users },
  { id: "keys", label: "Plan-nøgler", icon: Key },
  { id: "log", label: "Handlingslog", icon: FileText },
] as const;

type Tab = (typeof TABS)[number]["id"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDato(iso: string) {
  return new Date(iso).toLocaleDateString("da-DK");
}

function fmtTidspunkt(iso: string) {
  return new Date(iso).toLocaleString("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Root component ───────────────────────────────────────────────────────────

function SuperadminPanel() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("orgs");

  // Orgs tab state (loaded at startup for the visit log)
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [editOrg, setEditOrg] = useState<Org | null>(null);

  // Initial auth + superadmin check
  useEffect(() => {
    async function check() {
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
      setAccessToken(session.access_token);
      setChecking(false);
    }
    check();
  }, [navigate]);

  const loadOrgs = useCallback(async () => {
    if (!accessToken) return;
    setOrgsLoading(true);
    try {
      const data = await superadminListOrgs({ data: { accessToken } });
      setOrgs(data as Org[]);
    } catch {
      toast.error("Kunne ikke indlæse organisationer");
    } finally {
      setOrgsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && activeTab === "orgs") loadOrgs();
  }, [accessToken, activeTab, loadOrgs]);

  const handleSaveOrg = async (patch: {
    subscriptionTier?: string;
    subscriptionStatus?: string;
    trialEndsAt?: string | null;
  }) => {
    if (!accessToken || !editOrg) return;
    await superadminUpdateOrg({
      data: {
        accessToken,
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

  if (checking || !accessToken) {
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
              </button>
            );
          })}
        </div>

        {activeTab === "orgs" && (
          <OrgsTab
            orgs={orgs}
            loading={orgsLoading}
            onEdit={setEditOrg}
            onRefresh={loadOrgs}
          />
        )}
        {activeTab === "users" && <UsersTab accessToken={accessToken} />}
        {activeTab === "keys" && <KeysTab accessToken={accessToken} />}
        {activeTab === "log" && <LogTab accessToken={accessToken} />}
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
  loading,
  onEdit,
  onRefresh,
}: {
  orgs: Org[];
  loading: boolean;
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
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Opdater
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
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
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
                      {org.trial_ends_at ? fmtDato(org.trial_ends_at) : "–"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDato(org.created_at)}
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
      const origTrial = org.trial_ends_at?.slice(0, 10) ?? "";
      await onSave({
        subscriptionTier: tier !== org.subscription_tier ? tier : undefined,
        subscriptionStatus: status !== org.subscription_status ? status : undefined,
        trialEndsAt: trialEndsAt !== origTrial ? (trialEndsAt || null) : undefined,
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
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Plan</label>
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(TIER_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            >
              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
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
            <p className="mt-1 text-xs text-muted-foreground">Lad stå tomt for ingen prøveperiode.</p>
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

// ─── Brugere tab ──────────────────────────────────────────────────────────────

function UsersTab({ accessToken }: { accessToken: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [soeg, setSoeg] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<UserRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await superadminListUsers({ data: { accessToken } });
      setUsers(data as UserRow[]);
    } catch {
      toast.error("Kunne ikke indlæse brugere");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (reason: string) => {
    if (!deleteTarget) return;
    await superadminDeleteUser({
      data: { accessToken, userId: deleteTarget.userId, reason },
    });
    toast.success("Bruger slettet");
    setDeleteTarget(null);
    load();
  };

  const filtrede = soeg
    ? users.filter(
        (u) =>
          u.email.toLowerCase().includes(soeg.toLowerCase()) ||
          u.orgName.toLowerCase().includes(soeg.toLowerCase()),
      )
    : users;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Brugere</h2>
          <p className="text-sm text-muted-foreground">{users.length} aktive medlemskaber</p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Opdater
        </button>
      </div>

      <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
        <strong>Dataminimering:</strong> Kun e-mail, organisation, rolle og tilmeldingsdato vises.
        Ingen navne, CPR-numre eller andre personoplysninger.
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={soeg}
          onChange={(e) => setSoeg(e.target.value)}
          placeholder="Søg e-mail eller organisation…"
          className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm focus:border-ring focus:outline-none"
        />
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left">E-mail</th>
                <th className="px-4 py-3 text-left">Organisation</th>
                <th className="px-4 py-3 text-left">Rolle</th>
                <th className="px-4 py-3 text-left">Tilmeldt</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Indlæser…
                  </td>
                </tr>
              ) : filtrede.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    Ingen brugere
                  </td>
                </tr>
              ) : (
                filtrede.map((u, i) => (
                  <tr
                    key={`${u.userId}-${u.orgId}`}
                    className={`border-b border-border/50 transition hover:bg-surface/40 ${
                      i % 2 !== 0 ? "bg-surface/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">{u.orgName}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.role === "admin"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDato(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDeleteTarget(u)}
                        title="Slet bruger"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}

// ─── Delete user modal ────────────────────────────────────────────────────────

function DeleteUserModal({
  user,
  onClose,
  onConfirm,
}: {
  user: UserRow;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { reasonRef.current?.focus(); }, []);

  const handleConfirm = async () => {
    if (reason.trim().length < 5) {
      toast.error("Angiv venligst en årsag (min. 5 tegn)");
      return;
    }
    setSaving(true);
    try {
      await onConfirm(reason.trim());
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke slette bruger");
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
            <p className="text-xs uppercase tracking-wider text-destructive">Slet bruger</p>
            <h3 className="font-display text-lg font-bold">{user.email}</h3>
            <p className="text-sm text-muted-foreground">
              {user.orgName} · {ROLE_LABELS[user.role] ?? user.role}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          Brugeren mister adgang til alle organisationer. Handlingen kan ikke fortrydes.
          Logdata og fremmøderegistreringer bevares.
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Årsag til sletning <span className="text-destructive">*</span>
          </label>
          <textarea
            ref={reasonRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Fx: Brugerens anmodning om datasletning (GDPR art. 17)"
            className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:border-ring focus:outline-none"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Logges i audit-loggen. Minimum 5 tegn.
          </p>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-surface py-2 text-sm font-medium hover:bg-surface-elevated"
          >
            Annullér
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || reason.trim().length < 5}
            className="flex-1 rounded-xl bg-destructive py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50"
          >
            {saving ? "Sletter…" : "Slet bruger"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan-nøgler tab ──────────────────────────────────────────────────────────

function KeysTab({ accessToken }: { accessToken: string }) {
  const [keys, setKeys] = useState<PlanKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlanType, setNewPlanType] = useState<(typeof KEY_PLAN_TYPES)[number]>("pro");
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await superadminListPlanKeys({ data: { accessToken } });
      setKeys(data as PlanKey[]);
    } catch {
      toast.error("Kunne ikke indlæse plan-nøgler");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await superadminGeneratePlanKey({
        data: { accessToken, planType: newPlanType },
      });
      const code = (result as any).code as string;
      await navigator.clipboard.writeText(code).catch(() => {});
      toast.success(`Nøgle genereret og kopieret: ${code}`, { duration: 8000 });
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke generere nøgle");
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = async (key: PlanKey) => {
    await navigator.clipboard.writeText(key.code).catch(() => {});
    setCopiedId(key.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const unused = keys.filter((k) => !k.used).length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-bold">Plan-nøgler</h2>
        <p className="text-sm text-muted-foreground">
          {keys.length} nøgler totalt · {unused} ubrugte
        </p>
      </div>

      {/* Generator */}
      <div className="glass rounded-2xl p-5">
        <p className="mb-3 text-sm font-medium">Generer ny aktiveringsnøgle</p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={newPlanType}
            onChange={(e) => setNewPlanType(e.target.value as any)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm"
          >
            {KEY_PLAN_TYPES.map((t) => (
              <option key={t} value={t}>
                {TIER_LABELS[t]}
              </option>
            ))}
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {generating ? "Genererer…" : "Generer nøgle"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Koden kopieres automatisk til udklipsholderen og vises i tabellen nedenfor.
        </p>
      </div>

      {/* Keys table */}
      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left">Kode</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Brugt af</th>
                <th className="px-4 py-3 text-left">Oprettet</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Indlæser…
                  </td>
                </tr>
              ) : keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    Ingen nøgler endnu
                  </td>
                </tr>
              ) : (
                keys.map((k, i) => (
                  <tr
                    key={k.id}
                    className={`border-b border-border/50 transition ${
                      i % 2 !== 0 ? "bg-surface/20" : ""
                    } ${!k.used ? "hover:bg-surface/40" : "opacity-60"}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs tracking-widest">{k.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {TIER_LABELS[k.planType] ?? k.planType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          k.used
                            ? "bg-muted text-muted-foreground"
                            : "bg-success/15 text-success"
                        }`}
                      >
                        {k.used ? "Brugt" : "Ubrugt"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {k.usedByOrgName
                        ? `${k.usedByOrgName}${k.usedAt ? ` · ${fmtDato(k.usedAt)}` : ""}`
                        : "–"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDato(k.createdAt)}</td>
                    <td className="px-4 py-3">
                      {!k.used && (
                        <button
                          onClick={() => copyCode(k)}
                          title="Kopiér nøgle"
                          className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
                        >
                          {copiedId === k.id ? (
                            <Check className="h-4 w-4 text-success" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                      )}
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

// ─── Handlingslog tab ─────────────────────────────────────────────────────────

function LogTab({ accessToken }: { accessToken: string }) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await superadminListAuditLog({ data: { accessToken } });
      setEntries(data as AuditEntry[]);
    } catch {
      toast.error("Kunne ikke indlæse handlingslog");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Handlingslog</h2>
          <p className="text-sm text-muted-foreground">
            Alle superadmin-handlinger · nyeste øverst
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Opdater
        </button>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Indlæser…</div>
      ) : entries.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          <ClipboardList className="mx-auto mb-3 h-8 w-8" />
          Ingen handlinger logget endnu.
        </div>
      ) : (
        <div className="glass overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left">Tidspunkt</th>
                  <th className="px-4 py-3 text-left">Hændelse</th>
                  <th className="px-4 py-3 text-left">Organisation</th>
                  <th className="px-4 py-3 text-left">Detaljer</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <>
                    <tr
                      key={e.id}
                      className={`border-b border-border/50 transition hover:bg-surface/40 ${
                        i % 2 !== 0 ? "bg-surface/20" : ""
                      }`}
                    >
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtTidspunkt(e.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {EVENT_LABELS[e.event] ?? e.event}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{e.orgName ?? "–"}</td>
                      <td className="px-4 py-3">
                        {e.metadata && Object.keys(e.metadata).length > 1 && (
                          <button
                            onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                            className="text-xs text-primary hover:underline"
                          >
                            {expanded === e.id ? "Skjul" : "Vis"}
                          </button>
                        )}
                        {e.event === "SUPERADMIN_DELETE_USER" && e.metadata?.reason && (
                          <span className="text-xs text-muted-foreground">
                            {" "}· {String(e.metadata.reason).slice(0, 50)}
                            {String(e.metadata.reason).length > 50 ? "…" : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                    {expanded === e.id && e.metadata && (
                      <tr key={`${e.id}-detail`} className="border-b border-border/30">
                        <td colSpan={4} className="bg-surface/30 px-6 py-3">
                          <pre className="overflow-x-auto rounded-lg bg-background p-3 text-xs text-muted-foreground">
                            {JSON.stringify(e.metadata, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
