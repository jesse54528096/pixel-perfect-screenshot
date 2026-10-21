import { Link, useNavigate, useSearchParams } from "react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Wordmark } from "@/components/Wordmark";
import { fetchHomePath } from "@/lib/profile";
import { usePageMeta } from "@/lib/use-page-meta";

type Role = "customer" | "shop";

export function LoginPage({ mode }: { mode: "signin" | "signup" }) {
  usePageMeta(
    "Sign in or sign up — Barberly",
    "Sign in to Barberly or create a customer or barber account.",
  );
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Where to land after sign-in (e.g. back to the barber page the Book button came from).
  const next = params.get("next");
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : null;
  const [role, setRole] = useState<Role>("customer");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } =
      mode === "signup"
        ? await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${window.location.origin}/home`, data: { role } },
          })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // With email confirmation on, sign-up returns no session: the user signs in
    // after clicking the link in the email.
    if (!data.session) {
      toast.success("請到信箱點確認連結，再回來登入 / Check your email to confirm your account.");
      navigate("/sign-in");
      return;
    }
    navigate(mode === "signin" && nextPath ? nextPath : await fetchHomePath());
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="mx-auto w-full max-w-7xl px-5 py-5 md:px-8">
        <Wordmark />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md animate-fade-up rounded-[2rem] bg-card p-8 shadow-soft md:p-10">
          <h1 className="text-center text-4xl font-semibold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>

          {mode === "signup" && (
            <div
              role="tablist"
              aria-label="Account type"
              className="mt-6 grid grid-cols-2 rounded-full bg-muted p-1"
            >
              {(
                [
                  ["customer", "Customer"],
                  ["shop", "Barber"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={role === value}
                  onClick={() => setRole(value)}
                  className={`rounded-full py-2 text-sm font-medium transition ${role === value ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block text-sm">
              <span className="font-medium">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-ring"
                placeholder="you@example.com"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Password</span>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 outline-none focus:border-ring"
                placeholder="At least 6 characters"
              />
            </label>
            <button
              disabled={busy}
              className="w-full rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/85 disabled:opacity-60"
            >
              {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Sign Up"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {mode === "signin" ? "New to Barberly?" : "Already have an account?"}{" "}
            <Link
              to={
                (mode === "signin" ? "/sign-up" : "/sign-in") +
                (nextPath ? `?next=${encodeURIComponent(nextPath)}` : "")
              }
              replace
              className="font-medium text-foreground underline underline-offset-4"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
