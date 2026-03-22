"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Minus, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  atlasAssetUrls,
  coastOverlays,
  decalPresentation,
  factionTint,
  MAX_ZOOM,
  MIN_ZOOM,
  propPresentation,
  resolveAtlasAsset,
  resourcePresentation,
  riverPresentation,
  roadPresentation,
  settlementPresentation,
  settlementSegments,
  terrainPresentation,
  terrainTextureKey,
  TILE_SIZE
} from "@/lib/world-atlas";


export default function PixelWorldMap({
  world,
  liveFrame,
  overlays,
  selectedTile,
  selectedHumanId,
  cameraLocked,
  onHoverTile,
  onSelectTile,
  onSelectHuman
}) {
  const stageRef = useRef(null);
  const runtimeRef = useRef(null);
  const worldRef = useRef(world);
  const hoverTileRef = useRef(null);
  const selectedTileRef = useRef(selectedTile);
  const onHoverRef = useRef(onHoverTile);
  const onSelectRef = useRef(onSelectTile);
  const onSelectHumanRef = useRef(onSelectHuman);
  const [zoomPercent, setZoomPercent] = useState(0);
  const [hoveredTile, setHoveredTile] = useState(null);

  const staticWorldSignature = useMemo(() => {
    if (!world) {
      return "empty";
    }
    return `${world.seed}:${world.width}x${world.height}:${world.props?.length ?? 0}:${world.settlements?.length ?? 0}:${countTerrain(world, "house")}:${countTerrain(world, "farm")}`;
  }, [world]);
  const staticRenderSignature = useMemo(
    () => `${staticWorldSignature}:${overlays?.roads ? 1 : 0}:${overlays?.resources ? 1 : 0}:${overlays?.structures === false ? 0 : 1}:${overlays?.territories ? 1 : 0}`,
    [staticWorldSignature, overlays]
  );

  useEffect(() => {
    worldRef.current = world;
  }, [world]);

  useEffect(() => {
    selectedTileRef.current = selectedTile;
    syncFocusSprites(runtimeRef.current, selectedTile, hoverTileRef.current);
  }, [selectedTile]);

  useEffect(() => {
    onHoverRef.current = onHoverTile;
  }, [onHoverTile]);

  useEffect(() => {
    onSelectRef.current = onSelectTile;
  }, [onSelectTile]);

  useEffect(() => {
    onSelectHumanRef.current = onSelectHuman;
  }, [onSelectHuman]);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    async function mountPixi() {
      if (!stageRef.current || runtimeRef.current) {
        return;
      }
      const pixi = await import("pixi.js");
      const viewportPackage = await import("pixi-viewport");
      if (cancelled || !stageRef.current) {
        return;
      }

      const {
        Application,
        Assets,
        BlurFilter,
        ColorMatrixFilter,
        Container,
        SCALE_MODES,
        Sprite,
        TextureStyle,
        Texture
      } = pixi;
      const { Viewport } = viewportPackage;

      TextureStyle.defaultOptions.scaleMode = SCALE_MODES.NEAREST;

      const app = new Application();
      await app.init({
        resizeTo: stageRef.current,
        antialias: false,
        backgroundAlpha: 0,
        preference: "webgl",
        powerPreference: "high-performance"
      });

      app.canvas.className = "pixel-perfect block size-full touch-none";
      stageRef.current.appendChild(app.canvas);

      const viewport = new Viewport({
        screenWidth: Math.max(stageRef.current.clientWidth, 1),
        screenHeight: Math.max(stageRef.current.clientHeight, 1),
        worldWidth: 1,
        worldHeight: 1,
        events: app.renderer.events,
        disableOnContextMenu: true
      });
      viewport.drag().wheel().pinch().decelerate();
      app.stage.addChild(viewport);

      const envFilter = new ColorMatrixFilter();
      app.stage.filters = [envFilter];

      const terrainLayer = new Container();
      const territoryLayer = new Container();
      const fluidLayer = new Container();
      const roadLayer = new Container();
      const detailLayer = new Container();
      const propLayer = new Container();
      const settlementLayer = new Container();
      const agentLayer = new Container();
      const faunaLayer = new Container();
      const fxLayer = new Container();
      const uiLayer = new Container();

      viewport.addChild(terrainLayer);
      viewport.addChild(territoryLayer);
      viewport.addChild(fluidLayer);
      viewport.addChild(roadLayer);
      viewport.addChild(detailLayer);
      viewport.addChild(propLayer);
      viewport.addChild(settlementLayer);
      viewport.addChild(agentLayer);
      viewport.addChild(faunaLayer);
      viewport.addChild(fxLayer);
      viewport.addChild(uiLayer);

      await Assets.load(atlasAssetUrls());

      const hoverRing = Sprite.from(resolveAtlasAsset("focus-ring"));
      hoverRing.anchor.set(0.5);
      hoverRing.visible = false;
      hoverRing.alpha = 0.65;
      uiLayer.addChild(hoverRing);

      const selectRing = Sprite.from(resolveAtlasAsset("focus-ring"));
      selectRing.anchor.set(0.5);
      selectRing.visible = false;
      selectRing.alpha = 0.95;
      uiLayer.addChild(selectRing);

      const runtime = {
        pixi,
        app,
        viewport,
        layers: {
          terrainLayer,
          territoryLayer,
          fluidLayer,
          roadLayer,
          detailLayer,
          propLayer,
          settlementLayer,
          agentLayer,
          faunaLayer,
          fxLayer,
          uiLayer
        },
        envFilter,
        weatherSprites: [],
        hoverRing,
        selectRing,
        agentPositions: new Map(),
        humanHitTargets: [],
        agentTweens: [],
        animatedGlints: [],
        fogSprites: [],
        lastHudZoom: -1,
        lastFittedSignature: "",
        lastRenderedStaticSignature: "",
        worldSignature: ""
      };
      runtimeRef.current = runtime;

      const resizeObserver = new ResizeObserver(() => {
        if (!runtimeRef.current || !stageRef.current) {
          return;
        }
        const width = Math.max(stageRef.current.clientWidth, 1);
        const height = Math.max(stageRef.current.clientHeight, 1);
        runtime.viewport.resize(width, height, runtime.viewport.worldWidth, runtime.viewport.worldHeight);
        if (worldRef.current) {
          maybeFitWorld(runtimeRef.current, worldRef.current, true);
        }
        updateZoomHud(runtimeRef.current, setZoomPercent);
      });
      resizeObserver.observe(stageRef.current);

      const handlePointerMove = (event) => {
        const tile = pointerToTile(runtimeRef.current, event);
        hoverTileRef.current = tile;
        setHoveredTile(tile);
        onHoverRef.current?.(tile);
        syncFocusSprites(runtimeRef.current, selectedTileRef.current, tile);
      };
      const handlePointerLeave = () => {
        hoverTileRef.current = null;
        setHoveredTile(null);
        onHoverRef.current?.(null);
        syncFocusSprites(runtimeRef.current, selectedTileRef.current, null);
      };
      const handlePointerUp = (event) => {
        const human = pointerToHuman(runtimeRef.current, event);
        if (human) {
          onSelectHumanRef.current?.(human);
          onSelectRef.current?.({ x: human.x, y: human.y });
          return;
        }
        const tile = pointerToTile(runtimeRef.current, event);
        if (!tile) {
          return;
        }
        onSelectRef.current?.(tile);
      };

      const handleWheel = (e) => {
        e.preventDefault();
      };

      app.canvas.addEventListener("pointermove", handlePointerMove);
      app.canvas.addEventListener("pointerleave", handlePointerLeave);
      app.canvas.addEventListener("pointerup", handlePointerUp);
      stageRef.current.addEventListener("wheel", handleWheel, { passive: false });

      app.ticker.add((ticker) => animateRuntime(runtime, ticker.deltaMS, setZoomPercent));

      cleanup = () => {
        resizeObserver.disconnect();
        app.canvas.removeEventListener("pointermove", handlePointerMove);
        app.canvas.removeEventListener("pointerleave", handlePointerLeave);
        app.canvas.removeEventListener("pointerup", handlePointerUp);
        const stage = stageRef.current;
        if (stage) {
          stage.removeEventListener("wheel", handleWheel);
        }
        runtimeRef.current = null;
        app.destroy(true);
      };
      renderStaticWorld(runtime, worldRef.current, overlays, staticRenderSignature);
      renderDynamicWorld(runtime, worldRef.current, overlays, liveFrame, selectedHumanId);
      syncFocusSprites(runtime, selectedTileRef.current, hoverTileRef.current);
      updateZoomHud(runtime, setZoomPercent);
    }

    mountPixi();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (!runtimeRef.current) {
      return;
    }
    renderStaticWorld(runtimeRef.current, world, overlays, staticRenderSignature);
    syncFocusSprites(runtimeRef.current, selectedTile, hoverTileRef.current);
  }, [world, overlays, staticRenderSignature, selectedTile]);

  useEffect(() => {
    if (!runtimeRef.current) {
      return;
    }
    renderDynamicWorld(runtimeRef.current, world, overlays, liveFrame, selectedHumanId);
    renderEnvironment(runtimeRef.current, world);
    syncFocusSprites(runtimeRef.current, selectedTile, hoverTileRef.current);
  }, [world, liveFrame, overlays?.humans, selectedHumanId, selectedTile]);

  useEffect(() => {
    if (runtimeRef.current) {
      runtimeRef.current.cameraLocked = cameraLocked;
      runtimeRef.current.followHumanId = cameraLocked ? selectedHumanId : null;
    }
  }, [cameraLocked, selectedHumanId]);

  function nudgeZoom(multiplier) {
    const runtime = runtimeRef.current;
    if (!runtime) {
      return;
    }
    const nextZoom = clamp(runtime.viewport.scale.x * multiplier, MIN_ZOOM, MAX_ZOOM);
    runtime.viewport.setZoom(nextZoom, true);
    updateZoomHud(runtime, setZoomPercent);
  }

  function fitView() {
    if (!runtimeRef.current || !world) {
      return;
    }
    maybeFitWorld(runtimeRef.current, world, true);
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <Badge className="bg-black/50 backdrop-blur-md">{world?.seed ?? "..."}</Badge>
          <Badge variant="secondary" className="bg-black/50 backdrop-blur-md">{world ? `${world.width} x ${world.height}` : "No world"}</Badge>
          <Badge variant="secondary" className="bg-black/50 backdrop-blur-md">{zoomPercent}% zoom</Badge>
          {hoveredTile ? <Badge variant="secondary" className="bg-black/50 backdrop-blur-md">{hoveredTile.x}, {hoveredTile.y}</Badge> : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-black/50 p-1.5 backdrop-blur-md">
          <Button size="icon" variant="ghost" className="size-8" onClick={() => nudgeZoom(1.15)}>
            <Plus className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={() => nudgeZoom(0.87)}>
            <Minus className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={fitView}>
            <LocateFixed className="size-3.5" />
          </Button>
        </div>
      </div>

      <div ref={stageRef} className="relative h-full w-full bg-black">
        <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_40%)]" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-3 p-4">
        <div className="pointer-events-auto rounded-2xl border border-white/8 bg-black/70 px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-500 backdrop-blur-md">
          Drag to pan. Scroll or pinch to zoom.
        </div>
        <div className="pointer-events-auto rounded-2xl border border-white/8 bg-black/70 px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-500 backdrop-blur-md">
          Pixi atlas stage
        </div>
      </div>
    </div>
  );
}


