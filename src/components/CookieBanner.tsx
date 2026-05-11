import { useEffect, useState } from "react";
import { Cookie, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { initPostHog, optOutPostHog } from "@/lib/posthog";

const CONSENT_KEY = "tilstede:cookie-consent";

export type CookieConsent = "accepted" | "necessary" | null;

export function getCookieConsent(): CookieConsent {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(CONSENT_KEY) as CookieConsent) ?? null;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
  }, []);

  const accepter = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
    initPostHog({ loggedIn: false });
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "necessary");
    setVisible(false);
    optOutPostHog();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 fade-in sm:p-4">
      <div className="glass relative mx-auto max-w-2xl rounded-2xl p-4 shadow-card sm:p-5">
        <button
          aria-label="Luk"
          onClick={decline}
          className="absolute right-2 top-2 rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-start gap-3 pr-6">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-primary shadow-glow">
            <Cookie className="h-5 w-5 text-primary-foreground" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">Vi bruger cookies</p>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Vi bruger nødvendige cookies til at holde dig logget ind og huske dine indstillinger.
              Med dit samtykke bruger vi PostHog til anonymiseret produktanalyse — ingen reklame­sporing.{" "}
              <Link
                to="/privatlivspolitik"
                className="text-primary underline-offset-2 hover:underline"
              >
                Læs vores privatlivspolitik
              </Link>
              .
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={accepter}
                className="rounded-xl bg-gradient-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
              >
                Acceptér alle
              </button>
              <button
                onClick={decline}
                className="rounded-xl bg-surface px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-surface-elevated"
              >
                Kun nødvendige
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
