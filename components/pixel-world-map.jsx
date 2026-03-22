"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LocateFixed, Minus, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";


const TILE_SIZE = 12;
const MIN_ZOOM = 0.28;
const MAX_ZOOM = 4.5;


const BIOME_COLORS = {
  sea: "#21a3db",
  fjord: "#1d8dc5",
  coast: "#76e1b6",
  lagoon: "#8de6c5",
  shoreline: "#8bd7c0",
  river: "#1295d2",
  grassland: "#77df8e",
  meadow: "#93e794",
  "island-grass": "#80e39a",
  orchard: "#93e8a2",
  "high-pasture": "#8dd59a",
  vale: "#98d8a4",
  forest: "#2d9c5e",
  rainforest: "#259a67",
  pinewood: "#247d55",
  scrub: "#b9d083",
  dune: "#d8c98d",
  moor: "#7aa076",
  alpine: "#7f9aa6",
  peak: "#95a8b0",
  "volcanic-ridge": "#7c8a91"
};


const FACTION_COLORS = {
  red: "rgba(221, 111, 106, 0.16)",
  blue: "rgba(106, 168, 231, 0.16)",
  gold: "rgba(216, 191, 103, 0.16)"
};


export default function PixelWorldMap({
  world,
  overlays,
  selectedTile,
  onHoverTile,
  onSelectTile
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const dragRef = useRef(null);
  const lastWorldSignature = useRef("");
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [camera, setCamera] = useState({ zoom: 0.5, offsetX: 32, offsetY: 32 });
  const [hoveredTile, setHoveredTile] = useState(null);

  const worldSignature = useMemo(() => {
    if (!world) {
      return "empty";
    }
    return `${world.seed}:${world.width}x${world.height}:${world.tick ?? 0}:${world.props?.length ?? 0}`;
  }, [world]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setViewport({
        width: Math.floor(entry.contentRect.width),
        height: Math.floor(entry.contentRect.height)
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!world || !viewport.width || !viewport.height) {
      return;
    }
    if (worldSignature === lastWorldSignature.current) {
      return;
    }
    lastWorldSignature.current = worldSignature;
    const worldWidth = world.width * TILE_SIZE;
    const worldHeight = world.height * TILE_SIZE;
    const fitScale = Math.min(
      Math.max(MIN_ZOOM, (viewport.width - 64) / worldWidth),
      Math.max(MIN_ZOOM, (viewport.height - 64) / worldHeight)
    );
    setCamera({
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitScale)),
      offsetX: (viewport.width - (worldWidth * fitScale)) / 2,
      offsetY: (viewport.height - (worldHeight * fitScale)) / 2
    });
  }, [viewport.height, viewport.width, world, worldSignature]);

  useEffect(() => {
    if (!world) {
      offscreenRef.current = null;
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = world.width * TILE_SIZE;
    canvas.height = world.height * TILE_SIZE;
    const ctx = canvas.getContext("2d");
    drawWorldToCanvas(ctx, world, overlays);
    offscreenRef.current = canvas;
  }, [overlays, world, worldSignature]);

  useEffect(() => {
    drawViewport();
  }, [camera, hoveredTile, overlays, selectedTile, viewport.height, viewport.width, world, worldSignature]);

  function drawViewport() {
    const canvas = canvasRef.current;
    const stage = offscreenRef.current;
    if (!canvas || !stage || !world || !viewport.width || !viewport.height) {
      return;
    }
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#010101";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(
      stage,
      camera.offsetX,
      camera.offsetY,
      stage.width * camera.zoom,
      stage.height * camera.zoom
    );
    if (selectedTile) {
      drawTileFrame(ctx, selectedTile.x, selectedTile.y, camera, "rgba(255,255,255,0.96)", 2.5);
    }
    if (hoveredTile && (!selectedTile || selectedTile.x !== hoveredTile.x || selectedTile.y !== hoveredTile.y)) {
      drawTileFrame(ctx, hoveredTile.x, hoveredTile.y, camera, "rgba(214,214,214,0.92)", 1.5);
    }
  }

  function pointerToTile(event) {
    if (!world || !canvasRef.current) {
      return null;
    }
    const bounds = canvasRef.current.getBoundingClientRect();
    const mapX = (event.clientX - bounds.left - camera.offsetX) / camera.zoom;
    const mapY = (event.clientY - bounds.top - camera.offsetY) / camera.zoom;
    const tileX = Math.floor(mapX / TILE_SIZE);
    const tileY = Math.floor(mapY / TILE_SIZE);
    if (tileX < 0 || tileY < 0 || tileX >= world.width || tileY >= world.height) {
      return null;
    }
    return { x: tileX, y: tileY };
  }

  function handlePointerDown(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: camera.offsetX,
      offsetY: camera.offsetY,
      moved: false
    };
  }

  function handlePointerMove(event) {
    const tile = pointerToTile(event);
    setHoveredTile(tile);
    onHoverTile?.(tile);
    if (!dragRef.current) {
      return;
    }
    const deltaX = event.clientX - dragRef.current.pointerX;
    const deltaY = event.clientY - dragRef.current.pointerY;
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      dragRef.current.moved = true;
    }
    setCamera((current) => ({
      ...current,
      offsetX: dragRef.current.offsetX + deltaX,
      offsetY: dragRef.current.offsetY + deltaY
    }));
  }

  function handlePointerUp(event) {
    const tile = pointerToTile(event);
    if (dragRef.current && !dragRef.current.moved && tile) {
      onSelectTile?.(tile);
    }
    dragRef.current = null;
  }

  function handleWheel(event) {
    event.preventDefault();
    if (!world || !canvasRef.current) {
      return;
    }
    const bounds = canvasRef.current.getBoundingClientRect();
    const cursorX = event.clientX - bounds.left;
    const cursorY = event.clientY - bounds.top;
    const nextZoom = clamp(
      camera.zoom * (event.deltaY > 0 ? 0.88 : 1.12),
      MIN_ZOOM,
      MAX_ZOOM
    );
    const worldX = (cursorX - camera.offsetX) / camera.zoom;
    const worldY = (cursorY - camera.offsetY) / camera.zoom;
    setCamera({
      zoom: nextZoom,
      offsetX: cursorX - (worldX * nextZoom),
      offsetY: cursorY - (worldY * nextZoom)
    });
  }

  function nudgeZoom(direction) {
    if (!viewport.width || !viewport.height) {
      return;
    }
    const centerX = viewport.width / 2;
    const centerY = viewport.height / 2;
    const nextZoom = clamp(camera.zoom * direction, MIN_ZOOM, MAX_ZOOM);
    const worldX = (centerX - camera.offsetX) / camera.zoom;
    const worldY = (centerY - camera.offsetY) / camera.zoom;
    setCamera({
      zoom: nextZoom,
      offsetX: centerX - (worldX * nextZoom),
      offsetY: centerY - (worldY * nextZoom)
    });
  }

  function resetView() {
    if (!world || !viewport.width || !viewport.height) {
      return;
    }
    lastWorldSignature.current = "";
    setHoveredTile(null);
    onHoverTile?.(null);
    const worldWidth = world.width * TILE_SIZE;
    const worldHeight = world.height * TILE_SIZE;
    const fitScale = Math.min(
      Math.max(MIN_ZOOM, (viewport.width - 64) / worldWidth),
      Math.max(MIN_ZOOM, (viewport.height - 64) / worldHeight)
    );
    setCamera({
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitScale)),
      offsetX: (viewport.width - (worldWidth * fitScale)) / 2,
      offsetY: (viewport.height - (worldHeight * fitScale)) / 2
    });
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <Badge>{world?.seed ?? "..."}</Badge>
          <Badge variant="muted">{world ? `${world.width} x ${world.height}` : "No world"}</Badge>
          <Badge variant="muted">{Math.round(camera.zoom * 100)}% zoom</Badge>
          {hoveredTile ? <Badge variant="muted">{hoveredTile.x}, {hoveredTile.y}</Badge> : null}
        </div>
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-black/70 p-2 backdrop-blur-md">
          <Button size="icon" variant="ghost" onClick={() => nudgeZoom(1.15)}>
            <Plus className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => nudgeZoom(0.87)}>
            <Minus className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={resetView}>
            <LocateFixed className="size-4" />
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="relative min-h-[620px] w-full bg-black sm:min-h-[700px] xl:min-h-[820px]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_40%)]" />
        <canvas
          ref={canvasRef}
          className="pixel-perfect relative z-[1] block size-full touch-none bg-black"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => {
            dragRef.current = null;
            setHoveredTile(null);
            onHoverTile?.(null);
          }}
          onWheel={handleWheel}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-3 p-4">
        <div className="pointer-events-auto rounded-2xl border border-white/8 bg-black/68 px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-500 backdrop-blur-md">
          Drag to pan. Scroll or pinch to zoom.
        </div>
        <div className="pointer-events-auto rounded-2xl border border-white/8 bg-black/68 px-3 py-2 text-xs uppercase tracking-[0.18em] text-zinc-500 backdrop-blur-md">
          Pixel atlas
        </div>
      </div>
    </div>
  );
}


