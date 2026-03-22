import { Activity, Castle, Landmark, Orbit } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";


const ICONS = {
  aliveAgents: Activity,
  settlements: Castle,
  landmarks: Landmark,
  seed: Orbit
};


export default function AtlasMetrics({ metrics }) {
  const items = [
    { key: "aliveAgents", label: "Alive agents", value: metrics.aliveAgents },
    { key: "settlements", label: "Settlements", value: metrics.settlements },
    { key: "landmarks", label: "Landmarks", value: metrics.landmarks },
    { key: "seed", label: "World seed", value: metrics.seed }
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = ICONS[item.key];
        return (
          <Card key={item.key} className="bg-white/[0.03]">
            <CardContent className="flex items-center justify-between p-5">
              <div className="space-y-1">
                <p className="text-[11px] uppercase tracking-[0.22em] text-zinc-500">{item.label}</p>
                <p className="text-2xl font-semibold tracking-tight text-zinc-50">{item.value}</p>
              </div>
              <div className="flex size-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200">
                <Icon className="size-4" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
