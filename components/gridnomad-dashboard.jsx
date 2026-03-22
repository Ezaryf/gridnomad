"use client";

import { useEffect, useMemo, useState, useTransition } from "react";


const PROVIDER_OPTIONS = [
  { value: "heuristic", label: "Heuristic" },
  { value: "gemini-cli", label: "Gemini CLI" },
  { value: "opencode", label: "OpenCode CLI" }
];

const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-exp"];


function toBoardData(preview, snapshot) {
  if (snapshot?.world) {
    const world = snapshot.world;
    const agents = Object.values(world.agents ?? {});
    return {
      width: world.width,
      height: world.height,
      tiles: world.tiles,
      agents
    };
  }
  return preview ?? { width: 0, height: 0, tiles: [], agents: [] };
}


function tileTone(terrain) {
  switch (terrain) {
    case "water":
      return "water";
    case "bridge":
      return "bridge";
    case "farm":
      return "farm";
    case "house":
      return "house";
    default:
      return "plain";
  }
}


function terrainLabel(tile) {
  if (tile.resource) {
    return tile.resource.slice(0, 3).toUpperCase();
  }
  if (tile.farmable && tile.terrain === "plain") {
    return "SOIL";
  }
  return tile.terrain.slice(0, 3).toUpperCase();
}


function toAgentMap(agents) {
  const map = new Map();
  for (const agent of agents) {
    const key = `${agent.x},${agent.y}`;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(agent);
  }
  return map;
}


