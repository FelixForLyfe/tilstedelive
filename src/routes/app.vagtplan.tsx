import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft, ChevronRight, Plus, Users, Lock, Send, Trash2, X,
  AlertTriangle, CalendarDays, ArrowLeftRight, UserX,
  Clock as ClockIcon, LayoutGrid, Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";
import { trackEvent } from "@/lib/posthog";

export const Route = createFileRoute("/app/vagtplan")({
  component: VagtplanSide,
});

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const DAY_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];
const PRESET_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

// Grid constants — 1 px per minute, range 07:00–23:00
const GRID_START_MIN = 7 * 60;  // 420
const GRID_END_MIN = 23 * 60;   // 1380
const PX_PER_MIN = 1;
const GRID_HEIGHT = (GRID_END_MIN - GRID_START_MIN) * PX_PER_MIN; // 960

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatWeekLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  return `${monday.toLocaleDateString("da-DK", opts)} – ${sunday.toLocaleDateString("da-DK", opts)} ${sunday.getFullYear()}`;
}

type Shift = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  role: string | null;
  color: string;
  required_staff: number;
  is_open: boolean;
  notes: string | null;
  status: "draft" | "published" | "cancelled";
  location_id: string | null;
  template_id: string | null;
  shift_assignments?: { user_id: string; status: string; profiles?: { full_name: string | null } }[];
};

type ShiftTemplate = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  role: string | null;
  color: string;
};

type OrgMember = {
  user_id: string;
  role: string;
  full_name: string | null;
  email: string | null;
};

type VagtSettings = {
  min_rest_hours: number;
  max_weekly_hours: number;
  custom_roles: { name: string; color: string }[];
};

function useVagtSettings(orgId: string | null) {
  const [settings, setSettings] = useState<VagtSettings>({
    min_rest_hours: 11,
    max_weekly_hours: 48,
    custom_roles: [],
  });
  useEffect(() => {
    if (!orgId) return;
    (supabase as any)
      .from("vagtplan_settings")
      .select("min_rest_hours,max_weekly_hours,custom_roles")
      .eq("organization_id", orgId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setSettings({
          min_rest_hours: data.min_rest_hours ?? 11,
          max_weekly_hours: data.max_weekly_hours ?? 48,
          custom_roles: Array.isArray(data.custom_roles) ? data.custom_roles : [],
        });
      });
  }, [orgId]);
  return settings;
}

// ===== SHIFT POPOVER (compact quick-edit) =====
type PopoverPos = { x: number; y: number };

