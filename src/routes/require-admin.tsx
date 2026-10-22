import { Navigate, Outlet } from "react-router";

import { useProfile } from "@/lib/profile";
import { useAuthUser } from "./require-auth";

// Admin pages gate on profiles.role = 'admin'. This is UX only: RLS and the
// admin-guarded RPCs are what actually keep non-admins out of the payout data.
export function RequireAdmin() {
  const user = useAuthUser();
  const { data: profile, isPending } = useProfile(user.id);

  if (isPending) return null;
  if (profile?.role !== "admin") return <Navigate to="/barbers" replace />;
  return <Outlet />;
}
