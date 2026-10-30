import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { photoUrl } from "@/components/PhotoManager";
import { ghostButtonClass, primaryButtonClass } from "@/components/ShopHeader";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AutofillDraft } from "@/lib/autofill";

type Barber = Tables<"barbers">;
type Photo = Tables<"barber_photos">;

// Shows the AI draft for one barber. Nothing is saved until 套用, which writes with the
// shop's own session through the M1.1 RLS (shops_update_own, photos_write_own).
export function AutofillDialog({
  barber,
  photos,
  draft,
  onClose,
}: {
  barber: Barber;
  photos: Photo[];
  draft: AutofillDraft;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [intro, setIntro] = useState(draft.intro);
  const [captions, setCaptions] = useState<Record<string, string>>(() =>
    Object.fromEntries(draft.photo_captions.map((c) => [c.photo_id, c.caption])),
  );
  const [busy, setBusy] = useState(false);
  const photoById = new Map(photos.map((p) => [p.id, p]));
  const rows = draft.photo_captions.filter((c) => photoById.has(c.photo_id));

  async function apply() {
    setBusy(true);
    const { error } = await supabase
      .from("barbers")
      .update({ intro: intro.trim() || null })
      .eq("id", barber.id);
    const results = await Promise.all(
      rows
        .filter((c) => captions[c.photo_id]?.trim())
        .map((c) =>
          supabase
            .from("barber_photos")
            .update({ caption: captions[c.photo_id]!.trim() })
            .eq("id", c.photo_id),
        ),
    );
    setBusy(false);
    const failed = error ?? results.find((r) => r.error)?.error;
    if (failed) {
      toast.error(failed.message);
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["barbers", barber.shop_id] }),
      queryClient.invalidateQueries({ queryKey: ["barber_photos", barber.id] }),
    ]);
    toast.success("已套用");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>AI 草稿 / AI draft — {barber.name}</DialogTitle>
          <DialogDescription>確認或修改後按「套用」才會存檔。</DialogDescription>
        </DialogHeader>

        <label className="block text-sm">
          <span className="font-medium">自我介紹 / Intro</span>
          <Textarea
            rows={4}
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            className="mt-1"
          />
        </label>

        <div className="space-y-3">
          <p className="text-sm font-medium">作品照說明 / Photo captions</p>
          {rows.map((c) => (
            <div key={c.photo_id} className="flex gap-3">
              <img
                src={photoUrl(photoById.get(c.photo_id)!.storage_path)}
                alt=""
                className="h-20 w-20 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Input
                  value={captions[c.photo_id] ?? ""}
                  onChange={(e) => setCaptions({ ...captions, [c.photo_id]: e.target.value })}
                />
                {c.refs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                    參考：
                    {c.refs.map((r) => (
                      <Badge key={r.id} variant="secondary">
                        {r.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {draft.refs.length > 0 && (
          <p className="text-xs text-muted-foreground">
            AI 參考了這些髮型範本：{draft.refs.map((r) => r.name).join("、")}
          </p>
        )}

        <DialogFooter className="gap-2">
          <button type="button" onClick={onClose} disabled={busy} className={ghostButtonClass}>
            取消 / Cancel
          </button>
          <button type="button" onClick={apply} disabled={busy} className={primaryButtonClass}>
            {busy ? "Saving…" : "套用 / Apply"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
