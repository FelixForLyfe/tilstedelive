import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Users, Lock, Send, Trash2, X, AlertTriangle, CalendarDays, ArrowLeftRight, UserX, Clock as ClockIcon, LayoutGrid, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";

export const Route = createFileRoute("/app/vagtplan")({
  component: VagtplanSide,
});

const DAY_NAMES = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"];
const DAY_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

// Returns the Monday of the week containing `date`
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
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
  return date.toISOString().slice(0, 10);
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

function ShiftCard({
  shift,
  erAdmin,
  onEdit,
}: {
  shift: Shift;
  erAdmin: boolean;
  onEdit: (s: Shift) => void;
}) {
  const assignments = shift.shift_assignments ?? [];
  const assigned = assignments.filter((a) => a.status !== "declined");
  const isFull = assigned.length >= shift.required_staff;
  const statusColor =
    shift.status === "published"
      ? isFull ? "border-success/40 bg-success/5" : "border-amber-500/40 bg-amber-500/5"
      : shift.status === "cancelled" ? "border-destructive/30 bg-destructive/5 opacity-60"
      : "border-border bg-background";

  return (
    <div
      className={`rounded-xl border px-2.5 py-2 text-xs cursor-pointer select-none ${statusColor} ${erAdmin ? "hover:opacity-80" : ""}`}
      style={{ borderLeftColor: shift.color, borderLeftWidth: 3 }}
      onClick={() => erAdmin && onEdit(shift)}
    >
      <div className="font-medium truncate">
        {shift.start_time.slice(0, 5)}–{shift.end_time.slice(0, 5)}
      </div>
      {shift.role && <div className="text-muted-foreground truncate">{shift.role}</div>}
      <div className={`flex items-center gap-1 mt-0.5 ${isFull ? "text-success" : "text-amber-600 dark:text-amber-400"}`}>
        <Users className="h-2.5 w-2.5" />
        <span>{assigned.length}/{shift.required_staff}</span>
        {shift.is_open && !isFull && <span className="text-amber-500 font-medium ml-1">Åben</span>}
      </div>
      {/* Show assigned names compactly */}
      {assigned.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {assigned.slice(0, 3).map((a, i) => (
            <div key={i} className="truncate text-[10px] text-muted-foreground">
              {a.profiles?.full_name ?? "?"}
            </div>
          ))}
          {assigned.length > 3 && (
            <div className="text-[10px] text-muted-foreground">+{assigned.length - 3} mere</div>
          )}
        </div>
      )}
    </div>
  );
}

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
  members,
  assignedUsers,
  onToggle,
  requiredStaff,
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
    return (
      (m.full_name ?? "").toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q)
    );
  });

  const assigned = members.filter((m) => assignedUsers.includes(m.user_id));
  const unassigned = filtered.filter((m) => !assignedUsers.includes(m.user_id));

  const displayName = (m: OrgMember) => m.full_name ?? m.email ?? m.user_id.slice(0, 8);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs text-muted-foreground font-medium">
          Tildelt personale
        </label>
        <span className={`text-xs font-semibold ${
          assignedUsers.length >= requiredStaff ? "text-success" : "text-amber-600 dark:text-amber-400"
        }`}>
          {assignedUsers.length} / {requiredStaff} påkrævet
        </span>
      </div>

      {/* Already assigned — shown as chips */}
      {assigned.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {assigned.map((m) => (
            <button
              key={m.user_id}
              type="button"
              onClick={() => onToggle(m.user_id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-destructive/10 hover:text-destructive transition"
              title="Klik for at fjerne"
            >
              <span>{displayName(m)}</span>
              <span className="opacity-60">×</span>
            </button>
          ))}
        </div>
      )}

      {/* Search + list of unassigned */}
      <div className="rounded-xl border border-input overflow-hidden">
        <div className="border-b border-input px-3 py-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Søg i ${members.length} medarbejdere…`}
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-44 overflow-y-auto">
          {unassigned.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {search ? "Ingen match" : "Alle medarbejdere er allerede tildelt."}
            </p>
          ) : (
            unassigned.map((m) => (
              <button
                key={m.user_id}
                type="button"
                onClick={() => onToggle(m.user_id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-primary/5 transition border-b border-border/40 last:border-0"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
                  {(displayName(m)).charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{displayName(m)}</p>
                  {m.email && m.full_name && (
                    <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  m.role === "admin" ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground"
                }`}>
                  {m.role === "admin" ? "Admin" : "Personale"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ShiftModal({
  orgId,
  shift,
  defaultDate,
  templates,
  members,
  settings,
  onClose,
  onSaved,
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
    color: shift?.color ?? "#6366f1",
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

  // Apply template when selected
  const applyTemplate = (tid: string) => {
    const t = templates.find((x) => x.id === tid);
    if (!t) return;
    setForm((f) => ({
      ...f,
      template_id: tid,
      start_time: t.start_time.slice(0, 5),
      end_time: t.end_time.slice(0, 5),
      role: t.role ?? f.role,
      color: t.color ?? f.color,
    }));
  };

  // Compliance warnings
  useEffect(() => {
    const w: string[] = [];
    const startH = parseInt(form.start_time.split(":")[0]);
    const endH = parseInt(form.end_time.split(":")[0]);
    const shiftHours = endH - startH;
    if (shiftHours > settings.max_weekly_hours) {
      w.push(`Vagten er på ${shiftHours} timer — overstiger max ${settings.max_weekly_hours} timer/uge.`);
    }
    const d = new Date(form.date).getDay();
    if (d === 0 || d === 6) {
      w.push("Weekend-vagt — husk weekendtillæg.");
    }
    setWarnings(w);
  }, [form.start_time, form.end_time, form.date, settings]);

  const toggleAssign = (userId: string) => {
    setAssignedUsers((prev) =>
      prev.includes(userId) ? prev.filter((x) => x !== userId) : [...prev, userId]
    );
  };

  const submit = async () => {
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

      // Sync assignments
      if (shiftId) {
        const existing = shift?.shift_assignments?.map((a) => a.user_id) ?? [];
        const toAdd = assignedUsers.filter((u) => !existing.includes(u));
        const toRemove = existing.filter((u) => !assignedUsers.includes(u));

        if (toAdd.length > 0) {
          await (supabase as any).from("shift_assignments").insert(
            toAdd.map((u) => ({ shift_id: shiftId, user_id: u, organization_id: orgId, status: "assigned" }))
          );
        }
        if (toRemove.length > 0) {
          await (supabase as any).from("shift_assignments")
            .delete()
            .eq("shift_id", shiftId)
            .in("user_id", toRemove);
        }
      }

      toast.success(isEdit ? "Vagt opdateret." : "Vagt oprettet.");
      onSaved();
      onClose();
    } catch {
      toast.error("Kunne ikke gemme vagten.");
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof ShiftFormData, v: any) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="glass w-full max-w-lg rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">{isEdit ? "Rediger vagt" : "Ny vagt"}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {warnings.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Template picker */}
        {templates.length > 0 && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Skabelon</label>
            <select
              value={form.template_id}
              onChange={(e) => applyTemplate(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
            >
              <option value="">— Ingen skabelon —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-muted-foreground mb-1">Dato</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono focus:border-ring focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Start</label>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => set("start_time", e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono focus:border-ring focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Slut</label>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => set("end_time", e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono focus:border-ring focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Rolle</label>
            <input
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              placeholder="Valgfri rolle"
              list="roles-list"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
            />
            <datalist id="roles-list">
              {settings.custom_roles.map((r) => <option key={r.name} value={r.name} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Farve</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.color}
                onChange={(e) => set("color", e.target.value)}
                className="h-9 w-10 cursor-pointer rounded-lg border border-input bg-background p-1"
              />
              <div className="flex flex-wrap gap-1">
                {settings.custom_roles.filter((r) => r.color).slice(0, 4).map((r) => (
                  <button
                    key={r.color}
                    type="button"
                    onClick={() => set("color", r.color)}
                    className="h-5 w-5 rounded-full border border-white/20 shadow-sm"
                    style={{ backgroundColor: r.color }}
                    title={r.name}
                  />
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Påkrævet personale</label>
            <input
              type="number"
              min={1}
              max={50}
              value={form.required_staff}
              onChange={(e) => set("required_staff", Number(e.target.value))}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as any)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
            >
              <option value="draft">Kladde</option>
              <option value="published">Publiceret</option>
              <option value="cancelled">Aflyst</option>
            </select>
          </div>
        </div>

        {/* Open shift toggle */}
        <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3">
          <div>
            <p className="text-sm font-medium">Åben vagt</p>
            <p className="text-xs text-muted-foreground">Synlig for alle — personale kan melde sig.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.is_open}
            onClick={() => set("is_open", !form.is_open)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent transition-colors ${
              form.is_open ? "bg-primary" : "bg-muted"
            }`}
          >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${form.is_open ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">Noter</label>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            placeholder="Valgfrie noter til vagten…"
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none resize-none"
          />
        </div>

        {/* Staff assignment */}
        <StaffAssignmentPicker
          members={members}
          assignedUsers={assignedUsers}
          onToggle={toggleAssign}
          requiredStaff={form.required_staff}
        />

        <div className="flex gap-2 justify-between pt-1">
          {isEdit && (
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Slet denne vagt?") || !shift) return;
                await (supabase as any).from("shifts").delete().eq("id", shift.id);
                toast.success("Vagt slettet.");
                onSaved();
                onClose();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-destructive/40 px-3 py-2 text-sm text-destructive hover:bg-destructive/5"
            >
              <Trash2 className="h-3.5 w-3.5" /> Slet
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm">
              Annuller
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={saving}
              className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {saving ? "Gemmer…" : isEdit ? "Gem" : "Opret vagt"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

type VagtTab = "plan" | "maaned" | "aabne" | "bytte" | "fravaer" | "timebank" | "tilgaengelighed";

function VagtplanSide() {
  const { aktivOrgId, erAdmin } = useOrg();
  const settings = useVagtSettings(aktivOrgId);
  const [activeTab, setActiveTab] = useState<VagtTab>("plan");
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [templates, setTemplates] = useState<ShiftTemplate[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalShift, setModalShift] = useState<Shift | null | undefined>(undefined); // undefined = closed, null = new
  const [modalDate, setModalDate] = useState<string>("");

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 6);

  const loadShifts = useCallback(async () => {
    if (!aktivOrgId) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("shifts")
      .select("*,shift_assignments(user_id,status,profiles(full_name))")
      .eq("organization_id", aktivOrgId)
      .gte("date", toISODate(weekStart))
      .lte("date", toISODate(weekEnd))
      .order("start_time");
    setShifts(data ?? []);
    setLoading(false);
  }, [aktivOrgId, weekStart]);

  useEffect(() => {
    if (!aktivOrgId) return;
    // Load templates and members once
    (supabase as any)
      .from("shift_templates")
      .select("id,name,start_time,end_time,role,color")
      .eq("organization_id", aktivOrgId)
      .then(({ data }: any) => setTemplates(data ?? []));

    // Fetch members then profiles separately (no FK on organization_members → profiles)
    supabase
      .from("organization_members")
      .select("user_id,role")
      .eq("organization_id", aktivOrgId)
      .eq("status", "active")
      .then(async ({ data: mems }) => {
        if (!mems || mems.length === 0) { setMembers([]); return; }
        const ids = mems.map((m: any) => m.user_id);
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,full_name,email")
          .in("id", ids);
        const profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
        for (const p of profs ?? []) profileMap[p.id] = { full_name: p.full_name, email: p.email };
        setMembers(mems.map((m: any) => ({
          user_id: m.user_id,
          role: m.role,
          full_name: profileMap[m.user_id]?.full_name ?? null,
          email: profileMap[m.user_id]?.email ?? null,
        })));
      });
  }, [aktivOrgId]);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  // Real-time: reload shifts when shifts or assignments change
  useEffect(() => {
    if (!aktivOrgId) return;
    const ch = supabase.channel(`vagtplan-shifts-${aktivOrgId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "shifts", filter: `organization_id=eq.${aktivOrgId}` },
        () => loadShifts())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "shift_assignments", filter: `organization_id=eq.${aktivOrgId}` },
        () => loadShifts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [aktivOrgId, loadShifts]);

  const prevWeek = () => setWeekStart((d) => addDays(d, -7));
  const nextWeek = () => setWeekStart((d) => addDays(d, 7));
  const goToday = () => setWeekStart(getWeekStart(new Date()));

  const shiftsForDate = (date: string) => shifts.filter((s) => s.date === date);

  const publishAll = async () => {
    if (!aktivOrgId) return;
    const draftIds = shifts.filter((s) => s.status === "draft").map((s) => s.id);
    if (draftIds.length === 0) { toast.info("Ingen kladder at publicere."); return; }
    if (!confirm(`Publicer ${draftIds.length} kladdevagter for denne uge?`)) return;
    const { error } = await (supabase as any)
      .from("shifts")
      .update({ status: "published" })
      .in("id", draftIds);
    if (error) return toast.error(error.message);
    toast.success(`${draftIds.length} vagter publiceret.`);
    loadShifts();
  };

  const draftCount = shifts.filter((s) => s.status === "draft").length;
  const today = toISODate(new Date());

  const vagtTabs: { id: VagtTab; label: string; icon: any }[] = [
    { id: "plan", label: "Uge", icon: LayoutGrid },
    { id: "maaned", label: "Måned", icon: Calendar },
    { id: "aabne", label: "Åbne vagter", icon: Users },
    { id: "bytte", label: "Vagtbytte", icon: ArrowLeftRight },
    { id: "fravaer", label: "Fravær", icon: UserX },
    { id: "timebank", label: "Timebank", icon: ClockIcon },
    { id: "tilgaengelighed", label: "Tilgængelighed", icon: CalendarDays },
  ];

  return (
    <div className="space-y-4">
      {/* Page title */}
      <h1 className="font-display text-2xl font-bold">Vagtplan</h1>

      {/* Tab nav */}
      <div className="glass flex flex-wrap gap-1 rounded-2xl p-1.5">
        {vagtTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition ${
                activeTab === t.id ? "bg-gradient-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Non-schedule tabs */}
      {aktivOrgId && activeTab === "maaned" && (
        <MonthViewTab
          orgId={aktivOrgId}
          erAdmin={erAdmin}
          templates={templates}
          members={members}
          settings={settings}
          onEditShift={(s) => setModalShift(s)}
          onCreateShift={(date) => { setModalDate(date); setModalShift(null); }}
        />
      )}
      {aktivOrgId && activeTab === "aabne" && <AabneVagterTab orgId={aktivOrgId} />}
      {aktivOrgId && activeTab === "bytte" && <VagtbytteTab orgId={aktivOrgId} erAdmin={erAdmin} />}
      {aktivOrgId && activeTab === "fravaer" && <FravaerTab orgId={aktivOrgId} erAdmin={erAdmin} />}
      {aktivOrgId && activeTab === "timebank" && <TimebankTab orgId={aktivOrgId} erAdmin={erAdmin} />}
      {aktivOrgId && activeTab === "tilgaengelighed" && <TilgængelighedException orgId={aktivOrgId} />}

      {/* Schedule tab */}
      {activeTab === "plan" && <>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{formatWeekLabel(weekStart)}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {erAdmin && draftCount > 0 && (
            <button
              onClick={publishAll}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              <Send className="h-4 w-4" /> Publicer uge ({draftCount})
            </button>
          )}
          <div className="flex items-center gap-1">
            <button
              onClick={prevWeek}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToday}
              className="rounded-xl border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              I dag
            </button>
            <button
              onClick={nextWeek}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-border" />Kladde</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-success" />Publiceret</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full bg-destructive" />Aflyst</span>
        <span className="flex items-center gap-1.5"><Lock className="h-3 w-3" />Kun admin kan redigere</span>
      </div>

      {/* Weekly grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {weekDates.map((d, i) => {
          const dateStr = toISODate(d);
          const isToday = dateStr === today;
          const dayShifts = shiftsForDate(dateStr);
          return (
            <div key={dateStr} className="min-w-0">
              {/* Day header */}
              <div className={`mb-1.5 rounded-xl px-1.5 py-1 text-center text-xs font-medium ${
                isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}>
                <div>{DAY_SHORT[i]}</div>
                <div className="font-bold">{d.getDate()}</div>
              </div>

              {/* Shifts */}
              <div className="space-y-1">
                {loading ? (
                  <div className="h-10 rounded-xl bg-muted animate-pulse" />
                ) : (
                  dayShifts.map((s) => (
                    <ShiftCard
                      key={s.id}
                      shift={s}
                      erAdmin={erAdmin}
                      onEdit={(sh) => setModalShift(sh)}
                    />
                  ))
                )}
              </div>

              {/* Add shift button (admin only) */}
              {erAdmin && (
                <button
                  onClick={() => { setModalDate(dateStr); setModalShift(null); }}
                  className="mt-1 flex w-full items-center justify-center rounded-xl border border-dashed border-border py-1.5 text-muted-foreground hover:border-primary/50 hover:text-primary transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Staff view — own week summary */}
      {!erAdmin && (
        <StaffWeekSummary orgId={aktivOrgId!} weekDates={weekDates} />
      )}

      {/* Shift modal */}
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
      </>}
    </div>
  );
}

// Staff own schedule summary for the week
function StaffWeekSummary({ orgId, weekDates }: { orgId: string; weekDates: Date[] }) {
  const [myShifts, setMyShifts] = useState<Shift[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const start = toISODate(weekDates[0]);
      const end = toISODate(weekDates[6]);
      const { data } = await (supabase as any)
        .from("shifts")
        .select("*,shift_assignments!inner(user_id,status)")
        .eq("organization_id", orgId)
        .eq("shift_assignments.user_id", user.id)
        .gte("date", start)
        .lte("date", end)
        .order("date")
        .order("start_time");
      setMyShifts(data ?? []);
    };
    load();
  }, [orgId, weekDates]);

  const totalMinutes = myShifts.reduce((sum, s) => {
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    return sum + (eh * 60 + em) - (sh * 60 + sm);
  }, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  if (myShifts.length === 0) return null;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-sm">Mine vagter denne uge</h2>
        <span className="text-xs text-muted-foreground">{totalHours} timer i alt</span>
      </div>
      <div className="space-y-2">
        {myShifts.map((s) => (
          <div key={s.id} className="flex items-center gap-3 rounded-xl border border-border px-3 py-2">
            <div
              className="h-7 w-1 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {new Date(s.date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "short" })}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                {s.role ? ` · ${s.role}` : ""}
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
    const { data } = await (supabase as any)
      .from("shifts")
      .select("*,shift_assignments(user_id,status)")
      .eq("organization_id", orgId)
      .eq("is_open", true)
      .eq("status", "published")
      .gte("date", today)
      .order("date")
      .order("start_time");
    setShifts(data ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  // Real-time for open shifts
  useEffect(() => {
    const ch = supabase.channel(`open-shifts-${orgId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "shifts", filter: `organization_id=eq.${orgId}` },
        () => load())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "shift_assignments", filter: `organization_id=eq.${orgId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, load]);

  const claim = async (shiftId: string) => {
    setClaiming(shiftId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await (supabase as any).from("shift_assignments").insert({
        shift_id: shiftId,
        user_id: user.id,
        organization_id: orgId,
        status: "assigned",
      });
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

  if (shifts.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
        Ingen åbne vagter tilgængelige i øjeblikket.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold">Åbne vagter</h2>
        <p className="text-xs text-muted-foreground">Vagter der søger personale — meld dig til en vagt herunder.</p>
      </div>
      {shifts.map((s) => {
        const claimed = s.shift_assignments?.length ?? 0;
        const full = claimed >= s.required_staff;
        return (
          <div key={s.id} className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="h-12 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">
                {new Date(s.date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                {s.role ? ` · ${s.role}` : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {claimed} / {s.required_staff} tilmeldte
              </p>
            </div>
            <button
              onClick={() => claim(s.id)}
              disabled={full || claiming === s.id}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition disabled:opacity-50 ${
                full
                  ? "bg-muted text-muted-foreground cursor-not-allowed"
                  : "bg-gradient-primary text-primary-foreground shadow-glow"
              }`}
            >
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
  id: string;
  shift_id: string;
  requested_by: string;
  requested_to: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  shifts?: { date: string; start_time: string; end_time: string; role: string | null };
  requester?: { full_name: string | null };
  recipient?: { full_name: string | null };
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

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    // Load swaps relevant to this user (or all if admin)
    const q = (supabase as any)
      .from("shift_swaps")
      .select("*,shifts(date,start_time,end_time,role)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });

    const { data } = erAdmin
      ? await q
      : await q.or(`requested_by.eq.${userId},requested_to.eq.${userId}`);
    setSwaps(data ?? []);

    // Load own future assignments for creating swap requests
    const today = toISODate(new Date());
    const { data: asgn } = await (supabase as any)
      .from("shift_assignments")
      .select("shift_id,shifts(id,date,start_time,end_time,role)")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .gte("shifts.date", today)
      .not("shifts", "is", null);
    setMyAssignments(asgn ?? []);

    const { data: mem } = await (supabase as any)
      .from("organization_members")
      .select("user_id,role")
      .eq("organization_id", orgId)
      .eq("status", "active")
      .neq("user_id", userId ?? "");
    if (mem && mem.length > 0) {
      const ids = mem.map((m: any) => m.user_id);
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email").in("id", ids);
      const pm: Record<string, any> = {};
      for (const p of profs ?? []) pm[p.id] = p;
      setMembers(mem.map((m: any) => ({ ...m, full_name: pm[m.user_id]?.full_name ?? null, email: pm[m.user_id]?.email ?? null })));
    } else {
      setMembers([]);
    }

    setLoading(false);
  }, [orgId, userId, erAdmin]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  useEffect(() => {
    const ch = supabase.channel(`swaps-${orgId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "shift_swaps", filter: `organization_id=eq.${orgId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, load]);

  const createSwap = async () => {
    if (!selectedShift || !userId) return;
    const { error } = await (supabase as any).from("shift_swaps").insert({
      organization_id: orgId,
      shift_id: selectedShift,
      requested_by: userId,
      requested_to: selectedTo || null,
      notes: notes.trim() || null,
      status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success("Bytteforespørgsel sendt.");
    setShowForm(false);
    setSelectedShift(""); setSelectedTo(""); setNotes("");
    load();
  };

  const respond = async (id: string, accept: boolean) => {
    const { error } = await (supabase as any)
      .from("shift_swaps")
      .update({ status: accept ? "accepted" : "declined" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(accept ? "Bytteforespørgsel accepteret." : "Bytteforespørgsel afvist.");
    load();
  };

  const adminApprove = async (id: string, approve: boolean) => {
    const { error } = await (supabase as any)
      .from("shift_swaps")
      .update({
        status: approve ? "approved" : "rejected",
        manager_approved_by: userId,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Bytte godkendt." : "Bytte afvist.");
    load();
  };

  const statusLabel = (s: string) => ({
    pending: "Afventer", accepted: "Accepteret", declined: "Afvist",
    approved: "Godkendt", rejected: "Afvist af manager",
  }[s] ?? s);

  const statusColor = (s: string) =>
    s === "approved" ? "bg-success/10 text-success"
    : s === "rejected" || s === "declined" ? "bg-destructive/10 text-destructive"
    : s === "accepted" ? "bg-primary/10 text-primary"
    : "bg-muted text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Vagtbytte</h2>
          <p className="text-xs text-muted-foreground">Anmod om at bytte en vagt med en kollega.</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          <Plus className="h-4 w-4" /> Anmod om bytte
        </button>
      </div>

      {showForm && (
        <div className="glass rounded-2xl p-5 space-y-4">
          <h3 className="font-medium">Ny bytteforespørgsel</h3>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Vagt der ønskes byttet</label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
            >
              <option value="">— Vælg vagt —</option>
              {myAssignments.map((a: any) => a.shifts && (
                <option key={a.shift_id} value={a.shift_id}>
                  {new Date(a.shifts.date).toLocaleDateString("da-DK")} {a.shifts.start_time?.slice(0, 5)}–{a.shifts.end_time?.slice(0, 5)}
                  {a.shifts.role ? ` · ${a.shifts.role}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Send til (valgfri)</label>
            <select
              value={selectedTo}
              onChange={(e) => setSelectedTo(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
            >
              <option value="">— Åben bytteforespørgsel —</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {(m as any).full_name ?? (m as any).email ?? m.user_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Note</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Valgfri besked…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none resize-none"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Annuller</button>
            <button
              onClick={createSwap}
              disabled={!selectedShift}
              className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              Send forespørgsel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Indlæser…</div>
      ) : swaps.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Ingen bytteforespørgsler endnu.</div>
      ) : (
        <div className="space-y-2">
          {swaps.map((sw) => (
            <div key={sw.id} className="glass rounded-2xl p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  {sw.shifts && (
                    <p className="text-sm font-medium">
                      {new Date(sw.shifts.date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "short" })}
                      {" "}{sw.shifts.start_time?.slice(0, 5)}–{sw.shifts.end_time?.slice(0, 5)}
                      {sw.shifts.role ? ` · ${sw.shifts.role}` : ""}
                    </p>
                  )}
                  {sw.notes && <p className="text-xs text-muted-foreground mt-0.5">{sw.notes}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColor(sw.status)}`}>
                  {statusLabel(sw.status)}
                </span>
              </div>
              {/* Recipient can accept/decline */}
              {sw.status === "pending" && sw.requested_to === userId && (
                <div className="flex gap-2">
                  <button onClick={() => respond(sw.id, true)} className="rounded-xl bg-success/10 px-3 py-1.5 text-xs font-semibold text-success">Acceptér</button>
                  <button onClick={() => respond(sw.id, false)} className="rounded-xl bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive">Afvis</button>
                </div>
              )}
              {/* Admin can approve accepted swaps */}
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
  id: string;
  user_id: string;
  date: string;
  reason: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  profiles?: { full_name: string | null };
};

const ABSENCE_REASONS = [
  { value: "sygdom", label: "Sygdom" },
  { value: "ferie", label: "Ferie" },
  { value: "fridag", label: "Fridag" },
  { value: "andet", label: "Andet" },
];

function FravaerTab({ orgId, erAdmin }: { orgId: string; erAdmin: boolean }) {
  const [requests, setRequests] = useState<AbsenceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState(toISODate(new Date()));
  const [reason, setReason] = useState("sygdom");
  const [notesVal, setNotesVal] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    const q = (supabase as any)
      .from("absence_requests")
      .select("*,profiles(full_name)")
      .eq("organization_id", orgId)
      .order("date", { ascending: false });
    const { data } = erAdmin ? await q : await q.eq("user_id", userId);
    setRequests(data ?? []);
    setLoading(false);
  }, [orgId, userId, erAdmin]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  useEffect(() => {
    const ch = supabase.channel(`absences-${orgId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "absence_requests", filter: `organization_id=eq.${orgId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, load]);

  const submit = async () => {
    if (!userId) return;
    const { error } = await (supabase as any).from("absence_requests").insert({
      organization_id: orgId,
      user_id: userId,
      date,
      reason,
      notes: notesVal.trim() || null,
      status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success("Fraværsanmodning sendt.");
    setShowForm(false); setNotesVal("");
    load();
  };

  const review = async (id: string, approve: boolean) => {
    const { error } = await (supabase as any)
      .from("absence_requests")
      .update({ status: approve ? "approved" : "rejected", reviewed_by: userId })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(approve ? "Fravær godkendt." : "Fravær afvist.");
    load();
  };

  const statusColor = (s: string) =>
    s === "approved" ? "bg-success/10 text-success"
    : s === "rejected" ? "bg-destructive/10 text-destructive"
    : "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  const statusLabel = (s: string) => ({ pending: "Afventer", approved: "Godkendt", rejected: "Afvist" }[s] ?? s);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Fraværsanmodninger</h2>
          <p className="text-xs text-muted-foreground">{erAdmin ? "Administrer personalets fraværsanmodninger." : "Anmod om fravær eller sygdom."}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
        >
          <Plus className="h-4 w-4" /> Anmod om fravær
        </button>
      </div>

      {showForm && (
        <div className="glass rounded-2xl p-5 space-y-4">
          <h3 className="font-medium">Ny fraværsanmodning</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Dato</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm font-mono focus:border-ring focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Årsag</label>
              <select value={reason} onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none">
                {ABSENCE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Note</label>
            <textarea value={notesVal} onChange={(e) => setNotesVal(e.target.value)} rows={2} placeholder="Valgfri bemærkning…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Annuller</button>
            <button onClick={submit} className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Send</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Indlæser…</div>
      ) : requests.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Ingen fraværsanmodninger endnu.</div>
      ) : (
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="glass rounded-2xl p-4 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {erAdmin && r.profiles?.full_name && (
                  <p className="text-xs font-medium text-primary mb-0.5">{r.profiles.full_name}</p>
                )}
                <p className="text-sm font-medium">
                  {new Date(r.date).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {ABSENCE_REASONS.find((x) => x.value === r.reason)?.label ?? r.reason}
                  {r.notes ? ` · ${r.notes}` : ""}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColor(r.status)}`}>
                {statusLabel(r.status)}
              </span>
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
  id: string;
  user_id: string;
  hours: number;
  reason: string | null;
  type: string;
  created_at: string;
  profiles?: { full_name: string | null };
};

function TimebankTab({ orgId, erAdmin }: { orgId: string; erAdmin: boolean }) {
  const [entries, setEntries] = useState<TimeBankEntry[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [hours, setHours] = useState("");
  const [type, setType] = useState("overtime");
  const [reasonVal, setReasonVal] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    const q = (supabase as any)
      .from("time_bank")
      .select("*,profiles(full_name)")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    const { data } = erAdmin ? await q : await q.eq("user_id", userId);
    setEntries(data ?? []);
    const myBal = (data ?? [])
      .filter((e: TimeBankEntry) => e.user_id === userId)
      .reduce((sum: number, e: TimeBankEntry) => sum + (e.type === "time_off" ? -e.hours : e.hours), 0);
    setBalance(myBal);
    setLoading(false);
  }, [orgId, userId, erAdmin]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  useEffect(() => {
    const ch = supabase.channel(`timebank-${orgId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "time_bank", filter: `organization_id=eq.${orgId}` },
        () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, load]);

  const addEntry = async () => {
    if (!hours || !userId || !erAdmin) return;
    const { error } = await (supabase as any).from("time_bank").insert({
      organization_id: orgId,
      user_id: userId,
      hours: parseFloat(hours),
      type,
      reason: reasonVal.trim() || null,
      created_by: userId,
    });
    if (error) return toast.error(error.message);
    toast.success("Timebank opdateret.");
    setShowForm(false); setHours(""); setReasonVal("");
    load();
  };

  const typeLabel = (t: string) => ({ overtime: "Overarbejde", time_off: "Afspadsering", adjustment: "Justering" }[t] ?? t);
  const typeColor = (t: string) =>
    t === "overtime" ? "text-primary"
    : t === "time_off" ? "text-destructive"
    : "text-muted-foreground";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Timebank</h2>
          <p className="text-xs text-muted-foreground">Overarbejde og afspadseringsbalance.</p>
        </div>
        {erAdmin && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
          >
            <Plus className="h-4 w-4" /> Tilføj post
          </button>
        )}
      </div>

      {/* Balance card */}
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
              <input type="number" step={0.5} value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0.0"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none">
                <option value="overtime">Overarbejde</option>
                <option value="time_off">Afspadsering</option>
                <option value="adjustment">Justering</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Årsag</label>
            <input value={reasonVal} onChange={(e) => setReasonVal(e.target.value)} placeholder="Valgfri…"
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Annuller</button>
            <button onClick={addEntry} disabled={!hours}
              className="rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              Tilføj
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-muted-foreground">Indlæser…</div>
      ) : entries.length === 0 ? (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Ingen poster endnu.</div>
      ) : (
        <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3">
              {erAdmin && e.profiles?.full_name && (
                <p className="text-xs font-medium text-primary w-24 shrink-0 truncate">{e.profiles.full_name}</p>
              )}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${typeColor(e.type)}`}>{typeLabel(e.type)}</p>
                {e.reason && <p className="text-xs text-muted-foreground">{e.reason}</p>}
              </div>
              <span className={`text-sm font-bold ${e.type === "time_off" ? "text-destructive" : "text-primary"}`}>
                {e.type === "time_off" ? "-" : "+"}{e.hours}t
              </span>
              <span className="text-[11px] text-muted-foreground">
                {new Date(e.created_at).toLocaleDateString("da-DK")}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== MÅNEDSOVERSIGT =====
function MonthViewTab({
  orgId,
  erAdmin,
  onEditShift,
  onCreateShift,
}: {
  orgId: string;
  erAdmin: boolean;
  templates: ShiftTemplate[];
  members: OrgMember[];
  settings: VagtSettings;
  onEditShift: (s: Shift) => void;
  onCreateShift: (date: string) => void;
}) {
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  const gridStart = useMemo(() => {
    const d = new Date(monthDate);
    d.setDate(1);
    return getWeekStart(d);
  }, [monthDate]);

  const gridEnd = useMemo(() => addDays(gridStart, 41), [gridStart]);

  const gridDates = useMemo(
    () => Array.from({ length: 42 }, (_, i) => addDays(gridStart, i)),
    [gridStart],
  );

  const loadMonthShifts = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("shifts")
      .select("*,shift_assignments(user_id,status,profiles(full_name))")
      .eq("organization_id", orgId)
      .gte("date", toISODate(gridStart))
      .lte("date", toISODate(gridEnd))
      .order("start_time");
    setShifts(data ?? []);
    setLoading(false);
  }, [orgId, gridStart, gridEnd]);

  useEffect(() => { loadMonthShifts(); }, [loadMonthShifts]);

  useEffect(() => {
    const ch = supabase.channel(`month-view-${orgId}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "shifts", filter: `organization_id=eq.${orgId}` },
        () => loadMonthShifts())
      .on("postgres_changes",
        { event: "*", schema: "public", table: "shift_assignments", filter: `organization_id=eq.${orgId}` },
        () => loadMonthShifts())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, loadMonthShifts]);

  const prevMonth = () => setMonthDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() - 1); return n; });
  const nextMonth = () => setMonthDate((d) => { const n = new Date(d); n.setMonth(n.getMonth() + 1); return n; });
  const goToday = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    setMonthDate(d);
  };

  const today = toISODate(new Date());
  const currentMonth = monthDate.getMonth();

  const shiftsForDate = (dateStr: string) => {
    const all = shifts.filter((s) => s.date === dateStr);
    if (erAdmin) return all;
    return all.filter((s) => {
      const isAssigned = s.shift_assignments?.some((a) => a.user_id === userId);
      const isOpenPublished = s.is_open && s.status === "published";
      return isAssigned || isOpenPublished;
    });
  };

  const rawLabel = monthDate.toLocaleDateString("da-DK", { month: "long", year: "numeric" });
  const monthLabel = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg">{monthLabel}</h2>
        <div className="flex items-center gap-1">
          <button
            onClick={prevMonth}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={goToday}
            className="rounded-xl border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            I dag
          </button>
          <button
            onClick={nextMonth}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/30">
          {DAY_SHORT.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        {/* 6-week grid */}
        {Array.from({ length: 6 }, (_, week) => (
          <div key={week} className="grid grid-cols-7 border-b border-border last:border-0">
            {Array.from({ length: 7 }, (_, dow) => {
              const date = gridDates[week * 7 + dow];
              const dateStr = toISODate(date);
              const isToday = dateStr === today;
              const inMonth = date.getMonth() === currentMonth;
              const dayShifts = shiftsForDate(dateStr);

              return (
                <div
                  key={dateStr}
                  className={`relative min-h-[90px] border-r border-border last:border-r-0 p-1.5 ${
                    !inMonth ? "bg-muted/20" : ""
                  } ${erAdmin && inMonth ? "cursor-pointer hover:bg-primary/5 transition" : ""}`}
                  onClick={() => {
                    if (erAdmin && inMonth) onCreateShift(dateStr);
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                        isToday
                          ? "bg-primary text-primary-foreground"
                          : inMonth
                          ? "text-foreground"
                          : "text-muted-foreground/40"
                      }`}
                    >
                      {date.getDate()}
                    </span>
                    {erAdmin && inMonth && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onCreateShift(dateStr); }}
                        className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {dayShifts.slice(0, 3).map((s) => (
                      <button
                        key={s.id}
                        onClick={(e) => { e.stopPropagation(); onEditShift(s); }}
                        className={`w-full rounded text-left px-1.5 py-0.5 text-[10px] leading-snug truncate transition hover:opacity-75 ${
                          s.status === "cancelled" ? "opacity-40 line-through" : ""
                        }`}
                        style={{
                          backgroundColor: `${s.color}25`,
                          borderLeft: `2px solid ${s.color}`,
                          color: s.color,
                        }}
                        title={`${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}${s.role ? ` · ${s.role}` : ""}`}
                      >
                        {s.start_time.slice(0, 5)} {s.role ?? "Vagt"}
                      </button>
                    ))}
                    {dayShifts.length > 3 && (
                      <p className="text-[10px] text-muted-foreground px-1">
                        +{dayShifts.length - 3} mere
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {loading && (
        <p className="text-center text-xs text-muted-foreground">Indlæser…</p>
      )}
    </div>
  );
}

// ===== TILGÆNGELIGHED (staff self-setup) =====
function TilgængelighedException({ orgId }: { orgId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<number | null>(null);
  const [newDay, setNewDay] = useState(0);
  const [newStart, setNewStart] = useState("08:00");
  const [newEnd, setNewEnd] = useState("16:00");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUserId(user?.id ?? null));
  }, []);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await (supabase as any)
      .from("staff_availability")
      .select("*")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .order("day_of_week");
    setRows(data ?? []);
    setLoading(false);
  }, [orgId, userId]);

  useEffect(() => { if (userId) load(); }, [load, userId]);

  const save = async () => {
    if (!userId) return;
    const { error } = await (supabase as any)
      .from("staff_availability")
      .upsert({
        organization_id: orgId,
        user_id: userId,
        day_of_week: newDay,
        start_time: newStart,
        end_time: newEnd,
      }, { onConflict: "organization_id,user_id,day_of_week" });
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

  const daysWithAvailability = new Set(rows.map((r) => r.day_of_week));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-semibold">Min tilgængelighed</h2>
        <p className="text-xs text-muted-foreground">Angiv hvilke dage og tidspunkter du normalt er tilgængelig. Admins bruger dette til planlægning.</p>
      </div>

      <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
        {DAY_NAMES.map((day, idx) => {
          const existing = rows.find((r) => r.day_of_week === idx);
          const isEditing = editing === idx;
          return (
            <div key={idx} className="flex items-center gap-3 px-4 py-3">
              <span className="w-20 text-sm font-medium shrink-0">{day}</span>
              {existing && !isEditing ? (
                <>
                  <span className="flex-1 text-sm text-muted-foreground">
                    {existing.start_time.slice(0, 5)} – {existing.end_time.slice(0, 5)}
                  </span>
                  <button onClick={() => { setNewDay(idx); setNewStart(existing.start_time.slice(0, 5)); setNewEnd(existing.end_time.slice(0, 5)); setEditing(idx); }}
                    className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted">Rediger</button>
                  <button onClick={() => remove(existing.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : isEditing ? (
                <>
                  <input type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)}
                    className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-sm font-mono focus:border-ring focus:outline-none" />
                  <span className="text-muted-foreground">–</span>
                  <input type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)}
                    className="w-24 rounded-lg border border-input bg-background px-2 py-1 text-sm font-mono focus:border-ring focus:outline-none" />
                  <button onClick={save} className="rounded-lg bg-primary/10 px-2 py-1 text-xs font-semibold text-primary">Gem</button>
                  <button onClick={() => setEditing(null)} className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground">Annuller</button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-xs text-muted-foreground">Ikke angivet</span>
                  <button
                    onClick={() => { setNewDay(idx); setNewStart("08:00"); setNewEnd("16:00"); setEditing(idx); }}
                    className="rounded-lg bg-muted px-2 py-1 text-xs hover:bg-muted/80"
                  >
                    Tilføj
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
