import type { User } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Navigate, Outlet, useOutletContext } from "react-router";

import { supabase } from "@/integrations/supabase/client";

type AuthContext = { user: User };

// Client-only gate for signed-in pages: the session lives in browser storage.
export function RequireAuth() {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active) setUser(data.user);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (user === undefined) return null;
  if (user === null) return <Navigate to="/sign-in" replace />;
  return <Outlet context={{ user } satisfies AuthContext} />;
}

export function useAuthUser() {
  return useOutletContext<AuthContext>().user;
}
