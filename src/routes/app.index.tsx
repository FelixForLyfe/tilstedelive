import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell, BellOff, Lock, Check, Home, Search, StickyNote, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOrg } from "@/contexts/OrgContext";
import { dagensDato, formaterDansk, formaterTid } from "@/lib/dansk";
import { lyde } from "@/lib/lyde";
import { bedOmNotifikationsTilladelse, visNotifikation } from "@/lib/notifikationer";
import { BarnDetalje } from "@/components/BarnDetalje";
import { toast } from "sonner";

export const Route = createFileRoute("/app/")({
  component: Hovedside,
});

const CATEGORY_COLORS = [
  "oklch(0.72 0.18 195)",
  "oklch(0.65 0.20 320)",
  "oklch(0.80 0.16 75)",
  "oklch(0.72 0.18 150)",
  "oklch(0.68 0.18 30)",
  "oklch(0.70 0.10 260)",
  "oklch(0.75 0.15 240)",
  "oklch(0.68 0.20 15)",
];

function nameHue(name: string): number {
  if (!name || name.length < 2) return 180;
  return (name.charCodeAt(0) * 17 + name.charCodeAt(1) * 7) % 360;
}

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

type Kategori = { id: string; name: string; sort_order: number };
type Barn = { id: string; full_name: string; category_id: string | null; default_leave_time: string | null };
type Fremmoede = {
  id: string; child_id: string; status: "present" | "absent" | "picked_up";
  checked_in_at: string | null; checked_out_at: string | null;
  leave_time: string | null; leave_time_unspecified: boolean; leave_notified: boolean;
  daily_note: string | null;
};
type StatusFilter = "alle" | "present" | "absent" | "picked_up";

function StatusPill({ status }: { status: "present" | "absent" | "picked_up" }) {
  const cfg = {
    present:   { cls: "bg-success/15 text-success", dot: "bg-success", label: "Til stede", pulse: true },
    absent:    { cls: "bg-destructive/15 text-destructive", dot: "bg-destructive", label: "Mangler", pulse: false },
    picked_up: { cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground", label: "Sendt hjem", pulse: false },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${cfg.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${cfg.dot} ${cfg.pulse ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  );
}

function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const hue = nameHue(name);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: `linear-gradient(135deg, oklch(0.72 0.18 ${hue}), oklch(0.62 0.20 ${(hue + 30) % 360}))`,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white", fontWeight: 700, fontSize: size * 0.34, letterSpacing: "-0.02em",
      }}
    >
      {getInitials(name)}
    </div>
  );
}

