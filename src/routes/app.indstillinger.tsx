import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { KeyRound, CheckCircle2, Zap, QrCode, KeySquare, Clock, CalendarDays, Plus, Trash2, ShieldCheck, ShieldOff, RefreshCw, Download, Copy, Check, AlertTriangle, Smartphone, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useFeatureFlags, type FeatureFlags, type CheckinMethod } from "@/contexts/FeatureFlagsContext";
import { redeemPlanKey } from "@/server/plans.functions";
import { generateBackupCodes, getBackupCodeStatus, disableMfa } from "@/server/mfa.functions";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/app/indstillinger")({
  component: IndstillingerSide,
});

const TIER_LABELS: Record<string, string> = {
  gratis: "Gratis",
  basis: "Basis",
  pro: "Pro",
  organisation: "Organisation",
  kommune: "Kommune",
  special: "Special",
};

type FeatureToggle = {
  key: keyof Omit<FeatureFlags, "checkin_method" | "auto_close_day" | "auto_close_time">;
  label: string;
  description: string;
  comingSoon?: boolean;
};

const FEATURE_TOGGLES: FeatureToggle[] = [
  { key: "status", label: "Status", description: "Fremmøde- og statusoversigt for deltagere." },
  { key: "aktiviteter", label: "Aktiviteter", description: "Planlæg og log aktiviteter og opgaver." },
  { key: "arbejdstidslog", label: "Tjek ind", description: "Giver personale mulighed for at tjekke ind og ud via QR-kode eller PIN." },
  { key: "vagtplan", label: "Vagtplan", description: "Digital vagtplan for personalet." },
];

const CHECKIN_METHODS: { value: CheckinMethod; label: string; icon: any; description: string }[] = [
  { value: "none", label: "Ingen", icon: null, description: "Tjek-ind er deaktiveret." },
  { value: "qr", label: "QR-kode", icon: QrCode, description: "Personale scanner en QR-kode." },
  { value: "pin", label: "PIN-kode", icon: KeySquare, description: "Personale indtaster en PIN-kode." },
  { value: "both", label: "Begge", icon: null, description: "Både QR og PIN er tilgængelige." },
];

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

type CustomRole = { name: string; color: string };

type VagtplanSettings = {
  planning_period: "weekly" | "biweekly" | "monthly";
  publish_deadline_days: number;
  min_rest_hours: number;
  max_weekly_hours: number;
  min_notice_hours: number;
  allow_self_swap: boolean;
  overtime_after_hours: number;
  weekend_rate_multiplier: number;
  evening_rate_multiplier: number;
  custom_roles: CustomRole[];
};

const DEFAULT_VAGTPLAN: VagtplanSettings = {
  planning_period: "weekly",
  publish_deadline_days: 3,
  min_rest_hours: 11,
  max_weekly_hours: 48,
  min_notice_hours: 2,
  allow_self_swap: false,
  overtime_after_hours: 37,
  weekend_rate_multiplier: 1.5,
  evening_rate_multiplier: 1.3,
  custom_roles: [
    { name: "Medarbejder", color: "#6366f1" },
    { name: "Kasseassistent", color: "#f59e0b" },
    { name: "Lager", color: "#10b981" },
    { name: "Manager", color: "#ef4444" },
  ],
};

