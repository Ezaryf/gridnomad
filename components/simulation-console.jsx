"use client";

import { useState } from "react";

import { Activity, AlertTriangle, TerminalSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export default function SimulationConsole({
  events,
  statusItems,
  debugLines,
  running,
  currentTick,
  liveTimeMs = 0
}) {
  const [activityFilter, setActivityFilter] = useState("all");

  const filteredEvents = events.filter((e) => {
    if (activityFilter === "all") return true;
    if (activityFilter === "thoughts") return e.kind === "ACTION_PROPOSAL" || e.kind === "COMMUNICATION";
    if (activityFilter === "movement") return e.kind === "MOVE";
    if (activityFilter === "actions") return !["MOVE", "ACTION_PROPOSAL", "COMMUNICATION"].includes(e.kind);
    return true;
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Tabs defaultValue="activity" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-white/8 px-3 py-1 flex items-center justify-between">
          <TabsList className="grid w-[240px] grid-cols-3">
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

        <TabsContent value="activity" className="m-0 flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-white/5 bg-black/20 px-3 py-1.5">
            <FilterButton active={activityFilter === "all"} onClick={() => setActivityFilter("all")}>All</FilterButton>
            <FilterButton active={activityFilter === "thoughts"} onClick={() => setActivityFilter("thoughts")}>Thoughts</FilterButton>
            <FilterButton active={activityFilter === "actions"} onClick={() => setActivityFilter("actions")}>Actions</FilterButton>
            <FilterButton active={activityFilter === "movement"} onClick={() => setActivityFilter("movement")}>Movement</FilterButton>
          </div>
          <ScrollArea className="flex-1 px-3 py-2">
            {filteredEvents.length === 0 ? (
              <Empty text="No activity matches the current filter." />
            ) : (
              <div className="space-y-1.5 min-h-max pb-2">
                {filteredEvents.slice(-32).reverse().map((event, i) => (
                  <article key={`${event.tick}-${i}`} className="rounded-lg border border-white/20 bg-white/10 p-2 backdrop-blur-[10px] backdrop-saturate-180">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[8px] uppercase tracking-[0.18em] text-zinc-500">
                      <span>{event.time_ms != null ? formatLiveTime(event.time_ms) : `Step ${event.tick}`}</span>
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
              <div className="space-y-1.5 min-h-max pb-2">
                {statusItems.slice(-24).reverse().map((item, i) => (
                  <article key={`${item.tick ?? "s"}-${i}`} className="rounded-lg border border-white/20 bg-white/10 p-2 backdrop-blur-[10px] backdrop-saturate-180">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[8px] uppercase tracking-[0.18em] text-zinc-500">
                      <span className={item.type === "error" ? "text-red-400 font-bold" : ""}>{item.type}</span>
                      <span>{item.time_ms != null ? formatLiveTime(item.time_ms) : item.tick != null ? `Step ${item.tick}` : "Sys"}</span>
                    </div>
                    <p className={`text-[11px] leading-4 ${item.type === "error" ? "text-red-300" : "text-zinc-300"}`}>{item.message}</p>
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
              <div className="space-y-1.5 min-h-max pb-2">
                {debugLines.slice(-30).reverse().map((line, i) => (
                  <article key={`${line.tick ?? "d"}-${i}`} className="rounded-lg border border-white/6 bg-black/40 p-2">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[8px] uppercase tracking-[0.18em] text-zinc-500">
                      <span className={line.type === "error" ? "text-red-500 font-bold" : ""}>{line.type}</span>
                      <span>{line.tick != null ? `Step ${line.tick}` : "Sys"}</span>
                    </div>
                    <p className={`font-mono text-[10px] leading-4 ${line.type === "error" || line.type === "stderr" ? "text-red-300" : "text-zinc-300"}`}>{line.message}</p>
                  </article>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
      <div className="border-t border-white/8 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
        {running ? `Live ${formatLiveTime(liveTimeMs)} · Step ${currentTick}` : "Idle"}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-widest transition-colors ${
        active 
          ? "bg-white/20 text-white" 
          : "bg-transparent text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
      }`}
    >
      {children}
    </button>
  );
}


function Empty({ text }) {
  return (
    <div className="rounded-lg border border-white/20 bg-white/10 p-3 text-[11px] leading-5 text-zinc-400 backdrop-blur-[10px] backdrop-saturate-180">
      {text}
    </div>
  );
}

function formatLiveTime(timeMs) {
  const totalSeconds = Math.max(0, Math.floor((timeMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
