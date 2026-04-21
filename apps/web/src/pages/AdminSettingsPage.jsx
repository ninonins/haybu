import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatabaseZap, Download, Eraser, SlidersHorizontal } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Switch } from "../components/ui.jsx";
import { apiFetch } from "../lib/api.js";
import { ErrorState, LoadingState, PageHeader } from "./shared.jsx";

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => apiFetch("/admin/settings")
  });
  const [form, setForm] = useState({
    rawHeartbeatRetentionDays: 14,
    rawServiceEventRetentionDays: 14,
    heartbeatStorageIntervalSeconds: 300,
    summaryGenerationIntervalHours: 6,
    storeEveryHeartbeat: false
  });

  useEffect(() => {
    if (data?.settings) setForm(data.settings);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => apiFetch("/admin/settings", { method: "PATCH", body: JSON.stringify(form) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-settings"] })
  });
  const exportRawMutation = useMutation({
    mutationFn: () => apiFetch("/admin/export/raw", { method: "POST" }),
    onSuccess: (payload) => downloadJson(payload, "raw-records-export.json")
  });
  const exportSummaryMutation = useMutation({
    mutationFn: () => apiFetch("/admin/export/summaries", { method: "POST" }),
    onSuccess: (payload) => downloadJson(payload, "summary-records-export.json")
  });
  const flushMutation = useMutation({
    mutationFn: () => apiFetch("/admin/flush/raw", { method: "POST" })
  });

  function downloadJson(payload, filename) {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(href);
  }

  if (isLoading) return <LoadingState title="Admin settings" />;
  if (error) return <ErrorState description={error.message} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Global policy" title="Storage and retention controls" description="Tune raw heartbeat retention, storage cadence, exports, and flush operations without touching device-level monitoring config." />
      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border p-3">
                <SlidersHorizontal className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Storage policy</CardTitle>
                <CardDescription>Compact raw history, summary cadence, and retention windows.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium">Raw heartbeat retention days</span>
                <Input type="number" value={form.rawHeartbeatRetentionDays} onChange={(event) => setForm((current) => ({ ...current, rawHeartbeatRetentionDays: Number(event.target.value) }))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Raw service-event retention days</span>
                <Input type="number" value={form.rawServiceEventRetentionDays} onChange={(event) => setForm((current) => ({ ...current, rawServiceEventRetentionDays: Number(event.target.value) }))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Heartbeat storage interval seconds</span>
                <Input type="number" value={form.heartbeatStorageIntervalSeconds} onChange={(event) => setForm((current) => ({ ...current, heartbeatStorageIntervalSeconds: Number(event.target.value) }))} />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium">Summary generation interval hours</span>
                <Input type="number" value={form.summaryGenerationIntervalHours} onChange={(event) => setForm((current) => ({ ...current, summaryGenerationIntervalHours: Number(event.target.value) }))} />
              </label>
            </div>
            <div className="flex items-center justify-between rounded-2xl border p-4">
              <div>
                <p className="font-medium">Store every heartbeat</p>
                <p className="text-sm text-muted-foreground">Disable compact sampling and persist all raw heartbeats.</p>
              </div>
              <Switch checked={Boolean(form.storeEveryHeartbeat)} onCheckedChange={(checked) => setForm((current) => ({ ...current, storeEveryHeartbeat: checked }))} />
            </div>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Save storage policy</Button>
            {saveMutation.isSuccess ? (
              <Alert variant="success">
                <AlertTitle>Settings saved</AlertTitle>
                <AlertDescription>New cadence and retention values will be used by the running API scheduler.</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border p-3">
                <DatabaseZap className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Raw data operations</CardTitle>
                <CardDescription>Export or flush retained raw records while keeping devices and summaries intact.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" onClick={() => exportRawMutation.mutate()}>
              <Download className="mr-2 h-4 w-4" />
              Export raw records
            </Button>
            <Button variant="outline" onClick={() => exportSummaryMutation.mutate()}>
              <Download className="mr-2 h-4 w-4" />
              Export summaries
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (window.confirm("Flush all raw heartbeat and service-event records?")) flushMutation.mutate();
              }}
            >
              <Eraser className="mr-2 h-4 w-4" />
              Flush raw records
            </Button>
            {flushMutation.data ? (
              <Alert variant="success">
                <AlertTitle>Raw records deleted</AlertTitle>
                <AlertDescription>
                  Removed {flushMutation.data.result.heartbeatsDeleted} heartbeats and {flushMutation.data.result.serviceEventsDeleted} service events.
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
