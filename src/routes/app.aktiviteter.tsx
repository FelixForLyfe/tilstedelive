import { createFileRoute } from "@tanstack/react-router";
import { Activity } from "lucide-react";

export const Route = createFileRoute("/app/aktiviteter")({
  component: () => (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-bold">Aktiviteter</h1>
      <div className="glass rounded-2xl p-10 text-center text-muted-foreground">
        <Activity className="mx-auto mb-3 h-8 w-8" />
        Aktivitetsmodulet kommer i næste fase. Admin kan allerede oprette aktiviteter under Admin.
      </div>
    </div>
  ),
});
