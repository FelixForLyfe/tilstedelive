import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, KeySquare, MapPin, ChevronDown, LogIn, LogOut, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { pinCheckin, type QrLocation } from "@/server/checkin.functions";

export const Route = createFileRoute("/checkin/")({
  component: PinCheckinPage,
});

type PageState = "loading" | "idle" | "submitting" | "done_checkin" | "done_checkout" | "error";

type OpenCheckin = {
  id: string;
  checked_in_at: string;
  location_name: string | null;
};

function PinCheckinPage() {
  const { aktivOrgId } = useOrg();
  const [locations, setLocations] = useState<QrLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [pageState, setPageState] = useState<PageState>("loading");
  const [openCheckin, setOpenCheckin] = useState<OpenCheckin | null>(null);
  const [doneLocation, setDoneLocation] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    setPageState("loading");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setPageState("idle"); return; }

    if (session.user.user_metadata?.full_name) {
      setUserName(session.user.user_metadata.full_name);
    } else if (session.user.email) {
      setUserName(session.user.email.split("@")[0]);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: checkin } = await (supabase as any)
      .from("staff_checkins")
      .select("id, checked_in_at, location:location_qr_codes(location_name)")
      .eq("user_id", session.user.id)
      .is("checked_out_at", null)
      .gte("checked_in_at", today.toISOString())
      .maybeSingle();

    setOpenCheckin(
      checkin
        ? { id: checkin.id, checked_in_at: checkin.checked_in_at, location_name: checkin.location?.location_name ?? null }
        : null,
    );
    setPageState("idle");
  }, []);

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

  useEffect(() => {
    loadStatus();
    loadLocations();
  }, [loadStatus, loadLocations]);

  const handlePinDigit = (digit: string) => {
    if (pin.length < 6) setPin((p) => p + digit);
  };

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

  const handleCheckout = async () => {
    if (!selectedId) return;
    setPageState("submitting");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Session udløbet. Log ind igen.");
      // Use the first available location's PIN flow if no PIN needed for checkout
      // Actually we need a PIN to check out too – show PIN pad
      setPageState("idle");
      toast("Indtast din PIN for at tjekke ud.");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Noget gik galt.");
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
            onClick={() => { loadStatus(); setDoneLocation(null); }}
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
            onClick={() => { loadStatus(); setErrorMsg(null); }}
            className="mt-6 w-full rounded-xl bg-gradient-primary py-3 font-semibold text-primary-foreground"
          >
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
          <p className="mt-2 text-sm text-muted-foreground">
            Din administrator har ikke sat en PIN op endnu.
          </p>
        </div>
      </div>
    );
  }

  const isCheckedIn = openCheckin !== null;

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-3xl p-8">
        {/* Current status banner */}
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
            {isCheckedIn ? (
              <LogOut className="h-8 w-8 text-amber-500" />
            ) : (
              <KeySquare className="h-8 w-8 text-primary" />
            )}
          </div>
          <h1 className="font-display text-2xl font-bold">
            {isCheckedIn ? "Tjek ud" : "Tjek ind"}
          </h1>
          {userName && <p className="mt-1 text-sm text-muted-foreground">Hej, {userName}</p>}
        </div>

        {locations.length > 1 && (
          <div className="relative mb-5">
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-input bg-background py-2.5 pl-4 pr-9 text-sm focus:border-ring focus:outline-none"
            >
              {locations.map((l) => (
                <option key={l.id} value={l.id}>{l.location_name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          </div>
        )}
        {locations.length === 1 && (
          <div className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            {locations[0].location_name}
          </div>
        )}

        {/* PIN dots */}
        <div className="mb-6 flex justify-center gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full transition-all ${i < pin.length ? "scale-125 bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => handlePinDigit(d)}
              disabled={pageState === "submitting"}
              className="flex h-14 items-center justify-center rounded-xl border border-border bg-surface text-xl font-semibold transition hover:bg-muted active:scale-95 disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleDelete}
            disabled={pageState === "submitting" || pin.length === 0}
            className="flex h-14 items-center justify-center rounded-xl border border-border bg-surface text-sm text-muted-foreground transition hover:bg-muted disabled:opacity-30"
          >
            ⌫
          </button>
          <button
            onClick={() => handlePinDigit("0")}
            disabled={pageState === "submitting"}
            className="flex h-14 items-center justify-center rounded-xl border border-border bg-surface text-xl font-semibold transition hover:bg-muted active:scale-95 disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={pageState === "submitting" || pin.length < 4 || !selectedId}
            className={`flex h-14 items-center justify-center rounded-xl text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
              isCheckedIn ? "bg-amber-500 hover:bg-amber-600" : "bg-gradient-primary shadow-glow"
            }`}
          >
            {pageState === "submitting" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isCheckedIn ? (
              "Ud"
            ) : (
              "Ind"
            )}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {isCheckedIn ? "Indtast PIN for at registrere udtjekning" : "Indtast lokationens PIN-kode"}
        </p>
      </div>
    </div>
  );
}
