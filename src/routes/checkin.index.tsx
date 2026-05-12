import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckCircle2, Loader2, KeySquare, MapPin, ChevronDown,
  LogIn, LogOut, Clock, Play, Coffee, Square, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { pinCheckin, directCheckin, type QrLocation } from "@/server/checkin.functions";

export const Route = createFileRoute("/checkin/")({
  component: CheckinPage,
});

type OpenCheckin = {
  id: string;
  checked_in_at: string;
  on_break_since: string | null;
  location_name: string | null;
};

function CheckinPage() {
  const { aktivOrgId } = useOrg();
  const { flags } = useFeatureFlags();

  if (flags.checkin_method === "button") {
    return <ButtonCheckinPage />;
  }
  return <PinCheckinPage />;
}

// ── Knap-mode (Start Vagt / Pause / Slut Vagt) ────────────────────────────────

type ButtonState = "loading" | "idle" | "submitting";

function ButtonCheckinPage() {
  const { aktivOrgId } = useOrg();
  const runDirect = useServerFn(directCheckin);
  const [state, setState] = useState<ButtonState>("loading");
  const [openCheckin, setOpenCheckin] = useState<OpenCheckin | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [dayClosed, setDayClosed] = useState(false);

  const loadStatus = useCallback(async () => {
    setState("loading");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setState("idle"); return; }

    setUserName(
      session.user.user_metadata?.full_name
        ? session.user.user_metadata.full_name
        : session.user.email?.split("@")[0] ?? null
    );

    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(); today.setHours(0, 0, 0, 0);

    if (aktivOrgId) {
      const { data: ds } = await supabase
        .from("day_status").select("is_closed")
        .eq("organization_id", aktivOrgId).eq("date", todayStr).maybeSingle();
      setDayClosed(!!ds?.is_closed);
    }

    const { data: checkin } = await (supabase as any)
      .from("staff_checkins")
      .select("id, checked_in_at, on_break_since, location:location_qr_codes(location_name)")
      .eq("user_id", session.user.id)
      .is("checked_out_at", null)
      .gte("checked_in_at", today.toISOString())
      .maybeSingle();

    setOpenCheckin(
      checkin
        ? {
            id: checkin.id,
            checked_in_at: checkin.checked_in_at,
            on_break_since: checkin.on_break_since ?? null,
            location_name: checkin.location?.location_name ?? null,
          }
        : null,
    );
    setState("idle");
  }, [aktivOrgId]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const doAction = async (action: "start_vagt" | "start_pause" | "slut_pause" | "slut_vagt") => {
    if (!aktivOrgId) { toast.error("Ingen organisation valgt."); return; }
    setState("submitting");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session udløbet.");
      await runDirect({ data: { accessToken: session.access_token, orgId: aktivOrgId, action } });
      const labels: Record<string, string> = {
        start_vagt: "Vagt startet!",
        start_pause: "Pause startet.",
        slut_pause: "Pause slut — god arbejdslyst!",
        slut_vagt: "Vagt afsluttet.",
      };
      toast.success(labels[action]);
      await loadStatus();
    } catch (err: any) {
      toast.error(err?.message ?? "Noget gik galt.");
      setState("idle");
    }
  };

  if (state === "loading") {
    return (
      <div className="flex min-h-[85vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isWorking = !!openCheckin;
  const onBreak = !!openCheckin?.on_break_since;
  const sinceTime = openCheckin
    ? new Date(openCheckin.checked_in_at).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })
    : null;
  const breakSince = openCheckin?.on_break_since
    ? new Date(openCheckin.on_break_since).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-3xl p-8 shadow-card fade-in">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${
            onBreak ? "bg-amber-500/15" :
            isWorking ? "bg-success/15" : "bg-primary/10"
          }`}>
            {onBreak
              ? <Coffee className="h-8 w-8 text-amber-500" />
              : isWorking
              ? <Play className="h-8 w-8 text-success" />
              : <Square className="h-8 w-8 text-primary" />}
          </div>
          <h1 className="font-display text-2xl font-bold">
            {onBreak ? "På pause" : isWorking ? "Vagt aktiv" : "Klar til vagt"}
          </h1>
          {userName && <p className="mt-1 text-sm text-muted-foreground">Hej, {userName}</p>}
          {isWorking && sinceTime && (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              {onBreak ? `Pause siden ${breakSince}` : `Arbejder siden ${sinceTime}`}
            </p>
          )}
        </div>

        {dayClosed && !isWorking && (
          <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Dagen er afsluttet</p>
          </div>
        )}

        {/* Action buttons */}
        <div className="space-y-3">
          {!isWorking && (
            <button
              disabled={state === "submitting" || (dayClosed)}
              onClick={() => doAction("start_vagt")}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-primary py-4 text-base font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
            >
              {state === "submitting"
                ? <Loader2 className="h-5 w-5 animate-spin" />
                : <><Play className="h-5 w-5" /> Start Vagt</>}
            </button>
          )}

          {isWorking && !onBreak && (
            <>
              <button
                disabled={state === "submitting"}
                onClick={() => doAction("start_pause")}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 py-4 text-base font-semibold text-amber-700 transition hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-400"
              >
                {state === "submitting"
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <><Coffee className="h-5 w-5" /> Start Pause</>}
              </button>
              <button
                disabled={state === "submitting"}
                onClick={() => doAction("slut_vagt")}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 py-4 text-base font-semibold text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
              >
                {state === "submitting"
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <><Square className="h-5 w-5" /> Slut Vagt</>}
              </button>
            </>
          )}

          {isWorking && onBreak && (
            <>
              <button
                disabled={state === "submitting"}
                onClick={() => doAction("slut_pause")}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-primary py-4 text-base font-semibold text-primary-foreground shadow-glow transition hover:opacity-90 disabled:opacity-50"
              >
                {state === "submitting"
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <><RefreshCw className="h-5 w-5" /> Fortsæt Vagt</>}
              </button>
              <button
                disabled={state === "submitting"}
                onClick={() => doAction("slut_vagt")}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 py-4 text-base font-semibold text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
              >
                {state === "submitting"
                  ? <Loader2 className="h-5 w-5 animate-spin" />
                  : <><Square className="h-5 w-5" /> Slut Vagt</>}
              </button>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          {new Date().toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>
    </div>
  );
}

// ── PIN-mode (existing) ───────────────────────────────────────────────────────

type PinPageState = "loading" | "idle" | "submitting" | "done_checkin" | "done_checkout" | "error";

function PinCheckinPage() {
  const { aktivOrgId } = useOrg();
  const [locations, setLocations] = useState<QrLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [pageState, setPageState] = useState<PinPageState>("loading");
  const [openCheckin, setOpenCheckin] = useState<{ id: string; checked_in_at: string; location_name: string | null } | null>(null);
  const [doneLocation, setDoneLocation] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [dayClosed, setDayClosed] = useState(false);

  const loadStatus = useCallback(async () => {
    setPageState("loading");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setPageState("idle"); return; }
    setUserName(
      session.user.user_metadata?.full_name
        ? session.user.user_metadata.full_name
        : session.user.email?.split("@")[0] ?? null
    );
    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    if (aktivOrgId) {
      const { data: ds } = await supabase.from("day_status").select("is_closed")
        .eq("organization_id", aktivOrgId).eq("date", todayStr).maybeSingle();
      setDayClosed(!!ds?.is_closed);
    }
    const { data: checkin } = await (supabase as any)
      .from("staff_checkins")
      .select("id, checked_in_at, location:location_qr_codes(location_name)")
      .eq("user_id", session.user.id)
      .is("checked_out_at", null)
      .gte("checked_in_at", today.toISOString())
      .maybeSingle();
    setOpenCheckin(
      checkin ? { id: checkin.id, checked_in_at: checkin.checked_in_at, location_name: checkin.location?.location_name ?? null } : null,
    );
    setPageState("idle");
  }, [aktivOrgId]);

  const loadLocations = useCallback(async () => {
    if (!aktivOrgId) return;
    const { data } = await (supabase as any)
      .from("location_qr_codes")
      .select("id, code, location_name, pin_hash, pin_updated_at, created_at")
      .eq("organization_id", aktivOrgId)
      .not("pin_hash", "is", null)
      .order("location_name");
    const locs = (data ?? []) as QrLocation[];
    setLocations(locs);
    if (locs.length > 0 && !selectedId) setSelectedId(locs[0].id);
  }, [aktivOrgId, selectedId]);

  useEffect(() => { loadStatus(); loadLocations(); }, [loadStatus, loadLocations]);

  const handlePinDigit = (digit: string) => { if (pin.length < 6) setPin((p) => p + digit); };
  const handleDelete = () => setPin((p) => p.slice(0, -1));

  const handleSubmit = async () => {
    if (!selectedId || pin.length < 4) return;
    setPageState("submitting");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session udløbet. Log ind igen.");
      const result = await pinCheckin({ data: { accessToken: session.access_token, locationId: selectedId, pin } });
      setDoneLocation(result.locationName);
      setPageState(result.action === "checkin" ? "done_checkin" : "done_checkout");
      setPin("");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Noget gik galt. Prøv igen.");
      setPageState("error");
      setPin("");
    }
  };

  if (pageState === "loading") {
    return (
      <div className="flex min-h-[85vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pageState === "done_checkin" || pageState === "done_checkout") {
    const isIn = pageState === "done_checkin";
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4">
        <div className="glass w-full max-w-sm rounded-3xl p-10 text-center fade-in">
          <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl ${isIn ? "bg-success/15" : "bg-amber-500/15"}`}>
            <CheckCircle2 className={`h-10 w-10 ${isIn ? "text-success" : "text-amber-500"}`} />
          </div>
          <h1 className="font-display text-2xl font-bold">{isIn ? "Tjekket ind ✓" : "Tjekket ud ✓"}</h1>
          {doneLocation && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {doneLocation}
            </div>
          )}
          {userName && <p className="mt-4 text-muted-foreground">{userName}</p>}
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button onClick={() => { loadStatus(); setDoneLocation(null); }}
            className="mt-8 w-full rounded-xl bg-gradient-primary py-3 font-semibold text-primary-foreground shadow-glow">
            Opdater status
          </button>
        </div>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4">
        <div className="glass w-full max-w-sm rounded-3xl p-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/15">
            <span className="text-4xl">⚠️</span>
          </div>
          <h1 className="font-display text-xl font-bold">Noget gik galt</h1>
          <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
          <button onClick={() => { loadStatus(); setErrorMsg(null); }}
            className="mt-6 w-full rounded-xl bg-gradient-primary py-3 font-semibold text-primary-foreground">
            Prøv igen
          </button>
        </div>
      </div>
    );
  }

  if (locations.length === 0 && aktivOrgId) {
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4">
        <div className="glass w-full max-w-sm rounded-3xl p-10 text-center">
          <KeySquare className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="font-display text-xl font-bold">Ingen PIN-lokationer</h1>
          <p className="mt-2 text-sm text-muted-foreground">Din administrator har ikke sat en PIN op endnu.</p>
        </div>
      </div>
    );
  }

  const isCheckedIn = openCheckin !== null;

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-3xl p-8">
        {isCheckedIn && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-success/10 px-4 py-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-success/20">
              <LogIn className="h-4 w-4 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-success">Tjekket ind</p>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                {openCheckin.location_name && <><MapPin className="h-3 w-3" />{openCheckin.location_name} · </>}
                <Clock className="h-3 w-3" />
                siden {new Date(openCheckin.checked_in_at).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 text-center">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl ${isCheckedIn ? "bg-amber-500/10" : "bg-primary/10"}`}>
            {isCheckedIn ? <LogOut className="h-8 w-8 text-amber-500" /> : <KeySquare className="h-8 w-8 text-primary" />}
          </div>
          <h1 className="font-display text-2xl font-bold">{isCheckedIn ? "Tjek ud" : "Tjek ind"}</h1>
          {userName && <p className="mt-1 text-sm text-muted-foreground">Hej, {userName}</p>}
        </div>

        {locations.length > 1 && (
          <div className="relative mb-5">
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-input bg-background py-2.5 pl-4 pr-9 text-sm focus:border-ring focus:outline-none">
              {locations.map((l) => <option key={l.id} value={l.id}>{l.location_name}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        )}
        {locations.length === 1 && (
          <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" /> {locations[0].location_name}
          </div>
        )}

        <div className="mb-6 flex justify-center gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={`h-3 w-3 rounded-full transition-all ${i < pin.length ? "scale-125 bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {["1","2","3","4","5","6","7","8","9"].map((d) => (
            <button key={d} onClick={() => handlePinDigit(d)} disabled={pageState === "submitting"}
              className="flex h-14 items-center justify-center rounded-xl border border-border bg-surface text-xl font-semibold transition hover:bg-muted active:scale-95 disabled:opacity-50">
              {d}
            </button>
          ))}
          <button onClick={handleDelete} disabled={pageState === "submitting" || pin.length === 0}
            className="flex h-14 items-center justify-center rounded-xl border border-border bg-surface text-sm text-muted-foreground transition hover:bg-muted disabled:opacity-30">
            ⌫
          </button>
          <button onClick={() => handlePinDigit("0")} disabled={pageState === "submitting"}
            className="flex h-14 items-center justify-center rounded-xl border border-border bg-surface text-xl font-semibold transition hover:bg-muted active:scale-95 disabled:opacity-50">
            0
          </button>
          <button onClick={handleSubmit} disabled={pageState === "submitting" || pin.length < 4 || !selectedId || (dayClosed && !isCheckedIn)}
            className={`flex h-14 items-center justify-center rounded-xl text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
              isCheckedIn ? "bg-amber-500 hover:bg-amber-600" : "bg-gradient-primary shadow-glow"
            }`}>
            {pageState === "submitting" ? <Loader2 className="h-5 w-5 animate-spin" /> : isCheckedIn ? "Ud" : "Ind"}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {dayClosed && !isCheckedIn ? "Dagen er lukket — tjek ind er ikke tilgængeligt" : isCheckedIn ? "Indtast PIN for at registrere udtjekning" : "Indtast lokationens PIN-kode"}
        </p>
      </div>
    </div>
  );
}
