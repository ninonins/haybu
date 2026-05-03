import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../lib/api.js";

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function useSpeedtestResults(deviceUid, { limit = 50, offset = 0, start, end } = {}) {
  return useQuery({
    queryKey: ["speedtest-results", deviceUid, { limit, offset, start, end }],
    enabled: Boolean(deviceUid),
    queryFn: () =>
      apiFetch(
        `/devices/${deviceUid}/modules/speedtest/results${buildQuery({
          limit,
          offset,
          start,
          end
        })}`
      )
  });
}

export function useSpeedtestSummary(deviceUid, days = 7) {
  return useQuery({
    queryKey: ["speedtest-summary", deviceUid, days],
    enabled: Boolean(deviceUid),
    queryFn: () => apiFetch(`/devices/${deviceUid}/modules/speedtest/summary${buildQuery({ days })}`)
  });
}

export function useExportSpeedtest(deviceUid, format = "csv") {
  return useMutation({
    mutationFn: (nextFormat = format) =>
      apiFetch(`/devices/${deviceUid}/modules/speedtest/export`, {
        method: "POST",
        body: JSON.stringify({ format: nextFormat })
      })
  });
}

export function useRunSpeedtest(deviceUid) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch(`/devices/${deviceUid}/modules/speedtest/run`, {
        method: "POST",
        body: JSON.stringify({ action: "run" })
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["device-modules", deviceUid] });
      await queryClient.invalidateQueries({ queryKey: ["speedtest-results", deviceUid] });
      await queryClient.invalidateQueries({ queryKey: ["speedtest-summary", deviceUid] });
    }
  });
}
