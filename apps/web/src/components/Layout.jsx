import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Button } from "./ui.jsx";
import { useAuthStore } from "../store/auth.js";

export default function Layout() {
  const navigate = useNavigate();
  const { user, clearSession } = useAuthStore();

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          Heartbeat
        </Link>
        <nav className="nav">
          <NavLink to="/">Dashboard</NavLink>
          <NavLink to="/devices">Devices</NavLink>
          <NavLink to="/reports">Reports</NavLink>
          {user?.role === "admin" ? <NavLink to="/pair-device">Pair Device</NavLink> : null}
          {user?.role === "admin" ? <NavLink to="/admin-settings">Admin Settings</NavLink> : null}
          {user?.role === "admin" ? <NavLink to="/users">Users</NavLink> : null}
        </nav>
        <div className="sidebar-footer">
          <div>{user?.email}</div>
          <Button
            onClick={() => {
              clearSession();
              navigate("/login");
            }}
          >
            Sign out
          </Button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
