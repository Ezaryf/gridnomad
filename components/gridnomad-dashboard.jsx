"use client";

import { useEffect, useMemo, useState } from "react";
import { Radar, Waves } from "lucide-react";

import AtlasMetrics from "@/components/atlas-metrics";
import CivilizationSettingsSheet from "@/components/civilization-settings-sheet";
import InspectorTabs from "@/components/inspector-tabs";
import PixelWorldMap from "@/components/pixel-world-map";
import WorldToolbar from "@/components/world-toolbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";


const PRESET_OPTIONS = [
  { value: "grand-continent", label: "Grand Continent" },
  { value: "archipelago", label: "Archipelago" },
  { value: "highland-realms", label: "Highland Realms" }
];


const SIZE_OPTIONS = [
  { value: 96, label: "96 x 96" },
  { value: 128, label: "128 x 128" },
  { value: 160, label: "160 x 160" }
];


export default function GridNomadDashboard() {
  const [scenario, setScenario] = useState(null);
  const [settings, setSettings] = useState({ world: {}, factions: {} });
  const [fallbackPreview, setFallbackPreview] = useState(null);
  const [generatedPayload, setGeneratedPayload] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [events, setEvents] = useState([]);
  const [hoveredTile, setHoveredTile] = useState(null);
  const [selectedTile, setSelectedTile] = useState(null);
  const [opencodeModels, setOpencodeModels] = useState({});
  const [opencodeCredentials, setOpencodeCredentials] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Booting the OLED atlas...");
  const [ticks, setTicks] = useState(18);
  const [loadingWorld, setLoadingWorld] = useState(false);
  const [runningSimulation, setRunningSimulation] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState("world");
  const [overlays, setOverlays] = useState({
    territories: true,
    roads: true,
    resources: false,
    agents: true
  });

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const [settingsResponse, statusResponse] = await Promise.all([
          fetch("/api/settings"),
          fetch("/api/providers/opencode/status")
        ]);
        const settingsPayload = await settingsResponse.json();
        const statusPayload = await statusResponse.json();
        if (cancelled) {
          return;
        }
        setScenario(settingsPayload.scenario);
        setFallbackPreview(settingsPayload.preview);
        setSettings(settingsPayload.settings);
        setOpencodeCredentials(statusPayload.credentials ?? []);
        await requestGeneratedWorld(settingsPayload.settings, {
          nextStatus: "Atlas ready. Generate the world or run the current civilizations."
        });
      } catch (error) {
        if (!cancelled) {
          setStatusMessage(`GridNomad could not finish booting: ${error.message}`);
        }
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeWorld = snapshot?.world ?? generatedPayload?.world ?? fallbackPreview;
  const activeTile = selectedTile ?? hoveredTile;
  const inspector = useMemo(() => buildTileInsight(activeWorld, activeTile), [activeTile, activeWorld]);
  const metrics = useMemo(() => buildMetrics(activeWorld, settings.world?.seed), [activeWorld, settings.world?.seed]);
  const territorySummary = useMemo(
    () => describeTerritory(activeWorld, inspector?.tile.owner_faction),
    [activeWorld, inspector]
  );

  async function requestGeneratedWorld(nextSettings = settings, { nextStatus } = {}) {
    setLoadingWorld(true);
    setStatusMessage("Generating the world through the Python engine...");
    setSnapshot(null);
    setEvents([]);
    setSelectedTile(null);
    try {
      const response = await fetch("/api/worlds/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: nextSettings })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setStatusMessage(`World generation failed. ${payload.stderr || payload.stdout || "Unknown error."}`);
        return;
      }
      setSettings(nextSettings);
      setGeneratedPayload(payload);
      setStatusMessage(
        nextStatus ?? `Generated world ${payload.world.width} x ${payload.world.height} from seed ${payload.world.seed}.`
      );
    } finally {
      setLoadingWorld(false);
    }
  }

  async function saveSettings(nextSettings = settings, { message = "Settings saved." } = {}) {
    setSavingSettings(true);
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nextSettings)
      });
      const payload = await response.json();
      setSettings(payload.settings);
      setStatusMessage(message);
      return payload.settings;
    } finally {
      setSavingSettings(false);
    }
  }

  function updateFaction(factionId, patch) {
    setSettings((current) => ({
      ...current,
      factions: {
        ...current.factions,
        [factionId]: {
          ...current.factions[factionId],
          ...patch
        }
      }
    }));
  }

  function updateWorld(patch) {
    setSettings((current) => ({
      ...current,
      world: {
        ...current.world,
        ...patch
      }
    }));
  }

  async function refreshOpencodeModels(factionId) {
    const provider = settings.factions[factionId]?.opencodeProvider;
    const query = provider ? `?provider=${encodeURIComponent(provider)}` : "";
    const response = await fetch(`/api/providers/opencode/models${query}`);
    const payload = await response.json();
    setOpencodeModels((current) => ({ ...current, [factionId]: payload.models ?? [] }));
    setStatusMessage(
      payload.models?.length
        ? `Loaded ${payload.models.length} OpenCode models for ${factionLabel(scenario, factionId)}.`
        : "OpenCode model list returned no entries. Check login state and CLI availability."
    );
  }

  async function refreshOpencodeStatus() {
    const response = await fetch("/api/providers/opencode/status");
    const payload = await response.json();
    setOpencodeCredentials(payload.credentials ?? []);
    setStatusMessage("OpenCode credential list refreshed.");
  }

  async function launchProviderLogin(provider) {
    const route = provider === "opencode" ? "/api/providers/opencode/login" : "/api/providers/gemini/login";
    const response = await fetch(route, { method: "POST" });
    const payload = await response.json();
    setStatusMessage(payload.message);
  }

  async function runSimulation() {
    setRunningSimulation(true);
    setStatusMessage("Running the current world through the simulator...");
    try {
      const response = await fetch("/api/simulations/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticks, settings })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setStatusMessage(`Simulation run failed. ${payload.stderr || payload.stdout || "Unknown error."}`);
        return;
      }
      setSnapshot(payload.snapshot);
      setEvents(payload.events ?? []);
      setStatusMessage(`Simulation complete. Loaded ${payload.events?.length ?? 0} events from ${payload.runDir}.`);
    } finally {
      setRunningSimulation(false);
    }
  }

  async function randomizeSeed() {
    const nextSeed = Math.floor(Math.random() * 900000) + 100000;
    const nextSettings = {
      ...settings,
      world: {
        ...settings.world,
        seed: nextSeed
      }
    };
    setSettings(nextSettings);
    await requestGeneratedWorld(nextSettings, {
      nextStatus: `Generated a new world from seed ${nextSeed}.`
    });
  }

  async function copySeed() {
    const seed = settings.world?.seed;
    if (!seed || typeof navigator === "undefined" || !navigator.clipboard) {
      setStatusMessage("Clipboard access is unavailable in this environment.");
      return;
    }
    await navigator.clipboard.writeText(String(seed));
    setStatusMessage(`Copied seed ${seed} to your clipboard.`);
  }

  function openSettingsPanel(tab) {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }

  const busy = loadingWorld || runningSimulation || savingSettings;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1900px] flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6">
        <WorldToolbar
          worldSettings={settings.world ?? {}}
          ticks={ticks}
          presetOptions={PRESET_OPTIONS}
          sizeOptions={SIZE_OPTIONS}
          statusMessage={statusMessage}
          overlays={overlays}
          busy={busy}
          onSeedChange={(value) => updateWorld({ seed: value })}
          onPresetChange={(value) => updateWorld({ generatorPreset: value })}
          onSizeChange={(value) => updateWorld({ width: value, height: value })}
          onTicksChange={setTicks}
          onToggleOverlay={(key) =>
            setOverlays((current) => ({
              ...current,
              [key]: !current[key]
            }))
          }
          onRandomizeSeed={randomizeSeed}
          onCopySeed={copySeed}
          onGenerateWorld={() => requestGeneratedWorld()}
          onRunSimulation={runSimulation}
          onOpenWorldSettings={() => openSettingsPanel("world")}
          onOpenCivilizations={() => openSettingsPanel("civilizations")}
        />

        <AtlasMetrics metrics={metrics} />

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-4">
            <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))]">
              <CardHeader className="border-b border-white/8 pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge>World stage</Badge>
                      {snapshot ? <Badge variant="muted">Tick {snapshot.tick}</Badge> : <Badge variant="muted">Preview</Badge>}
                    </div>
                    <CardTitle className="text-xl">Illustrated seeded pixel atlas</CardTitle>
                    <CardDescription>
                      Procedural world data now renders as a layered sprite atlas with denser terrain, richer settlements, animated water, and cleaner exploration controls.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <MapMeta icon={Waves} label={`${activeWorld?.roads?.length ?? 0} roads`} />
                    <MapMeta icon={Radar} label={`${activeWorld?.settlements?.length ?? 0} settlements`} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4">
                <PixelWorldMap
                  world={activeWorld}
                  overlays={overlays}
                  selectedTile={selectedTile}
                  onHoverTile={setHoveredTile}
                  onSelectTile={setSelectedTile}
                />
              </CardContent>
            </Card>
          </div>

          <InspectorTabs
            scenario={scenario}
            inspector={inspector}
            events={events}
            territorySummary={territorySummary}
          />
        </div>
      </div>

      <CivilizationSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        activeTab={settingsTab}
        onTabChange={setSettingsTab}
        scenario={scenario}
        settings={settings}
        opencodeModels={opencodeModels}
        opencodeCredentials={opencodeCredentials}
        busy={busy}
        onUpdateWorld={updateWorld}
        onUpdateFaction={updateFaction}
        onSaveSettings={() => saveSettings(settings)}
        onGenerateWorld={() => requestGeneratedWorld()}
        onRefreshOpencodeStatus={refreshOpencodeStatus}
        onRefreshOpencodeModels={refreshOpencodeModels}
        onLaunchProviderLogin={launchProviderLogin}
      />
    </main>
  );
}


