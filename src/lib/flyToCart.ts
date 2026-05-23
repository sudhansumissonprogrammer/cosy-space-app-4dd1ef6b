/**
 * Swiggy-style fly-to-cart micro-interaction.
 *
 * Flies a circular product image from the click origin to the nearest
 * visible cart icon (`[data-cart-target]`) along a parabolic arc using
 * the Web Animations API. On landing, pulses the cart icon and dispatches
 * a `cart:fly-landed` CustomEvent so callers can open the SideCart after
 * the arc completes.
 *
 * Falls back gracefully when no target is found or the user prefers
 * reduced motion — in both cases it returns 0 so callers can open the
 * cart immediately.
 */

interface FlyOptions {
  imageUrl?: string;
  label?: string;
  size?: number;
  duration?: number;
  fromRect?: DOMRect;
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
    if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
    return true;
  });
  if (targets.length === 0) return null;
  const isMobile = window.matchMedia("(max-width: 767px)").matches;
  targets.sort((a, b) => {
    const ay = a.getBoundingClientRect().top;
    const by = b.getBoundingClientRect().top;
    return isMobile ? by - ay : ay - by;
  });
  return targets[0];
}

function pulseTarget(target: HTMLElement) {
  target.classList.add("cart-target-absorb");
  setTimeout(() => target.classList.remove("cart-target-absorb"), 520);
  try { (navigator as any).vibrate?.(8); } catch {}
  try {
    window.dispatchEvent(new CustomEvent("cart:fly-landed"));
  } catch {}
}

/**
 * Returns the animation duration in ms (0 if skipped — caller can open cart instantly).
 */
export function flyToCart(source: Element | DOMRect | null, opts: FlyOptions = {}): number {
  if (typeof window === "undefined" || typeof document === "undefined") return 0;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return 0;

  const target = pickTarget();
  if (!target) return 0;

  const fromRect: DOMRect | null =
    opts.fromRect
      ?? (source instanceof Element ? source.getBoundingClientRect() : (source as DOMRect | null));
  if (!fromRect) return 0;

  const toRect = target.getBoundingClientRect();

  const hasImage = !!opts.imageUrl;
  const size = opts.size ?? (hasImage ? 56 : 28);
  const duration = opts.duration ?? 720;

  const startX = fromRect.left + fromRect.width / 2 - size / 2;
  const startY = fromRect.top + fromRect.height / 2 - size / 2;
  const endX = toRect.left + toRect.width / 2 - size / 2;
  const endY = toRect.top + toRect.height / 2 - size / 2;

  // Parabolic arc — lift the midpoint up by 25% of vertical distance (min 90px).
  const dx = endX - startX;
  const dy = endY - startY;
  const arcLift = Math.max(90, Math.abs(dy) * 0.25 + Math.abs(dx) * 0.08);

  // Build the flyer
  const flyer = document.createElement("div");
  Object.assign(flyer.style, {
    position: "fixed",
    left: `${startX}px`,
    top: `${startY}px`,
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "999px",
    overflow: "hidden",
    pointerEvents: "none",
    zIndex: "10000",
    boxShadow:
      "0 10px 24px -6px rgba(0,0,0,0.35), 0 0 0 3px rgba(255,255,255,0.92)",
    background:
      hasImage
        ? "var(--storefront-bg, #fff)"
        : "var(--storefront-primary, hsl(var(--primary)))",
    color: "var(--storefront-btn-text, #fff)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: "800",
    willChange: "transform, opacity",
    backfaceVisibility: "hidden",
  } as CSSStyleDeclaration);

  if (hasImage) {
    const img = document.createElement("img");
    img.src = opts.imageUrl!;
    img.alt = "";
    img.decoding = "async";
    Object.assign(img.style, {
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: "center",
      display: "block",
    } as CSSStyleDeclaration);
    flyer.appendChild(img);
  } else {
    flyer.textContent = opts.label ?? "+1";
  }

  document.body.appendChild(flyer);

  // Faint trailing dot for the "tail" feel
  const tail = document.createElement("div");
  Object.assign(tail.style, {
    position: "fixed",
    left: `${startX + size / 2 - 5}px`,
    top: `${startY + size / 2 - 5}px`,
    width: "10px",
    height: "10px",
    borderRadius: "999px",
    background: "var(--storefront-primary, hsl(var(--primary)))",
    opacity: "0.55",
    pointerEvents: "none",
    zIndex: "9999",
    willChange: "transform, opacity",
    filter: "blur(1px)",
  } as CSSStyleDeclaration);
  document.body.appendChild(tail);

  const midX = dx / 2;
  const midY = dy / 2 - arcLift;

  const easing = "cubic-bezier(.55,.05,.25,1)";

  const flyerAnim = flyer.animate(
    [
      { transform: "translate3d(0,0,0) scale(0.6) rotate(-8deg)", opacity: 0 },
      { transform: "translate3d(0,0,0) scale(1.08) rotate(-4deg)", opacity: 1, offset: 0.12 },
      {
        transform: `translate3d(${midX}px, ${midY}px, 0) scale(1) rotate(8deg)`,
        opacity: 1,
        offset: 0.55,
      },
      {
        transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.22) rotate(18deg)`,
        opacity: 0.25,
      },
    ],
    { duration, easing, fill: "forwards" },
  );

  tail.animate(
    [
      { transform: "translate3d(0,0,0) scale(1)", opacity: 0.55 },
      {
        transform: `translate3d(${midX}px, ${midY}px, 0) scale(0.85)`,
        opacity: 0.4,
        offset: 0.55,
      },
      {
        transform: `translate3d(${dx}px, ${dy}px, 0) scale(0.15)`,
        opacity: 0,
      },
    ],
    { duration: duration + 80, easing, fill: "forwards", delay: 90 },
  );

  flyerAnim.onfinish = () => {
    flyer.remove();
    tail.remove();
    pulseTarget(target);
  };

  // Safety cleanup in case onfinish never fires
  setTimeout(() => {
    if (flyer.isConnected) flyer.remove();
    if (tail.isConnected) tail.remove();
  }, duration + 400);

  return duration;
}
