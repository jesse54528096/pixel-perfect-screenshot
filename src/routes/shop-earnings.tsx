import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { ShopHeader } from "@/components/ShopHeader";
import { PAYOUT_STATUS_LABELS } from "@/lib/payouts";
import { formatMoney, usePlatformSettings } from "@/lib/profile";
import { DISPLAY_TZ_LABEL, dateLabel, dayKey } from "@/lib/time";
import { usePageMeta } from "@/lib/use-page-meta";
import { useShop } from "./require-shop";

type Line = { price: number; platform: number; shop: number; paidAt: string | null };

function totals(lines: Line[]) {
  return lines.reduce(
    (t, l) => ({
      count: t.count + 1,
      gross: t.gross + l.price,
      platform: t.platform + l.platform,
      shop: t.shop + l.shop,
    }),
    { count: 0, gross: 0, platform: 0, shop: 0 },
  );
}

// Read-only mirror of the admin's settlement data for the signed-in shop, all barbers
// combined. RLS limits every query here to this shop's own rows.
export function ShopEarningsPage() {
  usePageMeta("Earnings — Barberly", "What the platform owes you and what it has paid out.");
  const { user } = useShop();
  const { data: settings } = usePlatformSettings();
  const money = (n: number | null) => formatMoney(n ?? 0, settings);

  const { data: owed = [] } = useQuery({
    queryKey: ["shop-earnings", "owed", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owed_bookings")
        .select("*")
        .eq("shop_id", user.id)
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Cancelled payouts are left out: their bookings are back in the owed pool.
  const { data: payouts = [] } = useQuery({
    queryKey: ["shop-earnings", "payouts", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select(
          "id, status, created_at, marked_transferred_at, platform_pct, gross, platform_cut, shop_cut, bookings_count, bookings(id, price, paid_at, services(name, barbers(name)))",
        )
        .eq("shop_id", user.id)
        .neq("status", "cancelled")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const lines: Line[] = [
    ...owed.map((r) => ({
      price: r.price ?? 0,
      platform: r.platform_cut ?? 0,
      shop: r.shop_cut ?? 0,
      paidAt: r.paid_at,
    })),
    ...payouts.flatMap((p) =>
      p.bookings.map((b) => {
        const platform = Math.round(b.price * p.platform_pct);
        return { price: b.price, platform, shop: b.price - platform, paidAt: b.paid_at };
      }),
    ),
  ];
  const month = dayKey(new Date().toISOString()).slice(0, 7);
  const thisMonth = totals(lines.filter((l) => l.paidAt && dayKey(l.paidAt).startsWith(month)));
  const allTime = totals(lines);
  const owedTotal = owed.reduce((t, r) => t + (r.shop_cut ?? 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <ShopHeader email={user.email} />
      <main className="mx-auto max-w-4xl space-y-8 px-5 pb-20 md:px-8">
        <div className="animate-fade-up rounded-[2rem] bg-cream px-8 py-10">
          <h1 className="text-4xl font-semibold">收入 / Earnings</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            平台會分批結算並撥款給你 / We settle and pay out your earnings in batches. 日期皆為
            {DISPLAY_TZ_LABEL}。
          </p>
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          {[
            ["本月 / This month", thisMonth],
            ["累計 / All time", allTime],
          ].map(([label, t]) => {
            const s = t as ReturnType<typeof totals>;
            return (
              <div key={label as string} className="rounded-3xl bg-card p-6 shadow-soft">
                <h2 className="text-sm text-muted-foreground">{label as string}</h2>
                <p className="mt-2 text-3xl font-semibold">{money(s.shop)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {s.count} 筆預約 · 總額 {money(s.gross)} · 平台抽成 {money(s.platform)}
                </p>
              </div>
            );
          })}
        </section>

        <section className="space-y-3 rounded-3xl bg-card p-6 shadow-soft">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">尚未撥款 / Owed</h2>
            <span className="font-semibold">{money(owedTotal)}</span>
          </div>
          {owed.length === 0 && (
            <p className="text-sm text-muted-foreground">目前沒有待撥款項 / Nothing owed.</p>
          )}
          {owed.map((r) => (
            <div
              key={r.booking_id}
              className="flex justify-between border-t border-border pt-2 text-sm"
            >
              <span>
                {r.barber_name} · {r.paid_at ? dateLabel(r.paid_at) : "—"}
              </span>
              <span>
                {money(r.price)} → <span className="font-medium">{money(r.shop_cut)}</span>
              </span>
            </div>
          ))}
        </section>

        <section className="space-y-4 rounded-3xl bg-card p-6 shadow-soft">
          <h2 className="text-xl font-semibold">已納入撥款 / In a payout</h2>
          {payouts.length === 0 && (
            <p className="text-sm text-muted-foreground">還沒有撥款 / No payouts yet.</p>
          )}
          {payouts.map((p) => (
            <div key={p.id} className="space-y-2 border-t border-border pt-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium">
                  {PAYOUT_STATUS_LABELS[p.status] ?? p.status}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    {p.marked_transferred_at
                      ? `轉帳於 ${dateLabel(p.marked_transferred_at)}`
                      : `建立於 ${dateLabel(p.created_at)}`}
                  </span>
                </span>
                <span className="font-semibold">{money(p.shop_cut)}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {p.bookings_count} 筆 · 總額 {money(p.gross)} · 平台抽成 {money(p.platform_cut)}
              </p>
              <ul className="space-y-1 text-sm">
                {p.bookings.map((b) => (
                  <li key={b.id} className="flex justify-between">
                    <span>
                      {b.services?.barbers?.name} · {b.services?.name} ·{" "}
                      {b.paid_at ? dateLabel(b.paid_at) : "—"}
                    </span>
                    <span>{money(b.price)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
