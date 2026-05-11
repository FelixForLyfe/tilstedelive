import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Lock, LockOpen, Clock, CalendarCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { dagensDato } from "@/lib/dansk";
import { toast } from "sonner";

export const Route = createFileRoute("/app/logning")({ component: Logning });

function Logning() {
  const { aktivOrgId, erAdmin } = useOrg();
  const { flags } = useFeatureFlags();
  const dato = dagensDato();
  const [dagLukket, setDagLukket] = useState(false);
  const [lukketKl, setLukketKl] = useState<string | null>(null);
  const [lukker, setLukker] = useState(false);

  const indlaes = useCallback(async () => {
    if (!aktivOrgId) return;
    const { data } = await supabase
      .from("day_status")
      .select("is_closed, closed_at")
      .eq("organization_id", aktivOrgId)
      .eq("date", dato)
      .maybeSingle();
    setDagLukket(!!data?.is_closed);
    setLukketKl(
      data?.is_closed && data.closed_at
        ? new Date(data.closed_at).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })
        : null,
    );
  }, [aktivOrgId, dato]);

  useEffect(() => { indlaes(); }, [indlaes]);

  const lukDag = async () => {
    if (!aktivOrgId) return;
    if (!confirm("Luk dagen? Personale kan ikke længere ændre fremmøde.")) return;
    setLukker(true);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("day_status").upsert(
      { organization_id: aktivOrgId, date: dato, is_closed: true, closed_by: session?.user?.id ?? null, closed_at: new Date().toISOString() },
      { onConflict: "organization_id,date" },
    );
    setLukker(false);
    if (error) return toast.error(error.message);
    toast.success("Dagen er lukket");
    indlaes();
  };

  const genaaben = async () => {
    if (!aktivOrgId) return;
    const { error } = await supabase
      .from("day_status")
      .update({ is_closed: false })
      .eq("organization_id", aktivOrgId)
      .eq("date", dato);
    if (error) return toast.error(error.message);
    toast.success("Dagen er genåbnet");
    indlaes();
  };

  // Format date for display: "Mandag d. 11. maj 2026"
  const datoVis = new Date().toLocaleDateString("da-DK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // auto_close_time comes as "22:00:00" — display as "22:00"
  const autoCloseVis = flags.auto_close_time?.slice(0, 5) ?? "22:00";

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold capitalize">{datoVis}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Dagsoversigt og lukning</p>
      </div>

      {/* Day status card */}
      <div className={`glass rounded-2xl p-6 ${dagLukket ? "border border-amber-500/30" : "border border-success/20"}`}>
        <div className="flex items-center gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${dagLukket ? "bg-amber-500/15" : "bg-success/15"}`}>
            {dagLukket
              ? <Lock className="h-6 w-6 text-amber-500" />
              : <LockOpen className="h-6 w-6 text-success" />}
          </div>
          <div>
            <p className="font-semibold">
              {dagLukket ? "Dagen er lukket" : "Dagen er åben"}
            </p>
            <p className="text-sm text-muted-foreground">
              {dagLukket
                ? lukketKl
                  ? `Lukket kl. ${lukketKl}`
                  : "Fremmøde er låst for i dag"
                : "Personale kan registrere fremmøde"}
            </p>
          </div>
        </div>
      </div>

      {/* Admin controls */}
      {erAdmin && (
        <div className="glass rounded-2xl p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CalendarCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Dagens lukning</h2>
              <p className="text-xs text-muted-foreground">
                Når dagen lukkes, kan personale ikke ændre fremmøde eller aktiviteter.
              </p>
            </div>
          </div>

          {dagLukket ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Lock className="h-4 w-4 text-amber-500" />
                Lukket{lukketKl ? ` kl. ${lukketKl}` : ""}
              </div>
              <button
                onClick={genaaben}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                <LockOpen className="h-4 w-4" /> Genåbn dagen
              </button>
            </div>
          ) : flags.auto_close_day ? (
            <div className="flex items-center gap-3 rounded-xl bg-primary/5 px-4 py-3">
              <Clock className="h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-medium">Automatisk lukning aktiveret</p>
                <p className="text-xs text-muted-foreground">
                  Dagen lukkes automatisk kl. {autoCloseVis}
                </p>
              </div>
            </div>
          ) : (
            <button
              disabled={lukker}
              onClick={lukDag}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              {lukker ? "Lukker…" : "Luk dagen"}
            </button>
          )}
        </div>
      )}

      {!erAdmin && (
        <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">
          Kontakt din administrator for at lukke eller genåbne dagen.
        </div>
      )}
    </div>
  );
}