function renderStaticWorld(runtime, world, overlays, worldSignature) {
  if (!runtime || !world) {
    return;
  }
  runtime.world = world;
  runtime.worldSignature = worldSignature;
  if (runtime.lastRenderedStaticSignature === worldSignature) {
    return;
  }
  runtime.lastRenderedStaticSignature = worldSignature;
  runtime.animatedGlints = [];

  const {
    Sprite,
    Texture
  } = runtime.pixi;

  if (!runtime.proceduralTextures) {
    runtime.proceduralTextures = generateProceduralTextures(runtime);
  }
  const {
    terrainLayer,
    territoryLayer,
    fluidLayer,
    roadLayer,
    detailLayer,
    propLayer,
    settlementLayer,
    agentLayer,
    faunaLayer
  } = runtime.layers;

  clearLayer(terrainLayer);
  clearLayer(territoryLayer);
  clearLayer(fluidLayer);
  clearLayer(roadLayer);
  clearLayer(detailLayer);
  clearLayer(propLayer);
  clearLayer(settlementLayer);
  clearLayer(agentLayer);
  clearLayer(faunaLayer);

  runtime.viewport.worldWidth = world.width * TILE_SIZE;
  runtime.viewport.worldHeight = world.height * TILE_SIZE;
  runtime.viewport.resize(
    Math.max(runtime.app.canvas.clientWidth || runtime.app.screen.width, 1),
    Math.max(runtime.app.canvas.clientHeight || runtime.app.screen.height, 1),
    runtime.viewport.worldWidth,
    runtime.viewport.worldHeight
  );

  for (const row of world.tiles ?? []) {
    for (const tile of row) {
      const px = tile.x * TILE_SIZE;
      const py = tile.y * TILE_SIZE;

      const baseStyle = terrainPresentation(tile);
      const terrainTexture = runtime.proceduralTextures[terrainTextureKey(tile)] ?? Texture.WHITE;
      const shift = (tile.height_level || 0) * 2;

      if (shift > 0 && tile.terrain !== "water") {
        const edge = new Sprite(Texture.WHITE);
        edge.width = TILE_SIZE;
        edge.height = TILE_SIZE + shift;
        edge.x = px;
        edge.y = py - shift;
        edge.tint = terrainShadowTint(tile);
        terrainLayer.addChild(edge);
      }

      const base = new Sprite(terrainTexture);
      base.width = TILE_SIZE;
      base.height = TILE_SIZE;
      base.x = px;
      base.y = py - shift;
      base.tint = baseStyle.tint;
      terrainLayer.addChild(base);

      if (tile.edge_mask && tile.terrain !== "water") {
        for (const overlay of coastOverlays(tile.edge_mask)) {
          const coastSprite = Sprite.from(overlay.asset);
          coastSprite.x = px + (TILE_SIZE / 2);
          coastSprite.y = py + (TILE_SIZE / 2) - shift;
          coastSprite.anchor.set(0.5);
          coastSprite.rotation = overlay.rotation;
          coastSprite.alpha = 0.78;
          detailLayer.addChild(coastSprite);
        }
      }

      if (overlays?.territories && tile.owner_faction) {
        const territory = Sprite.from(resolveAtlasAsset("overlay-tint"));
        territory.x = px;
        territory.y = py - shift;
        territory.tint = factionTint(tile.owner_faction);
        territory.alpha = tile.settlement_id ? 0.11 : 0.085;
        territoryLayer.addChild(territory);
      }

      if (tile.river_mask) {
        const river = riverPresentation(tile.river_mask);
        const sprite = Sprite.from(river.asset);
        sprite.x = px + (TILE_SIZE / 2);
        sprite.y = py + (TILE_SIZE / 2) - shift;
        sprite.anchor.set(0.5);
        sprite.rotation = river.rotation;
        sprite.tint = river.tint;
        sprite.scale.set(river.scale);
        fluidLayer.addChild(sprite);
      }

      if (overlays?.roads && tile.road_mask) {
        const road = roadPresentation(tile.road_mask);
        const sprite = Sprite.from(road.asset);
        sprite.x = px + (TILE_SIZE / 2);
        sprite.y = py + (TILE_SIZE / 2) - shift;
        sprite.anchor.set(0.5);
        sprite.rotation = road.rotation;
        sprite.tint = road.tint;
        sprite.scale.set(road.scale);
        sprite.alpha = tile.terrain === "bridge" ? 0.7 : 0.92;
        roadLayer.addChild(sprite);
      }

      if (tile.decal) {
        const decal = decalPresentation(tile.decal);
        const sprite = Sprite.from(decal.asset);
        sprite.x = px;
        sprite.y = py - shift;
        sprite.tint = decal.tint;
        sprite.alpha = tile.decal === "water-glint" ? 0.5 : 0.22;
        detailLayer.addChild(sprite);
        if (tile.decal === "water-glint") {
          runtime.animatedGlints.push({
            sprite,
            baseAlpha: 0.4,
            phase: ((tile.x * 13) + (tile.y * 17)) * 0.07
          });
        }
      }

      if (overlays?.resources && tile.resource) {
        const resource = resourcePresentation(tile.resource);
        const sprite = Sprite.from(resource.asset);
        sprite.x = px + 10;
        sprite.y = py + 10 - shift;
        sprite.width = 4;
        sprite.height = 4;
        sprite.tint = resource.tint;
        sprite.alpha = 0.95;
        detailLayer.addChild(sprite);
      }
    }
  }

  for (const prop of world.props ?? []) {
    if (!prop.x && prop.x !== 0) {
      continue;
    }
    if (prop.kind === "river-trace") {
      continue;
    }
    const shift = (world.tiles?.[prop.y]?.[prop.x]?.height_level ?? 0) * 2;
    let sprite;
    if (prop.kind === "farm") {
      sprite = new Sprite(runtime.proceduralTextures["farm"]);
    } else {
      const presentation = propPresentation(prop);
      sprite = Sprite.from(presentation.asset);
      sprite.tint = presentation.tint;
    }
    sprite.x = prop.x * TILE_SIZE;
    sprite.y = prop.y * TILE_SIZE - shift;
    sprite.alpha = prop.kind === "ship" ? 0.95 : 0.82;
    propLayer.addChild(sprite);
  }

  if (overlays?.structures !== false) {
    for (const settlement of world.settlements ?? []) {
      for (const segment of settlementSegments(settlement)) {
        const shift = (world.tiles?.[segment.y]?.[segment.x]?.height_level ?? 0) * 2;
        const px = segment.x * TILE_SIZE;
        const py = segment.y * TILE_SIZE - shift;

        const baseSprite = new Sprite(runtime.proceduralTextures["house-base"]);
        baseSprite.x = px;
        baseSprite.y = py;
        settlementLayer.addChild(baseSprite);

        const roofSprite = new Sprite(runtime.proceduralTextures["house-roof"]);
        roofSprite.x = px;
        roofSprite.y = py;
        const ownerFactionId = world.tiles?.[segment.y]?.[segment.x]?.owner_faction;
        roofSprite.tint = ownerFactionId ? factionTint(ownerFactionId) : 0xef4444;
        settlementLayer.addChild(roofSprite);
      }
    }
  }

  maybeFitWorld(runtime, world, false);
}

