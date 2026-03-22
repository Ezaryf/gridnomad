"use client";

import { Activity, AlertTriangle, TerminalSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export default function SimulationConsole({
  events,
  statusItems,
  debugLines,
  running,
  currentTick
}) {
  return (
    <Card className="overflow-hidden border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]">
      <CardHeader className="border-b border-white/8 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Run console</CardTitle>
            <CardDescription>
              Watch simulation activity, run state, and debug output as the world advances.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={running ? "solid" : "muted"}>{running ? "Live" : "Idle"}</Badge>
            <Badge variant="muted">Tick {currentTick}</Badge>
            <Badge variant="muted">{events.length} events</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="activity" className="flex flex-col">
          <div className="border-b border-white/8 px-5 py-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="activity">
                <Activity className="mr-2 size-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="status">
                <AlertTriangle className="mr-2 size-4" />
                Status
              </TabsTrigger>
              <TabsTrigger value="debug">
                <TerminalSquare className="mr-2 size-4" />
                Debug
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="activity" className="m-0">
            <ScrollArea className="h-[280px] px-5 py-5">
              {events.length === 0 ? (
                <EmptyState text="Run the simulation to populate the live activity feed." />
              ) : (
                <div className="space-y-3">
                  {events.slice(-32).reverse().map((event, index) => (
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

          <TabsContent value="status" className="m-0">
            <ScrollArea className="h-[280px] px-5 py-5">
              {statusItems.length === 0 ? (
                <EmptyState text="Status updates will appear here as soon as the simulation starts." />
              ) : (
                <div className="space-y-3">
                  {statusItems.slice(-24).reverse().map((item, index) => (
                    <article
                      key={`${item.tick ?? "status"}-${index}`}
                      className="rounded-3xl border border-white/8 bg-white/[0.025] p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        <span>{item.type}</span>
                        <span>{item.tick != null ? `Tick ${item.tick}` : "System"}</span>
                      </div>
                      <p className="text-sm leading-7 text-zinc-300">{item.message}</p>
                    </article>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="debug" className="m-0">
            <ScrollArea className="h-[280px] px-5 py-5">
              {debugLines.length === 0 ? (
                <EmptyState text="Debug output, stream errors, and provider stderr will appear here." />
              ) : (
                <div className="space-y-3">
                  {debugLines.slice(-30).reverse().map((line, index) => (
                    <article
                      key={`${line.tick ?? "debug"}-${index}`}
                      className="rounded-3xl border border-white/8 bg-black/40 p-4"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                        <span>{line.type}</span>
                        <span>{line.tick != null ? `Tick ${line.tick}` : "System"}</span>
                      </div>
                      <p className="font-mono text-xs leading-6 text-zinc-300">{line.message}</p>
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


function EmptyState({ text }) {
  return (
    <div className="rounded-3xl border border-white/8 bg-white/[0.025] p-6 text-sm leading-7 text-zinc-400">
      {text}
    </div>
  );
}
