import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { getCookieConsent } from "@/components/CookieBanner";
import { initPostHog, trackEvent } from "@/lib/posthog";

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const { location } = useRouterState();

  // Init on mount if consent was already given in a previous session
  useEffect(() => {
    if (getCookieConsent() === "accepted") {
      initPostHog({ loggedIn: false });
    }
  }, []);

  // Page view on every route change
  useEffect(() => {
    if (typeof window === "undefined") return;
    trackEvent("$pageview", { $current_url: window.location.href });
  }, [location.pathname, location.search]);

  return <>{children}</>;
}
