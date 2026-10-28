import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { photoUrl } from "@/components/PhotoManager";
import { ghostButtonClass, primaryButtonClass } from "@/components/ShopHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type RefTag = { id: string; name: string };
type Draft = {
  intro: string;
  photo_captions: { photo_id: string; caption: string; refs: RefTag[] }[];
  refs: (RefTag & { similarity: number })[];
};

const ERRORS: Record<number, string> = {
  401: "請重新登入 / Please sign in again.",
  403: "這不是你的理髮師 / Not your barber.",
  400: "先上傳作品照，AI 才能幫你寫 / Upload photos first.",
};

async function requestDraft(barberId: string): Promise<Draft> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error(ERRORS[401]);

  const res = await fetch("/api/ai/autofill", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ barber_id: barberId }),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<Draft> & { error?: string };
  if (!res.ok || typeof body.intro !== "string") {
    throw new Error(ERRORS[res.status] ?? "AI 服務暫時無法使用，請稍後再試");
  }
  return body as Draft;
}

// "AI 自動填寫": the server looks at the featured photos, retrieves similar hairstyle
// references (RAG) and returns a draft. Nothing is saved until the shop presses 套用.
export function AiAutofill({ barberId }: { barberId: string }) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [intro, setIntro] = useState("");
  const [captions, setCaptions] = useState<Record<string, string>>({});

  const { data: photos = [] } = useQuery({
    queryKey: ["barber_photos", barberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("barber_photos")
        .select("*")
        .eq("barber_id", barberId)
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const pathById = new Map(photos.map((p) => [p.id, p.storage_path]));

  async function run() {
    setLoading(true);
    try {
      const next = await requestDraft(barberId);
      setDraft(next);
      setIntro(next.intro);
      setCaptions(Object.fromEntries(next.photo_captions.map((c) => [c.photo_id, c.caption])));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!draft) return;
    setSaving(true);
    const results = await Promise.all([
      supabase
        .from("barbers")
        .update({ intro: intro.trim() || null })
        .eq("id", barberId),
      ...Object.entries(captions).map(([id, caption]) =>
        supabase
          .from("barber_photos")
          .update({ caption: caption.trim() || null })
          .eq("id", id),
      ),
    ]);
    setSaving(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error(failed.error.message);
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["barbers"] }),
      queryClient.invalidateQueries({ queryKey: ["barber_photos", barberId] }),
    ]);
    setDraft(null);
    toast.success("已套用 / Applied");
  }

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={run}
          disabled={loading || photos.length === 0}
          className={primaryButtonClass}
        >
          {loading ? "AI 撰寫中…" : "AI 自動填寫"}
        </button>
        {photos.length === 0 && (
          <span className="text-sm text-muted-foreground">先上傳作品照，AI 才能幫你寫</span>
        )}
      </div>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>AI 草稿 / Draft</DialogTitle>
            <DialogDescription>
              確認或修改後按「套用」才會儲存 / Nothing is saved until you press 套用.
            </DialogDescription>
          </DialogHeader>

          {draft && (
            <div className="space-y-6">
              <label className="block text-sm">
                <span className="font-medium">自我介紹 / Intro</span>
                <textarea
                  rows={4}
                  value={intro}
                  onChange={(e) => setIntro(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-2"
                />
              </label>

              <div className="space-y-3">
                <span className="text-sm font-medium">作品照說明 / Photo captions</span>
                {draft.photo_captions.map((c) => {
                  const path = pathById.get(c.photo_id);
                  return (
                    <div key={c.photo_id} className="flex gap-3">
                      {path && (
                        <img
                          src={photoUrl(path)}
                          alt=""
                          className="h-16 w-16 shrink-0 rounded-xl object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <input
                          value={captions[c.photo_id] ?? ""}
                          onChange={(e) =>
                            setCaptions((prev) => ({ ...prev, [c.photo_id]: e.target.value }))
                          }
                          className="w-full rounded-lg border border-input bg-background px-2 py-1 text-sm"
                        />
                        {c.refs.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {c.refs.map((r) => (
                              <span
                                key={r.id}
                                className="rounded-full bg-cream px-2 py-0.5 text-xs text-foreground/80"
                              >
                                參考：{r.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground">
                AI 參考了這些髮型範本：{draft.refs.map((r) => r.name).join("、")}
              </p>
            </div>
          )}

          <DialogFooter>
            <button onClick={() => setDraft(null)} className={ghostButtonClass}>
              取消 / Cancel
            </button>
            <button onClick={apply} disabled={saving} className={primaryButtonClass}>
              {saving ? "Saving…" : "套用 / Apply"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
