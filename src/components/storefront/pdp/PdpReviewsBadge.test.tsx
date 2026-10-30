import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import PdpReviewsBadge from "./PdpReviewsBadge";
import DeferUntilVisible from "../DeferUntilVisible";

vi.mock("@/hooks/useStoreReviews", () => ({ useStoreReviews: (id?: string) => ({ total: id === "empty" ? 0 : 2, reviews: [] }) }));
afterEach(cleanup);
describe("gallery review intent", () => {
  it("opens on first tap without a mounted section and does not trigger gallery clicks", () => {
    const open = vi.fn(); const galleryClick = vi.fn();
    render(<div onClick={galleryClick}><PdpReviewsBadge storeId="store-a" onOpenReviews={open} /></div>);
    fireEvent.click(screen.getByRole("button", { name: /See all/ }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(galleryClick).not.toHaveBeenCalled();
  });
  it("explicit intent mounts offscreen deferred content", () => {
    const { rerender } = render(<DeferUntilVisible minHeight={54}><span>Review content</span></DeferUntilVisible>);
    expect(screen.queryByText("Review content")).not.toBeInTheDocument();
    rerender(<DeferUntilVisible minHeight={54} forceRender><span>Review content</span></DeferUntilVisible>);
    expect(screen.getByText("Review content")).toBeInTheDocument();
  });
});