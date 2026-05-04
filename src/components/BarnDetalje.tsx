import { useEffect, useRef, useState } from "react";
import { Camera, X, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { toast } from "sonner";

type Barn = {
  id: string;
  organization_id: string;
  full_name: string;
  category_id?: string | null;
  parent_1_name?: string | null;
  parent_1_phone?: string | null;
  parent_2_name?: string | null;
  parent_2_phone?: string | null;
  address?: string | null;
  cpr_number?: string | null;
  doctor_name?: string | null;
  doctor_phone?: string | null;
  allergies?: string | null;
  special_notes?: string | null;
  default_leave_time?: string | null;
  can_leave_alone?: boolean | null;
  photo_url?: string | null;
};

export function BarnDetalje({ barnId, open, onClose }: { barnId: string | null; open: boolean; onClose: () => void }) {
  const { erAdmin } = useOrg();
  const [barn, setBarn] = useState<Barn | null>(null);
  const [uploader, setUploader] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !barnId) return;
    let aktiv = true;
    (async () => {
      const { data, error } = await supabase.from("children").select("*").eq("id", barnId).maybeSingle();
      if (!aktiv) return;
      if (error) { toast.error(error.message); return; }
      setBarn(data as Barn);
      setNoter((data as Barn)?.notes ?? "");
    })();
    return () => { aktiv = false; };
  }, [barnId, open]);

  if (!open) return null;

  const gemNoter = async () => {
    if (!barn) return;
    setGemmer(true);
    const { error } = await supabase.from("children").update({ notes: noter }).eq("id", barn.id);
    setGemmer(false);
    if (error) return toast.error(error.message);
    toast.success("Note gemt");
    setBarn({ ...barn, notes: noter });
  };

  const uploadFoto = async (fil: File) => {
    if (!barn) return;
    setUploader(true);
    const ext = fil.name.split(".").pop()?.toLowerCase() || "jpg";
    const sti = `${barn.organization_id}/${barn.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("child-photos").upload(sti, fil, { upsert: true, contentType: fil.type });
    if (upErr) { setUploader(false); return toast.error(upErr.message); }
    const { data: pub } = supabase.storage.from("child-photos").getPublicUrl(sti);
    const url = pub.publicUrl;
    const { error: updErr } = await supabase.from("children").update({ photo_url: url }).eq("id", barn.id);
    setUploader(false);
    if (updErr) return toast.error(updErr.message);
    setBarn({ ...barn, photo_url: url });
    toast.success("Billede gemt");
  };

  const fjernFoto = async () => {
    if (!barn || !barn.photo_url) return;
    if (!confirm("Fjern billede?")) return;
    const { error } = await supabase.from("children").update({ photo_url: null }).eq("id", barn.id);
    if (error) return toast.error(error.message);
    setBarn({ ...barn, photo_url: null });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="glass max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/50 bg-surface/80 p-4 backdrop-blur">
          <h2 className="font-display text-xl font-bold">{barn?.full_name ?? "Indlæser…"}</h2>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-surface-elevated"><X className="h-5 w-5" /></button>
        </div>

        {!barn ? (
          <div className="p-10 text-center text-muted-foreground">Indlæser…</div>
        ) : (
          <div className="space-y-5 p-5">
            {/* Foto */}
            <div className="flex items-center gap-4">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-surface ring-1 ring-border">
                {barn.photo_url ? (
                  <img src={barn.photo_url} alt={barn.full_name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Camera className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFoto(f); e.target.value = ""; }} />
                <button onClick={() => fileRef.current?.click()} disabled={uploader}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">
                  {uploader ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {barn.photo_url ? "Skift billede" : "Tag/upload billede"}
                </button>
                {barn.photo_url && erAdmin && (
                  <button onClick={fjernFoto}
                    className="inline-flex items-center gap-1 rounded-xl bg-surface px-3 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4" /> Fjern
                  </button>
                )}
              </div>
            </div>

            {/* Noter */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Noter</label>
              <textarea value={noter} onChange={(e) => setNoter(e.target.value)} rows={4}
                placeholder="Tilføj en note om barnet…"
                className="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm" />
              <button onClick={gemNoter} disabled={gemmer || noter === (barn.notes ?? "")}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                {gemmer ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Gem note
              </button>
            </div>

            {/* Information */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Info l="Forælder 1" v={barn.parent_1_name} sub={barn.parent_1_phone} />
              <Info l="Forælder 2" v={barn.parent_2_name} sub={barn.parent_2_phone} />
              <Info l="Adresse" v={barn.address} />
              <Info l="CPR-nummer" v={barn.cpr_number} />
              <Info l="Læge" v={barn.doctor_name} sub={barn.doctor_phone} />
              <Info l="Standard hjemsendelse" v={barn.default_leave_time?.slice(0, 5)} />
              <Info l="Allergier" v={barn.allergies} />
              <Info l="Særlige hensyn" v={barn.special_notes} />
              <Info l="Må gå hjem alene" v={barn.can_leave_alone ? "Ja" : "Nej"} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ l, v, sub }: { l: string; v?: string | null; sub?: string | null }) {
  return (
    <div className="rounded-xl bg-surface/50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{l}</p>
      <p className="mt-0.5 text-sm">{v || <span className="text-muted-foreground">–</span>}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
