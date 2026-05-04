import { createIsomorphicFn } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

export const applySecurityHeaders = createIsomorphicFn()
  .client(() => {})
  .server(() => {
    setResponseHeaders(
      new Headers({
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(self), microphone=(), geolocation=()",
        "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
        "Content-Security-Policy": [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' https://cdn.gpteng.co",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.lovable.app https://*.lovableproject.com https://cdn.gpteng.co",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "object-src 'none'",
          "form-action 'self'",
        ].join("; "),
      }),
    );
  });
