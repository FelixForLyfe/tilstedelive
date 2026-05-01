import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, Lock, Users, Clock, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { dagensDato, formaterDansk, formaterTid } from "@/lib/dansk";
import { lyde } from "@/lib/lyde";
import { bedOmNotifikationsTilladelse, visNotifikation } from "@/lib/notifikationer";
import { toast } from "sonner";

export const Route = createFileRoute("/app/")({
  component: Hovedside,
});

type Kategori = { id: string; name: string; sort_order: number };
type Barn = { id: string; full_name: string; category_id: string | null; default_leave_time: string | null };
type Fremmoede = {
  id: string; child_id: string; status: "present" | "absent" | "picked_up";
  checked_in_at: string | null; checked_out_at: string | null;
  leave_time: string | null; leave_time_unspecified: boolean; leave_notified: boolean;
};

function Hovedside() {
  const { user } = useAuth();
  const { aktivOrgId, erAdmin } = useOrg();
  const dato = dagensDato();
  const [kategorier, setKategorier] = useState<Kategori[]>([]);
  const [boern, setBoern] = useState<Barn[]>([]);
  const [fremmoede, setFremmoede] = useState<Record<string, Fremmoede>>({});
  const [valgtKategori, setValgtKategori] = useState<string>("alle");
  const [dagLukket, setDagLukket] = useState(false);
  const [notiTilladt, setNotiTilladt] = useState<NotificationPermission>("default");
  const [redigerBarn, setRedigerBarn] = useState<Barn | null>(null);
  const allerede = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setNotiTilladt(Notification.permission);
    }
  }, []);

  const indlaes = useCallback(async () => {
    if (!aktivOrgId) return;
    const [kRes, bRes, aRes, dRes] = await Promise.all([
      supabase.from("categories").select("*").eq("organization_id", aktivOrgId).order("sort_order"),
      supabase.from("children").select("id, full_name, category_id, default_leave_time").eq("organization_id", aktivOrgId).order("full_name"),
      supabase.from("attendance_records").select("*").eq("organization_id", aktivOrgId).eq("date", dato),
      supabase.from("day_status").select("is_closed").eq("organization_id", aktivOrgId).eq("date", dato).maybeSingle(),
    ]);
    if (kRes.data) setKategorier(kRes.data);
    if (bRes.data) setBoern(bRes.data);
    if (aRes.data) {
      const map: Record<string, Fremmoede> = {};
      for (const a of aRes.data as any[]) map[a.child_id] = a;
      setFremmoede(map);
    }
    setDagLukket(!!dRes.data?.is_closed);
  }, [aktivOrgId, dato]);

  useEffect(() => { indlaes(); }, [indlaes]);

  // Realtime
  useEffect(() => {
    if (!aktivOrgId) return;
    const ch = supabase.channel(`org-${aktivOrgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance_records", filter: `organization_id=eq.${aktivOrgId}` }, indlaes)
      .on("postgres_changes", { event: "*", schema: "public", table: "children", filter: `organization_id=eq.${aktivOrgId}` }, indlaes)
      .on("postgres_changes", { event: "*", schema: "public", table: "categories", filter: `organization_id=eq.${aktivOrgId}` }, indlaes)
      .on("postgres_changes", { event: "*", schema: "public", table: "day_status", filter: `organization_id=eq.${aktivOrgId}` }, indlaes)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [aktivOrgId, indlaes]);

  // Hjemsendelses-tjek hvert 30. sek
  useEffect(() => {
    if (!aktivOrgId) return;
    const tjek = () => {
      const nu = new Date();
      const hh = String(nu.getHours()).padStart(2, "0");
      const mm = String(nu.getMinutes()).padStart(2, "0");
      const nuStr = `${hh}:${mm}`;
      for (const barn of boern) {
        const f = fremmoede[barn.id];
        if (!f || f.status !== "present" || !f.leave_time || f.leave_notified) continue;
        const lt = f.leave_time.slice(0, 5);
        if (lt <= nuStr && !allerede.current.has(f.id)) {
          allerede.current.add(f.id);
          lyde.hjemAlarm();
          visNotifikation("Tilstede – Hjem", `${barn.full_name} skal hjem nu kl. ${lt}.`);
          toast.warning(`${barn.full_name} skal hjem nu kl. ${lt}`, { duration: 10000 });
          // Marker som notificeret (best effort)
          supabase.from("attendance_records").update({ leave_notified: true }).eq("id", f.id).then();
        }
      }
    };
    tjek();
    const id = setInterval(tjek, 30000);
    return () => clearInterval(id);
  }, [boern, fremmoede, aktivOrgId]);

  const filtrede = useMemo(() => {
    if (valgtKategori === "alle") return boern;
    if (valgtKategori === "ingen") return boern.filter((b) => !b.category_id);
    return boern.filter((b) => b.category_id === valgtKategori);
  }, [boern, valgtKategori]);

  const tilstedeAntal = useMemo(
    () => Object.values(fremmoede).filter((f) => f.status === "present").length,
    [fremmoede],
  );

  const skiftStatus = async (barn: Barn, ny: "present" | "absent" | "picked_up") => {
    if (dagLukket) { toast.error("Dagen er lukket"); return; }
    if (!aktivOrgId || !user) return;
    const eksisterende = fremmoede[barn.id];
    const nu = new Date().toISOString();
    const payload: any = {
      organization_id: aktivOrgId, child_id: barn.id, date: dato, status: ny, updated_by: user.id,
    };
    if (ny === "present") {
      payload.checked_in_at = eksisterende?.checked_in_at ?? nu;
      payload.checked_out_at = null;
      if (!eksisterende?.leave_time && barn.default_leave_time) payload.leave_time = barn.default_leave_time;
    } else if (ny === "picked_up") {
      payload.checked_out_at = nu;
    } else {
      payload.checked_in_at = null; payload.checked_out_at = null;
    }
    const { error } = eksisterende
      ? await supabase.from("attendance_records").update(payload).eq("id", eksisterende.id)
      : await supabase.from("attendance_records").insert(payload);
    if (error) { toast.error("Kunne ikke opdatere", { description: error.message }); return; }
    if (ny === "present") lyde.ind();
    else if (ny === "picked_up") lyde.ud();
    else lyde.bekraeftelse();
  };

  const saetHjemsendelse = async (barn: Barn, vaerdi: string | "X") => {
    if (dagLukket) { toast.error("Dagen er lukket"); return; }
    if (!aktivOrgId || !user) return;
    const eksisterende = fremmoede[barn.id];
    const payload: any = {
      organization_id: aktivOrgId, child_id: barn.id, date: dato, updated_by: user.id,
      leave_notified: false,
    };
    if (vaerdi === "X") {
      payload.leave_time = null; payload.leave_time_unspecified = true;
    } else if (vaerdi) {
      payload.leave_time = vaerdi.length === 5 ? `${vaerdi}:00` : vaerdi;
      payload.leave_time_unspecified = false;
    } else {
      payload.leave_time = null; payload.leave_time_unspecified = false;
    }
    const { error } = eksisterende
      ? await supabase.from("attendance_records").update(payload).eq("id", eksisterende.id)
      : await supabase.from("attendance_records").insert({ ...payload, status: "absent" });
    if (error) toast.error("Kunne ikke gemme tid", { description: error.message });
    else { lyde.bekraeftelse(); allerede.current.delete(eksisterende?.id ?? ""); }
  };

  const aktivér = async () => {
    const tilladt = await bedOmNotifikationsTilladelse();
    setNotiTilladt(tilladt);
    if (tilladt === "granted") toast.success("Notifikationer aktiveret");
    else toast.error("Notifikationer blev ikke aktiveret");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{formaterDansk(new Date())}</p>
          <h1 className="font-display text-3xl font-bold">Status</h1>
        </div>
        <div className="flex items-center gap-2">
          {notiTilladt !== "granted" && (
            <button onClick={aktivér}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface-elevated">
              {notiTilladt === "denied" ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              Aktivér notifikationer
            </button>
          )}
        </div>
      </div>

      <div className="glass relative overflow-hidden rounded-3xl p-6 shadow-card">
        <div className="absolute inset-0 bg-gradient-primary opacity-10" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
              <Users className="h-4 w-4" /> Tilstede nu
            </p>
            <p className="mt-1 font-display text-6xl font-black tracking-tight">
              <span className="bg-gradient-primary bg-clip-text text-transparent">{tilstedeAntal}</span>
            </p>
            <p className="text-sm text-muted-foreground">af {boern.length} børn</p>
          </div>
          {dagLukket && (
            <div className="flex items-center gap-2 rounded-xl bg-warning/15 px-3 py-2 text-sm font-medium text-warning">
              <Lock className="h-4 w-4" /> Dagen er lukket
            </div>
          )}
        </div>
      </div>

      {dagLukket && !erAdmin && (
        <div className="glass rounded-2xl border-l-4 border-warning p-5 text-sm">
          Dagen er lukket. Du kan ikke ændre fremmøde før næste dag, eller indtil en admin genåbner dagen.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <select value={valgtKategori} onChange={(e) => setValgtKategori(e.target.value)}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium">
          <option value="alle">Alle kategorier ({boern.length})</option>
          {kategorier.map((k) => {
            const antal = boern.filter((b) => b.category_id === k.id).length;
            return <option key={k.id} value={k.id}>{k.name} ({antal})</option>;
          })}
          <option value="ingen">Uden kategori</option>
        </select>
      </div>

      {filtrede.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          Ingen børn endnu. {erAdmin ? "Gå til Admin og tilføj børn." : "Bed en admin om at tilføje børn."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrede.map((b) => {
            const f = fremmoede[b.id];
            const status = f?.status ?? "absent";
            return (
              <div key={b.id}
                className={`glass rounded-2xl p-4 transition ${
                  status === "present" ? "ring-1 ring-success/40 shadow-glow" :
                  status === "picked_up" ? "opacity-70" : ""
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-display text-lg font-semibold leading-tight">{b.full_name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {status === "present" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-success">
                          <span className="h-1.5 w-1.5 rounded-full bg-success" /> Tilstede
                        </span>
                      )}
                      {status === "absent" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-destructive">
                          <span className="h-1.5 w-1.5 rounded-full bg-destructive" /> Ikke kommet
                        </span>
                      )}
                      {status === "picked_up" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5">
                          Gået hjem
                        </span>
                      )}
                      {f?.checked_in_at && status !== "absent" && (
                        <span>· ind {formaterTid(f.checked_in_at)}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-3 gap-1.5">
                  <button disabled={dagLukket} onClick={() => skiftStatus(b, "present")}
                    className={`rounded-lg py-2 text-xs font-semibold transition ${status === "present" ? "bg-success text-success-foreground" : "bg-surface hover:bg-surface-elevated"} disabled:opacity-50`}>
                    <Check className="mx-auto h-4 w-4" />
                  </button>
                  <button disabled={dagLukket} onClick={() => skiftStatus(b, "absent")}
                    className={`rounded-lg py-2 text-xs font-semibold transition ${status === "absent" ? "bg-destructive text-destructive-foreground" : "bg-surface hover:bg-surface-elevated"} disabled:opacity-50`}>
                    <X className="mx-auto h-4 w-4" />
                  </button>
                  <button disabled={dagLukket} onClick={() => skiftStatus(b, "picked_up")}
                    className={`rounded-lg py-2 text-[10px] font-semibold transition ${status === "picked_up" ? "bg-foreground text-background" : "bg-surface hover:bg-surface-elevated"} disabled:opacity-50`}>
                    Hjem
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <input type="time" disabled={dagLukket}
                    value={f?.leave_time?.slice(0, 5) ?? ""}
                    onChange={(e) => saetHjemsendelse(b, e.target.value)}
                    className="flex-1 rounded-lg border border-input bg-background px-2 py-1.5 text-xs disabled:opacity-50" />
                  <button disabled={dagLukket} title="Ukendt tidspunkt"
                    onClick={() => saetHjemsendelse(b, "X")}
                    className={`rounded-lg px-2 py-1.5 text-xs font-bold ${f?.leave_time_unspecified ? "bg-warning text-warning-foreground" : "bg-surface hover:bg-surface-elevated"} disabled:opacity-50`}>
                    X
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
