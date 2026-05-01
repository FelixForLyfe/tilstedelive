import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Sparkles, Users, Bell, Activity, Clock, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/app" });
  },
  component: Forside,
});

function Feature({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
  return (
    <div className="glass rounded-2xl p-6 transition hover:shadow-glow">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-soft">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function Forside() {
  return (
    <div className="min-h-screen">
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Tilstede</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/login/personale" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Personale</Link>
          <Link to="/login/admin" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Admin</Link>
          <Link to="/signup" className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90">Opret organisation</Link>
        </div>
      </header>

      <section className="container mx-auto px-6 py-20 text-center fade-in">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-success glow-pulse" />
          Live fremmøde i realtid
        </div>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl font-bold tracking-tight md:text-6xl">
          Hold styr på <span className="bg-gradient-primary bg-clip-text text-transparent">hvem der er der</span> – og hvornår de skal hjem.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Tilstede er et moderne fremmødesystem til skoler, SFO'er, fritids- og ungdomsklubber. Tjek børn ind med ét klik, få automatiske hjemsendelses­alarmer og hold styr på personalets arbejdstid.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link to="/signup" className="rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:scale-[1.02]">
            Kom i gang gratis
          </Link>
          <Link to="/login" className="rounded-xl border border-border bg-surface px-6 py-3 font-semibold transition hover:bg-surface-elevated">
            Jeg har en konto
          </Link>
        </div>
      </section>

      <section className="container mx-auto grid gap-4 px-6 pb-24 md:grid-cols-3">
        <Feature icon={Users} title="Live fremmøde" body="Hele personalet ser samme liste – tjek ind og ud opdateres på tværs af enheder med det samme." />
        <Feature icon={Bell} title="Hjemsendelses­alarmer" body="Få besked og lyd præcis når et barn skal hjem. Ingen overser et hjemsendelses­tidspunkt mere." />
        <Feature icon={Activity} title="Aktiviteter" body="Tildel børn til PC, Playstation, fodboldbane eller hvad I nu har. Enkel oversigt og let at afslutte." />
        <Feature icon={Clock} title="Arbejdstidslog" body="Personalet starter vagt, holder pause og slutter vagt. Admin ser timesedlen samlet pr. måned." />
        <Feature icon={Shield} title="Sikkert og dansk" body="Følsomme oplysninger om børn beskyttes pr. organisation. CPR vises kun hvor det er relevant." />
        <Feature icon={Sparkles} title="Luk dagen" body="Admin lukker dagen, alt arkiveres og dagen kan altid genåbnes ved at slette logget." />
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        Tilstede © {new Date().getFullYear()} – bygget til danske institutioner.
      </footer>
    </div>
  );
}
