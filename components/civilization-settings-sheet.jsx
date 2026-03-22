"use client";

import { KeyRound, MountainSnow, Network, Sparkles, UserRoundCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const PROVIDER_OPTIONS = [
  { value: "heuristic", label: "Heuristic" },
  { value: "gemini-cli", label: "Gemini CLI" },
  { value: "opencode", label: "OpenCode CLI" }
];


const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-2.0-flash-exp"];


const AUTH_OPTIONS = [
  { value: "existing-cli-auth", label: "Existing CLI login" },
  { value: "gemini-api-key", label: "Gemini API key" },
  { value: "vertex-ai", label: "Vertex AI" }
];


export default function CivilizationSettingsSheet({
  open,
  onOpenChange,
  activeTab,
  onTabChange,
  scenario,
  settings,
  opencodeModels,
  opencodeCredentials,
  busy,
  onUpdateWorld,
  onUpdateFaction,
  onSaveSettings,
  onGenerateWorld,
  onRefreshOpencodeStatus,
  onRefreshOpencodeModels,
  onLaunchProviderLogin
}) {
  const factions = scenario?.factions ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0">
        <SheetHeader className="border-b border-white/8 px-6 py-5">
          <SheetTitle>Atlas controls</SheetTitle>
          <SheetDescription>
            Tune world generation and configure each civilization without crowding the main map view.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={onTabChange} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-white/8 px-6 py-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="world">
                <MountainSnow className="mr-2 size-4" />
                World
              </TabsTrigger>
              <TabsTrigger value="civilizations">
                <UserRoundCog className="mr-2 size-4" />
                Civilizations
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <TabsContent value="world" className="m-0 px-6 py-5">
              <div className="space-y-5">
                <Card className="bg-white/[0.025]">
                  <CardHeader>
                    <CardTitle>World generator</CardTitle>
                    <CardDescription>Primary seed and scale controls for the canonical Python world.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <LabeledField label="Seed">
                      <Input
                        type="number"
                        value={settings.world?.seed ?? ""}
                        onChange={(event) => onUpdateWorld({ seed: Number(event.target.value) })}
                      />
                    </LabeledField>
                    <LabeledField label="Preset">
                      <Select
                        value={settings.world?.generatorPreset ?? "grand-continent"}
                        onValueChange={(value) => onUpdateWorld({ generatorPreset: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grand-continent">Grand Continent</SelectItem>
                          <SelectItem value="archipelago">Archipelago</SelectItem>
                          <SelectItem value="highland-realms">Highland Realms</SelectItem>
                        </SelectContent>
                      </Select>
                    </LabeledField>
                    <LabeledField label="Width">
                      <Input
                        type="number"
                        min="24"
                        max="256"
                        value={settings.world?.width ?? 128}
                        onChange={(event) => onUpdateWorld({ width: Number(event.target.value) })}
                      />
                    </LabeledField>
                    <LabeledField label="Height">
                      <Input
                        type="number"
                        min="24"
                        max="256"
                        value={settings.world?.height ?? 128}
                        onChange={(event) => onUpdateWorld({ height: Number(event.target.value) })}
                      />
                    </LabeledField>
                  </CardContent>
                </Card>

                <Card className="bg-white/[0.025]">
                  <CardHeader>
                    <CardTitle>World tuning</CardTitle>
                    <CardDescription>Fine control for coastlines, rivers, settlements, and landmark density.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <LabeledField label="Coastline bias">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={settings.world?.coastlineBias ?? 58}
                        onChange={(event) => onUpdateWorld({ coastlineBias: Number(event.target.value) })}
                      />
                    </LabeledField>
                    <LabeledField label="River count">
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        value={settings.world?.riverCount ?? 8}
                        onChange={(event) => onUpdateWorld({ riverCount: Number(event.target.value) })}
                      />
                    </LabeledField>
                    <LabeledField label="Settlement density">
                      <Input
                        type="number"
                        min="1"
                        max="40"
                        value={settings.world?.settlementDensity ?? 18}
                        onChange={(event) => onUpdateWorld({ settlementDensity: Number(event.target.value) })}
                      />
                    </LabeledField>
                    <LabeledField label="Landmark density">
                      <Input
                        type="number"
                        min="0"
                        max="40"
                        value={settings.world?.landmarkDensity ?? 16}
                        onChange={(event) => onUpdateWorld({ landmarkDensity: Number(event.target.value) })}
                      />
                    </LabeledField>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="civilizations" className="m-0 px-6 py-5">
              <div className="space-y-5">
                <Card className="bg-white/[0.025]">
                  <CardHeader className="pb-4">
                    <CardTitle>Provider status</CardTitle>
                    <CardDescription>
                      OpenCode credentials: {opencodeCredentials.length ? opencodeCredentials.join(", ") : "none detected"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={onRefreshOpencodeStatus}>
                      <Network className="size-4" />
                      Refresh OpenCode status
                    </Button>
                    <Button variant="secondary" onClick={() => onLaunchProviderLogin("gemini-cli")}>
                      <KeyRound className="size-4" />
                      Launch Gemini login
                    </Button>
                  </CardContent>
                </Card>

                {factions.map((faction) => {
                  const config = settings.factions?.[faction.id] ?? {};
                  const models = opencodeModels[faction.id] ?? [];
                  return (
                    <Card key={faction.id} className="bg-white/[0.025]">
                      <CardHeader className="pb-4">
                        <div className="flex items-start gap-3">
                          <div
                            className="mt-1 size-10 rounded-2xl border border-white/12"
                            style={{ background: faction.color ?? faction.banner_color ?? "#2b2b2b" }}
                          />
                          <div>
                            <CardTitle>{faction.name}</CardTitle>
                            <CardDescription>{faction.culture?.[0]?.description ?? "No seeded culture description yet."}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <LabeledField label="Provider">
                          <Select
                            value={config.provider ?? "heuristic"}
                            onValueChange={(value) => onUpdateFaction(faction.id, { provider: value })}
                          >
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
                        </LabeledField>

                        {config.provider === "gemini-cli" ? (
                          <div className="grid gap-4">
                            <LabeledField label="Auth mode">
                              <Select
                                value={config.authMode ?? "existing-cli-auth"}
                                onValueChange={(value) => onUpdateFaction(faction.id, { authMode: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {AUTH_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </LabeledField>
                            <LabeledField label="Model">
                              <Input
                                value={config.model ?? ""}
                                onChange={(event) => onUpdateFaction(faction.id, { model: event.target.value })}
                                placeholder={GEMINI_MODELS[0]}
                              />
                            </LabeledField>
                            <LabeledField label="Gemini API key">
                              <Input
                                type="password"
                                value={config.apiKey ?? ""}
                                onChange={(event) => onUpdateFaction(faction.id, { apiKey: event.target.value })}
                                placeholder="Optional if CLI login already exists"
                              />
                            </LabeledField>
                            <LabeledField label="Google Cloud project">
                              <Input
                                value={config.googleCloudProject ?? ""}
                                onChange={(event) => onUpdateFaction(faction.id, { googleCloudProject: event.target.value })}
                                placeholder="Needed for some org or Vertex setups"
                              />
                            </LabeledField>
                          </div>
                        ) : null}

                        {config.provider === "opencode" ? (
                          <div className="grid gap-4">
                            <div className="flex flex-wrap gap-2">
                              <Button variant="secondary" onClick={() => onLaunchProviderLogin("opencode")}>
                                <KeyRound className="size-4" />
                                OpenCode login
                              </Button>
                              <Button variant="secondary" onClick={() => onRefreshOpencodeModels(faction.id)}>
                                <Sparkles className="size-4" />
                                List models
                              </Button>
                            </div>
                            <LabeledField label="Provider filter">
                              <Input
                                value={config.opencodeProvider ?? ""}
                                onChange={(event) => onUpdateFaction(faction.id, { opencodeProvider: event.target.value })}
                                placeholder="Optional provider id"
                              />
                            </LabeledField>
                            <LabeledField label="OpenCode model">
                              <Input
                                value={config.model ?? ""}
                                onChange={(event) => onUpdateFaction(faction.id, { model: event.target.value })}
                                placeholder={models[0] ?? "Run “List models” to load options"}
                              />
                            </LabeledField>
                            <LabeledField label="CLI home override">
                              <Input
                                value={config.cliHome ?? ""}
                                onChange={(event) => onUpdateFaction(faction.id, { cliHome: event.target.value })}
                                placeholder="Optional isolated OpenCode runtime path"
                              />
                            </LabeledField>
                          </div>
                        ) : null}

                        {config.provider === "heuristic" ? (
                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-400">
                            This civilization uses the deterministic local adapter for fast offline-safe baseline runs.
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <Separator />

        <SheetFooter className="px-6 py-5">
          <Button variant="secondary" onClick={onSaveSettings} disabled={busy}>
            Save settings
          </Button>
          <Button variant="default" onClick={onGenerateWorld} disabled={busy}>
            Generate world
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}


function LabeledField({ label, children }) {
  return (
    <label className="grid gap-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
