import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { CustomerHeader } from "@/components/CustomerHeader";
import { ghostButtonClass } from "@/components/ShopHeader";
import { errMessage } from "@/lib/errors";
import { formatMoney, usePlatformSettings } from "@/lib/profile";
import { DISPLAY_TZ_LABEL, rangeLabel } from "@/lib/time";
import { usePageMeta } from "@/lib/use-page-meta";
import { useAuthUser } from "./require-auth";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "已預約（待付款）",
  paid: "已付款",
  cancelled: "已取消",
};

// The signed-in customer's own bookings (RLS returns only their rows).
export function MyBookingsPage() {
  usePageMeta("My bookings — Barberly", "Your Barberly bookings.");
  const user = useAuthUser();
  const queryClient = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const [cancelling, setCancelling] = useState<string | null>(null);
  const queryKey = ["my-bookings", user.id];

  const { data: bookings = [], isPending } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings_with_start")
        .select("id, status, price, starts_at, ends_at, services(name, barber_id, barbers(name))")
        .eq("customer_id", user.id)
        .order("starts_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Only the status changes; the database trigger frees the held slots.
  async function cancel(id: string) {
    if (!window.confirm("確定要取消這筆預約嗎？")) return;
    setCancelling(id);
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", id);
    setCancelling(null);
    if (error) {
      toast.error(errMessage(error, "取消失敗 / Could not cancel the booking."));
      return;
    }
    toast.success("預約已取消 / Booking cancelled");
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({ queryKey: ["availability"] });
  }

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <main className="mx-auto max-w-3xl space-y-6 px-5 pb-20 md:px-8">
        <div className="animate-fade-up rounded-[2rem] bg-cream px-8 py-10">
          <h1 className="text-4xl font-semibold">我的預約 / My bookings</h1>
          <p className="mt-2 text-sm text-muted-foreground">時間皆為{DISPLAY_TZ_LABEL}</p>
        </div>
        {!isPending && bookings.length === 0 && (
          <p className="text-center text-muted-foreground">
            還沒有預約。
            <Link to="/barbers" className="underline underline-offset-4">
              去找理髮師 →
            </Link>
          </p>
        )}
        {bookings.map((b) => (
          <div
            key={b.id}
            className="flex flex-wrap items-center gap-4 rounded-3xl bg-card p-6 shadow-soft"
          >
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold">
                {b.services?.barbers?.name ?? "理髮師"} · {b.services?.name}
              </h2>
              <p className="text-sm text-muted-foreground">
                {b.starts_at && b.ends_at ? rangeLabel(b.starts_at, b.ends_at) : "—"}
              </p>
              <p className="mt-1 text-sm">
                {formatMoney(b.price ?? 0, settings)} ·{" "}
                <span
                  className={b.status === "cancelled" ? "text-muted-foreground" : "font-medium"}
                >
                  {STATUS_LABELS[b.status ?? ""] ?? b.status}
                </span>
              </p>
            </div>
            {b.status !== "cancelled" && b.id && (
              <button
                onClick={() => cancel(b.id!)}
                disabled={cancelling === b.id}
                className={`${ghostButtonClass} text-destructive`}
              >
                {cancelling === b.id ? "取消中…" : "取消 / Cancel"}
              </button>
            )}
          </div>
        ))}
      </main>
    </div>
  );
}
