"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Copy,
  Play,
  Plus,
  Radar,
  RefreshCcw,
  Settings2,
  Sparkles,
  Trash2,
  UsersRound
} from "lucide-react";

import AtlasMetrics from "@/components/atlas-metrics";
import CivilizationSettingsSheet from "@/components/civilization-settings-sheet";
import InspectorTabs from "@/components/inspector-tabs";
import PixelWorldMap from "@/components/pixel-world-map";
import SimulationConsole from "@/components/simulation-console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  PROVIDER_OPTIONS,
  addGroup,
  normalizeSettings,
  providerDisplayName,
  synthesizeScenario,
  updateGroup,
  updateGroupController,
  updateGroupPopulation,
  updateHumanBlueprint,
  removeGroup
} from "@/lib/civilization-setup";


const PRESET_OPTIONS = [
  { value: "grand-continent", label: "Grand Continent" },
  { value: "archipelago", label: "Archipelago" },
  { value: "highland-realms", label: "Highland Realms" }
];

const SIZE_OPTIONS = [64, 96, 128, 160];

const INITIAL_OVERLAYS = {
  territories: true,
  roads: true,
  resources: false,
  humans: true
};


export default function GridNomadDashboard() {
  const [templateScenario, setTemplateScenario] = useState(null);
  const [settings, setSettings] = useState({ world: {}, groups: [] });
  const [world, setWorld] = useState(null);
  const [ticks, setTicks] = useState(40);
  const [events, setEvents] = useState([]);
  const [statusItems, setStatusItems] = useState([]);
  const [debugLines, setDebugLines] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Generate a seeded world, then run the live population stream.");
  const [providerCatalogs, setProviderCatalogs] = useState({});
  const [opencodeCredentials, setOpencodeCredentials] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState("groups");
  const [selectedTile, setSelectedTile] = useState(null);
  const [hoverTile, setHoverTile] = useState(null);
  const [overlays, setOverlays] = useState(INITIAL_OVERLAYS);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const abortRef = useRef(null);

  const scenario = useMemo(() => {
    if (!templateScenario) {
      return null;
    }
    return synthesizeScenario(templateScenario, settings);
  }, [templateScenario, settings]);

  const focusedTile = selectedTile ?? hoverTile;
  const inspector = useMemo(() => buildInspector(world, scenario, focusedTile), [world, scenario, focusedTile]);
  const metrics = useMemo(() => buildMetrics(world), [world]);
  const territoryLookup = useMemo(() => world?.territories ?? {}, [world]);

  useEffect(() => {
    void bootstrap();
    return () => abortRef.current?.abort();
  }, []);

  async function bootstrap() {
    setLoading(true);
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const payload = await response.json();
      const normalized = normalizeSettings(payload.templateScenario, payload.settings);
      setTemplateScenario(payload.templateScenario);
      setSettings(normalized);
      await Promise.all([
        refreshOpencodeStatus(true),
        refreshProviderCatalogs(normalized, true)
      ]);
      if (payload.preview) {
        setWorld(payload.preview);
      } else {
        await generateWorld(normalized, true);
      }
      setStatusMessage("Project loaded. The map is ready for group edits or a live run.");
    } catch (error) {
      pushStatus("error", "Project bootstrap failed.");
      pushDebug("bootstrap", String(error));
      setStatusMessage("Project bootstrap failed. Check the debug console.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshOpencodeStatus(silent = false) {
    try {
      const response = await fetch("/api/providers/opencode/status", { cache: "no-store" });
      const payload = await response.json();
      setOpencodeCredentials(payload.credentials ?? []);
      if (!silent) {
        pushStatus("provider", `OpenCode credentials refreshed: ${(payload.credentials ?? []).length}.`);
      }
      if (payload.stderr) {
        pushDebug("provider", payload.stderr);
      }
    } catch (error) {
      if (!silent) {
        pushStatus("error", "Could not refresh OpenCode credentials.");
      }
      pushDebug("provider", String(error));
    }
  }

  async function refreshProviderCatalog(groupId, provider, credential = "", silent = false) {
    try {
      const params = new URLSearchParams({ provider });
      if (credential) {
        params.set("credential", credential);
      }
      const response = await fetch(`/api/providers/catalog?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      setProviderCatalogs((current) => ({ ...current, [groupId]: payload }));
      if (templateScenario) {
        setSettings((current) => updateGroupController(current, templateScenario, groupId, {
          availableModels: payload.models ?? [],
          supportsModelListing: Boolean(payload.supports_model_listing),
          supportsManualModelEntry: Boolean(payload.supports_manual_model_entry)
        }));
      }
      if (!silent) {
        pushStatus("provider", payload.ok
          ? `Loaded ${payload.models?.length ?? 0} models for ${providerDisplayName(provider)}.`
          : `Could not load models for ${providerDisplayName(provider)}.`);
      }
      if (payload.stderr) {
        pushDebug("provider", payload.stderr);
      }
    } catch (error) {
      if (!silent) {
        pushStatus("error", `Could not load the ${providerDisplayName(provider)} model catalog.`);
      }
      pushDebug("provider", String(error));
    }
  }

  async function refreshProviderCatalogs(nextSettings, silent = false) {
    for (const group of nextSettings.groups ?? []) {
      const provider = group.controller?.provider ?? "heuristic";
      if (provider === "heuristic") {
        setProviderCatalogs((current) => ({
          ...current,
          [group.id]: {
            ok: true,
            provider,
            models: [],
            supports_model_listing: false,
            supports_manual_model_entry: false,
            auth_status: "local",
            login_hint: "This group uses the local heuristic controller."
          }
        }));
        continue;
      }
      await refreshProviderCatalog(group.id, provider, group.controller?.opencodeProvider ?? "", silent);
    }
  }

  async function saveSettings(nextSettings = settings, silent = false) {
    setWorking(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings)
      });
      const payload = await response.json();
      const normalized = normalizeSettings(payload.templateScenario, payload.settings);
      setTemplateScenario(payload.templateScenario);
      setSettings(normalized);
      if (!silent) {
        pushStatus("settings", "Project settings saved.");
        setStatusMessage("Project settings saved.");
      }
      return normalized;
    } catch (error) {
      pushStatus("error", "Saving project settings failed.");
      pushDebug("settings", String(error));
      setStatusMessage("Saving settings failed.");
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function generateWorld(nextSettings = settings, silent = false) {
    setWorking(true);
    try {
      const response = await fetch("/api/worlds/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: nextSettings })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.stderr || payload.stdout || "World generation failed.");
      }
      setWorld(payload.world);
      setCurrentTick(payload.world?.tick ?? 0);
      if (!silent) {
        pushStatus("generation", `Generated world ${payload.world?.seed}.`);
        setStatusMessage(`Generated ${payload.world?.width} x ${payload.world?.height} world from seed ${payload.world?.seed}.`);
      }
      return payload.world;
    } catch (error) {
      pushStatus("error", "World generation failed.");
      pushDebug("generation", String(error));
      setStatusMessage("World generation failed. Check the debug console.");
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function runSimulationLive() {
    if (running) {
      return;
    }
    setRunning(true);
    setEvents([]);
    setStatusItems([]);
    setDebugLines([]);
    setCurrentTick(0);
    setStatusMessage("Starting the live stream...");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/simulations/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticks, settings }),
        signal: controller.signal
      });
      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `Simulation stream failed with status ${response.status}.`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          handleStreamLine(line);
        }
      }

      if (buffer.trim()) {
        handleStreamLine(buffer);
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        pushStatus("error", "The live simulation stream failed.");
        pushDebug("stream", String(error));
        setStatusMessage("The live simulation stream failed.");
      }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  function handleStreamLine(line) {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    let payload;
    try {
      payload = JSON.parse(trimmed);
    } catch (error) {
      pushDebug("stream", `Non-JSON line: ${trimmed}`);
      pushDebug("stream", String(error));
      return;
    }

    if (payload.type === "snapshot" && payload.snapshot?.world) {
      setWorld(payload.snapshot.world);
      setCurrentTick(payload.tick ?? payload.snapshot.world.tick ?? 0);
      return;
    }
    if (payload.type === "event" && payload.event) {
      setEvents((current) => [...current, payload.event]);
      return;
    }
    if (payload.type === "status") {
      setCurrentTick(payload.tick ?? 0);
      pushStatus("status", payload.message ?? "Tick complete.", payload.tick);
      setStatusMessage(payload.message ?? "Tick complete.");
      return;
    }
    if (payload.type === "run_started") {
      pushStatus("run_started", `Live run started for ${payload.ticks} ticks.`, 0);
      for (const controller of payload.controllers ?? []) {
        pushStatus(
          "controller",
          `${controller.group_name}: ${providerDisplayName(controller.provider)}${controller.model ? ` (${controller.model})` : ""}`,
          0
        );
      }
      setStatusMessage(`Streaming the run live for ${payload.ticks} ticks.`);
      return;
    }
    if (payload.type === "provider_status") {
      const providerSummary = `${providerDisplayName(payload.provider)}${payload.model ? ` (${payload.model})` : ""}`;
      pushStatus(
        "provider",
        `${payload.faction_id}: ${providerSummary} fallback triggered. ${payload.message ?? ""}`.trim(),
        payload.tick
      );
      pushDebug(
        "provider",
        `${payload.faction_id}: ${providerSummary} -> ${payload.message ?? "Provider issue."}`.trim(),
        payload.tick
      );
      return;
    }
    if (payload.type === "stderr") {
      pushDebug("stderr", payload.text ?? payload.message ?? "", payload.tick);
      return;
    }
    if (payload.type === "complete") {
      if (payload.snapshot?.world) {
        setWorld(payload.snapshot.world);
      }
      pushStatus("complete", `Run complete. ${payload.event_count ?? 0} events recorded.`, payload.tick);
      setStatusMessage(`Run complete at tick ${payload.tick}.`);
      return;
    }
    if (payload.type === "error") {
      pushStatus("error", payload.message ?? "Simulation error.", payload.tick);
      pushDebug("error", payload.message ?? "Simulation error.", payload.tick);
      setStatusMessage(payload.message ?? "Simulation error.");
      return;
    }

    pushDebug("stream", trimmed);
  }

  function pushStatus(type, message, tick = null) {
    setStatusItems((current) => [...current, { type, message, tick }]);
  }

  function pushDebug(type, message, tick = null) {
    setDebugLines((current) => [...current, { type, message, tick }]);
  }

  function patchWorld(patch) {
    setSettings((current) => ({
      ...current,
      world: { ...current.world, ...patch }
    }));
  }

  function patchGroup(groupId, patch) {
    if (!templateScenario) {
      return;
    }
    setSettings((current) => updateGroup(current, templateScenario, groupId, patch));
  }

  function patchGroupController(groupId, patch) {
    if (!templateScenario) {
      return;
    }
    setSettings((current) => updateGroupController(current, templateScenario, groupId, patch));
  }

  function patchPopulation(groupId, population) {
    if (!templateScenario) {
      return;
    }
    setSettings((current) => updateGroupPopulation(current, templateScenario, groupId, population));
  }

  function patchHuman(groupId, humanId, patch) {
    setSettings((current) => updateHumanBlueprint(current, groupId, humanId, patch));
  }

  function addCommunityGroup() {
    if (!templateScenario) {
      return;
    }
    setSettings((current) => addGroup(current, templateScenario));
  }

  function deleteCommunityGroup(groupId) {
    if (!templateScenario) {
      return;
    }
    setSettings((current) => removeGroup(current, templateScenario, groupId));
  }

  async function handleProviderChange(groupId, provider) {
    patchGroupController(groupId, { provider, model: "" });
    const group = settings.groups.find((item) => item.id === groupId);
    if (provider !== "heuristic") {
      await refreshProviderCatalog(groupId, provider, group?.controller?.opencodeProvider ?? "");
    }
  }

  async function handleProviderCredentialChange(groupId, credential) {
    patchGroupController(groupId, { opencodeProvider: credential });
    await refreshProviderCatalog(groupId, "opencode", credential);
  }

  async function launchProviderLogin(provider) {
    try {
      const route = provider === "gemini-cli" ? "/api/providers/gemini/login" : "/api/providers/opencode/login";
      const response = await fetch(route, { method: "POST" });
      const payload = await response.json();
      pushStatus("provider", payload.message ?? `${provider} login launched.`);
      setStatusMessage(payload.message ?? `${provider} login launched.`);
    } catch (error) {
      pushStatus("error", `Could not launch ${provider} login.`);
      pushDebug("provider", String(error));
    }
  }

  async function copySeed() {
    try {
      await navigator.clipboard.writeText(String(settings.world?.seed ?? ""));
      pushStatus("clipboard", `Copied seed ${settings.world?.seed}.`);
      setStatusMessage(`Seed ${settings.world?.seed} copied to clipboard.`);
    } catch (error) {
      pushDebug("clipboard", String(error));
      setStatusMessage("Clipboard access is unavailable.");
    }
  }

  function randomizeSeed() {
    patchWorld({ seed: Math.floor(Math.random() * 900000) + 100000 });
  }

  function toggleOverlay(key) {
    setOverlays((current) => ({ ...current, [key]: !current[key] }));
  }

  const busy = loading || working || running;

  return (
    <div className="min-h-screen bg-black px-4 py-4 text-zinc-100 sm:px-5 lg:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1900px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px] xl:grid-rows-[auto_minmax(0,1fr)_320px]">
        <GroupRail
          groups={settings.groups ?? []}
          busy={busy}
          onAddGroup={addCommunityGroup}
          onDeleteGroup={deleteCommunityGroup}
          onUpdateGroup={patchGroup}
          onUpdatePopulation={patchPopulation}
          onProviderChange={handleProviderChange}
          onOpenTab={(tab) => {
            setSheetTab(tab);
            setSheetOpen(true);
          }}
          className="atlas-rail-shell xl:row-span-3"
        />

        <CommandDeck
          className="atlas-command-shell xl:col-start-2 xl:row-start-1"
          worldSettings={settings.world ?? {}}
          ticks={ticks}
          overlays={overlays}
          busy={busy}
          statusMessage={statusMessage}
          metrics={metrics}
          onSeedChange={(seed) => patchWorld({ seed })}
          onPresetChange={(generatorPreset) => patchWorld({ generatorPreset })}
          onSizeChange={(size) => patchWorld({ width: size, height: size })}
          onTicksChange={(value) => setTicks(clampTicks(value))}
          onToggleOverlay={toggleOverlay}
          onRandomizeSeed={randomizeSeed}
          onCopySeed={copySeed}
          onGenerateWorld={() => generateWorld()}
          onRunSimulation={runSimulationLive}
          onOpenSetup={() => {
            setSheetTab("world");
            setSheetOpen(true);
          }}
          onOpenControllers={() => {
            setSheetTab("controllers");
            setSheetOpen(true);
          }}
        />

        <div className="xl:col-start-2 xl:row-start-2">
          <Card className="atlas-stage-shell h-full overflow-hidden">
            <CardHeader className="border-b border-white/8 pb-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="text-lg">World stage</CardTitle>
                  <CardDescription>
                    Humans render as tiny moving swarms. The controller stays invisible while the population becomes the thing you watch.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={running ? "solid" : "muted"}>{running ? "Streaming live" : "Standing by"}</Badge>
                  <Badge variant="muted">Tick {currentTick}</Badge>
                  <Badge variant="muted">{metrics.aliveHumans} humans</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex h-full min-h-[560px] flex-col gap-4 p-4">
              <AtlasMetrics metrics={metrics} />
              <div className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/8 bg-black/80">
                {world ? (
                  <PixelWorldMap
                    world={world}
                    overlays={overlays}
                    selectedTile={selectedTile}
                    onHoverTile={setHoverTile}
                    onSelectTile={setSelectedTile}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-zinc-500">
                    Generate a world to populate the map.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <InspectorTabs
          scenario={scenario}
          inspector={inspector}
          events={events}
          communications={world?.communications ?? []}
          territorySummary={buildTerritorySummary(world, inspector)}
          className="atlas-rail-shell xl:col-start-3 xl:row-span-3"
          panelHeightClass="h-[calc(100vh-18rem)] min-h-[640px]"
        />

        <div className="xl:col-start-2 xl:row-start-3">
          <SimulationConsole
            events={events}
            statusItems={statusItems}
            debugLines={debugLines}
            running={running}
            currentTick={currentTick}
          />
        </div>
      </div>

      <CivilizationSettingsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        activeTab={sheetTab}
        onTabChange={setSheetTab}
        settings={settings}
        providerCatalogs={providerCatalogs}
        opencodeCredentials={opencodeCredentials}
        territoryLookup={territoryLookup}
        busy={busy}
        onUpdateWorld={patchWorld}
        onAddGroup={addCommunityGroup}
        onDeleteGroup={deleteCommunityGroup}
        onUpdateGroup={patchGroup}
        onUpdateController={patchGroupController}
        onUpdatePopulation={patchPopulation}
        onUpdateHuman={patchHuman}
        onSaveSettings={() => saveSettings()}
        onGenerateWorld={() => generateWorld()}
        onRefreshOpencodeStatus={() => refreshOpencodeStatus()}
        onRefreshProviderCatalog={(groupId, provider, credential) => refreshProviderCatalog(groupId, provider, credential)}
        onProviderChange={handleProviderChange}
        onProviderCredentialChange={handleProviderCredentialChange}
        onLaunchProviderLogin={launchProviderLogin}
      />
    </div>
  );
}


function GroupRail({
  groups,
  busy,
  onAddGroup,
  onDeleteGroup,
  onUpdateGroup,
  onUpdatePopulation,
  onProviderChange,
  onOpenTab,
  className
}) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardHeader className="border-b border-white/8 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Community groups</CardTitle>
            <CardDescription>
              Add or remove groups, set their human count, and choose the controller that powers them.
            </CardDescription>
          </div>
          <Button variant="secondary" size="icon" onClick={onAddGroup} disabled={busy}>
            <Plus className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex h-full min-h-0 flex-col gap-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <MiniMetric icon={UsersRound} label="Groups" value={String(groups.length)} />
          <MiniMetric icon={Radar} label="Humans" value={String(groups.reduce((sum, group) => sum + (group.population_count ?? 0), 0))} />
          <MiniMetric icon={Bot} label="Providers" value={String(new Set(groups.map((group) => group.controller?.provider ?? "heuristic")).size)} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => onOpenTab("groups")}>
            <Settings2 className="size-4" />
            Full setup
          </Button>
          <Button variant="secondary" onClick={() => onOpenTab("humans")}>
            <UsersRound className="size-4" />
            Human roster
          </Button>
        </div>

        <ScrollArea className="min-h-0 flex-1 pr-2">
          <div className="space-y-4">
            {groups.map((group, index) => (
              <article key={group.id} className="rounded-[28px] border border-white/8 bg-black/55 p-4">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-2xl border border-white/10" style={{ backgroundColor: group.color }} />
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">Group {index + 1}</p>
                      <p className="text-sm font-medium text-zinc-100">{group.id}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDeleteGroup(group.id)}
                    disabled={busy || groups.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>

                <div className="space-y-3">
                  <Field label="Name">
                    <Input value={group.name} onChange={(event) => onUpdateGroup(group.id, { name: event.target.value })} />
                  </Field>
                  <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-3 text-xs leading-6 text-zinc-400">
                    {providerDisplayName(group.controller?.provider ?? "heuristic")}
                    {group.controller?.model ? ` · ${group.controller.model}` : ""}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <Field label="Population">
                      <Input
                        type="number"
                        min="1"
                        max="48"
                        value={group.population_count}
                        onChange={(event) => onUpdatePopulation(group.id, Number(event.target.value))}
                      />
                    </Field>
                    <Field label="Controller">
                      <Select value={group.controller?.provider ?? "heuristic"} onValueChange={(value) => onProviderChange(group.id, value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDER_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[72px_minmax(0,1fr)] xl:grid-cols-1">
                    <Field label="Color">
                      <Input
                        type="color"
                        value={group.color}
                        onChange={(event) => onUpdateGroup(group.id, { color: event.target.value })}
                        className="h-10 p-1"
                      />
                    </Field>
                    <Field label="Culture seed">
                      <Input
                        value={group.culture?.[0]?.element ?? ""}
                        onChange={(event) => onUpdateGroup(group.id, {
                          culture: [{ ...(group.culture?.[0] ?? {}), element: event.target.value }]
                        })}
                      />
                    </Field>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}


function CommandDeck({
  className,
  worldSettings,
  ticks,
  overlays,
  busy,
  statusMessage,
  metrics,
  onSeedChange,
  onPresetChange,
  onSizeChange,
  onTicksChange,
  onToggleOverlay,
  onRandomizeSeed,
  onCopySeed,
  onGenerateWorld,
  onRunSimulation,
  onOpenSetup,
  onOpenControllers
}) {
  return (
    <Card className={`overflow-hidden ${className}`}>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="solid">GridNomad</Badge>
              <Badge variant="muted">Live groups</Badge>
              <Badge variant="muted">{metrics.aliveHumans} humans visible</Badge>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-zinc-50 sm:text-4xl">
                Run human swarms on a dark atlas.
              </h1>
              <p className="max-w-4xl text-sm leading-7 text-zinc-400">
                Controllers power each group in the background, while the population itself becomes the thing you watch on the map.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onOpenSetup}>
              <Settings2 className="size-4" />
              Setup
            </Button>
            <Button variant="secondary" onClick={onOpenControllers}>
              <Bot className="size-4" />
              Controllers
            </Button>
            <Button variant="secondary" onClick={onGenerateWorld} disabled={busy}>
              <Sparkles className="size-4" />
              {busy ? "Working..." : "Generate"}
            </Button>
            <Button variant="default" onClick={onRunSimulation} disabled={busy}>
              <Play className="size-4" />
              {busy ? "Busy" : "Run live"}
            </Button>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <div className="grid gap-3 rounded-[28px] border border-white/8 bg-black/60 p-3 md:grid-cols-[160px_190px_150px_130px_auto]">
            <Field label="Seed">
              <Input type="number" value={worldSettings.seed ?? ""} onChange={(event) => onSeedChange(Number(event.target.value))} />
            </Field>
            <Field label="Preset">
              <Select value={worldSettings.generatorPreset ?? "grand-continent"} onValueChange={onPresetChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Map size">
              <Select value={String(worldSettings.width ?? 128)} onValueChange={(value) => onSizeChange(Number(value))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} x {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Ticks">
              <Input type="number" min="1" max="500" value={ticks} onChange={(event) => onTicksChange(Number(event.target.value))} />
            </Field>
            <div className="flex flex-wrap items-end gap-2">
              <Button variant="ghost" size="sm" onClick={onCopySeed}>
                <Copy className="size-3.5" />
                Copy seed
              </Button>
              <Button variant="ghost" size="sm" onClick={onRandomizeSeed} disabled={busy}>
                <RefreshCcw className="size-3.5" />
                Randomize
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-[28px] border border-white/8 bg-black/60 p-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(overlays).map(([key, enabled]) => (
                <Button key={key} variant={enabled ? "default" : "secondary"} size="sm" onClick={() => onToggleOverlay(key)}>
                  {labelForOverlay(key)}
                </Button>
              ))}
            </div>
            <p className="text-sm leading-6 text-zinc-400">{statusMessage}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}


function MiniMetric({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-black/50 p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
        <Icon className="size-4 text-zinc-300" />
      </div>
      <p className="text-2xl font-semibold tracking-tight text-zinc-50">{value}</p>
    </div>
  );
}


function Field({ label, children }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}


function buildMetrics(world) {
  const aliveHumans = Object.values(world?.agents ?? {}).filter((human) => human.alive !== false).length;
  const landmarkKinds = new Set(["landmark", "palace", "shrine", "monument", "citadel", "ruin"]);
  const landmarks = (world?.props ?? []).filter((prop) => landmarkKinds.has(prop.kind)).length;
  return {
    aliveHumans,
    settlements: world?.settlements?.length ?? 0,
    landmarks,
    seed: world?.seed ?? "n/a"
  };
}


function buildInspector(world, scenario, point) {
  if (!world || !point) {
    return null;
  }
  const tile = world.tiles?.[point.y]?.[point.x];
  if (!tile) {
    return null;
  }
  const humans = Object.values(world.agents ?? {}).filter((human) => (
    human.alive !== false && human.x === point.x && human.y === point.y
  ));
  const structures = [
    ...(tile.feature ? [tile.feature] : []),
    ...(world.props ?? []).filter((prop) => prop.x === point.x && prop.y === point.y).map((prop) => prop.kind)
  ];
  const humansByGroup = Object.entries(humans.reduce((accumulator, human) => {
    accumulator[human.faction_id] = (accumulator[human.faction_id] ?? 0) + 1;
    return accumulator;
  }, {})).map(([groupId, count]) => ({
    groupId,
    groupName: scenario?.factions?.find((group) => group.id === groupId)?.name ?? groupId,
    count
  }));
  return {
    tile,
    region: tile.region_id ? world.regions?.[tile.region_id] ?? null : null,
    structures,
    humans,
    humansByGroup
  };
}


function buildTerritorySummary(world, inspector) {
  const owner = inspector?.tile?.owner_faction;
  if (!owner) {
    return "This tile is currently unclaimed.";
  }
  const territory = world?.territories?.[owner];
  if (!territory) {
    return `Controlled by ${owner}.`;
  }
  return `${owner} controls ${territory.tile_count} tiles across ${territory.region_ids?.length ?? 0} regions.${territory.capital_id ? ` Capital: ${territory.capital_id}.` : ""}`;
}


function labelForOverlay(key) {
  if (key === "humans") {
    return "Humans";
  }
  if (key === "territories") {
    return "Territories";
  }
  if (key === "roads") {
    return "Roads";
  }
  return "Resources";
}


function clampTicks(value) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, Math.min(500, Math.trunc(value)));
}
