import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, AlertTriangle, CheckCircle2, ServerCrash, Sparkles } from "lucide-react";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Tabs, TabsList, TabsTrigger } from "../components/ui.jsx";
import { apiFetch } from "../lib/api.js";
import { ErrorState, LoadingState, MetricCard, PageHeader } from "./shared.jsx";

export default function DashboardPage() {
  const [range, setRange] = useState("weekly");
  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard", range],
    queryFn: () => apiFetch(`/reports/dashboard?range=${range}`)
  });

  const summary = data?.summary ?? {
    totalDevices: 0,
    onlineDevices: 0,
    offlineDevices: 0,
    degradedDevices: 0,
    services: {
      up: 0,
      down: 0,
      degraded: 0
    }
  };
  const trend = data?.trend ?? [];

  if (isLoading) return <LoadingState title="Dashboard" />;
  if (error) return <ErrorState description={error.message} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Overview"
        title="Haybu command center"
        description="Operational visibility across devices, monitored services, and raw retention-sensitive fleet health."
        actions={<Badge variant="outline" className="rounded-full px-3 py-1">Live data</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        <MetricCard
          title="Total Devices"
          value={summary.totalDevices}
          hint="Current registered footprint"
          description="Includes paired and recently active agents."
          badge={<Badge variant="outline" className="rounded-full"><Activity className="mr-1 h-3 w-3" /> Fleet</Badge>}
        />
        <MetricCard
          title="Online"
          value={summary.onlineDevices}
          hint="Healthy at the latest heartbeat"
          description="Derived from monitored services only."
          badge={<Badge variant="success"><CheckCircle2 className="mr-1 h-3 w-3" /> Stable</Badge>}
        />
        <MetricCard
          title="Offline"
          value={summary.offlineDevices}
          hint="Missed their grace window"
          description="Needs attention or is intentionally down."
          badge={<Badge variant="danger"><ServerCrash className="mr-1 h-3 w-3" /> Incidents</Badge>}
        />
        <MetricCard
          title="Degraded"
          value={summary.degradedDevices}
          hint="Alive but with failing monitored services"
          description="Based on current heartbeat state, not historical noise."
          badge={<Badge variant="warning"><AlertTriangle className="mr-1 h-3 w-3" /> Watch</Badge>}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <Card className="rounded-3xl">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Fleet trend</CardTitle>
              <CardDescription>Availability trend based on compact heartbeat history across the selected time grain.</CardDescription>
            </div>
            <Tabs value={range} onValueChange={setRange}>
              <TabsList>
                <TabsTrigger value="hourly">Hourly</TabsTrigger>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="onlineFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="incidentFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-5))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-5))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.25} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={12} />
                  <YAxis tickLine={false} axisLine={false} tickMargin={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "12px"
                    }}
                  />
                  <Legend />
                  <Area type="monotone" dataKey="online" stroke="hsl(var(--chart-1))" fill="url(#onlineFill)" strokeWidth={2} />
                  <Area type="monotone" dataKey="degraded" stroke="hsl(var(--chart-3))" fillOpacity={0} strokeWidth={2} />
                  <Area type="monotone" dataKey="incidents" stroke="hsl(var(--chart-5))" fill="url(#incidentFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Service composition</CardTitle>
            <CardDescription>Current reported service state counts.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-2xl border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Up</p>
                <p className="text-2xl font-semibold">{summary.services?.up || 0}</p>
              </div>
              <Badge variant="success">Healthy</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Down</p>
                <p className="text-2xl font-semibold">{summary.services?.down || 0}</p>
              </div>
              <Badge variant="danger">Failing</Badge>
            </div>
            <div className="flex items-center justify-between rounded-2xl border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Degraded</p>
                <p className="text-2xl font-semibold">{summary.services?.degraded || 0}</p>
              </div>
              <Badge variant="warning">Partial</Badge>
            </div>
            <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4" />
                Operator note
              </div>
              Storage-compacted heartbeats now drive these panels, so counts stay presentable without raw-history bloat.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
