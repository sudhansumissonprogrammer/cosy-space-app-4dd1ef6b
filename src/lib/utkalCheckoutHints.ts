import { isUtkalContentStore } from "../../supabase/functions/_shared/utkalContent";

type StoreRef = { id?: string | null; slug?: string | null };
/** Full prepaid is unavailable at Utkal; online gateways still collect its advance. */
export function allowsFullPrepaid(store: StoreRef): boolean {
  return !isUtkalContentStore(store);
}

export function utkalDeliveryHint(store: StoreRef, mode: "full" | "partial"): string | null {
  if (!isUtkalContentStore(store)) return null;
  return mode === "full"
    ? "Get delivered under 3 days with air shipping"
    : "Get delivered under 3 days";
}
export function utkalCodHint(store: StoreRef): string | null {
  return isUtkalContentStore(store)
    ? "Choose Partial COD for discount & faster delivery"
    : null;
}

/** Utkal-only flat ₹100 off for choosing the online advance (partial COD).
 * Comes out of the delivery balance, never the advance — same rule as coupons.
 * The server recomputes this in place-order; the client value is display-only. */
export const UTKAL_PARTIAL_DISCOUNT = 100;
export function utkalPartialDiscount(store: StoreRef): number {
  return isUtkalContentStore(store) ? UTKAL_PARTIAL_DISCOUNT : 0;
}
/** Utkal-only founder note shown in the COD confirm sheet. */
export const UTKAL_COD_CONFIRM_NOTE = [
  "Hey! 👋 I'm Sudhansu, founder of Utkal Watch. ❤️",
  "🙏 A humble request: Please confirm only if you'll accept delivery, as every refused COD parcel costs us double shipping charges. 📦",
  "💳 Partial COD gets you faster delivery & special discounts!",
  "⭐ Have doubts? Check our 300+ customer reviews on our website.",
  "Thank you for your trust & support! ❤️",
];
/** Hand-written Hindi version, swapped in place by the sheet's translate button. */
export const UTKAL_COD_CONFIRM_NOTE_HI = [
  "नमस्ते! 👋 मैं सुधांशु हूँ, Utkal Watch का फाउंडर। ❤️",
  "🙏 एक विनम्र निवेदन: ऑर्डर तभी कन्फर्म करें जब आप डिलीवरी ज़रूर लेंगे, क्योंकि हर रिफ्यूज़ हुए COD पार्सल पर हमें दोगुना शिपिंग चार्ज देना पड़ता है। 📦",
  "💳 Partial COD चुनने पर आपको तेज़ डिलीवरी और खास डिस्काउंट मिलता है!",
  "⭐ कोई शक है? हमारी वेबसाइट पर हमारे 300+ ग्राहकों के रिव्यू देखें।",
  "आपके भरोसे और साथ के लिए दिल से धन्यवाद! ❤️",
];
export function utkalCodConfirmNote(store: StoreRef, lang: "en" | "hi" = "en"): string[] | null {
  if (!isUtkalContentStore(store)) return null;
  return lang === "hi" ? UTKAL_COD_CONFIRM_NOTE_HI : UTKAL_COD_CONFIRM_NOTE;
}

/** Display-only review count label. Utkal Watch shows "300+" because most of
 * its customer reviews live on WhatsApp/Instagram, not in the uploaded set. */
export function reviewCountLabel(storeId: string | null | undefined, total: number): string {
  return isUtkalContentStore({ id: storeId ?? null }) ? "300+" : String(total);
}
