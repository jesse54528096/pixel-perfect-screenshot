import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/Wordmark";
import { useProfile } from "@/lib/profile";
import { usePageMeta } from "@/lib/use-page-meta";
import { useAuthUser } from "./require-auth";

export function BarbersPage() {
  usePageMeta("Barbers — Barberly", "Your Barberly home: barbers near you.");
  const user = useAuthUser();
  const { data: profile, isPending } = useProfile(user.id);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  if (isPending) return null;
  if (profile?.role === "shop") return <Navigate to="/shop" replace />;

  async function becomeShop() {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ role: "shop" }).eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    navigate("/shop");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-5 py-5 md:px-8">
        <Wordmark />
        <div className="ml-auto flex items-center gap-3 text-sm">
          <span className="hidden sm:inline">Hi {user.email}</span>
          <button
            onClick={becomeShop}
            disabled={busy}
            className="rounded-full border border-input px-5 py-2 font-medium transition hover:bg-muted disabled:opacity-60"
          >
            開店 / Become a shop
          </button>
          <button
            onClick={() => supabase.auth.signOut()}
            className="rounded-full bg-primary px-5 py-2 font-medium text-primary-foreground transition hover:bg-primary/85"
          >
            Sign Out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-5 py-20 md:px-8">
        <div className="animate-fade-up rounded-[2rem] bg-cream px-8 py-16 text-center">
          <h1 className="text-4xl font-semibold md:text-5xl">Barbers near you</h1>
          <p className="mx-auto mt-6 max-w-lg text-foreground/80">
            附近的理髮師即將上線 — 下一個里程碑會加上瀏覽與預約功能。
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground">
            Barbers near you are coming soon — browse &amp; booking arrive in the next milestone.
          </p>
        </div>
      </main>
    </div>
  );
}
