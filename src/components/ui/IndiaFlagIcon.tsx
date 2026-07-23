/**
 * Inline SVG India flag — renders identically on every device
 * regardless of installed emoji fonts. Use anywhere we currently
 * show 🇮🇳 next to +91.
 */
export function IndiaFlagIcon({ className = "h-3.5 w-5 rounded-[2px]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 900 600"
      className={className}
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="900" height="200" fill="#FF9933" />
      <rect y="200" width="900" height="200" fill="#FFFFFF" />
      <rect y="400" width="900" height="200" fill="#138808" />
      <g transform="translate(450 300)">
        <circle r="60" fill="none" stroke="#000088" strokeWidth="12" />
        <circle r="12" fill="#000088" />
        {Array.from({ length: 24 }).map((_, i) => (
          <line
            key={i}
            x1="0"
            y1="0"
            x2="60"
            y2="0"
            stroke="#000088"
            strokeWidth="2"
            transform={`rotate(${i * 15})`}
          />
        ))}
      </g>
    </svg>
  );
}
