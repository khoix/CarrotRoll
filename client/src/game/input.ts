/**
 * Drag-anywhere touch controls.
 *
 * Put a finger anywhere on the play area and the bunny follows it 1:1 (relative drag, like a
 * classic shmup), so it never jumps to the finger. If you grab right on top of the bunny, it is
 * kept a thumb's height above the finger so your thumb doesn't hide it. The engine caps the chase
 * speed, so a fast swipe can't teleport the bunny through hazards. Mouse input is ignored (desktop
 * uses the keyboard); a second finger is ignored too.
 */
import type { GameEngine } from "./engine";

/** Keep at least this much (CSS px) between the finger and the bunny's centre when grabbing it directly. */
const THUMB_CLEARANCE_CSS = 64;

interface DragOptions {
  engine: () => GameEngine;
  /** Client (CSS px) → world coordinates, plus world units per CSS px. */
  toWorld: (clientX: number, clientY: number) => { x: number; y: number; unitsPerCss: number } | null;
  enabled: () => boolean;
  onStart?: () => void;
}

export function attachDragControls(el: HTMLElement, opts: DragOptions): () => void {
  let activeId: number | null = null;
  let offset = { x: 0, y: 0 };

  const isInteractive = (target: EventTarget | null) =>
    target instanceof Element && !!target.closest("button, a, input, [role='menu'], [data-no-drag]");

  const onDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse" || activeId !== null || !opts.enabled() || isInteractive(e.target)) return;
    const w = opts.toWorld(e.clientX, e.clientY);
    if (!w) return;
    const engine = opts.engine();
    const p = engine.player;
    const pcx = p.x + p.width / 2;
    const pcy = p.y + p.height / 2;
    offset = { x: pcx - w.x, y: pcy - w.y };
    const clearance = THUMB_CLEARANCE_CSS * w.unitsPerCss;
    if (Math.hypot(offset.x, offset.y) < clearance) offset = { x: offset.x, y: -clearance };
    activeId = e.pointerId;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    engine.autoFire = true;
    engine.touchMove = null;
    engine.dragTarget = { x: w.x + offset.x, y: w.y + offset.y };
    opts.onStart?.();
    e.preventDefault();
  };

  const onMove = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    const engine = opts.engine();
    if (!opts.enabled()) {
      engine.dragTarget = null;
      return;
    }
    const w = opts.toWorld(e.clientX, e.clientY);
    if (!w) return;
    engine.dragTarget = { x: w.x + offset.x, y: w.y + offset.y };
    e.preventDefault();
  };

  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== activeId) return;
    activeId = null;
    opts.engine().dragTarget = null;
  };

  el.addEventListener("pointerdown", onDown, { passive: false });
  el.addEventListener("pointermove", onMove, { passive: false });
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("lostpointercapture", onUp);
  return () => {
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onUp);
    el.removeEventListener("lostpointercapture", onUp);
  };
}
