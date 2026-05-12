import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "./OrgContext";

export type CheckinMethod = "none" | "qr" | "pin" | "both" | "button";

export type FeatureFlags = {
  status: boolean;
  aktiviteter: boolean;
  arbejdstidslog: boolean; // controls Tjek ind visibility
  vagtplan: boolean;
  checkin_method: CheckinMethod;
  auto_close_day: boolean;
  auto_close_time: string; // "HH:MM:SS" from PostgreSQL TIME
};

const DEFAULT_FLAGS: FeatureFlags = {
  status: true,
  aktiviteter: true,
  arbejdstidslog: false,
  vagtplan: false,
  checkin_method: "none",
  auto_close_day: false,
  auto_close_time: "22:00:00",
};

type FeatureFlagsCtx = {
  flags: FeatureFlags;
  loading: boolean;
  updateFlags: (updates: Partial<FeatureFlags>) => Promise<void>;
  reload: () => Promise<void>;
};

const Ctx = createContext<FeatureFlagsCtx>({
  flags: DEFAULT_FLAGS,
  loading: true,
  updateFlags: async () => {},
  reload: async () => {},
});

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const { aktivOrgId } = useOrg();
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);

  const indlaes = useCallback(async () => {
    if (!aktivOrgId) { setFlags(DEFAULT_FLAGS); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("org_feature_flags")
      .select("*")
      .eq("organization_id", aktivOrgId)
      .maybeSingle();
    setFlags(
      data
        ? {
            status: data.status,
            aktiviteter: data.aktiviteter,
            arbejdstidslog: data.arbejdstidslog,
            vagtplan: data.vagtplan,
            checkin_method: data.checkin_method as CheckinMethod,
            auto_close_day: data.auto_close_day ?? false,
            auto_close_time: data.auto_close_time ?? "22:00:00",
          }
        : DEFAULT_FLAGS,
    );
    setLoading(false);
  }, [aktivOrgId]);

  useEffect(() => { indlaes(); }, [indlaes]);

  const updateFlags = useCallback(
    async (updates: Partial<FeatureFlags>) => {
      if (!aktivOrgId) return;
      const newFlags = { ...flags, ...updates };
      setFlags(newFlags);
      await (supabase as any).from("org_feature_flags").upsert(
        { organization_id: aktivOrgId, ...newFlags, updated_at: new Date().toISOString() },
        { onConflict: "organization_id" },
      );
    },
    [aktivOrgId, flags],
  );

  return (
    <Ctx.Provider value={{ flags, loading, updateFlags, reload: indlaes }}>
      {children}
    </Ctx.Provider>
  );
}

export function useFeatureFlags() { return useContext(Ctx); }
