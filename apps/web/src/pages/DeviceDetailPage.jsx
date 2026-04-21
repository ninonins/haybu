import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Cpu, HardDrive, LaptopMinimal, PlugZap, Trash2, Unplug, Workflow } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  ScrollArea,
  Separator
} from "../components/ui.jsx";
import { apiFetch } from "../lib/api.js";
import { useAuthStore } from "../store/auth.js";
import { ErrorState, LoadingState, MetricCard, PageHeader } from "./shared.jsx";

function statusVariant(status) {
  if (status === "online" || status === "up" || status === "paired") return "success";
  if (status === "offline" || status === "down") return "danger";
  return "warning";
}

export default function DeviceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const [groupSettings, setGroupSettings] = useState({});
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmUnpairOpen, setConfirmUnpairOpen] = useState(false);
  const [systemProfileOpen, setSystemProfileOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["device", id],
    queryFn: () => apiFetch(`/devices/${id}`)
  });

  const unpairMutation = useMutation({
    mutationFn: () => apiFetch(`/devices/${id}/unpair`, { method: "POST" }),
    onSuccess: async () => {
      setConfirmUnpairOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["device", id] });
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    }
  });
  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/devices/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      setConfirmDeleteOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      navigate("/devices");
    }
  });
  const monitoringMutation = useMutation({
    mutationFn: ({ services, groups }) =>
      apiFetch(`/devices/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ monitoring: { services, groups } })
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["device", id] })
  });

  const inventory = data?.device?.metadata?.inventory || {};
  const discoveredServices = data?.device?.metadata?.discoveredServices || [];
  const currentServices = data?.device?.metadata?.currentServices || [];
  const configuredServices = data?.device?.metadata?.monitoring?.services || [];
  const configuredGroups = data?.device?.metadata?.monitoring?.groups || {};
  const isPaired = Boolean(data?.device?.pairedAt);
  const groupedServices = useMemo(
    () => ({
      docker: discoveredServices.filter((service) => service.source === "docker"),
      pm2: discoveredServices.filter((service) => service.source === "pm2"),
      process: discoveredServices.filter((service) => service.source !== "docker" && service.source !== "pm2")
    }),
    [discoveredServices]
  );
  const prioritizedProcessGroups = useMemo(
    () => ({
      custom: groupedServices.process.filter((service) => service.classification === "custom"),
      system: groupedServices.process.filter((service) => service.classification !== "custom")
    }),
    [groupedServices]
  );

  useEffect(() => {
    const nextSettings = {};
    for (const [groupName, services] of Object.entries(groupedServices)) {
      nextSettings[groupName] = {
        enabled: configuredGroups[groupName]?.enabled ?? false,
        selected: services.reduce((acc, service) => {
          const configured = configuredServices.find(
            (item) => item.name === service.name && item.source === service.source
          );
          acc[`${service.source}:${service.name}`] = configured?.monitorMode === "active";
          return acc;
        }, {})
      };
    }
    setGroupSettings(nextSettings);
  }, [configuredGroups, configuredServices, groupedServices]);

  if (isLoading) return <LoadingState title="Device detail" />;
  if (error) return <ErrorState description={error.message} />;

  const device = data.device;

  function setGroupEnabled(groupName, enabled) {
    setGroupSettings((current) => ({ ...current, [groupName]: { ...(current[groupName] || { selected: {} }), enabled } }));
  }

  function setServiceSelected(groupName, serviceKey, selected) {
    setGroupSettings((current) => ({
      ...current,
      [groupName]: {
        ...(current[groupName] || { enabled: false, selected: {} }),
        selected: { ...(current[groupName]?.selected || {}), [serviceKey]: selected }
      }
    }));
  }

  function saveMonitoringPreferences() {
    const services = [];
    const groups = {};
    for (const [groupName, items] of Object.entries(groupedServices)) {
      const settings = groupSettings[groupName] || { enabled: false, selected: {} };
      groups[groupName] = { enabled: settings.enabled };
      for (const service of items) {
        const key = `${service.source}:${service.name}`;
        services.push({
          name: service.name,
          source: service.source,
          type: service.type,
          monitorMode: settings.enabled && settings.selected[key] ? "active" : "ignore"
        });
      }
    }
    monitoringMutation.mutate({ services, groups });
  }

  function formatInventoryValue(value) {
    if (value === null || value === undefined || value === "") return "Not reported";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    if (typeof value === "number") return value.toLocaleString();
    return String(value);
  }

  const inventorySections = [
    {
      title: "Host",
      items: [
        ["Hostname", inventory.hostname],
        ["Platform", inventory.platform],
        ["Release", inventory.release],
        ["Machine", inventory.machine],
        ["Processor", inventory.processor],
        ["Boot time", inventory.bootTime ? new Date(inventory.bootTime).toLocaleString() : null]
      ]
    },
    {
      title: "Runtime",
      items: [
        ["Agent version", device.agentVersion],
        ["Python version", inventory.pythonVersion],
        ["Logical CPUs", inventory.cpuCount],
        ["Physical CPUs", inventory.physicalCpuCount],
        ["Total memory", inventory.totalMemory]
      ]
    }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Device detail"
        title={device.displayName}
        description={device.deviceUid}
        actions={
          <>
            <Badge variant={isPaired ? "success" : "warning"}>{isPaired ? "paired" : "unpaired"}</Badge>
            <Badge variant={statusVariant(device.status)}>{device.status}</Badge>
            {user?.role === "admin" && isPaired ? (
              <Button variant="outline" onClick={() => setConfirmUnpairOpen(true)}>
                <Unplug className="mr-2 h-4 w-4" />
                Unpair
              </Button>
            ) : null}
            {user?.role === "admin" ? (
              <Button variant="destructive" onClick={() => setConfirmDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        <MetricCard title="Status" value={device.status} hint="Current device state" badge={<Badge variant={statusVariant(device.status)}>{device.status}</Badge>} />
        <MetricCard title="Pairing" value={isPaired ? "Paired" : "Unpaired"} hint={device.pairedAt ? new Date(device.pairedAt).toLocaleString() : "Not paired"} badge={<Badge variant={isPaired ? "success" : "warning"}>{isPaired ? "ready" : "idle"}</Badge>} />
        <MetricCard title="Last Seen" value={device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleTimeString() : "Never"} hint={device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleDateString() : "No recent heartbeat"} badge={<Badge variant="outline">Heartbeat</Badge>} />
        <MetricCard title="Agent Version" value={device.agentVersion || "Unknown"} hint="Reported by latest heartbeat" badge={<Badge variant="outline">Runtime</Badge>} />
      </div>

      {unpairMutation.isSuccess ? (
        <Alert variant="success">
          <AlertTitle>Device unpaired</AlertTitle>
          <AlertDescription>The credential was revoked and the agent must pair again to report.</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Current monitored services</CardTitle>
            <CardDescription>Deduplicated current state, not repeated raw event history.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentServices.length === 0 ? <div className="text-sm text-muted-foreground">No current monitored service state yet.</div> : null}
            {currentServices.slice(0, 8).map((service) => (
              <div key={`${service.source}:${service.name}`} className="flex items-center justify-between rounded-2xl border p-4">
                <div>
                  <div className="font-medium">{service.name}</div>
                  <div className="text-xs text-muted-foreground">{service.source}</div>
                </div>
                <Badge variant={statusVariant(service.status)}>{service.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div>
                <CardTitle>System profile</CardTitle>
                <CardDescription>Technician-facing inventory summary.</CardDescription>
              </div>
              <Button variant="outline" onClick={() => setSystemProfileOpen(true)}>
                More
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><LaptopMinimal className="h-4 w-4" /> Host</div>
              <p className="text-sm text-muted-foreground">{inventory.hostname || "Unknown"}</p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Cpu className="h-4 w-4" /> Runtime</div>
              <p className="text-sm text-muted-foreground">{inventory.platform || "Unknown"}</p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><HardDrive className="h-4 w-4" /> Disk count</div>
              <p className="text-sm text-muted-foreground">{(inventory.disks || []).length}</p>
            </div>
            <div className="rounded-2xl border p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium"><PlugZap className="h-4 w-4" /> Interfaces</div>
              <p className="text-sm text-muted-foreground">{(inventory.networkInterfaces || []).length}</p>
            </div>
            <div className="rounded-2xl border p-4 sm:col-span-2">
              <div className="mb-2 text-sm font-medium">At a glance</div>
              <p className="text-sm text-muted-foreground">
                {inventory.hostname || "Unknown host"} running {inventory.platform || "unknown platform"} with{" "}
                {(inventory.cpuCount ?? 0).toLocaleString()} logical CPU(s), {(inventory.disks || []).length} disk(s), and{" "}
                {(inventory.networkInterfaces || []).length} network interface(s).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Discovered runtime services</CardTitle>
              <CardDescription>Grouped monitoring controls with a cleaner operator workflow.</CardDescription>
            </div>
            <Button onClick={saveMonitoringPreferences} disabled={monitoringMutation.isPending}>
              <Workflow className="mr-2 h-4 w-4" />
              Save monitoring preferences
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="space-y-3">
            {[
              ["docker", "Docker Containers"],
              ["pm2", "PM2 Services"],
              ["process", "OS Services"]
            ].map(([groupName, label]) => {
              const services = groupedServices[groupName] || [];
              const settings = groupSettings[groupName] || { enabled: false, selected: {} };
              return (
                <AccordionItem key={groupName} value={groupName}>
                  <AccordionTrigger>
                    <div className="flex items-center gap-3">
                      <span>{label}</span>
                      <Badge variant={settings.enabled ? "success" : "warning"}>{settings.enabled ? "enabled" : "disabled"}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="flex items-center gap-3 rounded-2xl border p-4">
                      <Checkbox checked={Boolean(settings.enabled)} onCheckedChange={(checked) => setGroupEnabled(groupName, Boolean(checked))} />
                      <div>
                        <div className="font-medium">Enable monitoring for this group</div>
                        <div className="text-sm text-muted-foreground">Unchecked groups do not contribute to degraded state.</div>
                      </div>
                    </div>
                    {services.length === 0 ? <div className="text-sm text-muted-foreground">No services discovered in this group.</div> : null}
                    {groupName !== "process"
                      ? services.map((service) => {
                          const serviceKey = `${service.source}:${service.name}`;
                          return (
                            <label key={serviceKey} className="flex items-start gap-3 rounded-2xl border p-4">
                              <Checkbox checked={Boolean(settings.selected[serviceKey])} disabled={!settings.enabled} onCheckedChange={(checked) => setServiceSelected(groupName, serviceKey, Boolean(checked))} />
                              <div>
                                <div className="font-medium">{service.name}</div>
                                <div className="text-sm text-muted-foreground">{service.source} / {service.type}</div>
                              </div>
                            </label>
                          );
                        })
                      : (
                          <div className="grid gap-4 lg:grid-cols-2">
                            <div className="space-y-3">
                              <div className="text-sm font-semibold text-muted-foreground">Suggested app services</div>
                              {prioritizedProcessGroups.custom.length === 0 ? <div className="text-sm text-muted-foreground">No likely user-installed or app services found.</div> : null}
                              {prioritizedProcessGroups.custom.map((service) => {
                                const serviceKey = `${service.source}:${service.name}`;
                                return (
                                  <label key={serviceKey} className="flex items-start gap-3 rounded-2xl border p-4">
                                    <Checkbox checked={Boolean(settings.selected[serviceKey])} disabled={!settings.enabled} onCheckedChange={(checked) => setServiceSelected(groupName, serviceKey, Boolean(checked))} />
                                    <div>
                                      <div className="font-medium">{service.name}</div>
                                      <div className="text-sm text-muted-foreground">{service.user} / {service.command || service.type}</div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                            <div className="space-y-3">
                              <div className="text-sm font-semibold text-muted-foreground">System/background processes</div>
                              {prioritizedProcessGroups.system.map((service) => {
                                const serviceKey = `${service.source}:${service.name}`;
                                return (
                                  <label key={serviceKey} className="flex items-start gap-3 rounded-2xl border p-4">
                                    <Checkbox checked={Boolean(settings.selected[serviceKey])} disabled={!settings.enabled} onCheckedChange={(checked) => setServiceSelected(groupName, serviceKey, Boolean(checked))} />
                                    <div>
                                      <div className="font-medium">{service.name}</div>
                                      <div className="text-sm text-muted-foreground">{service.user} / {service.command || service.type}</div>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Recent compact heartbeats</CardTitle>
          <CardDescription>Stored at policy-driven cadence, with latest state held separately.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.heartbeats.map((heartbeat) => (
            <div key={heartbeat.id} className="flex items-center justify-between rounded-2xl border p-4">
              <div>
                <div className="font-medium">{new Date(heartbeat.receivedAt).toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">Stored raw heartbeat snapshot</div>
              </div>
              <Badge variant={statusVariant(heartbeat.status)}>{heartbeat.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete device</DialogTitle>
            <DialogDescription>Remove this device and all associated monitoring data. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()}>Delete device</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmUnpairOpen} onOpenChange={setConfirmUnpairOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unpair device</DialogTitle>
            <DialogDescription>Revoke the current credential and require a fresh pairing before this device can report again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUnpairOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => unpairMutation.mutate()}>Unpair device</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={systemProfileOpen} onOpenChange={setSystemProfileOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Full system profile</DialogTitle>
            <DialogDescription>
              Complete device inventory captured from the edge agent for technician review.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {inventorySections.map((section) => (
                <div key={section.title} className="space-y-3">
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                    {section.title}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {section.items.map(([label, value]) => (
                      <div key={label} className="rounded-2xl border p-4">
                        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                        <div className="mt-2 text-sm">{formatInventoryValue(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <Separator />

              <div className="space-y-3">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Storage devices
                </div>
                {(inventory.disks || []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">No disk layout reported.</div>
                ) : (
                  <div className="space-y-3">
                    {inventory.disks.map((disk, index) => (
                      <div key={`${disk.device || "disk"}-${index}`} className="rounded-2xl border p-4">
                        <div className="font-medium">{disk.mountpoint || disk.device || `Disk ${index + 1}`}</div>
                        <div className="mt-2 grid gap-3 md:grid-cols-3">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Device</div>
                            <div className="mt-1 text-sm">{formatInventoryValue(disk.device)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Filesystem</div>
                            <div className="mt-1 text-sm">{formatInventoryValue(disk.fstype)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Total</div>
                            <div className="mt-1 text-sm">{formatInventoryValue(disk.total)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Used</div>
                            <div className="mt-1 text-sm">{formatInventoryValue(disk.used)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Available</div>
                            <div className="mt-1 text-sm">{formatInventoryValue(disk.free)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Usage</div>
                            <div className="mt-1 text-sm">{formatInventoryValue(disk.percent)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                  Network interfaces
                </div>
                {(inventory.networkInterfaces || []).length === 0 ? (
                  <div className="text-sm text-muted-foreground">No network interfaces reported.</div>
                ) : (
                  <div className="space-y-3">
                    {inventory.networkInterfaces.map((iface, index) => (
                      <div key={`${iface.name || "iface"}-${index}`} className="rounded-2xl border p-4">
                        <div className="font-medium">{iface.name || `Interface ${index + 1}`}</div>
                        <div className="mt-2 grid gap-3 md:grid-cols-2">
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">MAC</div>
                            <div className="mt-1 text-sm">{formatInventoryValue(iface.mac)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-wide text-muted-foreground">Addresses</div>
                            <div className="mt-1 text-sm">
                              {Array.isArray(iface.addresses) && iface.addresses.length > 0
                                ? iface.addresses.join(", ")
                                : "Not reported"}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSystemProfileOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
