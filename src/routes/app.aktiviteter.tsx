import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Check, Plus, Search, Trash2, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { dagensDato, formaterTid } from "@/lib/dansk";
import { lyde } from "@/lib/lyde";
import { toast } from "sonner";

export const Route = createFileRoute("/app/aktiviteter")({ component: AktiviteterSide });

type Aktivitet = { id: string; name: string; description: string | null; is_active: boolean };
type Barn = { id: string; full_name: string };
type Tildeling = {
  id: string;
  activity_id: string;
  child_id: string;
  status: "active" | "completed" | "cancelled";
  completed_at: string | null;
  assigned_at: string;
};

function AktiviteterSide() {
  const { user } = useAuth();
  const { aktivOrgId, terms } = useOrg();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const dato = dagensDato();
  const [aktiviteter, setAktiviteter] = useState<Aktivitet[]>([]);
  const [tilstede, setTilstede] = useState<Barn[]>([]);
  const [tildelinger, setTildelinger] = useState<Tildeling[]>([]);
  const [dagLukket, setDagLukket] = useState(false);
  const [valgt, setValgt] = useState<string | null>(null);
  const [soegning, setSoegning] = useState("");

  const indlaes = useCallback(async () => {
    if (!aktivOrgId) return;
    const [aRes, bRes, tRes, dRes] = await Promise.all([
      supabase.from("activities").select("*").eq("organization_id", aktivOrgId).eq("is_active", true).order("name"),
      supabase.from("attendance_records").select("child_id, status, children(id, full_name)").eq("organization_id", aktivOrgId).eq("date", dato).eq("status", "present"),
      supabase.from("activity_assignments").select("*").eq("organization_id", aktivOrgId).eq("date", dato),
      supabase.from("day_status").select("is_closed").eq("organization_id", aktivOrgId).eq("date", dato).maybeSingle(),
    ]);
    setAktiviteter((aRes.data as any) ?? []);
    const boern: Barn[] = (bRes.data as any[] ?? [])
      .map((r) => r.children)
      .filter(Boolean)
      .sort((a: Barn, b: Barn) => a.full_name.localeCompare(b.full_name));
    setTilstede(boern);
    setTildelinger((tRes.data as any) ?? []);
    setDagLukket(!!dRes.data?.is_closed);
  }, [aktivOrgId, dato]);

  useEffect(() => { indlaes(); }, [indlaes]);

  // Realtime
  useEffect(() => {
    if (!aktivOrgId) return;
    const ch = supabase.channel(`akt-${aktivOrgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "activity_assignments", filter: `organization_id=eq.${aktivOrgId}` }, indlaes)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records", filter: `organization_id=eq.${aktivOrgId}` }, indlaes)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities", filter: `organization_id=eq.${aktivOrgId}` }, indlaes)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [aktivOrgId, indlaes]);

  const tildelingerPerAktivitet = useMemo(() => {
    const map: Record<string, Tildeling[]> = {};
    for (const t of tildelinger) {
      (map[t.activity_id] ??= []).push(t);
    }
    return map;
  }, [tildelinger]);

  const valgtAktivitet = aktiviteter.find((a) => a.id === valgt) ?? null;

  const tildel = async (aktivitetId: string, barnId: string) => {
    if (dagLukket) return toast.error("Dagen er lukket");
    if (!aktivOrgId || !user) return;
    const eksisterende = tildelinger.find((t) => t.activity_id === aktivitetId && t.child_id === barnId && t.status !== "cancelled");
    if (eksisterende) {
      // toggle: marker udført / aktiv
      const ny = eksisterende.status === "completed" ? "active" : "completed";
      const { error } = await supabase.from("activity_assignments").update({
        status: ny,
        completed_at: ny === "completed" ? new Date().toISOString() : null,
        completed_by: ny === "completed" ? user.id : null,
      }).eq("id", eksisterende.id);
      if (error) return toast.error(error.message);
      lyde.bekraeftelse();
    } else {
      const { error } = await supabase.from("activity_assignments").insert({
        organization_id: aktivOrgId,
        date: dato,
        activity_id: aktivitetId,
        child_id: barnId,
        assigned_by: user.id,
        status: "active",
      });
      if (error) return toast.error(error.message);
      lyde.bekraeftelse();
    }
  };

  const fjernTildeling = async (id: string) => {
    if (dagLukket) return toast.error("Dagen er lukket");
    const { error } = await supabase.from("activity_assignments").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const filtreredeBoern = useMemo(() => {
    const q = soegning.trim().toLowerCase();
    if (!q) return tilstede;
    return tilstede.filter((b) => b.full_name.toLowerCase().includes(q));
  }, [tilstede, soegning]);

  if (!aktivOrgId) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">I dag</p>
          <h1 className="font-display text-3xl font-bold">Aktiviteter</h1>
        </div>
        {dagLukket && (
          <div className="flex items-center gap-2 rounded-xl bg-warning/15 px-3 py-2 text-sm font-medium text-warning">
            <Lock className="h-4 w-4" /> Dagen er lukket
          </div>
        )}
      </div>

      {aktiviteter.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          <Activity className="mx-auto mb-3 h-8 w-8" />
          Ingen aktive aktiviteter. Bed en admin om at oprette dem under Admin → Aktiviteter.
        </div>
      ) : (
        <>
          {/* Aktivitets-vælger */}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {aktiviteter.map((a) => {
              const antal = (tildelingerPerAktivitet[a.id] ?? []).filter((t) => t.status !== "cancelled").length;
              const aktiv = valgt === a.id;
              return (
                <button key={a.id} onClick={() => setValgt(aktiv ? null : a.id)}
                  className={`glass rounded-2xl p-4 text-left transition ${aktiv ? "ring-2 ring-primary shadow-glow" : "hover:bg-surface-elevated"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-lg font-semibold">{a.name}</p>
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">{antal}</span>
                  </div>
                  {a.description && <p className="mt-1 text-xs text-muted-foreground">{a.description}</p>}
                </button>
              );
            })}
          </div>

          {/* Detaljer for valgt aktivitet */}
          {valgtAktivitet && (
            <div className="glass space-y-4 rounded-2xl p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold">{valgtAktivitet.name}</h2>
                <button onClick={() => setValgt(null)} className="text-xs text-muted-foreground hover:text-foreground">Luk</button>
              </div>

              {/* Tildelte børn */}
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Tildelte i dag</p>
                {(tildelingerPerAktivitet[valgtAktivitet.id] ?? []).filter((t) => t.status !== "cancelled").length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen tildelt endnu. Tilføj fra listen nedenfor.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(tildelingerPerAktivitet[valgtAktivitet.id] ?? [])
                      .filter((t) => t.status !== "cancelled")
                      .map((t) => {
                        const barn = tilstede.find((b) => b.id === t.child_id);
                        const navn = barn?.full_name ?? "Ukendt";
                        const udfoert = t.status === "completed";
                        return (
                          <div key={t.id} className={`flex items-center justify-between gap-2 rounded-xl border border-border p-2.5 ${udfoert ? "bg-success/10" : "bg-surface"}`}>
                            <div className="min-w-0 flex-1">
                              <p className={`truncate text-sm font-medium ${udfoert ? "line-through opacity-70" : ""}`}>{navn}</p>
                              {t.completed_at && <p className="text-[10px] text-muted-foreground">Udført {formaterTid(t.completed_at)}</p>}
                            </div>
                            <button disabled={dagLukket} onClick={() => tildel(valgtAktivitet.id, t.child_id)}
                              className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${udfoert ? "bg-success text-success-foreground" : "bg-surface-elevated hover:bg-primary hover:text-primary-foreground"} disabled:opacity-50`}>
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button disabled={dagLukket} onClick={() => fjernTildeling(t.id)}
                              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-50">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Tilføj tilstedeværende børn */}
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Tilføj {terms.deltager}</p>
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="search"
                    value={soegning}
                    onChange={(e) => setSoegning(e.target.value)}
                    placeholder={`Søg blandt tilstedeværende ${terms.deltagere}…`}
                    className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm focus:border-ring focus:outline-none"
                  />
                </div>
                {filtreredeBoern.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Ingen tilstedeværende {terms.deltagere} matcher.</p>
                ) : (
                  <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {filtreredeBoern.map((b) => {
                      const eksisterende = (tildelingerPerAktivitet[valgtAktivitet.id] ?? []).find(
                        (t) => t.child_id === b.id && t.status !== "cancelled",
                      );
                      const tildelt = !!eksisterende;
                      return (
                        <button key={b.id} disabled={dagLukket || tildelt} onClick={() => tildel(valgtAktivitet.id, b.id)}
                          className={`inline-flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                            tildelt ? "bg-success/15 text-success" : "bg-surface hover:bg-primary hover:text-primary-foreground"
                          } disabled:opacity-50`}>
                          <span className="truncate">{b.full_name}</span>
                          {tildelt ? <Check className="h-4 w-4 shrink-0" /> : <Plus className="h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
