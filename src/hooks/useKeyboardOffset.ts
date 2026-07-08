/**
 * useKeyboardOffset — tracks the on-screen keyboard height in px.
 *
 * On mobile browsers, when the software keyboard opens, `position: fixed;
 * bottom: 0` elements stay glued to the *layout* viewport bottom — which the
 * keyboard now covers. `window.visualViewport` exposes the visible area, so
 * we can compute the delta and pass it as paddingBottom (or subtract it from
 * max-height) to lift bottom sheets and inputs above the keyboard.
 *
 * Returns 0 on desktop / browsers without visualViewport support.
 */
import { useEffect, useState } from "react";

export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = (typeof window !== "undefined" ? (window as any).visualViewport : undefined) as
      | VisualViewport
      | undefined;
    if (!vv) return;
    const update = () => {
      const bottomInset = window.innerHeight - vv.height - vv.offsetTop;
      setOffset(Math.max(0, bottomInset));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return offset;
}
