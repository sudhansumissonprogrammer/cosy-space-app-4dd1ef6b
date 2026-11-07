import { KALINGA_STORE_ID } from "@/lib/kalingaStore";

export const SERDIYA_VOICE_STORE_ID = "771a3012-393c-421a-b1c9-2ca918e6917f";
export function hasHindiShoppingVoice(store?: { id?: string | null } | null) {
  return store?.id === SERDIYA_VOICE_STORE_ID || store?.id === KALINGA_STORE_ID;
}

export const hindiVoiceScripts = {
  home: "नमस्ते! अपनी पसंद के गहने देखने के लिए नीचे की ओर उँगली चलाइए। चेन, अंगूठी या दूसरी श्रेणी चुनिए। जो डिज़ाइन पसंद आए, उसकी फोटो पर दबाइए।",
  category: "यहाँ सभी डिज़ाइन देख सकते हैं। नीचे की ओर उँगली चलाते जाइए। जो डिज़ाइन पसंद आए, उसकी फोटो पर दबाकर पूरी जानकारी देखिए।",
  product: "फोटो को छूकर बड़ा करके देखिए। और फोटो देखने के लिए उँगली बाईं ओर चलाइए। साइज़ का विकल्प हो तो अपना साइज़ चुनिए। पसंद आए तो नीचे अभी खरीदें, यानी बाय नाउ का बटन दबाइए।",
  cart: "अपने चुने हुए गहने और उनकी गिनती देख लीजिए। सब सही हो तो ऑर्डर करने के लिए आगे बढ़ें का बटन दबाइए।",
  phone: "ऑर्डर करने के लिए अपना दस अंकों वाला मोबाइल नंबर भरिए। फिर आगे बढ़ें का बटन दबाइए। जिस नंबर पर आपसे संपर्क हो सके, वही नंबर दीजिए।",
  address: "अपना नाम और पूरा पता भरिए। गाँव या शहर, घर या मोहल्ला, और छह अंकों वाला पिन कोड सही लिखिए। फिर पता जाँचकर भुगतान का तरीका चुनिए।",
  name: "यहाँ अपना पूरा नाम लिखिए, ताकि पार्सल सही व्यक्ति तक पहुँचे।",
  postal: "यहाँ अपने इलाके का छह अंकों वाला पिन कोड लिखिए। गाँव या शहर की जानकारी सही है या नहीं, जाँच लीजिए।",
  street: "यहाँ घर, मोहल्ले और गाँव का पूरा पता लिखिए। पास की कोई पहचान भी लिख सकते हैं, ताकि पार्सल पहुँचाने में आसानी हो।",
  partial100: "इस विकल्प में ऑर्डर बुक करने के लिए सौ रुपये अभी देने हैं। यह आपके ऑर्डर की कीमत में शामिल है, अलग शुल्क नहीं है। बाकी रकम पार्सल मिलने पर दीजिए। कुछ ऑर्डर स्वीकार नहीं किए जाते, जिससे दुकान को नुकसान होता है। इसलिए सही और पक्के ऑर्डर के लिए छोटा अग्रिम लेते हैं। भरोसे के लिए ग्राहकों की राय और दुकान का वीडियो देख सकते हैं। सवाल हो तो दुकान से संपर्क करके वीडियो कॉल के बारे में पूछिए। तैयार हों तो नीचे भुगतान का बटन दबाइए।",
  partial: "आपने थोड़ा भुगतान अभी और बाकी पार्सल मिलने पर देने का विकल्प चुना है। अभी देनी वाली रकम और बाकी रकम ऊपर देख लीजिए। अग्रिम रकम ऑर्डर की कीमत में शामिल है, अलग शुल्क नहीं है। पार्सल स्वीकार न किए जाने से दुकान को नुकसान होता है, इसलिए पक्का ऑर्डर करने के लिए छोटा अग्रिम लेते हैं। भरोसे के लिए ग्राहकों की राय और दुकान का वीडियो देखिए। सवाल हो तो दुकान से संपर्क कीजिए।",
  full: "आपने पूरा भुगतान अभी करने का विकल्प चुना है। कुल रकम और पता जाँच लीजिए। फिर अपनी भुगतान सुविधा चुनिए। भुगतान पूरा होने पर इसी पन्ने पर वापस आइए।",
  cod: "आपने पार्सल मिलने पर भुगतान करने का विकल्प चुना है। अपना पता और कुल रकम जाँच लीजिए। पार्सल स्वीकार करने के लिए तैयार हों, तभी ऑर्डर पक्का कीजिए।",
  waiting: "आपके भुगतान की जाँच हो रही है। इसी पन्ने पर रुकिए। पैसे कट गए हों तो दोबारा भुगतान मत कीजिए। पुष्टि होने तक इंतज़ार कीजिए।",
  failed: "भुगतान की पुष्टि नहीं हुई है। पैसे कट गए हों तो दोबारा भुगतान मत कीजिए। पहले स्थिति जाँचिए या दुकान से संपर्क कीजिए।",
  success: "आपका ऑर्डर पक्का हो गया है। ऑर्डर की जानकारी और बाकी भुगतान, अगर कोई हो, इस पन्ने पर देख लीजिए। धन्यवाद!",
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
export function voiceRouteClip(pathname: string, storeSlug: string): HindiVoiceClip | null {
  const path = pathname.replace(new RegExp(`^/store/${storeSlug}(?=/|$)`), "") || "/";
  if (path === "/") return "home";
  if (/^\/(category(?:\/|$)|categories$|shop$|best-sellers$)/.test(path)) return "category";
  if (/^\/product\//.test(path)) return "product";
  if (path === "/cart") return "cart";
  return null;
}