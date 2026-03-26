"use client";

import { useEffect, useMemo, useState } from "react";

import { AlertTriangle, Check, CheckCircle2, Cpu, ExternalLink, Info, KeyRound, Play, Plus, RotateCcw, Search, Settings, Shield, Sparkles, Terminal, UserRoundCog, Users, Zap } from "lucide-react";


import {
  ANTHROPIC_MODELS,
  controllerReadiness,
  DIRECT_API_PROVIDERS,
  GEMINI_API_MODELS,
  GEMINI_MODELS,
  GROQ_MODELS,
  OPENAI_MODELS,
  OPENCODE_ZEN_MODELS,
  PROVIDER_OPTIONS,
  STRICT_MAX_TOTAL_POPULATION,
  providerDisplayName,
  providerSupportsBaseUrl,
  providerUsesApiKey,
  totalConfiguredPopulation
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
  opencodeCatalog,
  opencodeZenKeyDraft,
  onOpencodeZenKeyDraftChange,
  onPatchGroup,
  onPatchGroupController,
  onUpdateProviderConnection,
  onConnectOpencode,
  onPatchProviders,
  onPatchOpencodeConnection,
  onPatchWorld,
  onAction,
  onRefreshCatalogs,
  busy,
  onUpdateWorld,
  onAddGroup,
  onDeleteGroup,
  onUpdateGroup,
  onUpdateHuman,
  onUpdateGroupController,
  onSelectControllerModel,
  onProviderChange,
  onProviderModelChange,
  onSaveSettings,
  onGenerateWorld,
  onRefreshProviderCatalog,
  onCopyCommand,
  onDisconnectOpencodeZen,
  nameValidation,
  onRegenerateDuplicateNames
}) {
  const groups = settings.groups ?? [];
  const population = totalConfiguredPopulation(settings);
  const populationOver = population > STRICT_MAX_TOTAL_POPULATION;
  const populationWarn = population >= STRICT_MAX_TOTAL_POPULATION - 1 && !populationOver;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full h-full flex flex-col p-0 sm:max-w-[880px] bg-black/60 backdrop-blur-3xl saturate-150 border-r border-white/10 shadow-[0_0_80px_rgba(0,0,0,0.8)]">
        <SheetHeader className="border-b border-white/10 px-6 py-5 bg-white/2">
          <SheetTitle>Simulation setup</SheetTitle>
          <SheetDescription>
            Configure world settings, groups, and controllers in one place.
          </SheetDescription>
        </SheetHeader>

        <Tabs value={activeTab} onValueChange={onTabChange} className="flex min-h-0 flex-1 flex-col outline-none">
          <div className="border-b border-white/10 px-6 py-3 bg-white/1">
            <TabsList className="grid w-full grid-cols-2 h-9 bg-black/40 backdrop-blur-md border border-white/5 shadow-inner rounded-lg p-0.5">
              <TabsTrigger value="groups" className="rounded-md text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white">
                <Users className="size-4 mr-2" />
                Groups
              </TabsTrigger>
              <TabsTrigger value="review" className="rounded-md text-sm data-[state=active]:bg-white/10 data-[state=active]:text-white">
                <Play className="size-4 mr-2" />
                Review
              </TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="min-h-0 flex-1" type="scroll">
            <TabsContent value="groups" className="m-0 h-full focus-visible:outline-none px-6 py-5">
              {/* ── WORLD SETTINGS (inline at top) ── */}
              <Card className="border-white/10 bg-linear-to-br from-white/5 to-transparent backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">World Settings</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <LabeledField label="Seed">
                    <Input type="number" value={settings.world?.seed ?? ""} onChange={(event) => onUpdateWorld({ seed: Number(event.target.value) })} className="h-8" />
                  </LabeledField>
                  <LabeledField label="Preset">
                    <Select value={settings.world?.generatorPreset ?? "grand-continent"} onValueChange={(value) => onUpdateWorld({ generatorPreset: value })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="grand-continent">Grand Continent</SelectItem>
                        <SelectItem value="archipelago">Archipelago</SelectItem>
                        <SelectItem value="highland-realms">Highland Realms</SelectItem>
                      </SelectContent>
                    </Select>
                  </LabeledField>
                  <LabeledField label="Width">
                    <Input type="number" min="24" max="256" value={settings.world?.width ?? 128} onChange={(event) => onUpdateWorld({ width: Number(event.target.value) })} className="h-8" />
                  </LabeledField>
                  <LabeledField label="Height">
                    <Input type="number" min="24" max="256" value={settings.world?.height ?? 128} onChange={(event) => onUpdateWorld({ height: Number(event.target.value) })} className="h-8" />
                  </LabeledField>
                  <LabeledField label="Coastline">
                    <Input type="number" min="0" max="100" value={settings.world?.coastlineBias ?? 58} onChange={(event) => onUpdateWorld({ coastlineBias: Number(event.target.value) })} className="h-8" />
                  </LabeledField>
                  <LabeledField label="Rivers">
                    <Input type="number" min="0" max="20" value={settings.world?.riverCount ?? 8} onChange={(event) => onUpdateWorld({ riverCount: Number(event.target.value) })} className="h-8" />
                  </LabeledField>
                  <LabeledField label="Duration (sec)">
                    <Input type="number" min="10" max="1800" value={settings.world?.run_duration_seconds ?? 80} onChange={(event) => onUpdateWorld({ run_duration_seconds: Number(event.target.value) })} className="h-8" />
                  </LabeledField>
                  <LabeledField label="Speed">
                    <Select value={String(settings.world?.playback_speed ?? 1)} onValueChange={(value) => onUpdateWorld({ playback_speed: Number(value) })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1x</SelectItem>
                        <SelectItem value="2">2x</SelectItem>
                        <SelectItem value="4">4x</SelectItem>
                      </SelectContent>
                    </Select>
                  </LabeledField>
                </CardContent>
              </Card>

              {/* ── POPULATION COUNTER ── */}
              <div className={`mb-4 flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                populationOver
                  ? "border-red-500/30 bg-red-500/10"
                  : populationWarn
                    ? "border-amber-500/20 bg-amber-500/8"
                    : "border-white/8 bg-white/3"
              }`}>
                <div className={`flex size-9 items-center justify-center rounded-xl ${
                  populationOver ? "bg-red-500/15" : populationWarn ? "bg-amber-500/10" : "bg-white/5"
                }`}>
                  <UserRoundCog className={`size-5 ${
                    populationOver ? "text-red-300" : populationWarn ? "text-amber-300" : "text-zinc-400"
                  }`} />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-semibold ${
                    populationOver ? "text-red-100" : populationWarn ? "text-amber-100" : "text-zinc-200"
                  }`}>
                    Humans: {population} / {STRICT_MAX_TOTAL_POPULATION} max
                  </p>
                  {populationOver ? (
                    <p className="text-xs text-red-200/80">Strict mode supports up to {STRICT_MAX_TOTAL_POPULATION} humans total. Remove some before running.</p>
                  ) : populationWarn ? (
                    <p className="text-xs text-amber-200/60">Approaching the limit — strict mode caps at {STRICT_MAX_TOTAL_POPULATION} humans to avoid rate limiting.</p>
                  ) : (
                    <p className="text-xs text-zinc-500">Each group contributes to the total population count.</p>
                  )}
                </div>
                {populationOver ? (
                  <AlertTriangle className="size-5 shrink-0 text-red-300" />
                ) : null}
              </div>

              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">Human groups</h3>
                  <p className="text-sm text-zinc-400">Each group is a community. Every human inside it inherits the same AI controller.</p>
                </div>
                <div className="flex gap-2">
                  {!nameValidation?.valid ? (
                    <Button variant="outline" onClick={onRegenerateDuplicateNames}>
                      Regenerate duplicate names
                    </Button>
                  ) : null}
                  <Button variant="secondary" onClick={onAddGroup}>
                    <Plus className="size-4" />
                    Add group
                  </Button>
                </div>
              </div>

              {!nameValidation?.valid ? (
                <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
                  <p className="font-medium">Run and save are blocked until every human has a unique name.</p>
                  <p className="mt-1 text-red-200/80">{nameValidation.message}</p>
                </div>
              ) : null}

              <div className="space-y-6">
                {groups.map((group) => (
                  <Card key={group.id} className="border-white/10 bg-linear-to-br from-white/4 to-white/1 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur-3xl rounded-[20px] transition-all duration-300">
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
                      {(nameValidation?.byGroupId?.[group.id] ?? []).length ? (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-100">
                          Duplicate or missing names in this group: {(nameValidation.byGroupId[group.id] ?? []).map((item) => item.name || item.human_id).join(", ")}
                        </div>
                      ) : null}

                      <div className="grid gap-4 sm:grid-cols-3">
                        <LabeledField label="Group name">
                          <Input value={group.name} onChange={(event) => onUpdateGroup(group.id, { name: event.target.value })} />
                        </LabeledField>
                        <LabeledField label="Color">
                          <Input type="color" value={group.color} onChange={(event) => onUpdateGroup(group.id, { color: event.target.value })} className="h-10 p-1" />
                        </LabeledField>
                        <LabeledField label="Population">
                          <Input type="number" min="1" max="24" value={group.population_count} onChange={(event) => onUpdateGroup(group.id, { population_count: Number(event.target.value) })} />
                        </LabeledField>
                      </div>

                      <LabeledField label="Culture summary">
                        <Input value={group.culture_summary ?? ""} onChange={(event) => onUpdateGroup(group.id, { culture_summary: event.target.value })} />
                      </LabeledField>

                      <Separator className="bg-white/20" />

                      <ControllerCard
                        key={group.id}
                        group={group}
                        status={controllerReadiness(group.controller, providerCatalogs[`group:${group.id}`], settings.providers)}
                        catalog={providerCatalogs[`group:${group.id}`] ?? null}
                        opencodeCatalog={opencodeCatalog}
                        onPatchController={(patch) => onUpdateGroupController(group.id, patch)}
                        onUpdateProviderConnection={onUpdateProviderConnection}
                        onRefreshCatalogs={onRefreshCatalogs}
                        onConnectOpencode={onConnectOpencode}
                        globalProviders={settings.providers}
                      />


                      <Separator className="bg-white/20" />

                      <HumanRosterEditor
                        group={group}
                        onUpdateHuman={onUpdateHuman}
                        nameValidation={nameValidation}
                        onRegenerateDuplicateNames={onRegenerateDuplicateNames}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* ── REVIEW TAB ── */}
            <TabsContent value="review" className="m-0 h-full focus-visible:outline-none px-6 py-5">
              <ReviewPanel
                settings={settings}
                groups={groups}
                providerCatalogs={providerCatalogs}
                opencodeCatalog={opencodeCatalog}
                population={population}
                populationOver={populationOver}
                nameValidation={nameValidation}
                busy={busy}
                onSaveSettings={onSaveSettings}
                onGenerateWorld={onGenerateWorld}
                onTabChange={onTabChange}
              />
            </TabsContent>
          </ScrollArea>

          <SheetFooter className="border-t border-white/10 bg-black/20 px-6 py-4 sm:justify-between">
            <div className="text-sm text-zinc-400">
              {activeTab === "groups" ? "Configure groups and controllers" : "Review settings and run simulation"}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onGenerateWorld} disabled={busy}>Generate world</Button>
              <Button onClick={onSaveSettings} disabled={busy || !nameValidation?.valid}>Save settings</Button>
            </div>
          </SheetFooter>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function ControllerCard({
  group,
  status,
  catalog,
  opencodeCatalog,
  onPatchController,
  onUpdateProviderConnection,
  onRefreshCatalogs,
  onConnectOpencode,
  globalProviders,
}) {
  const controller = group.controller ?? {};
  const provider = controller?.provider ?? "heuristic";
  const selectedModel = String(controller?.model ?? "").trim();

  const baseCatalog = provider === "opencode"
    ? (opencodeCatalog?.provider === "opencode" || opencodeCatalog?.connected_provider === "opencode" ? opencodeCatalog : null)
    : null;
  const effectiveCatalog = provider === "opencode"
    ? {
        ...(baseCatalog ?? {}),
        ...(catalog ?? {}),
        models: baseCatalog?.models?.length ? baseCatalog.models : (catalog?.models ?? []),
        model_entries: catalog?.model_entries?.length ? catalog.model_entries : (baseCatalog?.model_entries ?? []),
        manual_commands: baseCatalog?.manual_commands ?? catalog?.manual_commands,
      }
    : (catalog?.provider === provider || !catalog?.provider ? catalog : null);

  const setupGuide = describeControllerSetup(provider, status.state, effectiveCatalog, selectedModel);
  const setupTitle = setupGuide.title;
  const setupDescription = setupGuide.description;
  const setupDetail = setupGuide.detail;

  return (
    <Card className="border-white/10 bg-linear-to-br from-white/5 to-transparent backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-white/5 border border-white/5">
              <UserRoundCog className="size-5 text-zinc-400" />
            </div>
            <div>
              <CardTitle className="text-lg">{group.name} controller</CardTitle>
              <CardDescription>This controller powers all {group.population_count} humans in the group.</CardDescription>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge variant="muted">{providerDisplayName(provider)}</Badge>
            <Badge
              variant={status.state === "ready" ? "default" : "outline"}
              className={status.state === "ready"
                ? "text-[10px]"
                : "border-red-500/40 bg-red-500/10 text-[10px] text-red-200"
              }
            >
              {status.state === "ready" ? "● Ready" : status.state === "not_connected" ? "○ Not configured" : formatReadinessState(status.state)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <LabeledField label="Intelligence Provider">
          <Select value={controller.provider || "heuristic"} onValueChange={(v) => onPatchController({ provider: v, model: "" })}>
            <SelectTrigger className="h-10 rounded-xl bg-black/20 text-sm shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROVIDER_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-sm">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </LabeledField>

        <InlineConnectionPanel
          provider={provider}
          controller={controller}
          catalog={catalog}
          opencodeCatalog={opencodeCatalog}
          onPatchController={onPatchController}
          onUpdateProviderConnection={onUpdateProviderConnection}
          onRefreshCatalogs={onRefreshCatalogs}
          onConnectOpencode={onConnectOpencode}
          globalProviders={globalProviders}
        />

        <LabeledField label="Model Selection">
          <ProviderModelChooser
            provider={provider}
            currentModel={selectedModel}
            catalog={catalog}
            opencodeCatalog={opencodeCatalog}
            onSelect={(p, m) => onPatchController({ provider: p, model: m })}
          />
        </LabeledField>


        <div className="rounded-2xl border border-white/6 bg-white/[0.03] p-4">
          <div className="flex gap-4">
            <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/5">
              <Info className="size-4 text-zinc-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-200">{setupTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{setupDescription}</p>
              {setupDetail ? <p className="mt-2 text-[11px] font-medium text-zinc-500 italic">{setupDetail}</p> : null}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectionTab({
  opencodeCatalog,
  opencodeZenKeyDraft,
  onOpencodeZenKeyDraftChange,
  onUpdateProviderConnection,
  onRefreshOpencodeZen,
  onDisconnectOpencodeZen,
  onAction,
  onCopyCommand,
  groups,
  providers,
}) {
  const opencodeHealth = opencodeCatalog?.health_state ?? "not_connected";
  const opencodeConnected = opencodeHealth === "ready" || opencodeHealth === "rate_limited" || opencodeHealth === "model_required" || opencodeHealth === "login_required";
  const opencodeGroups = (groups ?? []).filter((g) => g.controller?.provider === "opencode");
  const models = opencodeCatalog?.models ?? [];

  return (
    <div className="space-y-6">
      {/* ── OPENCODE ZEN ── */}
      <Card className="border-white/10 bg-linear-to-br from-white/5 to-transparent backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Cable className="size-5 text-blue-400" />
              </div>
              <div>
                <CardTitle className="text-lg">OpenCode Zen</CardTitle>
                <CardDescription>Primary local AI runtime.</CardDescription>
              </div>
            </div>
            <Badge
              variant={opencodeHealth === "ready" ? "default" : "outline"}
              className={opencodeHealth === "ready"
                ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-100 text-[10px]"
                : opencodeHealth === "not_connected"
                  ? "border-zinc-500/30 text-zinc-400 text-[10px]"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-100 text-[10px]"
              }
            >
              {opencodeHealth === "ready" ? "● Connected" : formatOpenCodeStatus(opencodeHealth)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <LabeledField label="OpenCode Zen API Key">
            <div className="flex gap-2">
              <Input
                type="password"
                value={opencodeZenKeyDraft}
                placeholder={opencodeConnected ? "Paste a new key to update" : "sk-..."}
                onChange={(event) => onOpencodeZenKeyDraftChange(event.target.value)}
                className="bg-black/20"
              />
              <Button 
                onClick={() => onUpdateProviderConnection("opencode", { apiKey: opencodeZenKeyDraft })} 
                disabled={!opencodeZenKeyDraft.trim()}
                className="shrink-0"
              >
                <CheckCircle2 className="size-4" />
                Connect
              </Button>
            </div>

          </LabeledField>
          {opencodeConnected ? (
            <div className="flex items-center justify-between rounded-xl border border-white/6 bg-white/2 px-4 py-3">
              <div>
                <p className="text-xs font-medium text-zinc-300">Connected to OpenCode Zen</p>
                <p className="text-[11px] text-zinc-500">Clear the stored credential and start fresh if something is wrong.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 border-red-500/20 text-red-200 hover:bg-red-500/10 hover:border-red-500/30"
                onClick={() => {
                  if (onDisconnectOpencodeZen) onDisconnectOpencodeZen();
                  if (onOpencodeZenKeyDraftChange) onOpencodeZenKeyDraftChange("");
                }}
              >
                <RotateCcw className="size-3.5" />
                Reset Connection
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── DIRECT API PROVIDERS ── */}
      <div className="grid gap-6 md:grid-cols-2">
        <ProviderCredentialCard 
          provider="openai"
          label="OpenAI API"
          icon={<Zap className="size-5 text-emerald-400" />}
          config={providers?.openai}
          onUpdate={(patch) => onUpdateProviderConnection("openai", patch)}
          onAction={onAction}
        />
        <ProviderCredentialCard 
          provider="anthropic"
          label="Anthropic API"
          icon={<Shield className="size-5 text-purple-400" />}
          config={providers?.anthropic}
          onUpdate={(patch) => onUpdateProviderConnection("anthropic", patch)}
          onAction={onAction}
        />
        <ProviderCredentialCard 
          provider="gemini-api"
          label="Gemini API"
          icon={<Sparkles className="size-5 text-blue-400" />}
          config={providers?.["gemini-api"]}
          onUpdate={(patch) => onUpdateProviderConnection("gemini-api", patch)}
          onAction={onAction}
        />
        <ProviderCredentialCard 
          provider="gemini-cli"
          label="Gemini CLI"
          icon={<Terminal className="size-5 text-zinc-400" />}
          config={providers?.["gemini-cli"]}
          onUpdate={(patch) => onUpdateProviderConnection("gemini-cli", patch)}
          onAction={onAction}
          hideUrl
        />
        <ProviderCredentialCard 
          provider="groq"
          label="Groq API"
          icon={<Cpu className="size-5 text-orange-400" />}
          config={providers?.groq}
          onUpdate={(patch) => onUpdateProviderConnection("groq", patch)}
          onAction={onAction}
        />
      </div>
    </div>
  );
}

function ProviderCredentialCard({ provider, label, icon, config, onUpdate, onAction, hideUrl = false }) {
  const [apiKey, setApiKey] = useState(config?.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(config?.baseUrl || "");

  return (
    <Card className="border-white/10 bg-linear-to-br from-white/4 to-transparent backdrop-blur-2xl rounded-2xl overflow-hidden transition-all duration-300 hover:bg-white/6 hover:border-white/20 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-white/5 border border-white/5">
            {icon}
          </div>
          <CardTitle className="text-sm font-semibold">{label}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <LabeledField label="Global API Key">
          <Input 
            type="password" 
            placeholder="sk-..." 
            value={apiKey} 
            onChange={(e) => setApiKey(e.target.value)}
            className="h-8 text-xs bg-black/20"
          />
        </LabeledField>

        {provider === "gemini-cli" && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full h-8 text-[11px] border-blue-500/20 text-blue-200 hover:bg-blue-500/10"
            onClick={() => onAction?.({ type: "GEMINI_CLI_LOGIN" })}
          >
            <ExternalLink className="mr-2 size-3" />
            Launch Browser Login
          </Button>
        )}

        {!hideUrl && (
          <LabeledField label="Proxy / Base URL (Optional)">
            <Input 
              placeholder="https://..." 
              value={baseUrl} 
              onChange={(e) => setBaseUrl(e.target.value)}
              className="h-8 text-xs bg-black/20"
            />
          </LabeledField>
        )}
        <Button 
          size="sm" 
          variant="secondary" 
          className="w-full h-8 text-[11px] font-bold uppercase tracking-wider bg-white/5 hover:bg-white/10"
          onClick={() => onUpdate({ apiKey, baseUrl })}
        >
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}


function OpenCodeConnectionBanner({ opencodeCatalog, groups, onSwitchTab }) {
  const opencodeGroups = (groups ?? []).filter((g) => g.controller?.provider === "opencode");
  const healthState = opencodeCatalog?.health_state ?? "not_connected";
  const needsConnection = opencodeGroups.length > 0 && healthState !== "ready";

  if (!needsConnection) {
    return null;
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/8 px-5 py-4">
      <div>
        <p className="text-sm font-medium text-amber-100">
          {opencodeGroups.length} group{opencodeGroups.length !== 1 ? "s" : ""} use OpenCode, but it's not connected
        </p>
        <p className="mt-0.5 text-xs text-amber-200/60">
          Go to the Connection tab to paste your OpenCode Zen API key first.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onSwitchTab} className="shrink-0 border-amber-500/30 text-amber-100 hover:bg-amber-500/10">
        <Cable className="size-4" />
        Open Connection
      </Button>
    </div>
  );
}

function formatReadinessState(state) {
  const actionable = {
    not_connected: "Not connected — paste your key to connect",
    model_required: "Choose a model to continue",
    missing_api_key: "API key missing — add it in the Connection step",
    login_required: "Login required — connect your provider first",
    runtime_unavailable: "Model didn't respond — try reconnecting or pick another",
    rate_limited: "Rate limited — wait a few minutes or switch models",
    broken_environment: "Environment corrupted — reset connection below",
    duplicate_names: "Fix duplicate human names before running",
    network_issue: "Network error — check your connection and retry",
    not_installed: "CLI not installed — install it or choose a different provider",
  };
  return actionable[state] ?? String(state ?? "unknown").replaceAll("_", " ");
}

function formatOpenCodeStatus(state) {
  if (state === "runtime_unavailable") return "Model not responding — reconnect or switch";
  if (state === "network_issue") return "Network error — check connection";
  if (state === "not_connected") return "Paste key to connect";
  if (state === "rate_limited") return "Rate limited — wait or switch model";
  if (state === "hosted_model_unavailable") return "Hosted model blocked — try another";
  if (state === "provider_backed_model_unavailable") return "Provider model blocked — try another";
  if (state === "connected_no_models") return "Connected — no models available";
  if (state === "model_required") return "Choose a model";
  if (state === "login_required") return "Connect OpenCode first";
  if (state === "ready") return "Ready to run";
  return formatReadinessState(state);
}

function formatSelectedModelError(category, fallback = "") {
  if (category === "quota_limited") return fallback || "This model is rate limited or out of quota. Wait a few minutes or switch models.";
  if (category === "auth_required") return fallback || "This model needs account access. Check your login in the Connection step.";
  if (category === "provider_unavailable") return fallback || "This model is temporarily unavailable. Try a different model.";
  if (category === "network_issue") return fallback || "GridNomad couldn't reach the provider. Check your network and retry.";
  if (category === "broken_environment") return fallback || "Your local environment is corrupted. Click 'Reset Connection' to start fresh.";
  return fallback || "This model didn't answer the verification prompt. Try reconnecting or pick another model.";
}

function buildOpencodeModelLabel(modelId = "") {
  const normalized = String(modelId || "").trim();
  if (!normalized) {
    return "";
  }
  const [provider, model] = normalized.split("/", 2);
  if (!model) {
    return normalized;
  }
  if (provider === "opencode") {
    return model
      .split("-")
      .map((part) => (/^\d/.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
      .join(" ");
  }
  return `${model} (${provider})`;
}

function describeControllerSetup(provider, readinessState, catalog, selectedModel = "") {
  if (provider === "heuristic") {
    return {
      title: "Debug controller selected",
      description: "Heuristic is useful for smoke tests, but it does not represent the enterprise AI flow.",
      detail: "Choose a real model above if you want the group to use a live provider.",
    };
  }

  if (provider === "opencode") {
    if (readinessState === "ready") {
      return {
        title: "OpenCode model verified",
        description: "The selected OpenCode model passed runtime verification and can control this group.",
        detail: selectedModel ? `Selected model: ${buildOpencodeModelLabel(selectedModel)}.` : "",
      };
    }
    if (!selectedModel || readinessState === "model_required") {
      return {
        title: "Choose an OpenCode model",
        description: "Pick the OpenCode model you want first. GridNomad will then show the exact key or verification step it needs.",
        detail: "Hosted models like MiniMax M2.5 Free and any models exposed by the OpenCode runtime appear in the browser above.",
      };
    }
    if (readinessState === "not_connected") {
      return {
        title: "OpenCode key required",
        description: "Paste the OpenCode Zen key below, connect it, then verify the selected model.",
        detail: catalog?.login_hint ?? "",
      };
    }
    if (readinessState === "rate_limited") {
      return {
        title: "Selected OpenCode model is rate limited",
        description: "GridNomad reached OpenCode, but the selected model is currently rate limited.",
        detail: catalog?.login_hint ?? "",
      };
    }
    if (readinessState === "hosted_model_unavailable") {
      return {
        title: "Selected OpenCode-hosted model is blocked",
        description: "OpenCode can see the selected hosted model, but it could not run it right now.",
        detail: catalog?.login_hint ?? "",
      };
    }
    if (readinessState === "provider_backed_model_unavailable") {
      return {
        title: "Selected provider-backed model is blocked",
        description: "OpenCode can see the selected provider-backed model, but it could not run it right now.",
        detail: catalog?.login_hint ?? "",
      };
    }
    if (readinessState === "runtime_unavailable") {
      return {
        title: "Runtime verification failed",
        description: "The selected OpenCode model did not answer a verification prompt cleanly.",
        detail: catalog?.decision_probe?.error ?? catalog?.login_hint ?? "",
      };
    }
    return {
      title: "Verify the selected OpenCode model",
      description: "The model is chosen, but GridNomad still needs a successful runtime verification before you can run.",
      detail: catalog?.login_hint ?? "",
    };
  }

  if (provider === "gemini-cli") {
    if (readinessState === "ready") {
      return {
        title: "Gemini CLI is ready",
        description: "This group has the model and runtime access it needs.",
        detail: "",
      };
    }
    if (!selectedModel || readinessState === "model_required") {
      return {
        title: "Choose a Gemini model",
        description: "Pick the Gemini CLI model you want first.",
        detail: "",
      };
    }
    return {
      title: "Gemini credential required",
      description: "Either paste a Gemini API key below, or login with Gemini CLI and refresh verification.",
      detail: catalog?.login_hint ?? "",
    };
  }

  if (!selectedModel || readinessState === "model_required") {
    return {
      title: "Choose a model",
      description: "Pick the model that should control every human in this group.",
      detail: "The credential field will appear automatically after model selection.",
    };
  }

  if (provider === "groq") {
    if (readinessState === "ready") {
      return {
        title: "Groq model verified",
        description: "The selected Groq model is ready to provide ultra-fast inference for this group.",
        detail: selectedModel ? `Selected model: ${selectedModel}.` : "",
      };
    }
    return {
      title: "Choose a Groq model",
      description: "Pick a high-performance Llama 3 or Mixtral model from Groq.",
      detail: "",
    };
  }

  if (readinessState === "missing_api_key") {
    return {
      title: "Credential required",
      description: `Inherit ${providerDisplayName(provider)} key from the Connection tab.`,
      detail: `Ensure the global API key for ${providerDisplayName(provider)} is configured.`,
    };
  }


  if (readinessState === "ready") {
    return {
      title: `${providerDisplayName(provider)} is ready`,
      description: "This group has both a selected model and the credential it needs.",
      detail: "",
    };
  }

  return {
    title: `Controller status: ${formatReadinessState(readinessState)}`,
    description: controllerReadiness({ provider, model: selectedModel }, catalog).message,
    detail: "",
  };
}

function buildUnifiedModelEntries({ catalog, opencodeCatalog, controller }) {
  const entries = [];
  const seen = new Set();

  function addEntry(entry) {
    const provider = String(entry.provider ?? "").trim();
    const model = String(entry.model ?? "");
    const key = `${provider}::${model || "__none__"}`;
    if (!provider || seen.has(key)) {
      return;
    }
    seen.add(key);
    entries.push({
      key,
      provider,
      model,
      label: entry.label || model || providerDisplayName(provider),
      category: entry.category || providerDisplayName(provider),
      providerLabel: entry.providerLabel || providerDisplayName(provider),
      sourceType: entry.sourceType || "",
      sourceBadge: entry.sourceBadge || "",
      description: entry.description || "",
      runtimeStatus: entry.runtimeStatus || "",
    });
  }

  addEntry({
    provider: "heuristic",
    model: "",
    label: "Heuristic (debug)",
    category: "Debug",
    providerLabel: "Heuristic",
    description: "Local fallback for smoke tests and offline debugging.",
  });

  const opencodeEntries = Array.isArray(opencodeCatalog?.model_entries) ? opencodeCatalog.model_entries : [];
  const opencodeEntryMap = new Map();
  const isOpenCodeConnected = opencodeCatalog?.health_state === "ready" || opencodeCatalog?.health_state === "rate_limited";

  for (const entry of opencodeEntries) {
    const model = String(entry?.id ?? entry?.model ?? "").trim();
    if (!model) {
      continue;
    }
    opencodeEntryMap.set(model, entry);
  }

  for (const model of OPENCODE_ZEN_MODELS) {
    const entry = opencodeEntryMap.get(model);
    addEntry({
      provider: "opencode",
      model,
      label: entry?.label || buildOpencodeModelLabel(model),
      category: isOpenCodeConnected ? "OpenCode runtime" : "OpenCode (connect to see)",
      providerLabel: "OpenCode CLI",
      sourceType: entry?.source_type || "hosted",
      sourceBadge: entry?.source_type === "provider_backed" ? "Connected provider" : "Hosted by OpenCode",
      runtimeStatus: entry?.runtime_status || "",
      description: isOpenCodeConnected 
        ? (entry?.source_type === "provider_backed" ? "Runs through OpenCode using a connected provider." : "Runs through the OpenCode Zen runtime.")
        : "Connect in the panel above to see models",
    });
  }

  for (const entry of opencodeEntries) {
    const model = String(entry?.id ?? entry?.model ?? "").trim();
    if (!model) {
      continue;
    }
    addEntry({
      provider: "opencode",
      model,
      label: entry?.label || buildOpencodeModelLabel(model),
      category: "OpenCode runtime",
      providerLabel: "OpenCode CLI",
      sourceType: entry?.source_type || (model.startsWith("opencode/") ? "hosted" : "provider_backed"),
      sourceBadge: entry?.source_type === "provider_backed" ? "Connected provider" : "Hosted by OpenCode",
      runtimeStatus: entry?.runtime_status || "",
      description: entry?.source_type === "provider_backed" ? "Runs through OpenCode using a connected provider." : "Runs through the OpenCode Zen runtime.",
    });
  }

  const nativeModelGroups = [
    {
      provider: "gemini-cli",
      category: "Gemini CLI",
      providerLabel: "Gemini CLI",
      models: [...GEMINI_MODELS, ...((catalog?.provider === "gemini-cli" ? catalog?.models : []) ?? []), ...((controller?.provider === "gemini-cli" ? controller?.availableModels : []) ?? [])],
      description: "Uses Gemini CLI login or a Gemini API key for this group.",
    },
    {
      provider: "gemini-api",
      category: "Gemini API",
      providerLabel: "Gemini API",
      models: [...GEMINI_API_MODELS, ...((catalog?.provider === "gemini-api" ? catalog?.models : []) ?? []), ...((controller?.provider === "gemini-api" ? controller?.availableModels : []) ?? [])],
      description: "Uses a direct Gemini API key.",
    },
    {
      provider: "openai",
      category: "OpenAI",
      providerLabel: "OpenAI API",
      models: [...OPENAI_MODELS, ...((catalog?.provider === "openai" ? catalog?.models : []) ?? []), ...((controller?.provider === "openai" ? controller?.availableModels : []) ?? [])],
      description: "Uses a direct OpenAI API key.",
    },
    {
      provider: "anthropic",
      category: "Anthropic",
      providerLabel: "Anthropic API",
      models: [...ANTHROPIC_MODELS, ...((catalog?.provider === "anthropic" ? catalog?.models : []) ?? []), ...((controller?.provider === "anthropic" ? controller?.availableModels : []) ?? [])],
      description: "Uses a direct Anthropic API key.",
    },
    {
      provider: "groq",
      category: "Groq",
      providerLabel: "Groq API",
      models: [...GROQ_MODELS, ...((catalog?.provider === "groq" ? catalog?.models : []) ?? []), ...((controller?.provider === "groq" ? controller?.availableModels : []) ?? [])],
      description: "Uses a direct Groq API key for ultra-fast inference.",
    },
  ];

  for (const group of nativeModelGroups) {
    for (const model of Array.from(new Set(group.models.filter(Boolean).map(String)))) {
      addEntry({
        provider: group.provider,
        model,
        label: model,
        category: group.category,
        providerLabel: group.providerLabel,
        description: group.description,
      });
    }
  }

  return entries;
}

// assembleControllerEntries was deprecated in favor of buildUnifiedModelEntries


function describeCredentialPanel(provider, selectedModel, selectedEntry) {
  if (!selectedModel && provider !== "heuristic") {
    return "Choose a model first. The correct credential or verification flow will appear automatically.";
  }
  if (provider === "opencode") {
    return "This model runs through OpenCode. Paste the Zen key only when you need to connect or reconnect the shared runtime.";
  }
  if (provider === "gemini-cli") {
    return "You can either paste a Gemini key for this group or use your existing Gemini CLI login.";
  }
  if (providerUsesApiKey(provider)) {
    return `This model uses a direct ${providerDisplayName(provider)} key for this group.`;
  }
  if (provider === "heuristic") {
    return "No credential is required for the local heuristic debug controller.";
  }
  return selectedEntry?.description || "Provide the credential required by the selected model.";
}

function buildApiKeyLabel(provider) {
  if (provider === "openai") return "OpenAI API key";
  if (provider === "anthropic") return "Anthropic API key";
  if (provider === "gemini-api") return "Gemini API key";
  if (provider === "groq") return "Groq API key";
  return "API key";
}

function describeProviderRoute(provider) {
  if (provider === "opencode") {
    return "Connect through OpenCode, then verify the selected OpenCode model.";
  }
  if (provider === "gemini-cli") {
    return "Use Gemini CLI login in your terminal, or provide a Gemini API key for this group.";
  }
  if (providerUsesApiKey(provider)) {
    return `Provide a ${buildApiKeyLabel(provider)} for this group.`;
  }
  if (provider === "heuristic") {
    return "No external connection is required.";
  }
  return "Choose the provider first, then connect it.";
}

function ProviderModelChooser({
  provider,
  currentModel,
  catalog,
  opencodeCatalog,
  onSelect,
}) {
  const [query, setQuery] = useState("");
  
  const entries = useMemo(
    () => buildUnifiedModelEntries({ catalog, opencodeCatalog, provider, controller: { provider, availableModels: [] } }),
    [provider, catalog, opencodeCatalog, currentModel]
  );
  
  const selectedEntry = entries.find((e) => e.model === currentModel && e.provider === provider);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredEntries = entries.filter((entry) => {
    // ── FILTER BY PROVIDER ──
    if (entry.provider !== provider) {
      return false;
    }
    
    // ── FILTER BY SEARCH QUERY ──
    if (!normalizedQuery) {
      return true;
    }
    const haystack = [
      entry.label,
      entry.model,
      entry.category,
      entry.providerLabel,
      entry.description,
      entry.sourceBadge,
    ].join(" ").toLowerCase();
    return haystack.includes(normalizedQuery);
  });

  const groupedEntries = filteredEntries.reduce((accumulator, entry) => {
    if (!accumulator.has(entry.category)) {
      accumulator.set(entry.category, []);
    }
    accumulator.get(entry.category).push(entry);
    return accumulator;
  }, new Map());

  return (
    <div className="grid gap-2">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              {selectedEntry?.label || currentModel || "No model selected"}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {selectedEntry
                ? `${selectedEntry.providerLabel} will control every human in this group using ${selectedEntry.label}.`
                : `Choose the ${providerDisplayName(provider)} model that should control this group.`}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px]">
            {selectedEntry?.providerLabel ?? providerDisplayName(provider)}
          </Badge>
        </div>

        <div className="relative mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            placeholder="Search by model, provider, or runtime"
            onChange={(event) => setQuery(event.target.value)}
            className="pl-9 h-9 bg-black/20"
          />
        </div>

        <ScrollArea className="mt-3 h-64 rounded-xl border border-white/10 bg-black/20">
          <div className="p-2">
            {!filteredEntries.length ? (
              <div className="rounded-xl px-3 py-3 text-sm text-zinc-500">
                No models match this search.
              </div>
            ) : null}
            {Array.from(groupedEntries.entries()).map(([category, groupEntries]) => (
              <ModelCategorySection
                key={category}
                title={category}
                entries={groupEntries}
                selectedProvider={provider}
                selectedModel={currentModel}
                onSelect={onSelect}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ModelCategorySection({ title, entries, selectedProvider, selectedModel, onSelect }) {
  if (!entries.length) {
    return null;
  }
  return (
    <div className="mb-3">
      <p className="mb-2 px-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      {entries.map((entry) => {
        const active = entry.provider === selectedProvider && entry.model === selectedModel;
        return (
          <button
            key={`${entry.provider}-${entry.model}`}
            type="button"
            onClick={() => onSelect(entry.provider, entry.model)}
            className={`mb-1 flex w-full items-start justify-between rounded-xl px-3 py-3 text-left transition-colors ${
              active
                ? "bg-white/[0.12] text-white"
                : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <div className="pr-3">
              <div className="break-all text-sm font-medium">{entry.label}</div>
              <p className="mt-1 text-xs leading-5 text-zinc-500">{entry.description}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge variant="muted" className="text-[10px]">
                  {entry.providerLabel}
                </Badge>
                {entry.sourceBadge ? (
                  <Badge variant="outline" className="text-[10px]">
                    {entry.sourceBadge}
                  </Badge>
                ) : null}
                {entry.runtimeStatus && entry.runtimeStatus !== "unverified" ? (
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      entry.runtimeStatus === "ready"
                        ? "border-emerald-500/30 text-emerald-100"
                        : "border-amber-500/30 text-amber-100"
                    }`}
                  >
                    {entry.provider === "opencode" ? formatOpenCodeStatus(entry.runtimeStatus) : formatReadinessState(entry.runtimeStatus)}
                  </Badge>
                ) : null}
              </div>
            </div>
            {active ? (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                Selected
              </Badge>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function HumanRosterEditor({ group, onUpdateHuman, nameValidation, onRegenerateDuplicateNames }) {
  const humans = group?.humans ?? [];
  const [selectedHumanId, setSelectedHumanId] = useState(humans[0]?.id ?? null);

  useEffect(() => {
    if (!humans.length) {
      setSelectedHumanId(null);
      return;
    }
    if (!humans.some((human) => human.id === selectedHumanId)) {
      setSelectedHumanId(humans[0].id);
    }
  }, [humans, selectedHumanId]);

  const selectedHuman = humans.find((human) => human.id === selectedHumanId) ?? humans[0] ?? null;
  const selectedIndex = selectedHuman ? humans.findIndex((human) => human.id === selectedHuman.id) : -1;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-zinc-100">Identity & Personas</h4>
          <p className="text-sm text-zinc-400">
            Review and customize the traits that shape each human's AI decision-making.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {humans.length} humans
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/4 bg-white/3">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-xs font-medium text-zinc-200">Roster</p>
            <p className="text-[11px] text-zinc-500">Select a human from the roster to customize their behavior.</p>
          </div>
          <ScrollArea className="h-[320px]">
            <div className="space-y-2 p-3">
              {humans.map((human) => {
                const active = human.id === selectedHuman?.id;
                const issue = nameValidation?.byHumanId?.[human.id] ?? null;
                return (
                  <button
                    key={human.id}
                    type="button"
                    onClick={() => setSelectedHumanId(human.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                      active
                        ? "border-white/30 bg-white/12"
                        : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium text-zinc-100">{human.name}</p>
                      <span className={`text-[10px] ${issue ? "text-red-300" : "text-zinc-500"}`}>
                        {issue ? issue.type.replaceAll("_", " ") : `#${human.id.split("-").pop()}`}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-zinc-400">
                      {human.persona_summary || "No persona summary yet."}
                    </p>
                    {issue ? (
                      <p className="mt-2 text-[11px] leading-4 text-red-200">{issue.message}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-1">
                      <Badge variant="muted" className="text-[10px]">
                        {human.social_style || "social"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {human.resource_bias || "resource"}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {selectedHuman ? (
          <div className="rounded-2xl border border-white/4 bg-white/3 p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-100">{selectedHuman.name}</p>
                <p className="text-[11px] text-zinc-500">
                  Editing human {selectedIndex + 1} of {humans.length} · {selectedHuman.id}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={selectedIndex <= 0}
                  onClick={() => setSelectedHumanId(humans[Math.max(0, selectedIndex - 1)]?.id ?? selectedHuman.id)}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={selectedIndex < 0 || selectedIndex >= humans.length - 1}
                  onClick={() => setSelectedHumanId(humans[Math.min(humans.length - 1, selectedIndex + 1)]?.id ?? selectedHuman.id)}
                >
                  Next
                </Button>
              </div>
            </div>

            {nameValidation?.byHumanId?.[selectedHuman.id] ? (
              <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-100">
                <p className="font-medium">{nameValidation.byHumanId[selectedHuman.id].message}</p>
                <Button variant="outline" size="sm" className="mt-2 border-red-500/30 bg-transparent text-red-100 hover:bg-red-500/20" onClick={onRegenerateDuplicateNames}>
                  Regenerate duplicate names
                </Button>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledField label="Human name">
                <Input value={selectedHuman.name ?? ""} onChange={(event) => onUpdateHuman(group.id, selectedHuman.id, { name: event.target.value })} />
              </LabeledField>
              <LabeledField label="Social style">
                <Input value={selectedHuman.social_style ?? ""} onChange={(event) => onUpdateHuman(group.id, selectedHuman.id, { social_style: event.target.value })} />
              </LabeledField>
              <LabeledField label="Resource bias">
                <Input value={selectedHuman.resource_bias ?? ""} onChange={(event) => onUpdateHuman(group.id, selectedHuman.id, { resource_bias: event.target.value })} />
              </LabeledField>
              <LabeledField label="Starting drive">
                <Input value={selectedHuman.starting_drive ?? ""} onChange={(event) => onUpdateHuman(group.id, selectedHuman.id, { starting_drive: event.target.value })} />
              </LabeledField>
              <div className="sm:col-span-2">
                <LabeledField label="Persona summary">
                  <Input value={selectedHuman.persona_summary ?? ""} onChange={(event) => onUpdateHuman(group.id, selectedHuman.id, { persona_summary: event.target.value })} />
                </LabeledField>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-6 text-sm text-zinc-500">
            Add a group population to start editing human personas.
          </div>
        )}
      </div>
    </div>
  );
}

function InlineCommand({ label, value }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/3 p-2">

      <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-zinc-300">{value || "Unavailable"}</pre>
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

function InlineConnectionPanel({
  provider,
  controller,
  catalog,
  opencodeCatalog,
  onPatchController,
  onUpdateProviderConnection,
  onRefreshCatalogs,
  onConnectOpencode,
  globalProviders,
}) {
  const [connecting, setConnecting] = useState(false);
  const [localApiKey, setLocalApiKey] = useState(controller?.apiKey ?? "");
  const [localBaseUrl, setLocalBaseUrl] = useState(controller?.baseUrl ?? "");

  useEffect(() => {
    setLocalApiKey(controller?.apiKey ?? "");
    setLocalBaseUrl(controller?.baseUrl ?? "");
  }, [controller?.apiKey, controller?.baseUrl]);

  if (provider === "heuristic") {
    return (
      <div className="rounded-xl border border-white/6 bg-white/2 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-zinc-500" />
          <span className="text-[11px] text-zinc-400">Local heuristic — no connection needed</span>
        </div>
      </div>
    );
  }

  const isOpenCode = provider === "opencode";
  const needsApiKey = providerUsesApiKey(provider) || isOpenCode;
  const needsBaseUrl = providerSupportsBaseUrl(provider);

  const effectiveCatalog = isOpenCode ? opencodeCatalog : catalog;
  const healthState = effectiveCatalog?.health_state;
  
  // For OpenCode: check healthState. For direct API: check if we have API key
  const controllerHasApiKey = Boolean(controller?.apiKey?.trim());
  const inputHasApiKey = Boolean(localApiKey.trim());
  const isConnected = isOpenCode
    ? healthState === "ready" || healthState === "rate_limited" || healthState === "model_required"
    : controllerHasApiKey || inputHasApiKey;

  const handleConnect = async () => {
    if (!localApiKey.trim()) {
      alert("Please enter an API key first");
      return;
    }
    setConnecting(true);
    try {
      if (isOpenCode) {
        await onConnectOpencode?.(localApiKey);
        onRefreshCatalogs?.();
      } else {
        // Save API key to controller
        onPatchController({ apiKey: localApiKey, baseUrl: localBaseUrl });
        // Update global provider connection (stores key and refreshes catalog)
        if (onUpdateProviderConnection) {
          await onUpdateProviderConnection(provider, { apiKey: localApiKey, baseUrl: localBaseUrl });
        }
        // Trigger catalog refresh for this group
        if (onRefreshCatalogs) {
          onRefreshCatalogs();
        }
      }
    } catch (err) {
      alert("Connection error: " + err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleClear = () => {
    setLocalApiKey("");
    setLocalBaseUrl("");
    if (isOpenCode) {
      onPatchController({ apiKey: "", baseUrl: "" });
    } else {
      onPatchController({ apiKey: "", baseUrl: "" });
    }
  };

  if (!needsApiKey) {
    return (
      <div className="rounded-xl border border-white/6 bg-white/2 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="size-2 rounded-full bg-amber-400" />
          <span className="text-[11px] text-zinc-400">Login required — click to authenticate</span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`size-2 rounded-full ${isConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
          <span className="text-[11px] text-zinc-400">
            {isConnected ? `${providerDisplayName(provider)} connected` : "Not connected"}
          </span>
        </div>
        {isConnected && (
          <Button variant="ghost" size="sm" onClick={handleClear} className="h-6 text-[10px] text-zinc-400 hover:text-red-300">
            Clear
          </Button>
        )}
      </div>

      <div className="grid gap-2">
        <Input
          type="password"
          placeholder={`${providerDisplayName(provider)} API key (sk-...)`}
          value={localApiKey}
          onChange={(e) => setLocalApiKey(e.target.value)}
          className="h-9 bg-black/20 text-sm"
        />
        {needsBaseUrl && (
          <Input
            placeholder="Proxy / Base URL (optional)"
            value={localBaseUrl}
            onChange={(e) => setLocalBaseUrl(e.target.value)}
            className="h-9 bg-black/20 text-sm"
          />
        )}
      </div>

      <Button
        onClick={handleConnect}
        disabled={!localApiKey.trim() || connecting}
        className="w-full"
        size="sm"
      >
        {connecting ? "Connecting..." : isConnected ? "Update Connection" : "Connect"}
      </Button>

      {healthState && !isConnected && healthState !== "not_connected" && (
        <div className="text-[10px] text-amber-300">
          Status: {formatOpenCodeStatus(healthState)}
        </div>
      )}
    </div>
  );
}

function ConnectionSourceBadge({ provider, globalProviders, opencodeCatalog }) {
  if (provider === "heuristic") {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/2 px-3 py-2">
        <div className="size-2 rounded-full bg-zinc-500" />
        <span className="text-[11px] text-zinc-400">Local heuristic — no connection needed</span>
      </div>
    );
  }
  if (provider === "opencode") {
    const ocHealth = opencodeCatalog?.health_state ?? "not_connected";
    const connected = ocHealth === "ready" || ocHealth === "rate_limited" || ocHealth === "model_required";
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/2 px-3 py-2">
        <div className={`size-2 rounded-full ${connected ? "bg-blue-400" : "bg-amber-400"}`} />
        <span className="text-[11px] text-zinc-400">
          {connected ? "Using OpenCode Zen connection" : "OpenCode Zen not connected — go to Step 1"}
        </span>
      </div>
    );
  }
  if (DIRECT_API_PROVIDERS.includes(provider)) {
    const hasKey = Boolean(globalProviders?.apiKey);
    return (
      <div className="flex items-center gap-2 rounded-xl border border-white/6 bg-white/2 px-3 py-2">
        <div className={`size-2 rounded-full ${hasKey ? "bg-emerald-400" : "bg-amber-400"}`} />
        <span className="text-[11px] text-zinc-400">
          {hasKey
            ? `Using global ${providerDisplayName(provider)} key`
            : `No ${providerDisplayName(provider)} key configured — add one in Step 1`}
        </span>
      </div>
    );
  }
  return null;
}

function ReviewPanel({
  settings,
  groups,
  providerCatalogs,
  opencodeCatalog,
  population,
  populationOver,
  nameValidation,
  busy,
  onSaveSettings,
  onGenerateWorld,
  onTabChange,
}) {
  const providers = settings.providers ?? {};
  const allReady = groups.length > 0 && groups.every((g) => {
    const status = controllerReadiness(g.controller, providerCatalogs[`group:${g.id}`] ?? null, providers);
    return status.state === "ready";
  });
  const canRun = allReady && !populationOver && (nameValidation?.valid !== false);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-zinc-100">Review & Run</h3>
        <p className="text-sm text-zinc-400">Verify all groups are configured, then save and run your simulation.</p>
      </div>

      {/* ── READINESS SUMMARY ── */}
      <Card className="border-white/10 bg-linear-to-br from-white/5 to-transparent backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
        <CardContent className="p-5 space-y-4">
          <div className={`flex items-center gap-3 rounded-xl p-4 ${
            canRun
              ? "border border-emerald-500/20 bg-emerald-500/8"
              : "border border-amber-500/20 bg-amber-500/8"
          }`}>
            <div className={`flex size-10 items-center justify-center rounded-xl ${
              canRun ? "bg-emerald-500/15" : "bg-amber-500/15"
            }`}>
              {canRun
                ? <Check className="size-5 text-emerald-300" />
                : <AlertTriangle className="size-5 text-amber-300" />}
            </div>
            <div>
              <p className={`text-sm font-semibold ${canRun ? "text-emerald-100" : "text-amber-100"}`}>
                {canRun ? "All systems ready" : "Setup incomplete"}
              </p>
              <p className={`text-xs ${canRun ? "text-emerald-200/60" : "text-amber-200/60"}`}>
                {canRun
                  ? `${groups.length} groups, ${population} humans — ready to stream.`
                  : "Fix the issues below before running."}
              </p>
            </div>
          </div>

          {/* ── GROUP STATUS LIST ── */}
          <div className="space-y-2">
            {groups.map((group) => {
              const status = controllerReadiness(group.controller, providerCatalogs[`group:${group.id}`] ?? null, providers);
              const isReady = status.state === "ready";
              return (
                <div key={group.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/6 bg-white/2 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-4 rounded-md border border-white/10" style={{ backgroundColor: group.color }} />
                    <div>
                      <p className="text-sm font-medium text-zinc-100">{group.name}</p>
                      <p className="text-[11px] text-zinc-500">
                        {group.population_count} humans · {group.controller?.model || providerDisplayName(group.controller?.provider ?? "heuristic")}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={isReady ? "default" : "outline"}
                    className={isReady
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-100 text-[10px]"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-100 text-[10px]"
                    }
                  >
                    {isReady ? "● Ready" : formatReadinessState(status.state)}
                  </Badge>
                </div>
              );
            })}
          </div>

          {!groups.length ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-6 text-center text-sm text-zinc-500">
              No groups configured. <button type="button" className="text-zinc-300 underline" onClick={() => onTabChange("groups")}>Add a group</button> first.
            </div>
          ) : null}

          {populationOver ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-100">
              <p className="font-medium">Population exceeds strict limit ({population} / {STRICT_MAX_TOTAL_POPULATION}).</p>
              <p className="mt-1 text-red-200/80">Remove humans from groups in <button type="button" className="underline" onClick={() => onTabChange("groups")}>Step 2</button>.</p>
            </div>
          ) : null}

          {nameValidation?.valid === false ? (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-100">
              <p className="font-medium">Name validation failed.</p>
              <p className="mt-1 text-red-200/80">{nameValidation.message}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* ── ACTIONS ── */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onGenerateWorld} disabled={busy}>Generate world</Button>
        <Button className="flex-1" onClick={onSaveSettings} disabled={busy || !nameValidation?.valid}>Save settings</Button>
      </div>
    </div>
  );
}