function renderDynamicWorld(runtime, world, overlays, liveFrame, selectedHumanId) {
  if (!runtime || !world) {
    return;
  }
  const { Sprite } = runtime.pixi;
  const { agentLayer, faunaLayer } = runtime.layers;
  clearLayer(agentLayer);
  clearLayer(faunaLayer);

  if (!overlays?.humans) {
    runtime.humanHitTargets = [];
    return;
  }

  const frameHumans = Array.isArray(liveFrame?.humans) ? liveFrame.humans : null;
  const humansById = Object.fromEntries(Object.values(world.humans ?? world.agents ?? {}).map((human) => [human.id, human]));
  const tileSlots = new Map();
  const nextHumanHitTargets = [];

  const humans = frameHumans
    ? frameHumans.filter((human) => human.alive !== false)
    : Object.values(world.humans ?? world.agents ?? {}).filter((human) => human.alive !== false).map((human) => ({
        id: human.id,
        x: human.x,
        y: human.y,
        render_x: human.render_x ?? human.x,
        render_y: human.render_y ?? human.y,
        state: human.task_state ?? "idle",
        speaking: false
      }));

  for (const human of humans) {
    const source = humansById[human.id];
    if (!source) {
      continue;
    }
    const tileKey = `${human.x}:${human.y}`;
    const slot = tileSlots.get(tileKey) ?? 0;
    tileSlots.set(tileKey, slot + 1);
    const offset = swarmSlotOffset(slot);
    const shift = (world.tiles?.[human.y]?.[human.x]?.height_level ?? 0) * 2;
    const sprite = buildHumanMarker(runtime, Sprite, factionTint(source.faction_id), {
      selected: source.id === selectedHumanId,
      active: human.state && human.state !== "idle",
      speaking: Boolean(human.speaking)
    });
    const worldX = ((human.render_x ?? human.x) * TILE_SIZE) + (TILE_SIZE / 2) + offset.x;
    const worldY = ((human.render_y ?? human.y) * TILE_SIZE) + (TILE_SIZE / 2) + offset.y - shift;
    sprite.x = worldX;
    sprite.y = worldY;
    agentLayer.addChild(sprite);

    nextHumanHitTargets.push({
      id: source.id,
      name: source.name,
      faction_id: source.faction_id,
      x: human.x,
      y: human.y,
      worldX,
      worldY,
      radius: source.id === selectedHumanId ? 8 : 6
    });
  }

  runtime.humanHitTargets = nextHumanHitTargets;
}

