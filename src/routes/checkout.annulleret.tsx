import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, XCircle, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/checkout/annulleret")({
  head: () => ({ meta: [{ title: "Betaling annulleret — Tilstede" }] }),
  component: CheckoutAnnulleret,
});

function CheckoutAnnulleret() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md text-center fade-in">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-2xl font-bold">Tilstede</span>
        </Link>

        <div className="glass rounded-3xl p-10 shadow-card">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-muted/30">
            <XCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="font-display text-2xl font-bold">Betaling annulleret</h1>
          <p className="mt-3 text-muted-foreground">
            Din betaling blev ikke gennemført. Ingen beløb er trukket. Du kan prøve igen når du er klar.
          </p>
          <Link
            to="/priser"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-primary px-6 py-3 font-semibold text-primary-foreground shadow-glow transition hover:opacity-90"
          >
            Tilbage til priser <ChevronRight className="h-4 w-4" />
          </Link>
          <p className="mt-4 text-xs text-muted-foreground">
            Brug for hjælp?{" "}
            <a href="mailto:support@tilstede.live" className="text-primary hover:underline">
              support@tilstede.live
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
