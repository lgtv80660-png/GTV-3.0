import type { RefObject } from "react";

export function attachVerticalDrag(ref: RefObject<HTMLDivElement | null>) {
  const element = ref.current;
  if (!element) return;

  let pressed = false;
  let dragged = false;
  let blockNextClick = false;
  let pointerId: number | null = null;

  let startY = 0;
  let startScrollTop = 0;
  let lastY = 0;
  let lastTime = 0;
  let velocity = 0;
  let raf = 0;

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const inertia = () => {
    stop();

    const tick = () => {
      if (Math.abs(velocity) < 0.14) {
        raf = 0;
        return;
      }

      element.scrollTop -= velocity;
      velocity *= 0.92;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
  };

  const down = (event: PointerEvent) => {
    if (!event.isPrimary) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const target = event.target as HTMLElement;
    if (target.closest("input,textarea,select,a")) return;

    stop();

    pressed = true;
    dragged = false;
    blockNextClick = false;
    pointerId = event.pointerId;

    startY = event.clientY;
    startScrollTop = element.scrollTop;
    lastY = event.clientY;
    lastTime = performance.now();
    velocity = 0;

    // IMPORTANT : ne pas capturer le pointeur ici.
    // Un simple clic doit rester entièrement géré par le <button> enfant.
  };

  const move = (event: PointerEvent) => {
    if (!pressed || event.pointerId !== pointerId) return;

    const deltaFromStart = event.clientY - startY;

    // On ne bascule en drag qu'après un vrai déplacement.
    if (!dragged && Math.abs(deltaFromStart) > 6) {
      dragged = true;
      blockNextClick = true;
      element.style.cursor = "grabbing";
      element.style.userSelect = "none";

      // Capture uniquement une fois qu'on sait que c'est un drag.
      try {
        element.setPointerCapture(event.pointerId);
      } catch {}
    }

    if (!dragged) return;

    if (event.cancelable) event.preventDefault();

    element.scrollTop = startScrollTop - deltaFromStart;

    const now = performance.now();
    const delta = event.clientY - lastY;
    const dt = Math.max(8, now - lastTime);
    const instant = (delta / dt) * 16;

    velocity = velocity * 0.58 + instant * 0.42;
    lastY = event.clientY;
    lastTime = now;
  };

  const end = (event?: PointerEvent) => {
    if (!pressed || (event && event.pointerId !== pointerId)) return;

    pressed = false;
    element.style.cursor = "grab";
    element.style.userSelect = "";

    if (dragged && event && pointerId !== null) {
      try {
        if (element.hasPointerCapture(pointerId)) {
          element.releasePointerCapture(pointerId);
        }
      } catch {}
    }

    pointerId = null;

    if (dragged && event?.type !== "pointercancel") inertia();
  };

  const clickCapture = (event: MouseEvent) => {
    // Bloquer uniquement le clic qui suit un vrai drag.
    if (!blockNextClick) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    blockNextClick = false;
    dragged = false;
  };

  const wheel = () => stop();

  const previousCursor = element.style.cursor;
  const previousTouchAction = element.style.touchAction;
  const previousUserSelect = element.style.userSelect;
  element.style.cursor = "grab";
  element.style.touchAction = "pan-x";

  element.addEventListener("pointerdown", down);
  element.addEventListener("pointermove", move, { passive: false });
  window.addEventListener("pointerup", end);
  element.addEventListener("pointercancel", end);
  element.addEventListener("click", clickCapture, true);
  element.addEventListener("wheel", wheel, { passive: true });

  return () => {
    stop();
    if (pointerId !== null && element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    element.style.cursor = previousCursor;
    element.style.touchAction = previousTouchAction;
    element.style.userSelect = previousUserSelect;
    element.removeEventListener("pointerdown", down);
    element.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", end);
    element.removeEventListener("pointercancel", end);
    element.removeEventListener("click", clickCapture, true);
    element.removeEventListener("wheel", wheel);
  };
}
