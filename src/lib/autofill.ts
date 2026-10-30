import { supabase } from "@/integrations/supabase/client";

export type AutofillRef = { id: string; name: string };

export type AutofillDraft = {
  intro: string;
  photo_captions: { photo_id: string; caption: string; refs: AutofillRef[] }[];
  refs: (AutofillRef & { similarity: number })[];
};

const ERRORS: Record<number, string> = {
  400: "先上傳作品照，AI 才能幫你寫",
  401: "請重新登入 / Please sign in again.",
  403: "這不是你的理髮師",
};

// Ask our /api function for an AI draft of one barber's intro + photo captions.
// The function writes nothing; the shop saves the draft from the dialog (套用).
export async function requestAutofill(barberId: string): Promise<AutofillDraft> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error(ERRORS[401]);

  const res = await fetch("/api/ai/autofill", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ barber_id: barberId }),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<AutofillDraft> & { error?: string };
  if (!res.ok || typeof body.intro !== "string") {
    throw new Error(ERRORS[res.status] ?? "AI 服務暫時無法使用，請稍後再試");
  }
  return body as AutofillDraft;
}
