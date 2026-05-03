import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Activity, BarChart3, Settings, ToggleLeft, ToggleRight } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input } from "./ui.jsx";
import { apiFetch } from "../lib/api.js";

function ConfigField({ name, schema, value, onChange }) {
  const { type, default: defaultValue, min, max, description } = schema;
  const current = value !== undefined ? value : defaultValue;

  if (type === "number") {
    return (
      <div className="space-y-2">
        <label htmlFor={name} className="text-sm font-medium">{name}</label>
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
        <label htmlFor={name} className="text-sm font-medium">{name}</label>
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

function metricValue(result, ...keys) {
  for (const key of keys) {
    const value = result?.[key];
    if (value !== undefined && value !== null && value !== "") return Number(value);
  }
  return null;
}

function formatMetric(value, unit) {
  return Number.isFinite(value) ? `${value.toFixed(value >= 100 ? 0 : 1)} ${unit}` : "No data";
}

function hasSpeedtestResult(mod) {
  const result = mod.lastResult || {};
  return (
    mod.name === "speedtest" &&
    !result.error &&
    Object.keys(result).length > 0 &&
    (metricValue(result, "downloadMbps", "download_mbps", "download") !== null ||
      metricValue(result, "uploadMbps", "upload_mbps", "upload") !== null ||
      metricValue(result, "pingMs", "ping_ms", "ping") !== null)
  );
}

function SpeedtestSummaryCard({ mod, deviceUid }) {
  const navigate = useNavigate();
  const result = mod.lastResult || {};
  const download = metricValue(result, "downloadMbps", "download_mbps", "download");
  const upload = metricValue(result, "uploadMbps", "upload_mbps", "upload");
  const ping = metricValue(result, "pingMs", "ping_ms", "ping");

  return (
    <div className="mt-4 rounded-2xl border bg-muted/30 p-4">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium">Latest speedtest</div>
          <div className="text-xs text-muted-foreground">
            {mod.lastRunAt ? new Date(mod.lastRunAt).toLocaleString() : "Most recent module result"}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate(`/devices/${deviceUid}/speedtest`)}>
          <BarChart3 className="mr-2 h-4 w-4" />
          View History
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-background p-3">
          <div className="text-xs text-muted-foreground">Download</div>
          <div className="text-lg font-semibold">{formatMetric(download, "Mbps")}</div>
        </div>
        <div className="rounded-xl bg-background p-3">
          <div className="text-xs text-muted-foreground">Upload</div>
          <div className="text-lg font-semibold">{formatMetric(upload, "Mbps")}</div>
        </div>
        <div className="rounded-xl bg-background p-3">
          <div className="text-xs text-muted-foreground">Ping</div>
          <div className="text-lg font-semibold">{formatMetric(ping, "ms")}</div>
        </div>
      </div>
    </div>
  );
}

export default function DeviceModulesSection({ deviceId, deviceUid, isAdmin }) {
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(null);
  const [draftConfig, setDraftConfig] = useState({});
  const moduleDeviceKey = deviceUid || deviceId;

  const { data, isLoading } = useQuery({
    queryKey: ["device-modules", moduleDeviceKey],
    enabled: Boolean(moduleDeviceKey),
    queryFn: () => apiFetch(`/devices/${moduleDeviceKey}/modules`),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ name, enabled }) =>
      apiFetch(`/devices/${moduleDeviceKey}/modules/${name}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["device-modules", moduleDeviceKey] }),
  });

  const configMutation = useMutation({
    mutationFn: ({ name, config }) =>
      apiFetch(`/devices/${moduleDeviceKey}/modules/${name}`, {
        method: "PATCH",
        body: JSON.stringify({ config }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["device-modules", moduleDeviceKey] });
      setConfigOpen(null);
    },
  });

  const runMutation = useMutation({
    mutationFn: (name) =>
      apiFetch(`/devices/${moduleDeviceKey}/modules/${name}/run`, {
        method: "POST",
        body: JSON.stringify({ action: "run" }),
      }),
    onSuccess: (_data, name) => {
      queryClient.invalidateQueries({ queryKey: ["device-modules", moduleDeviceKey] });
      if (name === "speedtest") {
        queryClient.invalidateQueries({ queryKey: ["speedtest-results", moduleDeviceKey] });
        queryClient.invalidateQueries({ queryKey: ["speedtest-summary", moduleDeviceKey] });
      }
    },
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
              className="flex flex-col gap-4 rounded-2xl border p-4 lg:flex-row lg:items-start lg:justify-between"
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
                {hasSpeedtestResult(mod) ? <SpeedtestSummaryCard mod={mod} deviceUid={moduleDeviceKey} /> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 lg:ml-4 lg:justify-end">
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
