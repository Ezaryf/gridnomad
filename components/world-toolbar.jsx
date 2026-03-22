import { Copy, PanelsTopLeft, Play, RefreshCcw, Settings2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";


export default function WorldToolbar({
  worldSettings,
  ticks,
  presetOptions,
  sizeOptions,
  statusMessage,
  overlays,
  busy,
  onSeedChange,
  onPresetChange,
  onSizeChange,
  onTicksChange,
  onToggleOverlay,
  onRandomizeSeed,
  onCopySeed,
  onGenerateWorld,
  onRunSimulation,
  onOpenWorldSettings,
  onOpenCivilizations
}) {
  return (
    <Card className="overflow-hidden bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))]">
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="solid">GridNomad</Badge>
              <Badge>OLED Atlas</Badge>
              <Badge variant="muted">Map-first</Badge>
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-zinc-50 sm:text-4xl">
                Clean black atlas for seeded civilizations.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-zinc-400 sm:text-[15px]">
                Generate the world in Python, inspect it in a premium browser shell, and keep AI providers routed per civilization without the old dashboard clutter.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={onOpenWorldSettings}>
              <Settings2 className="size-4" />
              World settings
            </Button>
            <Button variant="secondary" onClick={onOpenCivilizations}>
              <PanelsTopLeft className="size-4" />
              Civilizations
            </Button>
            <Button variant="secondary" onClick={onGenerateWorld} disabled={busy}>
              <Sparkles className="size-4" />
              {busy ? "Working..." : "Generate"}
            </Button>
            <Button variant="default" onClick={onRunSimulation} disabled={busy}>
              <Play className="size-4" />
              Run simulation
            </Button>
          </div>
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="grid gap-3 rounded-2xl border border-white/8 bg-black/60 p-3 md:grid-cols-[150px_180px_160px_130px_auto] md:items-center">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Seed</p>
              <Input
                type="number"
                value={worldSettings.seed ?? ""}
                onChange={(event) => onSeedChange(Number(event.target.value))}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Preset</p>
              <Select value={worldSettings.generatorPreset ?? "grand-continent"} onValueChange={onPresetChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose preset" />
                </SelectTrigger>
                <SelectContent>
                  {presetOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Map size</p>
              <Select value={String(worldSettings.width ?? 128)} onValueChange={(value) => onSizeChange(Number(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose size" />
                </SelectTrigger>
                <SelectContent>
                  {sizeOptions.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">Ticks</p>
              <Input type="number" min="1" max="500" value={ticks} onChange={(event) => onTicksChange(Number(event.target.value))} />
            </div>
            <div className="flex flex-wrap items-center gap-2 self-end md:self-center">
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

          <div className="grid gap-3 rounded-2xl border border-white/8 bg-black/60 p-3">
            <div className="flex flex-wrap gap-2">
              {Object.entries(overlays).map(([key, value]) => (
                <Button
                  key={key}
                  variant={value ? "default" : "secondary"}
                  size="sm"
                  onClick={() => onToggleOverlay(key)}
                >
                  {key.replace(/^\w/, (char) => char.toUpperCase())}
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