function buildMetrics(world, fallbackSeed) {
  if (!world) {
    return {
      aliveAgents: 0,
      settlements: 0,
      landmarks: 0,
      seed: fallbackSeed ?? "..."
    };
  }
  const agents = Object.values(world.agents ?? {});
  const landmarks = (world.props ?? []).filter((prop) =>
    ["lighthouse", "observatory", "palace", "market", "shrine"].includes(prop.kind)
  ).length;
  return {
    aliveAgents: agents.filter((agent) => agent.alive !== false).length,
    settlements: world.settlements?.length ?? 0,
    landmarks,
    seed: world.seed ?? fallbackSeed ?? "..."
  };
}


function buildTileInsight(world, point) {
  if (!world || !point) {
    return null;
  }
  const row = world.tiles?.[point.y];
  const tile = row?.[point.x];
  if (!tile) {
    return null;
  }
  const agents = Object.values(world.agents ?? {}).filter(
    (agent) => agent.x === point.x && agent.y === point.y && agent.alive !== false
  );
  const region = tile.region_id ? world.regions?.[tile.region_id] : null;
  const settlement = (world.settlements ?? []).find((item) => item.x === point.x && item.y === point.y);
  const props = (world.props ?? []).filter((prop) => prop.x === point.x && prop.y === point.y);
  const structures = [
    tile.terrain !== "plain" ? tile.terrain : null,
    tile.feature,
    settlement ? `${settlement.kind} settlement` : null,
    ...props
      .map((prop) => prop.kind)
      .filter((kind) => !["tree-cluster", "grove", "mountain", "river-trace"].includes(kind))
  ].filter(Boolean);
  return {
    tile,
    region,
    settlement,
    agents,
    structures
  };
}


function describeTerritory(world, factionId) {
  if (!world || !factionId) {
    return "Unclaimed or neutral terrain.";
  }
  const territory = world.territories?.[factionId];
  if (!territory) {
    return `Controlled by ${factionId}.`;
  }
  return `${territory.tile_count} claimed tiles across ${territory.region_ids?.length ?? 0} regions.`;
}


function factionLabel(scenario, factionId) {
  if (!factionId) {
    return "neutral";
  }
  return scenario?.factions?.find((faction) => faction.id === factionId)?.name ?? factionId;
}


function MapMeta({ icon: Icon, label }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm text-zinc-300">
      <Icon className="size-4 text-zinc-500" />
      <span>{label}</span>
    </div>
  );
}
