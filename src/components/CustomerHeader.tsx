import { Link, NavLink } from "react-router";

import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/Wordmark";
import { useProfile } from "@/lib/profile";
import { useSessionUser } from "@/lib/use-session-user";

const tab = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-1.5 transition ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`;

export function CustomerHeader() {
  const user = useSessionUser();

  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-5 md:px-8">
      <Wordmark />
      <nav className="flex items-center gap-1 text-sm">
        <NavLink to="/barbers" end className={tab}>
          理髮師 / Barbers
        </NavLink>
        {user && (
          <NavLink to="/bookings" className={tab}>
            我的預約 / My bookings
          </NavLink>
        )}
        {user && <ShopLink userId={user.id} />}
      </nav>
      <div className="ml-auto flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="hidden sm:inline">Hi {user.email}</span>
            <button
              onClick={() => supabase.auth.signOut()}
              className="rounded-full bg-primary px-5 py-2 font-medium text-primary-foreground transition hover:bg-primary/85"
            >
              Sign Out
            </button>
          </>
        ) : user === null ? (
          <Link
            to="/sign-in"
            className="rounded-full bg-primary px-5 py-2 font-medium text-primary-foreground transition hover:bg-primary/85"
          >
            Sign In
          </Link>
        ) : null}
      </div>
    </header>
  );
}

// Shops browsing the marketplace keep a way back to their own pages.
function ShopLink({ userId }: { userId: string }) {
  const { data: profile } = useProfile(userId);
  if (profile?.role !== "shop") return null;
  return (
    <NavLink to="/shop" className={tab}>
      我的店 / My shop
    </NavLink>
  );
}
