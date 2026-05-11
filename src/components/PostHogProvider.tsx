"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider, usePostHog } from "posthog-js/react";
import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";

function PostHogPageView() {
  const { location } = useRouterState();
  const ph = usePostHog();

  useEffect(() => {
    if (ph) {
      ph.capture("$pageview", {
        $current_url: window.location.href,
      });
    }
  }, [location.pathname, location.search, ph]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
      api_host: import.meta.env.VITE_POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: false,
      capture_pageleave: true,
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
