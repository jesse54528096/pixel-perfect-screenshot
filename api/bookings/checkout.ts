import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";
// Relative imports need the .js extension at runtime ("type": "module").
import { supabaseAdmin } from "../_supabaseAdmin.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Stripe's zero-decimal currencies. Everything else (TWD included) is 2-decimal in Stripe,
// so NT$300 → unit_amount 30000. platform_settings.currency_minor_units is display-only.
const ZERO_DECIMAL = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);

type BookingRow = {
  id: string;
  customer_id: string;
  status: string;
  price: number;
  services: { name: string; barber_id: string; barbers: { name: string } | null } | null;
};

// POST { booking_id } with the customer's Supabase access token → { url } of a Checkout Session.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  // Only the booking's own customer may start paying for it.
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "not signed in" });
  const { data: auth, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !auth.user) return res.status(401).json({ error: "not signed in" });

  const bookingId = (req.body as { booking_id?: unknown } | undefined)?.booking_id;
  if (typeof bookingId !== "string") return res.status(400).json({ error: "booking_id required" });

  // Price comes from the booking's server-side snapshot, never from the client.
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select("id, customer_id, status, price, services(name, barber_id, barbers(name))")
    .eq("id", bookingId)
    .maybeSingle();
  const booking = data as BookingRow | null;
  if (error) return res.status(500).json({ error: "could not load booking" });
  if (!booking || booking.customer_id !== auth.user.id) {
    return res.status(404).json({ error: "booking not found" });
  }
  if (booking.status !== "pending_payment" || !booking.services) {
    return res.status(400).json({ error: "booking not payable" });
  }

  const { data: cfg, error: cfgError } = await supabaseAdmin
    .from("platform_settings")
    .select("currency")
    .single();
  if (cfgError || !cfg) return res.status(500).json({ error: "platform settings missing" });
  const currency = String(cfg.currency).toLowerCase();
  const factor = ZERO_DECIMAL.has(currency) ? 1 : 100;

  const origin =
    (req.headers.origin as string | undefined) ?? `https://${req.headers.host as string}`;
  const barberName = booking.services.barbers?.name ?? "Barber";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: `${booking.services.name} @ ${barberName}` },
            unit_amount: booking.price * factor,
          },
          quantity: 1,
        },
      ],
      metadata: { booking_id: booking.id, customer_id: booking.customer_id },
      client_reference_id: booking.id,
      // The success page polls by booking_id; session_id is only along for debugging.
      success_url: `${origin}/bookings/success?booking_id=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/barbers/${booking.services.barber_id}`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("checkout session create failed", err);
    return res.status(502).json({ error: "could not start checkout" });
  }
}
