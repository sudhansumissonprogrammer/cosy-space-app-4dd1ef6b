import { useState } from "react";
import { Truck } from "lucide-react";
import { courierLogo, courierMeta } from "@/lib/shipping/courierRegistry";

/**
 * Courier brand mark. Pulls the live logo from the courier's own domain and
 * degrades to a neutral truck/initials chip if the image can't load, so the
 * row never renders broken.
 */
export default function CourierLogo({
  slug,
  size = 36,
  className = "",
}: {
  slug?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const meta = courierMeta(slug);
  const src = courierLogo(slug, 64);

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border bg-background ${className}`}
      style={{ width: size, height: size }}
      title={meta.name}
    >
      {src && !failed ? (
        <img
          src={src}
          alt={`${meta.name} logo`}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-[62%] w-[62%] object-contain"
        />
      ) : (
        <Truck className="h-1/2 w-1/2 opacity-60" />
      )}
    </span>
  );
}
