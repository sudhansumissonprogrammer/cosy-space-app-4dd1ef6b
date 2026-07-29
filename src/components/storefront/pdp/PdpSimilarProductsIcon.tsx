import type { SVGProps } from "react";

/**
 * Custom three-fanned-cards icon used on the PDP to jump to the
 * "Similar products" carousels. Matches the reference design (three
 * overlapping photo cards) and renders as a black outline so it stays
 * readable on the white glassmorphic button.
 */
export default function PdpSimilarProductsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Left card, slightly fanned behind */}
      <rect x="2.5" y="5.5" width="8" height="13" rx="1.3" transform="rotate(-10 6.5 12)" />
      {/* Right card, slightly fanned behind */}
      <rect x="13.5" y="5.5" width="8" height="13" rx="1.3" transform="rotate(10 17.5 12)" />
      {/* Center card, front */}
      <rect x="6.5" y="4" width="11" height="16" rx="1.5" />
    </svg>
  );
}
