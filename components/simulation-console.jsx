"use client";

import { useState } from "react";

import { Activity, AlertTriangle, TerminalSquare } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export default function SimulationConsole({
  activityItems = [],
  statusItems,
  debugLines,
  running,
  currentTick,
  liveTimeMs = 0
}) {
  const [activityFilter, setActivityFilter] = useState("all");

  const filteredActivity = activityItems.filter((item) => {
    if (activityFilter === "all") return true;
    if (activityFilter === "social") return Boolean(item.speech || item.communication);
    if (activityFilter === "travel") return String(item.action ?? "") === "MOVE" || String(item.action ?? "").startsWith("MOVE_");
    if (activityFilter === "failures") return item.success === false;
    return true;
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Tabs defaultValue="activity" className="flex min-h-0 flex-1 flex-col">
        <div className="border-b border-white/8 px-3 py-1 flex items-center justify-between">
          <TabsList className="grid w-[240px] grid-cols-3 h-8">
            <TabsTrigger value="activity" className="text-[11px] h-full">
              <Activity className="mr-1.5 size-3" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="status" className="text-[11px] h-full">
              <AlertTriangle className="mr-1.5 size-3" />
              Status
            </TabsTrigger>
            <TabsTrigger value="debug" className="text-[11px] h-full">
              <TerminalSquare className="mr-1.5 size-3" />
              Debug
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="activity" className="m-0 flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-white/5 bg-black/20 px-3 py-1.5">
            <FilterButton active={activityFilter === "all"} onClick={() => setActivityFilter("all")}>All</FilterButton>
            <FilterButton active={activityFilter === "social"} onClick={() => setActivityFilter("social")}>Social</FilterButton>
            <FilterButton active={activityFilter === "travel"} onClick={() => setActivityFilter("travel")}>Travel</FilterButton>
            <FilterButton active={activityFilter === "failures"} onClick={() => setActivityFilter("failures")}>Failures</FilterButton>
          </div>
          <ScrollArea className="flex-1 px-3 py-2">
            {filteredActivity.length === 0 ? (
              <Empty text="No activity matches the current filter." />
            ) : (
              <div className="space-y-2.5 min-h-max pb-3">
                {filteredActivity.slice(-32).reverse().map((item, i) => (
                  <article key={`${item.tick}-${item.actor_id}-${i}`} className={`rounded-xl border p-3 backdrop-blur-[10px] backdrop-saturate-180 shadow-sm ${item.success === false ? "border-red-500/30 bg-red-500/10" : "border-white/20 bg-white/10"}`}>
                    <div className="mb-2.5 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.15em] text-zinc-500">
                      <span>{item.time_ms != null ? `Live ${formatLiveTime(item.time_ms)}` : `Live step ${item.tick}`}</span>
                      <span>{item.action}</span>
                    </div>
                    <div className="mb-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="h-5 text-[10px]">{item.human_name}</Badge>
                      <Badge variant="outline" className="h-5 text-[10px]">{item.group_name}</Badge>
                      <Badge variant={item.provider === "heuristic" ? "muted" : "default"} className="h-5 text-[10px]">
                        {item.provider}{item.model ? ` · ${item.model}` : ""}
                      </Badge>
                      <Badge variant="outline" className={`h-5 text-[10px] ${item.success === false ? "border-red-500/40 bg-red-500/10 text-red-200" : ""}`}>
                        {item.success === false ? "failed" : "ok"}
                      </Badge>
                    </div>
                    <p className="text-[11px] leading-4 text-zinc-100">{item.intent || item.reason || "No intent recorded."}</p>
                    {item.speech ? <p className="mt-1 text-[11px] leading-4 text-zinc-300">Speech: "{item.speech}"</p> : null}
                    {item.communication ? <p className="mt-1 text-[11px] leading-4 text-zinc-400">Message: {item.communication}</p> : null}
                    {item.result ? <p className="mt-1 text-[11px] leading-4 text-zinc-400">Result: {item.result}</p> : null}
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
              <div className="space-y-2 min-h-max pb-3">
                {statusItems.slice(-24).reverse().map((item, i) => (
                  <article key={`${item.tick ?? "s"}-${i}`} className="rounded-xl border border-white/20 bg-white/10 p-3 backdrop-blur-[10px] backdrop-saturate-180 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.15em] text-zinc-500">
                      <span className={item.type === "error" ? "text-red-400 font-bold" : ""}>{item.type}</span>
                      <span>{item.time_ms != null ? `Live ${formatLiveTime(item.time_ms)}` : item.tick != null ? `Live step ${item.tick}` : "Sys"}</span>
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
              <div className="space-y-2 min-h-max pb-3">
                {debugLines.slice(-30).reverse().map((line, i) => (
                  <article key={`${line.tick ?? "d"}-${i}`} className="rounded-xl border border-white/6 bg-black/40 p-3 shadow-sm">
                    <div className="mb-2 flex items-center justify-between gap-2 text-[9px] uppercase tracking-[0.15em] text-zinc-500">
                      <span className={line.type === "error" ? "text-red-500 font-bold" : ""}>{line.type}</span>
                      <span>{line.tick != null ? `Live step ${line.tick}` : "Sys"}</span>
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
        {running ? `Live ${formatLiveTime(liveTimeMs)} · Live step ${currentTick}` : "Idle"}
      </div>
    </div>
  );
}

function FilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-6 items-center justify-center rounded-full px-3 text-[10px] font-medium uppercase tracking-widest transition-colors ${
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
