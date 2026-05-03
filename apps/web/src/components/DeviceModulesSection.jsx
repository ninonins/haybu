import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Settings, ToggleLeft, ToggleRight } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Separator } from "./ui.jsx";
import { apiFetch } from "../lib/api.js";

function ConfigField({ name, schema, value, onChange }) {
  const { type, default: defaultValue, min, max, description } = schema;
  const current = value !== undefined ? value : defaultValue;

  if (type === "number") {
    return (
      <div className="space-y-2">
        <Label htmlFor={name} className="text-sm font-medium">{name}</Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        <Input
          id={name}
          type="number"
          min={min}
          max={max}
          value={current}
          onChange={(e) => onChange(name, Number(e.target.value))}
          className="rounded-xl"
        />
      </div>
    );
  }

  if (type === "string") {
    return (
      <div className="space-y-2">
        <Label htmlFor={name} className="text-sm font-medium">{name}</Label>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        <Input
          id={name}
          type="text"
          value={current || ""}
          onChange={(e) => onChange(name, e.target.value)}
          className="rounded-xl"
        />
      </div>
    );
  }

  if (type === "boolean") {
    return (
      <div className="flex items-center justify-between rounded-2xl border p-4">
        <div>
          <div className="text-sm font-medium">{name}</div>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange(name, !current)}
        >
          {current ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
        </Button>
      </div>
    );
  }

  return null;
}

export default function DeviceModulesSection({ deviceId, deviceUid, isAdmin }) {
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(null);
  const [draftConfig, setDraftConfig] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ["device-modules", deviceId],
    queryFn: () => apiFetch(`/devices/${deviceId}/modules`),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ name, enabled }) =>
      apiFetch(`/devices/${deviceId}/modules/${name}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["device-modules", deviceId] }),
  });

  const configMutation = useMutation({
    mutationFn: ({ name, config }) =>
      apiFetch(`/devices/${deviceId}/modules/${name}`, {
        method: "PATCH",
        body: JSON.stringify({ config }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-modules", deviceId] });
      setConfigOpen(null);
    },
  });

  const runMutation = useMutation({
    mutationFn: (name) =>
      apiFetch(`/devices/${deviceId}/modules/${name}/run`, {
        method: "POST",
        body: JSON.stringify({ action: "run" }),
      }),
  });

  if (isLoading) {
    return (
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Activity className="h-4 w-4" /> Modules</CardTitle>
          <CardDescription>Loading modules...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const modules = data?.modules || [];

  function openConfig(mod) {
    setDraftConfig({ ...(mod.config || {}) });
    setConfigOpen(mod.name);
  }

  function updateDraftField(key, value) {
    setDraftConfig((prev) => ({ ...prev, [key]: value }));
  }

  function saveConfig(name) {
    configMutation.mutate({ name, config: draftConfig });
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" /> Modules
            </CardTitle>
            <CardDescription>Installed modules and their status for this device.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {modules.length === 0 ? (
          <div className="text-sm text-muted-foreground">No modules registered.</div>
        ) : (
          modules.map((mod) => (
            <div
              key={mod.name}
              className="flex items-center justify-between rounded-2xl border p-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{mod.name}</span>
                  <Badge variant="outline">v{mod.version}</Badge>
                  {mod.enabled ? (
                    <Badge variant="success">enabled</Badge>
                  ) : (
                    <Badge variant="warning">disabled</Badge>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{mod.description}</p>
                {mod.lastRunAt ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last run: {new Date(mod.lastRunAt).toLocaleString()}
                  </p>
                ) : null}
              </div>
              <div className="ml-4 flex items-center gap-2">
                {isAdmin ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openConfig(mod)}
                    >
                      <Settings className="mr-1 h-4 w-4" />
                      Config
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => runMutation.mutate(mod.name)}
                      disabled={runMutation.isPending}
                    >
                      <Activity className="mr-1 h-4 w-4" />
                      Run
                    </Button>
                    <Button
                      variant={mod.enabled ? "destructive" : "default"}
                      size="sm"
                      onClick={() => toggleMutation.mutate({ name: mod.name, enabled: !mod.enabled })}
                      disabled={toggleMutation.isPending}
                    >
                      {mod.enabled ? "Disable" : "Enable"}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))
        )}
      </CardContent>

      {configOpen ? (
        <Dialog open={Boolean(configOpen)} onOpenChange={() => setConfigOpen(null)}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>Configure {configOpen}</DialogTitle>
              <DialogDescription>Adjust module settings for this device.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {(() => {
                const mod = modules.find((m) => m.name === configOpen);
                if (!mod || !mod.configSchema) return null;
                return Object.entries(mod.configSchema).map(([key, schema]) => (
                  <ConfigField
                    key={key}
                    name={key}
                    schema={schema}
                    value={draftConfig[key]}
                    onChange={updateDraftField}
                  />
                ));
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfigOpen(null)}>Cancel</Button>
              <Button onClick={() => saveConfig(configOpen)} disabled={configMutation.isPending}>
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </Card>
  );
}
