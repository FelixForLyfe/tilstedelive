import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Calendar, Download, ChevronRight, Users, Activity as ActIcon, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";

export const Route = createFileRoute("/app/arkiv")({
  component: ArkivSide,
});

type DagligLog = {
  id: string;
  date: string;
  closed_at: string;
  total_children_present: number;
  attendance_snapshot: any;
  activities_snapshot: any;
  employee_time_snapshot: any;
};

function ArkivSide() {
  const { aktivOrgId, erAdmin } = useOrg();
  const [logs, setLogs] = useState<DagligLog[]>([]);
  const [valgt, setValgt] = useState<DagligLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [maaned, setMaaned] = useState(() => new Date().toISOString().slice(0, 7)); // YYYY-MM

  const indlaes = useCallback(async () => {
    if (!aktivOrgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("organization_id", aktivOrgId)
      .order("date", { ascending: false })
      .limit(180);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setLogs((data as DagligLog[]) ?? []);
  }, [aktivOrgId]);

  useEffect(() => { indlaes(); }, [indlaes]);

  const maanedensLogs = useMemo(
    () => logs.filter((l) => l.date.startsWith(maaned)),
    [logs, maaned],
  );

  if (!erAdmin) {
    return <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Kun admin har adgang til arkivet.</div>;
  }

  const eksporterTimesedler = () => {
    // Saml minutter pr. medarbejder for valgt måned
    type Row = { name: string; email: string; minutter: number; dage: number };
    const acc: Record<string, Row> = {};
    for (const log of maanedensLogs) {
      const snap = (log.employee_time_snapshot ?? []) as any[];
      for (const e of snap) {
        const key = e.user_id ?? e.email ?? e.name ?? "ukendt";
        if (!acc[key]) acc[key] = { name: e.name ?? "", email: e.email ?? "", minutter: 0, dage: 0 };
        const min = beregnMinutter(e);
        if (min > 0) {
          acc[key].minutter += min;
          acc[key].dage += 1;
        }
      }
    }
    const rows = Object.values(acc).sort((a, b) => b.minutter - a.minutter);
    if (rows.length === 0) {
      toast.error("Ingen tidsdata for denne måned");
      return;
    }
    const csv = [
      "Navn;E-mail;Arbejdsdage;Timer;Minutter;Total minutter",
      ...rows.map((r) =>
        [r.name, r.email, r.dage, Math.floor(r.minutter / 60), r.minutter % 60, r.minutter]
          .map((v) => String(v).replace(/;/g, ",")).join(";"),
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timesedler-${maaned}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Timesedler downloadet");
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Arkiv</h1>
          <p className="text-sm text-muted-foreground">Lukkede dage og månedlige timesedler.</p>
        </div>
        <Archive className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Måneds-filter + eksport */}
      <div className="glass flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <input
          type="month"
          value={maaned}
          onChange={(e) => setMaaned(e.target.value)}
          className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
        />
        <span className="text-xs text-muted-foreground">{maanedensLogs.length} lukkede dage</span>
        <button
          onClick={eksporterTimesedler}
          className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
        >
          <Download className="h-4 w-4" /> Eksporter timesedler (CSV)
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Indlæser…</div>
      ) : maanedensLogs.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          Ingen lukkede dage i denne måned endnu.
        </div>
      ) : (
        <div className="grid gap-2">
          {maanedensLogs.map((log) => (
            <button
              key={log.id}
              onClick={() => setValgt(log)}
              className="glass flex items-center justify-between gap-3 rounded-xl p-4 text-left transition hover:bg-surface-elevated/40"
            >
              <div>
                <p className="font-semibold">{formatDansk(log.date)}</p>
                <p className="text-xs text-muted-foreground">
                  Lukket {new Date(log.closed_at).toLocaleString("da-DK")} · {log.total_children_present} børn
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}

      {valgt && <DagDetalje log={valgt} onLuk={() => setValgt(null)} />}
    </div>
  );
}

function DagDetalje({ log, onLuk }: { log: DagligLog; onLuk: () => void }) {
  const fremmoede = (log.attendance_snapshot ?? []) as any[];
  const aktiviteter = (log.activities_snapshot ?? []) as any[];
  const vagter = (log.employee_time_snapshot ?? []) as any[];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 p-3 backdrop-blur-sm sm:items-center" onClick={onLuk}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl p-5 fade-in"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold">{formatDansk(log.date)}</h2>
            <p className="text-xs text-muted-foreground">
              Lukket {new Date(log.closed_at).toLocaleString("da-DK")}
            </p>
          </div>
          <button onClick={onLuk} className="rounded-lg bg-surface px-3 py-1.5 text-sm">Luk</button>
        </div>

        <Sektion icon={Users} titel={`Fremmøde (${fremmoede.length})`}>
          {fremmoede.length === 0 ? (
            <Tom>Ingen registreringer</Tom>
          ) : (
            <div className="grid gap-1.5">
              {fremmoede.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-surface/60 px-3 py-2 text-sm">
                  <span>{r.child_name ?? r.name ?? r.full_name ?? "Barn"}</span>
                  <span className="text-xs text-muted-foreground">
                    {statusLabel(r.status)}
                    {r.checked_in_at && ` · ind ${tid(r.checked_in_at)}`}
                    {r.checked_out_at && ` · ud ${tid(r.checked_out_at)}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Sektion>

        <Sektion icon={ActIcon} titel={`Aktiviteter (${aktiviteter.length})`}>
          {aktiviteter.length === 0 ? (
            <Tom>Ingen aktiviteter</Tom>
          ) : (
            <div className="grid gap-1.5">
              {aktiviteter.map((a, i) => (
                <div key={i} className="rounded-lg bg-surface/60 px-3 py-2 text-sm">
                  <p className="font-medium">{a.activity_name ?? a.name ?? "Aktivitet"}</p>
                  <p className="text-xs text-muted-foreground">
                    {(a.children ?? a.assignments ?? []).length || a.count || 0} deltagere
                    {a.status && ` · ${a.status === "completed" ? "afsluttet" : "aktiv"}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Sektion>

        <Sektion icon={Clock} titel={`Personaletid (${vagter.length})`}>
          {vagter.length === 0 ? (
            <Tom>Ingen vagter</Tom>
          ) : (
            <div className="grid gap-1.5">
              {vagter.map((v, i) => {
                const min = beregnMinutter(v);
                return (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-surface/60 px-3 py-2 text-sm">
                    <span>{v.name ?? v.email ?? "Medarbejder"}</span>
                    <span className="text-xs text-muted-foreground">
                      {Math.floor(min / 60)}t {min % 60}m
                      {v.total_break_minutes ? ` · pause ${v.total_break_minutes}m` : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Sektion>
      </div>
    </div>
  );
}

function Sektion({ icon: Icon, titel, children }: { icon: any; titel: string; children: React.ReactNode }) {
  return (
    <section className="mt-4">
      <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Icon className="h-4 w-4" /> {titel}
      </h3>
      {children}
    </section>
  );
}

function Tom({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-surface/40 px-3 py-2 text-xs text-muted-foreground">{children}</p>;
}

function tid(iso: string) {
  return new Date(iso).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" });
}

function statusLabel(s?: string) {
  switch (s) {
    case "present": return "tilstede";
    case "checked_out": return "afhentet";
    case "sick": return "syg";
    case "absent": return "fraværende";
    default: return s ?? "";
  }
}

function formatDansk(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("da-DK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function beregnMinutter(v: any): number {
  if (typeof v.total_minutes === "number") return v.total_minutes;
  if (!v.shift_started_at) return 0;
  const start = new Date(v.shift_started_at).getTime();
  const slut = v.shift_ended_at ? new Date(v.shift_ended_at).getTime() : start;
  return Math.max(0, Math.round((slut - start) / 60000) - (v.total_break_minutes ?? 0));
}
