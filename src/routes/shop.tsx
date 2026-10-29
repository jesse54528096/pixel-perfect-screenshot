import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { PhotoManager, PHOTO_BUCKET } from "@/components/PhotoManager";
import {
  ShopHeader,
  fieldClass,
  ghostButtonClass,
  primaryButtonClass,
} from "@/components/ShopHeader";
import { isOnboarded } from "@/lib/profile";
import { usePageMeta } from "@/lib/use-page-meta";
import { useShop } from "./require-shop";

type Barber = Tables<"barbers">;

export function useMyBarbers(shopId: string) {
  return useQuery({
    queryKey: ["barbers", shopId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select("*")
        .eq("shop_id", shopId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function ShopSetupPage() {
  usePageMeta("Shop setup — Barberly", "Set up your shop, your barbers and their portfolio.");
  const { user, profile } = useShop();
  const done = isOnboarded(profile);

  return (
    <div className="min-h-screen bg-background">
      <ShopHeader email={user.email} />
      <main className="mx-auto max-w-4xl space-y-8 px-5 pb-20 md:px-8">
        <div className="animate-fade-up rounded-[2rem] bg-cream px-8 py-10">
          <h1 className="text-4xl font-semibold">理髮店上架 / Shop onboarding</h1>
          <p className="mt-3 text-foreground/80">
            {done
              ? "開店資料已完成 ✓ — 你可以新增理髮師、上傳作品照，並到「Services & slots」發布服務與時段。"
              : "先填好店名與撥款帳戶（三欄都必填）才算完成開店。"}
          </p>
        </div>
        <PayoutSettings />
        <MyBarbers />
      </main>
    </div>
  );
}

function PayoutSettings() {
  const { user, profile } = useShop();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [accountName, setAccountName] = useState(profile.bank_account_name ?? "");
  const [accountNumber, setAccountNumber] = useState(profile.bank_account_number ?? "");
  const [busy, setBusy] = useState(false);
  const complete = Boolean(displayName.trim() && accountName.trim() && accountNumber.trim());

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!complete) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        bank_account_name: accountName.trim(),
        bank_account_number: accountNumber.trim(),
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success("撥款設定已儲存 / Payout settings saved");
  }

  return (
    <section className="rounded-[2rem] bg-card p-8 shadow-soft">
      <h2 className="text-2xl font-semibold">撥款設定 / Payout settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        店家層級，全部理髮師共用。先用測試資料即可 / use test data first.
      </p>
      <form onSubmit={onSubmit} className="mt-6 grid gap-4 md:grid-cols-3">
        <label className="block text-sm md:col-span-3">
          <span className="font-medium">店名 / Shop name *</span>
          <input
            required
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={fieldClass}
            placeholder="Downtown Cuts"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            你的理髮店名稱，會顯示在撥款紀錄上 / your shop's name, shown on payout records
          </span>
        </label>
        <label className="block text-sm">
          <span className="font-medium">匯款戶名 / Account name *</span>
          <input
            required
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm md:col-span-2">
          <span className="font-medium">匯款帳號 / Account number *</span>
          <input
            required
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            className={fieldClass}
          />
        </label>
        <p className="text-xs text-muted-foreground md:col-span-3">
          你的理髮店收款的銀行帳戶 / the bank account where your shop gets paid.
          只有你和管理員看得到。
        </p>
        <div className="md:col-span-3">
          <button disabled={busy || !complete} className={primaryButtonClass}>
            {busy ? "Saving…" : "儲存 / Save"}
          </button>
        </div>
      </form>
    </section>
  );
}

function MyBarbers() {
  const { user } = useShop();
  const { data: barbers = [], isPending } = useMyBarbers(user.id);
  const [adding, setAdding] = useState(false);

  return (
    <section className="rounded-[2rem] bg-card p-8 shadow-soft">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold">我的理髮師 / My barbers</h2>
        <button onClick={() => setAdding(true)} className={`ml-auto ${ghostButtonClass}`}>
          + 新增一位理髮師 / Add another barber
        </button>
      </div>
      {adding && <BarberForm onDone={() => setAdding(false)} />}
      {!isPending && barbers.length === 0 && !adding && (
        <p className="mt-4 text-sm text-muted-foreground">還沒有理髮師，先新增一位。</p>
      )}
      <div className="mt-6 space-y-6">
        {barbers.map((b) => (
          <BarberCard key={b.id} barber={b} />
        ))}
      </div>
    </section>
  );
}

function BarberCard({ barber }: { barber: Barber }) {
  const { user } = useShop();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  async function remove() {
    if (!window.confirm(`刪除 ${barber.name}？他的服務、時段與作品照都會一起刪除。`)) return;
    const { data: photos } = await supabase
      .from("barber_photos")
      .select("storage_path")
      .eq("barber_id", barber.id);
    if (photos?.length) {
      await supabase.storage.from(PHOTO_BUCKET).remove(photos.map((p) => p.storage_path));
    }
    const { error } = await supabase.from("barbers").delete().eq("id", barber.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["barbers", user.id] });
  }

  return (
    <div className="rounded-3xl border border-border p-6">
      {editing ? (
        <BarberForm barber={barber} onDone={() => setEditing(false)} />
      ) : (
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-xl font-semibold">{barber.name}</h3>
            {barber.address && <p className="text-sm text-muted-foreground">{barber.address}</p>}
            {barber.intro && <p className="mt-2 whitespace-pre-line text-sm">{barber.intro}</p>}
          </div>
          <button onClick={() => setEditing(true)} className={ghostButtonClass}>
            編輯 / Edit
          </button>
          <button onClick={remove} className={`${ghostButtonClass} text-destructive`}>
            刪除 / Delete
          </button>
        </div>
      )}
      <PhotoManager barberId={barber.id} />
    </div>
  );
}

function BarberForm({ barber, onDone }: { barber?: Barber; onDone: () => void }) {
  const { user } = useShop();
  const queryClient = useQueryClient();
  const [name, setName] = useState(barber?.name ?? "");
  const [intro, setIntro] = useState(barber?.intro ?? "");
  const [address, setAddress] = useState(barber?.address ?? "");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const fields = {
      name: name.trim(),
      intro: intro.trim() || null,
      address: address.trim() || null,
    };
    const { error } = barber
      ? await supabase.from("barbers").update(fields).eq("id", barber.id)
      : await supabase.from("barbers").insert({ ...fields, shop_id: user.id });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["barbers", user.id] });
    onDone();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-4 md:grid-cols-2">
      <label className="block text-sm">
        <span className="font-medium">名稱 / Name *</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">地址 / Address</span>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm md:col-span-2">
        <span className="font-medium">簡介 / Intro</span>
        <textarea
          rows={3}
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          className={fieldClass}
          placeholder="簡短介紹一下這位理髮師 / a short bio"
        />
      </label>
      <div className="flex gap-2 md:col-span-2">
        <button disabled={busy || !name.trim()} className={primaryButtonClass}>
          {busy ? "Saving…" : barber ? "儲存 / Save" : "新增 / Add barber"}
        </button>
        <button type="button" onClick={onDone} className={ghostButtonClass}>
          取消 / Cancel
        </button>
      </div>
    </form>
  );
}
