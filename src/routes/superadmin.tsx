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
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Minus,
  Pencil,
  Save,
  Layers,
  CalendarDays,
  HeartPulse,
  ChevronDown,
  ChevronUp,
  StickyNote,
  ShieldAlert,
  Lock,
  FileCheck,
  Clock,
  Server,
  Database,
  ToggleLeft,
  ToggleRight,
  Settings2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  LineChart,
  ReferenceLine,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
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
  superadminListAuditLog,
  superadminListCustomPlans,
  superadminCreateCustomPlan,
  superadminUpdateCustomPlan,
  superadminListOrgNames,
  superadminListOrgNotes,
  superadminSaveOrgNote,
  superadminGetCustomerSuccess,
  superadminGetSecurityData,
  superadminCreateGdprRequest,
  superadminUpdateGdprRequest,
  superadminGetOpsData,
  superadminSetAppSetting,
  type DashboardOrg,
  type MonthlyCost,
  type CustomPlan,
  type OrgNote,
  type OrgHealthData,
  type GdprRequest,
  type AuthSecuritySummary,
  type DbTableStat,
  type AppSetting,
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
  gratis_reason: string | null;
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

type DashboardData = {
  orgs: DashboardOrg[];
  orgMemberCounts: Record<string, number>;
  totalMembers: number;
  totalAttendanceRecords: number;
  totalTimeLogs: number;
  costs: MonthlyCost[];
  lastActivityByOrg: Record<string, string>;
  orgsWithCheckinCount: number;
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
  SUPERADMIN_SAVE_ORG_NOTE: "Gemte organisations-note",
  SUPERADMIN_CREATE_GDPR_REQUEST: "Oprettede GDPR-anmodning",
  SUPERADMIN_UPDATE_GDPR_REQUEST: "Opdaterede GDPR-anmodning",
  SUPERADMIN_SET_APP_SETTING: "Opdaterede app-indstilling",
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
  { id: "orgs", label: "Organisationer", icon: Building2 },
  { id: "kunder", label: "Kunder", icon: HeartPulse },
  { id: "users", label: "Brugere", icon: Users },
  { id: "keys", label: "Plan-nøgler", icon: Key },
  { id: "misc", label: "Misc. Planer", icon: Layers },
  { id: "sikkerhed", label: "Sikkerhed", icon: ShieldAlert },
  { id: "drift", label: "Drift", icon: Server },
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
    } catch {
      toast.error("Kunne ikke indlæse organisationer");
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
        {activeTab === "orgs" && (
          <OrgsTab orgs={orgs} loading={orgsLoading} onEdit={setEditOrg} onRefresh={loadOrgs} />
        )}
        {activeTab === "kunder" && <CustomersTab accessToken={accessToken} />}
        {activeTab === "users" && <UsersTab accessToken={accessToken} />}
        {activeTab === "keys" && <KeysTab accessToken={accessToken} />}
        {activeTab === "misc" && <MiscPlansTab accessToken={accessToken} />}
        {activeTab === "sikkerhed" && <SecurityTab accessToken={accessToken} />}
        {activeTab === "drift" && <DriftTab accessToken={accessToken} />}
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

function DashboardTab({ accessToken }: { accessToken: string }) {
  const [dashData, setDashData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [editingCosts, setEditingCosts] = useState(false);
  const [costDraft, setCostDraft] = useState<CostDraft[]>([]);
  const [savingCosts, setSavingCosts] = useState(false);
  const [orgNotes, setOrgNotes] = useState<Record<string, OrgNote>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, notes] = await Promise.all([
        superadminGetDashboard({ data: { accessToken } }),
        superadminListOrgNotes({ data: { accessToken } }).catch(() => ({})),
      ]);
      setDashData(result as DashboardData);
      setOrgNotes((notes ?? {}) as Record<string, OrgNote>);
    } catch {
      toast.error("Kunne ikke indlæse dashboard");
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

  // ── BI: Churn prediction — trials expiring within 3 days with no paid sub ──
  const d3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const churnRisk = trialingOrgs.filter(
    o => o.trial_ends_at && new Date(o.trial_ends_at) <= d3,
  );

  // ── BI: Revenue forecast — linear growth extrapolation ────────────────────
  const last3PayingPerMonth = Array.from({ length: 3 }, (_, i) => {
    const key = new Date(now.getFullYear(), now.getMonth() - 2 + i, 1).toISOString().slice(0, 7);
    return activePayingOrgs.filter(o => o.created_at.slice(0, 7) === key).length;
  });
  const avgMonthlyNewPaying = last3PayingPerMonth.reduce((a, b) => a + b, 0) / 3;
  const monthlyGrowthRate = activePayingOrgs.length > 0 ? avgMonthlyNewPaying / activePayingOrgs.length : 0;
  const forecastData = Array.from({ length: 4 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    return {
      month: i === 0
        ? "Nu"
        : d.toLocaleDateString("da-DK", { month: "short", year: "2-digit" }),
      mrr: Math.round(totalMRR * Math.pow(1 + monthlyGrowthRate, i)),
      projected: i > 0,
    };
  });

  // ── BI: Inactive orgs — last activity > 14 days ago (previously active only) ─
  const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const lastActivity = dashData.lastActivityByOrg;
  const inactiveOrgs = orgs.filter(
    o => lastActivity[o.id] && new Date(lastActivity[o.id]) < d14,
  );

  // ── BI: Conversion funnel ─────────────────────────────────────────────────
  const funnelSteps = [
    { label: "Tilmeldinger", count: orgs.length },
    { label: "Har personale", count: orgs.filter(o => (dashData.orgMemberCounts[o.id] ?? 0) > 0).length },
    { label: "Brugt appen", count: dashData.orgsWithCheckinCount },
    { label: "Betalende", count: activePayingOrgs.length },
  ];

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

      {/* ── BI: Churn prediction ── */}
      <section>
        <h2 className="mb-1 font-display text-xl font-bold">Udløber snart</h2>
        <p className="mb-3 text-sm text-muted-foreground">Prøveperioder der udløber inden for 3 dage uden aktivt abonnement</p>
        {churnRisk.length === 0 ? (
          <div className="glass rounded-2xl px-5 py-6 text-sm text-muted-foreground">
            Ingen prøveperioder i kritisk zone ✓
          </div>
        ) : (
          <div className="glass overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left">Organisation</th>
                  <th className="px-4 py-3 text-left">Prøveperiode udløber</th>
                  <th className="px-4 py-3 text-left">Dage tilbage</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {churnRisk.map((org, i) => {
                  const daysLeft = Math.ceil(
                    (new Date(org.trial_ends_at!).getTime() - now.getTime()) / 86_400_000,
                  );
                  return (
                    <tr key={org.id} className={`border-b border-border/50 ${i % 2 ? "bg-surface/20" : ""}`}>
                      <td className="px-4 py-3 font-medium">{org.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDato(org.trial_ends_at!)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          daysLeft <= 1 ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
                        }`}>
                          {daysLeft <= 0 ? "Udløbet" : `${daysLeft} dag${daysLeft === 1 ? "" : "e"}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <QuickExtendButton
                          orgId={org.id}
                          accessToken={accessToken}
                          onDone={load}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── BI: Revenue forecast ── */}
      <section>
        <h2 className="mb-1 font-display text-xl font-bold">Omsætningsprognose</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Fremskrevet MRR de næste 3 måneder baseret på nuværende vækstrate
          {monthlyGrowthRate > 0 && (
            <span className="ml-2 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
              +{(monthlyGrowthRate * 100).toFixed(1)}%/md
            </span>
          )}
        </p>
        <div className="glass rounded-2xl p-5">
          {totalMRR === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Ingen betalende kunder endnu — prognose ikke tilgængelig</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={forecastData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  formatter={(v: number) => [fmtKr(v), "MRR"]}
                  contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                />
                <ReferenceLine x="Nu" stroke="hsl(var(--border))" strokeDasharray="4 2" />
                <Bar
                  dataKey="mrr"
                  name="MRR"
                  radius={[4, 4, 0, 0]}
                  fill="hsl(var(--primary))"
                  fillOpacity={forecastData.map(d => d.projected ? 0.45 : 1) as any}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
          <p className="mt-2 text-center text-xs text-muted-foreground opacity-60">
            Prognosen er baseret på aggregerede abonnementsdata — ingen persondata indgår
          </p>
        </div>
      </section>

      {/* ── BI: Inactive organisations ── */}
      <section>
        <h2 className="mb-1 font-display text-xl font-bold">Inaktive organisationer</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Organisationer med aktivitet tidligere, men ingen check-ins de seneste 14 dage
        </p>
        {inactiveOrgs.length === 0 ? (
          <div className="glass rounded-2xl px-5 py-6 text-sm text-muted-foreground">
            {Object.keys(lastActivity).length === 0
              ? "Aktivitetsdata ikke tilgængeligt endnu — kør migration 20260509260000"
              : "Ingen tidligere aktive organisationer er inaktive ✓"}
          </div>
        ) : (
          <div className="glass overflow-hidden rounded-2xl">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 text-left">Organisation</th>
                  <th className="px-4 py-3 text-left">Seneste aktivitet</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Opfølgningsnote</th>
                </tr>
              </thead>
              <tbody>
                {inactiveOrgs.map((org, i) => (
                  <tr key={org.id} className={`border-b border-border/50 align-top ${i % 2 ? "bg-surface/20" : ""}`}>
                    <td className="px-4 py-3 font-medium">{org.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {fmtDato(lastActivity[org.id])}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[org.subscription_status] ?? "bg-muted text-muted-foreground"}`}>
                        {STATUS_LABELS[org.subscription_status] ?? org.subscription_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <InlineNoteEditor
                        orgId={org.id}
                        initialNote={orgNotes[org.id]?.note ?? ""}
                        savedAt={orgNotes[org.id]?.created_at}
                        accessToken={accessToken}
                        onSaved={(note) =>
                          setOrgNotes((prev) => ({
                            ...prev,
                            [org.id]: {
                              ...(prev[org.id] ?? { id: "", organization_id: org.id, created_by: null }),
                              note,
                              created_at: new Date().toISOString(),
                            },
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── BI: Conversion funnel ── */}
      <section>
        <h2 className="mb-1 font-display text-xl font-bold">Konverteringstragt</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Aggregerede tal — ingen individuelle brugerdata
        </p>
        <div className="glass space-y-2 rounded-2xl p-5">
          {funnelSteps.map((step, i) => {
            const pct = funnelSteps[0].count > 0
              ? Math.round((step.count / funnelSteps[0].count) * 100)
              : 0;
            const colors = ["bg-primary", "bg-primary/70", "bg-primary/50", "bg-success"];
            return (
              <div key={step.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium">{step.label}</span>
                  <span className="text-muted-foreground">
                    {step.count} <span className="text-xs">({pct}%)</span>
                  </span>
                </div>
                <div className="h-7 w-full overflow-hidden rounded-lg bg-surface">
                  <div
                    className={`h-full rounded-lg ${colors[i]} flex items-center justify-end pr-2 transition-all`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                {i < funnelSteps.length - 1 && funnelSteps[0].count > 0 && (
                  <p className="mt-0.5 text-right text-xs text-muted-foreground">
                    ↓ {Math.round((funnelSteps[i + 1].count / (funnelSteps[i].count || 1)) * 100)}% fortsætter
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─── BI helper: Quick trial extend ───────────────────────────────────────────

function QuickExtendButton({
  orgId,
  accessToken,
  onDone,
}: {
  orgId: string;
  accessToken: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-elevated"
      >
        Forlæng prøveperiode
      </button>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    try {
      await superadminExtendTrial({
        data: {
          accessToken,
          orgId,
          newTrialEndsAt: newDate,
          reason: "Forlænget fra churn-prediction panel",
        },
      });
      toast.success("Prøveperiode forlænget");
      setOpen(false);
      onDone();
    } catch (err: any) {
      toast.error(err?.message ?? "Fejl ved forlængelse");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={newDate}
        onChange={(e) => setNewDate(e.target.value)}
        className="rounded-lg border border-input bg-background px-2 py-1 text-xs focus:outline-none"
      />
      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg bg-gradient-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
      >
        {saving ? "…" : "Gem"}
      </button>
      <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── BI helper: Inline org note editor ───────────────────────────────────────

function InlineNoteEditor({
  orgId,
  initialNote,
  savedAt,
  accessToken,
  onSaved,
}: {
  orgId: string;
  initialNote: string;
  savedAt?: string;
  accessToken: string;
  onSaved: (note: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialNote);
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <div className="flex items-start gap-2">
        <p className={`flex-1 text-xs ${initialNote ? "text-foreground" : "text-muted-foreground italic"}`}>
          {initialNote || "Ingen note endnu"}
          {savedAt && <span className="ml-1 opacity-50">· {fmtDato(savedAt)}</span>}
        </p>
        <button
          onClick={() => { setDraft(initialNote); setEditing(true); }}
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
    );
  }

  const handleSave = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    try {
      await superadminSaveOrgNote({ data: { accessToken, orgId, note: draft.trim() } });
      onSaved(draft.trim());
      setEditing(false);
      toast.success("Note gemt");
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke gemme note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] text-warning">Kun organisatoriske noter — ingen personoplysninger om børn eller brugere</p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Fx: Kontaktet direktør 9. maj — interesseret i kommune-plan"
        className="w-full rounded-lg border border-input bg-background p-2 text-xs focus:border-ring focus:outline-none"
        autoFocus
      />
      <div className="flex gap-1.5">
        <button
          onClick={handleSave}
          disabled={saving || !draft.trim()}
          className="inline-flex items-center gap-1 rounded-lg bg-gradient-primary px-2 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
        >
          <Save className="h-3 w-3" /> {saving ? "…" : "Gem"}
        </button>
        <button
          onClick={() => setEditing(false)}
          className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-surface-elevated"
        >
          Annullér
        </button>
      </div>
    </div>
  );
}

// ─── Customer success tab ─────────────────────────────────────────────────────

const ONBOARDING_LABELS = [
  "Organisation oprettet",
  "Første personale tilføjet",
  "Første medlem tilføjet",
  "Første check-in gennemført",
  "Aktivt abonnement",
];

const HEALTH_COLORS = {
  green: { badge: "bg-success/15 text-success", dot: "bg-success" },
  yellow: { badge: "bg-warning/15 text-warning", dot: "bg-warning" },
  red: { badge: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
};

function OnboardingBar({ score, steps }: { score: number; steps: Record<string, boolean> }) {
  const vals = Object.values(steps);
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {vals.map((done, i) => (
          <div
            key={i}
            className={`h-2 w-4 rounded-sm ${done ? "bg-primary" : "bg-surface"}`}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground">{score}/5</span>
    </div>
  );
}

function CustomersTab({ accessToken }: { accessToken: string }) {
  const [orgs, setOrgs] = useState<OrgHealthData[]>([]);
  const [loading, setLoading] = useState(true);
  const [soeg, setSoeg] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [inactiveOpen, setInactiveOpen] = useState(true);
  const [localNotes, setLocalNotes] = useState<Record<string, OrgNote>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await superadminGetCustomerSuccess({ data: { accessToken } });
      const list = data as OrgHealthData[];
      setOrgs(list);
      const seeded: Record<string, OrgNote> = {};
      for (const o of list) {
        if (o.latestNote) seeded[o.id] = o.latestNote;
      }
      setLocalNotes(seeded);
    } catch {
      toast.error("Kunne ikke indlæse kundeoverblik");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const filtrede = soeg
    ? orgs.filter((o) => o.name.toLowerCase().includes(soeg.toLowerCase()))
    : orgs;

  // Inactive 7-day: previously had activity but none in last 7 days
  const inactive7d = orgs.filter((o) => o.lastActivity && o.checkins7d === 0);
  // Never used: no check-ins ever
  const neverUsed = orgs.filter((o) => !o.lastActivity);

  const healthCount = (c: "green" | "yellow" | "red") =>
    orgs.filter((o) => o.healthColor === c).length;

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Indlæser kundeoverblik…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Kundeoverblik</h2>
          <p className="text-sm text-muted-foreground">
            {orgs.length} organisationer ·{" "}
            <span className="text-success">{healthCount("green")} sunde</span> ·{" "}
            <span className="text-warning">{healthCount("yellow")} middel</span> ·{" "}
            <span className="text-destructive">{healthCount("red")} kritiske</span>
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated"
        >
          <RefreshCw className="h-4 w-4" /> Opdater
        </button>
      </div>

      {/* ── Inactive 7-day alert ── */}
      {inactive7d.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-warning/30 bg-warning/5">
          <button
            onClick={() => setInactiveOpen((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3 text-left"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-warning">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {inactive7d.length} organisation{inactive7d.length > 1 ? "er" : ""} med
              0 check-ins de seneste 7 dage
            </div>
            {inactiveOpen
              ? <ChevronUp className="h-4 w-4 text-warning" />
              : <ChevronDown className="h-4 w-4 text-warning" />}
          </button>
          {inactiveOpen && (
            <ul className="divide-y divide-warning/20 border-t border-warning/20">
              {inactive7d.map((o) => (
                <li key={o.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                  <span className="font-medium">{o.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Seneste aktivitet: {o.lastActivity ? fmtDato(o.lastActivity) : "–"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Never used notice ── */}
      {neverUsed.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface/50 px-5 py-3 text-sm text-muted-foreground">
          <strong>{neverUsed.length}</strong> organisation{neverUsed.length > 1 ? "er" : ""} har
          endnu ikke foretaget nogen check-ins.
        </div>
      )}

      {/* ── Search ── */}
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

      {/* ── Main table ── */}
      <div className="glass overflow-hidden rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 text-left">Organisation</th>
                <th className="px-4 py-3 text-left">Sundhed</th>
                <th className="px-4 py-3 text-left">Onboarding</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Check-ins (7d)</th>
                <th className="px-4 py-3 text-left">Senest aktiv</th>
                <th className="px-4 py-3 text-left">Note</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtrede.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    Ingen organisationer
                  </td>
                </tr>
              ) : (
                filtrede.map((org, i) => {
                  const hc = HEALTH_COLORS[org.healthColor];
                  const isExpanded = expanded === org.id;
                  return (
                    <>
                      <tr
                        key={org.id}
                        className={`border-b border-border/50 transition hover:bg-surface/40 ${i % 2 ? "bg-surface/20" : ""} align-top`}
                      >
                        <td className="px-4 py-3 font-medium">{org.name}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${hc.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${hc.dot}`} />
                            {org.healthScore}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <OnboardingBar score={org.onboardingScore} steps={org.onboarding} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[org.subscription_status] ?? "bg-muted text-muted-foreground"}`}>
                            {STATUS_LABELS[org.subscription_status] ?? org.subscription_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {org.checkins7d > 0
                            ? <span className="font-semibold text-foreground">{org.checkins7d}</span>
                            : <span className="text-destructive/70">0</span>}
                          {org.activeDays7d > 0 && (
                            <span className="ml-1 text-xs opacity-60">({org.activeDays7d}d)</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {org.lastActivity ? fmtDato(org.lastActivity) : (
                            <span className="text-xs italic">Aldrig</span>
                          )}
                        </td>
                        <td className="min-w-[180px] px-4 py-3">
                          <InlineNoteEditor
                            orgId={org.id}
                            initialNote={localNotes[org.id]?.note ?? ""}
                            savedAt={localNotes[org.id]?.created_at}
                            accessToken={accessToken}
                            onSaved={(note) =>
                              setLocalNotes((prev) => ({
                                ...prev,
                                [org.id]: {
                                  ...(prev[org.id] ?? {
                                    id: "",
                                    organization_id: org.id,
                                    created_by: null,
                                  }),
                                  note,
                                  created_at: new Date().toISOString(),
                                },
                              }))
                            }
                          />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpanded(isExpanded ? null : org.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs hover:bg-surface-elevated"
                          >
                            {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {isExpanded ? "Luk" : "Detaljer"}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${org.id}-detail`} className="border-b border-border/30 bg-surface/30">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                              {/* Onboarding checklist */}
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Onboarding-tjekliste
                                </p>
                                <ul className="space-y-1.5">
                                  {Object.entries(org.onboarding).map(([key, done], idx) => (
                                    <li key={key} className="flex items-center gap-2 text-sm">
                                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                                        {done ? "✓" : idx + 1}
                                      </span>
                                      <span className={done ? "" : "text-muted-foreground"}>
                                        {ONBOARDING_LABELS[idx]}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              {/* Health score breakdown */}
                              <div>
                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                  Sundhedsscore-fordeling
                                </p>
                                <div className="space-y-1.5 text-sm">
                                  {[
                                    { label: "Check-ins (7d)", pts: Math.min(org.checkins7d * 2, 40), max: 40 },
                                    { label: "Aktive dage (7d)", pts: Math.round((org.activeDays7d / 7) * 20), max: 20 },
                                    { label: "Antal personale", pts: Math.min(org.staffCount * 5, 20), max: 20 },
                                    {
                                      label: "Abonnementsstatus",
                                      pts: org.subscription_status === "active" || org.subscription_status === "gratis" ? 20
                                        : org.subscription_status === "trialing" ? 10
                                        : org.subscription_status === "past_due" ? 5 : 0,
                                      max: 20,
                                    },
                                  ].map((row) => (
                                    <div key={row.label} className="flex items-center gap-3">
                                      <span className="w-36 text-muted-foreground">{row.label}</span>
                                      <div className="flex-1 overflow-hidden rounded-full bg-surface h-2">
                                        <div
                                          className="h-full bg-primary/60 rounded-full"
                                          style={{ width: `${(row.pts / row.max) * 100}%` }}
                                        />
                                      </div>
                                      <span className="w-12 text-right text-xs text-muted-foreground">
                                        {row.pts}/{row.max}
                                      </span>
                                    </div>
                                  ))}
                                  <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-1.5">
                                    <span className="font-medium">Total</span>
                                    <span className={`font-bold ${hc.badge.split(" ")[1]}`}>
                                      {org.healthScore}/100
                                    </span>
                                  </div>
                                </div>
                                <p className="mt-3 text-xs text-muted-foreground opacity-60">
                                  Score baseret på aggregerede antal — ingen individuel brugeradfærd
                                </p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border/40 bg-surface/30 px-4 py-3 text-xs text-muted-foreground">
        <StickyNote className="mb-0.5 mr-1.5 inline h-3.5 w-3.5" />
        <strong>GDPR-note:</strong> Skriv kun organisatoriske noter — ingen personoplysninger
        om børn, forældre eller individuelle brugere.
      </div>
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
    } catch { toast.error("Kunne ikke indlæse brugere"); }
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

// ─── Plan-nøgler tab ──────────────────────────────────────────────────────────

function KeysTab({ accessToken }: { accessToken: string }) {
  const [keys, setKeys] = useState<PlanKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlanType, setNewPlanType] = useState<(typeof KEY_PLAN_TYPES)[number]>("pro");
  const [generating, setGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const data = await superadminListPlanKeys({ data: { accessToken } }); setKeys(data as PlanKey[]); }
    catch { toast.error("Kunne ikke indlæse plan-nøgler"); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await superadminGeneratePlanKey({ data: { accessToken, planType: newPlanType } });
      const code = (result as any).code as string;
      await navigator.clipboard.writeText(code).catch(() => {});
      toast.success(`Nøgle genereret og kopieret: ${code}`, { duration: 8000 });
      load();
    } catch (err: any) { toast.error(err?.message ?? "Kunne ikke generere nøgle"); }
    finally { setGenerating(false); }
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
        <p className="text-sm text-muted-foreground">{keys.length} nøgler totalt · {unused} ubrugte</p>
      </div>

      <div className="glass rounded-2xl p-5">
        <p className="mb-3 text-sm font-medium">Generer ny aktiveringsnøgle</p>
        <div className="flex flex-wrap items-center gap-3">
          <select value={newPlanType} onChange={(e) => setNewPlanType(e.target.value as any)} className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
            {KEY_PLAN_TYPES.map((t) => <option key={t} value={t}>{TIER_LABELS[t]}</option>)}
          </select>
          <button onClick={handleGenerate} disabled={generating}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            <Plus className="h-4 w-4" /> {generating ? "Genererer…" : "Generer nøgle"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Koden kopieres automatisk til udklipsholderen.</p>
      </div>

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
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Indlæser…</td></tr>
              ) : keys.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">Ingen nøgler endnu</td></tr>
              ) : (
                keys.map((k, i) => (
                  <tr key={k.id} className={`border-b border-border/50 transition ${i % 2 ? "bg-surface/20" : ""} ${!k.used ? "hover:bg-surface/40" : "opacity-60"}`}>
                    <td className="px-4 py-3"><span className="font-mono text-xs tracking-widest">{k.code}</span></td>
                    <td className="px-4 py-3"><span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{TIER_LABELS[k.planType] ?? k.planType}</span></td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${k.used ? "bg-muted text-muted-foreground" : "bg-success/15 text-success"}`}>
                        {k.used ? "Brugt" : "Ubrugt"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {k.usedByOrgName ? `${k.usedByOrgName}${k.usedAt ? ` · ${fmtDato(k.usedAt)}` : ""}` : "–"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDato(k.createdAt)}</td>
                    <td className="px-4 py-3">
                      {!k.used && (
                        <button onClick={() => copyCode(k)} title="Kopiér nøgle" className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground">
                          {copiedId === k.id ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
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
    } catch {
      toast.error("Kunne ikke indlæse misc. planer");
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
            organization_id: orgId,
            name: name.trim(),
            price_dkk: priceDkk,
            description: description.trim() || undefined,
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

// ─── Security tab ────────────────────────────────────────────────────────────

const GDPR_TYPE_LABELS: Record<string, string> = {
  deletion: "Sletning (art. 17)",
  export: "Indsigt/eksport (art. 15)",
  rectification: "Berigtigelse (art. 16)",
};

const GDPR_STATUS_LABELS: Record<string, string> = {
  pending: "Afventer",
  in_progress: "I gang",
  completed: "Afsluttet",
  rejected: "Afvist",
};

const GDPR_STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  in_progress: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  rejected: "bg-muted text-muted-foreground",
};

function SecurityTab({ accessToken }: { accessToken: string }) {
  const [requests, setRequests] = useState<GdprRequest[]>([]);
  const [authSecurity, setAuthSecurity] = useState<AuthSecuritySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<GdprRequest | null>(null);
  const [soeg, setSoeg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await superadminGetSecurityData({ data: { accessToken } });
      setRequests((result as any).requests as GdprRequest[]);
      setAuthSecurity((result as any).authSecurity as AuthSecuritySummary);
    } catch {
      toast.error("Kunne ikke indlæse sikkerhedsdata");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const filtrede = soeg
    ? requests.filter(
        (r) =>
          r.requester_email.toLowerCase().includes(soeg.toLowerCase()) ||
          (r.org_name ?? "").toLowerCase().includes(soeg.toLowerCase()),
      )
    : requests;

  const pending = requests.filter((r) => r.status === "pending").length;
  const inProgress = requests.filter((r) => r.status === "in_progress").length;

  const securityLevel: "green" | "yellow" | "red" = !authSecurity
    ? "green"
    : authSecurity.failed24h >= 50
    ? "red"
    : authSecurity.failed24h >= 10
    ? "yellow"
    : "green";

  const secLevelCfg = {
    green: { cls: "border-success/30 bg-success/5 text-success", label: "Normal" },
    yellow: { cls: "border-warning/30 bg-warning/5 text-warning", label: "Forhøjet aktivitet" },
    red: { cls: "border-destructive/30 bg-destructive/5 text-destructive", label: "Høj aktivitet" },
  }[securityLevel];

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Indlæser sikkerhedsdata…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Sikkerhed & Compliance</h2>
          <p className="text-sm text-muted-foreground">
            {pending > 0
              ? <span className="font-semibold text-warning">{pending} afventende GDPR-anmodning{pending > 1 ? "er" : ""}</span>
              : "Alle GDPR-anmodninger behandlet"}
            {inProgress > 0 && <> · {inProgress} i gang</>}
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated"
        >
          <RefreshCw className="h-4 w-4" /> Opdater
        </button>
      </div>

      {/* ── Auth security card ── */}
      <section>
        <h3 className="mb-3 font-display text-base font-semibold">Auth-sikkerhed</h3>
        <div className={`rounded-2xl border p-5 ${secLevelCfg.cls}`}>
          <div className="mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4 shrink-0" />
            <span className="font-semibold">Niveau: {secLevelCfg.label}</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl bg-background/60 p-3 text-center">
              <p className="font-display text-2xl font-bold">
                {authSecurity?.failed24h ?? 0}
              </p>
              <p className="mt-0.5 text-xs opacity-70">Fejlslagne logins (24t)</p>
            </div>
            <div className="rounded-xl bg-background/60 p-3 text-center">
              <p className="font-display text-2xl font-bold">
                {authSecurity?.failed7d ?? 0}
              </p>
              <p className="mt-0.5 text-xs opacity-70">Fejlslagne logins (7d)</p>
            </div>
            <div className="rounded-xl bg-background/60 p-3 text-center">
              <p className="font-display text-2xl font-bold">
                {authSecurity?.uniqueIps7d ?? 0}
              </p>
              <p className="mt-0.5 text-xs opacity-70">Unikke IP-adresser (7d)</p>
            </div>
          </div>
          <p className="mt-3 text-xs opacity-60">
            Aggregerede tal fra Supabase Auth audit-log — ingen individuelle e-mails eller tokens vises
          </p>
        </div>
      </section>

      {/* ── GDPR requests ── */}
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold">GDPR-anmodninger</h3>
            <p className="text-sm text-muted-foreground">
              {requests.length} totalt · svar-frist: 30 dage fra modtagelse (GDPR art. 12)
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            <Plus className="h-4 w-4" /> Ny anmodning
          </button>
        </div>

        {pending > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              <strong>{pending}</strong> anmodning{pending > 1 ? "er afventer" : " afventer"} behandling
            </span>
          </div>
        )}

        <div className="relative mb-4 max-w-sm">
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
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Modtaget</th>
                  <th className="px-4 py-3 text-left">Frist</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtrede.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      <FileCheck className="mx-auto mb-3 h-8 w-8 opacity-30" />
                      {soeg ? "Ingen anmodninger matcher søgningen" : "Ingen GDPR-anmodninger registreret"}
                    </td>
                  </tr>
                ) : (
                  filtrede.map((req, i) => {
                    const deadline = new Date(req.received_at);
                    deadline.setDate(deadline.getDate() + 30);
                    const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86_400_000);
                    const isOverdue = daysLeft < 0 && req.status !== "completed" && req.status !== "rejected";
                    const isDueSoon = daysLeft >= 0 && daysLeft <= 5 && req.status === "pending";
                    return (
                      <tr
                        key={req.id}
                        className={`border-b border-border/50 transition hover:bg-surface/40 ${i % 2 ? "bg-surface/20" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs">{req.requester_email}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {req.org_name ?? <span className="italic">–</span>}
                        </td>
                        <td className="px-4 py-3">
                          {GDPR_TYPE_LABELS[req.request_type] ?? req.request_type}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${GDPR_STATUS_COLORS[req.status] ?? "bg-muted text-muted-foreground"}`}>
                            {GDPR_STATUS_LABELS[req.status] ?? req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {fmtDato(req.received_at)}
                        </td>
                        <td className="px-4 py-3">
                          {req.status === "completed" || req.status === "rejected" ? (
                            <span className="text-xs text-muted-foreground">
                              {req.resolved_at ? fmtDato(req.resolved_at) : "–"}
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 text-xs font-medium ${isOverdue ? "text-destructive" : isDueSoon ? "text-warning" : "text-muted-foreground"}`}>
                              <Clock className="h-3 w-3 shrink-0" />
                              {isOverdue
                                ? `${Math.abs(daysLeft)}d overskredet`
                                : `${daysLeft}d tilbage`}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setEditTarget(req)}
                            className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium hover:bg-surface-elevated"
                          >
                            {req.status === "pending" || req.status === "in_progress" ? "Behandl" : "Vis"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-border/40 bg-surface/30 px-4 py-3 text-xs text-muted-foreground">
          <ShieldAlert className="mb-0.5 mr-1.5 inline h-3.5 w-3.5" />
          <strong>Lovkrav:</strong> GDPR art. 12 kræver svar inden 30 dage. Art. 17-anmodninger (sletning) skal som udgangspunkt imødekommes med mindre en undtagelse i art. 17 stk. 3 finder anvendelse.
        </div>
      </section>

      {showCreate && (
        <GdprRequestModal
          accessToken={accessToken}
          onClose={() => setShowCreate(false)}
          onSaved={() => { setShowCreate(false); load(); }}
        />
      )}

      {editTarget && (
        <GdprRequestModal
          accessToken={accessToken}
          request={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── GDPR request modal ───────────────────────────────────────────────────────

function GdprRequestModal({
  accessToken,
  request,
  onClose,
  onSaved,
}: {
  accessToken: string;
  request?: GdprRequest;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!request;

  const [orgNames, setOrgNames] = useState<{ id: string; name: string }[]>([]);
  const [email, setEmail] = useState(request?.requester_email ?? "");
  const [orgId, setOrgId] = useState(request?.org_id ?? "");
  const [requestType, setRequestType] = useState(request?.request_type ?? "deletion");
  const [status, setStatus] = useState(request?.status ?? "pending");
  const [notes, setNotes] = useState(request?.notes ?? "");
  const [receivedAt, setReceivedAt] = useState(
    request?.received_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    superadminListOrgNames({ data: { accessToken } })
      .then((d) => setOrgNames(d as { id: string; name: string }[]))
      .catch(() => {});
  }, [accessToken]);

  const canSave = isEdit ? true : email.includes("@");

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      if (isEdit && request) {
        await superadminUpdateGdprRequest({
          data: {
            accessToken,
            requestId: request.id,
            status: status as any,
            notes: notes.trim() || undefined,
          },
        });
        toast.success("Anmodning opdateret");
      } else {
        await superadminCreateGdprRequest({
          data: {
            accessToken,
            requesterEmail: email.trim(),
            orgId: orgId || undefined,
            requestType: requestType as any,
            notes: notes.trim() || undefined,
            receivedAt: new Date(receivedAt).toISOString(),
          },
        });
        toast.success("Anmodning registreret");
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke gemme anmodning");
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
              {isEdit ? "Behandl" : "Registrér"} GDPR-anmodning
            </p>
            <h3 className="font-display text-lg font-bold">
              {isEdit ? request!.requester_email : "Ny anmodning"}
            </h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {!isEdit && (
            <>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  E-mail (den registrerede) <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="bruger@eksempel.dk"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Organisation (valgfri)
                </label>
                <select
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                >
                  <option value="">– Ingen / ukendt –</option>
                  {orgNames.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Anmodningstype <span className="text-destructive">*</span>
                </label>
                <select
                  value={requestType}
                  onChange={(e) => setRequestType(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                >
                  {Object.entries(GDPR_TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Modtagelsesdato
                </label>
                <input
                  type="date"
                  value={receivedAt}
                  onChange={(e) => setReceivedAt(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </>
          )}

          {isEdit && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none"
              >
                {Object.entries(GDPR_STATUS_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Interne noter (valgfri)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Fx: Bekræftet identitet via e-mail d. 9/5 · Data slettet fra auth + org · Kvittering sendt"
              className="w-full rounded-xl border border-input bg-background p-3 text-sm focus:border-ring focus:outline-none"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Skriv kun organisatorisk/proceduremæssig info — ingen følsomme personoplysninger.
            </p>
          </div>

          {isEdit && (request?.request_type === "deletion") && (
            <div className="rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-warning">
              <strong>Sletning (art. 17):</strong> Husk at slette brugeren i Brugere-fanen og bekræfte sletning af eventuelle børneregistreringer til organisationens admin.
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
            {saving ? "Gemmer…" : isEdit ? "Gem status" : "Registrér anmodning"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Drift tab ────────────────────────────────────────────────────────────────

const SETTING_META: Record<string, { label: string; description: string; type: "boolean" | "string" | "number" }> = {
  maintenance_mode: {
    label: "Vedligeholdelsestilstand",
    description: "Vis vedligeholdelsesbanner til ikke-superadmin brugere",
    type: "boolean",
  },
  maintenance_message: {
    label: "Vedligeholdelsesbesked",
    description: "Tekst der vises under vedligehold",
    type: "string",
  },
  max_trial_days: {
    label: "Prøveperiode (dage)",
    description: "Standardlængde for nye prøveperioder",
    type: "number",
  },
};

function DriftTab({ accessToken }: { accessToken: string }) {
  const [dbStats, setDbStats] = useState<DbTableStat[]>([]);
  const [settings, setSettings] = useState<AppSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await superadminGetOpsData({ data: { accessToken } });
      const r = result as { dbStats: DbTableStat[]; settings: AppSetting[] };
      setDbStats(r.dbStats);
      setSettings(r.settings);
      // Seed drafts from current values
      const d: Record<string, string> = {};
      for (const s of r.settings) {
        d[s.key] = typeof s.value === "string" ? s.value : JSON.stringify(s.value);
      }
      setDrafts(d);
    } catch {
      toast.error("Kunne ikke indlæse driftsdata");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const saveSetting = async (key: string) => {
    setSavingKey(key);
    const meta = SETTING_META[key];
    let parsed: unknown = drafts[key];
    if (meta?.type === "boolean") {
      parsed = drafts[key] === "true" || drafts[key] === true.toString();
    } else if (meta?.type === "number") {
      parsed = Number(drafts[key]) || 0;
    }
    try {
      await superadminSetAppSetting({ data: { accessToken, key, value: parsed } });
      toast.success("Indstilling gemt");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke gemme indstilling");
    } finally {
      setSavingKey(null);
    }
  };

  const maintenanceOn = settings.find((s) => s.key === "maintenance_mode")?.value === true;

  const toggleMaintenance = async () => {
    setSavingKey("maintenance_mode");
    try {
      await superadminSetAppSetting({
        data: { accessToken, key: "maintenance_mode", value: !maintenanceOn },
      });
      toast.success(maintenanceOn ? "Vedligeholdelsestilstand deaktiveret" : "Vedligeholdelsestilstand aktiveret");
      load();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke skifte tilstand");
    } finally {
      setSavingKey(null);
    }
  };

  const totalDbBytes = dbStats.reduce((s, t) => s + t.totalBytes, 0);
  const fmtBytes = (b: number) => {
    if (b >= 1_073_741_824) return (b / 1_073_741_824).toFixed(1) + " GB";
    if (b >= 1_048_576) return (b / 1_048_576).toFixed(1) + " MB";
    return (b / 1024).toFixed(0) + " KB";
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Indlæser driftsdata…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Drift & Operationer</h2>
          <p className="text-sm text-muted-foreground">
            Database · {dbStats.length} tabeller · {fmtBytes(totalDbBytes)} total
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm hover:bg-surface-elevated"
        >
          <RefreshCw className="h-4 w-4" /> Opdater
        </button>
      </div>

      {/* ── Maintenance mode banner ── */}
      <section>
        <h3 className="mb-3 font-display text-base font-semibold">Vedligeholdelsestilstand</h3>
        <div className={`flex items-center justify-between rounded-2xl border p-5 transition ${
          maintenanceOn
            ? "border-warning/40 bg-warning/8"
            : "border-border bg-surface/50"
        }`}>
          <div className="flex items-center gap-3">
            {maintenanceOn
              ? <ToggleRight className="h-8 w-8 text-warning" />
              : <ToggleLeft className="h-8 w-8 text-muted-foreground" />}
            <div>
              <p className="font-semibold">
                {maintenanceOn ? "Vedligeholdelsestilstand aktiv" : "Normal drift"}
              </p>
              <p className="text-sm text-muted-foreground">
                {maintenanceOn
                  ? "Brugere uden superadmin-rolle ser vedligeholdelsesbesked"
                  : "Alle brugere har normal adgang"}
              </p>
            </div>
          </div>
          <button
            onClick={toggleMaintenance}
            disabled={savingKey === "maintenance_mode"}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${
              maintenanceOn
                ? "bg-success/15 text-success hover:bg-success/25"
                : "bg-warning/15 text-warning hover:bg-warning/25"
            }`}
          >
            {savingKey === "maintenance_mode"
              ? "…"
              : maintenanceOn
              ? "Deaktivér"
              : "Aktivér"}
          </button>
        </div>
      </section>

      {/* ── App settings ── */}
      <section>
        <h3 className="mb-3 font-display text-base font-semibold">
          <Settings2 className="mr-1.5 inline h-4 w-4" />
          App-indstillinger
        </h3>
        {settings.length === 0 ? (
          <div className="glass rounded-2xl px-5 py-6 text-sm text-muted-foreground">
            Ingen indstillinger fundet — kør migration 20260509280000
          </div>
        ) : (
          <div className="glass divide-y divide-border/50 overflow-hidden rounded-2xl">
            {settings.map((s) => {
              const meta = SETTING_META[s.key];
              const isBool = meta?.type === "boolean";
              const isDirty =
                drafts[s.key] !==
                (typeof s.value === "string" ? s.value : JSON.stringify(s.value));
              return (
                <div key={s.key} className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:gap-4">
                  <div className="flex-1">
                    <p className="font-medium">{meta?.label ?? s.key}</p>
                    {meta?.description && (
                      <p className="text-xs text-muted-foreground">{meta.description}</p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground opacity-60">
                      Sidst ændret: {fmtTidspunkt(s.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {isBool ? (
                      <button
                        onClick={() => {
                          const next = drafts[s.key] === "true" ? "false" : "true";
                          setDrafts((d) => ({ ...d, [s.key]: next }));
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          drafts[s.key] === "true"
                            ? "bg-success/15 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {drafts[s.key] === "true" ? "Aktiveret" : "Deaktiveret"}
                      </button>
                    ) : (
                      <input
                        type={meta?.type === "number" ? "number" : "text"}
                        value={drafts[s.key] ?? ""}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [s.key]: e.target.value }))
                        }
                        className="w-full max-w-xs rounded-xl border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none sm:w-64"
                      />
                    )}
                    {isDirty && (
                      <button
                        onClick={() => saveSetting(s.key)}
                        disabled={savingKey === s.key}
                        className="inline-flex items-center gap-1 rounded-xl bg-gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        <Save className="h-3 w-3" />
                        {savingKey === s.key ? "…" : "Gem"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Database stats ── */}
      <section>
        <h3 className="mb-3 font-display text-base font-semibold">
          <Database className="mr-1.5 inline h-4 w-4" />
          Database-tabeller
        </h3>
        {dbStats.length === 0 ? (
          <div className="glass rounded-2xl px-5 py-6 text-sm text-muted-foreground">
            Database-statistik ikke tilgængelig — kør migration 20260509280000
          </div>
        ) : (
          <div className="glass overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 text-left">Tabel</th>
                    <th className="px-4 py-3 text-right">Rækker (ca.)</th>
                    <th className="px-4 py-3 text-right">Størrelse</th>
                    <th className="px-4 py-3 text-left">Andel</th>
                  </tr>
                </thead>
                <tbody>
                  {dbStats.map((t, i) => {
                    const pct = totalDbBytes > 0
                      ? Math.max(Math.round((t.totalBytes / totalDbBytes) * 100), 1)
                      : 0;
                    return (
                      <tr
                        key={t.tableName}
                        className={`border-b border-border/50 ${i % 2 ? "bg-surface/20" : ""}`}
                      >
                        <td className="px-4 py-3 font-mono text-xs">{t.tableName}</td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {t.rowCount.toLocaleString("da-DK")}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {t.totalSize}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-24 overflow-hidden rounded-full bg-surface">
                              <div
                                className="h-full rounded-full bg-primary/50"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-8 text-xs text-muted-foreground">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-border bg-surface/40 font-bold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {dbStats.reduce((s, t) => s + t.rowCount, 0).toLocaleString("da-DK")}
                    </td>
                    <td className="px-4 py-3 text-right">{fmtBytes(totalDbBytes)}</td>
                    <td className="px-4 py-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground opacity-60">
          Rækkeantal er approksimativt (pg_class.reltuples) — ingen tabelindhold eksponeres
        </p>
      </section>
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
    catch { toast.error("Kunne ikke indlæse handlingslog"); }
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
