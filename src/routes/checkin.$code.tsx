import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, LogIn, LogOut, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { qrCheckin } from "@/server/checkin.functions";

export const Route = createFileRoute("/checkin/$code")({
  component: QrCheckinPage,
});

type State = "idle" | "loading" | "checkin" | "checkout" | "error";

function QrCheckinPage() {
  const { code } = useParams({ from: "/checkin/$code" });
  const [state, setState] = useState<State>("idle");
  const [locationName, setLocationName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.user_metadata?.full_name) {
        setUserName(session.user.user_metadata.full_name);
      } else if (session?.user?.email) {
        setUserName(session.user.email.split("@")[0]);
      }
    });
  }, []);

  const handleCheckin = async () => {
    setState("loading");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session udløbet. Log ind igen.");
        setState("error");
        setErrorMsg("Session udløbet.");
        return;
      }
      const result = await qrCheckin({ data: { accessToken: session.access_token, code } });
      setLocationName(result.locationName);
      setState(result.action === "checkin" ? "checkin" : "checkout");
    } catch (err: any) {
      setErrorMsg(err?.message ?? "Noget gik galt. Prøv igen.");
      setState("error");
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
          <h1 className="font-display text-2xl font-bold">
            {isIn ? "Tjekket ind" : "Tjekket ud"}
          </h1>
          {locationName && (
            <div className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              {locationName}
            </div>
          )}
          {userName && (
            <p className="mt-4 text-muted-foreground">{userName}</p>
          )}
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date().toLocaleTimeString("da-DK", { hour: "2-digit", minute: "2-digit" })}
          </p>
          <button
            onClick={() => { setState("idle"); setLocationName(null); }}
            className="mt-8 w-full rounded-xl bg-gradient-primary py-3 font-semibold text-primary-foreground shadow-glow"
          >
            Scan igen
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

  return (
    <div className="flex min-h-[85vh] items-center justify-center px-4">
      <div className="glass w-full max-w-sm rounded-3xl p-10 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <LogIn className="h-10 w-10 text-primary" />
        </div>
        <h1 className="font-display text-2xl font-bold">Tjek ind</h1>
        {userName && <p className="mt-2 text-muted-foreground">Hej, {userName}</p>}
        <p className="mt-4 text-sm text-muted-foreground">
          Tryk på knappen for at registrere dit fremmøde via QR-kode.
        </p>
        <button
          onClick={handleCheckin}
          disabled={state === "loading"}
          className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-primary py-4 text-lg font-semibold text-primary-foreground shadow-glow transition disabled:opacity-50"
        >
          {state === "loading" ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <LogIn className="h-5 w-5" />
              Tjek ind / ud
            </>
          )}
        </button>
      </div>
    </div>
  );
}
