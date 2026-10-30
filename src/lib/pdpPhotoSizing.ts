/** Complete-photo aspect ratios: no cropping or minimum-height letterboxing. */
export function photoAspectRatio(width: number, height: number): number | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return width / height;
}

export function activePhotoAspectRatio(
  slides: readonly { kind: "image" | "video" }[],
  index: number,
  ratios: Readonly<Record<number, number>>,
): number | null {
  if (slides[index]?.kind !== "image") return null;
  return ratios[index] ?? ratios[0] ?? 1;
}