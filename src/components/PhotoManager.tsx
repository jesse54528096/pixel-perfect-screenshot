import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { ghostButtonClass } from "@/components/ShopHeader";

export const PHOTO_BUCKET = "barber-photos";

type Photo = Tables<"barber_photos">;

export function photoUrl(path: string) {
  return supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function useBarberPhotos(barberId: string) {
  return useQuery({
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
}

// Sample hairstyle photos for one barber. Files live at <barber_id>/<uuid>.<ext>
// in the public bucket; the Storage policy only lets the owning shop write there.
export function PhotoManager({ barberId }: { barberId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["barber_photos", barberId];
  const [uploading, setUploading] = useState(false);
  const { data: photos = [] } = useBarberPhotos(barberId);
  const refresh = () => queryClient.invalidateQueries({ queryKey });

  async function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setUploading(true);
    let order = photos.reduce((max, p) => Math.max(max, p.sort_order), -1);
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${barberId}/${crypto.randomUUID()}.${ext}`;
      const upload = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, file.type ? { contentType: file.type } : {});
      if (upload.error) {
        toast.error(upload.error.message);
        continue;
      }
      order += 1;
      const { error } = await supabase
        .from("barber_photos")
        .insert({ barber_id: barberId, storage_path: path, sort_order: order });
      if (error) {
        await supabase.storage.from(PHOTO_BUCKET).remove([path]);
        toast.error(error.message);
      }
    }
    setUploading(false);
    refresh();
  }

  async function update(photo: Photo, fields: Partial<Photo>) {
    const { error } = await supabase.from("barber_photos").update(fields).eq("id", photo.id);
    if (error) toast.error(error.message);
    refresh();
  }

  async function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= photos.length) return;
    const next = [...photos];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    // Renumber everything so sort_order stays a clean 0..n-1 sequence.
    await Promise.all(
      next.map((p, i) =>
        p.sort_order === i
          ? null
          : supabase.from("barber_photos").update({ sort_order: i }).eq("id", p.id),
      ),
    );
    refresh();
  }

  async function remove(photo: Photo) {
    const storage = await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path]);
    if (storage.error) {
      toast.error(storage.error.message);
      return;
    }
    const { error } = await supabase.from("barber_photos").delete().eq("id", photo.id);
    if (error) toast.error(error.message);
    refresh();
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <h4 className="font-medium">作品照 / Sample hairstyle photos</h4>
        <label className={`ml-auto cursor-pointer ${ghostButtonClass}`}>
          {uploading ? "Uploading…" : "+ 上傳 / Upload"}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            onChange={onFiles}
            className="hidden"
          />
        </label>
      </div>
      {photos.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">還沒有作品照。</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, i) => (
            <figure
              // Captions are uncontrolled inputs: remount when an AI draft is applied.
              key={`${photo.id}:${photo.caption ?? ""}`}
              className="overflow-hidden rounded-2xl border border-border"
            >
              <img
                src={photoUrl(photo.storage_path)}
                alt={photo.caption ?? "Sample hairstyle"}
                className="aspect-square w-full object-cover"
              />
              <figcaption className="space-y-2 p-2 text-xs">
                <input
                  defaultValue={photo.caption ?? ""}
                  onBlur={(e) => {
                    const caption = e.target.value.trim() || null;
                    if (caption !== photo.caption) update(photo, { caption });
                  }}
                  placeholder="說明 / caption"
                  className="w-full rounded-lg border border-input bg-background px-2 py-1"
                />
                <label className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={photo.is_featured}
                    onChange={(e) => update(photo, { is_featured: e.target.checked })}
                  />
                  精選 / Featured
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="rounded border border-input px-2 disabled:opacity-40"
                    aria-label="Move earlier"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === photos.length - 1}
                    className="rounded border border-input px-2 disabled:opacity-40"
                    aria-label="Move later"
                  >
                    →
                  </button>
                  <button
                    onClick={() => remove(photo)}
                    className="ml-auto rounded border border-input px-2 text-destructive"
                  >
                    刪除
                  </button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