function renderEnvironment(runtime, world) {
  if (!runtime || !world) return;
  const { envFilter, layers: { fxLayer }, pixi: { Sprite, Texture } } = runtime;

  const time = world.time_of_day ?? 8;
  envFilter.reset();

  if (time >= 20 || time <= 5) {
    envFilter.brightness(0.4, false);
    envFilter.tint(0x334477, false);
  } else if (time >= 18 && time < 20) {
    envFilter.brightness(0.7, false);
    envFilter.tint(0xffaa66, false);
  } else if (time > 5 && time <= 7) {
    envFilter.brightness(0.9, false);
    envFilter.tint(0xffd0a0, false);
  }

  if (runtime.currentWeather !== world.weather) {
    runtime.currentWeather = world.weather || "clear";
    
    for (const ws of runtime.weatherSprites) {
      ws.sprite.destroy();
    }
    runtime.weatherSprites = [];

    if (runtime.currentWeather === "rain" || runtime.currentWeather === "storm") {
      const count = runtime.currentWeather === "storm" ? 350 : 150;
      for (let i = 0; i < count; i++) {
        const sprite = new Sprite(Texture.WHITE);
        sprite.width = 1;
        sprite.height = Math.random() * 6 + 4;
        sprite.tint = 0x88bbff;
        sprite.alpha = 0.4;
        sprite.x = Math.random() * runtime.viewport.worldWidth;
        sprite.y = Math.random() * runtime.viewport.worldHeight;
        fxLayer.addChild(sprite);
        runtime.weatherSprites.push({ sprite, speed: Math.random() * 8 + 12, type: "rain" });
      }
      if (runtime.currentWeather === "storm") {
         envFilter.brightness(0.6, false);
         envFilter.tint(0x667788, false);
      }
    } else if (runtime.currentWeather === "snow") {
      for (let i = 0; i < 200; i++) {
        const sprite = new Sprite(Texture.WHITE);
        sprite.width = 2;
        sprite.height = 2;
        sprite.tint = 0xffffff;
        sprite.alpha = 0.6;
        sprite.x = Math.random() * runtime.viewport.worldWidth;
        sprite.y = Math.random() * runtime.viewport.worldHeight;
        fxLayer.addChild(sprite);
        runtime.weatherSprites.push({ sprite, speed: Math.random() * 1.5 + 1.5, drift: Math.random() * 2 - 1, type: "snow" });
      }
    }
  }
}

