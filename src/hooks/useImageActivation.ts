import { useEffect, useRef, useState } from "react";

type ActivationOptions = { rootMargin?: string; afterScroll?: boolean };
type Subscription = { activate: () => void; waitingForScroll: boolean };
const groups = new Map<string, {
  observer: IntersectionObserver;
  targets: Map<Element, Subscription>;
  onScroll?: () => void;
}>();

/** Share observers; scroll callbacks only arm the buffer, never update React per frame. */
function subscribe(node: Element, activate: () => void, options: ActivationOptions) {
  const margin = options.rootMargin || "0px";
  const key = `${margin}:${!!options.afterScroll}`;
  let group = groups.get(key);
  if (!group) {
    const targets = new Map<Element, Subscription>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) targets.get(entry.target)?.activate();
      }
    }, { rootMargin: margin, threshold: 0.01 });
    group = { observer, targets };
    if (options.afterScroll) {
      group.onScroll = () => {
        if (window.scrollY <= 0) return;
        for (const [target, subscription] of targets) {
          if (subscription.waitingForScroll) {
            subscription.waitingForScroll = false;
            observer.observe(target);
          }
        }
      };
      window.addEventListener("scroll", group.onScroll, { passive: true });
    }
    groups.set(key, group);
  }
  const waitingForScroll = !!options.afterScroll && window.scrollY <= 0;
  group.targets.set(node, { activate, waitingForScroll });
  if (!waitingForScroll) group.observer.observe(node);
  return () => {
    group.targets.delete(node);
    group.observer.unobserve(node);
    if (group.targets.size === 0) {
      group.observer.disconnect();
      if (group.onScroll) window.removeEventListener("scroll", group.onScroll);
      groups.delete(key);
    }
  };
}

/** Activation is sticky: visited photos never revert to placeholders. */
export function useImageActivation(priority = false, options: ActivationOptions = {}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(priority);
  useEffect(() => {
    if (priority) { setActive(true); return; }
    if (active) return;
    const node = ref.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) { setActive(true); return; }
    const activate = () => setActive(true);
    const stopVisible = subscribe(node, activate, {});
    const stopAhead = options.rootMargin && options.rootMargin !== "0px"
      ? subscribe(node, activate, options) : undefined;
    return () => { stopVisible(); stopAhead?.(); };
  }, [active, priority, options.rootMargin, options.afterScroll]);
  return { ref, active };
}