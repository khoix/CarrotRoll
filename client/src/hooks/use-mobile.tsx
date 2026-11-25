import * as React from "react"

const MOBILE_BREAKPOINT = 768

/** Set on first effect run; all callers then see this value for the session. */
let lockedIsMobile: boolean | null = null

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
