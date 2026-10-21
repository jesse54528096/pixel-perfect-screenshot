import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router";

import { supabase } from "@/integrations/supabase/client";
import { CustomerHeader } from "@/components/CustomerHeader";
import { photoUrl } from "@/components/PhotoManager";
import { CATEGORY_LABELS, repPhoto } from "@/lib/barbers";
import { usePageMeta } from "@/lib/use-page-meta";

const FILTERS = ["all", "cut", "color", "perm", "beard"] as const;
type Filter = (typeof FILTERS)[number];

// Public marketplace listing: every barber as a product-style card.
export function BarbersBrowsePage() {
  usePageMeta("Barbers — Barberly", "Browse every barber on Barberly and book a time.");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const { data: barbers = [], isPending } = useQuery({
    queryKey: ["barbers", "browse"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barbers")
        .select(
          "id, name, intro, address, created_at, services(category), barber_photos(storage_path, is_featured, sort_order, created_at)",
        )
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return barbers.filter((b) => {
      const matchesText =
        !q || b.name.toLowerCase().includes(q) || (b.address ?? "").toLowerCase().includes(q);
      const matchesCategory = filter === "all" || b.services.some((s) => s.category === filter);
      return matchesText && matchesCategory;
    });
  }, [barbers, search, filter]);

  return (
    <div className="min-h-screen bg-background">
      <CustomerHeader />
      <main className="mx-auto max-w-6xl px-5 pb-20 md:px-8">
        <div className="animate-fade-up rounded-[2rem] bg-cream px-8 py-10">
          <h1 className="text-4xl font-semibold">找理髮師 / Find a barber</h1>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋名稱或地址 / Search name or address"
            className="mt-6 w-full rounded-full border border-input bg-background px-5 py-3 outline-none focus:border-ring"
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-1.5 text-sm transition ${filter === f ? "bg-primary text-primary-foreground" : "border border-input bg-background hover:bg-muted"}`}
              >
                {f === "all" ? "全部 All" : CATEGORY_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {!isPending && shown.length === 0 && (
          <p className="mt-10 text-center text-muted-foreground">沒有符合的理髮師。</p>
        )}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((b) => {
            const photo = repPhoto(b.barber_photos);
            const categories = [...new Set(b.services.map((s) => s.category))];
            return (
              <Link
                key={b.id}
                to={`/barbers/${b.id}`}
                className="group overflow-hidden rounded-3xl bg-card shadow-soft transition hover:-translate-y-0.5"
              >
                {photo ? (
                  <img
                    src={photoUrl(photo.storage_path)}
                    alt={b.name}
                    className="aspect-[4/3] w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-4xl">
                    ✂️
                  </div>
                )}
                <div className="space-y-2 p-5">
                  <h2 className="text-xl font-semibold">{b.name}</h2>
                  {b.address && <p className="text-sm text-muted-foreground">{b.address}</p>}
                  {b.intro && <p className="line-clamp-2 text-sm">{b.intro}</p>}
                  {categories.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {categories.map((c) => (
                        <span key={c} className="rounded-full bg-muted px-2.5 py-0.5 text-xs">
                          {CATEGORY_LABELS[c] ?? c}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
