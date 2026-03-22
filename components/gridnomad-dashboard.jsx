"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dice5,
  Layers,
  PanelLeft,
  PanelRight,
  Play,
  Plus,
  RefreshCcw,
  Settings2,
  Trash2,
  Users
} from "lucide-react";

import CivilizationSettingsSheet from "@/components/civilization-settings-sheet";
import InspectorTabs from "@/components/inspector-tabs";
import PixelWorldMap from "@/components/pixel-world-map";
import SimulationConsole from "@/components/simulation-console";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  addGroup,
  normalizeSettings,
  providerDisplayName,
  removeGroup,
  synthesizeScenario,
  totalConfiguredPopulation,
  updateGroup,
  updateGroupController
} from "@/lib/civilization-setup";

const PRESET_OPTIONS = [
  { value: "grand-continent", label: "Grand Continent" },
  { value: "archipelago", label: "Archipelago" },
  { value: "highland-realms", label: "Highland Realms" }
];

const SIZE_OPTIONS = [64, 96, 128, 160];

const INITIAL_OVERLAYS = {
  humans: true,
  roads: true,
  resources: false,
  structures: true
};

const PROVIDER_LIST = [
  { value: "heuristic", label: "Heuristic" },
  { value: "gemini-cli", label: "Gemini CLI" },
  { value: "gemini-api", label: "Gemini API" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "opencode", label: "OpenCode" }
];


