import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, LaptopMinimal, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui.jsx";
import { apiFetch } from "../lib/api.js";
import { ErrorState, LoadingState, PageHeader } from "./shared.jsx";

function badgeVariant(status) {
  if (status === "online") return "success";
  if (status === "offline") return "danger";
  return "warning";
}

export default function DevicesPage() {
  const [query, setQuery] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["devices"],
    queryFn: () => apiFetch("/devices")
  });

  const devices = useMemo(() => {
    const all = data?.devices || [];
    const normalized = query.trim().toLowerCase();
    if (!normalized) return all;
    return all.filter(
      (device) =>
        device.displayName.toLowerCase().includes(normalized) ||
        device.deviceUid.toLowerCase().includes(normalized)
    );
  }, [data, query]);

  if (isLoading) return <LoadingState title="Devices" />;
  if (error) return <ErrorState description={error.message} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="Device fleet"
        description="Track live heartbeat status, pairing state, and recent operator activity across all registered devices."
      />

      <Card className="rounded-3xl">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Registered devices</CardTitle>
            <CardDescription>{devices.length} devices match the current filter.</CardDescription>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Search by hostname, label, or device UID" />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Device</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pairing</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead className="text-right">Open</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl border p-2">
                        <LaptopMinimal className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium">{device.displayName}</div>
                        <div className="text-xs text-muted-foreground">{device.deviceUid}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={badgeVariant(device.status)}>{device.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={device.pairedAt ? "success" : "warning"}>{device.pairedAt ? "paired" : "unpaired"}</Badge>
                  </TableCell>
                  <TableCell>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : "Never"}</TableCell>
                  <TableCell className="text-right">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/devices/${device.id}`}>
                        Open
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
