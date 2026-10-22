import { NavLink } from "react-router";

import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/Wordmark";

const tab = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-4 py-1.5 transition ${isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`;

export function ShopHeader({ email }: { email: string | undefined }) {
  return (
    <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-5 md:px-8">
      <Wordmark />
      <nav className="flex items-center gap-1 text-sm">
        <NavLink to="/shop" end className={tab}>
          Shop setup
        </NavLink>
        <NavLink to="/shop/bookings" className={tab}>
          Services &amp; slots
        </NavLink>
        <NavLink to="/shop/earnings" className={tab}>
          收入 / Earnings
        </NavLink>
      </nav>
      <div className="ml-auto flex items-center gap-3 text-sm">
        <span className="hidden sm:inline">Hi {email}</span>
        <span className="rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-accent-foreground">
          barber
        </span>
        <button
          onClick={() => supabase.auth.signOut()}
          className="rounded-full bg-primary px-5 py-2 font-medium text-primary-foreground transition hover:bg-primary/85"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}

export const fieldClass =
  "mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-2.5 outline-none focus:border-ring";
export const primaryButtonClass =
  "rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/85 disabled:opacity-60";
export const ghostButtonClass =
  "rounded-full border border-input px-4 py-1.5 text-sm transition hover:bg-muted disabled:opacity-60";
