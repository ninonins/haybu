import { Activity, Bell, FileText, Gauge, HardDrive, LaptopMinimal, Menu, Search, Settings, Shield, UserCog } from "lucide-react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, Badge, Button, Input, ScrollArea, Separator } from "./ui.jsx";
import { useAuthStore } from "../store/auth.js";
import { ThemeToggle } from "./theme-toggle.jsx";
import { cn } from "../lib/utils.js";

const items = [
  { to: "/", label: "Dashboard", icon: Gauge, admin: false },
  { to: "/devices", label: "Devices", icon: LaptopMinimal, admin: false },
  { to: "/reports", label: "Reports", icon: FileText, admin: false },
  { to: "/pair-device", label: "Pair Device", icon: Activity, admin: true },
  { to: "/admin-settings", label: "Admin Settings", icon: Settings, admin: true },
  { to: "/users", label: "Users", icon: UserCog, admin: true }
];

export default function AppShell() {
  const { user, clearSession } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="dashboard-grid min-h-screen bg-[radial-gradient(circle_at_top,hsl(var(--primary)/0.14),transparent_25%)]">
        <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 lg:grid-cols-[320px_1fr]">
          <aside className="border-r border-sidebar-border bg-sidebar/95 p-4 backdrop-blur-xl">
            <div className="flex h-full flex-col rounded-[28px] border border-sidebar-border bg-sidebar px-4 py-5">
              <div className="mb-6 flex items-center gap-3 px-2">
                <div className="rounded-xl border border-border bg-background/70 p-2">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <Link to="/" className="text-xl font-semibold tracking-tight">
                    Heartbeat
                  </Link>
                  <p className="text-sm text-muted-foreground">Device operations</p>
                </div>
              </div>
              <Button className="mb-4 justify-start rounded-xl" variant="secondary">
                <Activity className="mr-2 h-4 w-4" />
                Quick Create
              </Button>
              <ScrollArea className="flex-1 pr-2">
                <nav className="space-y-1">
                  {items
                    .filter((item) => !item.admin || user?.role === "admin")
                    .map((item) => {
                      const Icon = item.icon;
                      const active = location.pathname === item.to;
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          className={cn(
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                            active && "bg-sidebar-accent text-sidebar-accent-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </NavLink>
                      );
                    })}
                </nav>
              </ScrollArea>
              <Separator className="my-4" />
              <div className="flex items-center gap-3 rounded-xl bg-accent/50 p-3">
                <Avatar>
                  <AvatarFallback>{user?.email?.slice(0, 2).toUpperCase() || "HB"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">{user?.role === "admin" ? "Administrator" : "Viewer"}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    clearSession();
                    navigate("/login");
                  }}
                >
                  Sign out
                </Button>
              </div>
            </div>
          </aside>
          <div className="flex min-w-0 flex-col">
            <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
              <div className="flex h-20 items-center gap-4 px-6 lg:px-10">
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
                <div className="relative hidden max-w-md flex-1 md:block">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="rounded-xl pl-9" placeholder="Search devices, reports, services..." />
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <Badge variant="outline" className="rounded-full px-3 py-1">
                    {user?.role === "admin" ? "Admin" : "Viewer"}
                  </Badge>
                  <Button variant="ghost" size="icon">
                    <Bell className="h-4 w-4" />
                  </Button>
                  <ThemeToggle />
                  <Button variant="outline" className="hidden rounded-xl md:inline-flex">
                    GitHub
                  </Button>
                </div>
              </div>
            </header>
            <main className="flex-1 px-6 py-6 lg:px-10">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
