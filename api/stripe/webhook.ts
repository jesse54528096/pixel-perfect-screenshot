import Stripe from "stripe";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "../_supabaseAdmin.js";

// Signature verification needs the raw bytes, so Vercel must not parse the body.
export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

async function rawBody(req: VercelRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req)
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

// The only code path that marks a booking paid. No split is computed here (that's M2.2).
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const buf = await rawBody(req);
  const sig = req.headers["stripe-signature"];

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      buf,
      typeof sig === "string" ? sig : "",
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch {
    return res.status(400).json({ error: "signature verification failed" });
  }

  if (event.type !== "checkout.session.completed") {
    return res.status(200).json({ received: true });
  }
  const session = event.data.object;
  if (session.payment_status !== "paid") return res.status(200).json({ received: true });

  const bookingId = session.metadata?.booking_id;
  if (!bookingId) return res.status(400).json({ error: "missing booking_id metadata" });

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  // The status guard makes re-delivered events a no-op: an already-paid booking matches no rows.
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId ?? null,
    })
    .eq("id", bookingId)
    .eq("status", "pending_payment")
    .select("id");
  if (error) {
    console.error("booking update failed", bookingId, error);
    return res.status(500).json({ error: "booking update failed" }); // Stripe retries
  }
  if (!data?.length) {
    // Already paid (a retry), or cancelled while the customer was on Checkout: needs a refund by hand.
    console.warn(
      "checkout completed but booking was not pending_payment",
      bookingId,
      paymentIntentId,
    );
  }

  return res.status(200).json({ received: true });
}
