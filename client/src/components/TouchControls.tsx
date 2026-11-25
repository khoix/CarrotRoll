import { useRef, useEffect } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

/** Normalized movement: dx/dy in [-1, 1]; (0,0) when released. */
export type TouchMoveHandler = (dx: number, dy: number) => void;

interface TouchControlsProps {
  onKeyPress: (key: string, pressed: boolean) => void;
  /** When provided, touchpad reports 360° analog direction like a mouse (dx, dy normalized). */
  onMove?: TouchMoveHandler;
}

/** Trackpad floating origin: delta (pixels) from touch start. */
const FLOAT_DEAD_ZONE_PX = 1; // Minimal dead zone for immediate response
const FLOAT_SENSITIVITY_PX = 10; // Very small sensitivity - reaches full speed very quickly

/** Compute normalized (dx, dy) from delta in pixels (floating-origin trackpad). */
function getMoveFromDelta(deltaX: number, deltaY: number): { dx: number; dy: number } {
  const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  if (length <= FLOAT_DEAD_ZONE_PX) return { dx: 0, dy: 0 };
  // Linear scaling for immediate, proportional response
  const effectiveLength = length - FLOAT_DEAD_ZONE_PX;
  const scale = Math.min(1, effectiveLength / (FLOAT_SENSITIVITY_PX - FLOAT_DEAD_ZONE_PX));
  const norm = length || 1;
  return {
    dx: (deltaX / norm) * scale,
    dy: (deltaY / norm) * scale,
  };
}

