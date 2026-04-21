/**
 * Listens for "cart:add" custom events and renders a floating "+1" badge
 * that animates upward from the nearest [data-cart-target] element.
 * Zero performance cost when idle.
 */
import { useEffect, useState } from "react";

interface Burst { id: number; x: number; y: number; }

export default function CartPlusOneOverlay() {
  const [bursts, setBursts] = useState<Burst[]>([]);

  useEffect(() => {
    const onAdd = () => {
      const target = document.querySelector("[data-cart-target]") as HTMLElement | null;
      if (!target) return;
      const r = target.getBoundingClientRect();
      const id = Date.now() + Math.random();
      const x = r.left + r.width / 2;
      const y = r.top;
      setBursts((b) => [...b, { id, x, y }]);
      window.setTimeout(() => {
        setBursts((b) => b.filter((p) => p.id !== id));
      }, 950);
    };
    window.addEventListener("cart:add", onAdd as EventListener);
    return () => window.removeEventListener("cart:add", onAdd as EventListener);
  }, []);

  if (bursts.length === 0) return null;

  return (
    <>
      {bursts.map((b) => (
        <span
          key={b.id}
          className="cart-plus-one"
          style={{ left: b.x, top: b.y }}
          aria-hidden="true"
        >
          +1
        </span>
      ))}
    </>
  );
}
