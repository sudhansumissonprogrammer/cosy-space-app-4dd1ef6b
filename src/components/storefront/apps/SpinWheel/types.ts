export type SegmentType = "coupon" | "lose";
export type WheelStyle = "classic" | "neon" | "gold" | "candy";

export interface WheelSegment {
  label: string;
  type: SegmentType;
  code?: string;
  discount_type?: "percentage" | "flat";
  discount_value?: number;
  min_order?: number;
  weight: number;
  color?: string;
}

export interface SpinWheelConfig {
  trigger_delay_ms: number;
  show_on_mobile: boolean;
  show_on_desktop: boolean;
  require_otp: boolean;
  wheel_style: WheelStyle;
  sound_enabled: boolean;
  time_trigger_enabled?: boolean;
  exit_intent_enabled?: boolean;
  exit_intent_scope?: "all" | "product";
  /**
   * "random" = weighted draw using each slice's weight (default).
   * "fixed"  = every shopper always lands on `fixed_segment_index`.
   */
  outcome_mode?: "random" | "fixed";
  fixed_segment_index?: number;
  /**
   * Stable identity of the pinned slice. The index alone breaks the moment a
   * merchant reorders/deletes slices, so we also store the code + label and
   * resolve by those first at spin time.
   */
  fixed_segment_code?: string;
  fixed_segment_label?: string;

  heading: string;
  subheading: string;
  button_label: string;
  lead_heading: string;
  lead_subheading: string;
  marketing_consent_label: string;
  segments: WheelSegment[];
}

/**
 * Resolves which slice the shopper must land on.
 * Fixed mode wins by identity (code, then label) and falls back to the stored
 * index, so reordering or renaming slices can never silently hand out the
 * wrong prize. Anything unresolvable degrades to the weighted draw.
 */
export function resolveWinningIndex(
  cfg: Pick<SpinWheelConfig, "outcome_mode" | "fixed_segment_index" | "fixed_segment_code" | "fixed_segment_label">,
  segments: WheelSegment[],
): number {
  if (!segments.length) return 0;
  if (cfg.outcome_mode !== "fixed") return pickWeightedIndex(segments);

  const code = (cfg.fixed_segment_code || "").trim().toUpperCase();
  if (code) {
    const byCode = segments.findIndex((s) => (s.code || "").trim().toUpperCase() === code);
    if (byCode >= 0) return byCode;
  }
  const label = (cfg.fixed_segment_label || "").trim().toLowerCase();
  if (label) {
    const byLabel = segments.findIndex((s) => (s.label || "").trim().toLowerCase() === label);
    if (byLabel >= 0) return byLabel;
  }
  const pinned = Number(cfg.fixed_segment_index);
  if (Number.isFinite(pinned) && pinned >= 0 && pinned < segments.length) return Math.floor(pinned);
  return pickWeightedIndex(segments);
}


export function pickWeightedIndex(segments: WheelSegment[]): number {
  const total = segments.reduce((s, x) => s + Math.max(0, x.weight || 0), 0);
  if (total <= 0) return Math.floor(Math.random() * segments.length);
  let r = Math.random() * total;
  for (let i = 0; i < segments.length; i++) {
    r -= Math.max(0, segments[i].weight || 0);
    if (r <= 0) return i;
  }
  return segments.length - 1;
}
