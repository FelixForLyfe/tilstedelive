import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Calendar, Download, ChevronRight, Users, Activity as ActIcon, Clock, Trash2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";
import jsPDF from "jspdf";

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
  const { aktivOrgId, aktivOrg, erAdmin, terms } = useOrg();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const [logs, setLogs] = useState<DagligLog[]>([]);
  const [valgt, setValgt] = useState<DagligLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [maaned, setMaaned] = useState(() => new Date().toISOString().slice(0, 7));

  const indlaes = useCallback(async () => {
    if (!aktivOrgId) return;
    const { data, error } = await supabase
      .from("daily_logs")
      .select("*")
      .eq("organization_id", aktivOrgId)
      .order("date", { ascending: false })
      .limit(365);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setLogs((data as DagligLog[]) ?? []);
  }, [aktivOrgId]);

  useEffect(() => { indlaes(); }, [indlaes]);

  // Realtime: opdater straks når dage lukkes/slettes
  useEffect(() => {
    if (!aktivOrgId) return;
    const ch = supabase.channel(`arkiv-${aktivOrgId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "daily_logs", filter: `organization_id=eq.${aktivOrgId}` },
        () => indlaes())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [aktivOrgId, indlaes]);

  const maanedensLogs = useMemo(
    () => logs.filter((l) => l.date.startsWith(maaned)),
    [logs, maaned],
  );

  if (!erAdmin) {
    return <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Kun admin har adgang til arkivet.</div>;
  }

  const slet = async (log: DagligLog) => {
    if (!confirm(`Slet log for ${formatDansk(log.date)}? Dette kan ikke fortrydes.`)) return;
    const { error } = await supabase.from("daily_logs").delete().eq("id", log.id);
    if (error) return toast.error(error.message);
    if (valgt?.id === log.id) setValgt(null);
    toast.success("Log slettet");
  };

  const eksporterTimesedler = () => {
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
  };

  const eksporterPDF = (log: DagligLog) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const orgNavn = aktivOrg?.organizations?.name ?? "Organisation";
    const margin = 40;
    let y = margin;
    const pageH = doc.internal.pageSize.getHeight();
    const pageW = doc.internal.pageSize.getWidth();

    const linje = (txt: string, size = 10, bold = false) => {
      if (y > pageH - margin) { doc.addPage(); y = margin; }
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(size);
      const wrapped = doc.splitTextToSize(txt, pageW - margin * 2);
      doc.text(wrapped, margin, y);
      y += wrapped.length * (size * 1.2);
    };
    const skil = (h = 8) => { y += h; };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("Daglig log", margin, y); y += 24;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(orgNavn, margin, y); y += 14;
    doc.text(formatDansk(log.date), margin, y); y += 14;
    doc.setTextColor(120);
    doc.text(`Lukket ${new Date(log.closed_at).toLocaleString("da-DK")}`, margin, y);
    doc.setTextColor(0);
    skil(20);

    const fremmoede = (log.attendance_snapshot ?? []) as any[];
    linje(`Fremmøde (${fremmoede.length} ${terms.deltagere} — ${log.total_children_present} mødte ind)`, 13, true);
    skil(4);
    if (fremmoede.length === 0) linje("— ingen registreringer", 10);
    for (const r of fremmoede) {
      const dele = [
        r.child_name ?? cap(terms.deltager),
        statusLabel(r.status),
        r.checked_in_at && `ind ${tid(r.checked_in_at)}`,
        r.checked_out_at && `ud ${tid(r.checked_out_at)}`,
      ].filter(Boolean);
      linje(`• ${dele.join(" · ")}`, 10);
    }
    skil(12);

    const aktiviteter = (log.activities_snapshot ?? []) as any[];
    linje(`Aktiviteter (${aktiviteter.length})`, 13, true);
    skil(4);
    if (aktiviteter.length === 0) linje("— ingen aktiviteter", 10);
    for (const a of aktiviteter) {
      linje(`• ${a.activity_name ?? "Aktivitet"} — ${a.count ?? 0} deltagere${a.any_completed ? " (afsluttet)" : ""}`, 10);
    }
    skil(12);

    const vagter = (log.employee_time_snapshot ?? []) as any[];
    linje(`Personaletid (${vagter.length})`, 13, true);
    skil(4);
    if (vagter.length === 0) linje("— ingen vagter", 10);
    for (const v of vagter) {
      const min = beregnMinutter(v);
      linje(`• ${v.name ?? v.email ?? "Medarbejder"} — ${Math.floor(min / 60)}t ${min % 60}m${v.total_break_minutes ? ` (pause ${v.total_break_minutes}m)` : ""}`, 10);
    }

    doc.save(`daglig-log-${log.date}.pdf`);
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
          <Download className="h-4 w-4" /> Timesedler (CSV)
        </button>
      </div>

      {loading ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Indlæser…</div>
      ) : maanedensLogs.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
          Ingen lukkede dage i denne måned endnu.
        </div>
      ) : (
        <div className="grid gap-2">
          {maanedensLogs.map((log) => (
            <div key={log.id} className="glass flex items-center gap-2 rounded-xl p-3 fade-in">
              <button
                onClick={() => setValgt(log)}
                className="flex flex-1 items-center justify-between gap-3 rounded-lg p-1.5 text-left transition hover:bg-surface-elevated/40"
              >
                <div>
                  <p className="font-semibold">{formatDansk(log.date)}</p>
                  <p className="text-xs text-muted-foreground">
                    Lukket {new Date(log.closed_at).toLocaleString("da-DK")} · {log.total_children_present} {terms.deltagere}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
              <button
                onClick={() => eksporterPDF(log)}
                title="Eksporter som PDF"
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-surface hover:text-foreground"
              >
                <FileText className="h-4 w-4" />
              </button>
              <button
                onClick={() => slet(log)}
                title="Slet log"
                className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/15 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {valgt && <DagDetalje log={valgt} onLuk={() => setValgt(null)} onPDF={() => eksporterPDF(valgt)} onSlet={() => slet(valgt)} />}
    </div>
  );
}

function DagDetalje({ log, onLuk, onPDF, onSlet }: { log: DagligLog; onLuk: () => void; onPDF: () => void; onSlet: () => void }) {
  const { terms } = useOrg();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
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
          <div className="flex items-center gap-1.5">
            <button onClick={onPDF} title="PDF" className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1.5 text-xs">
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
            <button onClick={onSlet} title="Slet" className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onLuk} className="rounded-lg bg-surface px-3 py-1.5 text-sm">Luk</button>
          </div>
        </div>

        <Sektion icon={Users} titel={`Fremmøde — ${fremmoede.length} ${terms.deltagere}`}>
          {fremmoede.length === 0 ? (
            <Tom>Ingen registreringer</Tom>
          ) : (
            <div className="grid gap-1.5">
              {fremmoede.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-surface/60 px-3 py-2 text-sm">
                  <span>{r.child_name ?? cap(terms.deltager)}</span>
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
                  <p className="font-medium">{a.activity_name ?? "Aktivitet"}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.count ?? 0} deltagere{a.any_completed ? " · afsluttet" : ""}
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
