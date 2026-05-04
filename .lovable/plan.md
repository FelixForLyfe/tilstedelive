## Fix: import-protection rejects dynamic `.server` import in `__root.tsx`

### Problem
The TanStack import-protection plugin scans the client bundle's import graph statically. Both `await import("@tanstack/react-start/server")` and `await import("@/server/security-headers.server")` are flagged because `__root.tsx` is reachable from the client bundle, and the plugin treats any reference (static or dynamic) to `*.server.*` / server-only modules as a violation. The runtime `if (typeof window !== "undefined") return` guard does not satisfy the static analyzer.

### Fix
Use `createIsomorphicFn` (the plugin's own recommended escape hatch) so the client bundle gets a no-op and the server bundle gets the real implementation. This removes the need for any dynamic import or `.server` filename in `__root.tsx`.

### Steps
1. Create `src/lib/security-headers.ts` exporting:
   ```ts
   import { createIsomorphicFn } from "@tanstack/react-start";
   import { setResponseHeaders } from "@tanstack/react-start/server";

   export const applySecurityHeaders = createIsomorphicFn()
     .client(() => {})
     .server(() => {
       setResponseHeaders(new Headers({ /* …same CSP/HSTS/etc as today… */ }));
     });
   ```
   `createIsomorphicFn` tree-shakes the `.server()` body (and its imports) out of the client bundle, so importing `@tanstack/react-start/server` at the top is safe.

2. In `src/routes/__root.tsx` replace the current `beforeLoad` block with:
   ```ts
   beforeLoad: () => { applySecurityHeaders(); },
   ```
   and add `import { applySecurityHeaders } from "@/lib/security-headers";`.

3. Delete the now-unused `src/server/security-headers.server.ts`.

### Why this works
- `createIsomorphicFn` is exactly what the plugin's error message suggests for this case.
- No `.server` filename is referenced from a client-reachable file → import-protection passes.
- Headers are still set on every SSR response → CSP, HSTS, X-Frame-Options behavior unchanged.
- No change to routing, providers, components, or any other behavior.
