import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Clock, Play, Coffee, Square, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { dagensDato, formaterTid } from "@/lib/dansk";
import { lyde } from "@/lib/lyde";
import { toast } from "sonner";

export const Route = createFileRoute("/app/logning")({ component: Logning });

type Log = {
  id: string; status: "not_started" | "working" | "on_break" | "finished";
  shift_started_at: string | null; break_started_at: string | null;
  total_break_minutes: number; shift_ended_at: string | null;
};

function Logning() {
  const { user } = useAuth();
  const { aktivOrgId, erAdmin } = useOrg();
  const dato = dagensDato();
  const [log, setLog] = useState<Log | null>(null);
  const [dagLukket, setDagLukket] = useState(false);
  const [lukker, setLukker] = useState(false);

  const indlaes = useCallback(async () => {
    if (!aktivOrgId || !user) return;
    const [lRes, dRes] = await Promise.all([
      supabase.from("employee_time_logs").select("*").eq("organization_id", aktivOrgId).eq("user_id", user.id).eq("date", dato).maybeSingle(),
      supabase.from("day_status").select("is_closed").eq("organization_id", aktivOrgId).eq("date", dato).maybeSingle(),
    ]);
    setLog((lRes.data as any) ?? null);
    setDagLukket(!!dRes.data?.is_closed);
  }, [aktivOrgId, user, dato]);

  useEffect(() => { indlaes(); }, [indlaes]);

  const upsert = async (patch: Partial<Log>) => {
    if (!aktivOrgId || !user) return;
    if (log) {
      const { error } = await supabase.from("employee_time_logs").update(patch).eq("id", log.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("employee_time_logs").insert({ organization_id: aktivOrgId, user_id: user.id, date: dato, ...patch });
      if (error) return toast.error(error.message);
    }
    lyde.bekraeftelse();
    indlaes();
  };

  const startVagt = () => upsert({ status: "working", shift_started_at: new Date().toISOString() });
  const startPause = () => upsert({ status: "on_break", break_started_at: new Date().toISOString() });
  const slutPause = () => {
    if (!log?.break_started_at) return;
    const min = Math.round((Date.now() - new Date(log.break_started_at).getTime()) / 60000);
    upsert({ status: "working", break_started_at: null, total_break_minutes: (log.total_break_minutes ?? 0) + min });
  };
  const slutVagt = () => upsert({ status: "finished", shift_ended_at: new Date().toISOString() });

  const lukDag = async () => {
    if (!aktivOrgId || !user) return;
    if (!confirm("Luk dagen? Personale kan ikke længere ændre fremmøde.")) return;
    setLukker(true);
    const { error } = await supabase.from("day_status").upsert({
      organization_id: aktivOrgId, date: dato, is_closed: true, closed_by: user.id, closed_at: new Date().toISOString(),
    }, { onConflict: "organization_id,date" });
    setLukker(false);
    if (error) return toast.error(error.message);
    toast.success("Dagen er lukket");
    indlaes();
  };

  const genaaben = async () => {
    if (!aktivOrgId) return;
    const { error } = await supabase.from("day_status").update({ is_closed: false }).eq("organization_id", aktivOrgId).eq("date", dato);
    if (error) return toast.error(error.message);
    toast.success("Dagen er genåbnet");
    indlaes();
  };

  const status = log?.status ?? "not_started";

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Logning</h1>

      <div className="glass rounded-2xl p-6">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Min vagt i dag</p>
        <p className="mt-1 font-display text-2xl font-bold">
          {status === "not_started" && "Ikke startet"}
          {status === "working" && "På vagt"}
          {status === "on_break" && "På pause"}
          {status === "finished" && "Vagt afsluttet"}
        </p>
        <div className="mt-2 text-sm text-muted-foreground">
          {log?.shift_started_at && <>Start: {formaterTid(log.shift_started_at)} · </>}
          {log?.shift_ended_at && <>Slut: {formaterTid(log.shift_ended_at)} · </>}
          Pause: {log?.total_break_minutes ?? 0} min
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button disabled={status !== "not_started"} onClick={startVagt}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-40">
            <Play className="h-4 w-4" /> Start vagt
          </button>
          <button disabled={status !== "working"} onClick={startPause}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm font-semibold disabled:opacity-40">
            <Coffee className="h-4 w-4" /> Start pause
          </button>
          <button disabled={status !== "on_break"} onClick={slutPause}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-surface px-4 py-3 text-sm font-semibold disabled:opacity-40">
            <Clock className="h-4 w-4" /> Slut pause
          </button>
          <button disabled={status === "not_started" || status === "finished"} onClick={slutVagt}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground disabled:opacity-40">
            <Square className="h-4 w-4" /> Slut vagt
          </button>
        </div>
      </div>

      {erAdmin && (
        <div className="glass rounded-2xl p-6">
          <p className="font-display text-lg font-bold">Dagens lukning</p>
          <p className="text-sm text-muted-foreground">Når dagen lukkes, kan personale ikke længere ændre fremmøde eller aktiviteter for i dag.</p>
          <div className="mt-4 flex gap-2">
            {!dagLukket ? (
              <button disabled={lukker} onClick={lukDag}
                className="inline-flex items-center gap-2 rounded-xl bg-warning px-4 py-2 text-sm font-semibold text-warning-foreground">
                <Lock className="h-4 w-4" /> Luk dagen
              </button>
            ) : (
              <button onClick={genaaben}
                className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                Genåbn dagen
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
