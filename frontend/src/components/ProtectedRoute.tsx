import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { tokenStore } from "../auth/authStore";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const tokens = tokenStore.get();
  if (!tokens?.access) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
