import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/checkin")({
  beforeLoad: async ({ location }) => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: CheckinLayout,
});

function CheckinLayout() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex items-center gap-3 px-4 py-3">
          <Link to="/app" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-display text-base font-bold">Tilstede</span>
          </Link>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
