"use client";

import { Activity, AlertTriangle, TerminalSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
    <div className="flex h-full flex-col overflow-hidden">
      <Tabs defaultValue="activity" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-white/8 px-3 py-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="activity" className="text-[10px]">
              <Activity className="mr-1 size-3" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="status" className="text-[10px]">
              <AlertTriangle className="mr-1 size-3" />
              Status
            </TabsTrigger>
            <TabsTrigger value="debug" className="text-[10px]">
              <TerminalSquare className="mr-1 size-3" />
              Debug
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="activity" className="m-0 min-h-0 flex-1">
          <ScrollArea className="h-full px-3 py-2">
            {events.length === 0 ? (
              <Empty text="Run simulation to see activity." />
            ) : (
              <div className="space-y-1.5">
                {events.slice(-32).reverse().map((event, i) => (
                  <article key={`${event.tick}-${i}`} className="rounded-lg border border-white/6 bg-white/2 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[8px] uppercase tracking-[0.18em] text-zinc-500">
                      <span>Tick {event.tick}</span>
                      <span>{event.kind}</span>
                    </div>
                    <p className="text-[11px] leading-4 text-zinc-300">{event.description}</p>
                  </article>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="status" className="m-0 min-h-0 flex-1">
          <ScrollArea className="h-full px-3 py-2">
            {statusItems.length === 0 ? (
              <Empty text="Status updates appear when the simulation runs." />
            ) : (
              <div className="space-y-1.5">
                {statusItems.slice(-24).reverse().map((item, i) => (
                  <article key={`${item.tick ?? "s"}-${i}`} className="rounded-lg border border-white/6 bg-white/2 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[8px] uppercase tracking-[0.18em] text-zinc-500">
                      <span>{item.type}</span>
                      <span>{item.tick != null ? `Tick ${item.tick}` : "Sys"}</span>
                    </div>
                    <p className="text-[11px] leading-4 text-zinc-300">{item.message}</p>
                  </article>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="debug" className="m-0 min-h-0 flex-1">
          <ScrollArea className="h-full px-3 py-2">
            {debugLines.length === 0 ? (
              <Empty text="Debug output and provider stderr show here." />
            ) : (
              <div className="space-y-1.5">
                {debugLines.slice(-30).reverse().map((line, i) => (
                  <article key={`${line.tick ?? "d"}-${i}`} className="rounded-lg border border-white/6 bg-black/40 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[8px] uppercase tracking-[0.18em] text-zinc-500">
                      <span>{line.type}</span>
                      <span>{line.tick != null ? `Tick ${line.tick}` : "Sys"}</span>
                    </div>
                    <p className="font-mono text-[10px] leading-4 text-zinc-300">{line.message}</p>
                  </article>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}


function Empty({ text }) {
  return (
    <div className="rounded-lg border border-white/6 bg-white/2 p-3 text-[11px] leading-5 text-zinc-500">
      {text}
    </div>
  );
}
