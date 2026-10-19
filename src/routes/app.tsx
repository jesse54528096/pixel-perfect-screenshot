import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/Wordmark";
import { usePageMeta } from "@/lib/use-page-meta";
import { useAuthUser } from "./require-auth";

export function BarbersPage() {
  usePageMeta("Barbers — Barberly", "Your Barberly home: barbers near you and your barber dashboard.");
  const user = useAuthUser();
  const isShop = user.user_metadata?.["role"] === "shop";

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-5 md:px-8">
        <Wordmark />
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden sm:inline">Hi {user.email}</span>
          {isShop && <span className="rounded-full bg-accent px-3 py-0.5 text-xs font-medium text-accent-foreground">barber</span>}
          <button onClick={() => supabase.auth.signOut()} className="rounded-full bg-primary px-5 py-2 font-medium text-primary-foreground transition hover:bg-primary/85">
            Sign Out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-20 md:px-8">
        <div className="animate-fade-up rounded-[2rem] bg-cream px-8 py-16 text-center">
          <h1 className="text-4xl font-semibold md:text-5xl">
            {isShop ? "Your barber dashboard" : "Barbers near you"}
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-foreground/80">
            {isShop
              ? "理髮師後台即將上線 — 下一個里程碑會加上個人檔案、服務項目與排班管理。"
              : "附近的理髮師即將上線 — 下一個里程碑會加上瀏覽與預約功能。"}
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            {isShop
              ? "Your barber dashboard is coming soon — profile, services & schedule arrive in the next milestone."
              : "Barbers near you are coming soon — browse & booking arrive in the next milestone."}
          </p>
        </div>
      </main>
    </div>
  );
}
