import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Clock, MessageCircle, Instagram, Facebook, Mail } from "lucide-react";
import shopbanaoLogo from "@/assets/shopbanao-logo.webp";
import { hidesPlatformBranding } from "@/lib/storefrontBranding";
import StoreTextLogo from "@/components/storefront/StoreTextLogo";
import type { StoreData } from "@/layouts/StorefrontLayout";
import { storefrontPath, isCustomDomainHost } from "@/lib/subdomain";
import { optimizeImageUrl } from "@/lib/imageOptimize";
import { supabase } from "@/integrations/supabase/client";
import { waPhoneNumber } from "@/lib/phoneUtils";
import { kalingaPublicAddress, kalingaPublicEmail } from "@/lib/kalingaStore";

interface StorefrontFooterProps {
  store: StoreData;
}

/**
 * Footer store info (public email + configured payment methods) in ONE
 * request instead of two, and only after the browser goes idle — the footer
 * is always below the fold, so these must never compete with the LCP image.
 */
function useFooterInfo(storeId?: string) {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    const run = () => setIdle(true);
    const handle = ric ? ric(run, { timeout: 3000 }) : window.setTimeout(run, 1800);
    return () => {
      if (ric && typeof handle === "number") (window as any).cancelIdleCallback?.(handle);
      else window.clearTimeout(handle as number);
    };
  }, []);

  return useQuery({
    queryKey: ["store-footer-info", storeId],
    enabled: !!storeId && idle,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      const [footerRes, locationsRes] = await Promise.all([
        (supabase as any).rpc("get_store_footer_info", { _store_id: storeId }),
        supabase
          .from("store_locations")
          .select("id", { count: "exact", head: true })
          .eq("store_id", storeId!)
          .eq("is_published", true),
      ]);
      const payload = (Array.isArray(footerRes.data) ? footerRes.data[0] : footerRes.data) || {};
      return {
        publicEmail: ((payload.public_email as string) || "").trim(),
        paymentMethods: (payload.payment_methods || []) as string[],
        locationCount: locationsRes.count ?? 0,
      };
    },
  });
}

function PaymentIcons({ methods: list }: { methods: string[] }) {
  const methods = new Set((list || []).map((m) => String(m).toLowerCase()));
  const hasCard = methods.has("razorpay") || methods.has("cashfree") || methods.has("payu");
  const hasUpi = hasCard || methods.has("upi");
  const hasCod = methods.has("cod");
  if (!hasCard && !hasUpi && !hasCod) return null;


  return (
    <div className="flex items-center gap-3 flex-wrap">
      {hasCard && <div className="h-7 px-2 rounded bg-white/10 flex items-center justify-center text-[9px] font-bold tracking-wide opacity-60">CARD</div>}
      {hasUpi && <div className="h-7 w-11 rounded bg-white/10 flex items-center justify-center text-[9px] font-bold tracking-wide opacity-60">UPI</div>}
      {hasCod && <div className="h-7 w-11 rounded bg-white/10 flex items-center justify-center text-[9px] font-bold tracking-wide opacity-60">COD</div>}
    </div>
  );
}

