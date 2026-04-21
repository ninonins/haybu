import { Navigate } from "react-router-dom";
import { useAuthStore } from "../store/auth.js";

export default function ProtectedRoute({ children, role }) {
  const user = useAuthStore((state) => state.user);
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (role && user.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
}
