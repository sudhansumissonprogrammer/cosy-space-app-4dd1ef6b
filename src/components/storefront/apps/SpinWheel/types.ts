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
  heading: string;
  subheading: string;
  button_label: string;
  lead_heading: string;
  lead_subheading: string;
  marketing_consent_label: string;
  segments: WheelSegment[];
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
