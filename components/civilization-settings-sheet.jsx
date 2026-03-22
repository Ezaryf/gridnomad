"use client";

import { useEffect, useState } from "react";

import { KeyRound, Plus, Settings2, UserRoundCog } from "lucide-react";

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
                          googleCloudProject: group.controller?.googleCloudProject ?? ""
                        })}
                        onProviderChange={(provider) => onProviderChange(group.id, provider)}
                        onCredentialChange={(credential) => onProviderCredentialChange(group.id, credential)}
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
  onUpdateController,
  onLaunchProviderLogin,
  onCreateOpencodeHome,
  onCopyCommand
}) {
  const provider = controller?.provider ?? "heuristic";
  const models = catalog?.models?.length ? catalog.models : controller?.availableModels ?? [];
  const credentials = catalog?.credentials ?? [];
  const healthState = catalog?.health_state ?? catalog?.auth_status ?? "local";
  const needsOpencodeLogin = provider === "opencode" && (healthState === "login_required" || healthState === "connected_no_models");
  const readiness = controllerReadiness(controller, catalog);

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-zinc-100">{title}</h4>
          <p className="text-sm text-zinc-400">{subtitle}.</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant="muted">{providerDisplayName(provider)}</Badge>
          <Badge variant="default" className={readiness.state === "ready" ? "text-[10px]" : "border-red-500/40 bg-red-500/10 text-[10px] text-red-200"}>{readiness.state}</Badge>
          {provider === "opencode" ? <Badge variant="outline" className="text-[10px]">{healthState}</Badge> : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-zinc-400">
          <p className="font-medium text-zinc-200">Strict readiness: {readiness.state}</p>
          <p>{readiness.message}</p>
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
            <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-zinc-400">
              <p className="font-medium text-zinc-200">OpenCode health: {healthState}</p>
              <p>{catalog?.login_hint ?? "Create a managed OpenCode home, run the manual login command, then refresh credentials and models."}</p>
              {catalog?.environment_source ? <p className="mt-1 text-zinc-500">Environment: {catalog.environment_source === "managed-home" ? "GridNomad-managed OpenCode home" : catalog.environment_source === "custom-home" ? "Custom OpenCode home" : "User-global OpenCode home"}</p> : null}
              {catalog?.resolved_cli_home ? <p className="mt-1 text-zinc-500">Home root: {catalog.resolved_cli_home}</p> : null}
              {catalog?.detected_cli_home ? <p className="mt-1 text-zinc-500">CLI config: {catalog.detected_cli_home}</p> : null}
              {catalog?.opencode_path ? <p className="mt-1 text-zinc-500">CLI executable: {catalog.opencode_path}</p> : null}
              {catalog?.models_scope ? <p className="mt-1 text-zinc-500">Models scope: {catalog.models_scope}</p> : null}
              {needsOpencodeLogin ? <p className="mt-1 text-amber-300">Login is still required before this group can actually run on OpenCode, even if the CLI already exposes model names below.</p> : null}
              {catalog?.last_probe_at ? <p className="mt-1 text-zinc-500">Last probe: {catalog.last_probe_at}</p> : null}
            </div>
            <LabeledField label="OpenCode credential">
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
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
              <Button variant="outline" onClick={onCreateOpencodeHome}>
                Create / reset OpenCode home
              </Button>
              <Button
                variant="outline"
                onClick={() => onCopyCommand("OpenCode login command", catalog?.manual_commands?.powershell?.login ?? "")}
                disabled={!catalog?.manual_commands?.powershell?.login}
              >
                <KeyRound className="size-4" />
                Copy login command
              </Button>
              <Button
                variant="outline"
                onClick={() => onCopyCommand("OpenCode verify command", catalog?.manual_commands?.powershell?.verify ?? "")}
                disabled={!catalog?.manual_commands?.powershell?.verify}
              >
                Copy verify command
              </Button>
              <Button
                variant="outline"
                onClick={() => onCopyCommand("OpenCode models command", catalog?.manual_commands?.powershell?.models ?? "")}
                disabled={!catalog?.manual_commands?.powershell?.models}
              >
                Copy models command
              </Button>
              <Button variant="outline" onClick={() => onRefreshProviderCatalog("opencode", controller?.opencodeProvider ?? "")}>Refresh credentials</Button>
              <Button variant="outline" onClick={() => onRefreshProviderCatalog("opencode", controller?.opencodeProvider ?? "")}>Refresh models</Button>
            </div>
            {catalog?.manual_commands?.powershell?.login ? (
              <div className="sm:col-span-2 rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Manual login flow</p>
                <p className="mb-2 text-xs leading-5 text-zinc-400">
                  1. Create or reset the managed home. 2. Copy the login command and run it in your own PowerShell or Command Prompt. 3. Finish the browser/device login. 4. Return here and refresh credentials, then models.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <InlineCommand label="PowerShell login" value={catalog.manual_commands.powershell.login} />
                  <InlineCommand label="Command Prompt login" value={catalog.manual_commands.cmd?.login ?? ""} />
                  <InlineCommand label="Verify auth" value={catalog.manual_commands.powershell.verify} />
                  <InlineCommand label="List models" value={catalog.manual_commands.powershell.models} />
                </div>
              </div>
            ) : null}
            {(catalog?.stdout || catalog?.stderr) ? (
              <details className="sm:col-span-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
                <summary className="cursor-pointer text-zinc-200">Raw OpenCode probe output</summary>
                {catalog?.stdout ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Stdout</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-zinc-300">{catalog.stdout}</pre>
                  </div>
                ) : null}
                {catalog?.stderr ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Stderr</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-zinc-300">{catalog.stderr}</pre>
                  </div>
                ) : null}
              </details>
            ) : null}
          </>
        ) : null}

        {provider === "gemini-cli" ? (
          <>
            <div className="sm:col-span-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs leading-5 text-zinc-400">
              <p className="font-medium text-zinc-200">Gemini CLI health: {catalog?.health_state ?? catalog?.auth_status ?? "login_required"}</p>
              <p>{catalog?.login_hint ?? "Use your Google account in Gemini CLI, then refresh status and models."}</p>
              {catalog?.gemini_path ? <p className="mt-1 text-zinc-500">CLI executable: {catalog.gemini_path}</p> : null}
              {catalog?.resolved_cli_home ? <p className="mt-1 text-zinc-500">User-global home: {catalog.resolved_cli_home}</p> : null}
              {controller?.googleCloudProject ? <p className="mt-1 text-zinc-500">Google Cloud Project: {controller.googleCloudProject}</p> : null}
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
              <Button
                variant="outline"
                onClick={() => onCopyCommand("Gemini CLI login command", catalog?.manual_commands?.powershell?.login ?? "")}
                disabled={!catalog?.manual_commands?.powershell?.login}
              >
                <KeyRound className="size-4" />
                Copy login command
              </Button>
              <Button
                variant="outline"
                onClick={() => onCopyCommand("Gemini CLI verify command", catalog?.manual_commands?.powershell?.verify ?? "")}
                disabled={!catalog?.manual_commands?.powershell?.verify}
              >
                Copy verify command
              </Button>
              <Button variant="outline" onClick={() => onRefreshProviderCatalog("gemini-cli", "")}>Refresh status</Button>
              <Button variant="outline" onClick={() => onRefreshProviderCatalog("gemini-cli", "")}>Refresh models</Button>
            </div>
            {catalog?.manual_commands?.powershell?.login ? (
              <div className="sm:col-span-2 rounded-xl border border-white/10 bg-black/30 p-3">
                <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Manual Gemini CLI login</p>
                <p className="mb-2 text-xs leading-5 text-zinc-400">
                  1. Copy the login command and run it in your own terminal. 2. Finish the Google login flow in the browser or terminal prompt. 3. Run the verify command if you want to confirm the CLI is responding. 4. Return here and refresh status and models.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <InlineCommand label="PowerShell login" value={catalog.manual_commands.powershell.login} />
                  <InlineCommand label="Command Prompt login" value={catalog.manual_commands.cmd?.login ?? ""} />
                  <InlineCommand label="Verify auth" value={catalog.manual_commands.powershell.verify} />
                </div>
              </div>
            ) : null}
            {(catalog?.stdout || catalog?.stderr) ? (
              <details className="sm:col-span-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-zinc-400">
                <summary className="cursor-pointer text-zinc-200">Raw Gemini CLI probe output</summary>
                {catalog?.stdout ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Stdout</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-zinc-300">{catalog.stdout}</pre>
                  </div>
                ) : null}
                {catalog?.stderr ? (
                  <div className="mt-3">
                    <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">Stderr</p>
                    <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[10px] leading-4 text-zinc-300">{catalog.stderr}</pre>
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

function LabeledField({ label, children }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-500">{label}</span>
      {children}
    </label>
  );
}
