import { FunctionsHttpError } from "@supabase/supabase-js";

type FunctionErrorBody = {
  error?: unknown;
  message?: unknown;
};

/** Return the useful message sent by an Edge Function instead of Supabase's
 * generic "returned a non-2xx status code" wrapper. */
export async function getFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.clone().json()) as FunctionErrorBody;
      const detail = body?.error ?? body?.message;
      if (typeof detail === "string" && detail.trim()) return detail.trim();
    } catch {
      try {
        const detail = await error.context.clone().text();
        if (detail.trim()) return detail.trim();
      } catch {
        // Fall through to the regular error message.
      }
    }
  }

  if (error instanceof Error && error.message && !/non-2xx status code/i.test(error.message)) {
    return error.message;
  }
  return fallback;
}