function generateProceduralTextures(runtime) {
  const { Graphics } = runtime.pixi;
  const { app } = runtime;
  const cache = {};

  function makeTexture(id, drawFn) {
    const g = new Graphics();
    drawFn(g);
    const texture = app.renderer.generateTexture(g);
    cache[id] = texture;
    g.destroy();
  }

  // Clean, perfectly readable pixel trees
  makeTexture("tree-cluster", (g) => {
    if (g.beginFill) {
      g.beginFill(0x4a2e1b); g.drawRect(6, 11, 4, 5); // Trunk
      g.beginFill(0x2d5c1e); g.drawRect(2, 2, 12, 10); // Leaves shadow
      g.beginFill(0x3e7a29); g.drawRect(3, 3, 10, 8); // Leaves mid
      g.beginFill(0x56a13d); g.drawRect(5, 4, 4, 4);  // Leaves bright
      g.endFill();
    } else {
      g.rect(6, 11, 4, 5).fill({ color: 0x4a2e1b });
      g.rect(2, 2, 12, 10).fill({ color: 0x2d5c1e });
      g.rect(3, 3, 10, 8).fill({ color: 0x3e7a29 });
      g.rect(5, 4, 4, 4).fill({ color: 0x56a13d });
    }
  });

  makeTexture("terrain-water-deep", (g) => {
    fillRect(g, 0, 0, 16, 16, 0xffffff);
    fillRect(g, 3, 4, 3, 1, 0xd8f1ff);
    fillRect(g, 9, 10, 3, 1, 0xc0ebff);
  });

  makeTexture("terrain-water", (g) => {
    fillRect(g, 0, 0, 16, 16, 0xffffff);
    fillRect(g, 2, 5, 4, 1, 0xe6fbff);
    fillRect(g, 9, 10, 4, 1, 0xd9f7ff);
  });

  makeTexture("terrain-water-shallow", (g) => {
    fillRect(g, 0, 0, 16, 16, 0xffffff);
    fillRect(g, 3, 3, 4, 2, 0xf7ffff);
    fillRect(g, 9, 10, 4, 1, 0xd5fbff);
  });

  makeTexture("terrain-grass", (g) => {
    fillRect(g, 0, 0, 16, 16, 0xffffff);
    fillRect(g, 3, 4, 2, 2, 0xe0ffbe);
    fillRect(g, 10, 9, 2, 2, 0xc0ec8f);
  });

  makeTexture("terrain-meadow", (g) => {
    fillRect(g, 0, 0, 16, 16, 0xffffff);
    fillRect(g, 3, 4, 2, 2, 0xfef3a3);
    fillRect(g, 10, 10, 2, 2, 0xd7f7ae);
  });

  makeTexture("terrain-forest-floor", (g) => {
    fillRect(g, 0, 0, 16, 16, 0xffffff);
    fillRect(g, 4, 4, 3, 2, 0xefffc6);
    fillRect(g, 9, 10, 3, 2, 0xc2e28d);
  });

  makeTexture("terrain-sand", (g) => {
    fillRect(g, 0, 0, 16, 16, 0xffffff);
    fillRect(g, 4, 5, 4, 1, 0xfff3cf);
    fillRect(g, 8, 10, 4, 1, 0xedcf8b);
  });

  makeTexture("terrain-swamp", (g) => {
    fillRect(g, 0, 0, 16, 16, 0xffffff);
    fillRect(g, 4, 4, 4, 2, 0xb7cf9a);
    fillRect(g, 8, 10, 4, 2, 0x7da26a);
  });

  makeTexture("terrain-snow", (g) => {
    fillRect(g, 0, 0, 16, 16, 0xffffff);
    fillRect(g, 4, 5, 3, 2, 0xe2edf7);
    fillRect(g, 9, 10, 3, 2, 0xd2e0ed);
  });

  makeTexture("terrain-crystal", (g) => {
    fillRect(g, 0, 0, 16, 16, 0xffffff);
    fillRect(g, 4, 4, 3, 4, 0xf0f3ff);
    fillRect(g, 9, 9, 3, 4, 0xc7d8ff);
  });

  makeTexture("terrain-volcanic", (g) => {
    fillRect(g, 0, 0, 16, 16, 0xffffff);
    fillRect(g, 4, 4, 4, 2, 0x2a2a2f);
    fillRect(g, 8, 10, 4, 2, 0xff9b63);
  });

  makeTexture("terrain-highland", (g) => {
    fillRect(g, 0, 0, 16, 16, 0xffffff);
    fillRect(g, 4, 5, 4, 2, 0xd4d6d8);
    fillRect(g, 8, 10, 4, 2, 0xa2a7ab);
  });

  // Sharp, simple boxy mountains
  makeTexture("mountain", (g) => {
    if (g.beginFill) {
      g.beginFill(0x5c5d60); g.drawRect(2, 6, 12, 10); // Base shadow
      g.beginFill(0x7a7b7e); g.drawRect(3, 3, 10, 13); // Mid
      g.beginFill(0x9ca3af); g.drawRect(5, 1, 6, 15); // Peak edge
      g.beginFill(0xd1d5db); g.drawRect(6, 1, 4, 5); // Snow cap
      g.endFill();
    } else {
      g.rect(2, 6, 12, 10).fill({ color: 0x5c5d60 });
      g.rect(3, 3, 10, 13).fill({ color: 0x7a7b7e });
      g.rect(5, 1, 6, 15).fill({ color: 0x9ca3af });
      g.rect(6, 1, 4, 5).fill({ color: 0xd1d5db });
    }
  });

  // Very clean, distinct house geometry
  makeTexture("house-base", (g) => {
    if (g.beginFill) {
      g.beginFill(0xe0e6ed); g.drawRect(3, 6, 10, 8); // Wall
      g.beginFill(0x9ca3af); g.drawRect(3, 13, 10, 1); // Wall shadow
      g.beginFill(0x5c3a21); g.drawRect(6, 9, 4, 5); // Door
      g.endFill();
    } else {
      g.rect(3, 6, 10, 8).fill({ color: 0xe0e6ed });
      g.rect(3, 13, 10, 1).fill({ color: 0x9ca3af });
      g.rect(6, 9, 4, 5).fill({ color: 0x5c3a21 });
    }
  });

  // Red/brown roofs
  makeTexture("house-roof", (g) => {
    if (g.beginFill) {
      g.beginFill(0xffffff); g.drawRect(1, 5, 14, 2); 
      g.drawRect(2, 3, 12, 2);
      g.drawRect(4, 1, 8, 2);
      g.endFill();
    } else {
      g.rect(1, 5, 14, 2).fill({ color: 0xffffff });
      g.rect(2, 3, 12, 2).fill({ color: 0xffffff });
      g.rect(4, 1, 8, 2).fill({ color: 0xffffff });
    }
  });

  // Smooth farm patches instead of crazy stripes
  makeTexture("farm", (g) => {
    if (g.beginFill) {
      g.beginFill(0x4e3e26); g.drawRect(1, 1, 14, 14); // Dirt base
      g.beginFill(0xfacc15); g.drawRect(3, 3, 10, 10); // Wheat square
      g.beginFill(0xd97706); g.drawRect(5, 5, 6, 6); // Wheat center
      g.endFill();
    } else {
      g.rect(1, 1, 14, 14).fill({ color: 0x4e3e26 });
      g.rect(3, 3, 10, 10).fill({ color: 0xfacc15 });
      g.rect(5, 5, 6, 6).fill({ color: 0xd97706 });
    }
  });

  // Basic compact humans
  makeTexture("agent", (g) => {
    if (g.beginFill) {
      g.beginFill(0x1f2937); g.drawRect(4, 10, 8, 4); // Legs
      g.beginFill(0xffffff); g.drawRect(3, 4, 10, 6); // Body (tinted)
      g.beginFill(0xffdcb1); g.drawRect(4, 0, 8, 4); // Head
      g.endFill();
    } else {
      g.rect(4, 10, 8, 4).fill({ color: 0x1f2937 });
      g.rect(3, 4, 10, 6).fill({ color: 0xffffff });
      g.rect(4, 0, 8, 4).fill({ color: 0xffdcb1 });
    }
  });

  makeTexture("human", (g) => {
    if (g.beginFill) {
      g.beginFill(0xffdcb1); g.drawRect(5, 3, 6, 4); // Head
      g.beginFill(0xffffff); g.drawRect(4, 7, 8, 5); // Body
      g.endFill();
    } else {
      g.rect(5, 3, 6, 4).fill({ color: 0xffdcb1 });
      g.rect(4, 7, 8, 5).fill({ color: 0xffffff });
    }
  });

  makeTexture("swarm-dot", (g) => {
    if (g.beginFill) {
      g.beginFill(0xffffff); g.drawRect(0, 0, 4, 4);
      g.endFill();
    } else {
      g.rect(0, 0, 4, 4).fill({ color: 0xffffff });
    }
  });

  return cache;
}

