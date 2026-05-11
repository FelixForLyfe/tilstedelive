import { createFileRoute, useParams } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LogIn, LogOut, Loader2, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qrCheckin } from "@/server/checkin.functions";

export const Route = createFileRoute("/checkin/$code")({
  component: QrCheckinPage,
});

type PageState = "loading" | "idle" | "submitting" | "done_checkin" | "done_checkout" | "error";

type OpenCheckin = {
  id: string;
  checked_in_at: string;
  location_name: string | null;
};

function QrCheckinPage() {
  const { code } = useParams({ from: "/checkin/$code" });
  const [pageState, setPageState] = useState<PageState>("loading");
  const [openCheckin, setOpenCheckin] = useState<OpenCheckin | null>(null);
  const [doneLocation, setDoneLocation] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [dayClosed, setDayClosed] = useState(false);

  const loadStatus = useCallback(async () => {
    setPageState("loading");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setPageState("idle"); return; }

    setUserId(session.user.id);
    if (session.user.user_metadata?.full_name) {
      setUserName(session.user.user_metadata.full_name);
    } else if (session.user.email) {
      setUserName(session.user.email.split("@")[0]);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Resolve org from QR code and check day status
    const { data: loc } = await (supabase as any)
      .from("location_qr_codes")
      .select("organization_id")
      .eq("code", code)
      .maybeSingle();
    if (loc?.organization_id) {
      const { data: ds } = await supabase
        .from("day_status")
        .select("is_closed")
        .eq("organization_id", loc.organization_id)
        .eq("date", todayStr)
        .maybeSingle();
      setDayClosed(!!ds?.is_closed);
    }

    const { data } = await (supabase as any)
      .from("staff_checkins")
      .select("id, checked_in_at, location:location_qr_codes(location_name)")
      .eq("user_id", session.user.id)
      .is("checked_out_at", null)
      .gte("checked_in_at", today.toISOString())
      .maybeSingle();

    setOpenCheckin(
      data
        ? { id: data.id, checked_in_at: data.checked_in_at, location_name: data.location?.location_name ?? null }
        : null,
    );
    setPageState("idle");
  }, [code]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleAction = async () => {
    setPageState("submitting");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session udløbet. Log ind igen.");
      const result = await qrCheckin({ data: { accessToken: session.access_token, code } });
      setDoneLocation(result.locationName);
      setPageState(result.action === "checkin" ? "done_checkin" : "done_checkout");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Noget gik galt. Prøv igen.");
      setPageState("error");
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
              <MapPin className="h-3.5 w-3.5" />
              {doneLocation}
            </div>
          )}
          {userName && <p className="mt-4 text-muted-foreground">{userName}</p>}
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button
            onClick={() => { setPageState("loading"); loadStatus(); }}
            className="mt-8 w-full rounded-xl bg-gradient-primary py-3 font-semibold text-primary-foreground shadow-glow"
          >
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
          <button
            onClick={() => { setPageState("loading"); loadStatus(); }}
            className="mt-6 w-full rounded-xl bg-gradient-primary py-3 font-semibold text-primary-foreground"
          >
            Prøv igen
          </button>
        </div>
      </div>
    );
  }

  const isCheckedIn = openCheckin !== null;

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-3xl p-10 text-center">
        {/* Status indicator */}
        <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl ${isCheckedIn ? "bg-success/15" : "bg-muted"}`}>
          {isCheckedIn ? (
            <LogOut className="h-10 w-10 text-success" />
          ) : (
            <LogIn className="h-10 w-10 text-muted-foreground" />
          )}
        </div>

        {isCheckedIn ? (
          <>
            <h1 className="font-display text-2xl font-bold">Du er tjekket ind</h1>
            {openCheckin.location_name && (
              <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                {openCheckin.location_name}
              </div>
            )}
            <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              siden {new Date(openCheckin.checked_in_at).toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
            </div>
            {userName && <p className="mt-4 text-muted-foreground">{userName}</p>}
            <button
              onClick={handleAction}
              disabled={pageState === "submitting"}
              className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-4 text-lg font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-50"
            >
              {pageState === "submitting" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <>
                  <LogOut className="h-5 w-5" />
                  Tjek ud
                </>
              )}
            </button>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold">Tjek ind</h1>
            {userName && <p className="mt-2 text-muted-foreground">Hej, {userName}</p>}
            <p className="mt-4 text-sm text-muted-foreground">
              Du er ikke tjekket ind i dag.
            </p>
            {dayClosed ? (
              <div className="mt-8 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-5 text-center">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Dagen er lukket</p>
                <p className="mt-1 text-xs text-muted-foreground">Det er ikke muligt at tjekke ind, da dagen er afsluttet.</p>
              </div>
            ) : (
              <button
                onClick={handleAction}
                disabled={pageState === "submitting"}
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-4 text-lg font-semibold text-primary-foreground shadow-glow transition disabled:opacity-50"
              >
                {pageState === "submitting" ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <LogIn className="h-5 w-5" />
                    Tjek ind
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