export default function GridNomadDashboard() {
  const [scenario, setScenario] = useState(null);
  const [preview, setPreview] = useState(null);
  const [settings, setSettings] = useState({ factions: {} });
  const [snapshot, setSnapshot] = useState(null);
  const [events, setEvents] = useState([]);
  const [opencodeModels, setOpencodeModels] = useState({});
  const [opencodeCredentials, setOpencodeCredentials] = useState([]);
  const [statusMessage, setStatusMessage] = useState("Loading GridNomad control room...");
  const [ticks, setTicks] = useState(12);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const [settingsResponse, statusResponse] = await Promise.all([
        fetch("/api/settings"),
        fetch("/api/providers/opencode/status")
      ]);
      const settingsPayload = await settingsResponse.json();
      const statusPayload = await statusResponse.json();
      setScenario(settingsPayload.scenario);
      setPreview(settingsPayload.preview);
      setSettings(settingsPayload.settings);
      setOpencodeCredentials(statusPayload.credentials ?? []);
      setStatusMessage("Control room ready. Configure each civilization, then run the world.");
    });
  }, []);

  const board = useMemo(() => toBoardData(preview, snapshot), [preview, snapshot]);
  const agentMap = useMemo(() => toAgentMap(board.agents ?? []), [board]);
  const factions = scenario?.factions ?? [];
  const aliveAgents = board.agents?.filter((agent) => agent.alive !== false).length ?? 0;
  const allTiles = board.tiles.flat?.() ?? [];
  const bridgeCount = allTiles.filter((tile) => tile.terrain === "bridge").length;
  const farmCount = allTiles.filter((tile) => tile.terrain === "farm").length;

  async function saveSettings(nextSettings = settings) {
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nextSettings)
    });
    const payload = await response.json();
    setSettings(payload.settings);
    setStatusMessage("Civilization settings saved.");
  }

  function updateFaction(factionId, patch) {
    setSettings((current) => ({
      factions: {
        ...current.factions,
        [factionId]: {
          ...current.factions[factionId],
          ...patch
        }
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
        ? `Loaded ${payload.models.length} OpenCode model options for ${factionId}.`
        : "OpenCode model list returned no entries. Check CLI connectivity or login state."
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
    startTransition(async () => {
      setStatusMessage("Running the simulation through the Python engine...");
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
    });
  }

  return (
    <main className="control-room">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">GridNomad</p>
          <h1>Control Room for Browser-Driven Civilizations</h1>
          <p className="lede">
            Launch the simulator in the browser, assign a different AI stack to each civilization,
            and route faction decisions through heuristic logic, Gemini CLI, or OpenCode CLI.
          </p>
        </div>
        <div className="hero-metrics">
          <MetricCard label="Alive Agents" value={aliveAgents} />
          <MetricCard label="Bridges" value={bridgeCount} />
          <MetricCard label="Farms" value={farmCount} />
          <MetricCard label="Ticks Ready" value={ticks} />
        </div>
      </section>

      <section className="command-bar panel">
        <div>
          <h2>Run the World</h2>
          <p>Use the Python engine underneath and bring the latest snapshot back into the browser.</p>
        </div>
        <label className="stacked">
          <span>Ticks to simulate</span>
          <input
            type="number"
            min="1"
            max="500"
            value={ticks}
            onChange={(event) => setTicks(Number(event.target.value))}
          />
        </label>
        <div className="button-row">
          <button className="action" type="button" onClick={() => saveSettings()} disabled={isPending}>
            Save civilization settings
          </button>
          <button className="action emphasis" type="button" onClick={runSimulation} disabled={isPending}>
            {isPending ? "Running..." : "Run simulation"}
          </button>
        </div>
        <p className="status">{statusMessage}</p>
      </section>

      <section className="layout-grid">
        <div className="panel world-panel">
          <div className="panel-heading">
            <div>
              <h2>World View</h2>
              <p>Initial board comes from the scenario. After a run, this switches to the latest Python snapshot.</p>
            </div>
            <div className="legend">
              <span className="legend-chip plain">Plain</span>
              <span className="legend-chip water">Water</span>
              <span className="legend-chip bridge">Bridge</span>
              <span className="legend-chip farm">Farm</span>
              <span className="legend-chip house">House</span>
            </div>
          </div>
          <div
            className="world-grid"
            style={{ gridTemplateColumns: `repeat(${board.width || 1}, minmax(0, 1fr))` }}
          >
            {(board.tiles ?? []).flat().map((tile) => {
              const agentsHere = agentMap.get(`${tile.x},${tile.y}`) ?? [];
              return (
                <div key={`${tile.x}-${tile.y}`} className={`world-tile ${tileTone(tile.terrain)}`}>
                  <span className="tile-label">{terrainLabel(tile)}</span>
                  {agentsHere.length > 0 ? (
                    <div className="tile-agents">
                      {agentsHere.map((agent) => (
                        <span key={agent.id} className={`agent-pill faction-${agent.faction_id}`}>
                          {agent.name.slice(0, 2).toUpperCase()}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel events-panel">
          <div className="panel-heading">
            <div>
              <h2>Event Feed</h2>
              <p>Recent world actions and cultural changes from the latest browser-triggered run.</p>
            </div>
          </div>
          <div className="events-list">
            {events.length === 0 ? (
              <p className="empty-state">Run the simulation to populate the live event feed.</p>
            ) : (
              events.slice(-14).reverse().map((event, index) => (
                <article key={`${event.tick}-${index}`} className={`event-card ${event.success ? "success" : "warn"}`}>
                  <div className="event-meta">
                    <span>Tick {event.tick}</span>
                    <span>{event.kind}</span>
                  </div>
                  <p>{event.description}</p>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="panel settings-panel">
        <div className="panel-heading">
          <div>
            <h2>Civilization AI Settings</h2>
            <p>Each civilization can run on a separate provider, model, and credential path.</p>
          </div>
          <div className="button-row">
            <button className="secondary" type="button" onClick={refreshOpencodeStatus}>
              Refresh OpenCode credentials
            </button>
            <button className="secondary" type="button" onClick={() => launchProviderLogin("gemini-cli")}>
              Launch Gemini login
            </button>
          </div>
        </div>
        <p className="credential-note">
          OpenCode credentials detected locally: {opencodeCredentials.length ? opencodeCredentials.join(", ") : "none yet"}
        </p>
        <div className="faction-grid">
          {factions.map((faction) => {
            const config = settings.factions?.[faction.id] ?? {};
            const models = opencodeModels[faction.id] ?? [];
            return (
              <article key={faction.id} className={`faction-card faction-${faction.id}`}>
                <header>
                  <p className="eyebrow">Civilization</p>
                  <h3>{faction.name}</h3>
                  <p>{faction.culture?.[0]?.description ?? "No seeded culture description."}</p>
                </header>

                <label className="stacked">
                  <span>Provider</span>
                  <select
                    value={config.provider ?? "heuristic"}
                    onChange={(event) => updateFaction(faction.id, { provider: event.target.value })}
                  >
                    {PROVIDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                {config.provider === "gemini-cli" ? (
                  <>
                    <label className="stacked">
                      <span>Auth mode</span>
                      <select
                        value={config.authMode ?? "existing-cli-auth"}
                        onChange={(event) => updateFaction(faction.id, { authMode: event.target.value })}
                      >
                        <option value="existing-cli-auth">Existing CLI login</option>
                        <option value="gemini-api-key">Gemini API key</option>
                        <option value="vertex-ai">Vertex AI</option>
                      </select>
                    </label>
                    <label className="stacked">
                      <span>Model</span>
                      <input
                        list={`gemini-models-${faction.id}`}
                        value={config.model ?? ""}
                        onChange={(event) => updateFaction(faction.id, { model: event.target.value })}
                        placeholder="gemini-2.5-flash"
                      />
                      <datalist id={`gemini-models-${faction.id}`}>
                        {GEMINI_MODELS.map((model) => (
                          <option key={model} value={model} />
                        ))}
                      </datalist>
                    </label>
                    <label className="stacked">
                      <span>Gemini API key</span>
                      <input
                        type="password"
                        value={config.apiKey ?? ""}
                        onChange={(event) => updateFaction(faction.id, { apiKey: event.target.value })}
                        placeholder="Optional if CLI login is already configured"
                      />
                    </label>
                    <label className="stacked">
                      <span>Google Cloud project</span>
                      <input
                        value={config.googleCloudProject ?? ""}
                        onChange={(event) => updateFaction(faction.id, { googleCloudProject: event.target.value })}
                        placeholder="Needed for some paid/org Gemini setups"
                      />
                    </label>
                  </>
                ) : null}

                {config.provider === "opencode" ? (
                  <>
                    <div className="button-row">
                      <button className="secondary" type="button" onClick={() => launchProviderLogin("opencode")}>
                        Launch OpenCode login
                      </button>
                      <button className="secondary" type="button" onClick={() => refreshOpencodeModels(faction.id)}>
                        Refresh model list
                      </button>
                    </div>
                    <label className="stacked">
                      <span>Provider filter</span>
                      <input
                        value={config.opencodeProvider ?? ""}
                        onChange={(event) => updateFaction(faction.id, { opencodeProvider: event.target.value })}
                        placeholder="Optional provider id for opencode models"
                      />
                    </label>
                    <label className="stacked">
                      <span>OpenCode model</span>
                      <select
                        value={config.model ?? ""}
                        onChange={(event) => updateFaction(faction.id, { model: event.target.value })}
                      >
                        <option value="">Choose a model</option>
                        {models.map((model) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                        {config.model && !models.includes(config.model) ? (
                          <option value={config.model}>{config.model}</option>
                        ) : null}
                      </select>
                    </label>
                    <label className="stacked">
                      <span>CLI home override</span>
                      <input
                        value={config.cliHome ?? ""}
                        onChange={(event) => updateFaction(faction.id, { cliHome: event.target.value })}
                        placeholder="Optional isolated OpenCode runtime path"
                      />
                    </label>
                  </>
                ) : null}

                {config.provider === "heuristic" ? (
                  <div className="provider-note">
                    <p>
                      This civilization uses the local deterministic adapter. It is fast, offline-safe, and ideal for
                      baseline world testing.
                    </p>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}


function MetricCard({ label, value }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
