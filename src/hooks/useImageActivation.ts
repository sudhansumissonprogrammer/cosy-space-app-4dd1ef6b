import { useEffect, useRef, useState } from "react";

type ActivationOptions = { rootMargin?: string; afterScroll?: boolean; afterReady?: boolean };
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
        if (group?.onScroll) window.removeEventListener("scroll", group.onScroll);
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
    node.addEventListener("storefront:prepare-card", activate);
    const stopVisible = subscribe(node, activate, {});
    const stopAhead = options.rootMargin && options.rootMargin !== "0px"
      ? subscribe(node, activate, options) : undefined;
    // Prepare the first upcoming rows once opening card photos have decoded.
    // No competing look-ahead requests during the opening photo download.
    let stopReady: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const checkReady = () => {
      const grid = node.parentElement;
      const opening = grid?.querySelectorAll<HTMLImageElement>("[data-card-priority='true'] a img");
      // Failed opening photos also settle. A missing/broken photo must not
      // keep every offscreen card polling forever or block the ready buffer.
      if (!opening?.length || Array.from(opening).every(img => !!img.currentSrc && img.complete)) {
        stopReady = subscribe(node, activate, { rootMargin: options.rootMargin });
      } else {
        timer = setTimeout(checkReady, 250);
      }
    };
    if (options.afterReady) timer = setTimeout(checkReady, 250);
    return () => { node.removeEventListener("storefront:prepare-card", activate); stopVisible(); stopAhead?.(); stopReady?.(); if (timer) clearTimeout(timer); };
  }, [active, priority, options.rootMargin, options.afterScroll, options.afterReady]);
  return { ref, active };
}