function fillRect(graphics, x, y, w, h, color) {
  if (graphics.beginFill) {
    graphics.beginFill(color);
    graphics.drawRect(x, y, w, h);
    graphics.endFill();
    return;
  }
  graphics.rect(x, y, w, h).fill({ color });
}

function addFog(runtime) {
  const { Sprite, BlurFilter } = runtime.pixi;
  clearLayer(runtime.layers.fxLayer);
  runtime.fogSprites = [];
  for (const cloud of [
    { x: 180, y: 120, scale: 1.2, speed: 0.013, alpha: 0.15 },
    { x: 520, y: 340, scale: 1.7, speed: 0.009, alpha: 0.11 },
    { x: 760, y: 180, scale: 1.35, speed: 0.011, alpha: 0.09 }
  ]) {
    const sprite = Sprite.from(resolveAtlasAsset("fog"));
    sprite.x = cloud.x;
    sprite.y = cloud.y;
    sprite.alpha = cloud.alpha;
    sprite.scale.set(cloud.scale);
    sprite.filters = [new BlurFilter({ strength: 2 })];
    runtime.layers.fxLayer.addChild(sprite);
    runtime.fogSprites.push({ sprite, speed: cloud.speed });
  }
}


function animateRuntime(runtime, deltaMs, setZoomPercent) {
  if (!runtime) {
    return;
  }
  const delta = deltaMs / 1000;

  if (runtime.cameraLocked && runtime.followHumanId && runtime.viewport) {
    const hitTarget = runtime.humanHitTargets.find((h) => h.id === runtime.followHumanId);
    if (hitTarget) {
      const currentX = runtime.viewport.center.x;
      const currentY = runtime.viewport.center.y;
      const targetX = hitTarget.worldX;
      const targetY = hitTarget.worldY;
      
      const dist = Math.hypot(targetX - currentX, targetY - currentY);
      if (dist > 1500) {
        runtime.viewport.moveCenter(targetX, targetY);
      } else {
        const lerp = 1 - Math.pow(0.85, deltaMs / 16.66);
        runtime.viewport.moveCenter(
          currentX + (targetX - currentX) * lerp,
          currentY + (targetY - currentY) * lerp
        );
      }
    }
  }

  for (const fog of runtime.fogSprites) {
    fog.sprite.x += delta * 24 * fog.speed * 60;
    if (fog.sprite.x > runtime.viewport.worldWidth + 80) {
      fog.sprite.x = -120;
    }
  }
  for (const glint of runtime.animatedGlints) {
    glint.sprite.alpha = glint.baseAlpha + (Math.sin((performance.now() * 0.0025) + glint.phase) * 0.16);
  }
  for (const tween of runtime.agentTweens) {
    tween.elapsed = Math.min(tween.duration, tween.elapsed + deltaMs);
    const progress = tween.elapsed / tween.duration;
    const eased = easeOutCubic(progress);
    tween.sprite.x = tween.startX + ((tween.targetX - tween.startX) * eased);
    tween.sprite.y =
      tween.startY +
      ((tween.targetY - tween.startY) * eased) +
      (Math.sin((performance.now() * 0.004) + tween.bobPhase) * (tween.bobAmount ?? 0.2));
  }
  const pulse = 1 + (Math.sin(performance.now() * 0.005) * 0.05);
  runtime.hoverRing.scale.set(pulse);
  runtime.selectRing.scale.set(1.02 + (Math.sin(performance.now() * 0.004) * 0.04));
  updateZoomHud(runtime, setZoomPercent);
}


