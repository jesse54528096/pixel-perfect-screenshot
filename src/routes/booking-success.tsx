import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";

import { supabase } from "@/integrations/supabase/client";
import { CustomerHeader } from "@/components/CustomerHeader";
import { primaryButtonClass } from "@/components/ShopHeader";
import { formatMoney, usePlatformSettings } from "@/lib/profile";
import { rangeLabel } from "@/lib/time";
import { usePageMeta } from "@/lib/use-page-meta";

// Where Stripe sends the customer after paying. Read-only: it polls the booking until the
// webhook marks it paid. The webhook, not this page, is what confirms the booking.
export function BookingSuccessPage() {
  usePageMeta("Payment — Barberly", "Your Barberly payment.");
  const [params] = useSearchParams();
  const bookingId = params.get("booking_id");
  const { data: settings } = usePlatformSettings();

  const { data: booking, isPending } = useQuery({
    queryKey: ["booking-success", bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings_with_start")
        .select("id, status, price, starts_at, ends_at, services(name, barbers(name))")
        .eq("id", bookingId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: (query) => (query.state.data?.status === "pending_payment" ? 1500 : false),
  });

  const paid = booking?.status === "paid";

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <main className="mx-auto max-w-xl px-5 pb-20 md:px-8">
        <div className="animate-fade-up space-y-4 rounded-[2rem] bg-cream px-8 py-10 text-center">
          {!bookingId || (!isPending && !booking) ? (
            <h1 className="text-3xl font-semibold">找不到這筆預約 / Booking not found</h1>
          ) : paid ? (
            <h1 className="text-3xl font-semibold">預約成功！/ You're booked</h1>
          ) : booking?.status === "cancelled" ? (
            <h1 className="text-3xl font-semibold">這筆預約已取消 / Booking cancelled</h1>
          ) : (
            <h1 className="text-3xl font-semibold">付款處理中… / Confirming payment…</h1>
          )}
          {booking && (
            <p className="text-muted-foreground">
              {booking.services?.barbers?.name ?? "理髮師"} · {booking.services?.name}
              <br />
              {booking.starts_at && booking.ends_at
                ? rangeLabel(booking.starts_at, booking.ends_at)
                : ""}
              {" · "}
              {formatMoney(booking.price ?? 0, settings)}
            </p>
          )}
          <Link to="/bookings" className={`${primaryButtonClass} inline-block`}>
            查看我的預約 / My bookings
          </Link>
        </div>
      </main>
    </div>
  );
}
