"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Minus, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  agentPresentation,
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
  TILE_SIZE
} from "@/lib/world-atlas";


export default function PixelWorldMap({
  world,
  overlays,
  selectedTile,
  onHoverTile,
  onSelectTile
}) {
  const stageRef = useRef(null);
  const runtimeRef = useRef(null);
  const worldRef = useRef(world);
  const hoverTileRef = useRef(null);
  const selectedTileRef = useRef(selectedTile);
  const onHoverRef = useRef(onHoverTile);
  const onSelectRef = useRef(onSelectTile);
  const [zoomPercent, setZoomPercent] = useState(0);
  const [hoveredTile, setHoveredTile] = useState(null);

  const worldSignature = useMemo(() => {
    if (!world) {
      return "empty";
    }
    return `${world.seed}:${world.width}x${world.height}:${world.tick ?? 0}:${world.props?.length ?? 0}:${world.settlements?.length ?? 0}`;
  }, [world]);

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
        Container,
        SCALE_MODES,
        Sprite,
        TextureStyle
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

      const terrainLayer = new Container();
      const territoryLayer = new Container();
      const fluidLayer = new Container();
      const roadLayer = new Container();
      const detailLayer = new Container();
      const propLayer = new Container();
      const settlementLayer = new Container();
      const agentLayer = new Container();
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
          fxLayer,
          uiLayer
        },
        hoverRing,
        selectRing,
        agentPositions: new Map(),
        agentTweens: [],
        animatedGlints: [],
        fogSprites: [],
        lastHudZoom: -1,
        lastFittedSignature: "",
        worldSignature: ""
      };
      runtimeRef.current = runtime;

      addFog(runtime);

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
        const tile = pointerToTile(runtimeRef.current, event);
        if (!tile) {
          return;
        }
        onSelectRef.current?.(tile);
      };

      app.canvas.addEventListener("pointermove", handlePointerMove);
      app.canvas.addEventListener("pointerleave", handlePointerLeave);
      app.canvas.addEventListener("pointerup", handlePointerUp);

      app.ticker.add((ticker) => animateRuntime(runtime, ticker.deltaMS, setZoomPercent));

      cleanup = () => {
        resizeObserver.disconnect();
        app.canvas.removeEventListener("pointermove", handlePointerMove);
        app.canvas.removeEventListener("pointerleave", handlePointerLeave);
        app.canvas.removeEventListener("pointerup", handlePointerUp);
        runtimeRef.current = null;
        app.destroy(true);
      };

      renderWorld(runtime, worldRef.current, overlays, worldSignature);
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
    renderWorld(runtimeRef.current, world, overlays, worldSignature);
    syncFocusSprites(runtimeRef.current, selectedTile, hoverTileRef.current);
  }, [world, overlays, worldSignature]);

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
    <div className="relative overflow-hidden rounded-[2rem] border border-white/8 bg-black">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <Badge>{world?.seed ?? "..."}</Badge>
          <Badge variant="muted">{world ? `${world.width} x ${world.height}` : "No world"}</Badge>
          <Badge variant="muted">{zoomPercent}% zoom</Badge>
          {hoveredTile ? <Badge variant="muted">{hoveredTile.x}, {hoveredTile.y}</Badge> : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-black/70 p-2 backdrop-blur-md">
          <Button size="icon" variant="ghost" onClick={() => nudgeZoom(1.15)}>
            <Plus className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => nudgeZoom(0.87)}>
            <Minus className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={fitView}>
            <LocateFixed className="size-4" />
          </Button>
        </div>
      </div>

      <div ref={stageRef} className="relative min-h-[660px] w-full bg-black sm:min-h-[760px] xl:min-h-[860px]">
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


