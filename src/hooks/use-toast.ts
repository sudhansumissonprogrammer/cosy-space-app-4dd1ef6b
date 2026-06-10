// Legacy shim → routes to Sonner.
// The original Radix `useToast` API expected `{ title, description, variant }`.
// Sonner has a flat string API plus an options object. We adapt at this seam
// so the ~80 existing call sites keep working without touching them.
import type * as React from "react";
import { toast as sonnerToast } from "sonner";

type LegacyVariant = "default" | "destructive" | "success" | "info" | "warning";

interface LegacyToastInput {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: LegacyVariant;
  action?: React.ReactNode;
  duration?: number;
}

function dispatch(input: LegacyToastInput | string) {
  if (typeof input === "string") return sonnerToast(input);
  const { title, description, variant, duration } = input;
  const message = (title ?? description ?? "") as string;
  const opts = { description: title ? (description as string | undefined) : undefined, duration };
  switch (variant) {
    case "destructive":
      return sonnerToast.error(message, opts);
    case "success":
      return sonnerToast.success(message, opts);
    case "info":
      return sonnerToast.info(message, opts);
    case "warning":
      return sonnerToast.warning(message, opts);
    default:
      return sonnerToast(message, opts);
  }
}

export const toast = dispatch;
export function useToast() {
  return { toast: dispatch, dismiss: sonnerToast.dismiss, toasts: [] as never[] };
}
