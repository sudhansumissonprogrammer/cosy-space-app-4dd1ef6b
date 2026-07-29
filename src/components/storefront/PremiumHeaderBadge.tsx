/**
 * PremiumHeaderBadge — Inline SVG "Verified" tick shown beside the store name
 * in the storefront mobile header. Only meaningful when the store has no
 * uploaded logo (text logo). Gated by `show_premium_header_badge` theme
 * setting. Default off.
 *
 * Inline SVG (~0.5 KB) replaces the 545 KB PNG asset — zero network cost.
 */
export default function PremiumHeaderBadge({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={28}
      height={28}
      aria-label="Verified store"
      role="img"
      className={`h-[26px] w-[26px] sm:h-[30px] sm:w-[30px] shrink-0 select-none pointer-events-none ${className}`}
    >
      <title>Verified store</title>
      <path
        fill="#1D9BF0"
        d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.27 2.52-.81 3.91c-1.31.67-2.19 1.91-2.19 3.34s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
      />
      <path
        fill="#FFFFFF"
        d="m10.62 15.44-2.83-2.83 1.41-1.41 1.42 1.42 4.24-4.24 1.42 1.41z"
      />
    </svg>
  );
}
