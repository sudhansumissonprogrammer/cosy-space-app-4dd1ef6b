import { describe, it, expect, vi } from "vitest";
import { activateTrustVideo, TRUST_REVEAL_MS } from "./trustVideoPlayback";

describe("trust video activation", () => {
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
});