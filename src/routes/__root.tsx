import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/contexts/AuthContext";
import { OrgProvider } from "@/contexts/OrgContext";
import { Toaster } from "@/components/ui/sonner";
import { InstallPrompt } from "@/components/InstallPrompt";
import { applySecurityHeaders } from "@/lib/security-headers";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Siden blev ikke fundet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Den side du leder efter findes ikke.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Til forsiden
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  beforeLoad: () => {
    applySecurityHeaders();
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Tilstede" },
      { name: "description", content: "Tilstede er en dansk webapp til fremmøderegistrering, hjemsendelser, aktiviteter og arbejdstid for skoler, SFO'er og klubber." },
      { property: "og:title", content: "Tilstede" },
      { property: "og:description", content: "Tilstede er en dansk webapp til fremmøderegistrering, hjemsendelser, aktiviteter og arbejdstid for skoler, SFO'er og klubber." },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#16182a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Tilstede" },
      { name: "twitter:title", content: "Tilstede" },
      { name: "twitter:description", content: "Tilstede er en dansk webapp til fremmøderegistrering, hjemsendelser, aktiviteter og arbejdstid for skoler, SFO'er og klubber." },
      { property: "og:image", content: "https://lihwlthdjimofgqdpuph.supabase.co/storage/v1/object/public/images/app-icon-512.png" },
      { name: "twitter:image", content: "https://lihwlthdjimofgqdpuph.supabase.co/storage/v1/object/public/images/app-icon-512.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.json" },
      { rel: "icon", href: "https://lihwlthdjimofgqdpuph.supabase.co/storage/v1/object/public/images/app-icon-192.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "https://lihwlthdjimofgqdpuph.supabase.co/storage/v1/object/public/images/app-icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="da">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <OrgProvider>
        <Outlet />
        <Toaster richColors position="top-center" />
        <InstallPrompt />
      </OrgProvider>
    </AuthProvider>
  );
}
