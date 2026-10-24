export { discoveryPage, discoveryUrl } from "../../supabase/functions/_shared/seoDiscovery";

export function bestSellersShowsAll(theme: string) {
  return ["theme-10", "theme-12"].includes(theme);
}