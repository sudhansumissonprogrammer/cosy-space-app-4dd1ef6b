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
export const TRUST_PREVIEW_DELAY_MS = 3000;

export function allowsTrustPreview(connection?: { saveData?: boolean; effectiveType?: string }): boolean {
  return !connection?.saveData && !["slow-2g", "2g"].includes(connection?.effectiveType || "");
}