export default function StorefrontFooter({ store }: StorefrontFooterProps) {
  const year = new Date().getFullYear();
  const hours = store.business_hours as Record<string, string> | null;
  const hasHours = hours && Object.values(hours).some((v) => v?.trim());
  const address = kalingaPublicAddress(store) ?? [store.location, store.city, store.state].filter(Boolean).join(", ");
  

  // owner_email is bundled in the storefront shell; the idle footer-info RPC
  // only fills in for legacy cached shells that predate the inlining.
  const shellEmail = kalingaPublicEmail(store) ?? (store as any).owner_email as string | null | undefined;
  const { data: footerInfo } = useFooterInfo(store.id);
  const ownerEmail =
    shellEmail === undefined ? footerInfo?.publicEmail || "" : (shellEmail || "").trim();
  const paymentMethods = footerInfo?.paymentMethods || [];


  return (
    <footer
      className="mt-16 border-t"
      style={{
        backgroundColor: "var(--storefront-primary, #1a1a1a)",
        color: "var(--storefront-footer-text, #ffffff)",
      }}
    >
      {/* Newsletter form removed — was collecting emails without storing or consent disclosure */}
      <div className="mx-auto max-w-6xl lg:max-w-7xl px-4 lg:px-6 py-10">
        <div className={`grid gap-8 sm:grid-cols-2 ${hasHours ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {/* Column 1: Brand */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {store.logo_url ? (
                <img src={optimizeImageUrl(store.logo_url, 160, 80)} alt={store.name} width={160} height={56} className="h-14 w-auto max-w-[160px] object-contain" loading="lazy" decoding="async" />
              ) : (
                <StoreTextLogo storeName={store.name} size="text-lg" color="inherit" />
              )}
            </div>
            {store.description && (
              <p className="text-sm leading-relaxed opacity-80 line-clamp-3">
                {store.description}
              </p>
            )}
            {/* Social icons row */}
            <div className="flex items-center gap-3 pt-1">
              {store.whatsapp_number && (
                <a
                  href={`https://wa.me/${waPhoneNumber(store.whatsapp_number) ?? ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-[transform,opacity,colors,box-shadow] hh:hover-scale-110"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              )}
              {store.instagram_url && (
                <a
                  href={store.instagram_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-[transform,opacity,colors,box-shadow] hh:hover-scale-110"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
              )}
              {store.facebook_url && (
                <a
                  href={store.facebook_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9 w-9 items-center justify-center rounded-full transition-[transform,opacity,colors,box-shadow] hh:hover-scale-110"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)" }}
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider">Quick Links</h3>
            <nav className="flex flex-col gap-2.5">
              {[
                { to: storefrontPath(store.slug), label: "Home" },
                ...((footerInfo?.locationCount ?? 0) > 0
                  ? [{ to: storefrontPath(store.slug, "stores"), label: "Find a Store" }]
                  : []),
                { to: storefrontPath(store.slug, "about"), label: "About Us" },
                { to: storefrontPath(store.slug, "contact"), label: "Contact Us" },
                { to: storefrontPath(store.slug, "return-policy"), label: "Return, Refund & Cancellation" },
                { to: storefrontPath(store.slug, "shipping-policy"), label: "Shipping Policy" },
                { to: storefrontPath(store.slug, "terms"), label: "Terms & Conditions" },
                { to: storefrontPath(store.slug, "privacy-policy"), label: "Privacy Policy" },
              ].map((link) => (
                <Link
                  key={link.label}
                  to={link.to}
                  className="text-[13px] sm:text-sm opacity-75 transition-opacity hover:opacity-100"
                  style={{ color: "inherit" }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Column 3: Business Hours */}
          {hasHours && (
            <div className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider">
                <Clock className="h-3.5 w-3.5" /> Business Hours
              </h3>
              <div className="space-y-1">
                {Object.entries(hours!).map(([day, time]) =>
                  time?.trim() ? (
                    <div key={day} className="flex justify-between text-sm">
                      <span className="capitalize opacity-75">{day}</span>
                      <span>{time}</span>
                    </div>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Column: Contact & Address */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wider">Contact</h3>
            <div className="space-y-2.5">
              {address && (
                <p className="flex items-start gap-2 text-sm opacity-75">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {address}
                </p>
              )}
              {ownerEmail && (
                <a
                  href={`mailto:${ownerEmail}`}
                  className="flex items-start gap-2 text-sm opacity-75 hover:opacity-100 transition-opacity break-all"
                  style={{ color: "inherit" }}
                >
                  <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{ownerEmail}</span>
                </a>
              )}
              {store.whatsapp_number && (
                <a
                  href={`https://wa.me/${waPhoneNumber(store.whatsapp_number) ?? ""}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 text-sm opacity-75 hover:opacity-100 transition-opacity"
                  style={{ color: "inherit" }}
                >
                  <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{store.whatsapp_number}</span>
                </a>
              )}
              {(store as any).secondary_phone && (
                <a
                  href={`tel:${((store as any).secondary_phone as string).replace(/[^0-9+]/g, "")}`}
                  className="flex items-start gap-2 text-sm opacity-75 hover:opacity-100 transition-opacity"
                  style={{ color: "inherit" }}
                >
                  <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{(store as any).secondary_phone}</span>
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar with payment icons */}
        <div className="mt-8 border-t pt-6 pb-24 sm:pb-6 space-y-4" style={{ borderColor: "currentcolor", borderTopWidth: "1px", opacity: 1 }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs opacity-60">
              © {year} {store.name}. All rights reserved.
            </p>
            <PaymentIcons methods={paymentMethods} />
          </div>
          {!hidesPlatformBranding(store) && !isCustomDomainHost() && (
            <p className="text-xs opacity-50 flex items-center justify-center gap-1">
              Powered by{" "}
              <span className="inline-flex items-center gap-1">
                <img src={shopbanaoLogo} alt="ShopBanao" className="h-5 w-auto inline-block" loading="lazy" />
                ShopBanao
              </span>
            </p>
          )}
        </div>
      </div>
    </footer>
  );
}