function updateZoomHud(runtime, setZoomPercent) {
  if (!runtime) {
    return;
  }
  const zoom = Math.round(runtime.viewport.scale.x * 100);
  if (zoom !== runtime.lastHudZoom) {
    runtime.lastHudZoom = zoom;
    setZoomPercent(zoom);
  }
}


function maybeFitWorld(runtime, world, force) {
  if (!runtime || !world) {
    return;
  }
  const fitSignature = `${world.seed}:${world.width}x${world.height}`;
  if (!force && runtime.lastFittedSignature === fitSignature) {
    return;
  }
  runtime.viewport.fitWorld(true);
  const clamped = clamp(runtime.viewport.scale.x, MIN_ZOOM, MAX_ZOOM);
  runtime.viewport.setZoom(clamped, true);
  runtime.viewport.moveCenter(runtime.viewport.worldWidth / 2, runtime.viewport.worldHeight / 2);
  runtime.lastFittedSignature = fitSignature;
}


function pointerToTile(runtime, event) {
  const world = runtime?.world;
  if (!runtime || !world) {
    return null;
  }
  const bounds = runtime.app.canvas.getBoundingClientRect();
  const point = runtime.viewport.toWorld(event.clientX - bounds.left, event.clientY - bounds.top);
  const tileX = Math.floor(point.x / TILE_SIZE);
  const tileY = Math.floor(point.y / TILE_SIZE);
  if (tileX < 0 || tileY < 0 || tileX >= world.width || tileY >= world.height) {
    return null;
  }
  return { x: tileX, y: tileY };
}


