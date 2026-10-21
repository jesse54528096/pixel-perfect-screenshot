import { useQuery, useQueryClient } from "@tanstack/react-query";
import { addMinutes, format } from "date-fns";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  ShopHeader,
  fieldClass,
  ghostButtonClass,
  primaryButtonClass,
} from "@/components/ShopHeader";
import { formatMoney, isOnboarded, usePlatformSettings } from "@/lib/profile";
import { usePageMeta } from "@/lib/use-page-meta";
import { useShop } from "./require-shop";
import { useMyBarbers } from "./shop";

type Service = Tables<"services">;
type Slot = Tables<"bookable_slots">;

const CATEGORIES = ["cut", "color", "perm", "beard"] as const;

export function ShopBookingsPage() {
  usePageMeta("Services & slots — Barberly", "Edit your services and publish bookable slots.");
  const { user, profile } = useShop();
  const { data: barbers = [], isPending } = useMyBarbers(user.id);
  const [barberId, setBarberId] = useState<string>("");

  useEffect(() => {
    if (!barbers.some((b) => b.id === barberId)) setBarberId(barbers[0]?.id ?? "");
  }, [barbers, barberId]);

  const ready = isOnboarded(profile) && barbers.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <ShopHeader email={user.email} />
      <main className="mx-auto max-w-4xl space-y-8 px-5 pb-20 md:px-8">
        <div className="animate-fade-up rounded-[2rem] bg-cream px-8 py-10">
          <h1 className="text-4xl font-semibold">服務與時段 / Services &amp; slots</h1>
          {ready && (
            <label className="mt-5 block max-w-xs text-sm">
              <span className="font-medium">理髮師 / Barber</span>
              <select
                value={barberId}
                onChange={(e) => setBarberId(e.target.value)}
                className={fieldClass}
              >
                {barbers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        {!isPending && !ready && (
          <p className="rounded-[2rem] bg-card p-8 shadow-soft">
            先到{" "}
            <Link to="/shop" className="font-medium underline underline-offset-4">
              Shop setup
            </Link>{" "}
            填好店名與撥款帳戶，並新增至少一位理髮師。
          </p>
        )}
        {ready && barberId && (
          <>
            <ServicesEditor barberId={barberId} />
            <SlotPublisher barberId={barberId} />
          </>
        )}
      </main>
    </div>
  );
}

function ServicesEditor({ barberId }: { barberId: string }) {
  const { data: settings } = usePlatformSettings();
  const queryKey = ["services", barberId];
  const { data: services = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barber_id", barberId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const queryClient = useQueryClient();

  async function remove(service: Service) {
    if (!window.confirm(`刪除服務「${service.name}」？`)) return;
    const { error } = await supabase.from("services").delete().eq("id", service.id);
    if (error) toast.error(error.message);
    queryClient.invalidateQueries({ queryKey });
  }

  return (
    <section className="rounded-[2rem] bg-card p-8 shadow-soft">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold">服務與價格 / Services &amp; prices</h2>
        <button onClick={() => setEditing("new")} className={`ml-auto ${ghostButtonClass}`}>
          + 新增服務 / Add service
        </button>
      </div>
      {editing === "new" && <ServiceForm barberId={barberId} onDone={() => setEditing(null)} />}
      {services.length === 0 && editing !== "new" && (
        <p className="mt-4 text-sm text-muted-foreground">還沒有服務項目。</p>
      )}
      <ul className="mt-4 divide-y divide-border">
        {services.map((s) =>
          editing !== "new" && editing?.id === s.id ? (
            <li key={s.id} className="py-3">
              <ServiceForm barberId={barberId} service={s} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className="rounded-full bg-muted px-3 py-0.5 text-xs capitalize">
                {s.category}
              </span>
              <span className="font-medium">{s.name}</span>
              <span className="text-sm text-muted-foreground">
                {formatMoney(s.price, settings)} · {s.required_slots} 個時段（
                {s.required_slots * (settings?.slot_minutes ?? 30)} 分鐘）
              </span>
              <button onClick={() => setEditing(s)} className={`ml-auto ${ghostButtonClass}`}>
                編輯
              </button>
              <button onClick={() => remove(s)} className={`${ghostButtonClass} text-destructive`}>
                刪除
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function ServiceForm({
  barberId,
  service,
  onDone,
}: {
  barberId: string;
  service?: Service;
  onDone: () => void;
}) {
  const { data: settings } = usePlatformSettings();
  const queryClient = useQueryClient();
  const [name, setName] = useState(service?.name ?? "");
  const [category, setCategory] = useState(service?.category ?? "cut");
  const [price, setPrice] = useState(service ? String(service.price) : "");
  const [slots, setSlots] = useState(service ? String(service.required_slots) : "1");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Whole currency units, stored as-is (no x100 in the DB).
    const fields = {
      name: name.trim(),
      category,
      price: Number.parseInt(price, 10),
      required_slots: Number.parseInt(slots, 10),
    };
    if (!fields.name || !(fields.price >= 0) || !(fields.required_slots >= 1)) return;
    setBusy(true);
    const { error } = service
      ? await supabase.from("services").update(fields).eq("id", service.id)
      : await supabase.from("services").insert({ ...fields, barber_id: barberId });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["services", barberId] });
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-4 md:grid-cols-4">
      <label className="block text-sm md:col-span-2">
        <span className="font-medium">名稱 / Name *</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm md:col-span-2">
        <span className="font-medium">分類 / Category *</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={fieldClass}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm md:col-span-2">
        <span className="font-medium">
          價格 / Price（{(settings?.currency ?? "twd").toUpperCase()}，整數）*
        </span>
        <input
          required
          type="number"
          min={0}
          step={1}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className={fieldClass}
          placeholder="300"
        />
      </label>
      <label className="block text-sm md:col-span-2">
        <span className="font-medium">
          所需時段數 / Required slots（每個 {settings?.slot_minutes ?? 30} 分鐘）*
        </span>
        <input
          required
          type="number"
          min={1}
          step={1}
          value={slots}
          onChange={(e) => setSlots(e.target.value)}
          className={fieldClass}
        />
      </label>
      <div className="flex gap-2 md:col-span-4">
        <button disabled={busy} className={primaryButtonClass}>
          {busy ? "Saving…" : service ? "儲存 / Save" : "新增 / Add"}
        </button>
        <button type="button" onClick={onDone} className={ghostButtonClass}>
          取消 / Cancel
        </button>
      </div>
    </form>
  );
}

function SlotPublisher({ barberId }: { barberId: string }) {
  const { data: settings } = usePlatformSettings();
  const slotMinutes = settings?.slot_minutes ?? 30;
  const queryClient = useQueryClient();
  const queryKey = ["bookable_slots", barberId];
  const { data: slots = [] } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookable_slots")
        .select("*")
        .eq("barber_id", barberId)
        .gte("ends_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      return data;
    },
  });
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [from, setFrom] = useState("10:00");
  const [to, setTo] = useState("18:00");
  const [busy, setBusy] = useState(false);
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  async function publish(e: FormEvent) {
    e.preventDefault();
    const start = new Date(`${date}T${from}`);
    const end = new Date(`${date}T${to}`);
    const taken = new Set(slots.map((s) => new Date(s.starts_at).getTime()));
    const rows = [];
    // Split the window into consecutive slot_minutes-long slots, skipping ones already published.
    for (let t = start; addMinutes(t, slotMinutes) <= end; t = addMinutes(t, slotMinutes)) {
      if (taken.has(t.getTime())) continue;
      rows.push({
        barber_id: barberId,
        starts_at: t.toISOString(),
        ends_at: addMinutes(t, slotMinutes).toISOString(),
      });
    }
    if (!rows.length) {
      toast.error("這段時間沒有可新增的時段");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("bookable_slots").insert(rows);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`已發布 ${rows.length} 個時段`);
    refresh();
  }

  async function remove(slot: Slot) {
    const { error } = await supabase.from("bookable_slots").delete().eq("id", slot.id);
    if (error) toast.error(error.message);
    refresh();
  }

  async function reschedule(slot: Slot, value: string) {
    const startsAt = new Date(value);
    if (Number.isNaN(startsAt.getTime())) return;
    const { error } = await supabase
      .from("bookable_slots")
      .update({
        starts_at: startsAt.toISOString(),
        ends_at: addMinutes(startsAt, slotMinutes).toISOString(),
      })
      .eq("id", slot.id);
    if (error) toast.error(error.message);
    refresh();
  }

  const byDay = new Map<string, Slot[]>();
  for (const s of slots) {
    const day = format(new Date(s.starts_at), "yyyy-MM-dd (EEE)");
    byDay.set(day, [...(byDay.get(day) ?? []), s]);
  }

  return (
    <section className="rounded-[2rem] bg-card p-8 shadow-soft">
      <h2 className="text-2xl font-semibold">可預約時段 / Bookable slots</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        每個時段 {slotMinutes} 分鐘。選一段時間，會自動切成連續的時段。
      </p>
      <form onSubmit={publish} className="mt-6 grid gap-4 md:grid-cols-4">
        <label className="block text-sm">
          <span className="font-medium">日期 / Date</span>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">開始 / From</span>
          <input
            type="time"
            required
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium">結束 / To</span>
          <input
            type="time"
            required
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={fieldClass}
          />
        </label>
        <div className="flex items-end">
          <button disabled={busy} className={`w-full ${primaryButtonClass}`}>
            {busy ? "Publishing…" : "發布 / Publish"}
          </button>
        </div>
      </form>
      {slots.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">還沒有發布任何時段。</p>
      ) : (
        <div className="mt-6 space-y-5">
          {[...byDay].map(([day, daySlots]) => (
            <div key={day}>
              <h3 className="text-sm font-medium">{day}</h3>
              <ul className="mt-2 flex flex-wrap gap-2">
                {daySlots.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-1 rounded-full border border-border py-1 pl-1 pr-2 text-sm"
                  >
                    <input
                      type="datetime-local"
                      defaultValue={format(new Date(s.starts_at), "yyyy-MM-dd'T'HH:mm")}
                      onBlur={(e) => {
                        if (e.target.value !== format(new Date(s.starts_at), "yyyy-MM-dd'T'HH:mm"))
                          reschedule(s, e.target.value);
                      }}
                      className="rounded-full bg-transparent px-2"
                      aria-label="Slot start"
                    />
                    <button
                      onClick={() => remove(s)}
                      className="text-destructive"
                      aria-label="Delete slot"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
