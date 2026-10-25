/** Public discovery facts only; never changes shopper inventory or pricing. */
export function discoveryAvailability(stock: unknown): "in stock" | "out of stock" | undefined {
  if (stock === null || stock === undefined || stock === "" || typeof stock === "boolean") return undefined;
  const quantity = Number(stock);
  return Number.isFinite(quantity) ? quantity > 0 ? "in stock" : "out of stock" : undefined;
}

export function discoverySalePrice(price: unknown, sale: unknown): number | undefined {
  const regular = Number(price);
  const discounted = Number(sale);
  return Number.isFinite(regular) && Number.isFinite(discounted) && discounted > 0 && discounted < regular ? discounted : undefined;
}

/** Required feed facts must be known; accessibility is checked separately. */
export function hasRequiredFeedFacts(product: { name?: string | null; price: unknown; stock_quantity?: unknown }, images: string[]): boolean {
  return Boolean(product.name?.trim()) && Number.isFinite(Number(product.price)) && Number(product.price) > 0
    && images.some(image => /^https:\/\//i.test(image)) && discoveryAvailability(product.stock_quantity) !== undefined;
}