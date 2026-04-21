import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "../components/ui.jsx";
import { apiFetch } from "../lib/api.js";
import { PageHeader } from "./shared.jsx";

export default function PairDevicePage() {
  const [code, setCode] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/pairing/complete", {
        method: "POST",
        body: JSON.stringify({ code })
      })
  });

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Provisioning" title="Pair a new device" description="Complete pairing with the one-time code shown by the edge agent and retrieve its credential." />
      <Card className="max-w-3xl rounded-3xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border p-3">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Pairing code</CardTitle>
              <CardDescription>Codes are short-lived and single-use.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Code</label>
            <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="Enter device pairing code" />
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!code || mutation.isPending}>
            Complete pairing
          </Button>
          {mutation.data ? (
            <Alert variant="success">
              <AlertTitle>Device paired</AlertTitle>
              <AlertDescription>
                Credential for <strong>{mutation.data.device.displayName}</strong>:
                <pre className="mt-3 rounded-xl border bg-muted p-3 text-xs">{mutation.data.credential}</pre>
              </AlertDescription>
            </Alert>
          ) : null}
          {mutation.error ? (
            <Alert variant="destructive">
              <AlertTitle>Pairing failed</AlertTitle>
              <AlertDescription>{mutation.error.message}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
