import type { ReactNode } from "react";
import { useAuthStore } from "../store/authStore";
import { AccessDenied } from "./ui/AccessDenied";

export function ModuleGate({ module, children }: { module: string; children: ReactNode }) {
  const role = useAuthStore((s) => s.user?.role);
  const allowed = role?.is_admin || role?.allowed_modules.includes(module);

  if (!allowed) {
    return <AccessDenied message="You don't have permission to access this module. Contact your admin." />;
  }

  return <>{children}</>;
}
