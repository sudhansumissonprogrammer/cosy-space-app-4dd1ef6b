/**
 * Fly-to-cart micro-interaction.
 *
 * Animates a small "+1" bubble from the click origin (or source element)
 * towards the nearest visible cart icon (any element marked
 * `data-cart-target`). Falls back gracefully when no target is found
 * or when the user prefers reduced motion.
 *
 * Usage:
 *   flyToCart(event.currentTarget, { label: "+1" });
 */

interface FlyOptions {
  label?: string;
  color?: string; // bubble background
  textColor?: string; // bubble text color
  size?: number; // px
  duration?: number; // ms
  fromRect?: DOMRect; // override origin rect
}

function pickTarget(): HTMLElement | null {
  const targets = Array.from(
    document.querySelectorAll<HTMLElement>("[data-cart-target]"),
  ).filter((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = window.getComputedStyle(el);
    if (style.visibility === "hidden" || style.display === "none") return false;
    if (parseFloat(style.opacity || "1") < 0.1) return false;
    // Must be inside the viewport (allow partial)
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
    return true;
  });
  if (targets.length === 0) return null;
  // Prefer the topmost (header) cart icon for desktop, bottom (mobile nav) on mobile
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  targets.sort((a, b) => {
    const ay = a.getBoundingClientRect().top;
    const by = b.getBoundingClientRect().top;
    return isMobile ? by - ay : ay - by;
  });
  return targets[0];
}

export function flyToCart(source: Element | DOMRect | null, opts: FlyOptions = {}) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const target = pickTarget();
  if (!target) return;

  const fromRect: DOMRect | null =
    opts.fromRect
      ?? (source instanceof Element ? source.getBoundingClientRect() : null);
  if (!fromRect) return;

  const toRect = target.getBoundingClientRect();

  const size = opts.size ?? 26;
  const startX = fromRect.left + fromRect.width / 2 - size / 2;
  const startY = fromRect.top + fromRect.height / 2 - size / 2;
  const endX = toRect.left + toRect.width / 2 - size / 2;
  const endY = toRect.top + toRect.height / 2 - size / 2;

  const bubble = document.createElement("div");
  bubble.textContent = opts.label ?? "+1";
  Object.assign(bubble.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "999px",
    background: opts.color
      ?? "var(--storefront-primary, #036B52)",
    color: opts.textColor ?? "var(--storefront-btn-text, #ffffff)",
    fontSize: "12px",
    fontWeight: "800",
    letterSpacing: "-0.01em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    pointerEvents: "none",
    zIndex: "10000",
    boxShadow:
      "0 6px 18px -4px rgba(0,0,0,0.35), 0 0 0 2px rgba(255,255,255,0.85)",
    transform: "translate3d(0,0,0) scale(1)",
    transition: "transform 650ms cubic-bezier(0.55, 0, 0.1, 1), opacity 650ms ease-out",
    willChange: "transform, opacity",
  } as CSSStyleDeclaration);

  document.body.appendChild(bubble);

  // Force layout, then animate
  void bubble.offsetWidth;

  const dx = endX - startX;
  const dy = endY - startY;
  bubble.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(0.35)`;
  bubble.style.opacity = "0.2";

  const cleanup = () => {
    bubble.remove();
    // Trigger a tiny "absorb" pulse on the target
    target.classList.add("cart-target-absorb");
    setTimeout(() => target.classList.remove("cart-target-absorb"), 480);
  };
  setTimeout(cleanup, (opts.duration ?? 650) + 30);
}
