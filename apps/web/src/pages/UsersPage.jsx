import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ShieldPlus } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui.jsx";
import { apiFetch } from "../lib/api.js";
import { ErrorState, LoadingState, PageHeader } from "./shared.jsx";

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("viewer");

  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => apiFetch("/users")
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch("/users", {
        method: "POST",
        body: JSON.stringify({ email, password, role })
      }),
    onSuccess: () => {
      setEmail("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    }
  });

  if (isLoading) return <LoadingState title="Users" />;
  if (error) return <ErrorState description={error.message} />;

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Administration" title="Portal users" description="Manage encrypted access for operators and viewers." />
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="rounded-3xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-2xl border p-3">
                <ShieldPlus className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Create account</CardTitle>
                <CardDescription>Add an admin or viewer.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Password</label>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Role</label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="viewer">viewer</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>Create user</Button>
            {mutation.error ? (
              <Alert variant="destructive">
                <AlertTitle>Create failed</AlertTitle>
                <AlertDescription>{mutation.error.message}</AlertDescription>
              </Alert>
            ) : null}
            {mutation.isSuccess ? (
              <Alert variant="success">
                <AlertTitle>User created</AlertTitle>
                <AlertDescription>The account is ready for sign-in.</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardHeader>
            <CardTitle>Existing users</CardTitle>
            <CardDescription>Current portal access roster.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>
                      <Badge variant={user.status === "active" ? "success" : "warning"}>{user.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
