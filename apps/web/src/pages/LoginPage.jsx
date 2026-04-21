import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Activity, ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input } from "../components/ui.jsx";
import { apiFetch } from "../lib/api.js";
import { useAuthStore } from "../store/auth.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState("admin@example.com");
  const [password, setPassword] = useState("ChangeMe123!");
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      const response = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      setSession(response);
      navigate("/");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <div className="hidden border-r border-border/60 bg-[radial-gradient(circle_at_top,hsl(var(--chart-1)/0.18),transparent_30%)] p-10 lg:flex lg:flex-col">
          <div className="mb-12 flex items-center gap-3">
            <div className="rounded-2xl border bg-card p-3">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <div className="text-xl font-semibold">Haybu</div>
              <div className="text-sm text-muted-foreground">Device heartbeat and uptime operations</div>
            </div>
          </div>
          <div className="mt-auto space-y-6">
            <h1 className="max-w-xl text-5xl font-semibold tracking-tight">Operate devices, uptime, and service health from one clean command surface.</h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Review monitored services, retention policy, pairing state, and raw-history controls without the dev-dashboard aesthetic.
            </p>
          </div>
        </div>
        <div className="flex items-center justify-center p-6">
          <Card className="w-full max-w-md rounded-3xl">
            <CardHeader className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border bg-secondary p-3">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Sign in</CardTitle>
                  <CardDescription>Use your encrypted portal credentials to continue.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input value={email} onChange={(event) => setEmail(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Password</label>
                  <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
                </div>
                {error ? (
                  <Alert variant="destructive">
                    <AlertTitle>Login failed</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                <Button className="w-full rounded-xl" type="submit">
                  Access workspace
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
