import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileBarChart } from "lucide-react";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui.jsx";
import { apiFetch } from "../lib/api.js";
import { ErrorState, LoadingState, PageHeader } from "./shared.jsx";

export default function ReportsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["reports"],
    queryFn: () => apiFetch("/reports/uptime")
  });

  async function handleExport() {
    const csv = await apiFetch("/reports/export");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "uptime-report.csv";
    link.click();
    URL.revokeObjectURL(href);
  }

  const chartData = useMemo(() => (data?.report || []).map((row) => ({
    name: row.displayName.length > 14 ? `${row.displayName.slice(0, 14)}…` : row.displayName,
    uptime: row.uptimePercentage
  })), [data]);

  if (isLoading) return <LoadingState title="Reports" />;
  if (error) return <ErrorState description={error.message} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reporting"
        title="Uptime analytics"
        description="Use compacted heartbeat history and long-lived summaries to review service reliability without raw-data sprawl."
        actions={
          <Button onClick={handleExport} variant="outline" className="rounded-xl">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Device uptime comparison</CardTitle>
            <CardDescription>Current calculated uptime by device from retained compact history.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-[360px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.25} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "12px"
                    }}
                  />
                  <Bar dataKey="uptime" fill="hsl(var(--chart-1))" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Current ranking</CardTitle>
            <CardDescription>Ordered by current uptime percentage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.report
              .slice()
              .sort((a, b) => b.uptimePercentage - a.uptimePercentage)
              .map((row) => (
                <div key={row.deviceId} className="flex items-center justify-between rounded-2xl border p-4">
                  <div>
                    <div className="font-medium">{row.displayName}</div>
                    <div className="text-xs text-muted-foreground">{row.deviceUid}</div>
                  </div>
                  <Badge variant={row.status === "online" ? "success" : row.status === "offline" ? "danger" : "warning"}>
                    {row.uptimePercentage}%
                  </Badge>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
