import { useEffect, useState } from "react";
import { isUtkalContentStore } from "../../../../supabase/functions/_shared/utkalContent";
import banner from "@/assets/utkal-whatsapp-community.webp.asset.json";

export default function UtkalCommunityBanner({ store, visible }: {
  store: { id?: string | null; slug?: string | null };
  visible: boolean;
}) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  if (!mobile || !visible || !isUtkalContentStore(store)) return null;
  return (
    <a
      href="https://chat.whatsapp.com/CRZQkGo6jxK3LbmZB4xUua"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Join Utkal Watch WhatsApp community"
      className="block w-full sm:hidden"
    >
      <img src={banner.url} alt="Join our WhatsApp Community — exclusive offers, new arrivals and member-only deals"
        width={1920} height={277} loading="lazy" decoding="async" fetchPriority="low"
        className="block h-auto w-full" />
    </a>
  );
}