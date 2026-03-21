/**
 * Publish-time validation for storefront pages.
 * Checks DOM health, page weight, and image compliance before allowing publish.
 */

export interface ValidationResult {
  pass: boolean;
  warnings: string[];
  errors: string[];
  metrics: {
    domNodes: number;
    maxDepth: number;
    pageSize: number;
    imagesWithoutDimensions: string[];
    imagesWithoutLazy: string[];
  };
}

const MAX_DOM_NODES = 1500;
const MAX_PAGE_SIZE_KB = 1024; // 1MB
const MAX_NESTING_DEPTH = 15;

/** Recursively find the deepest nesting level in a subtree */
function getMaxDepth(el: Element, depth = 0): number {
  let max = depth;
  for (let i = 0; i < el.children.length; i++) {
    max = Math.max(max, getMaxDepth(el.children[i], depth + 1));
  }
  return max;
}

/**
 * Run a full validation pass on the current page.
 * Call from the admin dashboard before publishing a store.
 */
export function validateStorefront(): ValidationResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  // DOM node count
  const domNodes = document.querySelectorAll("*").length;
  if (domNodes > MAX_DOM_NODES) {
    errors.push(`DOM has ${domNodes} nodes (limit: ${MAX_DOM_NODES}). Reduce nesting or section count.`);
  }

  // Nesting depth
  const maxDepth = getMaxDepth(document.body);
  if (maxDepth > MAX_NESTING_DEPTH) {
    warnings.push(`Max DOM nesting depth is ${maxDepth} (recommended: ≤${MAX_NESTING_DEPTH}).`);
  }

  // Page size estimate (serialized HTML)
  const pageSize = new Blob([document.documentElement.outerHTML]).size;
  const pageSizeKB = Math.round(pageSize / 1024);
  if (pageSizeKB > MAX_PAGE_SIZE_KB) {
    errors.push(`Page HTML is ${pageSizeKB}KB (limit: ${MAX_PAGE_SIZE_KB}KB).`);
  }

  // Image audit
  const images = document.querySelectorAll("img");
  const imagesWithoutDimensions: string[] = [];
  const imagesWithoutLazy: string[] = [];

  images.forEach((img) => {
    const src = img.src || img.getAttribute("data-src") || "(unknown)";
    const shortSrc = src.length > 60 ? `…${src.slice(-50)}` : src;

    // Check width/height attributes (not CSS)
    if (!img.hasAttribute("width") || !img.hasAttribute("height")) {
      imagesWithoutDimensions.push(shortSrc);
    }

    // Below-fold images must use lazy loading
    const isHero =
      img.fetchPriority === "high" ||
      img.loading === "eager";
    if (!isHero && img.loading !== "lazy") {
      imagesWithoutLazy.push(shortSrc);
    }
  });

  if (imagesWithoutDimensions.length > 0) {
    warnings.push(
      `${imagesWithoutDimensions.length} image(s) missing width/height attributes (causes CLS).`
    );
  }

  if (imagesWithoutLazy.length > 0) {
    warnings.push(
      `${imagesWithoutLazy.length} non-hero image(s) missing loading="lazy".`
    );
  }

  const pass = errors.length === 0;

  return {
    pass,
    warnings,
    errors,
    metrics: {
      domNodes,
      maxDepth,
      pageSize: pageSizeKB,
      imagesWithoutDimensions,
      imagesWithoutLazy,
    },
  };
}