export default function GridNomadDashboard() {
  const [templateScenario, setTemplateScenario] = useState(null);
  const [settings, setSettings] = useState({ world: {}, groups: [] });
  const [world, setWorld] = useState(null);
  const [ticks, setTicks] = useState(40);
  const [events, setEvents] = useState([]);
  const [statusItems, setStatusItems] = useState([]);
  const [debugLines, setDebugLines] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Set up groups, assign controllers, and stream.");
  const [providerCatalogs, setProviderCatalogs] = useState({});
  const [opencodeCredentials, setOpencodeCredentials] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState("groups");
  const [selectedTile, setSelectedTile] = useState(null);
  const [hoverTile, setHoverTile] = useState(null);
  const [selectedHumanId, setSelectedHumanId] = useState(null);
  const [overlays, setOverlays] = useState(INITIAL_OVERLAYS);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const abortRef = useRef(null);

  const scenario = useMemo(() => {
    if (!templateScenario) return null;
    return synthesizeScenario(templateScenario, settings);
  }, [templateScenario, settings]);

  const focusedTile = selectedTile ?? hoverTile;
  const inspector = useMemo(
    () => buildInspector(world, scenario, focusedTile, selectedHumanId, events),
    [world, scenario, focusedTile, selectedHumanId, events]
  );
  const metrics = useMemo(() => buildMetrics(world, settings), [world, settings]);

  useEffect(() => {
    void bootstrap();
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!selectedHumanId || !world) return;
    const human = findHumans(world).find((e) => e.id === selectedHumanId && e.alive !== false);
    if (!human) { setSelectedHumanId(null); return; }
    setSelectedTile({ x: human.x, y: human.y });
  }, [selectedHumanId, world]);

  async function bootstrap() {
    setLoading(true);
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const payload = await response.json();
      const normalized = normalizeSettings(payload.templateScenario, payload.settings);
      setTemplateScenario(payload.templateScenario);
      setSettings(normalized);
      await Promise.all([refreshOpencodeStatus(true), refreshProviderCatalogs(normalized, true)]);
      if (payload.preview) {
        setWorld(payload.preview);
      } else {
        await generateWorld(normalized, true);
      }
      setStatusMessage("Sandbox loaded. Choose controllers and stream.");
    } catch (error) {
      pushStatus("error", "Bootstrap failed.");
      pushDebug("bootstrap", String(error));
      setStatusMessage("Bootstrap failed.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshOpencodeStatus(silent = false) {
    try {
      const response = await fetch("/api/providers/opencode/status", { cache: "no-store" });
      const payload = await response.json();
      setOpencodeCredentials(payload.credentials ?? []);
      if (!silent) pushStatus("provider", `OpenCode credentials: ${(payload.credentials ?? []).length}.`);
      if (payload.stderr) pushDebug("provider", payload.stderr);
    } catch (error) {
      if (!silent) pushStatus("error", "Could not refresh OpenCode credentials.");
      pushDebug("provider", String(error));
    }
  }

  async function refreshProviderCatalog(scope, entityId, provider, credential = "", silent = false) {
    try {
      const params = new URLSearchParams({ provider });
      if (credential) params.set("credential", credential);
      const response = await fetch(`/api/providers/catalog?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      setProviderCatalogs((c) => ({ ...c, [catalogKey(scope, entityId)]: payload }));
      if (!silent) pushStatus("provider", payload.ok ? `${payload.models?.length ?? 0} models for ${providerDisplayName(provider)}.` : `Could not load models.`);
      if (payload.stderr) pushDebug("provider", payload.stderr);
    } catch (error) {
      if (!silent) pushStatus("error", `Could not load ${providerDisplayName(provider)} catalog.`);
      pushDebug("provider", String(error));
    }
  }

  async function refreshProviderCatalogs(nextSettings, silent = false) {
    for (const group of nextSettings.groups ?? []) {
      const provider = group.controller?.provider ?? "heuristic";
      if (provider === "heuristic") {
        setProviderCatalogs((c) => ({ ...c, [catalogKey("group", group.id)]: { ok: true, provider, models: [], supports_model_listing: false, supports_manual_model_entry: false, auth_status: "local", login_hint: "Heuristic is local." } }));
        continue;
      }
      await refreshProviderCatalog("group", group.id, provider, group.controller?.opencodeProvider ?? "", silent);
    }
  }

  async function saveSettings(nextSettings = settings, silent = false) {
    setWorking(true);
    try {
      const response = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextSettings) });
      const payload = await response.json();
      const normalized = normalizeSettings(payload.templateScenario, payload.settings);
      setTemplateScenario(payload.templateScenario);
      setSettings(normalized);
      if (!silent) { pushStatus("settings", "Settings saved."); setStatusMessage("Settings saved."); }
      return normalized;
    } catch (error) {
      pushStatus("error", "Save failed.");
      pushDebug("settings", String(error));
      setStatusMessage("Save failed.");
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function generateWorld(nextSettings = settings, silent = false) {
    setWorking(true);
    try {
      const response = await fetch("/api/worlds/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: nextSettings }) });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.stderr || payload.stdout || "Generation failed.");
      setWorld(payload.world);
      setCurrentTick(payload.world?.tick ?? 0);
      setSelectedHumanId(null);
      if (!silent) { pushStatus("generation", `World ${payload.world?.seed} generated.`); setStatusMessage(`${payload.world?.width}×${payload.world?.height} world from seed ${payload.world?.seed}.`); }
      return payload.world;
    } catch (error) {
      pushStatus("error", "Generation failed.");
      pushDebug("generation", String(error));
      setStatusMessage("Generation failed.");
      return null;
    } finally {
      setWorking(false);
    }
  }

  async function runSimulationLive() {
    if (running) return;
    setRunning(true);
    setEvents([]); setStatusItems([]); setDebugLines([]); setCurrentTick(0);
    setStatusMessage("Starting live stream...");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/simulations/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticks, settings }), signal: controller.signal });
      if (!response.ok || !response.body) { const text = await response.text().catch(() => ""); throw new Error(text || `Stream failed (${response.status}).`); }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() ?? "";
        for (const line of lines) handleStreamLine(line);
      }
      if (buffer.trim()) handleStreamLine(buffer);
    } catch (error) {
      if (error?.name !== "AbortError") { pushStatus("error", "Stream failed."); pushDebug("stream", String(error)); setStatusMessage("Stream failed."); }
    } finally {
      abortRef.current = null;
      setRunning(false);
    }
  }

  function handleStreamLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    let payload;
    try { payload = JSON.parse(trimmed); } catch { pushDebug("stream", `Non-JSON: ${trimmed}`); return; }
    if (payload.type === "snapshot" && payload.snapshot?.world) { setWorld(payload.snapshot.world); setCurrentTick(payload.tick ?? payload.snapshot.world.tick ?? 0); return; }
    if (payload.type === "event" && payload.event) { setEvents((c) => [...c, payload.event]); return; }
    if (payload.type === "status") { setCurrentTick(payload.tick ?? 0); pushStatus("status", payload.message ?? "Tick complete.", payload.tick); setStatusMessage(payload.message ?? "Tick complete."); return; }
    if (payload.type === "run_started") {
      pushStatus("run_started", `Live: ${payload.ticks} ticks.`, 0);
      for (const ctrl of payload.controllers ?? []) pushStatus("controller", `${ctrl.group_name ?? ctrl.faction_id}: ${providerDisplayName(ctrl.provider)}${ctrl.model ? ` (${ctrl.model})` : ""}`, 0);
      setStatusMessage(`Streaming ${payload.ticks} ticks.`);
      return;
    }
    if (payload.type === "provider_status") { pushStatus("provider", `${payload.faction_id}: fallback.`, payload.tick); pushDebug("provider", `${payload.faction_id}: ${payload.message ?? ""}`, payload.tick); return; }
    if (payload.type === "stderr") { pushDebug("stderr", payload.text ?? payload.message ?? "", payload.tick); return; }
    if (payload.type === "complete") { if (payload.snapshot?.world) setWorld(payload.snapshot.world); pushStatus("complete", `Done. ${payload.event_count ?? 0} events.`, payload.tick); setStatusMessage(`Complete at tick ${payload.tick}.`); return; }
    if (payload.type === "error") { pushStatus("error", payload.message ?? "Error.", payload.tick); pushDebug("error", payload.message ?? "Error.", payload.tick); setStatusMessage(payload.message ?? "Error."); return; }
    pushDebug("stream", trimmed);
  }

  function pushStatus(type, message, tick = null) { setStatusItems((c) => [...c, { type, message, tick }]); }
  function pushDebug(type, message, tick = null) { setDebugLines((c) => [...c, { type, message, tick }]); }
  function patchWorld(patch) { setSettings((c) => ({ ...c, world: { ...c.world, ...patch } })); }

  function patchGroup(groupId, patch) {
    if (!templateScenario) return;
    setSettings((c) => updateGroup(c, templateScenario, groupId, patch));
  }
  function patchGroupController(groupId, patch) {
    if (!templateScenario) return;
    setSettings((c) => updateGroupController(c, templateScenario, groupId, patch));
  }
  function addHumanGroup() {
    if (!templateScenario) return;
    setSettings((c) => addGroup(c, templateScenario));
  }
  function deleteHumanGroup(groupId) {
    if (!templateScenario) return;
    setSettings((c) => removeGroup(c, templateScenario, groupId));
  }

  async function handleProviderChange(groupId, provider) {
    patchGroupController(groupId, { provider, model: "" });
    const group = settings.groups.find((i) => i.id === groupId);
    if (provider !== "heuristic") await refreshProviderCatalog("group", groupId, provider, group?.controller?.opencodeProvider ?? "");
  }

  async function handleProviderCredentialChange(groupId, credential) {
    patchGroupController(groupId, { opencodeProvider: credential });
    await refreshProviderCatalog("group", groupId, "opencode", credential);
  }

  async function launchProviderLogin(provider) {
    try {
      const route = provider === "gemini-cli" ? "/api/providers/gemini/login" : "/api/providers/opencode/login";
      const response = await fetch(route, { method: "POST" });
      const payload = await response.json();
      pushStatus("provider", payload.message ?? `${provider} login launched.`);
      setStatusMessage(payload.message ?? `${provider} login launched.`);
    } catch (error) { pushStatus("error", `Could not launch ${provider} login.`); pushDebug("provider", String(error)); }
  }

  async function copySeed() {
    try { await navigator.clipboard.writeText(String(settings.world?.seed ?? "")); pushStatus("clipboard", `Copied seed.`); } catch { setStatusMessage("Clipboard unavailable."); }
  }

  function randomizeSeed() { patchWorld({ seed: Math.floor(Math.random() * 900000) + 100000 }); }
  function toggleOverlay(key) { setOverlays((c) => ({ ...c, [key]: !c[key] })); }
  function handleSelectHuman(human) { setSelectedHumanId(human.id); setSelectedTile({ x: human.x, y: human.y }); }
  function handleSelectTile(tile) { setSelectedTile(tile); if (!tile) setSelectedHumanId(null); }

  const busy = loading || working || running;
  const groups = settings.groups ?? [];

  /* ───────────────────────────── JSX ───────────────────────────── */

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-black text-zinc-100">

      {/* ── TOOLBAR ── */}
      <header className="flex shrink-0 items-center gap-2 border-b border-white/8 bg-black/90 px-3 py-1.5 backdrop-blur-md">
        <Button variant="ghost" size="icon" className="size-8" onClick={() => setLeftOpen((o) => !o)} title="Toggle groups panel">
          <PanelLeft className="size-4" />
        </Button>

        <div className="h-5 w-px bg-white/10" />

        <ToolbarField label="Seed" className="w-24">
          <Input type="number" className="h-7 text-xs" value={settings.world?.seed ?? ""} onChange={(e) => patchWorld({ seed: Number(e.target.value) })} />
        </ToolbarField>
        <Button variant="ghost" size="icon" className="size-7" onClick={randomizeSeed} title="Randomize seed"><Dice5 className="size-3.5" /></Button>
        <Button variant="ghost" size="icon" className="size-7" onClick={copySeed} title="Copy seed"><Copy className="size-3.5" /></Button>

        <ToolbarField label="Preset" className="w-36">
          <Select value={settings.world?.generatorPreset ?? "grand-continent"} onValueChange={(v) => patchWorld({ generatorPreset: v })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{PRESET_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </ToolbarField>

        <ToolbarField label="Size" className="w-24">
          <Select value={String(settings.world?.width ?? 128)} onValueChange={(v) => patchWorld({ width: Number(v), height: Number(v) })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{SIZE_OPTIONS.map((s) => <SelectItem key={s} value={String(s)}>{s}×{s}</SelectItem>)}</SelectContent>
          </Select>
        </ToolbarField>

        <ToolbarField label="Ticks" className="w-20">
          <Input type="number" min="1" max="500" className="h-7 text-xs" value={ticks} onChange={(e) => setTicks(clampTicks(Number(e.target.value)))} />
        </ToolbarField>

        <div className="h-5 w-px bg-white/10" />

        <div className="flex items-center gap-1">
          {Object.entries(overlays).map(([key, on]) => (
            <Button key={key} variant={on ? "default" : "ghost"} size="sm" className="h-7 px-2 text-[11px]" onClick={() => toggleOverlay(key)}>
              {key}
            </Button>
          ))}
        </div>

        <div className="flex-1" />

        <Button size="sm" className="h-7" onClick={() => generateWorld()} disabled={busy}>Generate</Button>
        <Button size="sm" variant="secondary" className="h-7" onClick={runSimulationLive} disabled={busy}>
          <Play className="size-3.5" />
          Run
        </Button>

        <div className="h-5 w-px bg-white/10" />

        <Button variant="ghost" size="icon" className="size-8" onClick={() => { setSheetTab("world"); setSheetOpen(true); }} title="Advanced settings">
          <Settings2 className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => setRightOpen((o) => !o)} title="Toggle inspector panel">
          <PanelRight className="size-4" />
        </Button>
      </header>

      {/* ── BODY ── */}
      <div className="flex min-h-0 flex-1">

        {/* LEFT SIDEBAR — Groups */}
        {leftOpen && (
          <aside className="flex w-[300px] shrink-0 flex-col border-r border-white/8 bg-[rgba(4,4,4,0.96)]">
            <div className="flex items-center justify-between border-b border-white/8 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Groups</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-7" onClick={addHumanGroup} disabled={busy} title="Add group"><Plus className="size-3.5" /></Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => { setSheetTab("groups"); setSheetOpen(true); }} title="Full setup"><Settings2 className="size-3.5" /></Button>
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 p-2">
                {groups.map((group) => (
                  <article key={group.id} className="rounded-2xl border border-white/8 bg-white/2.5 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <div className="size-7 shrink-0 rounded-lg border border-white/10" style={{ backgroundColor: group.color }} />
                      <Input className="h-7 flex-1 text-xs font-medium" value={group.name} onChange={(e) => patchGroup(group.id, { name: e.target.value })} />
                      <Button variant="ghost" size="icon" className="size-7 shrink-0 text-zinc-500 hover:text-red-400" onClick={() => deleteHumanGroup(group.id)} disabled={busy}>
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <label className="grid gap-0.5">
                        <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Pop</span>
                        <Input type="number" min="1" max="24" className="h-6 text-[11px]" value={group.population_count} onChange={(e) => patchGroup(group.id, { population_count: Number(e.target.value) })} />
                      </label>
                      <label className="grid gap-0.5">
                        <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-500">Controller</span>
                        <Select value={group.controller?.provider ?? "heuristic"} onValueChange={(v) => handleProviderChange(group.id, v)}>
                          <SelectTrigger className="h-6 text-[11px]"><SelectValue /></SelectTrigger>
                          <SelectContent>{PROVIDER_LIST.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            </ScrollArea>
          </aside>
        )}

        {/* CENTER — Map */}
        <main className="relative min-w-0 flex-1 bg-black">
          {world ? (
            <PixelWorldMap
              world={world}
              overlays={overlays}
              selectedTile={selectedTile}
              selectedHumanId={selectedHumanId}
              onHoverTile={setHoverTile}
              onSelectTile={handleSelectTile}
              onSelectHuman={handleSelectHuman}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              Generate a world to populate the sandbox.
            </div>
          )}
        </main>

        {/* RIGHT SIDEBAR — Inspector + Console */}
        {rightOpen && (
          <aside className="flex w-[340px] shrink-0 flex-col border-l border-white/8 bg-[rgba(4,4,4,0.96)]">
            <div className="min-h-0 flex-1">
              <InspectorTabs
                scenario={scenario}
                inspector={inspector}
                events={events}
                communications={world?.communications ?? []}
                className="h-full"
                panelHeightClass="flex-1 min-h-0"
              />
            </div>
            <div className="h-[220px] shrink-0 border-t border-white/8">
              <SimulationConsole
                events={events}
                statusItems={statusItems}
                debugLines={debugLines}
                running={running}
                currentTick={currentTick}
              />
            </div>
          </aside>
        )}
      </div>

      {/* ── STATUS BAR ── */}
      <footer className="flex shrink-0 items-center gap-3 border-t border-white/8 bg-black/90 px-3 py-1 backdrop-blur-md">
        <Badge variant={running ? "default" : "outline"} className="h-5 text-[10px]">
          {running ? "● Streaming" : "Standing by"}
        </Badge>
        <span className="flex-1 truncate text-[11px] text-zinc-500">{statusMessage}</span>
        <Badge variant="outline" className="h-5 text-[10px]">Tick {currentTick}</Badge>
        <Badge variant="outline" className="h-5 text-[10px]">{metrics.humans} humans</Badge>
        <Badge variant="outline" className="h-5 text-[10px]">{metrics.groups} groups</Badge>
      </footer>

      {/* ── SETTINGS SHEET ── */}
      <CivilizationSettingsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        activeTab={sheetTab}
        onTabChange={setSheetTab}
        settings={settings}
        providerCatalogs={providerCatalogs}
        opencodeCredentials={opencodeCredentials}
        busy={busy}
        onUpdateWorld={patchWorld}
        onAddGroup={addHumanGroup}
        onDeleteGroup={deleteHumanGroup}
        onUpdateGroup={patchGroup}
        onUpdateGroupController={patchGroupController}
        onSaveSettings={() => saveSettings()}
        onGenerateWorld={() => generateWorld()}
        onRefreshOpencodeStatus={() => refreshOpencodeStatus()}
        onRefreshProviderCatalog={refreshProviderCatalog}
        onProviderChange={handleProviderChange}
        onProviderCredentialChange={handleProviderCredentialChange}
        onLaunchProviderLogin={launchProviderLogin}
      />
    </div>
  );
}


/* ─── Tiny sub-components ─── */

function ToolbarField({ label, className = "", children }) {
  return (
    <label className={`grid gap-0 ${className}`}>
      <span className="text-[8px] uppercase leading-none tracking-[0.2em] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}


/* ─── Data helpers (unchanged logic) ─── */

function buildMetrics(world, settings) {
  const humans = findHumans(world).filter((h) => h.alive !== false).length;
  return {
    humans,
    groups: Object.keys(world?.groups ?? world?.factions ?? {}).length || (settings?.groups?.length ?? 0),
    messages: (world?.communications ?? []).length,
    landmarks: (world?.props ?? []).filter((p) => String(p.kind).startsWith("landmark")).length,
    seed: world?.seed ?? settings?.world?.seed ?? "n/a",
    configuredPopulation: totalConfiguredPopulation(settings)
  };
}

function buildInspector(world, scenario, point, selectedHumanId, events = []) {
  if (!world) return null;
  const humans = findHumans(world);
  const selectedHuman = selectedHumanId ? humans.find((h) => h.id === selectedHumanId) ?? null : null;
  const activePoint = selectedHuman ? { x: selectedHuman.x, y: selectedHuman.y } : point;
  if (!activePoint) return selectedHuman ? { selectedHuman, tile: null, humansOnTile: [], structures: [], region: null } : null;
  const tile = world.tiles?.[activePoint.y]?.[activePoint.x];
  if (!tile) return null;
  const humansOnTile = humans.filter((h) => h.alive !== false && h.x === activePoint.x && h.y === activePoint.y);
  const structures = [
    ...(tile.feature ? [tile.feature] : []),
    ...(world.props ?? []).filter((p) => p.x === activePoint.x && p.y === activePoint.y).map((p) => p.kind)
  ];
  const selectedGroup = selectedHuman
    ? (scenario?.groups ?? []).find((g) => g.id === selectedHuman.faction_id)
      ?? (scenario?.factions ?? []).find((g) => g.id === selectedHuman.faction_id)
      ?? null
    : null;
  const selectedController = selectedGroup?.controller ?? null;
  const recentMemories = selectedHuman
    ? events.filter((e) => e.actor_id === selectedHuman.id || e.target_agent_id === selectedHuman.id).slice(-6).reverse().map((e) => `Tick ${e.tick}: ${e.description}`)
    : [];
  return {
    tile,
    region: tile.region_id ? world.regions?.[tile.region_id] ?? null : null,
    selectedHuman, selectedGroup, selectedController, recentMemories, humansOnTile,
    otherHumansOnTile: selectedHuman ? humansOnTile.filter((h) => h.id !== selectedHuman.id) : humansOnTile,
    structures,
    group: tile.owner_faction ? (world.groups?.[tile.owner_faction] ?? world.factions?.[tile.owner_faction] ?? null) : null
  };
}

function findHumans(world) {
  return Object.values(world?.humans ?? world?.agents ?? {});
}

function clampTicks(value) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.min(500, Math.trunc(value)));
}

function catalogKey(scope, entityId) {
  return `${scope}:${entityId}`;
}