function Hovedside() {
  const { user } = useAuth();
  const { aktivOrgId, erAdmin, terms } = useOrg();
  const dato = dagensDato();

  const [kategorier, setKategorier] = useState<Kategori[]>([]);
  const [boern, setBoern] = useState<Barn[]>([]);
  const [fremmoede, setFremmoede] = useState<Record<string, Fremmoede>>({});
  const [dagLukket, setDagLukket] = useState(false);
  const [notiTilladt, setNotiTilladt] = useState<NotificationPermission>("default");
  const [detaljeId, setDetaljeId] = useState<string | null>(null);

  // Roster UI state
  const [soegning, setSoegning] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("alle");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [noteFor, setNoteFor] = useState<string | null>(null);

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

  // Leave-time alarm every 30s
  useEffect(() => {
    if (!aktivOrgId) return;
    const tjek = () => {
      const nu = new Date();
      const nuStr = `${String(nu.getHours()).padStart(2, "0")}:${String(nu.getMinutes()).padStart(2, "0")}`;
      for (const barn of boern) {
        const f = fremmoede[barn.id];
        if (!f || f.status !== "present" || !f.leave_time || f.leave_notified) continue;
        const lt = f.leave_time.slice(0, 5);
        if (lt <= nuStr && !allerede.current.has(f.id)) {
          allerede.current.add(f.id);
          lyde.hjemAlarm();
          visNotifikation("Tilstede – Hjem", `${barn.full_name} skal hjem nu kl. ${lt}.`);
          toast.warning(`${barn.full_name} skal hjem nu kl. ${lt}`, { duration: 10000 });
          supabase.from("attendance_records").update({ leave_notified: true }).eq("id", f.id).then();
        }
      }
    };
    tjek();
    const id = setInterval(tjek, 30000);
    return () => clearInterval(id);
  }, [boern, fremmoede, aktivOrgId]);

  // Counts
  const tilstedeAntal = useMemo(() => Object.values(fremmoede).filter((f) => f.status === "present").length, [fremmoede]);
  const sendtHjemAntal = useMemo(() => Object.values(fremmoede).filter((f) => f.status === "picked_up").length, [fremmoede]);
  const manglerAntal = boern.length - tilstedeAntal - sendtHjemAntal;

  // Filtered children
  const filtrede = useMemo(() => {
    let res = boern;
    if (statusFilter !== "alle") res = res.filter((b) => (fremmoede[b.id]?.status ?? "absent") === statusFilter);
    const q = soegning.trim().toLowerCase();
    if (q) res = res.filter((b) => b.full_name.toLowerCase().includes(q));
    return res;
  }, [boern, statusFilter, soegning, fremmoede]);

  // Grouped by category
  const grouped = useMemo(() => {
    const groups = kategorier.map((k, i) => ({
      kat: k,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
      boern: filtrede.filter((b) => b.category_id === k.id),
    }));
    const unkategoriserede = filtrede.filter((b) => !b.category_id);
    if (unkategoriserede.length > 0) {
      groups.push({
        kat: { id: "__none__", name: "Uden gruppe", sort_order: 9999 },
        color: "oklch(0.70 0.05 0)",
        boern: unkategoriserede,
      });
    }
    return groups;
  }, [kategorier, filtrede]);

  // Mutations
  const skiftStatus = async (barn: Barn, ny: "present" | "absent" | "picked_up") => {
    if (dagLukket) { toast.error("Dagen er lukket"); return; }
    if (!aktivOrgId || !user) return;
    const eksisterende = fremmoede[barn.id];
    const nu = new Date().toISOString();
    const payload: any = { organization_id: aktivOrgId, child_id: barn.id, date: dato, status: ny, updated_by: user.id };
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

  const saetHjemsendelse = async (barn: Barn, vaerdi: string) => {
    if (dagLukket) { toast.error("Dagen er lukket"); return; }
    if (!aktivOrgId || !user) return;
    const eksisterende = fremmoede[barn.id];
    const payload: any = {
      organization_id: aktivOrgId, child_id: barn.id, date: dato, updated_by: user.id, leave_notified: false,
      leave_time: vaerdi ? (vaerdi.length === 5 ? `${vaerdi}:00` : vaerdi) : null,
      leave_time_unspecified: !vaerdi,
    };
    const { error } = eksisterende
      ? await supabase.from("attendance_records").update(payload).eq("id", eksisterende.id)
      : await supabase.from("attendance_records").insert({ ...payload, status: "absent" });
    if (error) toast.error("Kunne ikke gemme tid", { description: error.message });
    else { lyde.bekraeftelse(); allerede.current.delete(eksisterende?.id ?? ""); }
  };

  const gemDagligNote = async (barn: Barn, tekst: string) => {
    if (dagLukket) { toast.error("Dagen er lukket"); return; }
    if (!aktivOrgId || !user) return;
    const eksisterende = fremmoede[barn.id];
    const payload: any = {
      organization_id: aktivOrgId, child_id: barn.id, date: dato, updated_by: user.id,
      daily_note: tekst.trim() || null,
    };
    const { error } = eksisterende
      ? await supabase.from("attendance_records").update(payload).eq("id", eksisterende.id)
      : await supabase.from("attendance_records").insert({ ...payload, status: "absent" });
    if (error) toast.error("Kunne ikke gemme note", { description: error.message });
    else { lyde.bekraeftelse(); toast.success("Note gemt"); }
  };

  // Bulk actions
  const toggleSel = (id: string) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const clearSel = () => setSelected(new Set());
  const bulkAction = (action: "present" | "absent" | "picked_up") => {
    const targets = boern.filter((b) => selected.has(b.id));
    targets.forEach((b) => skiftStatus(b, action));
    clearSel();
  };

  const aktivér = async () => {
    const tilladt = await bedOmNotifikationsTilladelse();
    setNotiTilladt(tilladt);
    if (tilladt === "granted") toast.success("Notifikationer aktiveret");
    else toast.error("Notifikationer blev ikke aktiveret");
  };

  const noteChild = noteFor ? boern.find((b) => b.id === noteFor) : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{formaterDansk(new Date())}</p>
          <h1 className="font-display text-3xl font-bold">Fremmøde</h1>
        </div>
        <div className="flex items-center gap-2">
          {dagLukket && (
            <div className="flex items-center gap-1.5 rounded-xl bg-warning/15 px-3 py-2 text-sm font-medium text-warning">
              <Lock className="h-4 w-4" /> Dagen er lukket
            </div>
          )}
          {notiTilladt !== "granted" && (
            <button onClick={aktivér}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-medium hover:bg-surface-elevated">
              {notiTilladt === "denied" ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
              <span className="hidden sm:inline">Notifikationer</span>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={soegning}
          onChange={(e) => setSoegning(e.target.value)}
          placeholder={`Søg efter ${terms.deltager}…`}
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm focus:border-ring focus:outline-none"
        />
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-surface p-1.5 sm:grid-cols-4">
        {[
          { id: "alle" as StatusFilter,      label: "Alle",       value: boern.length,   color: "text-foreground" },
          { id: "present" as StatusFilter,   label: "Til stede",  value: tilstedeAntal,  color: "text-success" },
          { id: "absent" as StatusFilter,    label: "Mangler",    value: manglerAntal,   color: "text-destructive" },
          { id: "picked_up" as StatusFilter, label: "Sendt hjem", value: sendtHjemAntal, color: "text-muted-foreground" },
        ].map((s) => {
          const active = statusFilter === s.id;
          return (
            <button key={s.id} onClick={() => setStatusFilter(s.id)}
              className={`flex flex-col items-start gap-1 rounded-xl px-3 py-2.5 text-left transition ${
                active ? "bg-card shadow-sm border border-border" : "hover:bg-card/60"
              }`}>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</span>
              <span className={`font-display text-2xl font-black leading-none ${s.color}`}>{s.value}</span>
            </button>
          );
        })}
      </div>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3">
          <span className="text-sm font-bold">{selected.size} valgt</span>
          <button disabled={dagLukket} onClick={() => bulkAction("present")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-success px-3 py-1.5 text-xs font-semibold text-success-foreground disabled:opacity-50">
            <Check className="h-3 w-3" /> Tjek ind
          </button>
          <button disabled={dagLukket} onClick={() => bulkAction("picked_up")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold disabled:opacity-50">
            <Home className="h-3 w-3" /> Send hjem
          </button>
          <button disabled={dagLukket} onClick={() => bulkAction("absent")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/15 px-3 py-1.5 text-xs font-semibold text-destructive disabled:opacity-50">
            Markér mangler
          </button>
          <button onClick={clearSel} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Fortryd</button>
        </div>
      )}

      {/* Roster table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {/* Table header — hidden on mobile */}
        <div className="hidden border-b border-border bg-surface/80 sm:grid"
          style={{ gridTemplateColumns: "1.4fr 0.6fr 0.65fr 0.65fr auto", gap: "12px", padding: "10px 16px" }}>
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Navn</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Status</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Ind</span>
          <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Hjem</span>
          <span className="w-[88px]" />
        </div>

        {grouped.every((g) => g.boern.length === 0) && (
          <div className="px-6 py-12 text-center text-muted-foreground">
            {boern.length === 0
              ? `Ingen ${terms.deltagere} endnu.${erAdmin ? ` Gå til Admin og tilføj ${terms.deltagere}.` : ""}`
              : `Ingen ${terms.deltagere} matcher søgningen.`}
          </div>
        )}

        {grouped.map(({ kat, color, boern: katBoern }) => {
          if (katBoern.length === 0) return null;
          const isCol = !!collapsed[kat.id];
          const tilstedeTal = katBoern.filter((b) => fremmoede[b.id]?.status === "present").length;
          return (
            <div key={kat.id}>
              {/* Group header */}
              <div
                onClick={() => setCollapsed((c) => ({ ...c, [kat.id]: !c[kat.id] }))}
                className="flex cursor-pointer select-none items-center gap-2.5 border-b border-border px-4 py-2.5"
                style={{ background: `color-mix(in oklab, ${color} 6%, var(--surface, #f8f8f8))` }}
              >
                <ChevronRight
                  className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground transition-transform duration-200"
                  style={{ transform: isCol ? "rotate(0deg)" : "rotate(90deg)" }}
                />
                <span className="h-2 w-2 flex-shrink-0 rounded-sm" style={{ background: color }} />
                <span className="font-display text-sm font-bold">{kat.name}</span>
                <span className="text-xs text-muted-foreground">
                  {tilstedeTal} af {katBoern.length} til stede
                </span>
              </div>

              {/* Rows */}
              {!isCol && katBoern.map((b) => {
                const f = fremmoede[b.id];
                const status = f?.status ?? "absent";
                const isSel = selected.has(b.id);
                return (
                  <div key={b.id}
                    className={`border-b border-border/50 transition-colors last:border-0 ${isSel ? "bg-primary/5" : ""}`}>
                    {/* Desktop row */}
                    <div className="hidden items-center gap-3 px-4 py-3 sm:grid"
                      style={{ gridTemplateColumns: "1.4fr 0.6fr 0.65fr 0.65fr auto" }}>
                      {/* Name cell */}
                      <div className="flex min-w-0 items-center gap-2.5">
                        <input type="checkbox" checked={isSel} onChange={() => toggleSel(b.id)}
                          className="flex-shrink-0 accent-primary cursor-pointer" />
                        <Avatar name={b.full_name} size={30} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-[13.5px]">{b.full_name}</div>
                          {f?.daily_note && (
                            <div className="flex items-center gap-1 truncate text-[11px] text-warning">
                              <StickyNote className="h-2.5 w-2.5 flex-shrink-0" /> {f.daily_note}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Status */}
                      <div><StatusPill status={status} /></div>
                      {/* Check-in time */}
                      <div className="font-mono text-xs text-muted-foreground">
                        {f?.checked_in_at ? formaterTid(f.checked_in_at) : "—"}
                      </div>
                      {/* Leave time */}
                      <div>
                        <input type="time" disabled={dagLukket}
                          value={f?.leave_time?.slice(0, 5) ?? ""}
                          onChange={(e) => saetHjemsendelse(b, e.target.value)}
                          className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-xs disabled:opacity-50" />
                      </div>
                      {/* Actions */}
                      <div className="flex w-[88px] items-center justify-end gap-1">
                        {status !== "present" && (
                          <button disabled={dagLukket} onClick={() => skiftStatus(b, "present")}
                            className="inline-flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                            <Check className="h-3 w-3" /> Ind
                          </button>
                        )}
                        {status === "present" && (
                          <button disabled={dagLukket} onClick={() => skiftStatus(b, "picked_up")}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-semibold disabled:opacity-50">
                            <Home className="h-3 w-3" /> Hjem
                          </button>
                        )}
                        <button disabled={dagLukket} onClick={() => setNoteFor(b.id)}
                          title="Dagens note"
                          className={`rounded-lg px-2 py-1.5 text-xs disabled:opacity-50 ${
                            f?.daily_note ? "bg-warning/15 text-warning" : "border border-border bg-surface text-muted-foreground"
                          }`}>
                          <StickyNote className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Mobile card */}
                    <div className="block p-3 sm:hidden">
                      <div className="flex items-center gap-2.5">
                        <input type="checkbox" checked={isSel} onChange={() => toggleSel(b.id)}
                          className="flex-shrink-0 accent-primary cursor-pointer" />
                        <Avatar name={b.full_name} size={34} />
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm">{b.full_name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <StatusPill status={status} />
                            {f?.checked_in_at && status !== "absent" && (
                              <span className="text-[11px] text-muted-foreground">ind {formaterTid(f.checked_in_at)}</span>
                            )}
                          </div>
                          {f?.daily_note && (
                            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-warning">
                              <StickyNote className="h-2.5 w-2.5" /> {f.daily_note}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <input type="time" disabled={dagLukket}
                          value={f?.leave_time?.slice(0, 5) ?? ""}
                          onChange={(e) => saetHjemsendelse(b, e.target.value)}
                          className="w-24 rounded-md border border-border bg-surface px-2 py-1.5 text-xs disabled:opacity-50" />
                        <div className="flex flex-1 items-center justify-end gap-1">
                          {status !== "present" && (
                            <button disabled={dagLukket} onClick={() => skiftStatus(b, "present")}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                              <Check className="h-3 w-3" /> Tjek ind
                            </button>
                          )}
                          {status === "present" && (
                            <button disabled={dagLukket} onClick={() => skiftStatus(b, "picked_up")}
                              className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-semibold disabled:opacity-50">
                              <Home className="h-3 w-3" /> Send hjem
                            </button>
                          )}
                          <button disabled={dagLukket} onClick={() => setNoteFor(b.id)}
                            className={`rounded-lg px-2.5 py-2 text-xs disabled:opacity-50 ${
                              f?.daily_note ? "bg-warning/15 text-warning" : "border border-border bg-surface text-muted-foreground"
                            }`}>
                            <StickyNote className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setDetaljeId(b.id)}
                            className="rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-muted-foreground">
                            ···
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Note editor modal */}
      {noteFor && noteChild && (
        <NoteEditor
          name={noteChild.full_name}
          value={fremmoede[noteFor]?.daily_note ?? ""}
          onClose={() => setNoteFor(null)}
          onSave={(t) => { gemDagligNote(noteChild, t); setNoteFor(null); }}
        />
      )}

      <BarnDetalje barnId={detaljeId} open={!!detaljeId} onClose={() => setDetaljeId(null)} />
    </div>
  );
}

function NoteEditor({ name, value, onClose, onSave }: {
  name: string; value: string; onClose: () => void; onSave: (t: string) => void;
}) {
  const [tekst, setTekst] = useState(value);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}>
      <div className="glass w-full max-w-md space-y-3 rounded-t-3xl p-5 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Dagens note</p>
          <h3 className="font-display text-lg font-semibold">{name}</h3>
        </div>
        <textarea value={tekst} onChange={(e) => setTekst(e.target.value)} rows={4} autoFocus
          placeholder="Fx besked fra forælder, særlig info for i dag…"
          className="w-full rounded-xl border border-input bg-background p-3 text-sm resize-none" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose}
            className="rounded-xl bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-elevated">Annullér</button>
          <button onClick={() => onSave(tekst)}
            className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Gem note</button>
        </div>
      </div>
    </div>
  );
}
