/** Opening readiness is independent of idle CPU time: photos may still be downloading. */
export function storefrontOpeningReady(): boolean {
  if (document.readyState !== "complete" || document.hidden) return false;
  const root = document.querySelector('[data-storefront-ready="true"]');
  if (!root || document.querySelector('[data-storefront-loading="true"]')) return false;
  return Array.from(root.querySelectorAll<HTMLImageElement>("img")).every((image) => {
    const rect = image.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) return true;
    return !image.getAttribute("src") || image.complete;
  });
}

/** Recheck throughout the delay; a late opening photo cancels the countdown. */
export function afterStorefrontOpening(callback: () => void, delay: number): () => void {
  let readySince: number | undefined;
  let disposed = false;
  const check = () => {
    if (disposed) return;
    if (!storefrontOpeningReady()) readySince = undefined;
    else {
      readySince ??= performance.now();
      if (performance.now() - readySince >= delay) {
        disposed = true;
        window.clearInterval(interval);
        callback();
      }
    }
  };
  const interval = window.setInterval(check, 250);
  check();
  return () => { disposed = true; window.clearInterval(interval); };
}