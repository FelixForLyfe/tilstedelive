import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, CheckCircle2, Zap, QrCode, KeySquare, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useFeatureFlags, type FeatureFlags, type CheckinMethod } from "@/contexts/FeatureFlagsContext";
import { redeemPlanKey } from "@/server/plans.functions";

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
  { key: "vagtplan", label: "Vagtplan", description: "Digital vagtplan for personalet.", comingSoon: true },
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
