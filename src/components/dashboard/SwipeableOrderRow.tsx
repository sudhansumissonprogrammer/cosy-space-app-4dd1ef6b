import { useRef, useState, ReactNode } from "react";
import { Truck, MessageCircle, Phone } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Called when user swipes right far enough → mark shipped */
  onSwipeRight?: () => void;
  /** Called when user swipes left far enough → primary contact (WhatsApp) */
  onSwipeLeft?: () => void;
  /** Called on long-press (~500ms) → enter bulk select / select item */
  onLongPress?: () => void;
  /** Disable swipe (e.g. when bulk-select mode is active so checkbox works) */
  disabled?: boolean;
  /** Label shown on the right reveal (default "Ship") */
  rightLabel?: string;
  /** Label shown on the left reveal (default "WhatsApp") */
  leftLabel?: string;
}

const ACTION_THRESHOLD = 80; // px to commit action
const REVEAL_LIMIT = 110;    // max drag distance shown

/**
 * Mobile-friendly row wrapper that supports horizontal swipes:
 *   ► Swipe right (drag right) reveals SHIP action (green) — releases onSwipeRight
 *   ◄ Swipe left  (drag left)  reveals CALL/WHATSAPP action (emerald) — onSwipeLeft
 *   ☰ Long-press triggers onLongPress (used to enter bulk-select mode)
 *
 * Only horizontal moves > 8px engage swipe; otherwise touches behave normally
 * so children remain tappable.
 */
export default function SwipeableOrderRow({
  children,
  onSwipeRight,
  onSwipeLeft,
  onLongPress,
  disabled = false,
  rightLabel = "Ship",
  leftLabel = "WhatsApp",
}: Props) {
  const [dx, setDx] = useState(0);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const engaged = useRef<boolean>(false);
  const longPressTimer = useRef<number | null>(null);
  const longPressFired = useRef<boolean>(false);

  const reset = () => {
    setDx(0);
    startX.current = null;
    startY.current = null;
    engaged.current = false;
  };

  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    engaged.current = false;
    longPressFired.current = false;
    if (onLongPress) {
      longPressTimer.current = window.setTimeout(() => {
        longPressFired.current = true;
        // Light haptic if available
        if (navigator.vibrate) navigator.vibrate(20);
        onLongPress();
      }, 500);
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (disabled || startX.current === null || startY.current === null) return;
    const t = e.touches[0];
    const deltaX = t.clientX - startX.current;
    const deltaY = t.clientY - startY.current;

    // Decide direction once the user has moved > 8px
    if (!engaged.current) {
      if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
      // If vertical scroll is dominant, do not engage swipe — let scroll happen
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        startX.current = null;
        startY.current = null;
        clearLongPress();
        return;
      }
      engaged.current = true;
      clearLongPress();
    }

    // Limit reveal so the row never disappears entirely
    const clamped = Math.max(-REVEAL_LIMIT, Math.min(REVEAL_LIMIT, deltaX));
    setDx(clamped);
  };

  const onTouchEnd = () => {
    if (disabled) return;
    clearLongPress();
    if (engaged.current) {
      if (dx >= ACTION_THRESHOLD && onSwipeRight) {
        if (navigator.vibrate) navigator.vibrate(15);
        onSwipeRight();
      } else if (dx <= -ACTION_THRESHOLD && onSwipeLeft) {
        if (navigator.vibrate) navigator.vibrate(15);
        onSwipeLeft();
      }
    }
    reset();
  };

  const showRight = dx > 0; // user dragged right → reveal ship action on the LEFT side
  const showLeft = dx < 0;  // user dragged left  → reveal contact action on the RIGHT side
  const committed = Math.abs(dx) >= ACTION_THRESHOLD;

  return (
    <div className="relative overflow-hidden touch-pan-y">
      {/* Background reveals */}
      {showRight && (
        <div
          className={`absolute inset-y-0 left-0 flex items-center pl-4 transition-colors ${
            committed ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-700"
          }`}
          style={{ width: Math.abs(dx) }}
        >
          <div className="flex items-center gap-1.5 text-xs font-bold">
            <Truck className="h-4 w-4" />
            {committed ? `Mark ${rightLabel}` : rightLabel}
          </div>
        </div>
      )}
      {showLeft && (
        <div
          className={`absolute inset-y-0 right-0 flex items-center justify-end pr-4 transition-colors ${
            committed ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"
          }`}
          style={{ width: Math.abs(dx) }}
        >
          <div className="flex items-center gap-1.5 text-xs font-bold">
            {leftLabel === "Call" ? <Phone className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
            {committed ? `Open ${leftLabel}` : leftLabel}
          </div>
        </div>
      )}

      {/* Swipeable foreground */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
        style={{
          transform: `translateX(${dx}px)`,
          transition: dx === 0 ? "transform 180ms ease-out" : "none",
        }}
        className="relative bg-card"
      >
        {children}
      </div>

      {/* Tutorial hint — only shown when row is at rest (no JS, pure visual) */}
    </div>
  );
}
