"use client";

import {
  KeyRound,
  MountainSnow,
  PawPrint,
  Plus,
  Shield,
  Trees,
  UserRoundCog
} from "lucide-react";

import {
  PROVIDER_OPTIONS,
  providerDisplayName,
  providerSupportsBaseUrl,
  providerUsesApiKey,
  providerUsesLogin
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
  onUpdateRace,
  onUpdateRaceController,
  onAddStarterKingdom,
  onDeleteStarterKingdom,
  onUpdateStarterKingdom,
  onUpdateKingdomController,
  onUpdateFauna,
  onSaveSettings,
  onGenerateWorld,
  onRefreshOpencodeStatus,
  onRefreshProviderCatalog,
  onProviderChange,
  onProviderCredentialChange,
  onLaunchProviderLogin
}) {
  const races = settings.races ?? [];
  const kingdoms = settings.starter_kingdoms ?? [];
  const faunaSpecies = settings.fauna?.species ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full p-0 sm:max-w-[920px]">
        <SheetHeader className="border-b border-white/8 px-6 py-5">
          <SheetTitle>WorldBox setup</SheetTitle>
          <SheetDescription>
            Configure the world, tune race seeding, add manual starter kingdoms, assign AI controllers, and populate the wild.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={onTabChange} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-white/8 px-6 py-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="world">
                <MountainSnow className="mr-2 size-4" />
                World
              </TabsTrigger>
              <TabsTrigger value="races">
                <Trees className="mr-2 size-4" />
                Races
              </TabsTrigger>
              <TabsTrigger value="kingdoms">
                <Shield className="mr-2 size-4" />
                Kingdoms
              </TabsTrigger>
              <TabsTrigger value="controllers">
                <UserRoundCog className="mr-2 size-4" />
                Controllers
              </TabsTrigger>
              <TabsTrigger value="fauna">
                <PawPrint className="mr-2 size-4" />
                Fauna
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
                      Seed the Python atlas and shape the geography before races, kingdoms, and animals enter it.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <LabeledField label="Seed">
                      <Input type="number" value={settings.world?.seed ?? ""} onChange={(event) => onUpdateWorld({ seed: Number(event.target.value) })} />
                    </LabeledField>
                    <LabeledField label="Preset">
                      <Select value={settings.world?.generatorPreset ?? "grand-continent"} onValueChange={(value) => onUpdateWorld({ generatorPreset: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="grand-continent">Grand Continent</SelectItem>
                          <SelectItem value="archipelago">Archipelago</SelectItem>
                          <SelectItem value="highland-realms">Highland Realms</SelectItem>
                        </SelectContent>
                      </Select>
                    </LabeledField>
                    <LabeledField label="Width">
                      <Input type="number" min="24" max="256" value={settings.world?.width ?? 128} onChange={(event) => onUpdateWorld({ width: Number(event.target.value) })} />
                    </LabeledField>
                    <LabeledField label="Height">
                      <Input type="number" min="24" max="256" value={settings.world?.height ?? 128} onChange={(event) => onUpdateWorld({ height: Number(event.target.value) })} />
                    </LabeledField>
                    <LabeledField label="Coastline bias">
                      <Input type="number" min="0" max="100" value={settings.world?.coastlineBias ?? 58} onChange={(event) => onUpdateWorld({ coastlineBias: Number(event.target.value) })} />
                    </LabeledField>
                    <LabeledField label="River count">
                      <Input type="number" min="0" max="20" value={settings.world?.riverCount ?? 8} onChange={(event) => onUpdateWorld({ riverCount: Number(event.target.value) })} />
                    </LabeledField>
                    <LabeledField label="Settlement density">
                      <Input type="number" min="1" max="40" value={settings.world?.settlementDensity ?? 18} onChange={(event) => onUpdateWorld({ settlementDensity: Number(event.target.value) })} />
                    </LabeledField>
                    <LabeledField label="Landmark density">
                      <Input type="number" min="0" max="40" value={settings.world?.landmarkDensity ?? 16} onChange={(event) => onUpdateWorld({ landmarkDensity: Number(event.target.value) })} />
                    </LabeledField>
                    <LabeledField label="Biome density">
                      <Input type="number" min="0" max="100" value={settings.world?.biomeDensity ?? 62} onChange={(event) => onUpdateWorld({ biomeDensity: Number(event.target.value) })} />
                    </LabeledField>
                    <LabeledField label="Fauna density">
                      <Input type="number" min="0" max="100" value={settings.world?.faunaDensity ?? 54} onChange={(event) => onUpdateWorld({ faunaDensity: Number(event.target.value) })} />
                    </LabeledField>
                    <LabeledField label="Kingdom growth intensity">
                      <Input type="number" min="0" max="100" value={settings.world?.kingdomGrowthIntensity ?? 60} onChange={(event) => onUpdateWorld({ kingdomGrowthIntensity: Number(event.target.value) })} />
                    </LabeledField>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="races" className="m-0 px-6 py-5">
              <div className="space-y-5">
                {races.map((race) => (
                  <Card key={race.id} className="bg-white/[0.025]">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>{race.name}</CardTitle>
                          <CardDescription>Enable or disable this race, set auto-seeding, and choose its default kingdom controller.</CardDescription>
                        </div>
                        <Badge variant={race.enabled ? "solid" : "muted"}>{race.enabled ? "Enabled" : "Disabled"}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <LabeledField label="Enabled">
                        <Select value={String(race.enabled)} onValueChange={(value) => onUpdateRace(race.id, { enabled: value === "true" })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Enabled</SelectItem>
                            <SelectItem value="false">Disabled</SelectItem>
                          </SelectContent>
                        </Select>
                      </LabeledField>
                      <LabeledField label="Auto-seeded kingdoms">
                        <Input type="number" min="0" max="4" value={race.auto_seed_count} onChange={(event) => onUpdateRace(race.id, { auto_seed_count: Number(event.target.value) })} />
                      </LabeledField>
                      <LabeledField label="Starting population">
                        <Input type="number" min="1" max="96" value={race.starting_population} onChange={(event) => onUpdateRace(race.id, { starting_population: Number(event.target.value) })} />
                      </LabeledField>
                      <LabeledField label="Color">
                        <Input type="color" value={race.color} onChange={(event) => onUpdateRace(race.id, { color: event.target.value })} className="h-10 p-1" />
                      </LabeledField>
                      <div className="sm:col-span-2">
                        <LabeledField label="Primary cultural element">
                          <Input
                            value={race.culture?.[0]?.element ?? ""}
                            onChange={(event) => onUpdateRace(race.id, {
                              culture: [{ ...(race.culture?.[0] ?? {}), element: event.target.value }]
                            })}
                          />
                        </LabeledField>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="kingdoms" className="m-0 px-6 py-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">Manual starter kingdoms</h3>
                  <p className="text-sm text-zinc-400">Blend manual kingdoms into the world beside the auto-seeded races.</p>
                </div>
                <Button variant="secondary" onClick={onAddStarterKingdom}>
                  <Plus className="size-4" />
                  Add kingdom
                </Button>
              </div>
              <div className="space-y-5">
                {kingdoms.map((kingdom) => {
                  const territory = territoryLookup?.[kingdom.id];
                  return (
                    <Card key={kingdom.id} className="bg-white/[0.025]">
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className="size-11 rounded-2xl border border-white/12" style={{ background: kingdom.color }} />
                            <div className="space-y-2">
                              <CardTitle>{kingdom.name}</CardTitle>
                              <CardDescription>{kingdom.population} humans · {kingdom.race_kind}</CardDescription>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="muted">{territory ? `${territory.tile_count} tiles` : "Awaiting world"}</Badge>
                            <Button variant="ghost" size="sm" onClick={() => onDeleteStarterKingdom(kingdom.id)}>Remove</Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-2">
                        <LabeledField label="Kingdom name">
                          <Input value={kingdom.name} onChange={(event) => onUpdateStarterKingdom(kingdom.id, { name: event.target.value })} />
                        </LabeledField>
                        <LabeledField label="Race">
                          <Select value={kingdom.race_kind} onValueChange={(value) => onUpdateStarterKingdom(kingdom.id, { race_kind: value })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="human">Humans</SelectItem>
                              <SelectItem value="orc">Orcs</SelectItem>
                              <SelectItem value="elf">Elves</SelectItem>
                              <SelectItem value="dwarf">Dwarves</SelectItem>
                            </SelectContent>
                          </Select>
                        </LabeledField>
                        <LabeledField label="Population">
                          <Input type="number" min="1" max="96" value={kingdom.population} onChange={(event) => onUpdateStarterKingdom(kingdom.id, { population: Number(event.target.value) })} />
                        </LabeledField>
                        <LabeledField label="Color">
                          <Input type="color" value={kingdom.color} onChange={(event) => onUpdateStarterKingdom(kingdom.id, { color: event.target.value })} className="h-10 p-1" />
                        </LabeledField>
                        <LabeledField label="Placement mode">
                          <Select value={String(kingdom.manual_position)} onValueChange={(value) => onUpdateStarterKingdom(kingdom.id, { manual_position: value === "true" })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="false">Auto place</SelectItem>
                              <SelectItem value="true">Manual coordinates</SelectItem>
                            </SelectContent>
                          </Select>
                        </LabeledField>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <LabeledField label="Spawn X">
                            <Input type="number" value={kingdom.x ?? ""} onChange={(event) => onUpdateStarterKingdom(kingdom.id, { x: Number(event.target.value) })} disabled={!kingdom.manual_position} />
                          </LabeledField>
                          <LabeledField label="Spawn Y">
                            <Input type="number" value={kingdom.y ?? ""} onChange={(event) => onUpdateStarterKingdom(kingdom.id, { y: Number(event.target.value) })} disabled={!kingdom.manual_position} />
                          </LabeledField>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="controllers" className="m-0 px-6 py-5">
              <div className="space-y-6">
                <ControllerGroup
                  title="Race default controllers"
                  description="These controllers are inherited by auto-seeded kingdoms for each race."
                >
                  {races.map((race) => (
                    <ControllerCard
                      key={`race:${race.id}`}
                      title={race.name}
                      subtitle={`Default ${race.id} controller`}
                      controller={race.controller}
                      catalog={providerCatalogs[`race:${race.id}`]}
                      opencodeCredentials={opencodeCredentials}
                      onRefreshOpencodeStatus={onRefreshOpencodeStatus}
                      onRefreshProviderCatalog={(provider, credential = "") => onRefreshProviderCatalog("race", race.id, provider, credential)}
                      onProviderChange={(provider) => onProviderChange("race", race.id, provider)}
                      onCredentialChange={(credential) => onProviderCredentialChange("race", race.id, credential)}
                      onUpdateController={(patch) => onUpdateRaceController(race.id, patch)}
                      onLaunchProviderLogin={onLaunchProviderLogin}
                    />
                  ))}
                </ControllerGroup>

                <Separator className="bg-white/8" />

                <ControllerGroup
                  title="Manual kingdom controllers"
                  description="These controllers power every human in the matching starter kingdom."
                >
                  {kingdoms.map((kingdom) => (
                    <ControllerCard
                      key={`kingdom:${kingdom.id}`}
                      title={kingdom.name}
                      subtitle={`${kingdom.population} humans · ${kingdom.race_kind}`}
                      controller={kingdom.controller}
                      catalog={providerCatalogs[`kingdom:${kingdom.id}`]}
                      opencodeCredentials={opencodeCredentials}
                      onRefreshOpencodeStatus={onRefreshOpencodeStatus}
                      onRefreshProviderCatalog={(provider, credential = "") => onRefreshProviderCatalog("kingdom", kingdom.id, provider, credential)}
                      onProviderChange={(provider) => onProviderChange("kingdom", kingdom.id, provider)}
                      onCredentialChange={(credential) => onProviderCredentialChange("kingdom", kingdom.id, credential)}
                      onUpdateController={(patch) => onUpdateKingdomController(kingdom.id, patch)}
                      onLaunchProviderLogin={onLaunchProviderLogin}
                    />
                  ))}
                </ControllerGroup>
              </div>
            </TabsContent>

            <TabsContent value="fauna" className="m-0 px-6 py-5">
              <div className="space-y-5">
                {faunaSpecies.map((species) => (
                  <Card key={species.id} className="bg-white/[0.025]">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <CardTitle>{species.name}</CardTitle>
                          <CardDescription>{species.kind} · {species.rarity}</CardDescription>
                        </div>
                        <Badge variant={species.enabled ? "solid" : "muted"}>{species.enabled ? "Enabled" : "Disabled"}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      <LabeledField label="Enabled">
                        <Select value={String(species.enabled)} onValueChange={(value) => onUpdateFauna(species.id, { enabled: value === "true" })}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Enabled</SelectItem>
                            <SelectItem value="false">Disabled</SelectItem>
                          </SelectContent>
                        </Select>
                      </LabeledField>
                      <LabeledField label="Spawn count">
                        <Input type="number" min="0" max="200" value={species.count} onChange={(event) => onUpdateFauna(species.id, { count: Number(event.target.value) })} />
                      </LabeledField>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </ScrollArea>

          <SheetFooter className="border-t border-white/8 px-6 py-4 sm:justify-between">
            <div className="text-sm text-zinc-500">
              Save the setup to persist your WorldBox configuration, or generate immediately to preview the atlas.
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onGenerateWorld} disabled={busy}>Generate world</Button>
              <Button onClick={onSaveSettings} disabled={busy}>Save settings</Button>
            </div>
          </SheetFooter>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function ControllerGroup({ title, description, children }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
        <p className="text-sm text-zinc-400">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ControllerCard({
  title,
  subtitle,
  controller,
  catalog,
  opencodeCredentials,
  onRefreshOpencodeStatus,
  onRefreshProviderCatalog,
  onProviderChange,
  onCredentialChange,
  onUpdateController,
  onLaunchProviderLogin
}) {
  const provider = controller?.provider ?? "heuristic";
  const models = catalog?.models?.length ? catalog.models : controller?.availableModels ?? [];

  return (
    <Card className="bg-white/[0.025]">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{subtitle}. This controller powers all humans in this scope.</CardDescription>
          </div>
          <Badge variant="muted">{providerDisplayName(provider)}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <LabeledField label="Provider">
          <Select value={provider} onValueChange={onProviderChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>

        <LabeledField label="Model">
          <Select value={controller?.model || "__empty__"} onValueChange={(value) => onUpdateController({ model: value === "__empty__" ? "" : value })}>
            <SelectTrigger><SelectValue placeholder="Choose a model" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__empty__">Automatic / none</SelectItem>
              {models.map((model) => (
                <SelectItem key={model} value={model}>{model}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>

        {provider === "opencode" ? (
          <>
            <LabeledField label="OpenCode credential">
              <Select value={controller?.opencodeProvider || "__empty__"} onValueChange={(value) => onCredentialChange(value === "__empty__" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Choose credential" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">Default credential</SelectItem>
                  {opencodeCredentials.map((credential) => (
                    <SelectItem key={credential} value={credential}>{credential}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LabeledField>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
              <Button variant="outline" onClick={() => onLaunchProviderLogin("opencode")}>
                <KeyRound className="size-4" />
                Login
              </Button>
              <Button variant="outline" onClick={onRefreshOpencodeStatus}>Refresh credentials</Button>
              <Button variant="outline" onClick={() => onRefreshProviderCatalog("opencode", controller?.opencodeProvider ?? "")}>Refresh models</Button>
            </div>
          </>
        ) : null}

        {providerUsesLogin(provider) && provider !== "opencode" ? (
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
            <Button variant="outline" onClick={() => onLaunchProviderLogin(provider)}>
              <KeyRound className="size-4" />
              Login
            </Button>
            <Button variant="outline" onClick={() => onRefreshProviderCatalog(provider, "")}>Refresh models</Button>
          </div>
        ) : null}

        {providerUsesApiKey(provider) ? (
          <LabeledField label="API key">
            <Input
              type="password"
              value={controller?.apiKey ?? ""}
              placeholder="Enter API key"
              onChange={(event) => onUpdateController({ apiKey: event.target.value })}
            />
          </LabeledField>
        ) : null}

        {providerSupportsBaseUrl(provider) ? (
          <LabeledField label="Base URL">
            <Input
              value={controller?.baseUrl ?? ""}
              placeholder="Optional custom endpoint"
              onChange={(event) => onUpdateController({ baseUrl: event.target.value })}
            />
          </LabeledField>
        ) : null}

        <div className="sm:col-span-2">
          <LabeledField label="Manual model override">
            <Input
              value={controller?.model ?? ""}
              placeholder="Optional custom model id"
              onChange={(event) => onUpdateController({ model: event.target.value })}
            />
          </LabeledField>
        </div>
      </CardContent>
    </Card>
  );
}

function LabeledField({ label, children }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
