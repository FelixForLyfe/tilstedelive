import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
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

function IndstillingerSide() {
  const { aktivOrgId, erAdmin, genindlaes } = useOrg();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [redeemed, setRedeemed] = useState<{ planType: string; label: string | null } | null>(null);

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

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Indstillinger</h1>
        <p className="mt-1 text-sm text-muted-foreground">Administrer din organisations indstillinger.</p>
      </div>

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
    </div>
  );
}
