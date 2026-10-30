import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import UtkalCommunityBanner from "./UtkalCommunityBanner";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function viewport(mobile: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: mobile, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
}
it("limits the exact community destination to Utkal mobile visible actions", () => {
  viewport(true);
  const { rerender } = render(<UtkalCommunityBanner store={{ slug: "utkalwatches" }} visible />);
  expect(screen.getByRole("link")).toHaveAttribute("href", "https://chat.whatsapp.com/CRZQkGo6jxK3LbmZB4xUua");
  rerender(<UtkalCommunityBanner store={{ slug: "other-store" }} visible />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
  rerender(<UtkalCommunityBanner store={{ slug: "utkalwatches" }} visible={false} />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
it("does not mount or download the banner on desktop", () => {
  viewport(false);
  render(<UtkalCommunityBanner store={{ slug: "utkalwatches" }} visible />);
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});