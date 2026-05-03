import { useMemo, useState } from "react";
import { Activity, Download, Loader2, Upload } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./ui.jsx";
import {
  useExportSpeedtest,
  useRunSpeedtest,
  useSpeedtestResults,
  useSpeedtestSummary
} from "../api/speedtest.js";
import { useAuthStore } from "../store/auth.js";

const RANGE_OPTIONS = [
  { label: "24h", days: 1 },
  { label: "7d", days: 7 },
  { label: "30d", days: 30 }
];

const PAGE_SIZE = 10;

function formatNumber(value, suffix = "") {
  const number = Number(value);
  if (!Number.isFinite(number)) return "No data";
  return `${number.toFixed(number >= 100 ? 0 : 1)}${suffix}`;
}

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function formatChartTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric" });
}

function StatCard({ title, stat, unit }) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-3xl">{formatNumber(stat?.avg, unit)}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Min {formatNumber(stat?.min, unit)}</span>
        <span>Max {formatNumber(stat?.max, unit)}</span>
      </CardContent>
    </Card>
  );
}

function downloadExport(payload, deviceUid) {
  const format = payload?.format || "json";
  const isCsv = format === "csv";
  const content = isCsv ? payload.data || "" : JSON.stringify(payload?.data || [], null, 2);
  const blob = new Blob([content], { type: isCsv ? "text/csv;charset=utf-8" : "application/json;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = `speedtest-${deviceUid}.${isCsv ? "csv" : "json"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export default function SpeedtestDashboard({ deviceUid }) {
  const [rangeDays, setRangeDays] = useState(7);
  const [page, setPage] = useState(0);
  const user = useAuthStore((state) => state.user);
  const range = useMemo(() => {
    const end = new Date();
    const start = new Date(end.getTime() - rangeDays * 24 * 60 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }, [rangeDays]);

  const chartQuery = useSpeedtestResults(deviceUid, { limit: 500, offset: 0, start: range.start, end: range.end });
  const tableQuery = useSpeedtestResults(deviceUid, {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    start: range.start,
    end: range.end
  });
  const summaryQuery = useSpeedtestSummary(deviceUid, rangeDays);
  const runMutation = useRunSpeedtest(deviceUid);
  const exportMutation = useExportSpeedtest(deviceUid, "csv");

  const chartData = useMemo(() => {
    const results = chartQuery.data?.results || [];
    return [...results]
      .reverse()
      .filter((result) => !result.error)
      .map((result) => ({
        testedAt: result.testedAt,
        label: formatChartTime(result.testedAt),
        download: result.downloadMbps,
        upload: result.uploadMbps,
        ping: result.pingMs
      }));
  }, [chartQuery.data]);

  const summary = summaryQuery.data?.summary;
  const rows = tableQuery.data?.results || [];
  const pagination = tableQuery.data?.pagination || { total: 0, limit: PAGE_SIZE, offset: 0 };
  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / PAGE_SIZE));
  const isLoading = chartQuery.isLoading || tableQuery.isLoading || summaryQuery.isLoading;
  const error = chartQuery.error || tableQuery.error || summaryQuery.error || exportMutation.error || runMutation.error;

  function changeRange(days) {
    setRangeDays(days);
    setPage(0);
  }

  async function exportResults() {
    const payload = await exportMutation.mutateAsync("csv");
    downloadExport(payload, deviceUid);
  }

  return (
    <div className="space-y-6">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Speedtest request failed</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Download average" stat={summary?.downloadMbps} unit=" Mbps" />
        <StatCard title="Upload average" stat={summary?.uploadMbps} unit=" Mbps" />
        <StatCard title="Ping average" stat={summary?.pingMs} unit=" ms" />
      </div>

      <Card className="rounded-3xl">
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>Speed history</CardTitle>
            <CardDescription>{summary?.count || 0} successful result(s) in the selected range.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border bg-background p-1">
              {RANGE_OPTIONS.map((option) => (
                <Button
                  key={option.label}
                  variant={rangeDays === option.days ? "secondary" : "ghost"}
                  size="sm"
                  className="rounded-lg"
                  onClick={() => changeRange(option.days)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            {user?.role === "admin" ? (
              <Button onClick={() => runMutation.mutate()} disabled={runMutation.isPending}>
                {runMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
                Run Test
              </Button>
            ) : null}
            <Button variant="outline" onClick={exportResults} disabled={exportMutation.isPending}>
              {exportMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Export
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[360px] w-full">
            {isLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading chart data...</div>
            ) : chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center rounded-2xl border text-sm text-muted-foreground">
                No speedtest results in this range.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 18, left: 0, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" minTickGap={28} />
                  <YAxis yAxisId="speed" tickFormatter={(value) => `${value}`} />
                  <YAxis yAxisId="latency" orientation="right" tickFormatter={(value) => `${value}`} />
                  <Tooltip
                    labelFormatter={(_label, items) => formatDate(items?.[0]?.payload?.testedAt)}
                    formatter={(value, name) => [
                      formatNumber(value, name === "ping" ? " ms" : " Mbps"),
                      name === "download" ? "Download" : name === "upload" ? "Upload" : "Ping"
                    ]}
                  />
                  <Legend />
                  <Line yAxisId="speed" type="monotone" dataKey="download" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                  <Line yAxisId="speed" type="monotone" dataKey="upload" stroke="#0f766e" strokeWidth={2} dot={false} />
                  <Line yAxisId="latency" type="monotone" dataKey="ping" stroke="#b45309" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Results</CardTitle>
            <CardDescription>Raw speedtest measurements for the selected time range.</CardDescription>
          </div>
          <Badge variant="outline">{pagination.total || 0} total</Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Download</TableHead>
                <TableHead>Upload</TableHead>
                <TableHead>Ping</TableHead>
                <TableHead>Server</TableHead>
                <TableHead>ISP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No results found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((result) => (
                  <TableRow key={result.id}>
                    <TableCell className="whitespace-nowrap">{formatDate(result.testedAt)}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <Download className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatNumber(result.downloadMbps, " Mbps")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1">
                        <Upload className="h-3.5 w-3.5 text-muted-foreground" />
                        {formatNumber(result.uploadMbps, " Mbps")}
                      </span>
                    </TableCell>
                    <TableCell>{formatNumber(result.pingMs, " ms")}</TableCell>
                    <TableCell>{result.serverName || result.serverLocation || "Unknown"}</TableCell>
                    <TableCell>{result.isp || "Unknown"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
