import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";
import { getTerms, type OrgType, type Terms } from "@/lib/terminology";
import { identifyUser } from "@/lib/posthog";

export type Medlemskab = {
  organization_id: string;
  role: "admin" | "employee";
  status: "active" | "pending";
  organizations: {
    id: string;
    name: string;
    org_type: OrgType | null;
    subscription_status: string | null;
    subscription_tier: string | null;
    trial_ends_at: string | null;
  } | null;
};

export type BlockReason = "trial_expired" | "canceled" | "past_due" | null;

type OrgCtx = {
  medlemskaber: Medlemskab[];
  aktivOrgId: string | null;
  aktivOrg: Medlemskab | null;
  erAdmin: boolean;
  orgType: OrgType | null;
  terms: Terms;
  subscriptionStatus: string | null;
  subscriptionTier: string | null;
  trialEndsAt: string | null;
  trialDaysLeft: number | null;
  isBlocked: boolean;
  blockReason: BlockReason;
  vaelgOrg: (id: string) => void;
  genindlaes: () => Promise<void>;
  loading: boolean;
  loadError: string | null;
};

const defaultTerms = getTerms(null);

const Ctx = createContext<OrgCtx>({
  medlemskaber: [], aktivOrgId: null, aktivOrg: null, erAdmin: false,
  orgType: null, terms: defaultTerms,
  subscriptionStatus: null, subscriptionTier: null, trialEndsAt: null,
  trialDaysLeft: null, isBlocked: false, blockReason: null,
  vaelgOrg: () => {}, genindlaes: async () => {}, loading: true, loadError: null,
});

const LS_KEY = "tilstede.aktivOrgId";

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [medlemskaber, setMedlemskaber] = useState<Medlemskab[]>([]);
  const [aktivOrgId, setAktivOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const indlaes = useCallback(async () => {
    if (!user) {
      setMedlemskaber([]); setAktivOrgIdState(null); setLoadError(null); setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("organization_members")
      .select("organization_id, role, status, organizations(id, name, org_type, subscription_status, subscription_tier, trial_ends_at)")
      .eq("user_id", user.id)
      .eq("status", "active")
      .limit(50);
    if (error) {
      console.error("OrgContext: organisation_members query fejlede:", error);
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const list = (data ?? []) as unknown as Medlemskab[];
    setMedlemskaber(list);

    const gemt = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
    const valid = list.find((m) => m.organization_id === gemt);
    const valgt = valid?.organization_id ?? list[0]?.organization_id ?? null;
    setAktivOrgIdState(valgt);
    if (valgt && typeof window !== "undefined") localStorage.setItem(LS_KEY, valgt);
    setLoading(false);
  }, [user]);

  useEffect(() => { indlaes(); }, [indlaes]);

  const vaelgOrg = (id: string) => {
    setAktivOrgIdState(id);
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, id);
  };

  const aktivOrg = medlemskaber.find((m) => m.organization_id === aktivOrgId) ?? null;

  // Identify user in PostHog once org data is loaded
  useEffect(() => {
    if (!user || !aktivOrg) return;
    identifyUser(user.id, {
      email: user.email,
      org_type: aktivOrg.organizations?.org_type ?? null,
      plan: aktivOrg.organizations?.subscription_tier ?? null,
      subscription_status: aktivOrg.organizations?.subscription_status ?? null,
      created_at: user.created_at,
    });
  }, [user?.id, aktivOrg?.organization_id]);
  const erAdmin = aktivOrg?.role === "admin";
  const orgType = (aktivOrg?.organizations?.org_type ?? null) as OrgType | null;
  const terms = getTerms(orgType);

  const subscriptionStatus = aktivOrg?.organizations?.subscription_status ?? null;
  const subscriptionTier = aktivOrg?.organizations?.subscription_tier ?? null;
  const trialEndsAt = aktivOrg?.organizations?.trial_ends_at ?? null;

  const trialDaysLeft = (subscriptionStatus === "trialing" && trialEndsAt)
    ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  let isBlocked = false;
  let blockReason: BlockReason = null;

  if (aktivOrg !== null && !loading) {
    const trialExpired = subscriptionStatus === "trialing" && trialEndsAt !== null && new Date(trialEndsAt) <= new Date();
    if (trialExpired) {
      isBlocked = true;
      blockReason = "trial_expired";
    } else if (subscriptionStatus === "canceled" || subscriptionStatus === "expired") {
      isBlocked = true;
      blockReason = "canceled";
    } else if (subscriptionStatus === "past_due") {
      isBlocked = true;
      blockReason = "past_due";
    }
  }

  return (
    <Ctx.Provider value={{
      medlemskaber, aktivOrgId, aktivOrg, erAdmin, orgType, terms,
      subscriptionStatus, subscriptionTier, trialEndsAt, trialDaysLeft, isBlocked, blockReason,
      vaelgOrg, genindlaes: indlaes, loading, loadError,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOrg() { return useContext(Ctx); }
