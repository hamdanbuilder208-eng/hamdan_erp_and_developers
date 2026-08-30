import { Navigate, Outlet } from "react-router-dom";
import { useCustomerAuthStore } from "../store/customerAuthStore";

export function CustomerProtectedRoute() {
  const token = useCustomerAuthStore((s) => s.token);
  if (!token) {
    return <Navigate to="/portal/login" replace />;
  }
  return <Outlet />;
}
