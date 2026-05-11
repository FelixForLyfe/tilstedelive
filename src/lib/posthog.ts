// Central PostHog utility — lazy-loaded, never runs server-side.
// All exported functions are safe to call regardless of init state.

let ph: any = null;

const KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const HOST = (import.meta.env.VITE_POSTHOG_HOST as string | undefined) ?? "https://eu.i.posthog.com";

export async function initPostHog({ loggedIn = false } = {}) {
  if (typeof window === "undefined" || !KEY || ph) return;
  const { default: posthog } = await import("posthog-js");
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: "identified_only",
    capture_pageview: false,
    capture_pageleave: true,
    disable_session_recording: loggedIn,
    session_recording: { maskAllInputs: true },
  });
  ph = posthog;
}

export function optOutPostHog() {
  if (ph) ph.opt_out_capturing();
  // If not yet initialized, not initializing IS the opt-out.
}

export function trackEvent(event: string, props?: Record<string, unknown>) {
  ph?.capture(event, props);
}

export function identifyUser(id: string, traits: Record<string, unknown>) {
  ph?.identify(id, traits);
}

export function resetUser() {
  ph?.reset();
}

export function setSessionRecording(enable: boolean) {
  ph?.set_config({ disable_session_recording: !enable });
}