export default function TouchControls({ onKeyPress, onMove }: TouchControlsProps) {
  const isMobile = useIsMobile();
  const touchpadRef = useRef<HTMLDivElement>(null);
  const activeKeysRef = useRef<Set<string>>(new Set());
  const currentDirectionRef = useRef<string | null>(null);
  const floatOriginRef = useRef<{ x: number; y: number } | null>(null);
  const activeTouchIdsRef = useRef<Set<number>>(new Set());

  // Determine which quadrant/direction based on touch position (used only when onMove is not provided).
  const getDirectionFromPosition = (x: number, y: number, width: number, height: number): string | null => {
    const centerX = width / 2;
    const centerY = height / 2;
    const relX = x - centerX;
    const relY = y - centerY;
    const diag1 = relX + relY;
    const diag2 = relX - relY;
    if (relX < 0 && diag1 < 0 && diag2 < 0) return "ArrowUp";
    if (relX > 0 && diag1 > 0 && diag2 > 0) return "ArrowDown";
    if (relY < 0 && diag1 < 0 && diag2 > 0) return "ArrowLeft";
    if (relY > 0 && diag1 > 0 && diag2 < 0) return "ArrowRight";
    if (Math.abs(relX) > Math.abs(relY)) return relX < 0 ? "ArrowUp" : "ArrowDown";
    return relY < 0 ? "ArrowLeft" : "ArrowRight";
  };

  const getPositionFromEvent = (e: React.TouchEvent | React.MouseEvent | React.PointerEvent, rect: DOMRect) => {
    if ("touches" in e && e.touches.length > 0) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    if ("clientX" in e) {
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    return { x: 0, y: 0 };
  };

  const handleTouchStart = (e: React.TouchEvent | React.MouseEvent | React.PointerEvent) => {
    if (!touchpadRef.current) return;
    const rect = touchpadRef.current.getBoundingClientRect();
    
    // Only process touches that are actually on the touchpad element (check coordinates)
    if ("touches" in e && e.touches.length > 0) {
      const touch = e.touches[0];
      const touchX = touch.clientX;
      const touchY = touch.clientY;
      // Check if touch is within touchpad bounds
      if (touchX < rect.left || touchX > rect.right || touchY < rect.top || touchY > rect.bottom) {
        return; // Touch is not on touchpad, ignore it
      }
      // Track this touch ID to prevent interference from other touches
      activeTouchIdsRef.current.add(touch.identifier);
    }
    
    e.preventDefault();
    e.stopPropagation();
    const { x, y } = getPositionFromEvent(e, rect);

    if (onMove) {
      floatOriginRef.current = { x, y };
      onMove(0, 0);
      return;
    }

    const direction = getDirectionFromPosition(y, x, rect.height, rect.width);
    if (direction && !activeKeysRef.current.has(direction)) {
      activeKeysRef.current.add(direction);
      currentDirectionRef.current = direction;
      onKeyPress(direction, true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent | React.MouseEvent | React.PointerEvent) => {
    // Only process touches that are tracked for the touchpad
    if ("touches" in e && e.touches.length > 0) {
      const touch = e.touches[0];
      if (!activeTouchIdsRef.current.has(touch.identifier)) {
        return; // This touch is not for the touchpad, ignore it
      }
    }
    e.preventDefault();
    e.stopPropagation();
    if (!touchpadRef.current) return;
    const rect = touchpadRef.current.getBoundingClientRect();
    const { x, y } = getPositionFromEvent(e, rect);

    if (onMove) {
      const origin = floatOriginRef.current;
      if (origin) {
        const deltaX = x - origin.x;
        const deltaY = y - origin.y;
        const { dx, dy } = getMoveFromDelta(deltaX, deltaY);
        onMove(dx, dy);
      }
      return;
    }

    const newDirection = getDirectionFromPosition(y, x, rect.height, rect.width);
    if (newDirection !== currentDirectionRef.current) {
      if (currentDirectionRef.current) {
        activeKeysRef.current.delete(currentDirectionRef.current);
        onKeyPress(currentDirectionRef.current, false);
      }
      if (newDirection && !activeKeysRef.current.has(newDirection)) {
        activeKeysRef.current.add(newDirection);
        currentDirectionRef.current = newDirection;
        onKeyPress(newDirection, true);
      } else {
        currentDirectionRef.current = null;
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent | React.MouseEvent | React.PointerEvent) => {
    // Only process touches that are tracked for the touchpad
    if ("changedTouches" in e && (e as React.TouchEvent).changedTouches.length > 0) {
      const touchEvent = e as React.TouchEvent;
      const touch = touchEvent.changedTouches[0];
      if (!activeTouchIdsRef.current.has(touch.identifier)) {
        return; // This touch is not for the touchpad, ignore it
      }
      activeTouchIdsRef.current.delete(touch.identifier);
    }
    e.preventDefault();
    e.stopPropagation();

    if (onMove) {
      floatOriginRef.current = null;
      onMove(0, 0);
      return;
    }

    if (currentDirectionRef.current) {
      activeKeysRef.current.delete(currentDirectionRef.current);
      onKeyPress(currentDirectionRef.current, false);
      currentDirectionRef.current = null;
    }
  };

  const handleFireStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to touchpad
    if (!activeKeysRef.current.has("space")) {
      activeKeysRef.current.add("space");
      onKeyPress("space", true);
    }
  };

  const handleFireEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event from bubbling to touchpad
    if (activeKeysRef.current.has("space")) {
      activeKeysRef.current.delete("space");
      onKeyPress("space", false);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      floatOriginRef.current = null;
      onMove?.(0, 0);
      activeKeysRef.current.forEach((key) => {
        onKeyPress(key, false);
      });
      activeKeysRef.current.clear();
      activeTouchIdsRef.current.clear();
      currentDirectionRef.current = null;
    };
  }, [onKeyPress, onMove]);

  const fireButtonProps = {
    onTouchStart: handleFireStart,
    onTouchEnd: handleFireEnd,
    onMouseDown: handleFireStart,
    onMouseUp: handleFireEnd,
    onMouseLeave: handleFireEnd,
    "aria-label": "Fire" as const,
  };

  return (
    <div className="touch-controls-inner flex flex-col items-center gap-4 py-4 px-4 bg-white/95 rounded-2xl border-4 border-gray-900 shadow-lg mt-2">
      {isMobile ? (
        /* Mobile: touchpad with fire buttons left and right, same height as touchpad, no text */
        <div className="touch-controls-row flex flex-row items-stretch gap-2 w-full justify-center">
          <button
            {...fireButtonProps}
            type="button"
            className="fire-btn-mobile w-14 shrink-0 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 border-2 border-red-700 shadow-md touch-manipulation select-none"
          />
          <div
            ref={touchpadRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onPointerDown={handleTouchStart}
            onPointerMove={handleTouchMove}
            onPointerUp={handleTouchEnd}
            onPointerCancel={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseMove={handleTouchMove}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            className="relative w-64 h-64 bg-gray-100 rounded-xl border-2 border-gray-300 touch-manipulation select-none cursor-pointer touchpad-surface shrink-0"
            style={{ touchAction: 'none' }}
            aria-label="Directional touchpad"
          >
            <div className="absolute top-4 left-1/2 -translate-x-1/2 triangle-up" />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 triangle-down" />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 triangle-left" />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 triangle-right" />
          </div>
          <button
            {...fireButtonProps}
            type="button"
            className="fire-btn-mobile w-14 shrink-0 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 border-2 border-red-700 shadow-md touch-manipulation select-none"
          />
        </div>
      ) : (
        <>
          <div
            ref={touchpadRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onPointerDown={handleTouchStart}
            onPointerMove={handleTouchMove}
            onPointerUp={handleTouchEnd}
            onPointerCancel={handleTouchEnd}
            onMouseDown={handleTouchStart}
            onMouseMove={handleTouchMove}
            onMouseUp={handleTouchEnd}
            onMouseLeave={handleTouchEnd}
            className="relative w-64 h-64 bg-gray-100 rounded-xl border-2 border-gray-300 touch-manipulation select-none cursor-pointer touchpad-surface"
            style={{ touchAction: 'none' }}
            aria-label="Directional touchpad"
          >
            <div className="absolute top-4 left-1/2 -translate-x-1/2 triangle-up" />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 triangle-down" />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 triangle-left" />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 triangle-right" />
          </div>
          <button
            onTouchStart={handleFireStart}
            onTouchEnd={handleFireEnd}
            onMouseDown={handleFireStart}
            onMouseUp={handleFireEnd}
            onMouseLeave={handleFireEnd}
            className="w-full h-16 bg-red-500 hover:bg-red-600 active:bg-red-700 border-4 border-red-700 rounded-xl flex items-center justify-center text-white font-display text-xl touch-manipulation select-none shadow-md"
            aria-label="Fire"
          >
            FIRE
          </button>
        </>
      )}
    </div>
  );
}