function drawWorldToCanvas(ctx, world, overlays) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  for (const row of world.tiles ?? []) {
    for (const tile of row) {
      drawTileBase(ctx, tile, overlays);
    }
  }

  if (overlays?.territories) {
    for (const row of world.tiles ?? []) {
      for (const tile of row) {
        if (!tile.owner_faction) {
          continue;
        }
        ctx.fillStyle = FACTION_COLORS[tile.owner_faction] ?? "rgba(255,255,255,0.1)";
        ctx.fillRect(tile.x * TILE_SIZE, tile.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  drawRoadNetwork(ctx, world);
  drawProps(ctx, world.props ?? []);
  drawSettlements(ctx, world.settlements ?? []);

  if (overlays?.agents) {
    drawAgents(ctx, Object.values(world.agents ?? {}));
  }
}


function drawTileBase(ctx, tile, overlays) {
  const px = tile.x * TILE_SIZE;
  const py = tile.y * TILE_SIZE;
  ctx.fillStyle = BIOME_COLORS[tile.biome] ?? (tile.terrain === "water" ? "#21a3db" : "#79df90");
  ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

  if (tile.terrain === "water") {
    drawWater(ctx, px, py, tile);
  }
  if (tile.feature === "mountain") {
    drawMountain(ctx, px, py);
  }
  if (tile.feature === "forest") {
    drawForestPatch(ctx, px, py, tile.moisture ?? 60);
  }
  if (tile.terrain === "bridge") {
    drawBridge(ctx, px, py);
  }
  if (tile.terrain === "house") {
    drawHouse(ctx, px, py);
  }
  if (tile.terrain === "farm") {
    drawField(ctx, px, py);
  }
  if (overlays?.resources && tile.resource) {
    drawResourceMarker(ctx, px, py, tile.resource);
  }
}


function drawWater(ctx, px, py, tile) {
  ctx.fillStyle = tile.feature === "river" ? "#0f77b9" : "#1ab5ea";
  ctx.fillRect(px, py + 2, TILE_SIZE, TILE_SIZE - 4);
  ctx.fillStyle = "rgba(232,250,255,0.45)";
  ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, 1);
}


function drawMountain(ctx, px, py) {
  ctx.fillStyle = "#587581";
  ctx.fillRect(px + 2, py + 6, 8, 4);
  ctx.fillStyle = "#d4e2e7";
  ctx.fillRect(px + 4, py + 3, 4, 3);
  ctx.fillStyle = "#3f5b67";
  ctx.fillRect(px + 5, py + 5, 2, 4);
}


function drawForestPatch(ctx, px, py, moisture) {
  ctx.fillStyle = moisture > 78 ? "#0f5b38" : "#146945";
  ctx.fillRect(px + 2, py + 5, 3, 4);
  ctx.fillRect(px + 6, py + 3, 4, 5);
  ctx.fillStyle = "#2ae083";
  ctx.fillRect(px + 2, py + 3, 3, 2);
  ctx.fillRect(px + 6, py + 1, 3, 2);
}


function drawBridge(ctx, px, py) {
  ctx.fillStyle = "#9c6542";
  ctx.fillRect(px, py + 4, TILE_SIZE, 4);
  ctx.fillStyle = "#c99262";
  ctx.fillRect(px + 1, py + 5, TILE_SIZE - 2, 1);
  ctx.fillRect(px + 1, py + 7, TILE_SIZE - 2, 1);
}


function drawHouse(ctx, px, py) {
  ctx.fillStyle = "#efc7a3";
  ctx.fillRect(px + 3, py + 5, 6, 5);
  ctx.fillStyle = "#8c5b43";
  ctx.fillRect(px + 2, py + 3, 8, 2);
}


function drawField(ctx, px, py) {
  ctx.fillStyle = "#cbe16b";
  ctx.fillRect(px + 1, py + 1, 10, 10);
  ctx.fillStyle = "#90b24f";
  ctx.fillRect(px + 2, py + 3, 8, 1);
  ctx.fillRect(px + 2, py + 6, 8, 1);
  ctx.fillRect(px + 2, py + 9, 8, 1);
}


function drawResourceMarker(ctx, px, py, resource) {
  const colors = {
    wood: "#643e2d",
    stone: "#dfe7ed",
    food: "#f7d95a"
  };
  ctx.fillStyle = colors[resource] ?? "#f1f5f9";
  ctx.fillRect(px + 8, py + 8, 3, 3);
}


function drawRoadNetwork(ctx, world) {
  for (const road of world.roads ?? []) {
    const points = road.points ?? [];
    if (points.length < 2) {
      continue;
    }
    ctx.beginPath();
    ctx.strokeStyle = "#141414";
    ctx.lineWidth = 2;
    const first = points[0];
    ctx.moveTo((first.x * TILE_SIZE) + TILE_SIZE / 2, (first.y * TILE_SIZE) + TILE_SIZE / 2);
    for (const point of points.slice(1)) {
      ctx.lineTo((point.x * TILE_SIZE) + TILE_SIZE / 2, (point.y * TILE_SIZE) + TILE_SIZE / 2);
    }
    ctx.stroke();
    ctx.beginPath();
    ctx.strokeStyle = "#7d715a";
    ctx.lineWidth = 1;
    ctx.moveTo((first.x * TILE_SIZE) + TILE_SIZE / 2, (first.y * TILE_SIZE) + TILE_SIZE / 2);
    for (const point of points.slice(1)) {
      ctx.lineTo((point.x * TILE_SIZE) + TILE_SIZE / 2, (point.y * TILE_SIZE) + TILE_SIZE / 2);
    }
    ctx.stroke();
  }
}


function drawProps(ctx, props) {
  for (const prop of props) {
    if (prop.kind === "tree-cluster") {
      drawTreeCluster(ctx, prop.x * TILE_SIZE, prop.y * TILE_SIZE, prop.variant ?? 0, prop.density ?? 1);
    } else if (prop.kind === "mountain") {
      drawMountain(ctx, prop.x * TILE_SIZE, prop.y * TILE_SIZE);
    } else if (prop.kind === "grove") {
      drawTreeCluster(ctx, prop.x * TILE_SIZE, prop.y * TILE_SIZE, prop.variant ?? 0, 1);
    } else if (prop.kind === "reed-bank") {
      ctx.fillStyle = "#f2e994";
      ctx.fillRect((prop.x * TILE_SIZE) + 8, (prop.y * TILE_SIZE) + 6, 2, 4);
      ctx.fillRect((prop.x * TILE_SIZE) + 10, (prop.y * TILE_SIZE) + 5, 1, 4);
    } else if (prop.kind === "ship") {
      drawShip(ctx, prop.x * TILE_SIZE, prop.y * TILE_SIZE);
    } else if (prop.kind === "lighthouse") {
      drawLighthouse(ctx, prop.x * TILE_SIZE, prop.y * TILE_SIZE);
    } else if (prop.kind === "observatory") {
      drawObservatory(ctx, prop.x * TILE_SIZE, prop.y * TILE_SIZE);
    } else if (prop.kind === "palace" || prop.kind === "market" || prop.kind === "shrine") {
      drawLandmark(ctx, prop.x * TILE_SIZE, prop.y * TILE_SIZE, prop.kind);
    }
  }
}


function drawTreeCluster(ctx, px, py, variant, density) {
  const offsets = [
    [2, 5],
    [6, 4],
    [4, 2]
  ];
  ctx.fillStyle = "#0c5d39";
  for (let index = 0; index < density; index += 1) {
    const [ox, oy] = offsets[(index + variant) % offsets.length];
    ctx.fillRect(px + ox, py + oy, 3, 3);
    ctx.fillStyle = "#1de18b";
    ctx.fillRect(px + ox, py + oy - 1, 2, 1);
    ctx.fillStyle = "#0c5d39";
  }
}


function drawShip(ctx, px, py) {
  ctx.fillStyle = "#f6f7fb";
  ctx.fillRect(px + 2, py + 7, 8, 2);
  ctx.fillStyle = "#ef8666";
  ctx.fillRect(px + 4, py + 5, 1, 2);
  ctx.fillStyle = "#163d53";
  ctx.fillRect(px + 6, py + 4, 1, 3);
}


function drawLighthouse(ctx, px, py) {
  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(px + 5, py + 2, 2, 8);
  ctx.fillStyle = "#ffd36a";
  ctx.fillRect(px + 4, py + 2, 4, 2);
}


function drawObservatory(ctx, px, py) {
  ctx.fillStyle = "#dae5ef";
  ctx.fillRect(px + 3, py + 6, 6, 3);
  ctx.fillStyle = "#6b8ca3";
  ctx.fillRect(px + 4, py + 3, 4, 3);
}


function drawLandmark(ctx, px, py, kind) {
  ctx.fillStyle = kind === "palace" ? "#e8d9a0" : kind === "market" ? "#f4b07b" : "#ddd9ff";
  ctx.fillRect(px + 3, py + 5, 6, 4);
  ctx.fillStyle = "#402f2d";
  ctx.fillRect(px + 4, py + 3, 4, 2);
}


function drawSettlements(ctx, settlements) {
  for (const settlement of settlements) {
    const px = settlement.x * TILE_SIZE;
    const py = settlement.y * TILE_SIZE;
    ctx.fillStyle = settlement.kind === "capital" ? "#f2edd8" : settlement.kind === "port" ? "#f0ba8f" : "#f2d7b8";
    ctx.fillRect(px + 2, py + 5, 8, 5);
    ctx.fillStyle = settlement.kind === "capital" ? "#7f8fd2" : "#805a48";
    ctx.fillRect(px + 3, py + 3, 6, 2);
  }
}


function drawAgents(ctx, agents) {
  for (const agent of agents) {
    if (agent.alive === false) {
      continue;
    }
    const px = (agent.x * TILE_SIZE) + 4;
    const py = (agent.y * TILE_SIZE) + 2;
    ctx.fillStyle = agent.faction_id === "red" ? "#ff7a72" : agent.faction_id === "blue" ? "#7fb8ff" : "#f5d979";
    ctx.fillRect(px, py, 4, 4);
    ctx.fillStyle = "#071219";
    ctx.fillRect(px + 1, py + 1, 2, 2);
  }
}


function drawTileFrame(ctx, x, y, camera, color, width) {
  const px = (x * TILE_SIZE * camera.zoom) + camera.offsetX;
  const py = (y * TILE_SIZE * camera.zoom) + camera.offsetY;
  const size = TILE_SIZE * camera.zoom;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
}


function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
