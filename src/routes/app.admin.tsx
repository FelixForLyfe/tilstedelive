import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Plus, Trash2, Users, Tag, Activity as ActIcon, UserCog, Camera, Loader2, ScrollText, ShieldCheck, QrCode, Download, KeySquare, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { BarnDetalje } from "@/components/BarnDetalje";
import { toast } from "sonner";
import { useChildPhoto } from "@/lib/childPhoto";
import { generateQrLocation, deleteQrLocation, setLocationPin, getOrgCheckins, exportCheckinsCSV, type QrLocation, type StaffCheckin } from "@/server/checkin.functions";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export const Route = createFileRoute("/app/admin")({
  component: AdminSide,
});

type Tab = "boern" | "kategorier" | "aktiviteter" | "personale" | "auditlog" | "checkin";

function AdminSide() {
  const { aktivOrgId, erAdmin, terms } = useOrg();
  const [tab, setTab] = useState<Tab>("boern");

  if (!erAdmin) {
    return <div className="glass rounded-2xl p-10 text-center text-muted-foreground">Kun admin har adgang.</div>;
  }

  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "boern", label: cap(terms.deltagere), icon: Users },
    { id: "kategorier", label: cap(terms.grupper), icon: Tag },
    { id: "aktiviteter", label: cap(terms.aktiviteter), icon: ActIcon },
    { id: "personale", label: "Personale", icon: UserCog },
    { id: "auditlog", label: "Aktivitetslog", icon: ScrollText },
    { id: "checkin", label: "Tjek ind", icon: QrCode },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Admin</h1>
      <div className="glass flex flex-wrap gap-1 rounded-2xl p-1.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                tab === t.id ? "bg-gradient-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>
      {aktivOrgId && tab === "boern" && <BoernPanel orgId={aktivOrgId} />}
      {aktivOrgId && tab === "kategorier" && <KategoriPanel orgId={aktivOrgId} />}
      {aktivOrgId && tab === "aktiviteter" && <AktivitetPanel orgId={aktivOrgId} />}
      {aktivOrgId && tab === "personale" && <PersonalePanel orgId={aktivOrgId} />}
      {aktivOrgId && tab === "auditlog" && <AuditLogPanel orgId={aktivOrgId} />}
      {aktivOrgId && tab === "checkin" && <CheckinPanel orgId={aktivOrgId} />}
    </div>
  );
}

