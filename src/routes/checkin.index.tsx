import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, KeySquare, MapPin, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useOrg } from "@/contexts/OrgContext";
import { pinCheckin, type QrLocation } from "@/server/checkin.functions";

export const Route = createFileRoute("/checkin/")({
  component: PinCheckinPage,
});

type State = "idle" | "loading" | "checkin" | "checkout" | "error";

function PinCheckinPage() {
  const { aktivOrgId } = useOrg();
  const [locations, setLocations] = useState<QrLocation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [pin, setPin] = useState("");
  const [state, setState] = useState<State>("idle");
  const [resultLocation, setResultLocation] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  const loadLocations = useCallback(async () => {
    if (!aktivOrgId) return;
    const { data } = await (supabase as any)
      .from("location_qr_codes")
      .select("id, code, location_name, pin_hash, pin_updated_at, created_at")
      .eq("organization_id", aktivOrgId)
      .not("pin_hash", "is", null)
      .order("location_name");
    setLocations((data ?? []) as QrLocation[]);
    if (data && data.length > 0 && !selectedId) {
      setSelectedId(data[0].id);
    }
  }, [aktivOrgId, selectedId]);

  useEffect(() => {
    loadLocations();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.user_metadata?.full_name) {
        setUserName(session.user.user_metadata.full_name);
      } else if (session?.user?.email) {
        setUserName(session.user.email.split("@")[0]);
      }
    });
  }, [loadLocations]);

  const handlePinDigit = (digit: string) => {
    if (pin.length < 6) setPin((p) => p + digit);
  };

  const handleDelete = () => setPin((p) => p.slice(0, -1));

  const handleSubmit = async () => {
    if (!selectedId || pin.length < 4) return;
    setState("loading");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session udløbet. Log ind igen.");
        setState("error");
        setErrorMsg("Session udløbet.");
        return;
      }
      const result = await pinCheckin({ data: { accessToken: session.access_token, locationId: selectedId, pin } });
      setResultLocation(result.locationName);
      setState(result.action === "checkin" ? "checkin" : "checkout");
      setPin("");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Noget gik galt. Prøv igen.");
      setState("error");
      setPin("");
    }
  };

  if (state === "checkin" || state === "checkout") {
    const isIn = state === "checkin";
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4">
        <div className="glass w-full max-w-sm rounded-3xl p-10 text-center fade-in">
          <div className={`mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl ${isIn ? "bg-success/15" : "bg-primary/10"}`}>
            <CheckCircle2 className={`h-10 w-10 ${isIn ? "text-success" : "text-primary"}`} />
          </div>
          <h1 className="font-display text-2xl font-bold">{isIn ? "Tjekket ind" : "Tjekket ud"}</h1>
          {resultLocation && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {resultLocation}
            </div>
          )}
          {userName && <p className="mt-4 text-muted-foreground">{userName}</p>}
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button
            onClick={() => { setState("idle"); setResultLocation(null); }}
            className="mt-8 w-full rounded-xl bg-gradient-primary py-3 font-semibold text-primary-foreground shadow-glow"
          >
            Nyt tjek ind
          </button>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-[85vh] items-center justify-center px-4">
        <div className="glass w-full max-w-sm rounded-3xl p-10 text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/15">
            <span className="text-4xl">⚠️</span>
          </div>
          <h1 className="font-display text-xl font-bold">Noget gik galt</h1>
          <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
          <button
            onClick={() => { setState("idle"); setErrorMsg(null); }}
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
            Din administrator har ikke sat en PIN op endnu. Kontakt din administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-3xl p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <KeySquare className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold">PIN tjek ind</h1>
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
              className={`h-3 w-3 rounded-full transition-all ${
                i < pin.length ? "scale-125 bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              onClick={() => handlePinDigit(d)}
              disabled={state === "loading"}
              className="flex h-14 items-center justify-center rounded-xl border border-border bg-surface text-xl font-semibold transition hover:bg-muted active:scale-95 disabled:opacity-50"
            >
              {d}
            </button>
          ))}
          <button
            onClick={handleDelete}
            disabled={state === "loading" || pin.length === 0}
            className="flex h-14 items-center justify-center rounded-xl border border-border bg-surface text-sm text-muted-foreground transition hover:bg-muted disabled:opacity-30"
          >
            ⌫
          </button>
          <button
            onClick={() => handlePinDigit("0")}
            disabled={state === "loading"}
            className="flex h-14 items-center justify-center rounded-xl border border-border bg-surface text-xl font-semibold transition hover:bg-muted active:scale-95 disabled:opacity-50"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={state === "loading" || pin.length < 4 || !selectedId}
            className="flex h-14 items-center justify-center rounded-xl bg-gradient-primary text-sm font-semibold text-primary-foreground shadow-glow transition disabled:opacity-50"
          >
            {state === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
