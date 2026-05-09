import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Loader2 } from "lucide-react";

export const Route = createFileRoute("/priser")({
  head: () => ({
    meta: [
      { title: "Priser — Tilstede" },
      { name: "description", content: "Enkel og gennemsigtig prissætning for alle typer organisationer." },
    ],
  }),
  component: PriserSide,
});

function PriserSide() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="container mx-auto flex items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight">Tilstede</span>
        </Link>
        <Link
          to="/signup"
          className="rounded-lg bg-gradient-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
        >
          Opret gratis
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 py-24 text-center fade-in">
        <div>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold">Priser kommer snart</h1>
          <p className="mx-auto mt-3 max-w-sm text-muted-foreground">
            Vi arbejder på vores prisside. I mellemtiden er Tilstede gratis at oprette og bruge.
          </p>
          <Link
            to="/signup"
            className="mt-6 inline-block rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            Opret organisation gratis
          </Link>
        </div>
      </div>
    </div>
  );
}