// ===== KATEGORIER =====
function KategoriPanel({ orgId }: { orgId: string }) {
  const [list, setList] = useState<any[]>([]);
  const [navn, setNavn] = useState("");

  const indlaes = useCallback(async () => {
    const { data } = await supabase.from("categories").select("*").eq("organization_id", orgId).order("sort_order");
    setList(data ?? []);
  }, [orgId]);
  useEffect(() => { indlaes(); }, [indlaes]);

  const opret = async (e: FormEvent) => {
    e.preventDefault();
    if (!navn.trim()) return;
    const { error } = await supabase.from("categories").insert({ organization_id: orgId, name: navn.trim(), sort_order: list.length });
    if (error) return toast.error(error.message);
    setNavn(""); indlaes();
  };
  const slet = async (id: string) => {
    if (!confirm("Slet kategori?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    indlaes();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={opret} className="glass flex gap-2 rounded-2xl p-4">
        <input value={navn} onChange={(e) => setNavn(e.target.value)} placeholder="Fx 1. klasse"
          className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm" />
        <button className="inline-flex items-center gap-1 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Tilføj
        </button>
      </form>
      <div className="grid gap-2">
        {list.map((k) => (
          <div key={k.id} className="glass flex items-center justify-between rounded-xl p-3">
            <span>{k.name}</span>
            <button onClick={() => slet(k.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Ingen kategorier endnu.</p>}
      </div>
    </div>
  );
}

// ===== AKTIVITETER =====
function AktivitetPanel({ orgId }: { orgId: string }) {
  const [list, setList] = useState<any[]>([]);
  const [navn, setNavn] = useState("");

  const indlaes = useCallback(async () => {
    const { data } = await supabase.from("activities").select("*").eq("organization_id", orgId).order("name");
    setList(data ?? []);
  }, [orgId]);
  useEffect(() => { indlaes(); }, [indlaes]);

  const opret = async (e: FormEvent) => {
    e.preventDefault();
    if (!navn.trim()) return;
    const { error } = await supabase.from("activities").insert({ organization_id: orgId, name: navn.trim() });
    if (error) return toast.error(error.message);
    setNavn(""); indlaes();
  };
  const slet = async (id: string) => {
    if (!confirm("Slet aktivitet?")) return;
    const { error } = await supabase.from("activities").delete().eq("id", id);
    if (error) return toast.error(error.message);
    indlaes();
  };
  const toggle = async (a: any) => {
    await supabase.from("activities").update({ is_active: !a.is_active }).eq("id", a.id);
    indlaes();
  };

  return (
    <div className="space-y-4">
      <form onSubmit={opret} className="glass flex gap-2 rounded-2xl p-4">
        <input value={navn} onChange={(e) => setNavn(e.target.value)} placeholder="Fx Playstation"
          className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm" />
        <button className="inline-flex items-center gap-1 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          <Plus className="h-4 w-4" /> Tilføj
        </button>
      </form>
      <div className="grid gap-2">
        {list.map((a) => (
          <div key={a.id} className="glass flex items-center justify-between rounded-xl p-3">
            <span>{a.name}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => toggle(a)}
                className={`rounded-lg px-3 py-1 text-xs font-medium ${a.is_active ? "bg-success/15 text-success" : "bg-surface text-muted-foreground"}`}>
                {a.is_active ? "Aktiv" : "Inaktiv"}
              </button>
              <button onClick={() => slet(a.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Ingen aktiviteter endnu.</p>}
      </div>
    </div>
  );
}

// ===== BØRN =====
function BoernPanel({ orgId }: { orgId: string }) {
  const [list, setList] = useState<any[]>([]);
  const [kategorier, setKategorier] = useState<any[]>([]);
  const [aaben, setAaben] = useState(false);
  const [detaljeId, setDetaljeId] = useState<string | null>(null);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [uploader, setUploader] = useState(false);
  const fotoRef = useRef<HTMLInputElement>(null);
  const { terms } = useOrg();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const [form, setForm] = useState<any>({ full_name: "", category_id: "", parent_1_name: "", parent_1_phone: "", parent_2_name: "", parent_2_phone: "", address: "", cpr_number: "", doctor_name: "", doctor_phone: "", allergies: "", special_notes: "", can_leave_alone: false, default_leave_time: "" });

  const indlaes = useCallback(async () => {
    const [b, k] = await Promise.all([
      supabase.from("children").select("*, categories(name)").eq("organization_id", orgId).order("full_name"),
      supabase.from("categories").select("*").eq("organization_id", orgId).order("sort_order"),
    ]);
    setList(b.data ?? []); setKategorier(k.data ?? []);
  }, [orgId]);
  useEffect(() => { indlaes(); }, [indlaes]);

  const reset = () => {
    setForm({ full_name: "", category_id: "", parent_1_name: "", parent_1_phone: "", parent_2_name: "", parent_2_phone: "", address: "", cpr_number: "", doctor_name: "", doctor_phone: "", allergies: "", special_notes: "", can_leave_alone: false, default_leave_time: "" });
    setFoto(null); setFotoPreview(null);
  };

  const opret = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim()) return toast.error("Navn er påkrævet");
    setUploader(true);
    const payload: any = { ...form, organization_id: orgId };
    if (!payload.category_id) payload.category_id = null;
    if (!payload.default_leave_time) payload.default_leave_time = null;
    if (!terms.visCpr) payload.cpr_number = null;

    const { data, error } = await supabase.from("children").insert(payload).select("*, categories(name)").single();
    if (error) { setUploader(false); toast.error(error.message); return; }

    if (foto && data) {
      if (!ALLOWED_PHOTO_TYPES.includes(foto.type)) {
        toast.error("Filtypen understøttes ikke");
      } else if (foto.size > MAX_PHOTO_BYTES) {
        toast.error("Billedet må højst være 5 MB");
      } else {
        const ext = (foto.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
        const sti = `${orgId}/${data.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("child-photos").upload(sti, foto, { upsert: false, contentType: foto.type });
        if (!upErr) {
          await supabase.from("children").update({ photo_url: sti }).eq("id", data.id);
          data.photo_url = sti;
        } else {
          toast.error("Billede kunne ikke uploades: " + upErr.message);
        }
      }
    }

    setList((prev) => [...prev, data].sort((a, b) => a.full_name.localeCompare(b.full_name)));
    reset();
    setAaben(false);
    setUploader(false);
    toast.success(`${cap(terms.deltager)} tilføjet`);
  };
  const slet = async (id: string) => {
    if (!confirm(`Slet ${terms.deltager}? Alle tilknyttede data slettes.`)) return;
    const { error } = await supabase.from("children").delete().eq("id", id);
    if (error) return toast.error(error.message);
    indlaes();
  };

  const valgFoto = (f: File | null) => {
    setFoto(f);
    if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    setFotoPreview(f ? URL.createObjectURL(f) : null);
  };

  return (
    <div className="space-y-4">
      <button onClick={() => setAaben(!aaben)}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow">
        <Plus className="h-4 w-4" /> {aaben ? "Luk formular" : `Tilføj ${terms.deltager}`}
      </button>

      {aaben && (
        <form onSubmit={opret} className="glass grid gap-3 rounded-2xl p-5 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
              {fotoPreview ? (
                <img src={fotoPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  <Camera className="h-7 w-7" />
                </div>
              )}
            </div>
            <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => valgFoto(e.target.files?.[0] ?? null)} />
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => fotoRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-xs font-semibold hover:bg-surface-elevated">
                <Camera className="h-4 w-4" /> {foto ? "Skift billede" : "Tag/upload billede"}
              </button>
              {foto && (
                <button type="button" onClick={() => valgFoto(null)}
                  className="rounded-xl bg-surface px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10">
                  Fjern
                </button>
              )}
            </div>
          </div>
          <Felt label="Fulde navn *" v={form.full_name} on={(v) => setForm({ ...form, full_name: v })} />
          <div>
            <label className="text-xs font-medium text-muted-foreground">Kategori</label>
            <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm">
              <option value="">– vælg –</option>
              {kategorier.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </div>
          <Felt label="Forælder 1" v={form.parent_1_name} on={(v) => setForm({ ...form, parent_1_name: v })} />
          <Felt label="Telefon" v={form.parent_1_phone} on={(v) => setForm({ ...form, parent_1_phone: v })} />
          <Felt label="Forælder 2" v={form.parent_2_name} on={(v) => setForm({ ...form, parent_2_name: v })} />
          <Felt label="Telefon" v={form.parent_2_phone} on={(v) => setForm({ ...form, parent_2_phone: v })} />
          <Felt label="Adresse" v={form.address} on={(v) => setForm({ ...form, address: v })} />
          {terms.visCpr && <Felt label="CPR-nummer" v={form.cpr_number} on={(v) => setForm({ ...form, cpr_number: v })} />}
          <Felt label="Læge" v={form.doctor_name} on={(v) => setForm({ ...form, doctor_name: v })} />
          <Felt label="Lægens telefon" v={form.doctor_phone} on={(v) => setForm({ ...form, doctor_phone: v })} />
          <Felt label="Allergier" v={form.allergies} on={(v) => setForm({ ...form, allergies: v })} />
          <Felt label="Særlige hensyn" v={form.special_notes} on={(v) => setForm({ ...form, special_notes: v })} />
          <div>
            <label className="text-xs font-medium text-muted-foreground">Standard hjemsendelse</label>
            <input type="time" value={form.default_leave_time} onChange={(e) => setForm({ ...form, default_leave_time: e.target.value })}
              className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.can_leave_alone} onChange={(e) => setForm({ ...form, can_leave_alone: e.target.checked })} />
            Må gå hjem alene
          </label>
          <div className="md:col-span-2">
            <button disabled={uploader} className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
              {uploader && <Loader2 className="h-4 w-4 animate-spin" />}
              Gem {terms.deltager}
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-2">
        {list.map((b) => (
          <BarnRaekke key={b.id} barn={b} onOpen={() => setDetaljeId(b.id)} onSlet={() => slet(b.id)} />
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground">Ingen {terms.deltagere} endnu.</p>}
      </div>

      <BarnDetalje barnId={detaljeId} open={!!detaljeId} onClose={() => { setDetaljeId(null); indlaes(); }} />
    </div>
  );
}

function Felt({ label, v, on }: { label: string; v: string; on: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input value={v} onChange={(e) => on(e.target.value)}
        className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" />
    </div>
  );
}

function BarnRaekke({ barn, onOpen, onSlet }: { barn: any; onOpen: () => void; onSlet: () => void }) {
  const fotoUrl = useChildPhoto(barn.photo_url);
  return (
    <div className="glass flex items-center justify-between rounded-xl p-3">
      <button onClick={onOpen} className="flex flex-1 items-center gap-3 text-left">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface ring-1 ring-border">
          {barn.photo_url && fotoUrl ? <img src={fotoUrl} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div>
          <p className="font-semibold">{barn.full_name}</p>
          <p className="text-xs text-muted-foreground">{barn.categories?.name ?? "Ingen kategori"}</p>
        </div>
      </button>
      <button onClick={onSlet} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

// ===== PERSONALE =====
function PersonalePanel({ orgId }: { orgId: string }) {
  const [list, setList] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [vagter, setVagter] = useState<any[]>([]);
  const [opretterInvite, setOpretterInvite] = useState(false);
  const [nyRolle, setNyRolle] = useState<"employee" | "admin">("employee");
  const dato = new Date().toISOString().slice(0, 10);

  const indlaes = useCallback(async () => {
    const [m, i, v] = await Promise.all([
      supabase.from("organization_members")
        .select("id, role, status, user_id")
        .eq("organization_id", orgId),
      supabase.from("organization_invites")
        .select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      supabase.from("employee_time_logs")
        .select("*")
        .eq("organization_id", orgId).eq("date", dato),
    ]);
    const medlemmer = m.data ?? [];
    // Hent profiler separat (ingen FK i schemaet) — slå op via id IN (...)
    const userIds = Array.from(new Set([
      ...medlemmer.map((x: any) => x.user_id),
      ...(v.data ?? []).map((x: any) => x.user_id),
    ])).filter(Boolean);
    let profileMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profs } = await supabase.from("profiles")
        .select("id, full_name, email").in("id", userIds);
      for (const p of profs ?? []) profileMap[p.id] = { full_name: p.full_name, email: p.email };
    }
    setList(medlemmer.map((x: any) => ({ ...x, profiles: profileMap[x.user_id] ?? null })));
    setInvites(i.data ?? []);
    setVagter((v.data ?? []).map((x: any) => ({ ...x, profiles: profileMap[x.user_id] ?? null })));
  }, [orgId, dato]);
  useEffect(() => { indlaes(); }, [indlaes]);

  // Realtime: opdater når nye medlemmer/invites tilføjes
  useEffect(() => {
    const ch = supabase.channel(`admin-personale-${orgId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "organization_members", filter: `organization_id=eq.${orgId}` }, () => indlaes())
      .on("postgres_changes", { event: "*", schema: "public", table: "organization_invites", filter: `organization_id=eq.${orgId}` }, () => indlaes())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId, indlaes]);

  const fjern = async (id: string) => {
    if (!confirm("Fjern denne person fra organisationen?")) return;
    const { error } = await supabase.from("organization_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    indlaes();
  };

  const skiftRolle = async (m: any) => {
    const ny = m.role === "admin" ? "employee" : "admin";
    const { error } = await supabase.from("organization_members").update({ role: ny }).eq("id", m.id);
    if (error) return toast.error(error.message);
    indlaes();
  };

  const genererKode = () => {
    const tegn = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    // CSPRNG; rejection-sampling for at undgå modulo-bias
    const ud = new Array<string>(10);
    const buf = new Uint8Array(64);
    let i = 0;
    while (i < 10) {
      crypto.getRandomValues(buf);
      for (let j = 0; j < buf.length && i < 10; j++) {
        const b = buf[j];
        if (b < 256 - (256 % tegn.length)) {
          ud[i++] = tegn[b % tegn.length];
        }
      }
    }
    return ud.join("");
  };

  const opretInvite = async () => {
    setOpretterInvite(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setOpretterInvite(false); return; }
    const code = genererKode();
    const { error } = await supabase.from("organization_invites").insert({
      organization_id: orgId, code, role: nyRolle, created_by: user.id,
    });
    setOpretterInvite(false);
    if (error) return toast.error(error.message);
    toast.success("Kode oprettet", { description: code });
    indlaes();
  };

  const sletInvite = async (id: string) => {
    const { error } = await supabase.from("organization_invites").delete().eq("id", id);
    if (error) return toast.error(error.message);
    indlaes();
  };

  const kopier = async (kode: string) => {
    try {
      await navigator.clipboard.writeText(kode);
      toast.success("Kopieret");
    } catch {
      toast.error("Kunne ikke kopiere");
    }
  };

  const aktiveInvites = invites.filter((i) => !i.used_at && new Date(i.expires_at) > new Date());

  const formaterTimer = (v: any) => {
    if (!v.shift_started_at) return "–";
    const start = new Date(v.shift_started_at).getTime();
    const slut = v.shift_ended_at ? new Date(v.shift_ended_at).getTime() : Date.now();
    const min = Math.max(0, Math.round((slut - start) / 60000) - (v.total_break_minutes ?? 0));
    return `${Math.floor(min / 60)}t ${min % 60}m`;
  };

  return (
    <div className="space-y-6">
      {/* Invite-koder */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Inviter personale</h2>
        <div className="glass flex flex-wrap items-center gap-2 rounded-2xl p-4">
          <select value={nyRolle} onChange={(e) => setNyRolle(e.target.value as any)}
            className="rounded-xl border border-input bg-background px-3 py-2 text-sm">
            <option value="employee">Personale</option>
            <option value="admin">Admin</option>
          </select>
          <button disabled={opretterInvite} onClick={opretInvite}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50">
            <Plus className="h-4 w-4" /> Generér invitations-kode
          </button>
          <p className="text-xs text-muted-foreground">Koder er gyldige i 14 dage.</p>
        </div>

        {aktiveInvites.length > 0 && (
          <div className="grid gap-2">
            {aktiveInvites.map((i) => (
              <div key={i.id} className="glass flex items-center justify-between gap-3 rounded-xl p-3">
                <div className="min-w-0">
                  <button onClick={() => kopier(i.code)}
                    className="font-mono text-lg font-bold tracking-widest text-primary hover:underline">
                    {i.code}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {i.role === "admin" ? "Admin" : "Personale"} · udløber {new Date(i.expires_at).toLocaleDateString("da-DK")}
                  </p>
                </div>
                <button onClick={() => sletInvite(i.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Medlemmer */}
      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">Medlemmer</h2>
        <div className="grid gap-2">
          {list.map((m) => {
            const vagt = vagter.find((v) => v.user_id === m.user_id);
            return (
              <div key={m.id} className="glass flex items-center justify-between rounded-xl p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{m.profiles?.full_name ?? m.profiles?.email ?? m.user_id}</p>
                  <p className="text-xs text-muted-foreground">{m.profiles?.email}</p>
                  <p className="mt-1 text-xs">
                    {!vagt && <span className="text-muted-foreground">Ikke startet i dag</span>}
                    {vagt?.status === "working" && <span className="text-success">På vagt · {formaterTimer(vagt)}</span>}
                    {vagt?.status === "on_break" && <span className="text-warning">På pause</span>}
                    {vagt?.status === "finished" && <span className="text-muted-foreground">Afsluttet · {formaterTimer(vagt)}</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => skiftRolle(m)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium ${m.role === "admin" ? "bg-accent/20 text-accent" : "bg-surface text-muted-foreground"}`}>
                    {m.role === "admin" ? "Admin" : "Personale"}
                  </button>
                  <button onClick={() => fjern(m.id)} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <p className="text-sm text-muted-foreground">Ingen medlemmer endnu.</p>}
        </div>
      </section>
    </div>
  );
}

// ===== AKTIVITETSLOG =====
const TABEL_NAVNE: Record<string, string> = {
  children: "Barn",
  organization_members: "Personale",
  organization_invites: "Invitation",
  day_status: "Dagsstatus",
  organizations: "Organisation",
  profiles: "Profil",
};

const HANDLING_FARVE: Record<string, string> = {
  INSERT: "bg-success/15 text-success",
  UPDATE: "bg-warning/15 text-warning",
  DELETE: "bg-destructive/15 text-destructive",
};

const HANDLING_LABEL: Record<string, string> = {
  INSERT: "Oprettet",
  UPDATE: "Ændret",
  DELETE: "Slettet",
};

function formaterTidspunkt(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("da-DK", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function AuditLogPanel({ orgId }: { orgId: string }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [profiler, setProfiler] = useState<Record<string, { full_name: string | null; email: string | null }>>({});
  const [loading, setLoading] = useState(true);

  const indlaes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, created_at, action, table_name, record_id, changed_fields, user_id")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) { toast.error("Kunne ikke hente log: " + error.message); setLoading(false); return; }

    const entries = data ?? [];
    setLogs(entries);

    // Fetch profiles for unique user_ids
    const userIds = [...new Set(entries.map((e: any) => e.user_id).filter(Boolean))];
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      const map: Record<string, any> = {};
      for (const p of profs ?? []) map[p.id] = p;
      setProfiler(map);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { indlaes(); }, [indlaes]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-bold">Aktivitetslog</h2>
        </div>
        <button
          onClick={indlaes}
          className="rounded-xl bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-surface-elevated hover:text-foreground"
        >
          Opdater
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Viser de seneste 200 hændelser for denne organisation. Loggen er skrivebeskyttet og kan ikke slettes.
      </p>

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && logs.length === 0 && (
        <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
          Ingen log-hændelser endnu. Log fyldes automatisk op, når data oprettes, ændres eller slettes.
        </div>
      )}

      {!loading && logs.length > 0 && (
        <div className="space-y-1.5">
          {logs.map((log) => {
            const profil = log.user_id ? profiler[log.user_id] : null;
            const visNavn = profil?.full_name ?? profil?.email ?? "System";
            const tabelNavn = TABEL_NAVNE[log.table_name] ?? log.table_name;
            return (
              <div key={log.id} className="glass flex flex-wrap items-start gap-3 rounded-xl p-3 text-sm">
                {/* Timestamp */}
                <span className="w-36 shrink-0 text-xs text-muted-foreground">
                  {formaterTidspunkt(log.created_at)}
                </span>

                {/* Action badge */}
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${HANDLING_FARVE[log.action] ?? "bg-surface text-muted-foreground"}`}>
                  {HANDLING_LABEL[log.action] ?? log.action}
                </span>

                {/* Table */}
                <span className="shrink-0 font-medium">{tabelNavn}</span>

                {/* Changed fields (UPDATE only) */}
                {log.changed_fields?.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({log.changed_fields.join(", ")})
                  </span>
                )}

                {/* Spacer */}
                <span className="flex-1" />

                {/* Who */}
                <span className="text-xs text-muted-foreground">{visNavn}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ===== TJEK IND =====
function QrCodeDisplay({ code, locationName }: { code: string; locationName: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    import("qrcode").then((QRCode) => {
      QRCode.default
        .toDataURL(`https://tilstede.live/checkin/${code}`, { width: 220, margin: 2 })
        .then(setDataUrl);
    });
  }, [code]);

  const downloadPng = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${locationName}-qr.png`;
    a.click();
  };

  const downloadPdf = async () => {
    const QRCode = await import("qrcode");
    const url = `https://tilstede.live/checkin/${code}`;
    const imgData = await QRCode.default.toDataURL(url, { width: 400, margin: 2 });
    const { default: jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: "a5" });
    pdf.setFontSize(18);
    pdf.setFont("helvetica", "bold");
    pdf.text(locationName, 74, 30, { align: "center" });
    pdf.addImage(imgData, "PNG", 24, 40, 100, 100);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.text("Scan for at tjekke ind / ud", 74, 148, { align: "center" });
    pdf.setFontSize(9);
    pdf.setTextColor(120, 120, 120);
    pdf.text(url, 74, 155, { align: "center" });
    pdf.save(`${locationName}-tjek-ind.pdf`);
  };

  if (!dataUrl) return <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="flex flex-col items-center gap-2">
      <img src={dataUrl} alt={`QR ${locationName}`} className="rounded-lg" width={110} height={110} />
      <div className="flex gap-2">
        <button onClick={downloadPng} className="flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Download className="h-3 w-3" /> PNG
        </button>
        <button onClick={downloadPdf} className="flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Download className="h-3 w-3" /> PDF
        </button>
      </div>
    </div>
  );
}

function PinModal({ location, onClose, onSaved }: { location: QrLocation; onClose: () => void; onSaved: () => void }) {
  const [pin, setPin] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!/^\d{4,6}$/.test(pin)) { toast.error("PIN skal være 4-6 cifre."); return; }
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session udløbet.");
      await setLocationPin({ data: { accessToken: session.access_token, locationId: location.id, pin } });
      toast.success("PIN gemt.");
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke gemme PIN.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="glass w-full max-w-sm rounded-2xl p-6 shadow-card">
        <h3 className="font-display text-lg font-bold mb-1">Sæt PIN</h3>
        <p className="text-sm text-muted-foreground mb-4">{location.location_name}</p>
        <div className="relative">
          <input
            type={show ? "text" : "password"}
            inputMode="numeric"
            pattern="[0-9]*"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="4-6 cifre"
            className="w-full rounded-xl border border-input bg-background px-4 py-2.5 font-mono text-xl tracking-widest focus:border-ring focus:outline-none pr-10"
          />
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium">Annuller</button>
          <button
            onClick={handleSave}
            disabled={loading || pin.length < 4}
            className="flex-1 rounded-xl bg-gradient-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            {loading ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Gem PIN"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CheckinPanel({ orgId }: { orgId: string }) {
  const [subTab, setSubTab] = useState<"lokationer" | "oversigt">("lokationer");
  const [locations, setLocations] = useState<QrLocation[]>([]);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [pinModal, setPinModal] = useState<QrLocation | null>(null);
  const [checkins, setCheckins] = useState<StaffCheckin[]>([]);
  const [checkinsLoading, setCheckinsLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const loadLocations = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("location_qr_codes")
      .select("id, code, location_name, pin_hash, pin_updated_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at");
    setLocations((data ?? []) as QrLocation[]);
  }, [orgId]);

  const loadCheckins = useCallback(async () => {
    setCheckinsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const result = await getOrgCheckins({
        data: {
          accessToken: session.access_token,
          orgId,
          from: fromDate ? new Date(fromDate).toISOString() : undefined,
          to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
        },
      });
      setCheckins(result);
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke hente tjek-ind oversigt.");
    } finally {
      setCheckinsLoading(false);
    }
  }, [orgId, fromDate, toDate]);

  useEffect(() => { loadLocations(); }, [loadLocations]);
  useEffect(() => { if (subTab === "oversigt") loadCheckins(); }, [subTab, loadCheckins]);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session udløbet.");
      await generateQrLocation({ data: { accessToken: session.access_token, orgId, locationName: newName.trim() } });
      setNewName("");
      loadLocations();
      toast.success("Lokation oprettet.");
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke oprette lokation.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (loc: QrLocation) => {
    if (!confirm(`Slet "${loc.location_name}"? Alle tjek-ind tilknyttet lokationen mister lokationsreferencen.`)) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session udløbet.");
      await deleteQrLocation({ data: { accessToken: session.access_token, locationId: loc.id } });
      loadLocations();
      toast.success("Lokation slettet.");
    } catch (err: any) {
      toast.error(err?.message ?? "Kunne ikke slette lokation.");
    }
  };

  const handleExportCSV = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session udløbet.");
      const { csv } = await exportCheckinsCSV({
        data: {
          accessToken: session.access_token,
          orgId,
          from: fromDate ? new Date(fromDate).toISOString() : undefined,
          to: toDate ? new Date(toDate + "T23:59:59").toISOString() : undefined,
        },
      });
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tjek-ind-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err?.message ?? "Eksport fejlede.");
    }
  };

  const fmtDuration = (inAt: string, outAt: string | null) => {
    if (!outAt) return "—";
    const min = Math.round((new Date(outAt).getTime() - new Date(inAt).getTime()) / 60000);
    if (min < 60) return `${min} min`;
    return `${Math.floor(min / 60)}t ${min % 60}m`;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["lokationer", "oversigt"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${subTab === t ? "bg-gradient-primary text-primary-foreground shadow-soft" : "bg-surface text-muted-foreground hover:text-foreground"}`}
          >
            {t === "lokationer" ? "QR-lokationer" : "Oversigt"}
          </button>
        ))}
      </div>

      {subTab === "lokationer" && (
        <div className="space-y-4">
          <form onSubmit={handleCreate} className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ny lokation (f.eks. Indgang)"
              className="flex-1 rounded-xl border border-input bg-background px-4 py-2.5 text-sm focus:border-ring focus:outline-none"
            />
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Opret
            </button>
          </form>

          {locations.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Ingen QR-lokationer endnu. Opret en ovenfor.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {locations.map((loc) => (
              <div key={loc.id} className="glass rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{loc.location_name}</p>
                    <p className="font-mono text-xs text-muted-foreground mt-0.5">{loc.code}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPinModal(loc)}
                      title="Sæt PIN"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-muted-foreground hover:text-foreground"
                    >
                      <KeySquare className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(loc)}
                      title="Slet"
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {loc.pin_hash ? (
                    <span className="flex items-center gap-1 text-success"><CheckCircle2 className="h-3 w-3" /> PIN opsat</span>
                  ) : (
                    <span className="text-amber-500">Ingen PIN</span>
                  )}
                </div>

                <QrCodeDisplay code={loc.code} locationName={loc.location_name} />
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "oversigt" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Fra</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Til</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none"
              />
            </div>
            <button
              onClick={loadCheckins}
              className="rounded-xl bg-surface px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Hent
            </button>
            <button
              onClick={handleExportCSV}
              className="ml-auto inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              <Download className="h-4 w-4" /> Eksporter CSV
            </button>
          </div>

          {checkinsLoading && (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!checkinsLoading && checkins.length === 0 && (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              Ingen tjek-ind registreret for den valgte periode.
            </div>
          )}

          {!checkinsLoading && checkins.length > 0 && (
            <div className="glass overflow-hidden rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                      <th className="px-4 py-3">Navn</th>
                      <th className="px-4 py-3">Lokation</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Tjek ind</th>
                      <th className="px-4 py-3">Tjek ud</th>
                      <th className="px-4 py-3">Varighed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {checkins.map((c) => (
                      <tr key={c.id} className="hover:bg-surface/50">
                        <td className="px-4 py-3 font-medium">{c.user?.full_name ?? c.user?.email ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.location?.location_name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium">
                            {c.checkin_type === "qr" ? "QR" : "PIN"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(c.checked_in_at).toLocaleString("da-DK", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {c.checked_out_at
                            ? new Date(c.checked_out_at).toLocaleString("da-DK", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                            : <span className="text-success text-xs font-medium">Aktiv</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtDuration(c.checked_in_at, c.checked_out_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {pinModal && (
        <PinModal
          location={pinModal}
          onClose={() => setPinModal(null)}
          onSaved={loadLocations}
        />
      )}
    </div>
  );
}
