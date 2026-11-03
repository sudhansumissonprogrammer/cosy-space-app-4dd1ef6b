import { act, fireEvent, render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { VideoSlide } from "./VideoSlide";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("product video sound", () => {
  it("keeps autoplay muted but allows audible playback on shopper play", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const screen = render(<VideoSlide url="https://example.test/watch.mp4" isActive videoPlaying={false} setVideoPlaying={() => {}} />);
    const video = screen.container.querySelector("video");
    expect(video).not.toBeNull();
    expect(video?.muted).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Play video", exact: true }));
    });
    expect(video?.muted).toBe(false);
  });
});