import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type PlatformSettings = Tables<"platform_settings">;

// Roles are read from profiles.role (never user_metadata). M1.1 routes only
// shop and customer; admin is not a sign-in path yet.
export function homePathFor(role: string | null | undefined) {
  return role === "shop" ? "/shop" : "/app";
}

export async function fetchHomePath() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "/sign-in";
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();
  return homePathFor(data?.role);
}

export function useProfile(userId: string) {
  return useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
      if (error) throw error;
      return data;
    },
  });
}

export function isOnboarded(profile: Profile | undefined) {
  return Boolean(
    profile?.display_name?.trim() &&
    profile.bank_account_name?.trim() &&
    profile.bank_account_number?.trim(),
  );
}

export function usePlatformSettings() {
  return useQuery({
    queryKey: ["platform_settings"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_settings").select("*").single();
      if (error) throw error;
      return data;
    },
  });
}

// Prices are stored as whole units in platform_settings.currency (no x100 in the DB).
export function formatMoney(amount: number, settings: PlatformSettings | undefined) {
  const currency = (settings?.currency ?? "twd").toUpperCase();
  const digits = settings?.currency_minor_units ?? 0;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}
