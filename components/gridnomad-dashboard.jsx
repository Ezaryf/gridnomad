"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Copy,
  Dice5,
  Grid3x3,
  Layers,
  PanelLeft,
  PanelRight,
  Pause,
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
  simulationReadiness,
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
  roads: false,
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
  const [events, setEvents] = useState([]);
  const [statusItems, setStatusItems] = useState([]);
  const [debugLines, setDebugLines] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Set up groups, assign controllers, and stream.");
  const [providerCatalogs, setProviderCatalogs] = useState({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState("groups");
  const [selectedTile, setSelectedTile] = useState(null);
  const [hoverTile, setHoverTile] = useState(null);
  const [selectedHumanId, setSelectedHumanId] = useState(null);
  const [cameraLocked, setCameraLocked] = useState(false);
  const [overlays, setOverlays] = useState(INITIAL_OVERLAYS);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [running, setRunning] = useState(false);
  const [currentTick, setCurrentTick] = useState(0);
  const [liveTimeMs, setLiveTimeMs] = useState(0);
  const [liveFrame, setLiveFrame] = useState(null);
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const abortRef = useRef(null);
  const frameQueueRef = useRef([]);

  const scenario = useMemo(() => {
    if (!templateScenario) return null;
    return synthesizeScenario(templateScenario, settings);
  }, [templateScenario, settings]);

  const focusedTile = selectedTile ?? hoverTile;
  const inspector = useMemo(
    () => buildInspector(world, scenario, focusedTile, selectedHumanId, events, liveFrame),
    [world, scenario, focusedTile, selectedHumanId, events, liveFrame]
  );
  const metrics = useMemo(() => buildMetrics(world, settings), [world, settings]);
  const readiness = useMemo(() => simulationReadiness(settings, providerCatalogs), [settings, providerCatalogs]);

  useEffect(() => {
    void bootstrap();
    return () => abortRef.current?.abort();
  }, []);

  useEffect(() => {
    if (!selectedHumanId || !world) return;
    const baseHuman = findHumans(world).find((e) => e.id === selectedHumanId && e.alive !== false);
    const human = baseHuman ? mergeHumanFrame(baseHuman, liveFrame) : null;
    if (!human) { setSelectedHumanId(null); setCameraLocked(false); return; }
    setSelectedTile({ x: human.x, y: human.y });
  }, [selectedHumanId, world, liveFrame]);

  useEffect(() => {
    if (playbackPaused) {
      return undefined;
    }
    const interval = Math.max(16, Math.round((settings.world?.microstep_interval_ms ?? 125) / Math.max(1, settings.world?.playback_speed ?? 1)));
    const timer = setInterval(() => {
      const next = frameQueueRef.current.shift();
      if (!next) {
        return;
      }
      setLiveFrame(next);
      setLiveTimeMs(next.time_ms ?? 0);
    }, interval);
    return () => clearInterval(timer);
  }, [playbackPaused, settings.world?.microstep_interval_ms, settings.world?.playback_speed]);

  async function bootstrap() {
    setLoading(true);
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const payload = await response.json();
      const normalized = normalizeSettings(payload.templateScenario, payload.settings);
      setTemplateScenario(payload.templateScenario);
      setSettings(normalized);
      await refreshProviderCatalogs(normalized, true);
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

  async function refreshProviderCatalog(scope, entityId, provider, { credential = "", cliHome = "", silent = false } = {}) {
    try {
      const params = new URLSearchParams({ provider });
      if (credential) params.set("credential", credential);
      if (cliHome) params.set("cliHome", cliHome);
      const response = await fetch(`/api/providers/catalog?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      setProviderCatalogs((c) => ({ ...c, [catalogKey(scope, entityId)]: payload }));
      if (scope === "group") {
        const controllerPatch = {
          availableModels: payload.models ?? [],
          supportsModelListing: Boolean(payload.supports_model_listing),
          supportsManualModelEntry: Boolean(payload.supports_manual_model_entry),
          ...(provider === "opencode"
            ? {
                cliHome: payload.resolved_cli_home ?? payload.cli_home_root ?? cliHome ?? "",
                managedHomeId: payload.managed_home_id ?? settings.groups.find((item) => item.id === entityId)?.controller?.managedHomeId ?? "",
              }
            : { cliHome: "", managedHomeId: "" })
        };
        patchGroupController(entityId, controllerPatch);
      }
      if (!silent) {
        if (provider === "opencode") {
          const homeLabel =
            payload.environment_source === "managed-home"
              ? "managed home"
              : payload.environment_source === "custom-home"
                ? "custom home"
                : "user-global home";
          pushStatus("provider", `OpenCode ${payload.health_state ?? "status"} · ${payload.models?.length ?? 0} models · ${homeLabel}.`);
        } else {
          pushStatus("provider", payload.ok ? `${payload.models?.length ?? 0} models for ${providerDisplayName(provider)}.` : `Could not load models.`);
        }
      }
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
      await refreshProviderCatalog("group", group.id, provider, {
        credential: group.controller?.opencodeProvider ?? "",
        cliHome: group.controller?.cliHome ?? "",
        silent
      });
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
    if (!readiness.ready) {
      pushStatus("error", readiness.message);
      setStatusMessage(readiness.message);
      setLeftOpen(true);
      setSheetTab("groups");
      setSheetOpen(true);
      return;
    }
    setRunning(true);
    setEvents([]); setStatusItems([]); setDebugLines([]); setCurrentTick(0); setLiveTimeMs(0); setLiveFrame(null); frameQueueRef.current = [];
    setStatusMessage("Starting live stream...");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/simulations/stream", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings }), signal: controller.signal });
      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => "");
        let message = text || `Stream failed (${response.status}).`;
        try {
          const payload = JSON.parse(text);
          message = payload.message ?? message;
        } catch {
          // keep raw text when the response is not JSON
        }
        throw new Error(message);
      }
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
      if (error?.name !== "AbortError") { pushStatus("error", String(error)); pushDebug("stream", String(error)); setStatusMessage(String(error)); }
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
    if (payload.type === "frame") { frameQueueRef.current.push(payload); return; }
    if (payload.type === "snapshot" && payload.snapshot?.world) { setWorld(payload.snapshot.world); setCurrentTick(payload.tick ?? payload.snapshot.world.tick ?? 0); return; }
    if (payload.type === "event" && payload.event) { setEvents((c) => [...c, { ...payload.event, time_ms: payload.time_ms ?? null }]); return; }
    if (payload.type === "status") { setCurrentTick(payload.tick ?? 0); setLiveTimeMs(payload.time_ms ?? 0); pushStatus("status", payload.message ?? "Live step complete.", payload.tick, payload.time_ms ?? null); setStatusMessage(payload.message ?? "Live step complete."); return; }
    if (payload.type === "run_started") {
      pushStatus("run_started", `Live run: ${payload.run_duration_seconds ?? settings.world?.run_duration_seconds ?? 0}s at ${payload.playback_speed ?? settings.world?.playback_speed ?? 1}x.`, 0, 0);
      for (const ctrl of payload.controllers ?? []) {
        const parts = [
          `${ctrl.group_name ?? ctrl.faction_id}: ${providerDisplayName(ctrl.provider)}${ctrl.model ? ` (${ctrl.model})` : ""}`
        ];
        if (ctrl.credential) parts.push(`credential ${ctrl.credential}`);
        if (ctrl.execution_mode) parts.push(ctrl.execution_mode);
        if (ctrl.cli_home) parts.push(ctrl.cli_home);
        pushStatus("controller", parts.join(" · "), 0, 0);
      }
      setStatusMessage(`Streaming live run for ${payload.run_duration_seconds ?? settings.world?.run_duration_seconds ?? 0}s.`);
      return;
    }
    if (payload.type === "provider_status") { pushStatus("provider", `${payload.faction_id}: ${payload.message ?? "provider update"}`, payload.tick, payload.time_ms ?? null); pushDebug("provider", `${payload.faction_id}: ${payload.message ?? ""}`, payload.tick); return; }
    if (payload.type === "run_failed") {
      if (payload.snapshot?.world) setWorld(payload.snapshot.world);
      setLiveTimeMs(payload.time_ms ?? liveTimeMs);
      pushStatus("error", payload.message ?? "Strict run failed.", payload.tick, payload.time_ms ?? null);
      pushDebug("error", payload.message ?? "Strict run failed.", payload.tick);
      setStatusMessage(payload.message ?? "Strict run failed.");
      return;
    }
    if (payload.type === "stderr") { pushDebug("stderr", payload.text ?? payload.message ?? "", payload.tick); return; }
    if (payload.type === "complete") { if (payload.snapshot?.world) setWorld(payload.snapshot.world); setLiveTimeMs(payload.time_ms ?? liveTimeMs); pushStatus("complete", `Done. ${payload.event_count ?? 0} events.`, payload.tick, payload.time_ms ?? null); setStatusMessage(`Complete after ${formatLiveTime(payload.time_ms ?? liveTimeMs)}.`); return; }
    if (payload.type === "error") { pushStatus("error", payload.message ?? "Error.", payload.tick); pushDebug("error", payload.message ?? "Error.", payload.tick); setStatusMessage(payload.message ?? "Error."); return; }
    pushDebug("stream", trimmed);
  }

  function pushStatus(type, message, tick = null, time_ms = null) { setStatusItems((c) => [...c, { type, message, tick, time_ms }]); }
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
  function patchHuman(groupId, humanId, patch) {
    setSettings((current) => ({
      ...current,
      groups: (current.groups ?? []).map((group) => (
        group.id !== groupId
          ? group
          : {
              ...group,
              humans: (group.humans ?? []).map((human) => (
                human.id === humanId ? { ...human, ...patch } : human
              ))
            }
      ))
    }));
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
    patchGroupController(groupId, {
      provider,
      model: "",
      availableModels: [],
      supportsModelListing: false,
      supportsManualModelEntry: false,
      ...(provider === "opencode" ? { executionMode: "group_batch" } : { opencodeProvider: "", cliHome: "", managedHomeId: "", executionMode: "per_human" })
    });
    const group = settings.groups.find((i) => i.id === groupId);
    if (provider !== "heuristic") {
      await refreshProviderCatalog("group", groupId, provider, {
        credential: group?.controller?.opencodeProvider ?? "",
        cliHome: group?.controller?.cliHome ?? "",
      });
    }
  }

  async function handleProviderCredentialChange(groupId, credential) {
    patchGroupController(groupId, { opencodeProvider: credential });
    const group = settings.groups.find((item) => item.id === groupId);
    await refreshProviderCatalog("group", groupId, "opencode", {
      credential,
      cliHome: group?.controller?.cliHome ?? "",
    });
  }

  async function launchProviderLogin(provider) {
    try {
      const route = provider === "gemini-cli" ? "/api/providers/gemini/login" : "/api/providers/opencode/login";
      const response = await fetch(route, { method: "POST" });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        pushStatus("error", payload.message ?? `Could not launch ${provider} login.`);
        if (payload.stderr) pushDebug("provider", payload.stderr);
        setStatusMessage(payload.message ?? `Could not launch ${provider} login.`);
        return;
      }
      pushStatus("provider", payload.message ?? `${provider} login launched.`);
      setStatusMessage(payload.message ?? `${provider} login launched.`);
    } catch (error) { pushStatus("error", `Could not launch ${provider} login.`); pushDebug("provider", String(error)); }
  }

  async function createManagedOpencodeHome(groupId) {
    try {
      const group = settings.groups.find((item) => item.id === groupId);
      const response = await fetch("/api/providers/opencode/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentCliHome: group?.controller?.cliHome ?? "" })
      });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message ?? "Could not create an OpenCode home.");
      }
      patchGroupController(groupId, {
        cliHome: payload.resolved_cli_home ?? payload.cli_home_root ?? "",
        managedHomeId: payload.managed_home_id ?? "",
        model: "",
        opencodeProvider: "",
        availableModels: payload.models ?? [],
        supportsModelListing: true,
        supportsManualModelEntry: true,
        executionMode: "group_batch",
      });
      setProviderCatalogs((current) => ({ ...current, [catalogKey("group", groupId)]: payload }));
      pushStatus("provider", `OpenCode managed home ready for ${group?.name ?? groupId}. Run the copied login command next.`);
      if (payload.stderr) pushDebug("provider", payload.stderr);
      setStatusMessage("OpenCode managed home created. Copy the login command and run it in your own terminal.");
    } catch (error) {
      pushStatus("error", String(error));
      pushDebug("provider", String(error));
    }
  }

  async function copyCommand(label, commandText) {
    if (!commandText) {
      pushStatus("error", `${label} is unavailable right now.`);
      return;
    }
    try {
      await navigator.clipboard.writeText(commandText);
      pushStatus("clipboard", `Copied ${label}.`);
    } catch {
      setStatusMessage("Clipboard unavailable.");
    }
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
  const blockingGroups = readiness.groups?.filter((group) => group.state !== "ready") ?? [];

  /* ───────────────────────────── JSX ───────────────────────────── */

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-black text-zinc-100">

      {/* ── TOOLBAR ── */}
      <header className="flex h-12 items-center justify-between border-b border-white/20 bg-black/40 px-4 backdrop-blur-[10px] backdrop-saturate-180">
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

        <ToolbarField label="Duration" className="w-24">
          <Input type="number" min="10" max="1800" className="h-7 text-xs" value={settings.world?.run_duration_seconds ?? 80} onChange={(e) => patchWorld({ run_duration_seconds: clampDuration(Number(e.target.value)) })} />
        </ToolbarField>

        <ToolbarField label="Speed" className="w-20">
          <Select value={String(settings.world?.playback_speed ?? 1)} onValueChange={(v) => patchWorld({ playback_speed: Number(v) })}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 4].map((speed) => <SelectItem key={speed} value={String(speed)}>{speed}×</SelectItem>)}</SelectContent>
          </Select>
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
        <Button size="sm" variant="secondary" className="h-7" onClick={runSimulationLive} disabled={busy} title={readiness.ready ? "Run strict AI simulation" : readiness.message}>
          <Play className="size-3.5" />
          Run
        </Button>
        <Button size="sm" variant="outline" className="h-7" onClick={() => setPlaybackPaused((value) => !value)} disabled={!running && frameQueueRef.current.length === 0}>
          <Pause className="size-3.5" />
          {playbackPaused ? "Resume" : "Pause"}
        </Button>

        <div className="h-5 w-px bg-white/10" />

        <Button variant="ghost" size="icon" className="size-8" onClick={() => { setSheetTab("world"); setSheetOpen(true); }} title="Advanced settings">
          <Settings2 className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={() => setRightOpen((o) => !o)} title="Toggle inspector panel">
          <PanelRight className="size-4" />
        </Button>
      </header>

      {!readiness.ready ? (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-100">Run blocked: {readiness.message}</p>
              <p className="truncate text-xs text-amber-200/80">
                Fix the highlighted group setup before starting the strict AI-only simulation.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20"
              onClick={() => {
                setLeftOpen(true);
                setSheetTab("groups");
                setSheetOpen(true);
              }}
            >
              Fix setup
            </Button>
          </div>
          {blockingGroups.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {blockingGroups.slice(0, 4).map((group) => (
                <div key={group.id} className="rounded-xl border border-amber-400/20 bg-black/20 px-3 py-1.5 text-xs text-amber-100/90">
                  <span className="font-medium">{group.name}</span>
                  <span className="mx-1 text-amber-300/60">·</span>
                  <span>{group.message}</span>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ── BODY ── */}
      <div className="flex min-h-0 flex-1">

        {/* LEFT SIDEBAR — Groups */}
        {leftOpen && (
          <aside className="flex w-[300px] shrink-0 flex-col border-r border-white/20 bg-[rgba(4,4,4,0.96)]">
            <div className="flex items-center justify-between border-b border-white/20 px-3 py-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Groups</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-7" onClick={addHumanGroup} disabled={busy} title="Add group"><Plus className="size-3.5" /></Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => { setSheetTab("groups"); setSheetOpen(true); }} title="Full setup"><Settings2 className="size-3.5" /></Button>
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 p-2">
                {groups.map((group) => (
                  <article key={group.id} className="rounded-2xl border border-white/20 bg-white/10 p-3 backdrop-blur-[10px] backdrop-saturate-180">
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
                    {readiness.groups?.find((entry) => entry.id === group.id)?.state !== "ready" ? (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-4 text-amber-100">
                        <p className="font-medium">
                          {readiness.groups.find((entry) => entry.id === group.id)?.state}
                        </p>
                        <p className="text-amber-200/80">
                          {readiness.groups.find((entry) => entry.id === group.id)?.message}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-2 text-[11px] leading-4 text-emerald-100">
                        Ready to run with {providerDisplayName(group.controller?.provider ?? "heuristic")}.
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </ScrollArea>
          </aside>
        )}

        {/* CENTER — Map + Console */}
        <div className="flex min-w-0 flex-1 flex-col bg-black">
          <main className="relative min-h-0 flex-1 bg-black">
            {world ? (
              <PixelWorldMap
                world={world}
                liveFrame={liveFrame}
                overlays={overlays}
                selectedTile={selectedTile}
                selectedHumanId={selectedHumanId}
                cameraLocked={cameraLocked}
                onHoverTile={setHoverTile}
                onSelectTile={handleSelectTile}
                onSelectHuman={handleSelectHuman}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[40px_40px] text-zinc-500">
                <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-black/40 p-8 backdrop-blur-md">
                  <div className="flex size-16 items-center justify-center rounded-full border border-dashed border-white/20 bg-white/5">
                    <Grid3x3 className="size-8 text-zinc-400" />
                  </div>
                  <div className="text-center">
                    <h3 className="mb-1 text-sm font-medium text-zinc-300 tracking-wide">Environment Standing By</h3>
                    <p className="text-[11px] leading-relaxed text-zinc-500 max-w-[240px]">
                      Configure your civilization parameters on the left, then generate a new world map to begin.
                    </p>
                  </div>
                  <Button variant="outline" className="mt-2 h-8 border-white/10 bg-white/5 text-xs hover:bg-white/10" onClick={() => generateWorld()} disabled={busy}>
                    Generate Map Blueprint
                  </Button>
                </div>
              </div>
            )}
            
            {cameraLocked && inspector?.selectedHuman && (
              <ThoughtStream 
                human={inspector.selectedHuman}
                group={groupLabel(scenario, inspector.selectedHuman.faction_id)}
                isLocked={cameraLocked}
                onToggleLock={() => setCameraLocked(l => !l)}
              />
            )}
          </main>
          <div className="h-[220px] shrink-0 border-t border-white/20 bg-[rgba(4,4,4,0.96)]">
            <SimulationConsole
              events={events}
              statusItems={statusItems}
              debugLines={debugLines}
              running={running}
              currentTick={currentTick}
              liveTimeMs={liveTimeMs}
            />
          </div>
        </div>

        {/* RIGHT SIDEBAR — Inspector + Console */}
        {rightOpen && (
          <aside className="flex w-[340px] shrink-0 flex-col border-l border-white/20 bg-[rgba(4,4,4,0.96)]">
            <div className="min-h-0 flex-1">
              <InspectorTabs
                scenario={scenario}
                inspector={inspector}
                events={events}
                communications={world?.communications ?? []}
                className="h-full"
                panelHeightClass="flex-1 min-h-0"
                cameraLocked={cameraLocked}
                onToggleCameraLock={() => setCameraLocked(l => !l)}
              />
            </div>
          </aside>
        )}
      </div>

      {/* ── STATUS BAR ── */}
      <footer className="flex h-8 items-center gap-2 border-t border-white/20 bg-black/40 px-4 text-[10px] backdrop-blur-[10px] backdrop-saturate-180">
        <Badge variant={running ? "default" : "outline"} className="h-5 text-[10px]">
          {running ? (playbackPaused ? "● Paused" : "● Live") : "Standing by"}
        </Badge>
        <span className="flex-1 truncate text-[11px] text-zinc-500 px-2">{statusMessage}</span>
        {world && (
          <>
            <Badge variant="outline" className="h-5 text-[10px]">Time {world.time_of_day}:00</Badge>
            <Badge variant="outline" className="h-5 text-[10px] capitalize">{world.weather}</Badge>
          </>
        )}
        <Badge variant="outline" className="h-5 text-[10px]">Step {currentTick}</Badge>
        <Badge variant="outline" className="h-5 text-[10px]">{formatLiveTime(liveTimeMs)}</Badge>
        <Badge variant="outline" className="h-5 text-[10px]">{metrics.humans} humans</Badge>
        <Badge variant="outline" className={readiness.ready ? "h-5 text-[10px]" : "h-5 border-red-500/40 bg-red-500/10 text-[10px] text-red-200"}>{readiness.ready ? "ready" : "blocked"}</Badge>
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
        busy={busy}
        onUpdateWorld={patchWorld}
        onAddGroup={addHumanGroup}
        onDeleteGroup={deleteHumanGroup}
        onUpdateGroup={patchGroup}
        onUpdateHuman={patchHuman}
        onUpdateGroupController={patchGroupController}
        onSaveSettings={() => saveSettings()}
        onGenerateWorld={() => generateWorld()}
        onRefreshProviderCatalog={refreshProviderCatalog}
        onProviderChange={handleProviderChange}
        onProviderCredentialChange={handleProviderCredentialChange}
        onLaunchProviderLogin={launchProviderLogin}
        onCreateOpencodeHome={createManagedOpencodeHome}
        onCopyCommand={copyCommand}
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

function buildInspector(world, scenario, point, selectedHumanId, events = [], liveFrame = null) {
  if (!world) return null;
  const humans = findHumans(world).map((human) => mergeHumanFrame(human, liveFrame));
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
    ? events.filter((e) => e.actor_id === selectedHuman.id || e.target_agent_id === selectedHuman.id).slice(-6).reverse().map((e) => `Step ${e.tick}: ${e.description}`)
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

function clampDuration(value) {
  if (!Number.isFinite(value)) return 10;
  return Math.max(10, Math.min(1800, Math.trunc(value)));
}

function catalogKey(scope, entityId) {
  return `${scope}:${entityId}`;
}

function formatLiveTime(timeMs) {
  const totalSeconds = Math.max(0, Math.floor((timeMs ?? 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function mergeHumanFrame(human, liveFrame) {
  const frameHuman = liveFrame?.humans?.find((entry) => entry.id === human.id);
  if (!frameHuman) {
    return human;
  }
  return {
    ...human,
    id: human.id,
    x: frameHuman?.x ?? human.x,
    y: frameHuman?.y ?? human.y,
    health: frameHuman?.health ?? human.health,
    task_state: frameHuman?.state ?? human.task_state,
    inventory: {
      food: frameHuman?.food ?? human.inventory?.food ?? 0,
      wood: frameHuman?.wood ?? human.inventory?.wood ?? 0,
      stone: frameHuman?.stone ?? human.inventory?.stone ?? 0
    },
    render_x: frameHuman.render_x ?? human.render_x ?? human.x,
    render_y: frameHuman.render_y ?? human.render_y ?? human.y,
    interaction_target_id: frameHuman.target_human_id ?? human.interaction_target_id,
    speaking: frameHuman.speaking ?? false
  };
}

function groupLabel(scenario, factionId) {
  if (!factionId) return "neutral";
  return scenario?.factions?.find((f) => f.id === factionId)?.name ?? factionId;
}

function ThoughtStream({ human, group, isLocked, onToggleLock }) {
  if (!human) return null;
  return (
    <div className="absolute top-4 right-4 z-30 w-80 rounded-2xl border border-white/20 bg-black/40 p-4 shadow-2xl backdrop-blur-xl backdrop-saturate-180">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-white/10 text-white hover:bg-white/20">{human.name}</Badge>
          <span className="text-[10px] capitalize text-zinc-400">{group}</span>
        </div>
        <Button size="sm" variant={isLocked ? "default" : "outline"} className="h-6 text-[10px]" onClick={onToggleLock}>
          {isLocked ? "Following" : "Follow"}
        </Button>
      </div>
      
      <div className="mb-3 space-y-1">
        <div className="text-[9px] uppercase tracking-widest text-zinc-500">Current Intent</div>
        <div className="text-xs leading-snug text-zinc-200">{human.current_intent || human.last_intent?.reason || "Idle."}</div>
      </div>

      <div className="space-y-1 rounded-xl bg-white/5 p-3">
         <div className="text-[9px] uppercase tracking-widest text-amber-500/80 drop-shadow-md">AI Thought Stream</div>
         <div className="font-serif text-sm px-1 py-1 italic leading-relaxed text-amber-100/90 [text-shadow:0_1px_5px_rgb(255_255_255/20%)]">
           "{human.last_thought || "Processing environment..."}"
         </div>
      </div>
    </div>
  );
}
