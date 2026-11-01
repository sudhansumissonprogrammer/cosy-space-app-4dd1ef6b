/** Run inside the shopper's click, before any asynchronous fetch/import. */
export function activateTrustVideo(source: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.playsInline = true;
  video.muted = false;
  video.volume = 1;
  video.loop = true;
  video.preload = "auto";
  video.src = source;
  // Keep this exact element for the opened reel; replacing it loses activation.
  void video.play().catch(() => {});
  return video;
}

export const TRUST_REVEAL_MS = 1500;
export const TRUST_PROBE_MS = 250;