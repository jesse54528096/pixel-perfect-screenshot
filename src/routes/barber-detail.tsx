import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CustomerHeader } from "@/components/CustomerHeader";
import { photoUrl } from "@/components/PhotoManager";
import { primaryButtonClass, ghostButtonClass } from "@/components/ShopHeader";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CATEGORY_LABELS, runFrom, sortPhotos, type Slot } from "@/lib/barbers";
import { goToCheckout } from "@/lib/checkout";
import { errMessage } from "@/lib/errors";
import { formatMoney, usePlatformSettings } from "@/lib/profile";
import { DISPLAY_TZ_LABEL, dayKey, dayLabel, rangeLabel, timeLabel } from "@/lib/time";
import { usePageMeta } from "@/lib/use-page-meta";
import { useSessionUser } from "@/lib/use-session-user";

type Service = Tables<"services">;
type Photo = Tables<"barber_photos">;

// Public barber page, laid out like a marketplace product page:
// photo carousel, profile, services, availability, and a Book dialog.
export function BarberDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const user = useSessionUser();
  const [bookOpen, setBookOpen] = useState(false);

  const { data: barber, isPending } = useQuery({
    queryKey: ["barber", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select("id, name, intro, address")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  usePageMeta(`${barber?.name ?? "Barber"} — Barberly`, barber?.intro ?? undefined);

  const { data: photos = [] } = useQuery({
    queryKey: ["barber_photos", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("barber_photos").select("*").eq("barber_id", id);
      if (error) throw error;
      return sortPhotos(data);
    },
  });

  const { data: services = [] } = useQuery({
    queryKey: ["services", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services")
        .select("*")
        .eq("barber_id", id)
        .order("price");
      if (error) throw error;
      return data;
    },
  });

  const availability = useAvailability(id);

  function openBook() {
    if (user === null) {
      navigate(`/sign-in?next=${encodeURIComponent(`/barbers/${id}`)}`);
      return;
    }
    setBookOpen(true);
  }

  if (isPending) return null;
  if (!barber) {
    return (
      <div className="min-h-screen bg-background">
        <CustomerHeader />
        <p className="mt-20 text-center text-muted-foreground">找不到這位理髮師。</p>
      </div>
    );
  }

  const freeSlots = availability.slots.filter((s) => !availability.held.has(s.id));

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <main className="mx-auto max-w-4xl space-y-8 px-5 pb-20 md:px-8">
        <PhotoCarousel photos={photos} name={barber.name} />

        <section className="rounded-[2rem] bg-card p-8 shadow-soft">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-4xl font-semibold">{barber.name}</h1>
              {barber.address && <p className="mt-2 text-muted-foreground">{barber.address}</p>}
            </div>
            <button
              onClick={openBook}
              disabled={services.length === 0}
              className={`${primaryButtonClass} px-8 py-3 text-base`}
            >
              預約 / Book
            </button>
          </div>
          {barber.intro && <p className="mt-4 whitespace-pre-line">{barber.intro}</p>}
        </section>

        <section className="rounded-[2rem] bg-card p-8 shadow-soft">
          <h2 className="text-2xl font-semibold">服務 / Services</h2>
          {services.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">這位理髮師還沒有上架服務。</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {services.map((s) => (
                <ServiceRow key={s.id} service={s} />
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[2rem] bg-card p-8 shadow-soft">
          <h2 className="text-2xl font-semibold">可預約時段 / Available slots</h2>
          <p className="mt-1 text-xs text-muted-foreground">時間皆為{DISPLAY_TZ_LABEL}</p>
          {freeSlots.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">目前沒有可預約的時段。</p>
          ) : (
            <div className="mt-4 space-y-4">
              {groupByDay(freeSlots).map(([day, slots]) => (
                <div key={day}>
                  <h3 className="text-sm font-medium">{dayLabel(slots[0]!.starts_at)}</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {slots.map((s) => (
                      <span key={s.id} className="rounded-full bg-muted px-3 py-1 text-xs">
                        {timeLabel(s.starts_at)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>

      {bookOpen && (
        <BookDialog
          barberName={barber.name}
          services={services}
          slots={availability.slots}
          held={availability.held}
          onClose={() => setBookOpen(false)}
        />
      )}
    </div>
  );
}

function ServiceRow({ service }: { service: Service }) {
  const { data: settings } = usePlatformSettings();
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <span className="font-medium">{service.name}</span>
      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
        {CATEGORY_LABELS[service.category] ?? service.category}
      </span>
      <span className="text-sm text-muted-foreground">
        {service.required_slots * (settings?.slot_minutes ?? 30)} 分鐘
      </span>
      <span className="ml-auto font-semibold">{formatMoney(service.price, settings)}</span>
    </li>
  );
}

// Future slots for the barber plus the ids already held by a booking.
// A slot is free when no booking_slots row references it (slots have no status).
function useAvailability(barberId: string) {
  const { data } = useQuery({
    queryKey: ["availability", barberId],
    queryFn: async () => {
      const { data: slots, error } = await supabase
        .from("bookable_slots")
        .select("*")
        .eq("barber_id", barberId)
        .gt("starts_at", new Date().toISOString())
        .order("starts_at");
      if (error) throw error;
      if (slots.length === 0) return { slots, held: new Set<string>() };
      const { data: taken, error: takenError } = await supabase
        .from("booking_slots")
        .select("slot_id")
        .in(
          "slot_id",
          slots.map((s) => s.id),
        );
      if (takenError) throw takenError;
      return { slots, held: new Set(taken.map((t) => t.slot_id)) };
    },
  });
  return data ?? { slots: [] as Slot[], held: new Set<string>() };
}

function groupByDay(slots: Slot[]) {
  const days = new Map<string, Slot[]>();
  for (const s of slots) {
    const key = dayKey(s.starts_at);
    days.set(key, [...(days.get(key) ?? []), s]);
  }
  return [...days.entries()];
}

function PhotoCarousel({ photos, name }: { photos: Photo[]; name: string }) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [zoomed, setZoomed] = useState<Photo | null>(null);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    onSelect();
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-[2rem] bg-muted text-6xl">
        ✂️
      </div>
    );
  }

  return (
    <div>
      <Carousel
        setApi={setApi}
        opts={{ loop: photos.length > 1 }}
        className="overflow-hidden rounded-[2rem]"
      >
        <CarouselContent>
          {photos.map((p) => (
            <CarouselItem key={p.id}>
              <button onClick={() => setZoomed(p)} className="block w-full cursor-zoom-in">
                <img
                  src={photoUrl(p.storage_path)}
                  alt={p.caption ?? name}
                  className="aspect-[16/9] w-full bg-muted object-cover"
                />
              </button>
              {p.caption && (
                <p className="mt-2 text-center text-sm text-muted-foreground">{p.caption}</p>
              )}
            </CarouselItem>
          ))}
        </CarouselContent>
        {photos.length > 1 && (
          <>
            <CarouselPrevious className="left-3 top-[calc(50%-1rem)]" />
            <CarouselNext className="right-3 top-[calc(50%-1rem)]" />
          </>
        )}
      </Carousel>
      {photos.length > 1 && (
        <div className="mt-3 flex justify-center gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={() => api?.scrollTo(i)}
              aria-label={`Photo ${i + 1}`}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl border-2 transition ${i === current ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}
            >
              <img src={photoUrl(p.storage_path)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <Dialog open={zoomed !== null} onOpenChange={(open) => !open && setZoomed(null)}>
        <DialogContent className="max-w-4xl p-2">
          <DialogTitle className="sr-only">{zoomed?.caption ?? name}</DialogTitle>
          {zoomed && (
            <img
              src={photoUrl(zoomed.storage_path)}
              alt={zoomed.caption ?? name}
              className="max-h-[85vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// The booking pop-up: service -> date -> start slot -> confirm, then off to Stripe Checkout.
function BookDialog({
  barberName,
  services,
  slots,
  held,
  onClose,
}: {
  barberName: string;
  services: Service[];
  slots: Slot[];
  held: Set<string>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: settings } = usePlatformSettings();
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [startId, setStartId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const service = services.find((s) => s.id === serviceId);
  const n = service?.required_slots ?? 1;

  // Map each slot id to the run it would hold as a start slot (null = can't start here).
  const runs = useMemo(() => {
    const map = new Map<string, Slot[] | null>();
    slots.forEach((s, i) => map.set(s.id, runFrom(slots, i, n, held)));
    return map;
  }, [slots, n, held]);

  const days = useMemo(
    () =>
      groupByDay(slots.filter((s) => !held.has(s.id))).filter(([, daySlots]) =>
        daySlots.some((s) => runs.get(s.id)),
      ),
    [slots, held, runs],
  );
  const daySlots = days.find(([key]) => key === day)?.[1] ?? [];
  const run = startId ? runs.get(startId) : null;
  const runIds = new Set(run?.map((s) => s.id));

  function pickService(id: string) {
    setServiceId(id);
    setDay(null);
    setStartId(null);
  }

  // Create the pending_payment booking (holds the slots), then pay on Stripe Checkout.
  async function confirm() {
    if (!service || !startId) return;
    setBusy(true);
    const { data: bookingId, error } = await supabase.rpc("create_booking", {
      p_service_id: service.id,
      p_start_slot_id: startId,
    });
    await queryClient.invalidateQueries({ queryKey: ["availability"] });
    if (error) {
      setBusy(false);
      setStartId(null);
      toast.error(errMessage(error, "預約失敗，請再試一次 / Could not complete the booking."));
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
    try {
      await goToCheckout(bookingId);
    } catch (err) {
      setBusy(false);
      onClose();
      toast.error(
        errMessage(err, "無法前往付款 / Could not start checkout.") +
          " 預約已保留，可到「我的預約」付款。",
      );
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>預約 {barberName}</DialogTitle>
          <DialogDescription>
            先選服務，再選日期和開始時間（{DISPLAY_TZ_LABEL}）。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-medium">1. 服務 / Service</h3>
            <div className="mt-2 grid gap-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => pickService(s.id)}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-sm transition ${s.id === serviceId ? "border-primary bg-primary/10" : "border-input hover:bg-muted"}`}
                >
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.required_slots * (settings?.slot_minutes ?? 30)} 分鐘
                  </span>
                  <span className="ml-auto">{formatMoney(s.price, settings)}</span>
                </button>
              ))}
            </div>
          </div>

          {service && (
            <div>
              <h3 className="text-sm font-medium">2. 日期 / Date</h3>
              {days.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  目前沒有足夠的連續時段可以做這項服務。
                </p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2">
                  {days.map(([key, list]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setDay(key);
                        setStartId(null);
                      }}
                      className={`rounded-full px-4 py-1.5 text-sm transition ${key === day ? "bg-primary text-primary-foreground" : "border border-input hover:bg-muted"}`}
                    >
                      {dayLabel(list[0]!.starts_at)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {service && day && (
            <div>
              <h3 className="text-sm font-medium">3. 開始時間 / Start time</h3>
              {n > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  此服務會連續佔用 {n}{" "}
                  個時段。灰色的時間無法當開始時間（後面的連續時段不足），但可能被較早開始的預約涵蓋。
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                {daySlots.map((s) => {
                  const canStart = Boolean(runs.get(s.id));
                  const inRun = runIds.has(s.id);
                  return (
                    <button
                      key={s.id}
                      disabled={!canStart}
                      onClick={() => setStartId(s.id)}
                      title={canStart ? undefined : "無法從這裡開始（時段不足）"}
                      className={`rounded-full px-3 py-1.5 text-sm transition ${
                        inRun
                          ? "bg-primary/20 text-foreground"
                          : canStart
                            ? "border border-input hover:bg-muted"
                            : "border border-dashed border-input text-muted-foreground opacity-50"
                      } ${s.id === startId ? "ring-2 ring-primary" : ""}`}
                    >
                      {timeLabel(s.starts_at)}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {service && run && (
            <div className="rounded-xl bg-cream p-4 text-sm">
              <p>
                你的預約：
                <strong>{rangeLabel(run[0]!.starts_at, run[run.length - 1]!.ends_at)}</strong>
                {n > 1 && `（連佔 ${n} 個時段）`}
              </p>
              <p className="mt-1">
                {service.name} · <strong>{formatMoney(service.price, settings)}</strong>
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <button onClick={onClose} className={ghostButtonClass}>
            取消 / Cancel
          </button>
          <button
            onClick={confirm}
            disabled={busy || !service || !run}
            className={primaryButtonClass}
          >
            {busy ? "前往付款中…" : "確認並付款 / Confirm & pay"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
