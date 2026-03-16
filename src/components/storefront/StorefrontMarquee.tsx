import { useQueryClient } from "@tanstack/react-query";
import { useOutletContext } from "react-router-dom";

const DEFAULT_TEXT = "🚚 Free Delivery • 🔄 Easy Returns • 🔒 Secure Payments • 💰 Cash On Delivery • 👜 Premium Quality";

interface Props {
  text?: string;
}

export default function StorefrontMarquee({ text }: Props) {
  // Try to read marquee_text from theme config in React Query cache
  const queryClient = useQueryClient();
  let storeId: string | undefined;
  try {
    const ctx = useOutletContext<any>();
    storeId = ctx?.id;
  } catch {
    // not inside an Outlet — ignore
  }

  const themeConfig = storeId
    ? queryClient.getQueryData<any>(["storefront-theme-config", storeId])
    : null;

  const displayText = text || themeConfig?.marquee_text || DEFAULT_TEXT;

  const segments = displayText.split(" • ").filter(Boolean);

  const Group = ({ prefix }: { prefix: string }) => (
    <div className="flex items-center gap-[35px] pr-[35px] md:gap-[60px] md:pr-[60px]">
      {segments.map((segment: string, idx: number) => (
        <span key={`${prefix}-${idx}`} className="flex items-center gap-2 whitespace-nowrap">
          <span>{segment.trim()}</span>
          {idx < segments.length - 1 && <span className="text-black/70">•</span>}
        </span>
      ))}
    </div>
  );

  return (
    <div
      className="w-full overflow-hidden py-2.5 text-[13px] md:text-[15px] font-medium font-sans"
      style={{
        background: "var(--storefront-marquee-gradient, linear-gradient(90deg, #b8873c, #f1d78a, #d1a24a))",
        color: "var(--storefront-text, #000000)",
        fontVariant: "small-caps",
      }}
    >
      <div className="flex w-max animate-marquee hover:[animation-play-state:paused]">
        <Group prefix="a" />
        <Group prefix="b" />
      </div>
    </div>
  );
}
