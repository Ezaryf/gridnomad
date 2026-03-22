"use client";

import { Clock3, Eye, MessagesSquare } from "lucide-react";

import { providerDisplayName } from "@/lib/civilization-setup";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export default function InspectorTabs({
  scenario,
  inspector,
  events,
  communications = [],
  className = "",
  panelHeightClass = "flex-1 min-h-0"
}) {
  return (
    <div className={`flex flex-col overflow-hidden ${className}`}>
      <div className="border-b border-white/8 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Inspector</span>
          <Badge className="h-5 text-[10px]">{events.length} events</Badge>
        </div>
      </div>
      <Tabs defaultValue="inspect" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-white/8 px-3 py-1.5">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="inspect" className="text-xs">
              <Eye className="mr-1.5 size-3" />
              Inspect
            </TabsTrigger>
            <TabsTrigger value="events" className="text-xs">
              <Clock3 className="mr-1.5 size-3" />
              Events
            </TabsTrigger>
            <TabsTrigger value="comms" className="text-xs">
              <MessagesSquare className="mr-1.5 size-3" />
              Comms
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="inspect" className="m-0 min-h-0 flex-1">
          <ScrollArea className="h-full px-3 py-3">
            {inspector ? (
              <div className="space-y-3">
                {inspector.selectedHuman ? (
                  <HumanPanel
                    human={inspector.selectedHuman}
                    group={groupLabel(scenario, inspector.selectedHuman.faction_id)}
                    controller={inspector.selectedController}
                    recentMemories={inspector.recentMemories ?? []}
                  />
                ) : null}

                {inspector.tile ? (
                  <>
                    <div className="space-y-1">
                      <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Tile</p>
                      <h3 className="text-lg font-semibold tracking-tight text-zinc-50">
                        {inspector.tile.x}, {inspector.tile.y}
                      </h3>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <Chip label="Terrain" value={inspector.tile.terrain} />
                      <Chip label="Biome" value={inspector.tile.biome} />
                      <Chip label="Feature" value={inspector.tile.feature ?? "none"} />
                      <Chip label="Influence" value={groupLabel(scenario, inspector.tile.owner_faction)} />
                      <Chip label="Region" value={inspector.region?.name ?? "none"} />
                      <Chip label="Resource" value={inspector.tile.resource ?? "none"} />
                      <Chip label="Elevation" value={String(inspector.tile.elevation ?? 0)} />
                      <Chip label="Fertility" value={String(inspector.tile.fertility ?? 0)} />
                    </div>

                    <Section title="Structures">
                      {inspector.structures.length
                        ? inspector.structures.join(", ")
                        : "No structures."}
                    </Section>

                    <Section title="Humans here">
                      {inspector.humansOnTile.length
                        ? inspector.humansOnTile.map((h) => `${h.name} (${groupLabel(scenario, h.faction_id)})`).join(", ")
                        : "No humans."}
                    </Section>

                    {inspector.selectedHuman && inspector.otherHumansOnTile?.length ? (
                      <Section title="Others here">
                        {inspector.otherHumansOnTile.map((h) => `${h.name} (${groupLabel(scenario, h.faction_id)})`).join(", ")}
                      </Section>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : (
              <div className="rounded-xl border border-white/8 bg-white/2.5 p-4 text-xs leading-6 text-zinc-500">
                Click a human or hover a tile to inspect.
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="events" className="m-0 min-h-0 flex-1">
          <ScrollArea className="h-full px-3 py-3">
            {events.length === 0 ? (
              <div className="rounded-xl border border-white/8 bg-white/2.5 p-4 text-xs leading-6 text-zinc-500">
                Run the simulation to populate events.
              </div>
            ) : (
              <div className="space-y-2">
                {events.slice(-30).reverse().map((event, i) => (
                  <article key={`${event.tick}-${i}`} className="rounded-xl border border-white/8 bg-white/2.5 p-3">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
                      <span>Tick {event.tick}</span>
                      <span>{event.kind}</span>
                    </div>
                    <p className="text-xs leading-5 text-zinc-300">{event.description}</p>
                  </article>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="comms" className="m-0 min-h-0 flex-1">
          <ScrollArea className="h-full px-3 py-3">
            {communications.length === 0 ? (
              <div className="rounded-xl border border-white/8 bg-white/2.5 p-4 text-xs leading-6 text-zinc-500">
                Run the simulation to see group messages.
              </div>
            ) : (
              <div className="space-y-3">
                <CommsSection
                  title="Group channels"
                  messages={communications.filter((m) => m.scope === "civilization")}
                  scenario={scenario}
                />
                <CommsSection
                  title="Cross-group"
                  messages={communications.filter((m) => m.scope === "diplomacy")}
                  scenario={scenario}
                />
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HumanPanel({ human, group, controller, recentMemories = [] }) {
  const personality = human.personality ?? {};
  const emotions = human.emotions ?? {};
  const needs = human.needs ?? {};
  const provider = controller?.provider ? providerDisplayName(controller.provider) : "Unknown";
  const model = controller?.model || "Auto";

  return (
    <div className="space-y-3 rounded-xl border border-white/8 bg-white/2.5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Selected human</p>
          <h3 className="text-lg font-semibold tracking-tight text-zinc-50">{human.name}</h3>
          <p className="text-[11px] text-zinc-400">{group} · {human.alive === false ? "deceased" : "alive"}</p>
        </div>
        <Badge variant="outline" className="h-5 text-[10px]">{human.id}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <Chip label="Group" value={group} />
        <Chip label="Controller" value={provider} />
        <Chip label="Model" value={model} />
        <Chip label="Position" value={`${human.x}, ${human.y}`} />
        <Chip label="Age" value={String(human.age_ticks ?? 0)} />
        <Chip label="Health" value={String(human.health ?? 0)} />
        <Chip label="Food" value={String(human.inventory?.food ?? 0)} />
        <Chip label="Wood" value={String(human.inventory?.wood ?? 0)} />
        <Chip label="Stone" value={String(human.inventory?.stone ?? 0)} />
        <Chip label="Safety" value={String(needs.Safety ?? needs.safety ?? 0)} />
      </div>

      <Section title="Intent">{human.current_intent || human.last_intent?.reason || "None."}</Section>
      <Section title="Thought">{human.last_thought || "None."}</Section>
      <Section title="Speech">{human.last_speech || "None."}</Section>
      <Section title="Memory">{recentMemories.length ? recentMemories.join(" | ") : "None."}</Section>

      <Section title="Emotions">
        Joy {emotions.Joy ?? emotions.joy ?? 0}, Sad {emotions.Sadness ?? emotions.sadness ?? 0}, Fear {emotions.Fear ?? emotions.fear ?? 0}, Anger {emotions.Anger ?? emotions.anger ?? 0}
      </Section>

      <Section title="Needs">
        Survival {needs.Survival ?? needs.survival ?? 0}, Safety {needs.Safety ?? needs.safety ?? 0}, Belong {needs.Belonging ?? needs.belonging ?? 0}, Esteem {needs.Esteem ?? needs.esteem ?? 0}
      </Section>

      <Section title="Personality">
        O {personality.openness ?? 0}, C {personality.conscientiousness ?? 0}, E {personality.extraversion ?? 0}, A {personality.agreeableness ?? 0}, N {personality.neuroticism ?? 0}
      </Section>
    </div>
  );
}

function Chip({ label, value }) {
  return (
    <div className="rounded-lg border border-white/6 bg-white/2 px-2.5 py-1.5">
      <p className="text-[8px] uppercase tracking-[0.2em] text-zinc-500">{label}</p>
      <p className="text-[11px] font-medium text-zinc-200">{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="space-y-1 rounded-lg border border-white/6 bg-white/2 p-2.5">
      <p className="text-[8px] uppercase tracking-[0.2em] text-zinc-500">{title}</p>
      <p className="text-[11px] leading-5 text-zinc-300">{children}</p>
    </div>
  );
}

function groupLabel(scenario, factionId) {
  if (!factionId) return "neutral";
  return scenario?.factions?.find((f) => f.id === factionId)?.name ?? factionId;
}

function CommsSection({ title, messages, scenario }) {
  return (
    <div className="space-y-2">
      <p className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">{title}</p>
      {messages.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/2.5 p-3 text-xs text-zinc-500">No messages.</div>
      ) : (
        messages.slice(-12).reverse().map((msg, i) => (
          <article key={`${msg.tick}-${msg.sender_agent_id}-${i}`} className="rounded-xl border border-white/8 bg-white/2.5 p-3">
            <div className="mb-1.5 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.18em] text-zinc-500">
              <span>Tick {msg.tick}</span>
              <span>{msg.scope}</span>
            </div>
            <p className="text-xs leading-5 text-zinc-300">
              <strong className="font-medium text-zinc-100">{msg.sender_agent_id}</strong>
              {" from "}
              <strong className="font-medium text-zinc-100">{groupLabel(scenario, msg.sender_faction_id)}</strong>
              {msg.target_faction_id ? (
                <>
                  {" to "}
                  <strong className="font-medium text-zinc-100">{groupLabel(scenario, msg.target_faction_id)}</strong>
                </>
              ) : null}
              : {msg.text}
            </p>
          </article>
        ))
      )}
    </div>
  );
}
