// Supabase returns a PostgrestError (a plain {message, details, hint, code} object),
// not an Error instance, so read .message off any object that has one.
export function errMessage(err: unknown, fallback: string) {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message: unknown }).message;
    if (typeof message === "string" && message) return message;
  }
  return fallback;
}
