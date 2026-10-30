import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import CheckoutReviewsTeaser from "./CheckoutReviewsTeaser";

vi.mock("@/hooks/useStoreReviews", () => ({ useStoreReviews: (id?: string) => ({
  reviews: id ? [{ id: id, customer_name: id, media: [], rating: 4 }] : [], average: 4, total: 1, isFetching: false,
}) }));
vi.mock("@/components/storefront/reviews/ReviewCard", () => ({ default: ({ review }: { review: { customer_name: string } }) => <p>{review.customer_name}</p>, ReviewStars: () => null }));
vi.mock("@/components/storefront/reviews/useVisibleBatch", () => ({ useVisibleBatch: () => ({ count: 10, attach: () => {}, done: true }) }));
afterEach(cleanup);
it("consumes retained lazy-mount intent and reopens each store's own reviews", () => {
  const { rerender } = render(<MemoryRouter><CheckoutReviewsTeaser storeId="store-a" openRequest={1} /></MemoryRouter>);
  expect(screen.getByRole("dialog", { name: "Customer reviews" })).toHaveTextContent("store-a");
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  rerender(<MemoryRouter><CheckoutReviewsTeaser storeId="store-a" openRequest={2} /></MemoryRouter>);
  expect(screen.getByRole("dialog")).toHaveTextContent("store-a");
  rerender(<MemoryRouter><CheckoutReviewsTeaser key="store-b" storeId="store-b" openRequest={1} /></MemoryRouter>);
  expect(screen.getByRole("dialog")).toHaveTextContent("store-b");
  expect(screen.getByRole("dialog")).not.toHaveTextContent("store-a");
});