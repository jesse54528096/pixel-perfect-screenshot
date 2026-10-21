import type { Tables } from "@/integrations/supabase/types";

export type Slot = Tables<"bookable_slots">;
type PhotoLike = Pick<Tables<"barber_photos">, "is_featured" | "sort_order" | "created_at">;

export const CATEGORY_LABELS: Record<string, string> = {
  cut: "剪髮 Cut",
  color: "染髮 Color",
  perm: "燙髮 Perm",
  beard: "修鬍 Beard",
};

// Featured photos first, then the shop's own sort order.
export function sortPhotos<T extends PhotoLike>(photos: T[]) {
  return [...photos].sort(
    (a, b) =>
      Number(b.is_featured) - Number(a.is_featured) ||
      a.sort_order - b.sort_order ||
      a.created_at.localeCompare(b.created_at),
  );
}

// Card photo: the first featured one, else the newest upload.
export function repPhoto<T extends PhotoLike>(photos: T[]) {
  const featured = sortPhotos(photos.filter((p) => p.is_featured))[0];
  if (featured) return featured;
  return [...photos].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

// The N slots a booking starting at slots[index] would hold, or null when there
// aren't N back-to-back free slots from there. Mirrors create_booking: it takes
// the next N slots by start time, which must be contiguous and none already held.
export function runFrom(slots: Slot[], index: number, n: number, held: Set<string>) {
  const run = slots.slice(index, index + n);
  if (run.length < n) return null;
  for (let i = 0; i < run.length; i++) {
    const slot = run[i]!;
    if (held.has(slot.id)) return null;
    const prev = run[i - 1];
    if (prev && new Date(slot.starts_at).getTime() !== new Date(prev.ends_at).getTime()) {
      return null;
    }
  }
  return run;
}
