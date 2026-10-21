import { Navigate } from "react-router";

import { homePathFor, useProfile } from "@/lib/profile";
import { useAuthUser } from "./require-auth";

// Post-auth landing (sign-in and the sign-up email link): branch on profiles.role.
export function RoleHome() {
  const user = useAuthUser();
  const { data: profile, isPending } = useProfile(user.id);

  if (isPending) return null;
  return <Navigate to={homePathFor(profile?.role)} replace />;
}
