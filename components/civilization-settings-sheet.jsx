"use client";

import { KeyRound, Plus, Settings2, UserRoundCog } from "lucide-react";

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
  busy,
  onUpdateWorld,
  onAddGroup,
  onDeleteGroup,
  onUpdateGroup,
  onUpdateGroupController,
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
      <SheetContent side="left" className="w-full p-0 sm:max-w-[880px]">
        <SheetHeader className="border-b border-white/20 px-6 py-5">
          <SheetTitle>Simulation setup</SheetTitle>
          <SheetDescription>
            Tune the world and manage the human groups that the AI controllers will power.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={onTabChange} className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-white/20 px-6 py-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="world">
                <Settings2 className="mr-2 size-4" />
                World
              </TabsTrigger>
              <TabsTrigger value="groups">
                <UserRoundCog className="mr-2 size-4" />
                Groups
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <TabsContent value="world" className="m-0 px-6 py-5">
              <Card className="border-white/20 bg-white/10 backdrop-blur-[10px] backdrop-saturate-180">
                <CardHeader>
                  <CardTitle>World generator</CardTitle>
                  <CardDescription>
                    Keep the world procedural, but reduce the controls to the ones that actually shape the human sandbox.
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
                    <Input type="number" min="0" max="40" value={settings.world?.settlementDensity ?? 10} onChange={(event) => onUpdateWorld({ settlementDensity: Number(event.target.value) })} />
                  </LabeledField>
                  <LabeledField label="Landmark density">
                    <Input type="number" min="0" max="40" value={settings.world?.landmarkDensity ?? 16} onChange={(event) => onUpdateWorld({ landmarkDensity: Number(event.target.value) })} />
                  </LabeledField>
                  <LabeledField label="Biome density">
                    <Input type="number" min="0" max="100" value={settings.world?.biomeDensity ?? 62} onChange={(event) => onUpdateWorld({ biomeDensity: Number(event.target.value) })} />
                  </LabeledField>
                  <LabeledField label="Reason interval (ticks)">
                    <Input type="number" min="1" max="60" value={settings.world?.reason_interval ?? 5} onChange={(event) => onUpdateWorld({ reason_interval: Number(event.target.value) })} />
                  </LabeledField>
                  <LabeledField label="Perception radius">
                    <Input type="number" min="1" max="8" value={settings.world?.perception_radius ?? 3} onChange={(event) => onUpdateWorld({ perception_radius: Number(event.target.value) })} />
                  </LabeledField>
                  <LabeledField label="Fauna density">
                    <Input type="number" min="0" max="100" value={settings.world?.fauna_density ?? 12} onChange={(event) => onUpdateWorld({ fauna_density: Number(event.target.value) })} />
                  </LabeledField>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="groups" className="m-0 px-6 py-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">Human groups</h3>
                  <p className="text-sm text-zinc-400">Each group is a community. Every human inside it inherits the same AI controller.</p>
                </div>
                <Button variant="secondary" onClick={onAddGroup}>
                  <Plus className="size-4" />
                  Add group
                </Button>
              </div>

              <div className="space-y-6">
                {groups.map((group) => (
                  <Card key={group.id} className="bg-white/[0.025]">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="size-11 rounded-2xl border border-white/12" style={{ background: group.color }} />
                          <div>
                            <CardTitle>{group.name}</CardTitle>
                            <CardDescription>{group.population_count} humans</CardDescription>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => onDeleteGroup(group.id)}>Remove</Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <LabeledField label="Group name">
                          <Input value={group.name} onChange={(event) => onUpdateGroup(group.id, { name: event.target.value })} />
                        </LabeledField>
                        <LabeledField label="Color">
                          <Input type="color" value={group.color} onChange={(event) => onUpdateGroup(group.id, { color: event.target.value })} className="h-10 p-1" />
                        </LabeledField>
                        <LabeledField label="Population">
                          <Input type="number" min="1" max="24" value={group.population_count} onChange={(event) => onUpdateGroup(group.id, { population_count: Number(event.target.value) })} />
                        </LabeledField>
                        <LabeledField label="Provider">
                          <Select value={group.controller?.provider ?? "heuristic"} onValueChange={(value) => onProviderChange(group.id, value)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PROVIDER_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </LabeledField>
                      </div>

                      <LabeledField label="Culture summary">
                        <Input value={group.culture_summary ?? ""} onChange={(event) => onUpdateGroup(group.id, { culture_summary: event.target.value })} />
                      </LabeledField>

                      <Separator className="bg-white/20" />

                      <ControllerCard
                        title={`${group.name} controller`}
                        subtitle={`This controller powers all ${group.population_count} humans in the group`}
                        controller={group.controller}
                        catalog={providerCatalogs[`group:${group.id}`]}
                        opencodeCredentials={opencodeCredentials}
                        onRefreshOpencodeStatus={onRefreshOpencodeStatus}
                        onRefreshProviderCatalog={(provider, credential = "") => onRefreshProviderCatalog("group", group.id, provider, credential)}
                        onProviderChange={(provider) => onProviderChange(group.id, provider)}
                        onCredentialChange={(credential) => onProviderCredentialChange(group.id, credential)}
                        onUpdateController={(patch) => onUpdateGroupController(group.id, patch)}
                        onLaunchProviderLogin={onLaunchProviderLogin}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </ScrollArea>

          <SheetFooter className="border-t border-white/20 px-6 py-4 sm:justify-between">
            <div className="text-sm text-zinc-500">
              Save to persist the human-group setup, or generate immediately to preview the world.
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
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-zinc-100">{title}</h4>
          <p className="text-sm text-zinc-400">{subtitle}.</p>
        </div>
        <Badge variant="muted">{providerDisplayName(provider)}</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
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

        {["openai", "anthropic", "gemini-api", "gemini-cli", "opencode"].includes(provider) ? (
          <LabeledField label="Timeout (seconds)">
            <Input
              type="number"
              min="15"
              max="600"
              value={controller?.timeoutSeconds ?? 120}
              onChange={(event) => onUpdateController({ timeoutSeconds: Number(event.target.value) })}
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
      </div>
    </div>
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
