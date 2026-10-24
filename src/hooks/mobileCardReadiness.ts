/** One shared mobile scheduler, independent of store identity and card style. */
type Card = { activate: () => void; near: boolean };
const cards = new Map<HTMLElement, Card>();
const preparedAhead = new Set<HTMLElement>();
let observer: IntersectionObserver | undefined;
let scheduled = 0;
let scrolling = false;
let ready = false;
let retry: ReturnType<typeof setTimeout> | undefined;

export function chooseMobileCardBuffer<T>(rows: { item: T; top: number; bottom: number }[], height: number): T[] {
  const visible = rows.filter(row => row.bottom > 0 && row.top < height);
  const next = rows.filter(row => row.top >= height && row.top < height + 400)
    .sort((a, b) => a.top - b.top).slice(0, 2);
  return [...visible, ...next].map(row => row.item);
}

function openingSettled() {
  // Include a visible homepage banner/PDP main photo; upcoming cards must not
  // compete with the page's opening photo. Ignore hidden hover/lazy images.
  return Array.from(document.querySelectorAll<HTMLImageElement>('img[loading="eager"], img[fetchpriority="high"]'))
    .every(img => {
      const box = img.getBoundingClientRect();
      return box.bottom <= 0 || box.top >= innerHeight || box.width === 0 || img.complete;
    });
}

function flush() {
  scheduled = 0;
  const stillPendingOpening = !openingSettled();
  for (const node of preparedAhead) {
    if (!node.isConnected || node.getBoundingClientRect().top < innerHeight) preparedAhead.delete(node);
  }
  const near = Array.from(cards).filter(([, card]) => card.near);
  const rows = near.map(([node]) => {
    const box = node.getBoundingClientRect();
    return { item: node, top: box.top, bottom: box.bottom, left: box.left, right: box.right };
  }).filter(row => row.right > 0 && row.left < innerWidth);
  // Visible cards always get a source; only the upcoming row waits for readiness.
  ready = !stillPendingOpening;
  const selected = ready || scrolling
    ? chooseMobileCardBuffer(rows, innerHeight)
    : rows.filter(row => row.bottom > 0 && row.top < innerHeight).map(row => row.item);
  for (const node of selected) {
    const bounds = node.getBoundingClientRect();
    // Clipped horizontal carousel slides are not upcoming vertical cards.
    if (bounds.right <= 0 || bounds.left >= innerWidth) continue;
    if (bounds.top >= innerHeight) {
      if (preparedAhead.size >= 2) continue;
      preparedAhead.add(node);
    }
    cards.get(node)?.activate();
  }
  if (!ready && !scrolling && !retry) retry = setTimeout(() => { retry = undefined; schedule(); }, 250);
}

function schedule() {
  if (!scheduled) scheduled = requestAnimationFrame(flush);
}


function onScroll() {
  scrolling = true;
  schedule();
}

export function subscribeMobileCard(node: HTMLElement, activate: () => void) {
  if (!observer) {
    scrolling = false;
    ready = false;
    observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const card = cards.get(entry.target as HTMLElement);
        if (card) card.near = entry.isIntersecting;
      }
      schedule();
    }, { rootMargin: "0px 0px 400px 0px", threshold: 0 });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("load", schedule, true);
    document.addEventListener("error", schedule, true);
  }
  cards.set(node, { activate, near: false });
  observer.observe(node);
  return () => {
    cards.delete(node);
    observer?.unobserve(node);
    if (cards.size || preparedAhead.size) return;
    observer?.disconnect();
    observer = undefined;
    preparedAhead.clear();
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("load", schedule, true);
    document.removeEventListener("error", schedule, true);
    cancelAnimationFrame(scheduled);
    scheduled = 0;
    if (retry) clearTimeout(retry);
    retry = undefined;
  };
}