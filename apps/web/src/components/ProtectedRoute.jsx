import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.js";
import { LoadingState } from "../pages/shared.jsx";

export default function ProtectedRoute({ children, role }) {
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);
  const hydrating = useAuthStore((state) => state.hydrating);

  if (!hydrated || hydrating) {
    return <LoadingState title="Restoring session" />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}
