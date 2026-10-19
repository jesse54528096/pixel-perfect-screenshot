import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, CalendarCheck, Search, ShieldCheck, Star } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";
import heroLeft from "@/assets/hero-left.jpg";
import heroRight from "@/assets/hero-right.jpg";
import barber1 from "@/assets/barber-1.jpg";
import barber2 from "@/assets/barber-2.jpg";
import barber3 from "@/assets/barber-3.jpg";
import barber4 from "@/assets/barber-4.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barberly — Style with Confident Hair" },
      { name: "description", content: "Find a great barber near you and book an appointment online in a few taps." },
      { property: "og:title", content: "Barberly — Style with Confident Hair" },
      { property: "og:description", content: "Find a great barber near you and book an appointment online in a few taps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const FILTERS = ["All", "Cut", "Color", "Perm", "Beard"] as const;

const LOGOS = [
  { name: "MAISON CUT", cls: "font-serif text-2xl font-bold tracking-widest" },
  { name: "Gentry & Co.", cls: "font-serif text-2xl italic" },
  { name: "NORTHFADE", cls: "font-sans text-lg font-semibold tracking-[0.3em]" },
  { name: "Atelier Hair", cls: "font-serif text-2xl" },
  { name: "BLADE/ROOM", cls: "font-sans text-lg font-medium tracking-[0.2em]" },
];

const FEATURES = [
  { icon: BadgeCheck, label: "Verified Barbers" },
  { icon: CalendarCheck, label: "Instant Booking" },
  { icon: ShieldCheck, label: "Secure Payment" },
  { icon: Star, label: "Top-Rated Styles" },
];

const BARBERS = [
  { name: "Marcus Hale", shop: "Good Hair Studio · Da'an", img: barber1, services: ["Cut", "Beard"], rating: 4.9, reviews: 312, from: 25 },
  { name: "Leo Brandt", shop: "Cuts & Shaves · Xinyi", img: barber2, services: ["Cut", "Beard", "Perm"], rating: 4.8, reviews: 254, from: 30 },
  { name: "Kenji Wu", shop: "Wave Room · Zhongshan", img: barber3, services: ["Cut", "Color", "Perm"], rating: 4.9, reviews: 189, from: 35 },
  { name: "Dario Russo", shop: "Traditional Barbering · Songshan", img: barber4, services: ["Cut", "Beard"], rating: 4.7, reviews: 146, from: 28 },
];

function Index() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const shown = filter === "All" ? BARBERS : BARBERS.filter((b) => b.services.includes(filter));

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-7xl items-center gap-4 px-5 py-5 md:px-8">
        <Wordmark />
        <div className="mx-auto hidden w-full max-w-sm items-center gap-2 rounded-full border border-border bg-card px-4 py-2 md:flex">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Search barbers" />
        </div>
        <Link to="/login" className="ml-auto rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/85 md:ml-0">
          Login
        </Link>
      </header>

      <section className="mx-auto max-w-7xl px-5 pb-16 pt-6 md:px-8">
        <div className="relative grid items-center gap-6 rounded-[2rem] bg-cream px-6 py-12 md:grid-cols-[1fr_1.4fr_1fr] md:px-10 md:py-16">
          <img src={heroLeft} alt="Man with textured crop haircut" width={768} height={1024} className="hidden aspect-[3/4] w-full animate-fade-up rounded-3xl object-cover md:block" />
          <div className="animate-fade-up text-center [animation-delay:120ms]">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">New Look</p>
            <h1 className="mt-4 text-5xl font-semibold leading-[1.02] text-foreground md:text-7xl">
              Style with Confident Hair
            </h1>
            <div className="mx-auto mt-8 flex max-w-md items-center gap-2 rounded-full bg-card p-1.5 pl-5 shadow-soft">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Find your stylist or search a style" />
              <button className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Search</button>
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition ${filter === f ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:border-foreground/40"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <img src={heroRight} alt="Woman with glossy wavy hair" width={768} height={1024} className="hidden aspect-[3/4] w-full animate-fade-up rounded-3xl object-cover [animation-delay:240ms] md:block" />
        </div>
      </section>

      <section className="border-y border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-around gap-x-10 gap-y-4 px-5 py-8 text-muted-foreground md:px-8">
          {LOGOS.map((l) => (
            <span key={l.name} className={l.cls}>{l.name}</span>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 md:px-8">
        <h2 className="text-center text-4xl font-semibold md:text-5xl">Best booking experience</h2>
        <div className="mt-12 grid grid-cols-2 gap-4 md:grid-cols-4">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center gap-4 rounded-3xl bg-muted px-4 py-10 text-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-card shadow-soft">
                <Icon className="h-6 w-6 text-foreground" strokeWidth={1.5} />
              </span>
              <span className="text-sm font-medium">{label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-24 md:px-8">
        <h2 className="text-4xl font-semibold md:text-5xl">Popular</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((b) => (
            <a key={b.name} href="#" onClick={(e) => e.preventDefault()} className="group block overflow-hidden rounded-3xl bg-card shadow-soft transition duration-300 hover:-translate-y-1.5 hover:shadow-lift">
              <div className="relative">
                <img src={b.img} alt={`Portrait of ${b.name}`} width={512} height={512} loading="lazy" className="aspect-square w-full object-cover" />
                <span className="absolute left-3 top-3 rounded-full bg-card/90 px-3 py-1 text-xs font-medium">Popular</span>
              </div>
              <div className="p-5">
                <h3 className="text-2xl font-semibold">{b.name}</h3>
                <p className="text-sm text-muted-foreground">{b.shop}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {b.services.map((s) => (
                    <span key={s} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">{s}</span>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-star text-star" />
                    <span className="font-medium">{b.rating}</span>
                    <span className="text-muted-foreground">({b.reviews})</span>
                  </span>
                  <span className="font-medium">from ${b.from}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-8 text-sm text-muted-foreground md:px-8">
          <span className="font-serif text-lg font-bold text-foreground">Barberly</span>
          <span>© 2026 Barberly</span>
        </div>
      </footer>
    </div>
  );
}
