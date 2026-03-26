"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  humanNameValidation,
  normalizeSettings,
  providerDisplayName,
  regenerateDuplicateHumanNames,
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

export default function GridNomadDashboard() {
  const [templateScenario, setTemplateScenario] = useState(null);
  const [settings, setSettings] = useState({ world: {}, groups: [] });
  const [world, setWorld] = useState(null);
  const [events, setEvents] = useState([]);
  const [activityItems, setActivityItems] = useState([]);
  const [statusItems, setStatusItems] = useState([]);
  const [debugLines, setDebugLines] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Set up groups, assign controllers, and stream.");
  const [providerCatalogs, setProviderCatalogs] = useState({});
  const [opencodeZenKeyDraft, setOpencodeZenKeyDraft] = useState("");
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
  const [runHistory, setRunHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loadedRunId, setLoadedRunId] = useState("");
  const [loadedRunScenario, setLoadedRunScenario] = useState(null);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const abortRef = useRef(null);
  const frameQueueRef = useRef([]);

  function isOpencodeConnectionEnabled(payload) {
    return Boolean(
      payload?.connection_completed
      || payload?.has_stored_credential
      || ["ready", "model_required", "rate_limited", "connected_no_models", "runtime_unavailable", "hosted_model_unavailable", "provider_backed_model_unavailable", "network_issue", "login_required", "broken_environment"].includes(payload?.health_state)
    );
  }

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
  const nameValidation = useMemo(() => humanNameValidation(settings), [settings]);

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
      await refreshOpencodeZenConnection({ silent: true });
      await refreshProviderCatalogs(normalized, true);
      if (payload.preview) {
        setWorld(payload.preview);
      } else {
        await generateWorld(normalized, true);
      }
      await refreshRunHistory(true);
      setStatusMessage("Sandbox loaded. Choose controllers and stream.");
    } catch (error) {
      pushStatus("error", "Bootstrap failed.");
      pushDebug("bootstrap", String(error));
      setStatusMessage("Bootstrap failed.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshProviderCatalog(scope, entityId, provider, { credential = "", cliHome = "", googleCloudProject = "", model = "", silent = false } = {}) {
    try {
      const params = new URLSearchParams({ provider });
      
      // Fallback to global credential if not provided and not opencode
      let effectiveCredential = credential;
      if (!effectiveCredential && provider !== "opencode" && provider !== "heuristic") {
        effectiveCredential = settings.providers?.[provider]?.apiKey ?? "";
      }

      if (effectiveCredential) params.set("credential", effectiveCredential);
      if (cliHome && provider !== "opencode") params.set("cliHome", cliHome);
      if (googleCloudProject) params.set("googleCloudProject", googleCloudProject);
      if (model) params.set("model", model);
      const response = await fetch(`/api/providers/catalog?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      setProviderCatalogs((c) => ({ ...c, [catalogKey(scope, entityId)]: payload }));

      if (scope === "group") {
        const controllerPatch = {
          availableModels: payload.models ?? [],
          supportsModelListing: Boolean(payload.supports_model_listing),
          supportsManualModelEntry: Boolean(payload.supports_manual_model_entry),
          ...(provider === "opencode"
            ? {}
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
        } else if (provider === "gemini-cli") {
          pushStatus("provider", `Gemini CLI ${payload.health_state ?? "status"} · ${payload.models?.length ?? 0} models.`);
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
    if ((nextSettings.groups ?? []).some((group) => (group.controller?.provider ?? "heuristic") === "opencode") || nextSettings.opencode_connection?.enabled) {
      await refreshOpencodeZenConnection({ silent: true });
    }

    // Refresh global catalogs for configured providers
    const providersToRefresh = Object.entries(nextSettings.providers ?? {})
      .filter(([p, config]) => config.apiKey || (p === "gemini-cli"))
      .map(([p]) => p);
    
    for (const provider of providersToRefresh) {
      await refreshProviderCatalog("global", provider, provider, {
        credential: nextSettings.providers[provider].apiKey,
        silent: true
      });
    }

    for (const group of nextSettings.groups ?? []) {
      const provider = group.controller?.provider ?? "heuristic";
      if (provider === "heuristic") {
        setProviderCatalogs((c) => ({ ...c, [catalogKey("group", group.id)]: { ok: true, provider, models: [], supports_model_listing: false, supports_manual_model_entry: false, auth_status: "local", login_hint: "Heuristic is local." } }));
        continue;
      }
      await refreshProviderCatalog("group", group.id, provider, {
        credential: provider === "opencode" ? "" : (nextSettings.providers?.[provider]?.apiKey ?? ""),
        cliHome: provider === "opencode" ? "" : (group.controller?.cliHome ?? ""),
        googleCloudProject: group.controller?.googleCloudProject ?? "",
        model: group.controller?.model ?? "",
        silent
      });
    }
  }


  async function saveSettings(nextSettings = settings, silent = false) {
    const validation = humanNameValidation(nextSettings);
    if (!validation.valid) {
      pushStatus("error", validation.message);
      setStatusMessage(validation.message);
      setSheetTab("groups");
      setSheetOpen(true);
      return null;
    }
    setWorking(true);
    try {
      const response = await fetch("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextSettings) });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message ?? "Settings could not be saved.");
      }
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
      setLoadedRunId("");
      setLoadedRunScenario(null);
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

  async function refreshRunHistory(silent = false) {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/runs", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message ?? "Could not load run history.");
      }
      setRunHistory(payload.runs ?? []);
      if (!silent) {
        pushStatus("history", `Loaded ${payload.runs?.length ?? 0} saved runs.`);
      }
    } catch (error) {
      if (!silent) {
        pushStatus("error", "Could not load run history.");
      }
      pushDebug("history", String(error));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadRunHistoryEntry(runId, { resume = false } = {}) {
    setWorking(true);
    try {
      const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message ?? "Could not load the selected run.");
      }
      if (!payload.snapshot?.world) {
        throw new Error("That run does not contain a final snapshot.");
      }
      const snapshotTick = payload.snapshot?.tick ?? payload.snapshot?.world?.tick ?? 0;
      const snapshotTimeMs = snapshotTick * Number(payload.snapshot?.config?.microstep_interval_ms ?? settings.world?.microstep_interval_ms ?? 125);
      setWorld(payload.snapshot.world);
      setEvents(payload.events ?? []);
      setActivityItems(buildActivityItemsFromEvents(payload.events ?? [], settings));
      setLiveFrame(null);
      frameQueueRef.current = [];
      setRunning(false);
      setCurrentTick(snapshotTick);
      setLiveTimeMs(snapshotTimeMs);
      setLoadedRunId(runId);
      setLoadedRunScenario(payload.resumeScenario ?? null);
      setSelectedHumanId(null);
      pushStatus("history", `Loaded run ${runId} at live step ${snapshotTick}.`, snapshotTick, snapshotTimeMs);
      setStatusMessage(resume ? `Resuming ${runId} from its final snapshot...` : `Loaded ${runId} from history.`);
      if (resume) {
        await runSimulationLive({ scenarioOverride: payload.resumeScenario ?? null, sourceRunId: runId });
      }
    } catch (error) {
      pushStatus("error", "Could not load that run.");
      pushDebug("history", String(error));
      setStatusMessage("Could not load that run.");
    } finally {
      setWorking(false);
    }
  }

  async function runSimulationLive({ scenarioOverride = null, sourceRunId = "" } = {}) {
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
    setEvents([]); setActivityItems([]); setStatusItems([]); setDebugLines([]); setCurrentTick(0); setLiveTimeMs(0); setLiveFrame(null); frameQueueRef.current = [];
    setStatusMessage(sourceRunId ? `Resuming ${sourceRunId}...` : "Starting live stream...");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const response = await fetch("/api/simulations/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings,
          ...(scenarioOverride ?? loadedRunScenario ? { scenario: scenarioOverride ?? loadedRunScenario } : {})
        }),
        signal: controller.signal
      });
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
      void refreshRunHistory(true);
    }
  }

  function handleStreamLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;
    let payload;
    try { payload = JSON.parse(trimmed); } catch { pushDebug("stream", `Non-JSON: ${trimmed}`); return; }
    if (payload.type === "frame") { frameQueueRef.current.push(payload); return; }
    if (payload.type === "decision_summary" && payload.summary) { setActivityItems((c) => [...c, payload.summary]); return; }
    if (payload.type === "snapshot" && payload.snapshot?.world) { setWorld(payload.snapshot.world); setCurrentTick(payload.tick ?? payload.snapshot.world.tick ?? 0); return; }
    if (payload.type === "event" && payload.event) {
      const enrichedEvent = { ...payload.event, time_ms: payload.time_ms ?? null };
      setEvents((c) => [...c, enrichedEvent]);
      const activityItem = summarizeActivityEvent(enrichedEvent, settings);
      if (activityItem) {
        setActivityItems((c) => [...c, activityItem]);
      }
      return;
    }
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
  function patchOpencodeConnection(patch) {
    setSettings((current) => ({
      ...current,
      opencode_connection: {
        ...(current.opencode_connection ?? {}),
        ...patch,
      }
    }));
  }

  function patchGroup(groupId, patch) {
    if (!templateScenario) return;
    setSettings((c) => updateGroup(c, templateScenario, groupId, patch));
  }
  function patchGroupController(groupId, patch) {
    if (!templateScenario) return;
    setSettings((c) => updateGroupController(c, templateScenario, groupId, patch));
  }

  function patchProviders(patch) {
    setSettings((current) => ({
      ...current,
      providers: {
        ...(current.providers ?? {}),
        ...patch,
      }
    }));
  }

  function patchProviderConnection(provider, patch) {
    setSettings((current) => ({
      ...current,
      providers: {
        ...(current.providers ?? {}),
        [provider]: {
          ...(current.providers?.[provider] ?? {}),
          ...patch,
        }
      }
    }));
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
      ...(provider === "opencode" ? { executionMode: "group_batch", opencodeProvider: "", cliHome: "", managedHomeId: "" } : { opencodeProvider: "", cliHome: "", managedHomeId: "", executionMode: "per_human" })
    });
    const group = settings.groups.find((i) => i.id === groupId);
    if (provider !== "heuristic") {
      if (provider === "opencode") {
        await refreshOpencodeZenConnection({ silent: true });
      }
      await refreshProviderCatalog("group", groupId, provider, {
        credential: provider === "opencode" ? "" : (settings.providers?.[provider]?.apiKey ?? ""),
        cliHome: provider === "opencode" ? "" : (group?.controller?.cliHome ?? ""),
        googleCloudProject: group?.controller?.googleCloudProject ?? "",
        model: group?.controller?.model ?? "",
      });
    }
  }

  async function updateProviderConnection(provider, patch) {
    patchProviderConnection(provider, patch);
    const nextSettings = {
      ...settings,
      providers: {
        ...settings.providers,
        [provider]: {
          ...(settings.providers?.[provider] ?? {}),
          ...patch
        }
      }
    };
    await refreshProviderCatalog("global", provider, provider, {
      credential: patch.apiKey ?? settings.providers?.[provider]?.apiKey ?? "",
      silent: true
    });
    // Also refresh all groups using this provider
    for (const group of settings.groups) {
      if (group.controller?.provider === provider) {
        await refreshProviderCatalog("group", group.id, provider, {
          credential: patch.apiKey ?? settings.providers?.[provider]?.apiKey ?? "",
          silent: true
        });
      }
    }
  }


  async function handleProviderCredentialChange(groupId, credential) {
    patchGroupController(groupId, { opencodeProvider: credential });
    const group = settings.groups.find((item) => item.id === groupId);
    await refreshProviderCatalog("group", groupId, "opencode", {
      credential,
      cliHome: group?.controller?.cliHome ?? "",
      model: group?.controller?.model ?? "",
    });
  }

  async function handleProviderModelChange(groupId, model) {
    patchGroupController(groupId, { model });
    const group = settings.groups.find((item) => item.id === groupId);
    const provider = group?.controller?.provider ?? "heuristic";
    if (provider === "heuristic") {
      return;
    }
    if (provider === "opencode") {
      await refreshOpencodeZenConnection({ model, silent: true });
    }
    await refreshProviderCatalog("group", groupId, provider, {
      credential: provider === "opencode" ? "" : (group?.controller?.opencodeProvider ?? ""),
      cliHome: provider === "opencode" ? "" : (group?.controller?.cliHome ?? ""),
      googleCloudProject: group?.controller?.googleCloudProject ?? "",
      model,
      silent: true,
    });
  }

  async function handleControllerModelSelection(groupId, provider, model) {
    patchGroupController(groupId, {
      provider,
      model,
      availableModels: [],
      supportsModelListing: false,
      supportsManualModelEntry: false,
      ...(provider === "opencode"
        ? { executionMode: "group_batch", opencodeProvider: "", cliHome: "", managedHomeId: "" }
        : { executionMode: "per_human", opencodeProvider: "", cliHome: "", managedHomeId: "" })
    });
    if (provider === "heuristic") {
      return;
    }
    if (provider === "opencode") {
      await refreshOpencodeZenConnection({ model, silent: true });
    }
    await refreshProviderCatalog("group", groupId, provider, {
      credential: "",
      cliHome: "",
      model,
      silent: true,
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
        body: JSON.stringify({
          currentCliHome: group?.controller?.cliHome ?? "",
          model: group?.controller?.model ?? "",
        })
      });
      const payload = await response.json();
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message ?? "Could not create an OpenCode home.");
      }
      patchGroupController(groupId, {
        cliHome: payload.resolved_cli_home ?? payload.cli_home_root ?? "",
        managedHomeId: payload.managed_home_id ?? "",
        model: group?.controller?.model ?? "",
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

  async function refreshOpencodeZenConnection({ model = "", silent = false } = {}) {
    try {
      const params = new URLSearchParams();
      if (model) params.set("model", model);
      const response = await fetch(`/api/providers/opencode/verify?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      setProviderCatalogs((current) => ({ ...current, [catalogKey("global", "opencode")]: payload }));
      patchOpencodeConnection({
        enabled: isOpencodeConnectionEnabled(payload),
        storage_target: payload.storage_target ?? settings.opencode_connection?.storage_target ?? "",
        cli_home: payload.cli_home ?? payload.resolved_cli_home ?? "",
        health_state: payload.health_state ?? "not_connected",
        connected_provider: payload.connected_provider ?? "opencode",
        last_verified_at: payload.last_probe_at ?? "",
      });
      if (!silent) {
        pushStatus("provider", `OpenCode Zen ${payload.health_state ?? "status"} · ${payload.models?.length ?? 0} models.`);
        if (payload.stderr) pushDebug("provider", payload.stderr);
      }
      return payload;
    } catch (error) {
      if (!silent) {
        pushStatus("error", "Could not verify OpenCode Zen.");
      }
      pushDebug("provider", String(error));
      return null;
    }
  }

  async function connectOpencodeZen(apiKeyOrModel = "") {
    const apiKey = typeof apiKeyOrModel === 'string' ? apiKeyOrModel : opencodeZenKeyDraft.trim();
    if (!apiKey) {
      pushStatus("error", "Paste an OpenCode Zen API key first.");
      setStatusMessage("Paste an OpenCode Zen API key first.");
      return;
    }
    const model = typeof apiKeyOrModel === 'string' ? "" : apiKeyOrModel;
    setWorking(true);
    try {
      const response = await fetch("/api/providers/opencode/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, model }),
      });
      const payload = await response.json();
      setProviderCatalogs((current) => ({ ...current, [catalogKey("global", "opencode")]: payload }));
      patchOpencodeConnection({
        enabled: isOpencodeConnectionEnabled(payload),
        storage_target: payload.storage_target ?? settings.opencode_connection?.storage_target ?? "",
        cli_home: payload.cli_home ?? payload.resolved_cli_home ?? "",
        health_state: payload.health_state ?? "connection_failed",
        connected_provider: payload.connected_provider ?? "opencode",
        last_verified_at: payload.last_probe_at ?? "",
      });
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.message ?? payload.login_hint ?? "Could not connect OpenCode Zen.");
      }
      setOpencodeZenKeyDraft("");
      pushStatus("provider", payload.message ?? "OpenCode Zen connected.");
      setStatusMessage(payload.message ?? "OpenCode Zen connected.");
      await refreshProviderCatalogs({
        ...settings,
        opencode_connection: {
          ...(settings.opencode_connection ?? {}),
          enabled: isOpencodeConnectionEnabled(payload),
          cli_home: payload.cli_home ?? payload.resolved_cli_home ?? "",
          health_state: payload.health_state ?? "connected",
          connected_provider: payload.connected_provider ?? "opencode",
          last_verified_at: payload.last_probe_at ?? "",
          storage_target: payload.storage_target ?? settings.opencode_connection?.storage_target ?? "",
        }
      }, true);
    } catch (error) {
      pushStatus("error", String(error));
      pushDebug("provider", String(error));
      setStatusMessage(String(error));
    } finally {
      setWorking(false);
    }
  }

  async function disconnectOpencodeZen() {
    setWorking(true);
    try {
      const response = await fetch("/api/providers/opencode/disconnect", { method: "POST" });
      const payload = await response.json();
      setProviderCatalogs((current) => ({ ...current, [catalogKey("global", "opencode")]: payload }));
      patchOpencodeConnection({
        enabled: false,
        storage_target: payload.storage_target ?? settings.opencode_connection?.storage_target ?? "",
        cli_home: payload.cli_home ?? "",
        health_state: payload.health_state ?? "not_connected",
        connected_provider: payload.connected_provider ?? "opencode",
        last_verified_at: payload.last_probe_at ?? "",
      });
      pushStatus("provider", payload.message ?? "OpenCode Zen disconnected.");
      setStatusMessage(payload.message ?? "OpenCode Zen disconnected.");
      await refreshProviderCatalogs({
        ...settings,
        opencode_connection: {
          ...(settings.opencode_connection ?? {}),
          enabled: false,
          cli_home: payload.cli_home ?? "",
          health_state: payload.health_state ?? "not_connected",
          last_verified_at: payload.last_probe_at ?? "",
        }
      }, true);
    } catch (error) {
      pushStatus("error", String(error));
      pushDebug("provider", String(error));
    } finally {
      setWorking(false);
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
  function regenerateDuplicateNames() {
    if (!templateScenario) return;
    setSettings((current) => regenerateDuplicateHumanNames(current, templateScenario));
    pushStatus("settings", "Regenerated duplicate human names.");
    setStatusMessage("Duplicate human names were regenerated.");
  }

  const busy = loading || working || running;
  const groups = settings.groups ?? [];
  const blockingGroups = readiness.groups?.filter((group) => group.state !== "ready") ?? [];

  /* ───────────────────────────── JSX ───────────────────────────── */

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-black text-zinc-100">

      {/* ── TOOLBAR ── */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} 
        className="flex h-16 items-center gap-4 border-b border-white/4 bg-[#000000]/80 px-6 backdrop-blur-2xl backdrop-saturate-[1.2] shadow-[0_4px_32px_rgba(0,0,0,0.5)] z-20 sticky top-0"
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={() => setLeftOpen((o) => !o)} title="Toggle groups panel">
            <PanelLeft className="size-4" />
          </Button>
          <div className="mx-1 h-6 w-px bg-white/20" />
        </div>

        <div className="flex items-end gap-2">
          <ToolbarField label="Seed" className="w-[104px]">
            <Input type="number" className="h-8 rounded-lg px-2.5 py-1.5 text-xs shadow-none" value={settings.world?.seed ?? ""} onChange={(e) => patchWorld({ seed: Number(e.target.value) })} />
          </ToolbarField>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={randomizeSeed} title="Randomize seed"><Dice5 className="size-4 text-zinc-400 hover:text-white" /></Button>
            <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={copySeed} title="Copy seed"><Copy className="size-4 text-zinc-400 hover:text-white" /></Button>
          </div>
        </div>

        <ToolbarField label="Preset" className="w-40">
          <Select value={settings.world?.generatorPreset ?? "grand-continent"} onValueChange={(v) => patchWorld({ generatorPreset: v })}>
            <SelectTrigger className="h-8 rounded-lg px-3 py-1.5 text-xs shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>{PRESET_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
          </Select>
        </ToolbarField>

        <ToolbarField label="Size" className="w-24">
          <Select value={String(settings.world?.width ?? 128)} onValueChange={(v) => patchWorld({ width: Number(v), height: Number(v) })}>
            <SelectTrigger className="h-8 rounded-lg px-3 py-1.5 text-xs shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>{SIZE_OPTIONS.map((s) => <SelectItem key={s} value={String(s)} className="text-xs">{s}×{s}</SelectItem>)}</SelectContent>
          </Select>
        </ToolbarField>

        <ToolbarField label="Duration" className="w-24">
          <Input type="number" min="10" max="1800" className="h-8 rounded-lg px-2.5 py-1.5 text-xs shadow-none" value={settings.world?.run_duration_seconds ?? 80} onChange={(e) => patchWorld({ run_duration_seconds: clampDuration(Number(e.target.value)) })} />
        </ToolbarField>

        <ToolbarField label="Speed" className="w-20">
          <Select value={String(settings.world?.playback_speed ?? 1)} onValueChange={(v) => patchWorld({ playback_speed: Number(v) })}>
            <SelectTrigger className="h-8 rounded-lg px-3 py-1.5 text-xs shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>{[1, 2, 4].map((speed) => <SelectItem key={speed} value={String(speed)} className="text-xs">{speed}×</SelectItem>)}</SelectContent>
          </Select>
        </ToolbarField>

        <div className="mx-2 h-6 w-px bg-white/20" />

        <div className="flex items-center gap-1">
          {Object.entries(overlays).map(([key, on]) => (
            <Button key={key} variant={on ? "default" : "ghost"} size="sm" className="h-8 px-2.5 text-[11px] uppercase tracking-wide rounded-lg" onClick={() => toggleOverlay(key)}>
              {key}
            </Button>
          ))}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <Button size="sm" className="h-8 text-xs font-semibold shadow-none rounded-lg" onClick={() => generateWorld()} disabled={busy}>Generate</Button>
          <Button size="sm" variant="secondary" className="h-8 text-xs font-semibold shadow-none rounded-lg" onClick={runSimulationLive} disabled={busy} title={readiness.ready ? "Run strict AI simulation" : readiness.message}>
            <Play className="size-3.5" />
            Run
          </Button>
          <Button size="sm" variant="outline" className="h-8 text-xs font-semibold shadow-none rounded-lg" onClick={() => setPlaybackPaused((value) => !value)} disabled={!running && frameQueueRef.current.length === 0}>
            <Pause className="size-3.5" />
            {playbackPaused ? "Resume" : "Pause"}
          </Button>

          <div className="mx-2 h-6 w-px bg-white/20" />

          <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={() => { setSheetTab("world"); setSheetOpen(true); }} title="Advanced settings">
            <Settings2 className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" className="size-8 rounded-lg" onClick={() => setRightOpen((o) => !o)} title="Toggle inspector panel">
            <PanelRight className="size-4" />
          </Button>
        </div>
      </motion.header>

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
        <AnimatePresence>
          {leftOpen && (
            <motion.aside 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20, width: 0, overflow: "hidden" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-[320px] shrink-0 flex-col border-r border-white/6 bg-[#030303] z-10 shadow-[4px_0_24px_rgba(0,0,0,0.4)]"
            >
              <div className="flex items-center justify-between border-b border-white/6 px-4 py-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">Groups</span>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="size-7" onClick={addHumanGroup} disabled={busy} title="Add group"><Plus className="size-3.5" /></Button>
                <Button variant="ghost" size="icon" className="size-7" onClick={() => { setSheetTab("groups"); setSheetOpen(true); }} title="Full setup"><Settings2 className="size-3.5" /></Button>
              </div>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-2 p-2">
                {groups.map((group) => (
                  <article key={group.id} className="flex flex-col gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-[10px] backdrop-saturate-180 shadow-[0_8px_32px_rgba(0,0,0,0.1)]">
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 shrink-0 rounded-lg border border-white/10 shadow-inner" style={{ backgroundColor: group.color }} />
                      <Input className="h-8 flex-1 px-3 py-1.5 text-xs font-semibold shadow-none" value={group.name} onChange={(e) => patchGroup(group.id, { name: e.target.value })} />
                      <Button variant="ghost" size="icon" className="size-8 shrink-0 rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-400" onClick={() => deleteHumanGroup(group.id)} disabled={busy} title="Delete Group">
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="grid gap-1.5">
                        <span className="ml-1 text-[9px] uppercase leading-none tracking-[0.15em] text-zinc-400/90">Pop</span>
                        <Input type="number" min="1" max="24" className="h-8 px-3 py-1.5 text-xs shadow-none" value={group.population_count} onChange={(e) => patchGroup(group.id, { population_count: Number(e.target.value) })} />
                      </label>
                      <div className="grid gap-1.5">
                        <span className="ml-1 text-[9px] uppercase leading-none tracking-[0.15em] text-zinc-400/90">Model</span>
                        <button
                          type="button"
                          className="flex h-8 items-center rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-left text-xs text-zinc-300 hover:border-white/20 hover:bg-white/[0.04]"
                          onClick={() => { setSheetTab("groups"); setSheetOpen(true); }}
                        >
                          <span className="truncate">
                            {group.controller?.model
                              ? `${group.controller.model} · ${providerDisplayName(group.controller?.provider ?? "heuristic")}`
                              : "Choose model and credential"}
                          </span>
                        </button>
                      </div>
                    </div>
                    {readiness.groups?.find((entry) => entry.id === group.id)?.state !== "ready" ? (
                      <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-[11px] leading-relaxed text-amber-100">
                        <p className="font-semibold text-amber-300">
                          {readiness.groups.find((entry) => entry.id === group.id)?.state}
                        </p>
                        <p className="mt-0.5 text-amber-200/80">
                          {readiness.groups.find((entry) => entry.id === group.id)?.message}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-emerald-100">
                        Ready to run with {group.controller?.model || providerDisplayName(group.controller?.provider ?? "heuristic")}.
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </ScrollArea>
          </motion.aside>
        )}
        </AnimatePresence>

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
              <div className="flex h-full flex-col items-center justify-center bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[60px_60px] text-zinc-500">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col items-center gap-4 rounded-[24px] border border-white/5 bg-black/40 p-10 backdrop-blur-3xl shadow-[0_16px_64px_rgba(0,0,0,0.5)]"
                >
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
                </motion.div>
              </div>
            )}
            
            <AnimatePresence>
              {cameraLocked && inspector?.selectedHuman && (
                <ThoughtStream 
                  human={inspector.selectedHuman}
                  group={groupLabel(scenario, inspector.selectedHuman.faction_id)}
                  isLocked={cameraLocked}
                  onToggleLock={() => setCameraLocked(l => !l)}
                />
              )}
            </AnimatePresence>
          </main>
          <div className="h-[220px] shrink-0 border-t border-white/6 bg-[#030303]">
            <SimulationConsole
              activityItems={activityItems}
              statusItems={statusItems}
              debugLines={debugLines}
              running={running}
              currentTick={currentTick}
              liveTimeMs={liveTimeMs}
            />
          </div>
        </div>

        {/* RIGHT SIDEBAR — Inspector + Console */}
        <AnimatePresence>
          {rightOpen && (
            <motion.aside 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, width: 0, overflow: "hidden" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-[360px] shrink-0 flex-col border-l border-white/6 bg-[#030303] z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.4)]"
            >
      <div className="min-h-0 flex-1">
              <InspectorTabs
                scenario={scenario}
                inspector={inspector}
                events={events}
                communications={world?.communications ?? []}
                runs={runHistory}
                historyLoading={historyLoading}
                loadedRunId={loadedRunId}
                busy={busy}
                onRefreshRuns={() => refreshRunHistory()}
                onLoadRun={(runId) => loadRunHistoryEntry(runId)}
                onResumeRun={(runId) => loadRunHistoryEntry(runId, { resume: true })}
                className="h-full"
                panelHeightClass="flex-1 min-h-0"
                cameraLocked={cameraLocked}
                onToggleCameraLock={() => setCameraLocked(l => !l)}
              />
            </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ── STATUS BAR ── */}
      <motion.footer 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-10 items-center gap-2 border-t border-white/4 bg-[#000000]/80 px-6 text-[10px] backdrop-blur-2xl z-20"
      >
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
        <Badge variant="outline" className="h-5 text-[10px]">Live step {currentTick}</Badge>
        <Badge variant="outline" className="h-5 text-[10px]">{formatLiveTime(liveTimeMs)}</Badge>
        <Badge variant="outline" className="h-5 text-[10px]">{metrics.humans} humans</Badge>
        <Badge variant="outline" className={readiness.ready ? "h-5 text-[10px]" : "h-5 border-red-500/40 bg-red-500/10 text-[10px] text-red-200"}>{readiness.ready ? "ready" : "blocked"}</Badge>
        <Badge variant="outline" className="h-5 text-[10px]">{metrics.groups} groups</Badge>
      </motion.footer>

      {/* ── SETTINGS SHEET ── */}
      <CivilizationSettingsSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        activeTab={sheetTab}
        onTabChange={setSheetTab}
        settings={settings}
        providerCatalogs={providerCatalogs}
        opencodeCatalog={providerCatalogs[catalogKey("global", "opencode")] ?? null}
        opencodeZenKeyDraft={opencodeZenKeyDraft}
        onOpencodeZenKeyDraftChange={setOpencodeZenKeyDraft}
        busy={busy}
        onPatchWorld={patchWorld}
        onAddGroup={addHumanGroup}
        onDeleteGroup={deleteHumanGroup}
        onUpdateGroup={patchGroup}
        onUpdateHuman={patchHuman}
        onUpdateGroupController={patchGroupController}
        onUpdateProviderConnection={updateProviderConnection}
        onConnectOpencode={connectOpencodeZen}
        onSelectControllerModel={handleControllerModelSelection}
        onSaveSettings={() => saveSettings()}
        onGenerateWorld={() => generateWorld()}
        onRefreshProviderCatalog={refreshProviderCatalog}
        onRefreshCatalogs={refreshOpencodeZenConnection}
        onProviderChange={handleProviderChange}
        onProviderCredentialChange={handleProviderCredentialChange}
        onProviderModelChange={handleProviderModelChange}
        onLaunchProviderLogin={launchProviderLogin}
        onDisconnectOpencodeZen={disconnectOpencodeZen}
        onCreateOpencodeHome={createManagedOpencodeHome}
        onCopyCommand={copyCommand}
        nameValidation={nameValidation}
        onRegenerateDuplicateNames={regenerateDuplicateNames}
      />
    </div>
  );
}


/* ─── Tiny sub-components ─── */

function ToolbarField({ label, className = "", children }) {
  return (
    <label className={`grid gap-1.5 ${className}`}>
      <span className="text-[9px] uppercase leading-none tracking-[0.15em] text-zinc-400/90 ml-0.5">{label}</span>
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
    ...(tile.structure_kind ? [tile.structure_kind] : []),
    ...(tile.feature ? [tile.feature] : []),
    ...Object.values(world.structures ?? {}).filter((s) => s.x === activePoint.x && s.y === activePoint.y).map((s) => s.kind),
    ...(world.props ?? []).filter((p) => p.x === activePoint.x && p.y === activePoint.y).map((p) => p.kind)
  ];
  const selectedGroup = selectedHuman
    ? (scenario?.groups ?? []).find((g) => g.id === selectedHuman.faction_id)
      ?? (scenario?.factions ?? []).find((g) => g.id === selectedHuman.faction_id)
      ?? null
    : null;
  const selectedController = selectedGroup?.controller ?? null;
  const recentMemories = selectedHuman
    ? events.filter((e) => e.actor_id === selectedHuman.id || e.target_agent_id === selectedHuman.id).slice(-6).reverse().map((e) => `Live step ${e.tick}: ${e.description}`)
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
    weapon_kind: frameHuman?.weapon_kind ?? human.weapon_kind ?? "",
    bonded_partner_id: frameHuman?.bonded_partner_id ?? human.bonded_partner_id ?? null,
    home_structure_id: frameHuman?.home_structure_id ?? human.home_structure_id ?? null,
    last_world_action_summary: frameHuman?.last_world_action_summary ?? human.last_world_action_summary ?? "",
    render_x: frameHuman.render_x ?? human.render_x ?? human.x,
    render_y: frameHuman.render_y ?? human.render_y ?? human.y,
    interaction_target_id: frameHuman.target_human_id ?? human.interaction_target_id,
    speaking: frameHuman.speaking ?? false
  };
}

function buildActivityItemsFromEvents(events, settings) {
  return (events ?? [])
    .map((event) => summarizeActivityEvent(event, settings))
    .filter(Boolean);
}

function summarizeActivityEvent(event, settings) {
  const actionKinds = new Set(["MOVE", "REST", "CONSUME", "GATHER", "BUILD", "CRAFT", "INTERACT", "ATTACK", "REPRODUCE", "TRANSFER", "COMMUNICATE", "DEATH", "BIRTH"]);
  if (!actionKinds.has(event.kind)) {
    return null;
  }
  const group = (settings?.groups ?? []).find((entry) => entry.id === event.faction_id) ?? null;
  return {
    tick: event.tick,
    time_ms: event.time_ms ?? null,
    actor_id: event.actor_id,
    human_name: event.metadata?.actor_name ?? event.actor_id ?? "Unknown",
    group_name: group?.name ?? event.faction_id ?? "unknown",
    provider: group?.controller?.provider ?? "unknown",
    model: group?.controller?.model ?? "",
    action: event.kind,
    intent: event.metadata?.intent ?? event.description,
    speech: event.metadata?.speech ?? "",
    communication: event.kind === "COMMUNICATION" ? event.description : "",
    result: event.description,
    success: event.success,
  };
}

function groupLabel(scenario, factionId) {
  if (!factionId) return "neutral";
  return scenario?.factions?.find((f) => f.id === factionId)?.name ?? factionId;
}

function ThoughtStream({ human, group, isLocked, onToggleLock }) {
  if (!human) return null;
  return (
    <motion.div 
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="absolute top-6 right-6 z-30 w-[340px] rounded-[24px] border border-white/6 bg-black/50 p-5 shadow-[0_16px_64px_rgba(0,0,0,0.8)] backdrop-blur-3xl backdrop-saturate-[1.2]"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-white/10 text-white hover:bg-white/20">{human.name}</Badge>
          <span className="text-[10px] capitalize text-zinc-400">{group}</span>
        </div>
        <Button size="sm" variant={isLocked ? "default" : "outline"} className="h-6 text-[10px]" onClick={onToggleLock}>
          {isLocked ? "Following" : "Follow"}
        </Button>
      </div>
      
      <div className="mb-4 space-y-1">
        <div className="text-[10px] uppercase font-semibold tracking-widest text-zinc-500">Current Intent</div>
        <div className="text-sm leading-snug text-zinc-200">{human.current_intent || human.last_intent?.reason || "Idle."}</div>
      </div>

      <div className="space-y-1.5 rounded-[16px] border border-white/4 bg-white/2 p-4">
         <div className="text-[10px] uppercase font-semibold tracking-widest text-amber-500/80 drop-shadow-md">AI Thought Stream</div>
         <div className="font-serif text-sm px-1 py-1 italic leading-relaxed text-amber-100/90 [text-shadow:0_1px_8px_rgba(255,255,255,0.1)]">
           "{human.last_thought || "Processing environment..."}"
         </div>
      </div>
    </motion.div>
  );
}
