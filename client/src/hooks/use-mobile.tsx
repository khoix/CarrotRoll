import * as React from "react"

const MOBILE_BREAKPOINT = 768

/** Set on first effect run; all callers then see this value for the session (layout choice for pages). */
let lockedIsMobile: boolean | null = null

/**
 * Touch-first device: the primary pointer is a finger and nothing hovers (phones and tablets).
 * Touchscreen laptops don't count (their primary pointer is the trackpad or mouse).
 * Keep in step with the media query in style/mobile.css.
 */
export const TOUCH_FIRST_QUERY = "(pointer: coarse) and (hover: none)"

/**
 * Mobile layout at first load: a narrow viewport (< 768px) or a touch-first device, so tablets
 * get the phone layout (full-screen touch play) even though they are wide. Used for page layout.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (lockedIsMobile !== null) return
    const value = window.innerWidth < MOBILE_BREAKPOINT || !!window.matchMedia?.(TOUCH_FIRST_QUERY).matches
    setIsMobile(value)
    lockedIsMobile = value
  }, [])

  return lockedIsMobile !== null ? lockedIsMobile : !!isMobile
}

const coarseQuery = "(pointer: coarse)"
function subscribeCoarse(cb: () => void) {
  const mq = window.matchMedia?.(coarseQuery)
  mq?.addEventListener?.("change", cb)
  return () => mq?.removeEventListener?.("change", cb)
}
const getCoarse = () => !!window.matchMedia?.(coarseQuery).matches

/**
 * Touch-first device (phone/tablet), live. Use this for input decisions (touch controls,
 * full-viewport play) rather than width: a landscape phone is wider than 768px.
 */
export function useCoarsePointer() {
  return React.useSyncExternalStore(subscribeCoarse, getCoarse, () => false)
}

const portraitQuery = "(orientation: portrait)"
function subscribePortrait(cb: () => void) {
  const mq = window.matchMedia?.(portraitQuery)
  mq?.addEventListener?.("change", cb)
  return () => mq?.removeEventListener?.("change", cb)
}
const getPortrait = () => !!window.matchMedia?.(portraitQuery).matches

/** Viewport is taller than wide, live (follows rotation). */
export function usePortrait() {
  return React.useSyncExternalStore(subscribePortrait, getPortrait, () => true)
}
