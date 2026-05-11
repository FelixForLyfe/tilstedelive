import { createServerFn } from "@tanstack/react-start";

type PostHogMetrics = {
  pageviews7d: number;
  signups7d: number;
  loginEvents7d: number;
  checkouts7d: number;
  topEvents: { event: string; count: number }[];
};

export const getPostHogMetrics = createServerFn({ method: "GET" })
  .handler(async (): Promise<PostHogMetrics | null> => {
    const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
    const projectId = process.env.POSTHOG_PROJECT_ID;
    const host = process.env.VITE_POSTHOG_HOST ?? "https://eu.i.posthog.com";

    if (!apiKey || !projectId) return null;

    const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };

    const eventNames = ["$pageview", "signup_completed", "login_success", "checkout_started"];

    const sumResult = (data: any): number => {
      const result = data?.results?.[0];
      if (!result?.data) return 0;
      return (result.data as number[]).reduce((a: number, b: number) => a + b, 0);
    };

    try {
      const responses = await Promise.all(
        eventNames.map((ev) =>
          fetch(
            `${host}/api/projects/${projectId}/insights/trend/?events=${encodeURIComponent(JSON.stringify([{ id: ev }]))}&date_from=-7d`,
            { headers },
          ).then((r) => (r.ok ? r.json() : null))
        )
      );

      const [pvData, signupData, loginData, checkoutData] = responses;

      return {
        pageviews7d: sumResult(pvData),
        signups7d: sumResult(signupData),
        loginEvents7d: sumResult(loginData),
        checkouts7d: sumResult(checkoutData),
        topEvents: eventNames.map((ev, i) => ({
          event: ev,
          count: sumResult(responses[i]),
        })).sort((a, b) => b.count - a.count),
      };
    } catch {
      return null;
    }
  });
