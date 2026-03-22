"use client";

import {
  KeyRound,
  MessagesSquare,
  MountainSnow,
  Orbit,
  Plus,
  Sparkles,
  Trash2,
  UserRoundCog
} from "lucide-react";

import {
  ANTHROPIC_MODELS,
  DIRECT_API_PROVIDERS,
  GEMINI_API_MODELS,
  GEMINI_MODELS,
  OPENAI_MODELS,
  PROVIDER_OPTIONS,
  providerDisplayName,
  providerSupportsBaseUrl
} from "@/lib/civilization-setup";
import { Badge } from "@/components/ui/badge";
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
  settings,
  providerCatalogs,
  opencodeCredentials,
  territoryLookup,
  busy,
  onUpdateWorld,
  onAddGroup,
  onDeleteGroup,
  onUpdateGroup,
  onUpdateController,
  onUpdatePopulation,
  onUpdateHuman,
  onSaveSettings,
  onGenerateWorld,
  onRefreshOpencodeStatus,
  onRefreshProviderCatalog,
  onProviderChange,
  onProviderCredentialChange,
  onLaunchProviderLogin
}) {
  const groups = settings.groups ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full p-0 sm:max-w-[820px]">
        <SheetHeader className="border-b border-white/8 px-6 py-5">
          <SheetTitle>Project setup</SheetTitle>
          <SheetDescription>
            Create removable community groups, set how many humans each one spawns, and assign the controller that powers all human activity in that group.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={onTabChange} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-white/8 px-6 py-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="world">
                <MountainSnow className="mr-2 size-4" />
                World
              </TabsTrigger>
              <TabsTrigger value="groups">
                <Orbit className="mr-2 size-4" />
                Groups
              </TabsTrigger>
              <TabsTrigger value="controllers">
                <UserRoundCog className="mr-2 size-4" />
                Controllers
              </TabsTrigger>
              <TabsTrigger value="humans">
                <MessagesSquare className="mr-2 size-4" />
                Humans
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <TabsContent value="world" className="m-0 px-6 py-5">
              <div className="space-y-5">
                <Card className="bg-white/[0.025]">
                  <CardHeader>
                    <CardTitle>World generator</CardTitle>
                    <CardDescription>
                      Seed the canonical Python world and tune the geography before humans spawn onto the map.
                    </CardDescription>
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

                <Card className="bg-white/[0.025]">
                  <CardHeader>
                    <CardTitle>Fine tuning</CardTitle>
                    <CardDescription>Adjust terrain structure before group territories and human spawns are resolved.</CardDescription>
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
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="groups" className="m-0 px-6 py-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">Community groups</h3>
                  <p className="text-sm text-zinc-400">Add and delete the groups that will occupy the world.</p>
                </div>
                <Button variant="secondary" onClick={onAddGroup} disabled={groups.length >= 12}>
                  <Plus className="size-4" />
                  Add group
                </Button>
              </div>
              <div className="space-y-5">
                {groups.map((group, index) => {
                  const culture = group.culture?.[0] ?? {};
                  const territory = territoryLookup?.[group.id];
                  return (
                    <Card key={group.id} className="bg-white/[0.025]">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="size-11 rounded-2xl border border-white/12" style={{ background: group.color }} />
                            <div className="space-y-2">
                              <CardTitle>{group.name}</CardTitle>
                              <CardDescription>
                                Group {index + 1} with {group.population_count} humans.
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="muted">{territory ? `${territory.tile_count} tiles` : "Awaiting world"}</Badge>
                            <Badge variant="muted">{group.controller?.provider ?? "heuristic"}</Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDeleteGroup(group.id)}
                              disabled={groups.length <= 1}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-2">
                        <LabeledField label="Group name">
                          <Input
                            value={group.name}
                            onChange={(event) => onUpdateGroup(group.id, { name: event.target.value })}
                          />
                        </LabeledField>
                        <LabeledField label="Banner color">
                          <div className="flex items-center gap-3">
                            <Input
                              type="color"
                              value={group.color}
                              onChange={(event) => onUpdateGroup(group.id, { color: event.target.value })}
                              className="h-11 w-16 min-w-16 p-1"
                            />
                            <Input
                              value={group.color}
                              onChange={(event) => onUpdateGroup(group.id, { color: event.target.value })}
                            />
                          </div>
                        </LabeledField>
                        <LabeledField label="Culture seed">
                          <Input
                            value={culture.element ?? ""}
                            onChange={(event) => onUpdateGroup(group.id, {
                              culture: [{ ...culture, element: event.target.value }]
                            })}
                          />
                        </LabeledField>
                        <LabeledField label="Culture summary">
                          <Input
                            value={culture.description ?? ""}
                            onChange={(event) => onUpdateGroup(group.id, {
                              culture: [{ ...culture, description: event.target.value }]
                            })}
                          />
                        </LabeledField>
                        <LabeledField label="Population count">
                          <Input
                            type="number"
                            min="1"
                            max="48"
                            value={group.population_count}
                            onChange={(event) => onUpdatePopulation(group.id, Number(event.target.value))}
                          />
                        </LabeledField>
                        <LabeledField label="Culture strength">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            value={culture.strength ?? 70}
                            onChange={(event) => onUpdateGroup(group.id, {
                              culture: [{ ...culture, strength: Number(event.target.value) }]
                            })}
                          />
                        </LabeledField>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="controllers" className="m-0 px-6 py-5">
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
                      <Sparkles className="size-4" />
                      Refresh OpenCode status
                    </Button>
                    <Button variant="secondary" onClick={() => onLaunchProviderLogin("gemini-cli")}>
                      <KeyRound className="size-4" />
                      Launch Gemini login
                    </Button>
                    <Button variant="secondary" onClick={() => onLaunchProviderLogin("opencode")}>
                      <KeyRound className="size-4" />
                      Launch OpenCode login
                    </Button>
                  </CardContent>
                </Card>

                {groups.map((group) => {
                  const controller = group.controller ?? {};
                  const catalog = providerCatalogs[group.id] ?? {};
                  const fallbackModels = resolveFallbackModels(controller.provider);
                  const listedModels = resolveModelOptions(
                    catalog.models?.length
                      ? catalog.models
                      : controller.availableModels?.length
                        ? controller.availableModels
                        : fallbackModels,
                    controller.model
                  );
                  const authStatus = resolveAuthStatus(controller, catalog);
                  return (
                    <Card key={group.id} className="bg-white/[0.025]">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle>{group.name}</CardTitle>
                            <CardDescription>
                              One controller profile powers all {group.population_count} humans in this group.
                            </CardDescription>
                          </div>
                          <Badge variant="muted">{authStatus}</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <LabeledField label="Provider">
                          <Select
                            value={controller.provider ?? "heuristic"}
                            onValueChange={(value) => onProviderChange(group.id, value)}
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

                        {controller.provider === "gemini-cli" ? (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <LabeledField label="Auth mode">
                              <Select
                                value={controller.authMode ?? "existing-cli-auth"}
                                onValueChange={(value) => onUpdateController(group.id, { authMode: value })}
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
                            <LabeledField label="Model dropdown">
                              <Select
                                value={controller.model || listedModels[0] || GEMINI_MODELS[0]}
                                onValueChange={(value) => onUpdateController(group.id, { model: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {listedModels.map((model) => (
                                    <SelectItem key={model} value={model}>
                                      {model}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </LabeledField>
                            <LabeledField label="Custom model override">
                              <Input
                                value={controller.model ?? ""}
                                onChange={(event) => onUpdateController(group.id, { model: event.target.value })}
                                placeholder={listedModels[0] ?? GEMINI_MODELS[0]}
                              />
                            </LabeledField>
                            <LabeledField label="Gemini API key">
                              <Input
                                type="password"
                                value={controller.apiKey ?? ""}
                                onChange={(event) => onUpdateController(group.id, { apiKey: event.target.value })}
                                placeholder="Optional if CLI login already exists"
                              />
                            </LabeledField>
                          </div>
                        ) : null}

                        {DIRECT_API_PROVIDERS.includes(controller.provider) ? (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <LabeledField label={`${providerDisplayName(controller.provider)} key`}>
                              <Input
                                type="password"
                                value={controller.apiKey ?? ""}
                                onChange={(event) => onUpdateController(group.id, { apiKey: event.target.value })}
                                placeholder={`Saved locally for ${providerDisplayName(controller.provider)}`}
                              />
                            </LabeledField>
                            <LabeledField label="Model dropdown">
                              <Select
                                value={controller.model || listedModels[0] || "__empty__"}
                                onValueChange={(value) => onUpdateController(group.id, { model: value === "__empty__" ? "" : value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder={`Choose a ${providerDisplayName(controller.provider)} model`} />
                                </SelectTrigger>
                                <SelectContent>
                                  {!listedModels.length ? <SelectItem value="__empty__">Load models first</SelectItem> : null}
                                  {listedModels.map((model) => (
                                    <SelectItem key={model} value={model}>
                                      {model}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </LabeledField>
                            <LabeledField label="Custom model override">
                              <Input
                                value={controller.model ?? ""}
                                onChange={(event) => onUpdateController(group.id, { model: event.target.value })}
                                placeholder={listedModels[0] ?? fallbackModels[0] ?? ""}
                              />
                            </LabeledField>
                            {providerSupportsBaseUrl(controller.provider) ? (
                              <LabeledField label="Base URL override">
                                <Input
                                  value={controller.baseUrl ?? ""}
                                  onChange={(event) => onUpdateController(group.id, { baseUrl: event.target.value })}
                                  placeholder="Optional alternate API endpoint"
                                />
                              </LabeledField>
                            ) : (
                              <LabeledField label="Request timeout (seconds)">
                                <Input
                                  type="number"
                                  min="15"
                                  max="600"
                                  value={controller.timeoutSeconds ?? 120}
                                  onChange={(event) => onUpdateController(group.id, { timeoutSeconds: Number(event.target.value) })}
                                />
                              </LabeledField>
                            )}
                            <div className="sm:col-span-2 flex flex-wrap gap-2">
                              <Button variant="secondary" onClick={() => onRefreshProviderCatalog(group.id, controller.provider)}>
                                <Sparkles className="size-4" />
                                Refresh catalog
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {controller.provider === "opencode" ? (
                          <div className="grid gap-4 sm:grid-cols-2">
                            <LabeledField label="Credential dropdown">
                              <Select
                                value={controller.opencodeProvider || "__default__"}
                                onValueChange={(value) => onProviderCredentialChange(group.id, value === "__default__" ? "" : value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose OpenCode credential" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__default__">Default credential</SelectItem>
                                  {opencodeCredentials.map((credential) => (
                                    <SelectItem key={credential} value={credential}>
                                      {credential}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </LabeledField>
                            <LabeledField label="Model dropdown">
                              <Select
                                value={controller.model || listedModels[0] || "__empty__"}
                                onValueChange={(value) => onUpdateController(group.id, { model: value === "__empty__" ? "" : value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Choose an OpenCode model" />
                                </SelectTrigger>
                                <SelectContent>
                                  {!listedModels.length ? <SelectItem value="__empty__">Load models first</SelectItem> : null}
                                  {listedModels.map((model) => (
                                    <SelectItem key={model} value={model}>
                                      {model}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </LabeledField>
                            <LabeledField label="Custom model override">
                              <Input
                                value={controller.model ?? ""}
                                onChange={(event) => onUpdateController(group.id, { model: event.target.value })}
                                placeholder={listedModels[0] ?? "Refresh catalog to load model options"}
                              />
                            </LabeledField>
                            <LabeledField label="CLI home override">
                              <Input
                                value={controller.cliHome ?? ""}
                                onChange={(event) => onUpdateController(group.id, { cliHome: event.target.value })}
                                placeholder="Optional isolated OpenCode runtime path"
                              />
                            </LabeledField>
                            <div className="sm:col-span-2 flex flex-wrap gap-2">
                              <Button variant="secondary" onClick={() => onRefreshProviderCatalog(group.id, "opencode", controller.opencodeProvider)}>
                                <Sparkles className="size-4" />
                                Refresh catalog
                              </Button>
                              <Button variant="secondary" onClick={() => onLaunchProviderLogin("opencode")}>
                                <KeyRound className="size-4" />
                                OpenCode login
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {controller.provider === "heuristic" ? (
                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-400">
                            This group uses the deterministic local adapter for fast offline-safe baseline runs.
                          </div>
                        ) : null}

                        {DIRECT_API_PROVIDERS.includes(controller.provider) ? (
                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-400">
                            {providerDisplayName(controller.provider)} uses a direct API key. The selected model will control every human in this group.
                          </div>
                        ) : null}

                        {catalog.login_hint ? (
                          <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-6 text-zinc-400">
                            {catalog.login_hint}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="humans" className="m-0 px-6 py-5">
              <div className="space-y-5">
                {groups.map((group) => (
                  <Card key={group.id} className="bg-white/[0.025]">
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <CardTitle>{group.name} population</CardTitle>
                          <CardDescription>
                            These humans are the moving population on the map. Every one of them inherits the group controller.
                          </CardDescription>
                        </div>
                        <Badge variant="muted">{group.population_count} humans</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <LabeledField label="Population count">
                        <Input
                          type="number"
                          min="1"
                          max="48"
                          value={group.population_count}
                          onChange={(event) => onUpdatePopulation(group.id, Number(event.target.value))}
                        />
                      </LabeledField>

                      <div className="grid gap-3">
                        {group.humans.map((human) => (
                          <div key={human.id} className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                              <LabeledField label="Human name">
                                <Input
                                  value={human.name}
                                  onChange={(event) => onUpdateHuman(group.id, human.id, { name: event.target.value })}
                                />
                              </LabeledField>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <HumanStat label="Open" value={human.personality?.openness ?? 0} />
                                <HumanStat label="Agree" value={human.personality?.agreeableness ?? 0} />
                                <HumanStat label="Neuro" value={human.personality?.neuroticism ?? 0} />
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-500">
                              <span>ID {human.id}</span>
                              <span>Food {human.inventory?.food ?? 0}</span>
                              <span>Wood {human.inventory?.wood ?? 0}</span>
                              <span>Stone {human.inventory?.stone ?? 0}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
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


function HumanStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/30 px-3 py-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-medium text-zinc-100">{value}</p>
    </div>
  );
}


function resolveModelOptions(models, selectedModel) {
  const options = Array.isArray(models) ? models.filter(Boolean) : [];
  if (selectedModel && !options.includes(selectedModel)) {
    return [selectedModel, ...options];
  }
  return options;
}


function resolveFallbackModels(provider) {
  if (provider === "gemini-cli") {
    return GEMINI_MODELS;
  }
  if (provider === "gemini-api") {
    return GEMINI_API_MODELS;
  }
  if (provider === "openai") {
    return OPENAI_MODELS;
  }
  if (provider === "anthropic") {
    return ANTHROPIC_MODELS;
  }
  return [];
}


function resolveAuthStatus(controller, catalog) {
  if (DIRECT_API_PROVIDERS.includes(controller.provider)) {
    return controller.apiKey ? "configured" : "api-key-required";
  }
  if (controller.provider === "gemini-cli") {
    return controller.apiKey ? "configured" : (catalog.auth_status ?? "cli-login-or-api-key");
  }
  return catalog.auth_status ?? (controller.provider === "heuristic" ? "local" : "pending");
}
