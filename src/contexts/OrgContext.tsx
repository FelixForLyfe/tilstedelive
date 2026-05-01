import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./AuthContext";

export type Medlemskab = {
  organization_id: string;
  role: "admin" | "employee";
  status: "active" | "pending";
  organizations: { id: string; name: string } | null;
};

type OrgCtx = {
  medlemskaber: Medlemskab[];
  aktivOrgId: string | null;
  aktivOrg: Medlemskab | null;
  erAdmin: boolean;
  vaelgOrg: (id: string) => void;
  genindlaes: () => Promise<void>;
  loading: boolean;
};

const Ctx = createContext<OrgCtx>({
  medlemskaber: [], aktivOrgId: null, aktivOrg: null, erAdmin: false,
  vaelgOrg: () => {}, genindlaes: async () => {}, loading: true,
});

const LS_KEY = "tilstede.aktivOrgId";

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [medlemskaber, setMedlemskaber] = useState<Medlemskab[]>([]);
  const [aktivOrgId, setAktivOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const indlaes = useCallback(async () => {
    if (!user) {
      setMedlemskaber([]); setAktivOrgIdState(null); setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("organization_members")
      .select("organization_id, role, status, organizations(id, name)")
      .eq("user_id", user.id)
      .eq("status", "active");
    if (error) { console.error(error); setLoading(false); return; }
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
  const erAdmin = aktivOrg?.role === "admin";

  return (
    <Ctx.Provider value={{ medlemskaber, aktivOrgId, aktivOrg, erAdmin, vaelgOrg, genindlaes: indlaes, loading }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOrg() { return useContext(Ctx); }
