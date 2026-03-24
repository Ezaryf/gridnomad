"use client";

import { useEffect, useMemo, useState } from "react";

import { KeyRound, Plus, Search, Settings2, UserRoundCog } from "lucide-react";

import {
  controllerReadiness,
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
  busy,
  onUpdateWorld,
  onAddGroup,
  onDeleteGroup,
  onUpdateGroup,
  onUpdateHuman,
  onUpdateGroupController,
  onSaveSettings,
  onGenerateWorld,
  onRefreshProviderCatalog,
  onProviderChange,
  onProviderCredentialChange,
  onProviderModelChange,
  onLaunchProviderLogin,
  onCreateOpencodeHome,
  onCopyCommand,
  nameValidation,
  onRegenerateDuplicateNames
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
                  <LabeledField label="Run duration (sec)">
                    <Input type="number" min="10" max="1800" value={settings.world?.run_duration_seconds ?? 80} onChange={(event) => onUpdateWorld({ run_duration_seconds: Number(event.target.value) })} />
                  </LabeledField>
                  <LabeledField label="Playback speed">
                    <Select value={String(settings.world?.playback_speed ?? 1)} onValueChange={(value) => onUpdateWorld({ playback_speed: Number(value) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1x</SelectItem>
                        <SelectItem value="2">2x</SelectItem>
                        <SelectItem value="4">4x</SelectItem>
                      </SelectContent>
                    </Select>
                  </LabeledField>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="groups" className="m-0 px-6 py-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-zinc-100">Human groups</h3>
                  <p className="text-sm text-zinc-400">Each group is a community. Every human inside it inherits the same AI controller. Strict AI-only mode is designed for up to 8 humans total.</p>
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
                      {(nameValidation?.byGroupId?.[group.id] ?? []).length ? (
                        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-100">
                          Duplicate or missing names in this group: {(nameValidation.byGroupId[group.id] ?? []).map((item) => item.name || item.human_id).join(", ")}
                        </div>
                      ) : null}

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
                        group={group}
                        controller={group.controller}
                        catalog={providerCatalogs[`group:${group.id}`]}
                        onRefreshProviderCatalog={(provider, credential = "") => onRefreshProviderCatalog("group", group.id, provider, {
                          credential,
                          cliHome: group.controller?.cliHome ?? "",
                          googleCloudProject: group.controller?.googleCloudProject ?? "",
                          model: group.controller?.model ?? "",
                        })}
                        onProviderChange={(provider) => onProviderChange(group.id, provider)}
                        onCredentialChange={(credential) => onProviderCredentialChange(group.id, credential)}
                        onModelChange={(model) => onProviderModelChange(group.id, model)}
                        onUpdateController={(patch) => onUpdateGroupController(group.id, patch)}
                        onLaunchProviderLogin={onLaunchProviderLogin}
                        onCreateOpencodeHome={() => onCreateOpencodeHome(group.id)}
                        onCopyCommand={onCopyCommand}
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
          </ScrollArea>

          <SheetFooter className="border-t border-white/20 px-6 py-4 sm:justify-between">
            <div className="text-sm text-zinc-500">
              Save to persist the human-group setup, or generate immediately to preview the world.
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
  title,
  subtitle,
  group,
  controller,
  catalog,
  onRefreshProviderCatalog,
  onProviderChange,
  onCredentialChange,
  onModelChange,
  onUpdateController,
  onLaunchProviderLogin,
  onCreateOpencodeHome,
  onCopyCommand
}) {
  const provider = controller?.provider ?? "heuristic";
  const effectiveCatalog = catalog?.provider === provider || !catalog?.provider ? catalog : null;
  const models = effectiveCatalog?.models?.length ? effectiveCatalog.models : controller?.availableModels ?? [];
  const modelEntries = effectiveCatalog?.model_entries ?? [];
  const credentials = effectiveCatalog?.credentials ?? [];
  const healthState = effectiveCatalog?.health_state ?? effectiveCatalog?.auth_status ?? "local";
  const needsOpencodeLogin = provider === "opencode" && (healthState === "login_required" || healthState === "connected_no_models");
  const readiness = controllerReadiness(controller, effectiveCatalog);
  const setupGuide = describeControllerSetup(provider, readiness.state, effectiveCatalog);
  const showAdvancedCatalog = Boolean(effectiveCatalog?.stdout || effectiveCatalog?.stderr || effectiveCatalog?.manual_commands?.powershell?.login);
  const [modelQuery, setModelQuery] = useState("");
  const selectedModel = controller?.model ?? "";

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-zinc-100">{title}</h4>
          <p className="text-sm text-zinc-400">{subtitle}.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="muted">{providerDisplayName(provider)}</Badge>
          <Badge variant="default" className={readiness.state === "ready" ? "text-[10px]" : "border-red-500/40 bg-red-500/10 text-[10px] text-red-200"}>{formatReadinessState(readiness.state)}</Badge>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-zinc-400">
          <p className="font-medium text-zinc-200">{setupGuide.title}</p>
          <p>{setupGuide.description}</p>
          {setupGuide.detail ? <p className="mt-1 text-zinc-500">{setupGuide.detail}</p> : null}
        </div>

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

        {provider === "opencode" ? (
          <>
            <div className="sm:col-span-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-zinc-100">OpenCode wizard</p>
                  <p className="mt-1 text-xs leading-5 text-zinc-400">{setupGuide.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {effectiveCatalog?.environment_source === "managed-home" ? "isolated home" : "user-global home"}
                  </Badge>
                  <Badge variant={readiness.state === "ready" ? "default" : "outline"} className={readiness.state === "ready" ? "text-[10px]" : "border-amber-500/30 bg-amber-500/10 text-[10px] text-amber-100"}>
                    {formatOpenCodeStatus(readiness.state)}
                  </Badge>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <WizardStep
                  label="1. Connect"
                  active={["login_required", "not_installed"].includes(readiness.state)}
                  complete={!["login_required", "not_installed"].includes(readiness.state)}
                  text={effectiveCatalog?.environment_source === "managed-home" ? "Using isolated OpenCode home." : "Using user-global OpenCode home."}
                />
                <WizardStep
                  label="2. Choose model"
                  active={!selectedModel}
                  complete={Boolean(selectedModel)}
                  text={selectedModel ? buildOpencodeModelLabel(selectedModel) : "Pick a hosted or provider-backed model."}
                />
                <WizardStep
                  label="3. Verify runtime"
                  active={Boolean(selectedModel) && readiness.state !== "ready"}
                  complete={readiness.state === "ready"}
                  text={effectiveCatalog?.selected_model_status ? formatOpenCodeStatus(effectiveCatalog.selected_model_status) : "Run a smoke prompt against the selected model."}
                />
                <WizardStep
                  label="4. Ready"
                  active={readiness.state === "ready"}
                  complete={readiness.state === "ready"}
                  text={readiness.state === "ready" ? "This group can run now." : "Run stays blocked until the selected model is verified."}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {readiness.state === "login_required" ? (
                  <Button
                    onClick={() => onCopyCommand("OpenCode login command", effectiveCatalog?.manual_commands?.powershell?.login ?? "")}
                    disabled={!effectiveCatalog?.manual_commands?.powershell?.login}
                  >
                    <KeyRound className="size-4" />
                    Copy login command
                  </Button>
                ) : null}
                {selectedModel && readiness.state !== "ready" ? (
                  <Button onClick={() => onRefreshProviderCatalog("opencode", controller?.opencodeProvider ?? "")}>
                    Verify {buildOpencodeModelLabel(selectedModel)}
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => onRefreshProviderCatalog("opencode", controller?.opencodeProvider ?? "")}>Refresh OpenCode</Button>
                <Button variant="ghost" onClick={onCreateOpencodeHome}>Use isolated home</Button>
              </div>
              <div className="mt-3 text-xs leading-5 text-zinc-500">
                {effectiveCatalog?.login_hint ?? "Use your user-global OpenCode account or create an isolated OpenCode home if you want GridNomad to use a separate OpenCode environment."}
              </div>
              {effectiveCatalog?.selected_model_error_category ? (
                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
                  {formatSelectedModelError(effectiveCatalog.selected_model_error_category, effectiveCatalog?.decision_probe?.error)}
                </div>
              ) : null}
            </div>
            <div className="sm:col-span-2">
              <ModelChooser
                label="Choose model"
                provider={provider}
                models={models}
                modelEntries={modelEntries}
                value={selectedModel}
                query={modelQuery}
                onQueryChange={setModelQuery}
                onSelect={onModelChange}
              />
            </div>
            {credentials.length > 0 ? (
            <LabeledField label="Credential">
              <Select value={controller?.opencodeProvider || "__empty__"} onValueChange={(value) => onCredentialChange(value === "__empty__" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Choose credential" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__empty__">Default credential</SelectItem>
                  {credentials.map((credential) => (
                    <SelectItem key={credential} value={credential}>{credential}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </LabeledField>
            ) : null}
            {showAdvancedCatalog ? (
              <details className="sm:col-span-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
                <summary className="cursor-pointer text-zinc-200">Advanced OpenCode details</summary>
                {effectiveCatalog?.manual_commands?.powershell?.login ? (
                <div className="mt-3">
                <p className="mb-2 text-xs leading-5 text-zinc-400">
                  Default setup uses your user-global OpenCode account. If you want an isolated account cache just for GridNomad, create an isolated home, run the copied login command in your own terminal, finish login, then refresh.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <InlineCommand label="PowerShell login" value={effectiveCatalog.manual_commands.powershell.login} />
                  <InlineCommand label="Command Prompt login" value={effectiveCatalog.manual_commands.cmd?.login ?? ""} />
                  <InlineCommand label="Verify auth" value={effectiveCatalog.manual_commands.powershell.verify} />
                  <InlineCommand label="List models" value={effectiveCatalog.manual_commands.powershell.models} />
                </div>
                </div>
                ) : null}
                {effectiveCatalog?.stdout ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Stdout</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-zinc-300">{effectiveCatalog.stdout}</pre>
                  </div>
                ) : null}
                {effectiveCatalog?.stderr ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Stderr</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-zinc-300">{effectiveCatalog.stderr}</pre>
                  </div>
                ) : null}
              </details>
            ) : null}
          </>
        ) : null}

        {provider === "gemini-cli" ? (
          <>
            <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-zinc-400">
              <p className="font-medium text-zinc-200">Gemini CLI status: {formatReadinessState(healthState)}</p>
              <p>{effectiveCatalog?.login_hint ?? "Use your Google account in Gemini CLI, then refresh status and models."}</p>
              {effectiveCatalog?.gemini_path ? <p className="mt-1 text-zinc-500">CLI executable: {effectiveCatalog.gemini_path}</p> : null}
              {effectiveCatalog?.resolved_cli_home ? <p className="mt-1 text-zinc-500">User-global home: {effectiveCatalog.resolved_cli_home}</p> : null}
              {controller?.googleCloudProject ? <p className="mt-1 text-zinc-500">Google Cloud Project: {controller.googleCloudProject}</p> : null}
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
              <Button
                variant="outline"
                onClick={() => onCopyCommand("Gemini CLI login command", effectiveCatalog?.manual_commands?.powershell?.login ?? "")}
                disabled={!effectiveCatalog?.manual_commands?.powershell?.login}
              >
                <KeyRound className="size-4" />
                Copy login command
              </Button>
              <Button
                variant="outline"
                onClick={() => onCopyCommand("Gemini CLI verify command", effectiveCatalog?.manual_commands?.powershell?.verify ?? "")}
                disabled={!effectiveCatalog?.manual_commands?.powershell?.verify}
              >
                Copy verify command
              </Button>
              <Button variant="outline" onClick={() => onRefreshProviderCatalog("gemini-cli", "")}>Refresh Gemini CLI</Button>
            </div>
            {showAdvancedCatalog ? (
              <details className="sm:col-span-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
                <summary className="cursor-pointer text-zinc-200">Advanced Gemini CLI details</summary>
                {effectiveCatalog?.manual_commands?.powershell?.login ? (
                <div className="mt-3">
                <p className="mb-2 text-xs leading-5 text-zinc-400">
                  1. Copy the login command and run it in your own terminal. 2. Finish the Google login flow in the browser or terminal prompt. 3. Run the verify command if you want to confirm the CLI is responding. 4. Return here and refresh status and models.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <InlineCommand label="PowerShell login" value={effectiveCatalog.manual_commands.powershell.login} />
                  <InlineCommand label="Command Prompt login" value={effectiveCatalog.manual_commands.cmd?.login ?? ""} />
                  <InlineCommand label="Verify auth" value={effectiveCatalog.manual_commands.powershell.verify} />
                </div>
                </div>
                ) : null}
                {effectiveCatalog?.stdout ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Stdout</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-zinc-300">{effectiveCatalog.stdout}</pre>
                  </div>
                ) : null}
                {effectiveCatalog?.stderr ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Stderr</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-zinc-300">{effectiveCatalog.stderr}</pre>
                  </div>
                ) : null}
              </details>
            ) : null}
          </>
        ) : null}

        {providerUsesLogin(provider) && !["opencode", "gemini-cli"].includes(provider) ? (
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

        <details className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
          <summary className="cursor-pointer text-sm text-zinc-300">Advanced options</summary>
          <div className="mt-3 grid gap-4">
            <LabeledField label="Manual model override">
              <Input
                value={controller?.model ?? ""}
                placeholder="Optional custom model id"
                onChange={(event) => onUpdateController({ model: event.target.value })}
              />
            </LabeledField>
          </div>
        </details>
      </div>
    </div>
  );
}

function formatReadinessState(state) {
  return String(state ?? "unknown").replaceAll("_", " ");
}

function formatOpenCodeStatus(state) {
  if (state === "hosted_model_unavailable") return "Hosted model blocked";
  if (state === "provider_backed_model_unavailable") return "Provider-backed model blocked";
  if (state === "connected_no_models") return "Connected, no models";
  if (state === "model_required") return "Choose model";
  if (state === "login_required") return "Connect OpenCode";
  if (state === "ready") return "Ready to run";
  return formatReadinessState(state);
}

function formatSelectedModelError(category, fallback = "") {
  if (category === "quota_limited") return fallback || "This OpenCode-hosted model is currently rate limited or out of quota.";
  if (category === "auth_required") return fallback || "This model needs account access or login before it can run.";
  if (category === "provider_unavailable") return fallback || "This model is temporarily unavailable from OpenCode right now.";
  if (category === "network_issue") return fallback || "GridNomad could not reach OpenCode for this model.";
  if (category === "broken_environment") return fallback || "Your local OpenCode environment is broken.";
  return fallback || "This model could not answer the verification prompt.";
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

function describeControllerSetup(provider, readinessState, catalog) {
  if (provider === "opencode") {
    if (readinessState === "ready") {
      return {
        title: "OpenCode is ready",
        description: "Pick the model you want and run the simulation.",
        detail: catalog?.models_scope ? `Available models come from ${catalog.models_scope === "credential+base" ? "your account plus OpenCode base models" : catalog.models_scope === "base" ? "OpenCode's visible model list" : "the current OpenCode environment"}.` : ""
      };
    }
    if (readinessState === "model_required") {
      return {
        title: "Choose an OpenCode model",
        description: "Your OpenCode environment is available, but this group still needs a model selection before it can run.",
        detail: "Pick a hosted model such as MiniMax M2.5 Free or one of your connected provider-backed models."
      };
    }
    if (readinessState === "hosted_model_unavailable") {
      return {
        title: "Selected OpenCode-hosted model is blocked",
        description: "GridNomad found your selected hosted model, but OpenCode could not run it right now.",
        detail: catalog?.login_hint ?? ""
      };
    }
    if (readinessState === "provider_backed_model_unavailable") {
      return {
        title: "Selected provider-backed model is blocked",
        description: "GridNomad found your selected provider-backed model, but OpenCode could not run it right now.",
        detail: catalog?.login_hint ?? ""
      };
    }
    return {
      title: "Connect OpenCode in 2 steps",
      description: "1. Copy the login command and run it in your terminal. 2. Come back here and press Refresh OpenCode.",
      detail: catalog?.login_hint ?? ""
    };
  }

  if (provider === "gemini-cli") {
    if (readinessState === "ready") {
      return {
        title: "Gemini CLI is ready",
        description: "Pick the model you want and run the simulation.",
        detail: ""
      };
    }
    if (readinessState === "model_required") {
      return {
        title: "Choose a Gemini model",
        description: "Gemini CLI is connected, but this group still needs a model selection.",
        detail: ""
      };
    }
    return {
      title: "Connect Gemini CLI in 2 steps",
      description: "1. Copy the login command and run it in your terminal. 2. Come back here and press Refresh Gemini CLI.",
      detail: catalog?.login_hint ?? ""
    };
  }

  return {
    title: `Controller status: ${formatReadinessState(readinessState)}`,
    description: controllerReadiness({ provider }, catalog).message,
    detail: ""
  };
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
          <h4 className="text-base font-semibold text-zinc-100">Humans</h4>
          <p className="text-sm text-zinc-400">
            Each person gets a generated persona before any emergent role takes shape. Pick one human at a time to refine the identity hints the controller sees.
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {humans.length} humans
        </Badge>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-xs font-medium text-zinc-200">Roster</p>
            <p className="text-[11px] text-zinc-500">Click a person to edit their persona.</p>
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
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
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
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
      <p className="mb-1 text-[9px] uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-zinc-300">{value || "Unavailable"}</pre>
    </div>
  );
}

function ModelChooser({ label, provider, models, modelEntries = [], value, query, onQueryChange, onSelect }) {
  const filteredModels = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const pool = Array.from(new Set(models.filter(Boolean)));
    if (!normalizedQuery) {
      return pool;
    }
    return pool.filter((model) => model.toLowerCase().includes(normalizedQuery));
  }, [models, query]);
  const entryById = useMemo(() => new Map(modelEntries.map((entry) => [entry.id, entry])), [modelEntries]);
  const hostedModels = filteredModels.filter((model) => (entryById.get(model)?.source_type ?? "") === "hosted");
  const providerBackedModels = filteredModels.filter((model) => (entryById.get(model)?.source_type ?? "") === "provider_backed");
  const otherModels = filteredModels.filter((model) => !hostedModels.includes(model) && !providerBackedModels.includes(model));

  const selectedLabel = value || "No model selected";
  const providerLabel = providerDisplayName(provider);

  return (
    <div className="grid gap-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-zinc-100">{selectedLabel}</p>
            <p className="text-xs text-zinc-500">{providerLabel} controls every human in this group with this model.</p>
          </div>
          {value ? (
            <Button variant="ghost" size="sm" onClick={() => onSelect("")}>Clear</Button>
          ) : null}
        </div>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            placeholder="Search models"
            onChange={(event) => onQueryChange(event.target.value)}
            className="pl-9"
          />
        </div>
        <ScrollArea className="mt-3 h-48 rounded-xl border border-white/10 bg-black/20">
          <div className="p-2">
            {!filteredModels.length ? (
              <div className="rounded-xl px-3 py-2 text-sm text-zinc-500">No models match this search.</div>
            ) : null}
            <ModelSection title="OpenCode-hosted" models={hostedModels} entryById={entryById} value={value} onSelect={onSelect} />
            <ModelSection title="Connected provider models" models={providerBackedModels} entryById={entryById} value={value} onSelect={onSelect} />
            <ModelSection title="Other models" models={otherModels} entryById={entryById} value={value} onSelect={onSelect} />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ModelSection({ title, models, entryById, value, onSelect }) {
  if (!models.length) {
    return null;
  }
  return (
    <div className="mb-3">
      <p className="mb-2 px-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{title}</p>
      {models.map((model) => {
        const active = model === value;
        const entry = entryById.get(model);
        return (
          <button
            key={model}
            type="button"
            onClick={() => onSelect(model)}
            className={`mb-1 flex w-full items-start justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
              active
                ? "bg-white/[0.12] text-white"
                : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            <div className="pr-3">
              <div className="break-all">{entry?.label || model}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {entry?.source_type ? (
                  <Badge variant="muted" className="text-[10px]">
                    {entry.source_type === "hosted" ? "Hosted by OpenCode" : entry.source_type === "provider_backed" ? "From connected provider" : "Unknown source"}
                  </Badge>
                ) : null}
                {entry?.runtime_status && entry.runtime_status !== "unverified" ? (
                  <Badge variant="outline" className={`text-[10px] ${entry.runtime_status === "ready" ? "border-emerald-500/30 text-emerald-100" : "border-amber-500/30 text-amber-100"}`}>
                    {formatOpenCodeStatus(entry.runtime_status)}
                  </Badge>
                ) : null}
              </div>
            </div>
            {active ? <Badge variant="outline" className="shrink-0 text-[10px]">Selected</Badge> : null}
          </button>
        );
      })}
    </div>
  );
}

function WizardStep({ label, text, active, complete }) {
  return (
    <div className={`rounded-xl border px-3 py-3 text-xs ${complete ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : active ? "border-white/20 bg-white/[0.05] text-zinc-100" : "border-white/10 bg-black/20 text-zinc-500"}`}>
      <p className="font-medium">{label}</p>
      <p className="mt-1 leading-5">{text}</p>
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
