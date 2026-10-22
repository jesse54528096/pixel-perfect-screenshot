import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CustomerHeader } from "@/components/CustomerHeader";
import { fieldClass, ghostButtonClass, primaryButtonClass } from "@/components/ShopHeader";
import { errMessage } from "@/lib/errors";
import { PAYOUT_STATUS_LABELS } from "@/lib/payouts";
import { formatMoney, usePlatformSettings } from "@/lib/profile";
import { DISPLAY_TZ_LABEL, dateLabel, dayKey } from "@/lib/time";
import { usePageMeta } from "@/lib/use-page-meta";

type Owed = Tables<"owed_bookings">;
type Payout = Tables<"payouts">;
type Person = Pick<
  Tables<"profiles">,
  "id" | "email" | "display_name" | "bank_account_name" | "bank_account_number"
>;

function sumBy(rows: Owed[], key: "price" | "platform_cut" | "shop_cut") {
  return rows.reduce((total, r) => total + (r[key] ?? 0), 0);
}

// Admin-only settlement page: build per-shop payouts from the owed pool, then record
// the bank transfer (done outside the app) or cancel a batch before it's transferred.
export function AdminPayoutsPage() {
  usePageMeta("Payouts — Barberly", "Settle what the platform owes each shop.");
  const queryClient = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const money = (n: number | null) => formatMoney(n ?? 0, settings);

  const { data: owed = [], isPending: owedPending } = useQuery({
    queryKey: ["admin", "owed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("owed_bookings")
        .select("*")
        .order("paid_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: payouts = [] } = useQuery({
    queryKey: ["admin", "payouts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Customer emails for the owed list + shop bank details for the transfer.
  const { data: people = new Map<string, Person>() } = useQuery({
    queryKey: ["admin", "people"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, display_name, bank_account_name, bank_account_number");
      if (error) throw error;
      return new Map(data.map((p) => [p.id, p]));
    },
  });

  const [shopFilter, setShopFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const shops = useMemo(() => {
    const map = new Map<string, string>();
    owed.forEach((r) => r.shop_id && map.set(r.shop_id, r.shop_name ?? "—"));
    return [...map];
  }, [owed]);
  const customers = useMemo(
    () => [...new Set(owed.map((r) => r.customer_id).filter((id): id is string => !!id))],
    [owed],
  );

  // Filters are only WHERE clauses over the live owed pool (dates in Taiwan time).
  const shown = owed.filter((r) => {
    const day = r.paid_at ? dayKey(r.paid_at) : "";
    return (
      (!shopFilter || r.shop_id === shopFilter) &&
      (!customerFilter || r.customer_id === customerFilter) &&
      (!from || day >= from) &&
      (!to || day <= to)
    );
  });

  // Totals come from the checked rows themselves, so they always match the build.
  const selected = owed.filter((r) => r.booking_id && checked.has(r.booking_id));
  const selectedShop = selected[0]?.shop_id ?? null;

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectShopThisMonth() {
    if (!shopFilter) return;
    const month = dayKey(new Date().toISOString()).slice(0, 7);
    const ids = owed
      .filter((r) => r.shop_id === shopFilter && r.paid_at && dayKey(r.paid_at).startsWith(month))
      .map((r) => r.booking_id!);
    setChecked(new Set(ids));
    if (ids.length === 0) toast("這間店本月沒有欠款 / Nothing owed this month for this shop.");
  }

  async function refresh() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "owed"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "payouts"] }),
    ]);
  }

  async function build() {
    if (selected.length === 0) return;
    setBusy("build");
    const { error } = await supabase.rpc("build_payout", {
      p_booking_ids: selected.map((r) => r.booking_id!),
      ...(note.trim() ? { p_note: note.trim() } : {}),
    });
    setBusy(null);
    if (error) {
      toast.error(errMessage(error, "建立撥款失敗 / Could not build the payout."));
      return;
    }
    toast.success("已建立撥款，請到銀行轉帳 / Payout built — now make the bank transfer.");
    setChecked(new Set());
    setNote("");
    await refresh();
  }

  async function markTransferred(p: Payout) {
    const ref = window.prompt(
      `確認已轉帳 ${money(p.shop_cut)} 給 ${p.shop_name ?? "店家"}？\n可輸入轉帳備註／參考號碼（可留白）`,
    );
    if (ref === null) return;
    setBusy(p.id);
    const { error } = await supabase.rpc("mark_payout_transferred", {
      p_payout_id: p.id,
      ...(ref.trim() ? { p_bank_reference: ref.trim() } : {}),
    });
    setBusy(null);
    if (error) {
      toast.error(errMessage(error, "標記失敗 / Could not mark as transferred."));
      return;
    }
    toast.success("已標記為已轉帳 / Marked as transferred");
    await refresh();
  }

  async function cancel(p: Payout) {
    if (!window.confirm("取消這筆撥款？其中的預約會回到欠款清單。")) return;
    setBusy(p.id);
    const { error } = await supabase.rpc("cancel_payout", { p_payout_id: p.id });
    setBusy(null);
    if (error) {
      toast.error(errMessage(error, "取消失敗 / Could not cancel the payout."));
      return;
    }
    toast.success("撥款已取消 / Payout cancelled");
    await refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-5 pb-20 md:px-8">
        <div className="animate-fade-up rounded-[2rem] bg-cream px-8 py-10">
          <h1 className="text-4xl font-semibold">撥款 / Payouts</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            勾選同一間店的欠款建立撥款，到網銀轉帳後再回來標記已轉帳。日期皆為{DISPLAY_TZ_LABEL}。
          </p>
        </div>

        <section className="space-y-4 rounded-3xl bg-card p-6 shadow-soft">
          <h2 className="text-xl font-semibold">欠款清單 / Owed bookings</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-sm">
              店家 / Shop
              <select
                value={shopFilter}
                onChange={(e) => setShopFilter(e.target.value)}
                className={fieldClass}
              >
                <option value="">全部 / All</option>
                {shops.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              顧客 / Customer
              <select
                value={customerFilter}
                onChange={(e) => setCustomerFilter(e.target.value)}
                className={fieldClass}
              >
                <option value="">全部 / All</option>
                {customers.map((id) => (
                  <option key={id} value={id}>
                    {people.get(id)?.email ?? id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              付款日起 / Paid from
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="text-sm">
              付款日迄 / Paid to
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={fieldClass}
              />
            </label>
          </div>
          {shopFilter && (
            <button onClick={selectShopThisMonth} className={ghostButtonClass}>
              全選此店本月欠款 / Select all owed for this shop this month
            </button>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2" />
                  <th>店家 / Shop</th>
                  <th>理髮師 / Barber</th>
                  <th>顧客 / Customer</th>
                  <th>付款日 / Paid</th>
                  <th className="text-right">金額 / Price</th>
                  <th className="text-right">平台抽成 / Platform</th>
                  <th className="text-right">店家應得 / Shop cut</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const id = r.booking_id!;
                  const otherShop = !!selectedShop && r.shop_id !== selectedShop;
                  return (
                    <tr key={id} className="border-t border-border">
                      <td className="py-2 pr-2">
                        <input
                          type="checkbox"
                          checked={checked.has(id)}
                          disabled={otherShop}
                          title={otherShop ? "一筆撥款只能包含同一間店" : undefined}
                          onChange={() => toggle(id)}
                          aria-label="選取這筆預約"
                        />
                      </td>
                      <td>{r.shop_name ?? "—"}</td>
                      <td>{r.barber_name}</td>
                      <td>{(r.customer_id && people.get(r.customer_id)?.email) ?? "—"}</td>
                      <td>{r.paid_at ? dateLabel(r.paid_at) : "—"}</td>
                      <td className="text-right">{money(r.price)}</td>
                      <td className="text-right">{money(r.platform_cut)}</td>
                      <td className="text-right font-medium">{money(r.shop_cut)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!owedPending && shown.length === 0 && (
              <p className="py-6 text-center text-muted-foreground">
                目前沒有欠款 / Nothing owed right now.
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-4 border-t border-border pt-4">
            <div className="text-sm">
              已選 {selected.length} 筆 · 總額 {money(sumBy(selected, "price"))} · 平台{" "}
              {money(sumBy(selected, "platform_cut"))} ·{" "}
              <span className="font-semibold">店家 {money(sumBy(selected, "shop_cut"))}</span>
            </div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="備註（選填）/ Note"
              className={`${fieldClass} mt-0 max-w-xs`}
            />
            <button
              onClick={build}
              disabled={selected.length === 0 || busy === "build"}
              className={primaryButtonClass}
            >
              {busy === "build" ? "建立中…" : "建立撥款 / Build payout"}
            </button>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl bg-card p-6 shadow-soft">
          <h2 className="text-xl font-semibold">撥款紀錄 / Payouts</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2">店家 / Shop</th>
                  <th>銀行帳戶 / Bank</th>
                  <th>建立 / Created</th>
                  <th className="text-right">筆數</th>
                  <th className="text-right">總額 / Gross</th>
                  <th className="text-right">平台 / Platform</th>
                  <th className="text-right">應撥 / Shop cut</th>
                  <th>狀態 / Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => {
                  const bank = people.get(p.shop_id);
                  return (
                    <tr key={p.id} className="border-t border-border align-top">
                      <td className="py-2">
                        {p.shop_name ?? "—"}
                        {p.note && <div className="text-xs text-muted-foreground">{p.note}</div>}
                      </td>
                      <td className="text-xs">
                        {bank?.bank_account_name}
                        <br />
                        {bank?.bank_account_number}
                      </td>
                      <td>{dateLabel(p.created_at)}</td>
                      <td className="text-right">{p.bookings_count}</td>
                      <td className="text-right">{money(p.gross)}</td>
                      <td className="text-right">{money(p.platform_cut)}</td>
                      <td className="text-right font-medium">{money(p.shop_cut)}</td>
                      <td>
                        {PAYOUT_STATUS_LABELS[p.status] ?? p.status}
                        {p.marked_transferred_at && (
                          <div className="text-xs text-muted-foreground">
                            {dateLabel(p.marked_transferred_at)}
                            {p.bank_reference && ` · ${p.bank_reference}`}
                          </div>
                        )}
                      </td>
                      <td>
                        {p.status === "pending_transfer" && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => markTransferred(p)}
                              disabled={busy === p.id}
                              className={primaryButtonClass}
                            >
                              標記為已轉帳
                            </button>
                            <button
                              onClick={() => cancel(p)}
                              disabled={busy === p.id}
                              className={`${ghostButtonClass} text-destructive`}
                            >
                              取消
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {payouts.length === 0 && (
              <p className="py-6 text-center text-muted-foreground">
                還沒有撥款紀錄 / No payouts yet.
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
