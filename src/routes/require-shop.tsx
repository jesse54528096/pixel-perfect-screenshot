import type { User } from "@supabase/supabase-js";
import { Navigate, Outlet, useOutletContext } from "react-router";

import { useProfile, type Profile } from "@/lib/profile";
import { useAuthUser } from "./require-auth";

type ShopContext = { user: User; profile: Profile };

// Shop pages gate on profiles.role = 'shop'; everyone else goes to the customer home.
export function RequireShop() {
  const user = useAuthUser();
  const { data: profile, isPending } = useProfile(user.id);

  if (isPending) return null;
  if (profile?.role !== "shop") return <Navigate to="/app" replace />;
  return <Outlet context={{ user, profile } satisfies ShopContext} />;
}

export function useShop() {
  return useOutletContext<ShopContext>();
}
