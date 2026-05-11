import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Shield,
  Building2,
  Users,
  Key,
  FileText,
  AlertTriangle,
  Star,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Search,
  X,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Plus,
  ClipboardList,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Minus,
  Pencil,
  Save,
  Layers,
  CalendarDays,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getPostHogMetrics } from "@/server/posthog.functions";
import {
  superadminListOrgs,
  superadminUpdateOrg,
  superadminExtendTrial,
  superadminSetOrgStatus,
  superadminGetDashboard,
  superadminSaveMonthlyCosts,
  superadminListUsers,
  superadminDeleteUser,
  superadminListPlanKeys,
  superadminGeneratePlanKey,
  superadminUpdatePlanKey,
  superadminDeletePlanKey,
  superadminListAuditLog,
  superadminListCustomPlans,
  superadminCreateCustomPlan,
  superadminUpdateCustomPlan,
  superadminListOrgNames,
  superadminSetRequire2fa,
  type DashboardOrg,
  type MonthlyCost,
  type CustomPlan,
} from "@/server/superadmin.functions";
import {
  superadminListReviews,
  superadminApproveReview,
  superadminDeleteReview,
} from "@/server/reviews.functions";
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
  gratis_reason: string | null;
  require_2fa: boolean;
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
  label: string | null;
  isPromo: boolean;
  maxUses: number | null;
  usesCount: number;
  expiresAt: string | null;
  priceDkk: number | null;
  discountPct: number | null;
  durationMonths: number | null;
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
  metadata: Record<string, string | number | boolean | null> | null;
};

type DashboardData = {
  orgs: DashboardOrg[];
  orgMemberCounts: Record<string, number>;
  totalMembers: number;
  totalAttendanceRecords: number;
  totalTimeLogs: number;
  costs: MonthlyCost[];
};

type CostDraft = { category: string; amount_dkk: number; note: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const TIER_LABELS: Record<string, string> = {
  gratis: "Gratis",
  basis: "Basis",
  pro: "Pro",
  organisation: "Organisation",
  kommune: "Kommune",
  special: "Special",
};

const TIER_PRICES: Record<string, number> = {
  basis: 299,
  pro: 599,
  organisation: 1199,
  kommune: 4999,
  special: 0,
};

const STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  trialing: "Prøveperiode",
  past_due: "Forfaldent",
  canceled: "Annulleret",
  expired: "Udløbet",
  gratis: "Gratis",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/15 text-success",
  trialing: "bg-primary/15 text-primary",
  past_due: "bg-warning/15 text-warning",
  canceled: "bg-muted text-muted-foreground",
  expired: "bg-destructive/15 text-destructive",
  gratis: "bg-violet-500/15 text-violet-600",
};

const ROLE_LABELS: Record<string, string> = { admin: "Admin", employee: "Medarbejder" };
const KEY_PLAN_TYPES = ["basis", "pro", "organisation", "kommune", "special"] as const;

const EVENT_LABELS: Record<string, string> = {
  SUPERADMIN_VISIT: "Besøgte panel",
  SUPERADMIN_UPDATE_ORG: "Opdaterede organisation",
  SUPERADMIN_EXTEND_TRIAL: "Udvidede prøveperiode",
  SUPERADMIN_SET_STATUS: "Satte abonnementsstatus",
  SUPERADMIN_DELETE_USER: "Slettede bruger",
  SUPERADMIN_GENERATE_KEY: "Genererede plan-nøgle",
  SUPERADMIN_SAVE_COSTS: "Gemte månedlige omkostninger",
  SUPERADMIN_CREATE_CUSTOM_PLAN: "Oprettede misc. plan",
  SUPERADMIN_UPDATE_CUSTOM_PLAN: "Opdaterede misc. plan",
};

const CUSTOM_PLAN_STATUS_LABELS: Record<string, string> = {
  active: "Aktiv",
  expired: "Udløbet",
  cancelled: "Annulleret",
};

const CUSTOM_PLAN_STATUS_COLORS: Record<string, string> = {
  active: "bg-success/15 text-success",
  expired: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/15 text-destructive",
};

const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "analyse", label: "Analyse", icon: TrendingUp },
  { id: "orgs", label: "Organisationer", icon: Building2 },
  { id: "users", label: "Brugere", icon: Users },
  { id: "keys", label: "Plan-nøgler", icon: Key },
  { id: "misc", label: "Misc. Planer", icon: Layers },
  { id: "reviews", label: "Anmeldelser", icon: Star },
  { id: "log", label: "Handlingslog", icon: FileText },
] as const;

type Tab = (typeof TABS)[number]["id"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDato(iso: string) {
  return new Date(iso).toLocaleDateString("da-DK");
}

function fmtTidspunkt(iso: string) {
  return new Date(iso).toLocaleString("da-DK", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtKr(n: number) {
  return n.toLocaleString("da-DK") + " kr.";
}

// ─── Root component ───────────────────────────────────────────────────────────

function SuperadminPanel() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [editOrg, setEditOrg] = useState<Org | null>(null);

  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/login" }); return; }
      const { data: profile } = await supabase
        .from("profiles").select("role").eq("id", session.user.id).single();
      if ((profile as any)?.role !== "superadmin") { navigate({ to: "/" }); return; }
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
    } catch (err: any) {
      toast.error(`Organisationer: ${err?.message ?? "Ukendt fejl"}`);
    } finally {
      setOrgsLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken && activeTab === "orgs") loadOrgs();
  }, [accessToken, activeTab, loadOrgs]);

  if (checking || !accessToken) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Indlæser…</div>;
  }

  return (
    <div className="min-h-screen bg-background">
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
          <button onClick={() => navigate({ to: "/" })} className="text-sm text-muted-foreground hover:text-foreground">
            ← Tilbage
          </button>
        </div>
      </header>

      <div className="border-b border-warning/30 bg-warning/5 px-4 py-2.5">
        <div className="container mx-auto flex items-center gap-2 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Adgang til persondata må kun ske ved legitime supportformål jf. GDPR artikel 6. Alle handlinger logges.
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const aktiv = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  aktiv ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "dashboard" && <DashboardTab accessToken={accessToken} />}
        {activeTab === "analyse" && <AnalyseTab />}
        {activeTab === "orgs" && (
          <OrgsTab orgs={orgs} loading={orgsLoading} onEdit={setEditOrg} onRefresh={loadOrgs} />
        )}
        {activeTab === "users" && <UsersTab accessToken={accessToken} />}
        {activeTab === "keys" && <KeysTab accessToken={accessToken} />}
        {activeTab === "misc" && <MiscPlansTab accessToken={accessToken} />}
        {activeTab === "reviews" && <AnmeldelserTab accessToken={accessToken} />}
        {activeTab === "log" && <LogTab accessToken={accessToken} />}
      </div>

      {editOrg && (
        <EditOrgModal
          org={editOrg}
          accessToken={accessToken}
          onClose={() => setEditOrg(null)}
          onSaved={() => { setEditOrg(null); loadOrgs(); }}
        />
      )}
    </div>
  );
}

