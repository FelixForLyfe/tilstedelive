import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST as string | undefined;

function PostHogPageView() {
  const { location } = useRouterState();
  useEffect(() => {
    if (!POSTHOG_KEY || typeof window === "undefined") return;
    import("posthog-js").then(({ default: posthog }) => {
      posthog.capture("$pageview", { $current_url: window.location.href });
    });
  }, [location.pathname, location.search]);
  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!POSTHOG_KEY || typeof window === "undefined") return;
    import("posthog-js").then(({ default: posthog }) => {
      posthog.init(POSTHOG_KEY!, {
        api_host: POSTHOG_HOST,
        person_profiles: "identified_only",
        capture_pageview: false,
        capture_pageleave: true,
      });
    });
  }, []);

  return (
    <>
      <PostHogPageView />
      {children}
    </>
  );
}
