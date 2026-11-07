import { KALINGA_STORE_ID } from "@/lib/kalingaStore";

export const SERDIYA_VOICE_STORE_ID = "771a3012-393c-421a-b1c9-2ca918e6917f";
export function hasHindiShoppingVoice(store?: { id?: string | null } | null) {
  return store?.id === SERDIYA_VOICE_STORE_ID || store?.id === KALINGA_STORE_ID;
}

// Everyday Hinglish (Hindi with common English shopping words), as shoppers actually speak.
export const hindiVoiceScripts = {
  home: "नमस्ते! हमारे store में आपका स्वागत है। आप category wise shopping कर सकते हो — कोई भी category चुनिए और पसंद का design देखिए।",
  category: "इस collection के सारे designs यहीं हैं। नीचे scroll करते जाइए। जो design पसंद आए, उसकी photo पर click करके पूरी details देखिए, और वहीं से order कर सकते हो।",
  product: "Photo पर tap करके zoom करके देखिए, और बाकी photos के लिए side में swipe कीजिए। Design पसंद आए, तो नीचे Buy Now button दबाइए।",
  cart: "अपने चुने हुए items और quantity एक बार check कर लीजिए। सब सही है, तो order के लिए आगे वाला button दबाइए।",
  phone: "Order के लिए अपना 10 digit mobile number डालिए, वही number जिस पर हम आपसे बात कर सकें। फिर आगे वाला button दबाइए।",
  address: "अब अपना नाम और पूरा address भरिए। घर, गली, गाँव या शहर, और 6 digit pincode सही से लिखिए। उसके बाद payment option चुनिए।",
  address100: "अब अपना नाम और पूरा address भरिए, और 6 digit pincode सही से लिखिए। Address के बाद सिर्फ़ 100 रुपये pay करके आपका order book हो जाएगा, और बाकी पैसे delivery पर देने हैं।",
  name: "यहाँ अपना पूरा नाम लिखिए, ताकि parcel सही person तक पहुँचे।",
  postal: "यहाँ अपने area का 6 digit pincode डालिए, और check कीजिए कि शहर या गाँव सही आ रहा है।",
  street: "यहाँ घर number, गली, मोहल्ला और गाँव, पूरा address लिखिए। पास का कोई landmark भी लिख दीजिए, ताकि delivery आसानी से हो जाए।",
  partial100: "बस 100 रुपये अभी pay करके अपना order book कीजिए। ये 100 रुपये आपके order total में ही जुड़ जाते हैं, कोई extra charge नहीं है। बाकी amount parcel मिलने पर delivery के time दीजिए। ये छोटा advance इसलिए लेते हैं, क्योंकि fake orders से shop को shipping का नुकसान होता है। कोई भी doubt हो, तो आप हमारी shop को video call कर सकते हो, और हमारी shop की videos website के video section में जाकर देख सकते हो। Ready हैं, तो नीचे pay वाला button दबाइए।",
  partial: "आपने partial payment चुना है, यानी थोड़ा अभी और बाकी delivery पर। अभी कितना देना है और delivery पर कितना, ऊपर देख लीजिए। ये advance आपके order total में ही शामिल है, कोई extra charge नहीं है। कोई doubt हो, तो हमारी shop को video call कर सकते हो, और shop की videos website के video section में देख सकते हो।",
  full: "आपने full payment online चुना है। Total amount और address एक बार check कर लीजिए, फिर अपना payment option चुनिए। Payment होने के बाद इसी page पर वापस आइए।",
  cod: "आपने Cash on Delivery चुना है। Address और total amount check कर लीजिए। Parcel लेने के लिए पक्का ready हों, तभी order confirm कीजिए।",
  waiting: "आपका payment check हो रहा है, please इसी page पर रुकिए। अगर पैसे कट गए हैं, तो दोबारा payment मत कीजिए। Confirmation आने तक थोड़ा wait कीजिए।",
  failed: "Payment confirm नहीं हुआ है। अगर पैसे कट गए हैं, तो दोबारा pay मत कीजिए। पहले status check कीजिए, या shop से contact कीजिए।",
  success: "बधाई हो, आपका order confirm हो गया है! Order details, और delivery पर बचा हुआ amount अगर कोई है, इसी page पर देख लीजिए। Thank you!",
} as const;
export type HindiVoiceClip = keyof typeof hindiVoiceScripts;
export type VoiceCheckoutState = {
  storeId: string;
  stage: "phone" | "address" | "payment" | "waiting" | "failed" | "success" | "loading";
  mode: "partial" | "full" | "cod";
  amount: number;
  balance: number;
};
let checkout: VoiceCheckoutState | null = null;
const listeners = new Set<() => void>();
export const getVoiceCheckout = () => checkout;
export function publishVoiceCheckout(next: VoiceCheckoutState | null) {
  checkout = next;
  listeners.forEach(listener => listener());
}
export function subscribeVoiceCheckout(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function voicePaymentClip(state: VoiceCheckoutState): HindiVoiceClip {
  if (state.mode === "cod") return "cod";
  if (state.mode === "full") return "full";
  return state.amount === 100 ? "partial100" : "partial";
}
/** Mentions the ₹100 booking only when the shopper's selected advance is actually ₹100. */
export function voiceCheckoutClip(state: VoiceCheckoutState): HindiVoiceClip | null {
  if (state.stage === "loading") return null;
  if (state.stage === "payment") return voicePaymentClip(state);
  if (state.stage === "address") return state.mode === "partial" && state.amount === 100 ? "address100" : "address";
  return state.stage;
}
export function voiceRouteClip(pathname: string, storeSlug: string): HindiVoiceClip | null {
  const path = pathname.replace(new RegExp(`^/store/${storeSlug}(?=/|$)`), "") || "/";
  if (path === "/") return "home";
  if (/^\/(category(?:\/|$)|categories$|shop$|best-sellers$)/.test(path)) return "category";
  if (/^\/product\//.test(path)) return "product";
  if (path === "/cart") return "cart";
  return null;
}