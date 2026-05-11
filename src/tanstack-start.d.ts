// Type declarations for TanStack Start virtual modules injected by the Vite plugin
declare module "@tanstack/react-start/api" {
  export function createAPIFileRoute(
    path: string,
  ): (handlers: {
    GET?: (ctx: { request: Request }) => Response | Promise<Response>;
    POST?: (ctx: { request: Request }) => Response | Promise<Response>;
    PUT?: (ctx: { request: Request }) => Response | Promise<Response>;
    PATCH?: (ctx: { request: Request }) => Response | Promise<Response>;
    DELETE?: (ctx: { request: Request }) => Response | Promise<Response>;
  }) => unknown;
}
