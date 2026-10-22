import { supabase } from "@/integrations/supabase/client";

// Ask our /api function for a Stripe Checkout URL for one of the signed-in customer's
// pending_payment bookings, then leave the app for Stripe's hosted payment page.
export async function goToCheckout(bookingId: string) {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("請先登入 / Please sign in again.");

  const res = await fetch("/api/bookings/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ booking_id: bookingId }),
  });
  const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !body.url) {
    throw new Error(body.error ?? "無法前往付款 / Could not start checkout.");
  }
  window.location.assign(body.url);
}
