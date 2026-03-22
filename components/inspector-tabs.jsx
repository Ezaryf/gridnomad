"use client";

import { Clock3, Eye } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export default function InspectorTabs({ scenario, inspector, events, territorySummary }) {
  return (
    <Card className="sticky top-6 overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))]">
      <CardHeader className="border-b border-white/8 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Field console</CardTitle>
            <CardDescription>Inspect tiles or read the latest simulation timeline.</CardDescription>
          </div>
          <Badge>{events.length} events</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="inspect" className="flex flex-col">
          <div className="border-b border-white/8 px-5 py-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="inspect">
                <Eye className="mr-2 size-4" />
                Inspector
              </TabsTrigger>
              <TabsTrigger value="events">
                <Clock3 className="mr-2 size-4" />
                Events
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="inspect" className="m-0">
            <ScrollArea className="h-[780px] px-5 py-5">
              {inspector ? (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Tile</p>
                    <h3 className="text-2xl font-semibold tracking-tight text-zinc-50">
                      {inspector.tile.x}, {inspector.tile.y}
                    </h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <InspectorChip label="Terrain" value={inspector.tile.terrain} />
                    <InspectorChip label="Biome" value={inspector.tile.biome} />
                    <InspectorChip label="Feature" value={inspector.tile.feature ?? "none"} />
                    <InspectorChip label="Owner" value={factionLabel(scenario, inspector.tile.owner_faction)} />
                    <InspectorChip label="Region" value={inspector.region?.name ?? "none"} />
                    <InspectorChip label="Resource" value={inspector.tile.resource ?? "none"} />
                    <InspectorChip label="Elevation" value={String(inspector.tile.elevation ?? 0)} />
                    <InspectorChip label="Moisture" value={String(inspector.tile.moisture ?? 0)} />
                  </div>

                  <InspectorSection title="Structures">
                    {inspector.structures.length
                      ? inspector.structures.join(", ")
                      : "No structures or landmarks on this tile."}
                  </InspectorSection>

                  <InspectorSection title="Agents">
                    {inspector.agents.length
                      ? inspector.agents.map((agent) => `${agent.name} (${factionLabel(scenario, agent.faction_id)})`).join(", ")
                      : "No agents standing here."}
                  </InspectorSection>

                  <InspectorSection title="Territory">
                    {territorySummary}
                  </InspectorSection>
                </div>
              ) : (
                <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-6 text-sm leading-7 text-zinc-400">
                  Hover or click the map to inspect terrain, ownership, resources, and stationed agents.
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="events" className="m-0">
            <ScrollArea className="h-[780px] px-5 py-5">
              {events.length === 0 ? (
                <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-6 text-sm leading-7 text-zinc-400">
                  Run the simulation to populate the event timeline.
                </div>
              ) : (
                <div className="space-y-3">
                  {events.slice(-22).reverse().map((event, index) => (
                    <article
                      key={`${event.tick}-${index}`}
                      className="rounded-3xl border border-white/8 bg-white/[0.025] p-4"
                    >
                      <div className="mb-3 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        <span>Tick {event.tick}</span>
                        <span>{event.kind}</span>
                      </div>
                      <p className="text-sm leading-7 text-zinc-300">{event.description}</p>
                    </article>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}


function InspectorChip({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}


function InspectorSection({ title, children }) {
  return (
    <div className="space-y-2 rounded-3xl border border-white/8 bg-white/[0.025] p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      <p className="text-sm leading-7 text-zinc-300">{children}</p>
    </div>
  );
}


function factionLabel(scenario, factionId) {
  if (!factionId) {
    return "neutral";
  }
  return scenario?.factions?.find((faction) => faction.id === factionId)?.name ?? factionId;
}
