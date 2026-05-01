import { createFileRoute } from "@tanstack/react-router";
import { Archive } from "lucide-react";

export const Route = createFileRoute("/app/arkiv")({
  component: () => (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-bold">Arkiv</h1>
      <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
        <Archive className="mx-auto mb-3 h-8 w-8" />
        Arkivet over lukkede dage og månedlige timesedler kommer i næste fase.
      </div>
    </div>
  ),
});