function renderWorld(runtime, world, overlays, worldSignature) {
  if (!runtime || !world) {
    return;
  }
  runtime.world = world;
  runtime.worldSignature = worldSignature;
  runtime.agentTweens = [];
  runtime.animatedGlints = [];

  const {
    Sprite
  } = runtime.pixi;
  const {
    terrainLayer,
    territoryLayer,
    fluidLayer,
    roadLayer,
    detailLayer,
    propLayer,
    settlementLayer,
    agentLayer
  } = runtime.layers;

  clearLayer(terrainLayer);
  clearLayer(territoryLayer);
  clearLayer(fluidLayer);
  clearLayer(roadLayer);
  clearLayer(detailLayer);
  clearLayer(propLayer);
  clearLayer(settlementLayer);
  clearLayer(agentLayer);

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

      const base = Sprite.from(terrainPresentation(tile).asset);
      const baseStyle = terrainPresentation(tile);
      base.x = px;
      base.y = py;
      base.tint = baseStyle.tint;
      terrainLayer.addChild(base);

      if (overlays?.territories && tile.owner_faction) {
        const territory = Sprite.from(resolveAtlasAsset("overlay-tint"));
        territory.x = px;
        territory.y = py;
        territory.tint = factionTint(tile.owner_faction);
        territory.alpha = tile.settlement_id ? 0.11 : 0.085;
        territoryLayer.addChild(territory);
      }

      if (tile.terrain === "water" && tile.edge_mask) {
        for (const overlay of coastOverlays(tile.edge_mask)) {
          const foam = Sprite.from(overlay.asset);
          foam.x = px + (TILE_SIZE / 2);
          foam.y = py + (TILE_SIZE / 2);
          foam.anchor.set(0.5);
          foam.rotation = overlay.rotation;
          foam.tint = 0xffffff;
          foam.alpha = 0.82;
          fluidLayer.addChild(foam);
        }
      }

      if (tile.river_mask) {
        const river = riverPresentation(tile.river_mask);
        const sprite = Sprite.from(river.asset);
        sprite.x = px + (TILE_SIZE / 2);
        sprite.y = py + (TILE_SIZE / 2);
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
        sprite.y = py + (TILE_SIZE / 2);
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
        sprite.y = py;
        sprite.tint = decal.tint;
        sprite.alpha = tile.decal === "water-glint" ? 0.72 : 0.5;
        detailLayer.addChild(sprite);
        if (tile.decal === "water-glint") {
          runtime.animatedGlints.push({
            sprite,
            baseAlpha: 0.52,
            phase: ((tile.x * 13) + (tile.y * 17)) * 0.07
          });
        }
      }

      if (tile.feature === "forest" && tile.visual_variant === 0) {
        const forestSprite = Sprite.from(resolveAtlasAsset("prop-tree-cluster"));
        forestSprite.x = px;
        forestSprite.y = py;
        forestSprite.alpha = 0.85;
        propLayer.addChild(forestSprite);
      }

      if (tile.feature === "mountain" && tile.visual_variant >= 2) {
        const mountainSprite = Sprite.from(resolveAtlasAsset("prop-mountain-cluster"));
        mountainSprite.x = px;
        mountainSprite.y = py;
        mountainSprite.alpha = 0.92;
        propLayer.addChild(mountainSprite);
      }

      if (overlays?.resources && tile.resource) {
        const resource = resourcePresentation(tile.resource);
        const sprite = Sprite.from(resource.asset);
        sprite.x = px + 10;
        sprite.y = py + 10;
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
    const presentation = propPresentation(prop);
    const sprite = Sprite.from(presentation.asset);
    sprite.x = prop.x * TILE_SIZE;
    sprite.y = prop.y * TILE_SIZE;
    sprite.tint = presentation.tint;
    sprite.alpha = prop.kind === "ship" ? 0.95 : 0.92;
    propLayer.addChild(sprite);
  }

  for (const settlement of world.settlements ?? []) {
    for (const segment of settlementSegments(settlement)) {
      const presentation = settlementPresentation(segment);
      const sprite = Sprite.from(presentation.asset);
      sprite.x = segment.x * TILE_SIZE;
      sprite.y = segment.y * TILE_SIZE;
      sprite.tint = presentation.tint;
      sprite.alpha = segment.is_core ? 1 : 0.92;
      settlementLayer.addChild(sprite);
    }
  }

  if (overlays?.agents) {
    const nextAgentPositions = new Map();
    for (const agent of Object.values(world.agents ?? {})) {
      if (agent.alive === false) {
        continue;
      }
      const presentation = agentPresentation(agent);
      const sprite = Sprite.from(presentation.asset);
      sprite.tint = presentation.tint;
      sprite.anchor.set(0.5);
      const targetX = (agent.x * TILE_SIZE) + (TILE_SIZE / 2);
      const targetY = (agent.y * TILE_SIZE) + (TILE_SIZE / 2) - 2;
      const previous = runtime.agentPositions.get(agent.id) ?? { x: targetX, y: targetY };
      sprite.x = previous.x;
      sprite.y = previous.y;
      sprite.scale.set(0.95);
      agentLayer.addChild(sprite);
      runtime.agentTweens.push({
        sprite,
        startX: previous.x,
        startY: previous.y,
        targetX,
        targetY,
        elapsed: 0,
        duration: 680,
        bobPhase: (agent.x * 19) + (agent.y * 7)
      });
      nextAgentPositions.set(agent.id, { x: targetX, y: targetY });
    }
    runtime.agentPositions = nextAgentPositions;
  } else {
    runtime.agentPositions = new Map();
  }

  maybeFitWorld(runtime, world, false);
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
    tween.sprite.y = tween.startY + ((tween.targetY - tween.startY) * eased) + (Math.sin((performance.now() * 0.004) + tween.bobPhase) * 0.45);
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
