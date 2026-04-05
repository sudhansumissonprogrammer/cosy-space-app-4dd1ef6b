import { useEffect } from "react";

interface DynamicPwaManifestProps {
  storeName: string;
  logoUrl?: string | null;
  themeColor?: string;
  /** Custom start URL — e.g. "/dashboard" for admin PWA */
  startUrl?: string;
}

/**
 * Dynamically generates and injects a per-store PWA manifest
 * so each store gets its own installable app with its own name/logo.
 */
export default function DynamicPwaManifest({ storeName, logoUrl, themeColor = "#4361ee", startUrl }: DynamicPwaManifestProps) {
  useEffect(() => {
    // Build icons array — use store logo if available, else fallback to default PWA icons
    const icons = logoUrl
      ? [
          { src: logoUrl, sizes: "192x192", type: "image/png" },
          { src: logoUrl, sizes: "512x512", type: "image/png" },
          { src: logoUrl, sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ]
      : [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ];

    const manifest = {
      name: storeName,
      short_name: storeName.length > 12 ? storeName.slice(0, 12) : storeName,
      description: `Shop at ${storeName}`,
      theme_color: themeColor,
      background_color: "#ffffff",
      display: "standalone" as const,
      start_url: startUrl || (window.location.origin + "/"),
      scope: startUrl ? window.location.origin + startUrl : window.location.origin + "/",
      icons,
    };

    const blob = new Blob([JSON.stringify(manifest)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    // Remove any existing manifest link (including the static one from vite-plugin-pwa)
    const existingLinks = document.querySelectorAll('link[rel="manifest"]');
    existingLinks.forEach((link) => link.remove());

    // Inject new dynamic manifest
    const link = document.createElement("link");
    link.rel = "manifest";
    link.href = url;
    document.head.appendChild(link);

    // Also update theme-color meta tag
    let themeMeta = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement;
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.name = "theme-color";
      document.head.appendChild(themeMeta);
    }
    themeMeta.content = themeColor;

    // Update apple-touch-icon if store has a logo
    if (logoUrl) {
      let appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement;
      if (!appleIcon) {
        appleIcon = document.createElement("link");
        appleIcon.rel = "apple-touch-icon";
        document.head.appendChild(appleIcon);
      }
      appleIcon.href = logoUrl;
    }

    // Set per-store favicon so browser tab shows store logo, not ShopBanao icon
    if (logoUrl) {
      let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement;
      if (!favicon) {
        favicon = document.createElement("link");
        favicon.rel = "icon";
        document.head.appendChild(favicon);
      }
      favicon.type = "image/png";
      favicon.href = logoUrl;
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [storeName, logoUrl, themeColor]);

  return null;
}
