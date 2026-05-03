import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import SpeedtestDashboard from "../components/SpeedtestDashboard.jsx";
import { Badge, Button } from "../components/ui.jsx";
import { apiFetch } from "../lib/api.js";
import { ErrorState, LoadingState, PageHeader } from "./shared.jsx";

export default function SpeedtestPage() {
  const { uid } = useParams();
  const { data, isLoading, error } = useQuery({
    queryKey: ["devices"],
    queryFn: () => apiFetch("/devices")
  });

  const device = useMemo(() => {
    const devices = data?.devices || [];
    return devices.find((item) => item.deviceUid === uid || item.id === uid);
  }, [data, uid]);

  if (isLoading) return <LoadingState title="Speedtest" />;
  if (error) return <ErrorState description={error.message} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Button asChild variant="link" className="h-auto p-0 text-muted-foreground">
          <Link to="/devices">Devices</Link>
        </Button>
        <ChevronRight className="h-4 w-4" />
        {device ? (
          <Button asChild variant="link" className="h-auto p-0 text-muted-foreground">
            <Link to={`/devices/${device.id}`}>{device.displayName}</Link>
          </Button>
        ) : (
          <span>{uid}</span>
        )}
        <ChevronRight className="h-4 w-4" />
        <span className="font-medium text-foreground">Speedtest</span>
      </div>

      <PageHeader
        eyebrow="Speedtest"
        title={device?.displayName ? `${device.displayName} speedtest` : "Speedtest"}
        description={device?.deviceUid || uid}
        actions={device?.status ? <Badge variant={device.status === "online" ? "success" : "warning"}>{device.status}</Badge> : null}
      />

      <SpeedtestDashboard deviceUid={device?.deviceUid || uid} />
    </div>
  );
}