// ─── Dashboard tab ────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-5 ${accent ? "bg-gradient-primary text-primary-foreground shadow-glow" : "glass"}`}>
      <p className={`text-xs font-medium uppercase tracking-wider ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${accent ? "text-primary-foreground" : ""}`}>{value}</p>
      {sub && <p className={`mt-1 text-xs ${accent ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sub}</p>}
    </div>
  );
}

function HealthPill({ label, status, value }: { label: string; status: "green" | "yellow" | "red"; value: string }) {
  const cfg = {
    green: { cls: "border-success/30 bg-success/10 text-success", icon: TrendingUp },
    yellow: { cls: "border-warning/30 bg-warning/10 text-warning", icon: Minus },
    red: { cls: "border-destructive/30 bg-destructive/10 text-destructive", icon: TrendingDown },
  }[status];
  const Icon = cfg.icon;
  return (
    <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${cfg.cls}`}>
      <Icon className="h-4 w-4 shrink-0" />
      <div>
        <p className="text-xs font-medium opacity-80">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

// ─── Analyse Tab ─────────────────────────────────────────────────────────────

function AnalyseTab() {
  const [metrics, setMetrics] = useState<{
    pageviews7d: number; signups7d: number; loginEvents7d: number; checkouts7d: number;
    topEvents: { event: string; count: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notConfigured, setNotConfigured] = useState(false);
  const phHost = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

  useEffect(() => {
    getPostHogMetrics().then((data) => {
      if (!data) setNotConfigured(true);
      else setMetrics(data);
      setLoading(false);
    });
  }, []);

  const EVENT_LABELS: Record<string, string> = {
    "$pageview": "Sidevisninger",
    "signup_completed": "Tilmeldinger",
    "login_success": "Logins",
    "checkout_started": "Checkout startet",
  };

  if (loading) return <div className="text-sm text-muted-foreground py-8 text-center">Henter analysedata…</div>;

  if (notConfigured) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">PostHog Analyse</h2>
        <div className="glass rounded-2xl p-6 space-y-4">
          <p className="text-sm font-medium">Konfiguration påkrævet</p>
          <p className="text-sm text-muted-foreground">
            Tilføj disse environment variables til Vercel for at se analysedata:
          </p>
          <div className="rounded-xl bg-muted/50 p-4 font-mono text-xs space-y-1">
            <div>POSTHOG_PERSONAL_API_KEY=phx_...</div>
            <div>POSTHOG_PROJECT_ID=12345</div>
            <div>VITE_POSTHOG_KEY=phc_...</div>
            <div>VITE_POSTHOG_HOST=https://eu.i.posthog.com</div>
          </div>
          <p className="text-xs text-muted-foreground">
            Find din Personal API Key under PostHog → Settings → Personal API Keys.
            Brug en nøgle med <strong>read</strong>-adgang til projektet.
          </p>
          {phHost && (
            <a href={phHost} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
              Åbn PostHog dashboard ↗
            </a>
          )}
        </div>
      </div>
    );
  }

  const statCards = [
    { label: "Sidevisninger (7 dage)", value: metrics!.pageviews7d, color: "text-primary" },
    { label: "Nye tilmeldinger (7 dage)", value: metrics!.signups7d, color: "text-success" },
    { label: "Logins (7 dage)", value: metrics!.loginEvents7d, color: "text-blue-500" },
    { label: "Checkout startet (7 dage)", value: metrics!.checkouts7d, color: "text-amber-500" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">PostHog Analyse</h2>
        {phHost && (
          <a href={phHost} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-1.5 text-sm hover:bg-muted">
            Åbn PostHog ↗
          </a>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statCards.map((c) => (
          <div key={c.label} className="glass rounded-2xl p-4">
            <p className="text-xs text-muted-foreground mb-1">{c.label}</p>
            <p className={`text-3xl font-bold ${c.color}`}>{c.value.toLocaleString("da-DK")}</p>
          </div>
        ))}
      </div>

      <div className="glass rounded-2xl p-5">
        <h3 className="text-sm font-semibold mb-3">Events (7 dage)</h3>
        <div className="space-y-2">
          {metrics!.topEvents.map((e) => {
            const max = metrics!.topEvents[0]?.count || 1;
            return (
              <div key={e.event} className="flex items-center gap-3">
                <span className="w-36 text-xs text-muted-foreground shrink-0">
                  {EVENT_LABELS[e.event] ?? e.event}
                </span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all"
                    style={{ width: `${(e.count / max) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold w-10 text-right">{e.count.toLocaleString("da-DK")}</span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Data hentes direkte fra PostHog API. Kun brugere der har accepteret cookies indgår i statistikken.
      </p>
    </div>
  );
}

function DashboardTab({ accessToken }: { accessToken: string }) {
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editingCosts, setEditingCosts] = useState(false);
  const [costDraft, setCostDraft] = useState<CostDraft[]>([]);
  const [savingCosts, setSavingCosts] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await superadminGetDashboard({ data: { accessToken } });
      setDashData(result as DashboardData);
    } catch (err: any) {
      toast.error(`Dashboard: ${err?.message ?? "Ukendt fejl"}`);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const startEditCosts = () => {
    const existing = (dashData?.costs ?? []).filter(c => c.month.slice(0, 7) === selectedMonth);
    setCostDraft(
      existing.length > 0
        ? existing.map(c => ({ category: c.category, amount_dkk: c.amount_dkk, note: c.note ?? "" }))
        : [
            { category: "Supabase", amount_dkk: 0, note: "" },
            { category: "Vercel", amount_dkk: 0, note: "" },
          ],
    );
    setEditingCosts(true);
  };

  const saveCosts = async () => {
    setSavingCosts(true);
    try {
      const monthDate = selectedMonth + "-01";
      await superadminSaveMonthlyCosts({
        data: {
          accessToken,
          month: monthDate,
          costs: costDraft.filter(c => c.category.trim()).map(c => ({
            category: c.category.trim(),
            amount_dkk: c.amount_dkk,
            note: c.note.trim() || undefined,
          })),
        },
      });
      toast.success("Omkostninger gemt");
      setEditingCosts(false);
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke gemme omkostninger");
    } finally {
      setSavingCosts(false);
    }
  };

  if (loading || !dashData) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Indlæser dashboard…
      </div>
    );
  }

  const now = new Date();
  const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const orgs = dashData.orgs;

  // Status buckets
  const activePayingOrgs = orgs.filter(o =>
    o.subscription_status === "active" && o.subscription_tier !== "gratis",
  );
  const trialingOrgs = orgs.filter(o =>
    o.subscription_status === "trialing" &&
    o.trial_ends_at &&
    new Date(o.trial_ends_at) > now,
  );
  const expiredTrialOrgs = orgs.filter(o =>
    o.subscription_status === "trialing" &&
    (!o.trial_ends_at || new Date(o.trial_ends_at) <= now),
  );
  const gratisOrgs = orgs.filter(o => o.subscription_status === "gratis");
  const canceledOrgs = orgs.filter(o =>
    o.subscription_status === "canceled" || o.subscription_status === "expired",
  );

  // MRR / ARR
  const mrrRows = Object.entries(TIER_PRICES).map(([tier, price]) => ({
    tier,
    label: TIER_LABELS[tier] ?? tier,
    price,
    count: activePayingOrgs.filter(o => o.subscription_tier === tier).length,
    mrr: activePayingOrgs.filter(o => o.subscription_tier === tier).length * price,
  })).filter(r => r.count > 0 || r.price > 0);

  const totalMRR = mrrRows.reduce((s, r) => s + r.mrr, 0);
  const totalARR = totalMRR * 12;

  // Monthly signup chart (last 12 months)
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const key = d.toISOString().slice(0, 7);
    return {
      month: d.toLocaleDateString("da-DK", { month: "short", year: "2-digit" }),
      orgs: orgs.filter(o => o.created_at.slice(0, 7) === key).length,
    };
  });

  // Org analytics
  const newOrgs7d = orgs.filter(o => new Date(o.created_at) > d7).length;
  const newOrgs30d = orgs.filter(o => new Date(o.created_at) > d30).length;
  const avgMembers = orgs.length > 0 ? (dashData.totalMembers / orgs.length).toFixed(1) : "0";

  // Org type breakdown
  const typeBreakdown = Object.entries(
    orgs.reduce<Record<string, number>>((acc, o) => {
      acc[o.org_type] = (acc[o.org_type] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  // Trial analytics
  const trialsStarted7d = orgs.filter(o => new Date(o.created_at) > d7).length;
  const trialsStarted30d = orgs.filter(o => new Date(o.created_at) > d30).length;
  const totalEverTrialed = orgs.length;
  const conversionRate = totalEverTrialed > 0
    ? Math.round((activePayingOrgs.length / totalEverTrialed) * 100)
    : 0;

  // Monthly costs
  const currentCosts = dashData.costs.filter(c => c.month.slice(0, 7) === selectedMonth);
  const totalCosts = currentCosts.reduce((s, c) => s + c.amount_dkk, 0);
  const profit = totalMRR - totalCosts;
  const margin = totalMRR > 0 ? Math.round((profit / totalMRR) * 100) : 0;

  // Health indicators
  const mrrHealth: "green" | "yellow" | "red" = totalMRR > 0 ? "green" : "yellow";
  const convHealth: "green" | "yellow" | "red" =
    conversionRate >= 20 ? "green" : conversionRate >= 10 ? "yellow" : "red";
  const churnPct = totalEverTrialed > 0 ? Math.round((canceledOrgs.length / totalEverTrialed) * 100) : 0;
  const churnHealth: "green" | "yellow" | "red" =
    churnPct <= 5 ? "green" : churnPct <= 10 ? "yellow" : "red";

  return (
    <div className="space-y-8">
      {/* ── KPI row ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Overblik</h2>
          <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs hover:bg-surface-elevated">
            <RefreshCw className="h-3.5 w-3.5" /> Opdater
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="MRR" value={fmtKr(totalMRR)} sub="månedlig omsætning" accent />
          <KpiCard label="ARR" value={fmtKr(totalARR)} sub="årlig omsætning" />
          <KpiCard label="Betalende kunder" value={String(activePayingOrgs.length)} sub={`af ${orgs.length} org. totalt`} />
          <KpiCard label="Aktive prøveperioder" value={String(trialingOrgs.length)} sub={`${expiredTrialOrgs.length} udløbet`} />
        </div>
      </section>

      {/* ── Revenue breakdown ── */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Omsætning pr. plan</h2>
        <div className="glass overflow-hidden rounded-2xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-right">Pris/md</th>
                <th className="px-4 py-3 text-right">Antal aktive</th>
                <th className="px-4 py-3 text-right">MRR</th>
              </tr>
            </thead>
            <tbody>
              {mrrRows.map((r, i) => (
                <tr key={r.tier} className={`border-b border-border/50 ${i % 2 ? "bg-surface/20" : ""}`}>
                  <td className="px-4 py-3 font-medium">{r.label}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{r.price > 0 ? fmtKr(r.price) : "Brugerdefineret"}</td>
                  <td className="px-4 py-3 text-right">{r.count}</td>
                  <td className="px-4 py-3 text-right font-semibold">{r.price > 0 ? fmtKr(r.mrr) : "–"}</td>
                </tr>
              ))}
              {mrrRows.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Ingen betalende kunder endnu</td></tr>
              )}
              {mrrRows.length > 0 && (
                <tr className="border-t-2 border-border bg-surface/40 font-bold">
                  <td className="px-4 py-3" colSpan={3}>Total MRR</td>
                  <td className="px-4 py-3 text-right text-success">{fmtKr(totalMRR)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Status breakdown chips */}
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            { label: "Aktive (betalende)", count: activePayingOrgs.length, cls: "bg-success/10 text-success border-success/20" },
            { label: "Prøveperiode", count: trialingOrgs.length, cls: "bg-primary/10 text-primary border-primary/20" },
            { label: "Prøve udløbet", count: expiredTrialOrgs.length, cls: "bg-destructive/10 text-destructive border-destructive/20" },
            { label: "Gratis", count: gratisOrgs.length, cls: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
            { label: "Annulleret/Udløbet", count: canceledOrgs.length, cls: "bg-muted text-muted-foreground border-border" },
          ].map((s) => (
            <span key={s.label} className={`rounded-full border px-3 py-1 text-sm font-medium ${s.cls}`}>
              {s.label}: {s.count}
            </span>
          ))}
        </div>
      </section>

      {/* ── Signup chart ── */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Nye organisationer (12 mdr.)</h2>
        <div className="glass rounded-2xl p-5">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip
                contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ fontWeight: 600 }}
              />
              <Bar dataKey="orgs" name="Nye org." fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ── Costs vs Revenue ── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Omkostninger vs. omsætning</h2>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => { setSelectedMonth(e.target.value); setEditingCosts(false); }}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm focus:outline-none"
            />
            {!editingCosts ? (
              <button onClick={startEditCosts} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm hover:bg-surface-elevated">
                <Pencil className="h-3.5 w-3.5" /> Redigér
              </button>
            ) : (
              <button onClick={saveCosts} disabled={savingCosts} className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                <Save className="h-3.5 w-3.5" /> {savingCosts ? "Gemmer…" : "Gem"}
              </button>
            )}
          </div>
        </div>

        {editingCosts ? (
          <div className="glass space-y-3 rounded-2xl p-5">
            {costDraft.map((c, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <input
                  value={c.category}
                  onChange={(e) => setCostDraft(d => d.map((x, i) => i === idx ? { ...x, category: e.target.value } : x))}
                  placeholder="Kategori (fx Supabase)"
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                />
                <input
                  type="number"
                  value={c.amount_dkk}
                  onChange={(e) => setCostDraft(d => d.map((x, i) => i === idx ? { ...x, amount_dkk: parseInt(e.target.value) || 0 } : x))}
                  placeholder="Kr./md"
                  className="w-28 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                />
                <input
                  value={c.note}
                  onChange={(e) => setCostDraft(d => d.map((x, i) => i === idx ? { ...x, note: e.target.value } : x))}
                  placeholder="Note (valgfri)"
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                />
                <button onClick={() => setCostDraft(d => d.filter((_, i) => i !== idx))} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setCostDraft(d => [...d, { category: "", amount_dkk: 0, note: "" }])}
              className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Tilføj post
            </button>
          </div>
        ) : (
          <div className="glass rounded-2xl">
            {currentCosts.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-muted-foreground">
                Ingen omkostninger registreret for {selectedMonth}. Klik "Redigér" for at tilføje.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 text-left">Kategori</th>
                    <th className="px-4 py-3 text-left">Note</th>
                    <th className="px-4 py-3 text-right">Beløb</th>
                  </tr>
                </thead>
                <tbody>
                  {currentCosts.map((c, i) => (
                    <tr key={c.id} className={`border-b border-border/50 ${i % 2 ? "bg-surface/20" : ""}`}>
                      <td className="px-4 py-3 font-medium">{c.category}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.note ?? "–"}</td>
                      <td className="px-4 py-3 text-right">{fmtKr(c.amount_dkk)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {currentCosts.length > 0 && (
              <div className="grid grid-cols-3 gap-4 border-t border-border p-5">
                <div>
                  <p className="text-xs text-muted-foreground">Samlede omkostninger</p>
                  <p className="mt-1 text-lg font-bold text-destructive">{fmtKr(totalCosts)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">MRR</p>
                  <p className="mt-1 text-lg font-bold text-success">{fmtKr(totalMRR)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Overskud / margin</p>
                  <p className={`mt-1 text-lg font-bold ${profit >= 0 ? "text-success" : "text-destructive"}`}>
                    {fmtKr(profit)} ({margin}%)
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Org analytics ── */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Organisations-analyse</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="Totalt org." value={String(orgs.length)} />
          <KpiCard label="Totalt brugere" value={String(dashData.totalMembers)} sub={`~${avgMembers} pr. org.`} />
          <KpiCard label="Nye (7 dage)" value={String(newOrgs7d)} />
          <KpiCard label="Nye (30 dage)" value={String(newOrgs30d)} />
        </div>

        <div className="mt-4 glass rounded-2xl p-5">
          <p className="mb-3 text-sm font-medium">Fordeling efter type</p>
          <div className="flex flex-wrap gap-2">
            {typeBreakdown.map(([type, count]) => (
              <span key={type} className="rounded-full border border-border bg-surface px-3 py-1 text-sm">
                {ORG_TYPE_LABELS[type as keyof typeof ORG_TYPE_LABELS] ?? type}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trial analytics ── */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Prøveperiode-analyse</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="Nye trials (7d)" value={String(trialsStarted7d)} />
          <KpiCard label="Nye trials (30d)" value={String(trialsStarted30d)} />
          <KpiCard label="Konverteret til betalt" value={String(activePayingOrgs.length)} />
          <KpiCard label="Konverteringsrate" value={`${conversionRate}%`} sub="af alle org. der prøvede" />
        </div>
      </section>

      {/* ── Activity ── */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Aktivitet (totalt)</h2>
        <div className="grid grid-cols-2 gap-4">
          <KpiCard label="Fremmøderegistreringer" value={dashData.totalAttendanceRecords.toLocaleString("da-DK")} sub="alle org. samlet" />
          <KpiCard label="Medarbejder-tidslogs" value={dashData.totalTimeLogs.toLocaleString("da-DK")} sub="alle org. samlet" />
        </div>
      </section>

      {/* ── Health ── */}
      <section>
        <h2 className="mb-3 font-display text-xl font-bold">Sundhedsindikatorer</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <HealthPill label="MRR" status={mrrHealth} value={totalMRR > 0 ? fmtKr(totalMRR) + "/md" : "Ingen omsætning endnu"} />
          <HealthPill label="Trial-konverteringsrate" status={convHealth} value={`${conversionRate}% (mål: >20%)`} />
          <HealthPill label="Churn-rate" status={churnHealth} value={`${churnPct}% (mål: <5%)`} />
        </div>
      </section>
    </div>
  );
}

// ─── Organisations tab ────────────────────────────────────────────────────────

function OrgsTab({
  orgs, loading, onEdit, onRefresh,
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
        <button onClick={onRefresh} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated">
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
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Ingen organisationer</td></tr>
              ) : (
                filtrede.map((org, i) => (
                  <tr key={org.id} className={`border-b border-border/50 transition hover:bg-surface/40 ${i % 2 ? "bg-surface/20" : ""}`}>
                    <td className="px-4 py-3 font-medium">
                      {org.name}
                      {org.gratis_reason && (
                        <span className="ml-2 rounded-full bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-600" title={org.gratis_reason}>gratis</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {ORG_TYPE_LABELS[org.org_type as keyof typeof ORG_TYPE_LABELS] ?? org.org_type}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {TIER_LABELS[org.subscription_tier] ?? org.subscription_tier}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[org.subscription_status] ?? "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABELS[org.subscription_status] ?? org.subscription_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {org.trial_ends_at ? fmtDato(org.trial_ends_at) : "–"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDato(org.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {org.stripe_subscription_id && (
                          <a
                            href={`https://dashboard.stripe.com/subscriptions/${org.stripe_subscription_id}`}
                            target="_blank" rel="noopener noreferrer"
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
  org, accessToken, onClose, onSaved,
}: {
  org: Org;
  accessToken: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tier, setTier] = useState(org.subscription_tier);
  const [status, setStatus] = useState(org.subscription_status);
  const [gratisReason, setGratisReason] = useState(org.gratis_reason ?? "");
  const [trialEndsAt, setTrialEndsAt] = useState(org.trial_ends_at ? org.trial_ends_at.slice(0, 10) : "");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [require2fa, setRequire2fa] = useState(org.require_2fa ?? false);
  const [saving2fa, setSaving2fa] = useState(false);

  const tierChanged = tier !== org.subscription_tier;
  const statusChanged = status !== org.subscription_status;
  const trialChanged = trialEndsAt !== (org.trial_ends_at?.slice(0, 10) ?? "");
  const anyChange = tierChanged || statusChanged || trialChanged;
  const needsReason = statusChanged || trialChanged;
  const canSave = anyChange && (!needsReason || reason.trim().length >= 5);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (statusChanged) {
        await superadminSetOrgStatus({
          data: {
            accessToken,
            orgId: org.id,
            subscriptionStatus: status as any,
            gratisReason: status === "gratis" ? gratisReason : undefined,
            reason: reason.trim(),
          },
        });
      }
      if (tierChanged) {
        await superadminUpdateOrg({
          data: { accessToken, orgId: org.id, subscriptionTier: tier as any },
        });
      }
      if (trialChanged) {
        await superadminExtendTrial({
          data: {
            accessToken,
            orgId: org.id,
            newTrialEndsAt: trialEndsAt,
            reason: reason.trim() || "Manuelt justeret af superadmin",
          },
        });
      }
      toast.success("Organisation opdateret");
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke gemme ændringer");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md space-y-4 rounded-t-3xl p-5 sm:rounded-3xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Rediger abonnement</p>
            <h3 className="font-display text-lg font-bold">{org.name}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Plan (tier)</label>
            <select value={tier} onChange={(e) => setTier(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
              {Object.entries(TIER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Abonnementsstatus</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {status === "gratis" && (
              <div className="mt-2">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Årsag til gratis adgang <span className="text-destructive">*</span></label>
                <textarea
                  value={gratisReason}
                  onChange={(e) => setGratisReason(e.target.value)}
                  rows={2}
                  placeholder="Fx: Partner-aftale, NGO, udviklingstestorg…"
                  className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:border-ring focus:outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Prøveperiode udløber</label>
            <input
              type="date"
              value={trialEndsAt}
              onChange={(e) => setTrialEndsAt(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Sæt til en fremtidig dato for at udvide. Ændring kræver årsag nedenfor.
            </p>
          </div>

          {needsReason && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Årsag til ændring <span className="text-destructive">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Fx: Kundeservice-aftale, tech-support, partneranmodning…"
                className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:border-ring focus:outline-none"
              />
              <p className="mt-1 text-xs text-muted-foreground">Logges i audit-loggen. Min. 5 tegn.</p>
            </div>
          )}
        </div>

        {/* require_2fa toggle — saves immediately */}
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3">
          <div>
            <p className="text-sm font-medium">Kræv 2FA for alle brugere</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Brugere skal opsætte 2FA for at få adgang.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={require2fa}
            disabled={saving2fa}
            onClick={async () => {
              const next = !require2fa;
              setRequire2fa(next);
              setSaving2fa(true);
              try {
                await superadminSetRequire2fa({ data: { accessToken, orgId: org.id, require2fa: next } });
              } catch (err: any) {
                toast.error(err?.message ?? "Kunne ikke gemme.");
                setRequire2fa(!next);
              } finally {
                setSaving2fa(false);
              }
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${require2fa ? "bg-primary" : "bg-muted"}`}
          >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${require2fa ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {(org.stripe_customer_id || org.stripe_subscription_id) && (
          <div className="rounded-xl border border-border bg-surface/50 p-3 text-xs text-muted-foreground">
            {org.stripe_customer_id && (
              <p>Kunde: <a href={`https://dashboard.stripe.com/customers/${org.stripe_customer_id}`} target="_blank" rel="noopener noreferrer" className="font-mono underline hover:text-foreground">{org.stripe_customer_id}</a></p>
            )}
            {org.stripe_subscription_id && (
              <p className="mt-0.5">Abonnement: <a href={`https://dashboard.stripe.com/subscriptions/${org.stripe_subscription_id}`} target="_blank" rel="noopener noreferrer" className="font-mono underline hover:text-foreground">{org.stripe_subscription_id}</a></p>
            )}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-surface py-2 text-sm font-medium hover:bg-surface-elevated">
            Annullér
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
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
    } catch (err: any) { toast.error(`Brugere: ${err?.message ?? "Ukendt fejl"}`); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (reason: string) => {
    if (!deleteTarget) return;
    await superadminDeleteUser({ data: { accessToken, userId: deleteTarget.userId, reason } });
    toast.success("Bruger slettet");
    setDeleteTarget(null);
    load();
  };

  const filtrede = soeg
    ? users.filter(u => u.email.toLowerCase().includes(soeg.toLowerCase()) || u.orgName.toLowerCase().includes(soeg.toLowerCase()))
    : users;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Brugere</h2>
          <p className="text-sm text-muted-foreground">{users.length} aktive medlemskaber</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Opdater
        </button>
      </div>

      <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
        <strong>Dataminimering:</strong> Kun e-mail, organisation, rolle og tilmeldingsdato vises. Ingen navne, CPR eller andre personoplysninger.
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={soeg} onChange={(e) => setSoeg(e.target.value)} placeholder="Søg e-mail eller organisation…"
          className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm focus:border-ring focus:outline-none" />
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
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Indlæser…</td></tr>
              ) : filtrede.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Ingen brugere</td></tr>
              ) : (
                filtrede.map((u, i) => (
                  <tr key={`${u.userId}-${u.orgId}`} className={`border-b border-border/50 transition hover:bg-surface/40 ${i % 2 ? "bg-surface/20" : ""}`}>
                    <td className="px-4 py-3 font-mono text-xs">{u.email}</td>
                    <td className="px-4 py-3">{u.orgName}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${u.role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDato(u.createdAt)}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDeleteTarget(u)} title="Slet bruger" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
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
        <DeleteUserModal user={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} />
      )}
    </div>
  );
}

// ─── Delete user modal ────────────────────────────────────────────────────────

function DeleteUserModal({
  user, onClose, onConfirm,
}: { user: UserRow; onClose: () => void; onConfirm: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { reasonRef.current?.focus(); }, []);

  const handleConfirm = async () => {
    if (reason.trim().length < 5) { toast.error("Angiv venligst en årsag (min. 5 tegn)"); return; }
    setSaving(true);
    try { await onConfirm(reason.trim()); }
    catch (err: any) { toast.error(err?.message ?? "Kunne ikke slette bruger"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md space-y-4 rounded-t-3xl p-5 sm:rounded-3xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-destructive">Slet bruger</p>
            <h3 className="font-display text-lg font-bold">{user.email}</h3>
            <p className="text-sm text-muted-foreground">{user.orgName} · {ROLE_LABELS[user.role] ?? user.role}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          Brugeren mister adgang til alle organisationer. Handlingen kan ikke fortrydes. Logdata og fremmøderegistreringer bevares.
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Årsag til sletning <span className="text-destructive">*</span></label>
          <textarea ref={reasonRef} value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            placeholder="Fx: Brugerens anmodning om datasletning (GDPR art. 17)"
            className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:border-ring focus:outline-none" />
          <p className="mt-1 text-xs text-muted-foreground">Logges i audit-loggen. Minimum 5 tegn.</p>
        </div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border bg-surface py-2 text-sm font-medium hover:bg-surface-elevated">Annullér</button>
          <button onClick={handleConfirm} disabled={saving || reason.trim().length < 5} className="flex-1 rounded-xl bg-destructive py-2 text-sm font-semibold text-destructive-foreground disabled:opacity-50">
            {saving ? "Sletter…" : "Slet bruger"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Aktiveringsnøgler tab ────────────────────────────────────────────────────

function KeysTab({ accessToken }: { accessToken: string }) {
  const [keys, setKeys] = useState<PlanKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<PlanKey | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanKey | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [soeg, setSoeg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await superadminListPlanKeys({ data: { accessToken } }); setKeys(data as PlanKey[]); }
    catch (err: any) { toast.error(`Plan-nøgler: ${err?.message ?? "Ukendt fejl"}`); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const copyCode = async (key: PlanKey) => {
    await navigator.clipboard.writeText(key.code).catch(() => {});
    setCopiedId(key.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (key: PlanKey) => {
    try {
      await superadminDeletePlanKey({ data: { accessToken, keyId: key.id } });
      toast.success("Nøgle slettet");
      setDeleteTarget(null);
      load();
    } catch (err: any) { toast.error(err?.message ?? "Kunne ikke slette nøgle"); }
  };

  const promoKeys = keys.filter((k) => k.isPromo);
  const singleKeys = keys.filter((k) => !k.isPromo);
  const activePromo = promoKeys.filter((k) => {
    const notExpired = !k.expiresAt || new Date(k.expiresAt) > new Date();
    const notExhausted = k.maxUses === null || k.usesCount < k.maxUses;
    return notExpired && notExhausted;
  }).length;
  const unusedSingle = singleKeys.filter((k) => !k.used).length;

  const filtrede = soeg
    ? keys.filter((k) =>
        k.code.includes(soeg.toUpperCase()) ||
        (k.label ?? "").toLowerCase().includes(soeg.toLowerCase()) ||
        (k.usedByOrgName ?? "").toLowerCase().includes(soeg.toLowerCase())
      )
    : keys;

  const keyStatus = (k: PlanKey) => {
    if (k.isPromo) {
      const expired = k.expiresAt && new Date(k.expiresAt) < new Date();
      const exhausted = k.maxUses !== null && k.usesCount >= k.maxUses;
      if (expired) return { label: "Udløbet", cls: "bg-destructive/15 text-destructive" };
      if (exhausted) return { label: "Opbrugt", cls: "bg-muted text-muted-foreground" };
      return { label: "Aktiv", cls: "bg-success/15 text-success" };
    }
    return k.used
      ? { label: "Brugt", cls: "bg-muted text-muted-foreground" }
      : { label: "Ubrugt", cls: "bg-success/15 text-success" };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Aktiveringsnøgler</h2>
          <p className="text-sm text-muted-foreground">
            {singleKeys.length} engangskoder ({unusedSingle} ubrugte) · {promoKeys.length} kampagnekoder ({activePromo} aktive)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Opdater
          </button>
          <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
            <Plus className="h-4 w-4" /> Ny nøgle
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-surface/30 p-3 text-xs text-muted-foreground">
        <strong>Engangskoder</strong> aktiverer en plan for én organisation. <strong>Kampagnekoder</strong> kan indløses af mange organisationer og er ideelle til promo-kampagner.
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input type="search" value={soeg} onChange={(e) => setSoeg(e.target.value)}
          placeholder="Søg kode, label eller organisation…"
          className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm focus:border-ring focus:outline-none" />
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left">Kode</th>
                <th className="px-4 py-3 text-left">Label</th>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-right">Pris</th>
                <th className="px-4 py-3 text-left">Varighed</th>
                <th className="px-4 py-3 text-left">Brug</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Udløb</th>
                <th className="px-4 py-3 text-left">Oprettet</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">Indlæser…</td></tr>
              ) : filtrede.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-muted-foreground">
                  <Key className="mx-auto mb-3 h-8 w-8 opacity-30" />
                  {soeg ? "Ingen nøgler matcher søgningen" : "Ingen nøgler endnu. Klik \"Ny nøgle\" for at oprette."}
                </td></tr>
              ) : (
                filtrede.map((k, i) => {
                  const st = keyStatus(k);
                  return (
                    <tr key={k.id} className={`border-b border-border/50 transition hover:bg-surface/40 ${i % 2 ? "bg-surface/20" : ""}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs tracking-widest">{k.code}</span>
                          <button onClick={() => copyCode(k)} className="rounded p-0.5 text-muted-foreground hover:text-foreground">
                            {copiedId === k.id ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{k.label ?? <span className="italic">–</span>}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {TIER_LABELS[k.planType] ?? k.planType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${k.isPromo ? "bg-violet-500/15 text-violet-600" : "bg-surface text-muted-foreground border border-border"}`}>
                          {k.isPromo ? "Kampagne" : "Engangskode"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-medium">
                        {(() => {
                          const base = TIER_PRICES[k.planType] ?? 0;
                          if (k.priceDkk !== null) return <span>{fmtKr(k.priceDkk)}</span>;
                          if (k.discountPct !== null) return (
                            <span className="text-success">
                              {fmtKr(Math.round(base * (1 - k.discountPct / 100)))}
                              <span className="ml-1 text-muted-foreground opacity-70">-{k.discountPct}%</span>
                            </span>
                          );
                          return <span className="text-muted-foreground">{fmtKr(base)}</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {k.durationMonths !== null ? `${k.durationMonths} mdr.` : <span className="italic">Permanent</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {k.isPromo
                          ? `${k.usesCount}${k.maxUses !== null ? ` / ${k.maxUses}` : ""} indløsninger`
                          : k.usedByOrgName ? `${k.usedByOrgName}${k.usedAt ? ` · ${fmtDato(k.usedAt)}` : ""}` : "–"
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {k.expiresAt ? fmtDato(k.expiresAt) : "–"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDato(k.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setEditTarget(k)} className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-elevated">Rediger</button>
                          <button onClick={() => setDeleteTarget(k)} className="rounded-lg p-1.5 text-muted-foreground hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <PlanKeyModal
          accessToken={accessToken}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}
      {editTarget && (
        <PlanKeyModal
          accessToken={accessToken}
          planKey={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load(); }}
        />
      )}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="glass w-full max-w-sm rounded-3xl p-6 shadow-card">
            <h3 className="font-display text-lg font-bold">Slet nøgle?</h3>
            <p className="mt-2 text-sm text-muted-foreground font-mono">{deleteTarget.code}</p>
            {deleteTarget.isPromo && deleteTarget.usesCount > 0 && (
              <p className="mt-1 text-xs text-warning">Denne kampagnekode er brugt {deleteTarget.usesCount} gang(e).</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">Annuller</button>
              <button onClick={() => handleDelete(deleteTarget)} className="rounded-xl bg-destructive px-4 py-2 text-sm font-semibold text-white">Slet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlanKeyModal({ accessToken, planKey, onClose, onSaved }: {
  accessToken: string;
  planKey?: PlanKey;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!planKey;
  const [planType, setPlanType] = useState<(typeof KEY_PLAN_TYPES)[number]>(
    isEdit && (KEY_PLAN_TYPES as readonly string[]).includes(planKey.planType)
      ? planKey.planType as (typeof KEY_PLAN_TYPES)[number]
      : "pro"
  );
  const [label, setLabel] = useState(planKey?.label ?? "");
  const [isPromo, setIsPromo] = useState(planKey?.isPromo ?? false);
  const [maxUses, setMaxUses] = useState<string>(planKey?.maxUses?.toString() ?? "");
  const [expiresAt, setExpiresAt] = useState(planKey?.expiresAt?.slice(0, 10) ?? "");
  const [priceDkk, setPriceDkk] = useState<string>(planKey?.priceDkk?.toString() ?? "");
  const [discountPct, setDiscountPct] = useState<string>(planKey?.discountPct?.toString() ?? "");
  const [durationMonths, setDurationMonths] = useState<string>(planKey?.durationMonths?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copiedGenerated, setCopiedGenerated] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const maxUsesNum = maxUses.trim() ? parseInt(maxUses, 10) : null;
      const expiresAtVal = expiresAt ? new Date(expiresAt).toISOString() : null;
      const priceDkkNum = priceDkk.trim() ? parseInt(priceDkk, 10) : null;
      const discountPctNum = discountPct.trim() ? parseInt(discountPct, 10) : null;
      const durationMonthsNum = durationMonths.trim() ? parseInt(durationMonths, 10) : null;

      if (isEdit && planKey) {
        await superadminUpdatePlanKey({
          data: {
            accessToken,
            keyId: planKey.id,
            planType,
            label: label.trim() || undefined,
            isPromo,
            maxUses: isPromo ? maxUsesNum : null,
            expiresAt: isPromo ? expiresAtVal : null,
            priceDkk: priceDkkNum,
            discountPct: discountPctNum,
            durationMonths: durationMonthsNum,
          },
        });
        toast.success("Nøgle opdateret");
        onSaved();
      } else {
        const result = await superadminGeneratePlanKey({
          data: {
            accessToken,
            planType,
            label: label.trim() || undefined,
            isPromo,
            maxUses: isPromo ? maxUsesNum : null,
            expiresAt: isPromo ? expiresAtVal : null,
            priceDkk: priceDkkNum,
            discountPct: discountPctNum,
            durationMonths: durationMonthsNum,
          },
        });
        const code = (result as any).code as string;
        await navigator.clipboard.writeText(code).catch(() => {});
        setGeneratedCode(code);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Ukendt fejl");
    } finally {
      setSaving(false);
    }
  };

  const copyGenerated = async () => {
    if (!generatedCode) return;
    await navigator.clipboard.writeText(generatedCode).catch(() => {});
    setCopiedGenerated(true);
    setTimeout(() => setCopiedGenerated(false), 2000);
  };

  if (generatedCode) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="glass w-full max-w-sm rounded-3xl p-6 shadow-card text-center">
          <div className="mb-3 text-4xl">🎉</div>
          <h3 className="font-display text-lg font-bold">Nøgle oprettet</h3>
          <p className="mt-1 text-sm text-muted-foreground">{isPromo ? "Kampagnekode" : "Engangskode"} · {TIER_LABELS[planType]}</p>
          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-border bg-surface p-3">
            <span className="font-mono text-lg tracking-widest font-semibold">{generatedCode}</span>
            <button onClick={copyGenerated} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground">
              {copiedGenerated ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Koden er kopieret til udklipsholderen.</p>
          <button onClick={onSaved} className="mt-5 w-full rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground">
            Luk
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="glass w-full max-w-md rounded-3xl p-6 shadow-card">
        <h3 className="font-display text-lg font-bold">{isEdit ? "Rediger nøgle" : "Ny aktiveringsnøgle"}</h3>
        {isEdit && <p className="mt-1 font-mono text-xs text-muted-foreground">{planKey.code}</p>}

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Plan</label>
              <select value={planType} onChange={(e) => setPlanType(e.target.value as any)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
                {KEY_PLAN_TYPES.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Label</label>
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="F.eks. Black Friday…"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setIsPromo(false)}
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${!isPromo ? "border-primary bg-primary/10 text-primary" : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated"}`}>
                <div className="font-semibold">Engangskode</div>
                <div className="mt-0.5 text-xs opacity-70">Bruges én gang af én organisation</div>
              </button>
              <button type="button" onClick={() => setIsPromo(true)}
                className={`rounded-xl border px-4 py-3 text-sm font-medium transition ${isPromo ? "border-violet-500 bg-violet-500/10 text-violet-600" : "border-border bg-surface text-muted-foreground hover:bg-surface-elevated"}`}>
                <div className="font-semibold">Kampagnekode</div>
                <div className="mt-0.5 text-xs opacity-70">Kan bruges af mange organisationer</div>
              </button>
            </div>
          </div>

          {isPromo && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Maks. indløsninger</label>
                <input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)}
                  placeholder="Ubegrænset"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">Udløbsdato</label>
                <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Pris (kr./md.)</label>
              <input type="number" min="0" value={priceDkk} onChange={(e) => { setPriceDkk(e.target.value); if (e.target.value) setDiscountPct(""); }}
                placeholder={`Standard ${fmtKr(TIER_PRICES[planType] ?? 0)}`}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Rabat %</label>
              <input type="number" min="0" max="100" value={discountPct} onChange={(e) => { setDiscountPct(e.target.value); if (e.target.value) setPriceDkk(""); }}
                placeholder="0%"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Varighed</label>
            <div className="flex items-center gap-2">
              <input type="number" min="1" value={durationMonths} onChange={(e) => setDurationMonths(e.target.value)}
                placeholder="Permanent"
                className="w-32 rounded-xl border border-input bg-background px-3 py-2 text-sm" />
              <span className="text-sm text-muted-foreground">måneder</span>
              {durationMonths && !isNaN(parseInt(durationMonths, 10)) && (() => {
                const d = new Date();
                d.setMonth(d.getMonth() + parseInt(durationMonths, 10));
                return <span className="text-xs text-muted-foreground">→ udløber {d.toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}</span>;
              })()}
            </div>
            {!durationMonths && <p className="mt-1 text-xs text-muted-foreground">Tomt = prisen gælder permanent.</p>}
          </div>

          {(priceDkk || discountPct) && (
            <div className="rounded-xl bg-surface px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">Effektiv pris: </span>
              <span className="font-semibold text-success">
                {priceDkk
                  ? fmtKr(parseInt(priceDkk, 10) || 0)
                  : fmtKr(Math.round((TIER_PRICES[planType] ?? 0) * (1 - (parseInt(discountPct, 10) || 0) / 100)))
                }
                {durationMonths ? ` · ${durationMonths} mdr.` : " · permanent"}
              </span>
              {discountPct && !priceDkk && (
                <span className="ml-2 text-xs text-muted-foreground line-through">{fmtKr(TIER_PRICES[planType] ?? 0)}</span>
              )}
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm">Annuller</button>
          <button onClick={handleSave} disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
            <Save className="h-4 w-4" /> {saving ? "Gemmer…" : isEdit ? "Gem" : "Generer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Misc. Planer tab ─────────────────────────────────────────────────────────

type OrgName = { id: string; name: string };

function MiscPlansTab({ accessToken }: { accessToken: string }) {
  const [plans, setPlans] = useState<CustomPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<CustomPlan | null>(null);
  const [soeg, setSoeg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await superadminListCustomPlans({ data: { accessToken } });
      setPlans(data as CustomPlan[]);
    } catch (err: any) {
      toast.error(`Misc. planer: ${err?.message ?? "Ukendt fejl"}`);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const filtrede = soeg
    ? plans.filter(p =>
        (p.org_name ?? "").toLowerCase().includes(soeg.toLowerCase()) ||
        p.name.toLowerCase().includes(soeg.toLowerCase())
      )
    : plans;

  const activePlans = plans.filter(p => p.status === "active");
  const totalMRRMisc = activePlans.reduce((s, p) => s + p.price_dkk, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Misc. Planer</h2>
          <p className="text-sm text-muted-foreground">
            {plans.length} planer · {activePlans.length} aktive · MRR: {fmtKr(totalMRRMisc)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Opdater
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            <Plus className="h-4 w-4" /> Ny plan
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border/50 bg-surface/30 p-3 text-xs text-muted-foreground">
        <strong>Misc. planer</strong> er skræddersyede aftaler med specifikke organisationer — fx partnere, kommuner eller NGO'er med særlige betingelser der ikke passer i standard-planerne.
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={soeg}
          onChange={(e) => setSoeg(e.target.value)}
          placeholder="Søg organisation eller plan…"
          className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm focus:border-ring focus:outline-none"
        />
      </div>

      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left">Organisation</th>
                <th className="px-4 py-3 text-left">Plannavn</th>
                <th className="px-4 py-3 text-right">Pris/md</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Periode</th>
                <th className="px-4 py-3 text-left">Oprettet</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Indlæser…</td></tr>
              ) : filtrede.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    <Layers className="mx-auto mb-3 h-8 w-8 opacity-30" />
                    {soeg ? "Ingen planer matcher søgningen" : "Ingen misc. planer endnu. Klik \"Ny plan\" for at oprette den første."}
                  </td>
                </tr>
              ) : (
                filtrede.map((p, i) => (
                  <tr key={p.id} className={`border-b border-border/50 transition hover:bg-surface/40 ${i % 2 ? "bg-surface/20" : ""}`}>
                    <td className="px-4 py-3 font-medium">{p.org_name ?? <span className="text-muted-foreground italic">–</span>}</td>
                    <td className="px-4 py-3">
                      {p.name}
                      {p.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{p.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {p.price_dkk > 0 ? fmtKr(p.price_dkk) : <span className="text-muted-foreground">0 kr.</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CUSTOM_PLAN_STATUS_COLORS[p.status] ?? "bg-muted text-muted-foreground"}`}>
                        {CUSTOM_PLAN_STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <CalendarDays className="h-3 w-3 shrink-0" />
                        {fmtDato(p.start_date)}
                        {p.end_date ? ` → ${fmtDato(p.end_date)}` : " →"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDato(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditTarget(p)}
                        className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-elevated"
                      >
                        Rediger
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <CustomPlanModal
          accessToken={accessToken}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}

      {editTarget && (
        <CustomPlanModal
          accessToken={accessToken}
          plan={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Custom plan modal (create + edit) ───────────────────────────────────────

function CustomPlanModal({
  accessToken,
  plan,
  onClose,
  onSaved,
}: {
  accessToken: string;
  plan?: CustomPlan;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!plan;

  const [orgNames, setOrgNames] = useState<OrgName[]>([]);
  const [orgId, setOrgId] = useState(plan?.organization_id ?? "");
  const [name, setName] = useState(plan?.name ?? "");
  const [priceDkk, setPriceDkk] = useState(plan?.price_dkk ?? 0);
  const [description, setDescription] = useState(plan?.description ?? "");
  const [stripePriceId, setStripePriceId] = useState(plan?.stripe_price_id ?? "");
  const [startDate, setStartDate] = useState(plan?.start_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(plan?.end_date?.slice(0, 10) ?? "");
  const [status, setStatus] = useState(plan?.status ?? "active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    superadminListOrgNames({ data: { accessToken } })
      .then((d) => {
        setOrgNames(d as OrgName[]);
        if (!isEdit && d.length > 0 && !orgId) setOrgId((d[0] as OrgName).id);
      })
      .catch(() => {});
  }, [accessToken, isEdit, orgId]);

  const canSave = orgId && name.trim().length >= 2 && startDate;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit && plan) {
        await superadminUpdateCustomPlan({
          data: {
            accessToken,
            planId: plan.id,
            name: name.trim(),
            price_dkk: priceDkk,
            description: description.trim() || undefined,
            stripe_price_id: stripePriceId.trim() || undefined,
            start_date: startDate,
            end_date: endDate || undefined,
            status: status as any,
          },
        });
        toast.success("Plan opdateret");
      } else {
        await superadminCreateCustomPlan({
          data: {
            accessToken,
            organizationId: orgId,
            name: name.trim(),
            price_dkk: priceDkk,
            description: description.trim() || undefined,
            stripe_price_id: stripePriceId.trim() || undefined,
            start_date: startDate,
            end_date: endDate || undefined,
          },
        });
        toast.success("Plan oprettet");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke gemme plan");
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
        className="glass w-full max-w-lg space-y-4 rounded-t-3xl p-5 sm:rounded-3xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {isEdit ? "Rediger" : "Opret"} misc. plan
            </p>
            <h3 className="font-display text-lg font-bold">
              {isEdit ? plan!.name : "Ny bespoke plan"}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {!isEdit && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Organisation <span className="text-destructive">*</span>
              </label>
              <select
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
              >
                {orgNames.length === 0 && <option value="">Indlæser…</option>}
                {orgNames.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Plannavn <span className="text-destructive">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Fx: Partner-aftale 2026, NGO-rabat, Skole-pakke…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Pris pr. måned (DKK)</label>
            <input
              type="number"
              min={0}
              value={priceDkk}
              onChange={(e) => setPriceDkk(parseInt(e.target.value) || 0)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
            />
            <p className="mt-1 text-xs text-muted-foreground">Sæt til 0 for gratis/non-profit aftaler.</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Beskrivelse (valgfri)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Aftalens vilkår, kontaktperson, kontraktreference…"
              className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:border-ring focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Stripe Price ID (valgfri)
            </label>
            <input
              value={stripePriceId}
              onChange={(e) => setStripePriceId(e.target.value)}
              placeholder="price_xxxxxxxxxxxxxxxxxx"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 font-mono text-sm focus:border-ring focus:outline-none"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Find i{" "}
              <a
                href="https://dashboard.stripe.com/products"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Stripe Dashboard → Produkter
              </a>
              {" "}→ åbn produktet → kopiér Price ID fra den relevante pris.
              Bruges når organisationen køber via Stripe checkout.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Startdato <span className="text-destructive">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Slutdato (valgfri)</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>

          {isEdit && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
              >
                {Object.entries(CUSTOM_PLAN_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-surface py-2 text-sm font-medium hover:bg-surface-elevated"
          >
            Annullér
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            className="flex-1 rounded-xl bg-gradient-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "Gemmer…" : isEdit ? "Gem ændringer" : "Opret plan"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Anmeldelser tab ──────────────────────────────────────────────────────────

const ORG_TYPE_REVIEW_LABELS: Record<string, string> = {
  sfo: "SFO / Fritidsklub",
  sportsklub: "Sportsklub",
  butik: "Butik",
  andet: "Andet",
};

function AnmeldelserTab({ accessToken }: { accessToken: string }) {
  type Review = { id: string; stars: number; name: string | null; org_type: string | null; review_text: string | null; gdpr_consent: boolean; approved: boolean; created_at: string };
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await superadminListReviews({ data: { accessToken } });
      setReviews(data as Review[]);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: string) => {
    setWorking(id);
    try {
      await superadminApproveReview({ data: { accessToken, reviewId: id } });
      setReviews((prev) => prev.map((r) => r.id === id ? { ...r, approved: true } : r));
    } catch (err: any) { alert(err?.message ?? "Fejl"); }
    finally { setWorking(null); }
  };

  const remove = async (id: string) => {
    if (!confirm("Slet denne anmeldelse permanent?")) return;
    setWorking(id);
    try {
      await superadminDeleteReview({ data: { accessToken, reviewId: id } });
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (err: any) { alert(err?.message ?? "Fejl"); }
    finally { setWorking(null); }
  };

  const pending = reviews.filter((r) => !r.approved);
  const approved = reviews.filter((r) => r.approved);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Anmeldelser</h2>
          <p className="text-sm text-muted-foreground">
            {pending.length} afventer godkendelse · {approved.length} publiceret
          </p>
        </div>
        <button onClick={load} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-12">Indlæser…</div>
      ) : (
        <>
          {pending.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Afventer godkendelse ({pending.length})</h3>
              <div className="space-y-3">
                {pending.map((r) => (
                  <div key={r.id} className="glass rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map((s) => (
                              <Star key={s} className={`h-4 w-4 ${s <= r.stars ? "text-warning fill-warning" : "text-muted"}`} />
                            ))}
                          </div>
                          <span className="text-sm font-semibold">{r.name || "Anonym"}</span>
                          {r.org_type && (
                            <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted-foreground">
                              {ORG_TYPE_REVIEW_LABELS[r.org_type] ?? r.org_type}
                            </span>
                          )}
                        </div>
                        {r.review_text && <p className="text-sm text-muted-foreground leading-relaxed">{r.review_text}</p>}
                        <p className="mt-2 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("da-DK", { day: "numeric", month: "long", year: "numeric" })}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => approve(r.id)}
                          disabled={working === r.id}
                          className="flex items-center gap-1.5 rounded-xl bg-success/15 px-3 py-2 text-xs font-semibold text-success hover:bg-success/25 disabled:opacity-50"
                        >
                          <ThumbsUp className="h-3.5 w-3.5" /> Godkend
                        </button>
                        <button
                          onClick={() => remove(r.id)}
                          disabled={working === r.id}
                          className="flex items-center gap-1.5 rounded-xl bg-destructive/15 px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/25 disabled:opacity-50"
                        >
                          <ThumbsDown className="h-3.5 w-3.5" /> Afvis
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {approved.length > 0 && (
            <section>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">Publiceret ({approved.length})</h3>
              <div className="glass overflow-hidden rounded-2xl">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-3">Stjerner</th>
                      <th className="px-4 py-3">Navn</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Anmeldelse</th>
                      <th className="px-4 py-3">Dato</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {approved.map((r) => (
                      <tr key={r.id} className="hover:bg-surface/50">
                        <td className="px-4 py-3">
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map((s) => (
                              <Star key={s} className={`h-3.5 w-3.5 ${s <= r.stars ? "text-warning fill-warning" : "text-muted"}`} />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium">{r.name || "Anonym"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.org_type ? (ORG_TYPE_REVIEW_LABELS[r.org_type] ?? r.org_type) : "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{r.review_text || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleDateString("da-DK")}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => remove(r.id)}
                            disabled={working === r.id}
                            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {reviews.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <Star className="mx-auto mb-3 h-8 w-8 opacity-30" />
              <p className="text-sm">Ingen anmeldelser endnu</p>
            </div>
          )}
        </>
      )}
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
    try { const data = await superadminListAuditLog({ data: { accessToken } }); setEntries(data as AuditEntry[]); }
    catch (err: any) { toast.error(`Handlingslog: ${err?.message ?? "Ukendt fejl"}`); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Handlingslog</h2>
          <p className="text-sm text-muted-foreground">Alle superadmin-handlinger · nyeste øverst</p>
        </div>
        <button onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated">
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
                    <tr key={e.id} className={`border-b border-border/50 transition hover:bg-surface/40 ${i % 2 ? "bg-surface/20" : ""}`}>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{fmtTidspunkt(e.createdAt)}</td>
                      <td className="px-4 py-3 font-medium">{EVENT_LABELS[e.event] ?? e.event}</td>
                      <td className="px-4 py-3 text-muted-foreground">{e.orgName ?? "–"}</td>
                      <td className="px-4 py-3">
                        {e.metadata && Object.keys(e.metadata).length > 1 && (
                          <button onClick={() => setExpanded(expanded === e.id ? null : e.id)} className="text-xs text-primary hover:underline">
                            {expanded === e.id ? "Skjul" : "Vis"}
                          </button>
                        )}
                        {e.event === "SUPERADMIN_DELETE_USER" && !!(e.metadata?.reason) && (
                          <span className="text-xs text-muted-foreground"> · {String(e.metadata.reason).slice(0, 50)}{String(e.metadata.reason).length > 50 ? "…" : ""}</span>
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