function pointerToHuman(runtime, event) {
  if (!runtime?.humanHitTargets?.length) {
    return null;
  }
  const bounds = runtime.app.canvas.getBoundingClientRect();
  const point = runtime.viewport.toWorld(event.clientX - bounds.left, event.clientY - bounds.top);
  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of runtime.humanHitTargets) {
    const distance = Math.hypot(candidate.worldX - point.x, candidate.worldY - point.y);
    if (distance <= candidate.radius && distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }
  return nearest;
}


function syncFocusSprites(runtime, selectedTile, hoveredTile) {
  if (!runtime) {
    return;
  }
  placeRing(runtime.selectRing, selectedTile, 0xffffff);
  if (!selectedTile || !hoveredTile || hoveredTile.x !== selectedTile.x || hoveredTile.y !== selectedTile.y) {
    placeRing(runtime.hoverRing, hoveredTile, 0xd7d7d7);
  } else {
    runtime.hoverRing.visible = false;
  }
}


function placeRing(sprite, tile, tint) {
  if (!sprite || !tile) {
    if (sprite) {
      sprite.visible = false;
    }
    return;
  }
  sprite.visible = true;
  sprite.tint = tint;
  sprite.x = (tile.x * TILE_SIZE) + (TILE_SIZE / 2);
  sprite.y = (tile.y * TILE_SIZE) + (TILE_SIZE / 2);
  sprite.width = TILE_SIZE;
  sprite.height = TILE_SIZE;
}


function clearLayer(layer) {
  for (const child of layer.removeChildren()) {
    child.destroy();
  }
}


function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}


function easeOutCubic(value) {
  return 1 - ((1 - value) ** 3);
}


function buildHumanMarker(runtime, Sprite, tint, { selected = false, active = false, speaking = false } = {}) {
  const sprite = new Sprite(runtime.proceduralTextures["swarm-dot"]);
  sprite.anchor.set(0.5);
  sprite.width = selected ? 5 : 4;
  sprite.height = selected ? 5 : 4;
  sprite.tint = tint;
  sprite.alpha = speaking ? 1 : active ? 0.96 : 0.9;
  return sprite;
}

function terrainShadowTint(tile) {
  if (tile.feature === "mountain" || tile.biome === "mountain" || tile.biome === "hills") return 0x4d5155;
  if (tile.biome === "coast" || tile.biome === "sand" || tile.biome === "desert" || tile.biome === "savanna") return 0xb38a4e;
  if (tile.biome === "snow" || tile.biome === "tundra") return 0xc7d3de;
  if (tile.biome === "swamp") return 0x43614a;
  if (tile.biome === "crystal" || tile.biome === "arcane") return 0x6f89b7;
  if (tile.biome === "volcanic" || tile.biome === "corrupted") return 0x4b302b;
  return 0x5c7a3a;
}


function swarmSlotOffset(slot) {
  const offsets = [
    { x: 0, y: 0 },
    { x: -3, y: -2 },
    { x: 3, y: -2 },
    { x: -2, y: 3 },
    { x: 3, y: 3 },
    { x: 0, y: -4 }
  ];
  return offsets[slot % offsets.length];
}


function buildAnimalMarker(runtime, Sprite, tint) {
  const sprite = new Sprite(runtime.proceduralTextures["agent"]);
  sprite.anchor.set(0.5);
  sprite.width = 8;
  sprite.height = 8;
  sprite.tint = tint;
  sprite.alpha = 0.92;
  return sprite;
}


function animalTint(species) {
  if (species === "wolves") return 0x98a2b3;
  if (species === "bears") return 0x8b6a52;
  if (species === "dragons") return 0xd86a5f;
  if (species === "chickens") return 0xf5d56b;
  if (species === "cows") return 0xcaa28f;
  return 0xf5f2ea;
}


function countTerrain(world, terrain) {
  let count = 0;
  for (const row of world?.tiles ?? []) {
    for (const tile of row) {
      if (tile?.terrain === terrain) {
        count += 1;
      }
    }
  }
  return count;
}
