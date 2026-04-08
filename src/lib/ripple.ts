/**
 * Creates a Material Design ripple effect on a container element.
 * Call from onClick/onTouchStart on any element with class "ripple-container".
 */
export function createRipple(e: React.MouseEvent | React.TouchEvent) {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
  const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const size = Math.max(rect.width, rect.height) * 2;

  const ripple = document.createElement("span");
  ripple.className = "ripple-wave";
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${x - size / 2}px`;
  ripple.style.top = `${y - size / 2}px`;
  target.appendChild(ripple);

  ripple.addEventListener("animationend", () => ripple.remove());
}
