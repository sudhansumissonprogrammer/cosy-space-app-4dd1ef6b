import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, it } from "vitest";
import LanguageStrip from "@/components/storefront/LanguageStrip";

afterEach(() => { cleanup(); localStorage.clear(); });
beforeEach(() => { localStorage.clear(); });

it("closes to a small restore button and reopens the selector", () => {
  render(<LanguageStrip />);
  expect(screen.getByRole("button", { name: "Close language selector" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Change language" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Close language selector" }));
  expect(screen.queryByRole("button", { name: "Close language selector" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Choose language" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Change language" }));
  expect(screen.getByRole("button", { name: "Close language selector" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Choose language" })).toBeInTheDocument();
});

it("keeps the chosen language when the selector is closed", () => {
  localStorage.setItem("sf_lang", "hinglish");
  render(<LanguageStrip />);
  fireEvent.click(screen.getByRole("button", { name: "Close language selector" }));
  fireEvent.click(screen.getByRole("button", { name: "Change language" }));
  expect(localStorage.getItem("sf_lang")).toBe("hinglish");
  expect(screen.getByRole("button", { name: "Choose language" })).toHaveTextContent("HIN");
});
