import { useEffect } from "react";

/**
 * Set the browser tab title for a route. Restores previous title on unmount.
 * Lightweight alternative to react-helmet-async for SPAs where only <title> matters.
 */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const prev = document.title;
    document.title = title;
    return () => { document.title = prev; };
  }, [title]);
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£",
  AED: "د.إ", SGD: "S$", AUD: "A$", CAD: "C$",
};

export function currencySymbol(code?: string | null): string {
  if (!code) return "₹";
  return CURRENCY_SYMBOLS[code.toUpperCase()] ?? code.toUpperCase() + " ";
}
