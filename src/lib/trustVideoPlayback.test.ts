import { describe, it, expect, vi } from "vitest";
import { activateTrustVideo, toggleTrustPreviewSound, TRUST_REVEAL_MS, TRUST_PREVIEW_DELAY_MS, allowsTrustPreview } from "./trustVideoPlayback";

describe("trust video activation", () => {
  it("unmutes the existing preview on click and mutes it again without replacing it", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const video = document.createElement("video");
    video.muted = true;
    expect(await toggleTrustPreviewSound(video)).toBe(false);
    expect(video.muted).toBe(false);
    expect(video.volume).toBe(1);
    expect(play.mock.instances[0]).toBe(video);
    expect(await toggleTrustPreviewSound(video)).toBe(true);
    expect(video.muted).toBe(true);
    expect(play).toHaveBeenCalledTimes(1);
    play.mockRestore();
  });
  it("keeps the preview muted if the browser rejects audible playback", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("Blocked"));
    const video = document.createElement("video");
    video.muted = true;
    expect(await toggleTrustPreviewSound(video)).toBe(true);
    expect(video.muted).toBe(true);
    play.mockRestore();
  });
  it("requests audible playback inside the click before asynchronous work", () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    const video = activateTrustVideo("https://example.test/trust.mp4");
    expect(play).toHaveBeenCalledTimes(1);
    expect(play.mock.instances[0]).toBe(video);
    expect(video.muted).toBe(false);
    expect(video.volume).toBe(1);
    expect(video.playsInline).toBe(true);
    play.mockRestore();
  });
  it("targets floating preview visibility within the requested 1–2 seconds", () => {
    expect(TRUST_REVEAL_MS).toBe(1500);
  });
  it("waits three seconds after initial loading before preview autoplay", () => {
    expect(TRUST_PREVIEW_DELAY_MS).toBe(3000);
  });
  it("keeps poster previews on data-saving or very slow connections", () => {
    expect(allowsTrustPreview({ saveData: true })).toBe(false);
    expect(allowsTrustPreview({ effectiveType: "2g" })).toBe(false);
    expect(allowsTrustPreview({ effectiveType: "4g" })).toBe(true);
  });
});