function VagtplanSettingsSection({ orgId }: { orgId: string }) {
  const [settings, setSettings] = useState<VagtplanSettings>(DEFAULT_VAGTPLAN);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleColor, setNewRoleColor] = useState("#6366f1");

  const load = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("vagtplan_settings")
      .select("*")
      .eq("organization_id", orgId)
      .maybeSingle();
    if (data) {
      setSettings({
        planning_period: data.planning_period ?? "weekly",
        publish_deadline_days: data.publish_deadline_days ?? 3,
        min_rest_hours: data.min_rest_hours ?? 11,
        max_weekly_hours: data.max_weekly_hours ?? 48,
        min_notice_hours: data.min_notice_hours ?? 2,
        allow_self_swap: data.allow_self_swap ?? false,
        overtime_after_hours: Number(data.overtime_after_hours ?? 37),
        weekend_rate_multiplier: Number(data.weekend_rate_multiplier ?? 1.5),
        evening_rate_multiplier: Number(data.evening_rate_multiplier ?? 1.3),
        custom_roles: Array.isArray(data.custom_roles) ? data.custom_roles : DEFAULT_VAGTPLAN.custom_roles,
      });
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const save = async (updates: Partial<VagtplanSettings>) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("vagtplan_settings")
        .upsert({ organization_id: orgId, ...next, updated_at: new Date().toISOString() }, { onConflict: "organization_id" });
      if (error) throw error;
    } catch {
      toast.error("Kunne ikke gemme vagtplan-indstillinger.");
    } finally {
      setSaving(false);
    }
  };

  const addRole = () => {
    const name = newRoleName.trim();
    if (!name) return;
    if (settings.custom_roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      toast.error("En rolle med dette navn findes allerede.");
      return;
    }
    save({ custom_roles: [...settings.custom_roles, { name, color: newRoleColor }] });
    setNewRoleName("");
    setNewRoleColor("#6366f1");
  };

  const removeRole = (idx: number) => {
    save({ custom_roles: settings.custom_roles.filter((_, i) => i !== idx) });
  };

  const updateRoleColor = (idx: number, color: string) => {
    const roles = settings.custom_roles.map((r, i) => i === idx ? { ...r, color } : r);
    save({ custom_roles: roles });
  };

  const updateRoleName = (idx: number, name: string) => {
    const roles = settings.custom_roles.map((r, i) => i === idx ? { ...r, name } : r);
    setSettings((s) => ({ ...s, custom_roles: roles }));
  };

  const saveRoleName = (idx: number) => {
    save({ custom_roles: settings.custom_roles });
  };

  if (loading) return <div className="text-sm text-muted-foreground">Indlæser…</div>;

  return (
    <div className="space-y-5">
      {/* Planning period */}
      <div>
        <label className="block text-sm font-medium mb-1.5">Planlægningsperiode</label>
        <select
          value={settings.planning_period}
          onChange={(e) => save({ planning_period: e.target.value as any })}
          disabled={saving}
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:border-ring focus:outline-none disabled:opacity-50"
        >
          <option value="weekly">Ugentlig</option>
          <option value="biweekly">Hver 2. uge</option>
          <option value="monthly">Månedlig</option>
        </select>
      </div>

      {/* Numeric fields */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Publiceringsdeadline (dage)</label>
          <input
            type="number" min={0} max={14}
            value={settings.publish_deadline_days}
            onChange={(e) => save({ publish_deadline_days: Number(e.target.value) })}
            disabled={saving}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none disabled:opacity-50"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">Dage inden vagt skal publiceres</p>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Min. hvile mellem vagter (timer)</label>
          <input
            type="number" min={8} max={24}
            value={settings.min_rest_hours}
            onChange={(e) => save({ min_rest_hours: Number(e.target.value) })}
            disabled={saving}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none disabled:opacity-50"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">Dansk lov kræver min. 11 timer</p>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Maks. ugentlige timer</label>
          <input
            type="number" min={1} max={84}
            value={settings.max_weekly_hours}
            onChange={(e) => save({ max_weekly_hours: Number(e.target.value) })}
            disabled={saving}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none disabled:opacity-50"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">EU-direktiv: maks. 48 timer/uge</p>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Min. varsel ved sygdom (timer)</label>
          <input
            type="number" min={0} max={48}
            value={settings.min_notice_hours}
            onChange={(e) => save({ min_notice_hours: Number(e.target.value) })}
            disabled={saving}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Overarbejde efter (timer/uge)</label>
          <input
            type="number" min={1} max={84} step={0.5}
            value={settings.overtime_after_hours}
            onChange={(e) => save({ overtime_after_hours: Number(e.target.value) })}
            disabled={saving}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none disabled:opacity-50"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">Standard 37 timer (fuldtid)</p>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Weekendtillæg (multiplikator)</label>
          <input
            type="number" min={1} max={3} step={0.05}
            value={settings.weekend_rate_multiplier}
            onChange={(e) => save({ weekend_rate_multiplier: Number(e.target.value) })}
            disabled={saving}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none disabled:opacity-50"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">F.eks. 1.5 = 50% tillæg</p>
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Aftentillæg (multiplikator)</label>
          <input
            type="number" min={1} max={3} step={0.05}
            value={settings.evening_rate_multiplier}
            onChange={(e) => save({ evening_rate_multiplier: Number(e.target.value) })}
            disabled={saving}
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none disabled:opacity-50"
          />
          <p className="mt-0.5 text-[11px] text-muted-foreground">F.eks. 1.3 = 30% tillæg</p>
        </div>
      </div>

      {/* Allow self-swap */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3">
        <div>
          <p className="text-sm font-medium">Tillad vagt-bytte uden godkendelse</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Personale kan bytte vagter direkte uden manager-godkendelse.</p>
        </div>
        <Toggle
          checked={settings.allow_self_swap}
          onChange={(v) => save({ allow_self_swap: v })}
          disabled={saving}
        />
      </div>

      {/* Custom roles */}
      <div>
        <p className="text-sm font-medium mb-2">Roller</p>
        <div className="space-y-2">
          {settings.custom_roles.map((role, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                type="color"
                value={role.color}
                onChange={(e) => updateRoleColor(idx, e.target.value)}
                className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-input bg-background p-0.5"
                title="Vælg farve"
              />
              <input
                type="text"
                value={role.name}
                onChange={(e) => updateRoleName(idx, e.target.value)}
                onBlur={() => saveRoleName(idx)}
                className="flex-1 rounded-xl border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none"
              />
              <button
                onClick={() => removeRole(idx)}
                disabled={saving || settings.custom_roles.length <= 1}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add new role */}
        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            value={newRoleColor}
            onChange={(e) => setNewRoleColor(e.target.value)}
            className="h-8 w-8 shrink-0 cursor-pointer rounded-lg border border-input bg-background p-0.5"
            title="Vælg farve"
          />
          <input
            type="text"
            value={newRoleName}
            onChange={(e) => setNewRoleName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addRole()}
            placeholder="Ny rolle…"
            className="flex-1 rounded-xl border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none"
          />
          <button
            onClick={addRole}
            disabled={!newRoleName.trim() || saving}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-30"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── 2FA / Sikkerhed section ─────────────────────────────────────────────────

type MfaFactor = { id: string; factor_type: string; friendly_name?: string | null };
type BackupView = "skjult" | "vis" | "generer";

function SikkerhedSection() {
  const navigate = useNavigate();

  const [indlaes, setIndlaes] = useState(true);
  const [faktorer, setFaktorer] = useState<MfaFactor[]>([]);
  const [backupStatus, setBackupStatus] = useState<{ total: number; unused: number } | null>(null);
  const [backupView, setBackupView] = useState<BackupView>("skjult");
  const [nyeKoder, setNyeKoder] = useState<string[]>([]);
  const [kopieret, setKopieret] = useState(false);
  const [bekraeftet, setBekraeftet] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);

  // Disable 2FA dialog state
  const [visDeaktiverDialog, setVisDeaktiverDialog] = useState(false);
  const [adgangskode, setAdgangskode] = useState("");
  const [deaktiverLoading, setDeaktiverLoading] = useState(false);
  const [brugerEmail, setBrugerEmail] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setBrugerEmail(session.user?.email ?? null);

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const all: MfaFactor[] = (factors as any)?.all ?? [];
    setFaktorer(all);

    if (all.length > 0) {
      try {
        const st = await getBackupCodeStatus({ data: { accessToken: session.access_token } });
        setBackupStatus(st);
      } catch {
        setBackupStatus(null);
      }
    }

    setIndlaes(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const aktiveret = faktorer.length > 0;

  const metodeMaerke = () => {
    const totp = faktorer.find((f) => f.factor_type === "totp");
    const email = faktorer.find((f) => f.factor_type === "email");
    if (totp && email) return "Autentifikator-app + Email";
    if (totp) return "Autentifikator-app";
    if (email) return "Email-kode";
    return "Ingen";
  };

  const genererNyeKoder = async () => {
    setBackupLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session mangler.");
      const result = await generateBackupCodes({ data: { accessToken: session.access_token } });
      setNyeKoder(result.codes);
      setBackupView("generer");
      setBekraeftet(false);
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke generere backup-koder.");
    } finally {
      setBackupLoading(false);
    }
  };

  const kopierKoder = async () => {
    await navigator.clipboard.writeText(nyeKoder.join("\n")).catch(() => {});
    setKopieret(true);
    setTimeout(() => setKopieret(false), 2000);
  };

  const downloadKoder = () => {
    const content = [
      "Tilstede — Backup-koder til 2FA",
      "=================================",
      "Gem disse koder et sikkert sted.",
      "Hver kode kan kun bruges én gang.",
      "",
      ...nyeKoder,
      "",
      `Genereret: ${new Date().toLocaleDateString("da-DK")}`,
    ].join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tilstede-backup-koder.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const deaktiverMfa = async () => {
    if (!adgangskode || !brugerEmail) return;
    setDeaktiverLoading(true);
    try {
      // Re-authenticate to confirm identity
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: brugerEmail,
        password: adgangskode,
      });
      if (authErr) {
        toast.error("Forkert adgangskode. Prøv igen.");
        setDeaktiverLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session mangler.");

      await disableMfa({ data: { accessToken: session.access_token } });
      await supabase.auth.refreshSession();

      toast.success("Tofaktorautentifikation er deaktiveret.");
      setVisDeaktiverDialog(false);
      setAdgangskode("");
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? "Deaktivering mislykkedes.");
    } finally {
      setDeaktiverLoading(false);
    }
  };

  if (indlaes) return <div className="text-sm text-muted-foreground">Indlæser…</div>;

  return (
    <div className="glass rounded-2xl p-6">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold">Sikkerhed</h2>
          <p className="text-xs text-muted-foreground">Tofaktorautentifikation og backup-koder.</p>
        </div>
      </div>

      {/* Status badge */}
      <div className={`mb-5 flex items-center gap-3 rounded-xl p-3 ${aktiveret ? "bg-success/10 border border-success/20" : "bg-muted/40 border border-border"}`}>
        {aktiveret ? (
          <ShieldCheck className="h-4 w-4 shrink-0 text-success" />
        ) : (
          <ShieldOff className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${aktiveret ? "text-success" : "text-muted-foreground"}`}>
            {aktiveret ? "2FA er aktiveret" : "2FA er ikke aktiveret"}
          </p>
          {aktiveret && (
            <p className="text-xs text-muted-foreground mt-0.5">Metode: {metodeMaerke()}</p>
          )}
        </div>
      </div>

      {!aktiveret ? (
        <button
          onClick={() => navigate({ to: "/setup-2fa" })}
          className="w-full rounded-xl bg-gradient-primary px-4 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
        >
          Aktivér tofaktorautentifikation
        </button>
      ) : (
        <div className="space-y-3">
          {/* Backup codes */}
          {backupView === "skjult" && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">Backup-koder</p>
                {backupStatus ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {backupStatus.unused} / {backupStatus.total} koder tilbage
                    {backupStatus.unused <= 2 && backupStatus.unused > 0 && (
                      <span className="ml-1.5 text-warning"> — kun få tilbage</span>
                    )}
                    {backupStatus.unused === 0 && (
                      <span className="ml-1.5 text-destructive"> — alle brugt</span>
                    )}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-muted-foreground">Ingen backup-koder oprettet endnu</p>
                )}
              </div>
              <button
                onClick={genererNyeKoder}
                disabled={backupLoading}
                className="shrink-0 flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-medium transition hover:bg-surface-elevated disabled:opacity-50"
              >
                {backupLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {backupStatus ? "Regenerér" : "Opret koder"}
              </button>
            </div>
          )}

          {/* New backup codes display */}
          {backupView === "generer" && nyeKoder.length > 0 && (
            <div className="rounded-xl border border-warning/40 bg-warning/5 p-4">
              <div className="mb-3 flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <p className="text-xs text-warning-foreground">
                  <strong>Disse koder vises kun én gang.</strong> Gem dem nu.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {nyeKoder.map((c) => (
                  <div key={c} className="rounded-lg border border-border bg-background px-3 py-1.5 text-center font-mono text-sm tracking-widest">
                    {c}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={kopierKoder} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs transition hover:bg-surface">
                  {kopieret ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  {kopieret ? "Kopieret!" : "Kopiér"}
                </button>
                <button onClick={downloadKoder} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-xs transition hover:bg-surface">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
              </div>
              <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-surface/40 p-3 mb-2">
                <input type="checkbox" checked={bekraeftet} onChange={(e) => setBekraeftet(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-primary" />
                <span className="text-xs leading-snug">Jeg har gemt mine backup-koder</span>
              </label>
              <button
                onClick={() => { setBackupView("skjult"); setNyeKoder([]); load(); }}
                disabled={!bekraeftet}
                className="w-full rounded-xl bg-primary/10 py-2 text-sm font-medium text-primary transition hover:bg-primary/20 disabled:opacity-40"
              >
                Luk
              </button>
            </div>
          )}

          {/* Change method */}
          <button
            onClick={() => navigate({ to: "/setup-2fa" })}
            className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-medium transition hover:bg-surface"
          >
            Skift 2FA-metode
          </button>

          {/* Disable 2FA */}
          <button
            onClick={() => setVisDeaktiverDialog(true)}
            className="w-full rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/10"
          >
            <ShieldOff className="mr-1.5 inline h-4 w-4" />
            Deaktivér 2FA
          </button>
        </div>
      )}

      {/* Disable 2FA confirmation dialog */}
      {visDeaktiverDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <div className="glass w-full max-w-sm rounded-3xl p-6 shadow-card">
            <h3 className="font-display text-lg font-bold">Deaktivér 2FA?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Bekræft med din adgangskode for at deaktivere tofaktorautentifikation.
            </p>
            <div className="mt-4 space-y-3">
              <PasswordInput
                value={adgangskode}
                onChange={(e) => setAdgangskode(e.target.value)}
                placeholder="Din adgangskode"
                autoFocus
              />
              <button
                onClick={deaktiverMfa}
                disabled={deaktiverLoading || !adgangskode}
                className="w-full rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {deaktiverLoading ? "Deaktiverer…" : "Bekræft og deaktivér"}
              </button>
              <button
                onClick={() => { setVisDeaktiverDialog(false); setAdgangskode(""); }}
                className="w-full rounded-xl py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Annuller
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IndstillingerSide() {
  const { aktivOrgId, erAdmin, genindlaes } = useOrg();
  const { flags, loading: flagsLoading, updateFlags } = useFeatureFlags();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [redeemed, setRedeemed] = useState<{ planType: string; label: string | null } | null>(null);
  const [savingFlag, setSavingFlag] = useState<string | null>(null);

  if (!erAdmin) {
    return <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Kun administratorer har adgang til indstillinger.</div>;
  }

  const formatCode = (val: string) => {
    const clean = val.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const parts = [clean.slice(0, 4), clean.slice(4, 8), clean.slice(8, 12), clean.slice(12, 16)].filter(Boolean);
    return parts.join("-");
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCode(formatCode(e.target.value));
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aktivOrgId || code.replace(/-/g, "").length < 16) {
      toast.error("Indtast en gyldig 16-tegns aktiveringsnøgle.");
      return;
    }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error("Session udløbet. Log ind igen."); return; }
      const result = await redeemPlanKey({ data: { accessToken: session.access_token, orgId: aktivOrgId, code } });
      setRedeemed(result);
      setCode("");
      await genindlaes();
      toast.success(`Plan aktiveret: ${TIER_LABELS[result.planType] ?? result.planType}`);
    } catch (err: any) {
      toast.error(err?.message ?? "Nøglen kunne ikke indløses. Prøv igen.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof Omit<FeatureFlags, "checkin_method">, value: boolean) => {
    setSavingFlag(key);
    try {
      await updateFlags({ [key]: value });
    } catch {
      toast.error("Kunne ikke gemme indstilling.");
    } finally {
      setSavingFlag(null);
    }
  };

  const handleCheckinMethod = async (method: CheckinMethod) => {
    setSavingFlag("checkin_method");
    try {
      await updateFlags({ checkin_method: method });
    } catch {
      toast.error("Kunne ikke gemme indstilling.");
    } finally {
      setSavingFlag(null);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Indstillinger</h1>
        <p className="mt-1 text-sm text-muted-foreground">Administrer din organisations indstillinger.</p>
      </div>

      {/* Aktiveringsnøgle */}
      <div className="glass rounded-2xl p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <KeyRound className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Aktiveringsnøgle</h2>
            <p className="text-xs text-muted-foreground">Indløs en plan-nøgle for at opgradere din organisation.</p>
          </div>
        </div>

        {redeemed ? (
          <div className="flex items-center gap-3 rounded-xl bg-success/10 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="font-medium text-success">Plan aktiveret</p>
              <p className="text-sm text-muted-foreground">
                {TIER_LABELS[redeemed.planType] ?? redeemed.planType}
                {redeemed.label ? ` · ${redeemed.label}` : ""}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleRedeem} className="flex flex-col gap-3 sm:flex-row">
            <input
              value={code}
              onChange={handleCodeChange}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={19}
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 font-mono text-sm tracking-widest placeholder:font-sans placeholder:tracking-normal focus:border-ring focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading || code.replace(/-/g, "").length < 16}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition disabled:opacity-50"
            >
              {loading ? "Indløser…" : "Indløs nøgle"}
            </button>
          </form>
        )}
      </div>

      {/* Funktioner */}
      <div className="glass rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Funktioner</h2>
            <p className="text-xs text-muted-foreground">Slå funktioner til og fra for din organisation.</p>
          </div>
        </div>

        {flagsLoading ? (
          <div className="text-sm text-muted-foreground">Indlæser…</div>
        ) : (
          <div className="divide-y divide-border">
            {FEATURE_TOGGLES.map((ft) => (
              <div key={ft.key} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{ft.label}</span>
                    {ft.comingSoon && (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        Kommer snart
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{ft.description}</p>
                </div>
                <Toggle
                  checked={ft.comingSoon ? false : flags[ft.key]}
                  onChange={(v) => handleToggle(ft.key, v)}
                  disabled={ft.comingSoon || savingFlag === ft.key}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tjek ind metode */}
      <div className="glass rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <QrCode className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Tjek ind-metode</h2>
            <p className="text-xs text-muted-foreground">Vælg hvordan personale tjekker ind og ud.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {CHECKIN_METHODS.map((m) => {
            const Icon = m.icon;
            const active = flags.checkin_method === m.value;
            return (
              <button
                key={m.value}
                onClick={() => handleCheckinMethod(m.value)}
                disabled={savingFlag === "checkin_method"}
                className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition disabled:opacity-50 ${
                  active
                    ? "border-primary bg-primary/5"
                    : "border-border bg-background hover:border-primary/40"
                }`}
              >
                {Icon && <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`} />}
                <span className={`text-sm font-medium ${active ? "text-primary" : ""}`}>{m.label}</span>
                <span className="text-[11px] text-muted-foreground">{m.description}</span>
              </button>
            );
          })}
        </div>
        {flags.checkin_method !== "none" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Administrér QR-lokationer og PIN under <strong>Admin → Tjek ind</strong>.
          </p>
        )}
      </div>

      {/* Vagtplan settings — only visible when vagtplan is enabled */}
      {flags.vagtplan && aktivOrgId && (
        <div className="glass rounded-2xl p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CalendarDays className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Vagtplan</h2>
              <p className="text-xs text-muted-foreground">Regler og roller for vagtplanlægning.</p>
            </div>
          </div>
          <VagtplanSettingsSection orgId={aktivOrgId} />
        </div>
      )}

      {/* Sikkerhed */}
      <SikkerhedSection />

      {/* Logning */}
      <div className="glass rounded-2xl p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Clock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Logning</h2>
            <p className="text-xs text-muted-foreground">Indstillinger for daglig lukning.</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Auto-close toggle */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Luk dagen automatisk</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Dagen lukkes automatisk hver nat på det valgte tidspunkt.
              </p>
            </div>
            <Toggle
              checked={flags.auto_close_day}
              onChange={async (v) => {
                setSavingFlag("auto_close_day");
                try { await updateFlags({ auto_close_day: v }); }
                catch { toast.error("Kunne ikke gemme indstilling."); }
                finally { setSavingFlag(null); }
              }}
              disabled={savingFlag === "auto_close_day"}
            />
          </div>

          {/* Time picker — only visible when auto-close is ON */}
          {flags.auto_close_day && (
            <div className="flex items-center gap-4 rounded-xl border border-border bg-background px-4 py-3">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-1 items-center justify-between gap-3">
                <label htmlFor="auto-close-time" className="text-sm text-muted-foreground">
                  Lukketidspunkt
                </label>
                <input
                  id="auto-close-time"
                  type="time"
                  value={flags.auto_close_time?.slice(0, 5) ?? "22:00"}
                  onChange={async (e) => {
                    const timeVal = e.target.value + ":00"; // "HH:MM" → "HH:MM:00"
                    setSavingFlag("auto_close_time");
                    try { await updateFlags({ auto_close_time: timeVal }); }
                    catch { toast.error("Kunne ikke gemme tidspunkt."); }
                    finally { setSavingFlag(null); }
                  }}
                  disabled={savingFlag === "auto_close_time"}
                  className="rounded-lg border border-input bg-surface px-3 py-1.5 text-sm font-mono focus:border-ring focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