function ShiftPopover({
  orgId,
  shift,
  defaultDate,
  defaultStartTime,
  members,
  settings,
  pos,
  onClose,
  onSaved,
  onAdvanced,
}: {
  orgId: string;
  shift: Shift | null;
  defaultDate: string;
  defaultStartTime: string;
  members: OrgMember[];
  settings: VagtSettings;
  pos: PopoverPos;
  onClose: () => void;
  onSaved: () => void;
  onAdvanced: (s: Shift | null, date: string) => void;
}) {
  const isEdit = !!shift;
  const defaultEnd = (() => {
    const m = timeToMinutes(defaultStartTime) + 480;
    return minutesToTime(Math.min(m, GRID_END_MIN));
  })();

  const [date, setDate] = useState(shift?.date ?? defaultDate);
  const [startTime, setStartTime] = useState(shift?.start_time.slice(0, 5) ?? defaultStartTime);
  const [endTime, setEndTime] = useState(shift?.end_time.slice(0, 5) ?? defaultEnd);
  const [role, setRole] = useState(shift?.role ?? "");
  const [color, setColor] = useState(shift?.color ?? PRESET_COLORS[0]);
  const [assignedUser, setAssignedUser] = useState(
    shift?.shift_assignments?.find((a) => a.status !== "declined")?.user_id ?? ""
  );
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Keep popover on screen
  const style = useMemo(() => {
    const w = 288;
    const x = Math.min(pos.x, window.innerWidth - w - 16);
    const y = pos.y;
    return { position: "fixed" as const, top: y, left: Math.max(8, x), width: w, zIndex: 9999 };
  }, [pos]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    setTimeout(() => document.addEventListener("mousedown", handler), 10);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const submit = async () => {
    if (startTime >= endTime) return toast.error("Sluttid skal være efter starttid.");
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        date,
        start_time: startTime,
        end_time: endTime,
        role: role || null,
        color,
        required_staff: assignedUser ? 1 : 1,
        is_open: !assignedUser,
        status: "draft" as const,
        notes: null,
        template_id: null,
      };

      let shiftId = shift?.id;
      if (isEdit && shiftId) {
        const { error } = await (supabase as any).from("shifts").update(payload).eq("id", shiftId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("shifts").insert(payload).select("id").single();
        if (error) throw error;
        shiftId = data.id;
      }

      if (shiftId && assignedUser) {
        const existingUser = shift?.shift_assignments?.find((a) => a.status !== "declined")?.user_id;
        if (assignedUser !== existingUser) {
          if (existingUser) {
            await (supabase as any).from("shift_assignments").delete()
              .eq("shift_id", shiftId).eq("user_id", existingUser);
          }
          const { error: aErr } = await (supabase as any).from("shift_assignments").insert({
            shift_id: shiftId,
            user_id: assignedUser,
            organization_id: orgId,
            status: "assigned",
          });
          if (aErr) throw aErr;
        }
      }

      toast.success(isEdit ? "Vagt opdateret." : "Vagt oprettet.");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke gemme vagten.");
    } finally {
      setSaving(false);
    }
  };

  const deleteShift = async () => {
    if (!shift || !confirm("Slet denne vagt?")) return;
    const { error } = await (supabase as any).from("shifts").delete().eq("id", shift.id);
    if (error) return toast.error(error.message);
    toast.success("Vagt slettet.");
    onSaved();
    onClose();
  };

  const displayName = (m: OrgMember) => m.full_name ?? m.email ?? m.user_id.slice(0, 8);

  return (
    <div
      ref={ref}
      style={style}
      className="glass rounded-2xl shadow-card border border-border p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{isEdit ? "Rediger vagt" : "Ny vagt"}</span>
        <button onClick={onClose} className="rounded-lg p-0.5 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Date */}
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-sm font-mono focus:border-ring focus:outline-none"
      />

      {/* Start + End */}
      <div className="flex gap-2">
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="flex-1 rounded-xl border border-input bg-background px-3 py-1.5 text-sm font-mono focus:border-ring focus:outline-none"
        />
        <span className="self-center text-muted-foreground">–</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="flex-1 rounded-xl border border-input bg-background px-3 py-1.5 text-sm font-mono focus:border-ring focus:outline-none"
        />
      </div>

      {/* Role */}
      <input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Rolle (valgfri)"
        list="popover-roles"
        className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none"
      />
      <datalist id="popover-roles">
        {settings.custom_roles.map((r) => <option key={r.name} value={r.name} />)}
      </datalist>

      {/* Color swatches */}
      <div className="flex gap-1.5">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            className={`h-6 w-6 rounded-full border-2 transition ${color === c ? "border-foreground scale-110" : "border-transparent"}`}
            style={{ backgroundColor: c }}
          />
        ))}
        {settings.custom_roles.filter((r) => r.color && !PRESET_COLORS.includes(r.color)).slice(0, 2).map((r) => (
          <button
            key={r.color}
            type="button"
            onClick={() => setColor(r.color)}
            className={`h-6 w-6 rounded-full border-2 transition ${color === r.color ? "border-foreground scale-110" : "border-transparent"}`}
            style={{ backgroundColor: r.color }}
            title={r.name}
          />
        ))}
      </div>

      {/* Assign staff (single) */}
      <select
        value={assignedUser}
        onChange={(e) => setAssignedUser(e.target.value)}
        className="w-full rounded-xl border border-input bg-background px-3 py-1.5 text-sm focus:border-ring focus:outline-none"
      >
        <option value="">— Åben vagt —</option>
        {members.map((m) => (
          <option key={m.user_id} value={m.user_id}>{displayName(m)}</option>
        ))}
      </select>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        {isEdit && (
          <button
            type="button"
            onClick={deleteShift}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-destructive/40 text-destructive hover:bg-destructive/5"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onAdvanced(shift, date)}
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
        >
          Avanceret
        </button>
        <div className="flex gap-1.5 ml-auto">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-border px-3 py-1.5 text-xs">
            Annuller
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="rounded-xl bg-gradient-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saving ? "…" : "Gem"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== TIME GRID (weekly time-based calendar) =====
function TimeGridView({
  weekDates,
  shifts,
  loading,
  erAdmin,
  today,
  onSlotClick,
  onShiftClick,
  onDayClick,
}: {
  weekDates: Date[];
  shifts: Shift[];
  loading: boolean;
  erAdmin: boolean;
  today: string;
  onSlotClick: (date: string, startTime: string, pos: PopoverPos) => void;
  onShiftClick: (shift: Shift, pos: PopoverPos) => void;
  onDayClick: (date: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [nowTop, setNowTop] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      if (mins >= GRID_START_MIN && mins <= GRID_END_MIN) {
        setNowTop((mins - GRID_START_MIN) * PX_PER_MIN);
      } else {
        setNowTop(null);
      }
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    for (let m = GRID_START_MIN; m <= GRID_END_MIN; m += 60) {
      labels.push(minutesToTime(m));
    }
    return labels;
  }, []);

  const shiftsForDate = (dateStr: string) => shifts.filter((s) => s.date === dateStr);

  const handleColumnClick = (e: React.MouseEvent, dateStr: string) => {
    if (!erAdmin) return;
    const col = e.currentTarget as HTMLElement;
    const rect = col.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const clickedMin = Math.round(relativeY / PX_PER_MIN / 30) * 30 + GRID_START_MIN;
    const snapped = Math.max(GRID_START_MIN, Math.min(GRID_END_MIN - 30, clickedMin));
    onSlotClick(dateStr, minutesToTime(snapped), { x: e.clientX, y: e.clientY - 20 });
  };

  return (
    <div className="glass rounded-2xl overflow-hidden">
      {/* Day headers */}
      <div className="grid border-b border-border bg-muted/20" style={{ gridTemplateColumns: "48px repeat(7, 1fr)" }}>
        <div className="py-2" />
        {weekDates.map((d, i) => {
          const dateStr = toISODate(d);
          const isToday = dateStr === today;
          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(dateStr)}
              className={`py-2 text-center text-xs font-medium hover:bg-muted/40 transition ${isToday ? "text-primary" : "text-muted-foreground"}`}
            >
              <div className="uppercase tracking-wide">{DAY_SHORT[i]}</div>
              <div className={`mt-0.5 mx-auto flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
                isToday ? "bg-primary text-primary-foreground" : ""
              }`}>
                {d.getDate()}
              </div>
            </button>
          );
        })}
      </div>

      {/* Scrollable grid body */}
      <div className="overflow-y-auto" style={{ maxHeight: "70vh" }} ref={containerRef}>
        <div className="relative" style={{ display: "grid", gridTemplateColumns: "48px repeat(7, 1fr)" }}>
          {/* Time axis */}
          <div className="relative" style={{ height: GRID_HEIGHT }}>
            {timeLabels.map((label, i) => (
              <div
                key={label}
                className="absolute right-2 text-[10px] text-muted-foreground"
                style={{ top: i * 60 * PX_PER_MIN - 7, lineHeight: 1 }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((d, colIdx) => {
            const dateStr = toISODate(d);
            const isToday = dateStr === today;
            const dayShifts = shiftsForDate(dateStr);

            return (
              <div
                key={dateStr}
                className={`relative border-l border-border cursor-default ${isToday ? "bg-primary/3" : ""} ${erAdmin ? "cursor-pointer" : ""}`}
                style={{ height: GRID_HEIGHT }}
                onClick={(e) => handleColumnClick(e, dateStr)}
              >
                {/* Hour lines */}
                {timeLabels.map((_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-border/30"
                    style={{ top: i * 60 * PX_PER_MIN }}
                  />
                ))}
                {/* Half-hour lines */}
                {timeLabels.slice(0, -1).map((_, i) => (
                  <div
                    key={`h${i}`}
                    className="absolute left-0 right-0 border-t border-border/15"
                    style={{ top: i * 60 * PX_PER_MIN + 30 * PX_PER_MIN }}
                  />
                ))}

                {/* Current time indicator */}
                {isToday && nowTop !== null && (
                  <div
                    className="absolute left-0 right-0 z-10 flex items-center"
                    style={{ top: nowTop }}
                  >
                    <div className="h-2 w-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                    <div className="flex-1 border-t-2 border-red-500" />
                  </div>
                )}

                {/* Shift cards */}
                {!loading && dayShifts.map((s) => {
                  const startMin = timeToMinutes(s.start_time);
                  const endMin = timeToMinutes(s.end_time);
                  const top = Math.max(0, (startMin - GRID_START_MIN) * PX_PER_MIN);
                  const height = Math.max(20, (endMin - startMin) * PX_PER_MIN);
                  const assigned = (s.shift_assignments ?? []).filter((a) => a.status !== "declined");
                  const isFull = assigned.length >= s.required_staff;
                  const isDraft = s.status === "draft";
                  const isCancelled = s.status === "cancelled";

                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={(e) => {
                        if (!erAdmin) return;
                        e.stopPropagation();
                        onShiftClick(s, { x: e.clientX, y: e.clientY - 20 });
                      }}
                      className={`absolute inset-x-0.5 rounded-lg px-1.5 py-0.5 text-left transition hover:opacity-80 ${
                        isCancelled ? "opacity-40" : ""
                      }`}
                      style={{
                        top,
                        height: Math.min(height, GRID_HEIGHT - top),
                        backgroundColor: `${s.color}22`,
                        borderLeft: `3px solid ${s.color}`,
                        borderStyle: isDraft ? "dashed" : "solid",
                        borderTop: `1px ${isDraft ? "dashed" : "solid"} ${s.color}44`,
                        borderRight: `1px ${isDraft ? "dashed" : "solid"} ${s.color}44`,
                        borderBottom: `1px ${isDraft ? "dashed" : "solid"} ${s.color}44`,
                      }}
                    >
                      <div
                        className="text-[10px] font-semibold leading-tight truncate"
                        style={{ color: s.color }}
                      >
                        {s.start_time.slice(0, 5)}
                        {height > 30 && `–${s.end_time.slice(0, 5)}`}
                      </div>
                      {height > 40 && s.role && (
                        <div className="text-[9px] truncate" style={{ color: s.color, opacity: 0.8 }}>
                          {s.role}
                        </div>
                      )}
                      {height > 52 && assigned.length > 0 && (
                        <div className="text-[9px] truncate text-foreground/70">
                          {assigned[0].profiles?.full_name ?? "?"}
                          {assigned.length > 1 && ` +${assigned.length - 1}`}
                        </div>
                      )}
                      {height > 64 && (
                        <div className={`text-[9px] font-medium mt-0.5 ${isFull ? "text-green-600" : "text-amber-600"}`}>
                          {assigned.length}/{s.required_staff}
                        </div>
                      )}
                    </button>
                  );
                })}

                {loading && colIdx === 0 && (
                  <div className="absolute inset-x-1 top-4 h-16 rounded-lg bg-muted animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ===== DAY VIEW =====
function DayView({
  date,
  shifts,
  loading,
  erAdmin,
  onSlotClick,
  onShiftClick,
  onBack,
}: {
  date: string;
  shifts: Shift[];
  loading: boolean;
  erAdmin: boolean;
  onSlotClick: (date: string, startTime: string, pos: PopoverPos) => void;
  onShiftClick: (shift: Shift, pos: PopoverPos) => void;
  onBack: () => void;
}) {
  const [nowTop, setNowTop] = useState<number | null>(null);
  const today = toISODate(new Date());
  const isToday = date === today;

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      if (mins >= GRID_START_MIN && mins <= GRID_END_MIN) {
        setNowTop((mins - GRID_START_MIN) * PX_PER_MIN);
      }
    };
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, []);

  const timeLabels = useMemo(() => {
    const labels: string[] = [];
    for (let m = GRID_START_MIN; m <= GRID_END_MIN; m += 60) labels.push(minutesToTime(m));
    return labels;
  }, []);

  const dayShifts = shifts.filter((s) => s.date === date);
  const d = new Date(date + "T00:00:00");
  const label = d.toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" });

  const handleClick = (e: React.MouseEvent) => {
    if (!erAdmin) return;
    const col = e.currentTarget as HTMLElement;
    const rect = col.getBoundingClientRect();
    const relY = e.clientY - rect.top;
    const snappedMin = Math.round(relY / PX_PER_MIN / 30) * 30 + GRID_START_MIN;
    const clamped = Math.max(GRID_START_MIN, Math.min(GRID_END_MIN - 30, snappedMin));
    onSlotClick(date, minutesToTime(clamped), { x: e.clientX, y: e.clientY - 20 });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-sm hover:bg-muted">
          <ChevronLeft className="h-4 w-4" /> Uge
        </button>
        <h2 className="font-semibold capitalize">{label}</h2>
        {erAdmin && (
          <button
            onClick={(e) => onSlotClick(date, "08:00", { x: e.clientX, y: e.clientY })}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-gradient-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground"
          >
            <Plus className="h-4 w-4" /> Ny vagt
          </button>
        )}
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-y-auto" style={{ maxHeight: "75vh" }}>
          <div className="relative flex" style={{ height: GRID_HEIGHT }}>
            {/* Time axis */}
            <div className="relative shrink-0 w-12 border-r border-border">
              {timeLabels.map((label, i) => (
                <div key={label} className="absolute right-2 text-[10px] text-muted-foreground"
                  style={{ top: i * 60 - 7, lineHeight: 1 }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Main column */}
            <div
              className={`relative flex-1 ${erAdmin ? "cursor-pointer" : ""} ${isToday ? "bg-primary/2" : ""}`}
              onClick={handleClick}
            >
              {timeLabels.map((_, i) => (
                <div key={i} className="absolute left-0 right-0 border-t border-border/30" style={{ top: i * 60 }} />
              ))}
              {timeLabels.slice(0, -1).map((_, i) => (
                <div key={`h${i}`} className="absolute left-0 right-0 border-t border-border/15" style={{ top: i * 60 + 30 }} />
              ))}

              {isToday && nowTop !== null && (
                <div className="absolute left-0 right-0 z-10 flex items-center" style={{ top: nowTop }}>
                  <div className="h-2 w-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                  <div className="flex-1 border-t-2 border-red-500" />
                </div>
              )}

              {!loading && dayShifts.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
                  Ingen vagter
                </div>
              )}

              {!loading && dayShifts.map((s) => {
                const startMin = timeToMinutes(s.start_time);
                const endMin = timeToMinutes(s.end_time);
                const top = Math.max(0, (startMin - GRID_START_MIN) * PX_PER_MIN);
                const height = Math.max(24, (endMin - startMin) * PX_PER_MIN);
                const assigned = (s.shift_assignments ?? []).filter((a) => a.status !== "declined");
                const isDraft = s.status === "draft";

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={(e) => {
                      if (!erAdmin) return;
                      e.stopPropagation();
                      onShiftClick(s, { x: e.clientX, y: e.clientY - 20 });
                    }}
                    className="absolute inset-x-2 rounded-xl px-3 py-1.5 text-left hover:opacity-80 transition"
                    style={{
                      top,
                      height: Math.min(height, GRID_HEIGHT - top),
                      backgroundColor: `${s.color}20`,
                      border: `${isDraft ? "2px dashed" : "2px solid"} ${s.color}60`,
                    }}
                  >
                    <div className="font-semibold text-sm" style={{ color: s.color }}>
                      {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                    </div>
                    {height > 40 && s.role && (
                      <div className="text-xs mt-0.5 font-medium" style={{ color: s.color, opacity: 0.8 }}>
                        {s.role}
                      </div>
                    )}
                    {height > 60 && assigned.length > 0 && (
                      <div className="mt-1 space-y-0.5">
                        {assigned.slice(0, 3).map((a, i) => (
                          <div key={i} className="text-xs text-foreground/70 truncate">
                            {a.profiles?.full_name ?? "?"}
                          </div>
                        ))}
                      </div>
                    )}
                    {isDraft && (
                      <div className="absolute top-1 right-2 text-[9px] uppercase font-bold tracking-wide opacity-50" style={{ color: s.color }}>
                        Kladde
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== FULL MODAL (advanced editing) =====
type ShiftFormData = {
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  color: string;
  required_staff: number;
  is_open: boolean;
  notes: string;
  status: "draft" | "published" | "cancelled";
  template_id: string;
};

function StaffAssignmentPicker({
  members, assignedUsers, onToggle, requiredStaff,
}: {
  members: OrgMember[];
  assignedUsers: string[];
  onToggle: (uid: string) => void;
  requiredStaff: number;
}) {
  const [search, setSearch] = useState("");
  const filtered = members.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (m.full_name ?? "").toLowerCase().includes(q) || (m.email ?? "").toLowerCase().includes(q);
  });
  const assigned = members.filter((m) => assignedUsers.includes(m.user_id));
  const unassigned = filtered.filter((m) => !assignedUsers.includes(m.user_id));
  const displayName = (m: OrgMember) => m.full_name ?? m.email ?? m.user_id.slice(0, 8);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-muted-foreground font-medium">Tildelt personale</label>
        <span className={`text-xs font-semibold ${assignedUsers.length >= requiredStaff ? "text-success" : "text-amber-600 dark:text-amber-400"}`}>
          {assignedUsers.length} / {requiredStaff} påkrævet
        </span>
      </div>
      {assigned.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {assigned.map((m) => (
            <button key={m.user_id} type="button" onClick={() => onToggle(m.user_id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-destructive/10 hover:text-destructive transition">
              <span>{displayName(m)}</span><span className="opacity-60">×</span>
            </button>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-input overflow-hidden">
        <div className="border-b border-input px-3 py-2">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={`Søg i ${members.length} medarbejdere…`}
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground" />
        </div>
        <div className="max-h-44 overflow-y-auto">
          {unassigned.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">{search ? "Ingen match" : "Alle er allerede tildelt."}</p>
          ) : unassigned.map((m) => (
            <button key={m.user_id} type="button" onClick={() => onToggle(m.user_id)}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-primary/5 transition border-b border-border/40 last:border-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                {displayName(m).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{displayName(m)}</p>
                {m.email && m.full_name && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${m.role === "admin" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>
                {m.role === "admin" ? "Admin" : "Personale"}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShiftModal({
  orgId, shift, defaultDate, templates, members, settings, onClose, onSaved,
}: {
  orgId: string;
  shift: Shift | null;
  defaultDate: string;
  templates: ShiftTemplate[];
  members: OrgMember[];
  settings: VagtSettings;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!shift;
  const [form, setForm] = useState<ShiftFormData>(() => ({
    date: shift?.date ?? defaultDate,
    start_time: shift?.start_time.slice(0, 5) ?? "08:00",
    end_time: shift?.end_time.slice(0, 5) ?? "16:00",
    role: shift?.role ?? "",
    color: shift?.color ?? PRESET_COLORS[0],
    required_staff: shift?.required_staff ?? 1,
    is_open: shift?.is_open ?? false,
    notes: shift?.notes ?? "",
    status: shift?.status ?? "draft",
    template_id: shift?.template_id ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [assignedUsers, setAssignedUsers] = useState<string[]>(
    shift?.shift_assignments?.map((a) => a.user_id) ?? []
  );
  const [warnings, setWarnings] = useState<string[]>([]);

  const applyTemplate = (tid: string) => {
    const t = templates.find((x) => x.id === tid);
    if (!t) return;
    setForm((f) => ({ ...f, template_id: tid, start_time: t.start_time.slice(0, 5), end_time: t.end_time.slice(0, 5), role: t.role ?? f.role, color: t.color ?? f.color }));
  };

  useEffect(() => {
    const w: string[] = [];
    const [startH, startM] = form.start_time.split(":").map(Number);
    const [endH, endM] = form.end_time.split(":").map(Number);
    const mins = (endH * 60 + endM) - (startH * 60 + startM);
    if (mins > 0 && mins / 60 > 12) w.push(`Vagten er på ${(mins / 60).toFixed(1)} timer — ekstra lang vagt.`);
    const dw = new Date(form.date).getDay();
    if (dw === 0 || dw === 6) w.push("Weekend-vagt — husk weekendtillæg.");
    setWarnings(w);
  }, [form.start_time, form.end_time, form.date]);

  const set = (k: keyof ShiftFormData, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.date) return toast.error("Dato er påkrævet.");
    if (form.start_time >= form.end_time) return toast.error("Sluttid skal være efter starttid.");
    setSaving(true);
    try {
      const payload = {
        organization_id: orgId,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        role: form.role || null,
        color: form.color,
        required_staff: form.required_staff,
        is_open: form.is_open,
        notes: form.notes || null,
        status: form.status,
        template_id: form.template_id || null,
      };
      let shiftId = shift?.id;
      if (isEdit && shiftId) {
        const { error } = await (supabase as any).from("shifts").update(payload).eq("id", shiftId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("shifts").insert(payload).select("id").single();
        if (error) throw error;
        shiftId = data.id;
      }
      if (shiftId) {
        const existing = shift?.shift_assignments?.map((a) => a.user_id) ?? [];
        const toAdd = assignedUsers.filter((u) => !existing.includes(u));
        const toRemove = existing.filter((u) => !assignedUsers.includes(u));
        if (toAdd.length > 0) {
          const { error: addErr } = await (supabase as any).from("shift_assignments").insert(
            toAdd.map((u) => ({ shift_id: shiftId, user_id: u, organization_id: orgId, status: "assigned" }))
          );
          if (addErr) throw addErr;
        }
        if (toRemove.length > 0) {
          const { error: removeErr } = await (supabase as any).from("shift_assignments").delete()
            .eq("shift_id", shiftId).in("user_id", toRemove);
          if (removeErr) throw removeErr;
        }
      }
      toast.success(isEdit ? "Vagt opdateret." : "Vagt oprettet.");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke gemme vagten.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="glass w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">{isEdit ? "Rediger vagt" : "Ny vagt"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>

        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />{w}
              </div>
            ))}
          </div>
        )}

        {templates.length > 0 && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Skabelon</label>
            <select value={form.template_id} onChange={(e) => applyTemplate(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none">
              <option value="">— Ingen skabelon —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Dato</label>
            <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono focus:border-ring focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Start</label>
            <input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono focus:border-ring focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Slut</label>
            <input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono focus:border-ring focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Rolle</label>
            <input value={form.role} onChange={(e) => set("role", e.target.value)} placeholder="Valgfri rolle" list="modal-roles"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none" />
            <datalist id="modal-roles">{settings.custom_roles.map((r) => <option key={r.name} value={r.name} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Farve</label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color} onChange={(e) => set("color", e.target.value)}
                className="h-9 w-10 cursor-pointer rounded-lg border border-input bg-background p-1" />
              <div className="flex flex-wrap gap-1">
                {PRESET_COLORS.map((c) => (
                  <button key={c} type="button" onClick={() => set("color", c)}
                    className={`h-5 w-5 rounded-full border-2 ${form.color === c ? "border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Påkrævet personale</label>
            <input type="number" min={1} max={50} value={form.required_staff} onChange={(e) => set("required_staff", Number(e.target.value))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Status</label>
            <select value={form.status} onChange={(e) => set("status", e.target.value as any)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none">
              <option value="draft">Kladde</option>
              <option value="published">Publiceret</option>
              <option value="cancelled">Aflyst</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
          <div>
            <p className="text-sm font-medium">Åben vagt</p>
            <p className="text-xs text-muted-foreground">Synlig for alle — personale kan melde sig.</p>
          </div>
          <button type="button" role="switch" aria-checked={form.is_open} onClick={() => set("is_open", !form.is_open)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-colors ${form.is_open ? "bg-primary" : "bg-muted"}`}>
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_open ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        <div>
          <label className="block text-xs text-muted-foreground mb-1">Noter</label>
          <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Valgfrie noter…"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none resize-none" />
        </div>

        <StaffAssignmentPicker members={members} assignedUsers={assignedUsers}
          onToggle={(uid) => setAssignedUsers((p) => p.includes(uid) ? p.filter((x) => x !== uid) : [...p, uid])}
          requiredStaff={form.required_staff} />

        <div className="flex gap-2 justify-between pt-1">
          {isEdit && (
            <button type="button" onClick={async () => {
              if (!confirm("Slet denne vagt?") || !shift) return;
              await (supabase as any).from("shifts").delete().eq("id", shift.id);
              toast.success("Vagt slettet.");
              onSaved(); onClose();
            }} className="flex items-center gap-1.5 rounded-xl border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/5">
              <Trash2 className="h-3.5 w-3.5" /> Slet
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm">Annuller</button>
            <button type="button" onClick={submit} disabled={saving}
              className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {saving ? "Gemmer…" : isEdit ? "Gem" : "Opret vagt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type VagtTab = "plan" | "maaned" | "aabne" | "bytte" | "fravaer" | "timebank" | "tilgaengelighed";

type PopoverState = {
  shift: Shift | null;
  date: string;
  startTime: string;
  pos: PopoverPos;
} | null;

function VagtplanSide() {
  const { aktivOrgId, erAdmin } = useOrg();
  const settings = useVagtSettings(aktivOrgId);
  const [activeTab, setActiveTab] = useState<VagtTab>("plan");
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [popover, setPopover] = useState<PopoverState>(null);
  const [modalShift, setModalShift] = useState<Shift | null | undefined>(undefined);
  const [modalDate, setModalDate] = useState<string>("");
  const [dayView, setDayView] = useState<string | null>(null);

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 6);
  const today = toISODate(new Date());

  const loadShifts = useCallback(async () => {
    if (!aktivOrgId) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("shifts")
      .select("*,shift_assignments(user_id,status,profiles(full_name))")
      .eq("organization_id", aktivOrgId)
      .gte("date", toISODate(weekStart))
      .lte("date", toISODate(weekEnd))
      .order("start_time");
    if (error) toast.error("Kunne ikke hente vagter.");
    setShifts(data ?? []);
    setLoading(false);
  }, [aktivOrgId, weekStart]);

  useEffect(() => {
    if (!aktivOrgId) return;
    (supabase as any).from("shift_templates").select("id,name,start_time,end_time,role,color")
      .eq("organization_id", aktivOrgId).then(({ data }: any) => setTemplates(data ?? []));

    supabase.from("organization_members").select("user_id,role")
      .eq("organization_id", aktivOrgId).eq("status", "active")
      .then(async ({ data: mems }) => {
        if (!mems || mems.length === 0) { setMembers([]); return; }
        const ids = mems.map((m: any) => m.user_id);
        const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
        const pm: Record<string, any> = {};
        for (const p of profs ?? []) pm[p.id] = p;
        setMembers(mems.map((m: any) => ({
          user_id: m.user_id, role: m.role,
          full_name: pm[m.user_id]?.full_name ?? null,
          email: pm[m.user_id]?.email ?? null,
        })));
      });
  }, [aktivOrgId]);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  useEffect(() => {
    if (!aktivOrgId) return;
    const ch = supabase.channel(`vagtplan-shifts-${aktivOrgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `organization_id=eq.${aktivOrgId}` }, () => loadShifts())
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_assignments", filter: `organization_id=eq.${aktivOrgId}` }, () => loadShifts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [aktivOrgId, loadShifts]);

  const draftCount = shifts.filter((s) => s.status === "draft").length;

  const publishAll = async () => {
    if (!aktivOrgId) return;
    const draftIds = shifts.filter((s) => s.status === "draft").map((s) => s.id);
    if (draftIds.length === 0) { toast.info("Ingen kladder at publicere."); return; }
    if (!confirm(`Publicer ${draftIds.length} kladdevagter for denne uge?`)) return;
    const { error } = await (supabase as any).from("shifts").update({ status: "published" }).in("id", draftIds);
    if (error) return toast.error(error.message);
    trackEvent("vagtplan_published", { shift_count: draftIds.length });
    toast.success(`${draftIds.length} vagter publiceret.`);
    loadShifts();
  };

  const vagtTabs: { id: VagtTab; label: string; icon: any }[] = [
    { id: "plan", label: "Uge", icon: LayoutGrid },
    { id: "maaned", label: "Måned", icon: Calendar },
    { id: "aabne", label: "Åbne vagter", icon: Users },
    { id: "bytte", label: "Vagtbytte", icon: ArrowLeftRight },
    { id: "fravaer", label: "Fravær", icon: UserX },
    { id: "timebank", label: "Timebank", icon: ClockIcon },
    { id: "tilgaengelighed", label: "Tilgængelighed", icon: CalendarDays },
  ];

  const openPopover = (shift: Shift | null, date: string, startTime: string, pos: PopoverPos) => {
    setPopover({ shift, date, startTime, pos });
  };

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-bold">Vagtplan</h1>

      <div className="glass flex flex-wrap gap-1 rounded-2xl p-1.5">
        {vagtTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setDayView(null); }}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                activeTab === t.id ? "bg-gradient-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="h-4 w-4" />{t.label}
            </button>
          );
        })}
      </div>

      {/* Non-plan tabs */}
      {aktivOrgId && activeTab === "maaned" && (
        <MonthViewTab orgId={aktivOrgId} erAdmin={erAdmin} templates={templates} members={members} settings={settings}
          onEditShift={(s) => openPopover(s, s.date, s.start_time.slice(0, 5), { x: window.innerWidth / 2, y: 200 })}
          onCreateShift={(date) => openPopover(null, date, "08:00", { x: window.innerWidth / 2, y: 200 })} />
      )}
      {aktivOrgId && activeTab === "aabne" && <AabneVagterTab orgId={aktivOrgId} />}
      {aktivOrgId && activeTab === "bytte" && <VagtbytteTab orgId={aktivOrgId} erAdmin={erAdmin} />}
      {aktivOrgId && activeTab === "fravaer" && <FravaerTab orgId={aktivOrgId} erAdmin={erAdmin} />}
      {aktivOrgId && activeTab === "timebank" && <TimebankTab orgId={aktivOrgId} erAdmin={erAdmin} />}
      {aktivOrgId && activeTab === "tilgaengelighed" && <TilgængelighedException orgId={aktivOrgId} />}

      {/* Plan tab */}
      {activeTab === "plan" && (
        <>
          {/* Header controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {dayView ? (
              <p className="text-sm text-muted-foreground">
                {new Date(dayView + "T00:00:00").toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{formatWeekLabel(weekStart)}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {erAdmin && draftCount > 0 && !dayView && (
                <button onClick={publishAll}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
                  <Send className="h-4 w-4" /> Publicer uge ({draftCount})
                </button>
              )}
              {!dayView && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setWeekStart((d) => addDays(d, -7))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => setWeekStart(getWeekStart(new Date()))}
                    className="rounded-xl border border-border px-3 py-1.5 text-sm hover:bg-muted">
                    I dag
                  </button>
                  <button onClick={() => setWeekStart((d) => addDays(d, 7))}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Legend */}
          {!dayView && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-5 rounded border-2 border-dashed border-muted-foreground/50" />Kladde
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-5 rounded border-2 border-solid border-success/60 bg-success/10" />Publiceret
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="h-3 w-3" />Klik dag for dagsoversigt
              </span>
            </div>
          )}

          {dayView ? (
            <DayView
              date={dayView}
              shifts={shifts.filter((s) => s.date === dayView)}
              loading={loading}
              erAdmin={erAdmin}
              onSlotClick={(date, startTime, pos) => openPopover(null, date, startTime, pos)}
              onShiftClick={(shift, pos) => openPopover(shift, shift.date, shift.start_time.slice(0, 5), pos)}
              onBack={() => setDayView(null)}
            />
          ) : (
            <TimeGridView
              weekDates={weekDates}
              shifts={shifts}
              loading={loading}
              erAdmin={erAdmin}
              today={today}
              onSlotClick={(date, startTime, pos) => openPopover(null, date, startTime, pos)}
              onShiftClick={(shift, pos) => openPopover(shift, shift.date, shift.start_time.slice(0, 5), pos)}
              onDayClick={(date) => setDayView(date)}
            />
          )}

          {!erAdmin && aktivOrgId && (
            <StaffWeekSummary orgId={aktivOrgId} weekDates={weekDates} />
          )}
        </>
      )}

      {/* Compact popover */}
      {popover !== null && aktivOrgId && (
        <ShiftPopover
          orgId={aktivOrgId}
          shift={popover.shift}
          defaultDate={popover.date}
          defaultStartTime={popover.startTime}
          members={members}
          settings={settings}
          pos={popover.pos}
          onClose={() => setPopover(null)}
          onSaved={loadShifts}
          onAdvanced={(s, date) => {
            setPopover(null);
            setModalDate(date);
            setModalShift(s ?? null);
          }}
        />
      )}

      {/* Full modal (advanced) */}
      {modalShift !== undefined && aktivOrgId && (
        <ShiftModal
          orgId={aktivOrgId}
          shift={modalShift}
          defaultDate={modalDate || toISODate(weekStart)}
          templates={templates}
          members={members}
          settings={settings}
          onClose={() => setModalShift(undefined)}
          onSaved={loadShifts}
        />
      )}
    </div>
  );
}

// ===== STAFF WEEK SUMMARY =====
function StaffWeekSummary({ orgId, weekDates }: { orgId: string; weekDates: Date[] }) {
  const [myShifts, setMyShifts] = useState<Shift[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any)
        .from("shifts")
        .select("*,shift_assignments!inner(user_id,status)")
        .eq("organization_id", orgId)
        .eq("shift_assignments.user_id", user.id)
        .gte("date", toISODate(weekDates[0]))
        .lte("date", toISODate(weekDates[6]))
        .order("date").order("start_time");
      setMyShifts(data ?? []);
    };
    load();
  }, [orgId, weekDates]);

  const totalMinutes = myShifts.reduce((sum, s) => {
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    return sum + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);

  if (myShifts.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm">Mine vagter denne uge</h2>
        <span className="text-xs text-muted-foreground">{(totalMinutes / 60).toFixed(1)} timer i alt</span>
      </div>
      <div className="space-y-2">
        {myShifts.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
            <div className="h-7 w-1 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {new Date(s.date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "short" })}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}{s.role ? ` · ${s.role}` : ""}
              </p>
            </div>
            {s.status === "cancelled" && (
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-medium text-destructive">Aflyst</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== ÅBNE VAGTER =====
function AabneVagterTab({ orgId }: { orgId: string }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    const today = toISODate(new Date());
    const { data } = await (supabase as any).from("shifts").select("*,shift_assignments(user_id,status)")
      .eq("organization_id", orgId).eq("is_open", true).eq("status", "published").gte("date", today)
      .order("date").order("start_time");
    setShifts(data ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const ch = supabase.channel(`open-shifts-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `organization_id=eq.${orgId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_assignments", filter: `organization_id=eq.${orgId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, load]);

  const claim = async (shiftId: string) => {
    setClaiming(shiftId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await (supabase as any).from("shift_assignments").insert({ shift_id: shiftId, user_id: user.id, organization_id: orgId, status: "assigned" });
      if (error) throw error;
      toast.success("Du er nu tilmeldt vagten.");
      load();
    } catch (e: any) {
      toast.error(e?.message?.includes("duplicate") ? "Du er allerede tilmeldt denne vagt." : "Kunne ikke melde sig til vagten.");
    } finally {
      setClaiming(null);
    }
  };

  if (loading) return <div className="text-sm text-muted-foreground">Indlæser…</div>;
  if (shifts.length === 0) return <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Ingen åbne vagter tilgængelige i øjeblikket.</div>;

  return (
    <div className="space-y-3">
      <div><h2 className="font-semibold">Åbne vagter</h2><p className="text-xs text-muted-foreground">Meld dig til en vagt herunder.</p></div>
      {shifts.map((s) => {
        const claimed = s.shift_assignments?.length ?? 0;
        const full = claimed >= s.required_staff;
        return (
          <div key={s.id} className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="h-12 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{new Date(s.date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}</p>
              <p className="text-xs text-muted-foreground">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}{s.role ? ` · ${s.role}` : ""}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{claimed} / {s.required_staff} tilmeldte</p>
            </div>
            <button onClick={() => claim(s.id)} disabled={full || claiming === s.id}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${full ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-gradient-primary text-primary-foreground shadow-glow"}`}>
              {full ? "Besat" : claiming === s.id ? "Tilmelder…" : "Meld dig til"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ===== VAGTBYTTE =====
type ShiftSwap = {
  id: string; shift_id: string; requested_by: string; requested_to: string | null;
  status: string; notes: string | null; created_at: string;
  shifts?: { date: string; start_time: string; end_time: string; role: string | null };
};

function VagtbytteTab({ orgId, erAdmin }: { orgId: string; erAdmin: boolean }) {
  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [myAssignments, setMyAssignments] = useState<any[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedShift, setSelectedShift] = useState("");
  const [selectedTo, setSelectedTo] = useState("");
  const [notes, setNotes] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null)); }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    const q = (supabase as any).from("shift_swaps").select("*,shifts(date,start_time,end_time,role)").eq("organization_id", orgId).order("created_at", { ascending: false });
    const { data } = erAdmin ? await q : await q.or(`requested_by.eq.${userId},requested_to.eq.${userId}`);
    setSwaps(data ?? []);
    const today = toISODate(new Date());
    const { data: asgn } = await (supabase as any).from("shift_assignments").select("shift_id,shifts(id,date,start_time,end_time,role)")
      .eq("user_id", userId).eq("organization_id", orgId).gte("shifts.date", today).not("shifts", "is", null);
    setMyAssignments(asgn ?? []);
    const { data: mem } = await (supabase as any).from("organization_members").select("user_id,role").eq("organization_id", orgId).eq("status", "active").neq("user_id", userId ?? "");
    if (mem && mem.length > 0) {
      const ids = mem.map((m: any) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      const pm: Record<string, any> = {};
      for (const p of profs ?? []) pm[p.id] = p;
      setMembers(mem.map((m: any) => ({ ...m, full_name: pm[m.user_id]?.full_name ?? null, email: pm[m.user_id]?.email ?? null })));
    } else { setMembers([]); }
    setLoading(false);
  }, [orgId, userId, erAdmin]);

  useEffect(() => { if (userId) load(); }, [load, userId]);
  useEffect(() => {
    const ch = supabase.channel(`swaps-${orgId}`).on("postgres_changes", { event: "*", schema: "public", table: "shift_swaps", filter: `organization_id=eq.${orgId}` }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, load]);

  const createSwap = async () => {
    if (!selectedShift || !userId) return;
    const { error } = await (supabase as any).from("shift_swaps").insert({ organization_id: orgId, shift_id: selectedShift, requested_by: userId, requested_to: selectedTo || null, notes: notes.trim() || null, status: "pending" });
    if (error) return toast.error(error.message);
    toast.success("Bytteforespørgsel sendt.");
    setShowForm(false); setSelectedShift(""); setSelectedTo(""); setNotes("");
    load();
  };

  const respond = async (id: string, accept: boolean) => {
    const { error } = await (supabase as any).from("shift_swaps").update({ status: accept ? "accepted" : "declined" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(accept ? "Bytteforespørgsel accepteret." : "Bytteforespørgsel afvist.");
    load();
  };

  const adminApprove = async (id: string, approve: boolean) => {
    const { error } = await (supabase as any).from("shift_swaps").update({ status: approve ? "approved" : "rejected", manager_approved_by: userId }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Bytte godkendt." : "Bytte afvist.");
    load();
  };

  const statusLabel = (s: string) => ({ pending: "Afventer", accepted: "Accepteret", declined: "Afvist", approved: "Godkendt", rejected: "Afvist af manager" }[s] ?? s);
  const statusColor = (s: string) => s === "approved" ? "bg-success/10 text-success" : s === "rejected" || s === "declined" ? "bg-destructive/10 text-destructive" : s === "accepted" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="font-semibold">Vagtbytte</h2><p className="text-xs text-muted-foreground">Anmod om at bytte en vagt med en kollega.</p></div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> Anmod om bytte
        </button>
      </div>

      {showForm && (
        <div className="glass rounded-2xl p-5 space-y-4">
          <h3 className="font-medium">Ny bytteforespørgsel</h3>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Vagt der ønskes byttet</label>
            <select value={selectedShift} onChange={(e) => setSelectedShift(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none">
              <option value="">— Vælg vagt —</option>
              {myAssignments.map((a: any) => a.shifts && (
                <option key={a.shift_id} value={a.shift_id}>
                  {new Date(a.shifts.date).toLocaleDateString("da-DK")} {a.shifts.start_time?.slice(0, 5)}–{a.shifts.end_time?.slice(0, 5)}{a.shifts.role ? ` · ${a.shifts.role}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Send til (valgfri)</label>
            <select value={selectedTo} onChange={(e) => setSelectedTo(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none">
              <option value="">— Åben bytteforespørgsel —</option>
              {members.map((m) => <option key={m.user_id} value={m.user_id}>{(m as any).full_name ?? (m as any).email ?? m.user_id.slice(0, 8)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Note</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Valgfri besked…" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Annuller</button>
            <button onClick={createSwap} disabled={!selectedShift} className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Send forespørgsel</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-sm text-muted-foreground">Indlæser…</div>
      : swaps.length === 0 ? <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Ingen bytteforespørgsler endnu.</div>
      : (
        <div className="space-y-2">
          {swaps.map((sw) => (
            <div key={sw.id} className="glass rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {sw.shifts && (
                    <p className="text-sm font-medium">
                      {new Date(sw.shifts.date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "short" })}
                      {" "}{sw.shifts.start_time?.slice(0, 5)}–{sw.shifts.end_time?.slice(0, 5)}{sw.shifts.role ? ` · ${sw.shifts.role}` : ""}
                    </p>
                  )}
                  {sw.notes && <p className="text-xs text-muted-foreground mt-0.5">{sw.notes}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColor(sw.status)}`}>{statusLabel(sw.status)}</span>
              </div>
              {sw.status === "pending" && sw.requested_to === userId && (
                <div className="flex gap-2">
                  <button onClick={() => respond(sw.id, true)} className="rounded-xl bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">Acceptér</button>
                  <button onClick={() => respond(sw.id, false)} className="rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">Afvis</button>
                </div>
              )}
              {erAdmin && sw.status === "accepted" && (
                <div className="flex gap-2">
                  <button onClick={() => adminApprove(sw.id, true)} className="rounded-xl bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">Godkend</button>
                  <button onClick={() => adminApprove(sw.id, false)} className="rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">Afvis</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== FRAVÆR =====
type AbsenceRequest = {
  id: string; user_id: string; date: string; reason: string | null;
  notes: string | null; status: string; created_at: string;
  profiles?: { full_name: string | null };
};
const ABSENCE_REASONS = [
  { value: "sygdom", label: "Sygdom" }, { value: "ferie", label: "Ferie" },
  { value: "fridag", label: "Fridag" }, { value: "andet", label: "Andet" },
];

function FravaerTab({ orgId, erAdmin }: { orgId: string; erAdmin: boolean }) {
  const [requests, setRequests] = useState<AbsenceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(toISODate(new Date()));
  const [reason, setReason] = useState("sygdom");
  const [notesVal, setNotesVal] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null)); }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    const q = (supabase as any).from("absence_requests").select("*,profiles(full_name)").eq("organization_id", orgId).order("date", { ascending: false });
    const { data } = erAdmin ? await q : await q.eq("user_id", userId);
    setRequests(data ?? []);
    setLoading(false);
  }, [orgId, userId, erAdmin]);

  useEffect(() => { if (userId) load(); }, [load, userId]);
  useEffect(() => {
    const ch = supabase.channel(`absences-${orgId}`).on("postgres_changes", { event: "*", schema: "public", table: "absence_requests", filter: `organization_id=eq.${orgId}` }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, load]);

  const submit = async () => {
    if (!userId) return;
    const { error } = await (supabase as any).from("absence_requests").insert({ organization_id: orgId, user_id: userId, date, reason, notes: notesVal.trim() || null, status: "pending" });
    if (error) return toast.error(error.message);
    toast.success("Fraværsanmodning sendt.");
    setShowForm(false); setNotesVal("");
    load();
  };

  const review = async (id: string, approve: boolean) => {
    const { error } = await (supabase as any).from("absence_requests").update({ status: approve ? "approved" : "rejected", reviewed_by: userId }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Fravær godkendt." : "Fravær afvist.");
    load();
  };

  const statusColor = (s: string) => s === "approved" ? "bg-success/10 text-success" : s === "rejected" ? "bg-destructive/10 text-destructive" : "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  const statusLabel = (s: string) => ({ pending: "Afventer", approved: "Godkendt", rejected: "Afvist" }[s] ?? s);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="font-semibold">Fraværsanmodninger</h2><p className="text-xs text-muted-foreground">{erAdmin ? "Administrer personalets fraværsanmodninger." : "Anmod om fravær eller sygdom."}</p></div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
          <Plus className="h-4 w-4" /> Anmod om fravær
        </button>
      </div>

      {showForm && (
        <div className="glass rounded-2xl p-5 space-y-4">
          <h3 className="font-medium">Ny fraværsanmodning</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Dato</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono focus:border-ring focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Årsag</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none">
                {ABSENCE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Note</label>
            <textarea value={notesVal} onChange={(e) => setNotesVal(e.target.value)} rows={2} placeholder="Valgfri bemærkning…" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Annuller</button>
            <button onClick={submit} className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Send</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-sm text-muted-foreground">Indlæser…</div>
      : requests.length === 0 ? <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Ingen fraværsanmodninger endnu.</div>
      : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {erAdmin && r.profiles?.full_name && <p className="text-xs font-medium text-primary mb-0.5">{r.profiles.full_name}</p>}
                <p className="text-sm font-medium">{new Date(r.date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}</p>
                <p className="text-xs text-muted-foreground">{ABSENCE_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason}{r.notes ? ` · ${r.notes}` : ""}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColor(r.status)}`}>{statusLabel(r.status)}</span>
              {erAdmin && r.status === "pending" && (
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => review(r.id, true)} className="rounded-lg bg-success/10 px-2 py-1 text-xs font-semibold text-success">OK</button>
                  <button onClick={() => review(r.id, false)} className="rounded-lg bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">Nej</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== TIMEBANK =====
type TimeBankEntry = {
  id: string; user_id: string; hours: number; reason: string | null;
  type: string; created_at: string; profiles?: { full_name: string | null };
};

function TimebankTab({ orgId, erAdmin }: { orgId: string; erAdmin: boolean }) {
  const [entries, setEntries] = useState<TimeBankEntry[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [hours, setHours] = useState("");
  const [type, setType] = useState("overtime");
  const [reasonVal, setReasonVal] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null)); }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    const q = (supabase as any).from("time_bank").select("*,profiles(full_name)").eq("organization_id", orgId).order("created_at", { ascending: false });
    const { data } = erAdmin ? await q : await q.eq("user_id", userId);
    setEntries(data ?? []);
    const myBal = (data ?? []).filter((e: TimeBankEntry) => e.user_id === userId).reduce((sum: number, e: TimeBankEntry) => sum + (e.type === "time_off" ? -e.hours : e.hours), 0);
    setBalance(myBal);
    setLoading(false);
  }, [orgId, userId, erAdmin]);

  useEffect(() => { if (userId) load(); }, [load, userId]);
  useEffect(() => {
    const ch = supabase.channel(`timebank-${orgId}`).on("postgres_changes", { event: "*", schema: "public", table: "time_bank", filter: `organization_id=eq.${orgId}` }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, load]);

  const addEntry = async () => {
    if (!hours || !userId || !erAdmin) return;
    const { error } = await (supabase as any).from("time_bank").insert({ organization_id: orgId, user_id: userId, hours: parseFloat(hours), type, reason: reasonVal.trim() || null, created_by: userId });
    if (error) return toast.error(error.message);
    toast.success("Timebank opdateret.");
    setShowForm(false); setHours(""); setReasonVal("");
    load();
  };

  const typeLabel = (t: string) => ({ overtime: "Overarbejde", time_off: "Afspadsering", adjustment: "Justering" }[t] ?? t);
  const typeColor = (t: string) => t === "overtime" ? "text-primary" : t === "time_off" ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h2 className="font-semibold">Timebank</h2><p className="text-xs text-muted-foreground">Overarbejde og afspadseringsbalance.</p></div>
        {erAdmin && (
          <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
            <Plus className="h-4 w-4" /> Tilføj post
          </button>
        )}
      </div>

      <div className={`glass rounded-2xl p-4 flex items-center gap-4 ${balance >= 0 ? "border-success/20" : "border-amber-500/20"} border`}>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${balance >= 0 ? "bg-success/10" : "bg-amber-500/10"}`}>
          <ClockIcon className={`h-6 w-6 ${balance >= 0 ? "text-success" : "text-amber-500"}`} />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Din saldo</p>
          <p className="text-2xl font-bold">{balance >= 0 ? "+" : ""}{balance.toFixed(1)} timer</p>
        </div>
      </div>

      {showForm && erAdmin && (
        <div className="glass rounded-2xl p-5 space-y-3">
          <h3 className="font-medium">Ny post</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Timer</label>
              <input type="number" step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0.0" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none">
                <option value="overtime">Overarbejde</option>
                <option value="time_off">Afspadsering</option>
                <option value="adjustment">Justering</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Årsag</label>
            <input value={reasonVal} onChange={(e) => setReasonVal(e.target.value)} placeholder="Valgfri…" className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Annuller</button>
            <button onClick={addEntry} disabled={!hours} className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">Tilføj</button>
          </div>
        </div>
      )}

      {loading ? <div className="text-sm text-muted-foreground">Indlæser…</div>
      : entries.length === 0 ? <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Ingen poster endnu.</div>
      : (
        <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3">
              {erAdmin && e.profiles?.full_name && <p className="text-xs font-medium text-primary w-24 shrink-0 truncate">{e.profiles.full_name}</p>}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${typeColor(e.type)}`}>{typeLabel(e.type)}</p>
                {e.reason && <p className="text-xs text-muted-foreground">{e.reason}</p>}
              </div>
              <span className={`text-sm font-bold ${e.type === "time_off" ? "text-destructive" : "text-primary"}`}>{e.type === "time_off" ? "-" : "+"}{e.hours}t</span>
              <span className="text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleDateString("da-DK")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== MÅNEDSOVERSIGT =====
function MonthViewTab({
  orgId, erAdmin, onEditShift, onCreateShift,
}: {
  orgId: string; erAdmin: boolean; templates: ShiftTemplate[]; members: OrgMember[]; settings: VagtSettings;
  onEditShift: (s: Shift) => void; onCreateShift: (date: string) => void;
}) {
  const [monthDate, setMonthDate] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null)); }, []);

  const gridStart = useMemo(() => { const d = new Date(monthDate); d.setDate(1); return getWeekStart(d); }, [monthDate]);
  const gridEnd = useMemo(() => addDays(gridStart, 41), [gridStart]);
  const gridDates = useMemo(() => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)), [gridStart]);

  const loadMonthShifts = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("shifts").select("*,shift_assignments(user_id,status,profiles(full_name))").eq("organization_id", orgId).gte("date", toISODate(gridStart)).lte("date", toISODate(gridEnd)).order("start_time");
    setShifts(data ?? []);
    setLoading(false);
  }, [orgId, gridStart, gridEnd]);

  useEffect(() => { loadMonthShifts(); }, [loadMonthShifts]);
  useEffect(() => {
    const ch = supabase.channel(`month-view-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shifts", filter: `organization_id=eq.${orgId}` }, () => loadMonthShifts())
      .on("postgres_changes", { event: "*", schema: "public", table: "shift_assignments", filter: `organization_id=eq.${orgId}` }, () => loadMonthShifts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, loadMonthShifts]);

  const today = toISODate(new Date());
  const currentMonth = monthDate.getMonth();
  const shiftsForDate = (dateStr: string) => {
    const all = shifts.filter((s) => s.date === dateStr);
    if (erAdmin) return all;
    return all.filter((s) => s.shift_assignments?.some((a) => a.user_id === userId) || (s.is_open && s.status === "published"));
  };
  const rawLabel = monthDate.toLocaleDateString("da-DK", { month: "long", year: "numeric" });
  const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button onClick={() => setMonthDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; })} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setMonthDate(d); }} className="rounded-xl border border-border px-3 py-1.5 text-sm hover:bg-muted">I dag</button>
          <button onClick={() => setMonthDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; })} className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {DAY_SHORT.map((d) => <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
        </div>
        {Array.from({ length: 6 }, (_, week) => (
          <div key={week} className="grid grid-cols-7 border-b border-border last:border-0">
            {Array.from({ length: 7 }, (_, dow) => {
              const date = gridDates[week * 7 + dow];
              const dateStr = toISODate(date);
              const isToday = dateStr === today;
              const inMonth = date.getMonth() === currentMonth;
              const dayShifts = shiftsForDate(dateStr);
              return (
                <div key={dateStr} className={`relative min-h-[90px] border-r border-border last:border-r-0 p-1.5 ${!inMonth ? "bg-muted/20" : ""} ${erAdmin && inMonth ? "cursor-pointer hover:bg-primary/5 transition" : ""}`}
                  onClick={() => { if (erAdmin && inMonth) onCreateShift(dateStr); }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/40"}`}>
                      {date.getDate()}
                    </span>
                    {erAdmin && inMonth && (
                      <button onClick={(e) => { e.stopPropagation(); onCreateShift(dateStr); }} className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition">
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayShifts.slice(0, 3).map((s) => (
                      <button key={s.id} onClick={(e) => { e.stopPropagation(); onEditShift(s); }}
                        className={`w-full rounded text-left px-1.5 py-0.5 text-[10px] leading-snug truncate transition hover:opacity-75 ${s.status === "cancelled" ? "opacity-40 line-through" : ""}`}
                        style={{ backgroundColor: `${s.color}25`, borderLeft: `2px solid ${s.color}`, color: s.color }}>
                        {s.start_time.slice(0, 5)} {s.role ?? "Vagt"}
                      </button>
                    ))}
                    {dayShifts.length > 3 && <p className="text-[10px] text-muted-foreground px-1">+{dayShifts.length - 3} mere</p>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      {loading && <p className="text-center text-xs text-muted-foreground">Indlæser…</p>}
    </div>
  );
}

// ===== TILGÆNGELIGHED =====
function TilgængelighedException({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [newDay, setNewDay] = useState(0);
  const [newStart, setNewStart] = useState("08:00");
  const [newEnd, setNewEnd] = useState("16:00");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => { supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null)); }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await (supabase as any).from("staff_availability").select("*").eq("organization_id", orgId).eq("user_id", userId).order("day_of_week");
    setRows(data ?? []);
    setLoading(false);
  }, [orgId, userId]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  const save = async () => {
    if (!userId) return;
    const { error } = await (supabase as any).from("staff_availability").upsert({ organization_id: orgId, user_id: userId, day_of_week: newDay, start_time: newStart, end_time: newEnd }, { onConflict: "organization_id,user_id,day_of_week" });
    if (error) return toast.error(error.message);
    toast.success("Tilgængelighed gemt.");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    await (supabase as any).from("staff_availability").delete().eq("id", id);
    toast.success("Fjernet.");
    load();
  };

  return (
    <div className="space-y-4">
      <div><h2 className="font-semibold">Min tilgængelighed</h2><p className="text-xs text-muted-foreground">Angiv hvilke dage og tidspunkter du normalt er tilgængelig. Admins bruger dette til planlægning.</p></div>
      <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
        {DAY_NAMES.map((day, idx) => {
          const existing = rows.find((r) => r.day_of_week === idx);
          const isEditing = editing === idx;
          return (
            <div key={idx} className="flex items-center gap-3 px-4 py-3">
              <span className="w-20 text-sm font-medium shrink-0">{day}</span>
              {existing && !isEditing ? (
                <>
                  <span className="flex-1 text-sm text-muted-foreground">{existing.start_time.slice(0, 5)} – {existing.end_time.slice(0, 5)}</span>
                  <button onClick={() => { setNewDay(idx); setNewStart(existing.start_time.slice(0, 5)); setNewEnd(existing.end_time.slice(0, 5)); setEditing(idx); }} className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">Rediger</button>
                  <button onClick={() => remove(existing.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </>
              ) : isEditing ? (
                <>
                  <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-sm font-mono focus:border-ring focus:outline-none" />
                  <span className="text-muted-foreground">–</span>
                  <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-sm font-mono focus:border-ring focus:outline-none" />
                  <button onClick={save} className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">Gem</button>
                  <button onClick={() => setEditing(null)} className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Annuller</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-xs text-muted-foreground">Ikke angivet</span>
                  <button onClick={() => { setNewDay(idx); setNewStart("08:00"); setNewEnd("16:00"); setEditing(idx); }} className="rounded-lg bg-muted px-2 py-1 text-xs hover:bg-muted/80">Tilføj</button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
