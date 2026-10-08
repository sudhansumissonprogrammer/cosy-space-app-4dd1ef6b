import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GalleryImage from "./GalleryImage";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("gallery photo readiness", () => {
  it("checks a cached photo once without repeating updates on parent renders", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(1200);
    const ready = vi.fn();
    function Gallery({ src }: { src: string }) {
      const [loaded, setLoaded] = useState(false);
      return <GalleryImage src={src} alt={loaded ? "Loaded photo" : "Loading photo"} onReady={() => {
        ready();
        setLoaded(true);
      }} />;
    }
    const { rerender } = render(<Gallery src="first.webp" />);
    expect(screen.getByAltText("Loaded photo")).toBeTruthy();
    rerender(<Gallery src="first.webp" />);
    expect(ready).toHaveBeenCalledTimes(1);
    rerender(<Gallery src="second.webp" />);
    expect(ready).toHaveBeenCalledTimes(2);
  });

  it("waits for uncached photos and calls the latest handler on load", () => {
    const first = vi.fn();
    const latest = vi.fn();
    const { rerender } = render(<GalleryImage alt="Product" src="photo.webp" onReady={first} />);
    expect(first).not.toHaveBeenCalled();
    rerender(<GalleryImage alt="Product" src="photo.webp" onReady={latest} />);
    fireEvent.load(screen.getByAltText("Product"));
    expect(latest).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });

  it("does not treat an inactive slide as a cached ready photo", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(1200);
    const ready = vi.fn();
    render(<GalleryImage alt="Inactive" onReady={ready} />);
    expect(ready).not.toHaveBeenCalled();
  });

  it("retries a failed photo once, then offers bounded manual recovery", () => {
    const ready = vi.fn();
    const error = vi.fn();
    render(<GalleryImage alt="Product" src="photo.webp" onReady={ready} onError={error} />);
    const first = screen.getByAltText("Product");
    fireEvent.error(first);
    expect(screen.getByAltText("Product")).not.toBe(first);
    expect(screen.getByAltText("Product").getAttribute("src")).toBe("photo.webp");
    expect(error).not.toHaveBeenCalled();
    fireEvent.error(screen.getByAltText("Product"));
    expect(error).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Retry photo" }));
    expect(screen.queryByRole("button", { name: "Retry photo" })).toBeNull();
    fireEvent.load(screen.getByAltText("Product"));
    expect(ready).toHaveBeenCalledTimes(1);
  });

  it("does not carry a failed source into the next product photo", () => {
    const ready = vi.fn();
    const { rerender } = render(<GalleryImage alt="Product" src="bad.webp" onReady={ready} />);
    fireEvent.error(screen.getByAltText("Product"));
    fireEvent.error(screen.getByAltText("Product"));
    rerender(<GalleryImage alt="Product" src="good.webp" onReady={ready} />);
    expect(screen.queryByText("Photo couldn’t load")).toBeNull();
    fireEvent.load(screen.getByAltText("Product"));
    expect(ready).toHaveBeenCalledTimes(1);
  });
});