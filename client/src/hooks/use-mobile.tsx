import * as React from "react"

const MOBILE_BREAKPOINT = 768

/** Set on first effect run; all callers then see this value for the session (layout choice for pages). */
let lockedIsMobile: boolean | null = null

/** Narrow viewport (< 768px) at first load. Used for page layout choices. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    if (lockedIsMobile !== null) return
    const value = window.innerWidth < MOBILE_BREAKPOINT
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
