# Re-evaluation: Optimize Ending Sequence for Mobile

**Plan:** `optimize_ending_sequence_for_mobile_b8406c13.plan.md`  
**Code context:** `Level20EndingOverlay.tsx`, `mobile.css`, `use-mobile.tsx` (as of current codebase)

---

## Summary

The plan is **still accurate and fully applicable**. The component has no mobile-specific logic yet; glitch counts, slideshow, scroll/ghost animation, and audio timing match the plan’s description. Below are concrete references and implementation notes so the plan can be executed against the current code.

---

## 1. Mobile detection

- **Plan:** Add `useIsMobile` from `@/hooks/use-mobile` in `Level20EndingOverlay.tsx`.
- **Current code:** `Level20EndingOverlay` does not import or use `useIsMobile`. The hook exists at `client/src/hooks/use-mobile.tsx`, returns `boolean` (breakpoint `< 768px`), and is used in `Home.tsx`, `Play.tsx`, `GameCanvas.tsx`, `TouchControls.tsx`, `HighScoreList.tsx`.
- **Action:** Import `useIsMobile` and call it in `Level20EndingOverlay`; use the result for all conditional mobile optimizations below.

---

## 2. Glitch phase optimization

- **Plan:** Reduce strip count 8→4, patches 8→4, artifacts 6→3, slices 5→2 on mobile; optionally reduce RGB/noise intensity.
- **Current code:**
  - **Strips:** `CAPTURE_STRIP_COUNT = 8` (line 6). Used in `useGlitchRandom` (lines 41, 65–66) and in JSX `[...Array(CAPTURE_STRIP_COUNT)]` (line 531).
  - **Patches:** Hardcoded `[...Array(8)]` in `useGlitchRandom` (line 70) and in JSX (line 573).
  - **Artifacts:** Hardcoded `[...Array(6)]` in hook (line 79) and JSX (line 654).
  - **Slices:** Hardcoded `[...Array(5)]` in hook (line 59) and JSX (line 637).
- **Implementation notes:**
  - `useGlitchRandom(active)` has no mobile parameter. Either:
    - Add a second parameter `useGlitchRandom(active, isMobile)` and use mobile constants when building `r.strip`, `r.patch`, `r.artifact`, `r.slice`; or
    - Keep a single `r` shape and derive counts from constants keyed by `isMobile` so the hook still returns arrays of the right length.
  - In the component, replace hardcoded `8`/`5`/`6` with variables (e.g. `patchCount`, `sliceCount`, `artifactCount`) and use `CAPTURE_STRIP_COUNT` vs a `CAPTURE_STRIP_COUNT_MOBILE` (or equivalent) for strips. Use the same counts when mapping in JSX (lines 531, 573, 637, 654).
  - RGB/noise: intensity is driven by `k = glitchIntensityFactor(elapsed)` and multipliers (e.g. `80`, `60` for rgbX/rgbY). On mobile, you can scale these down (e.g. 0.6×) or cap max offset values.

---

## 3. Progressive image preloading

- **Plan:** `useImagePreloader` to preload first 3–4 images on mount, next batch during scroll (~20–30s), rest during endgame; use `new Image()` and cache; integrate with slideshow so images are ready before use.
- **Current code:** No preloading. Slideshow images are assigned in `setLayer()` (line 232): `imgEl.src = slides.current[slideIdx].url`. Timeline comes from `buildSlideshowTimeline()` (18 slides, URLs from `ENDGAME_IMAGES_BASE`). The two `<img>` elements (lines 809–818, 825–835) have no `loading` attribute.
- **Action:** Add `useImagePreloader(slides, phase, scrollElapsedMs)` (or equivalent) that preloads in batches by phase/elapsed time. In `setLayer`, you can keep assigning `imgEl.src`; preloading will warm the cache so those assignments don’t cause visible delay. Optionally set `loading="eager"` for the first few slides and `loading="lazy"` for later ones if you still use explicit `<img>` srcs for later slides.

---

## 4. Scroll animation (ghost layer) for mobile

- **Plan:** Simplify ghost layer: fewer keyframe steps, reduce or remove skew, simplify scale; consider simpler 3D or 2D on very low-end.
- **Current code:** Scroll phase (lines 686–784). Ghost layer is a `motion.div` (lines 731–770) with:
  - `animate`: `x: 5`, `y: 5`, `opacity: [0.55, 0.8, …]`, `filter: [blur(4px), …]`, `scaleX`/`scaleY` arrays, `rotate`, `skewX`, `skewY` arrays.
  - `transition`: duration 12s, repeat Infinity, easeInOut.
- **Action:** When `isMobile`, use a simplified `animate` object: fewer opacity/filter keyframes (e.g. 3 steps instead of 6–7), smaller or zero `skewX`/`skewY`, and optionally simpler blur steps. Keep the same wrapper and crisp layer; only the ghost’s `animate` and possibly `transition.duration` need to change.

---

## 5. Mobile CSS optimizations

- **Plan:** In `mobile.css`, add rules for ending overlay: `will-change`, `transform: translateZ(0)`, `backface-visibility: hidden`; optimize `imageRendering: pixelated` if needed.
- **Current code:** `mobile.css` has no rules for `.glitch-container` or other ending-overlay elements. The overlay uses class `glitch-container` (line 510) and inline `imageRendering: "pixelated"` in several places.
- **Action:** Inside the existing `@media (max-width: 767px)` block, add selectors for `.glitch-container` and its animated children (e.g. strips, patches, slices, artifacts). Add `will-change: transform, opacity` and `transform: translateZ(0)` (and optionally `backface-visibility: hidden`) where it helps compositing. Avoid broad `will-change` on too many elements at once.

---

## 6. Slideshow performance

- **Plan:** Shorter crossfade on mobile (1000→800ms); simplify zoom; consider disabling zoom on some slides; `loading="eager"` for first images, error handling.
- **Current code:** `SLIDESHOW_FADE_MS = 1000` (line 111); zoom is applied in `applyZoom` (lines 213–226); `SLIDESHOW_NO_ZOOM_SLIDES = new Set([4, 16])` (line 115). No `loading` on the slideshow `<img>` tags.
- **Action:** Use a mobile-only fade constant (e.g. 800) when `isMobile` in the slideshow (where `SLIDESHOW_FADE_MS` is used: `updateCrossfadeState` and `updateLayers`). Optionally add more indices to a mobile-only no-zoom set. Add `loading="eager"` to the first slide’s img when it’s the primary visible one; keep or add error handling for failed image loads.

---

## 7. Audio preloading and timing

- **Plan:** Preload `static_endgame.wav` when the ending is triggered; preload `music_endgame01.wav` during scroll (e.g. around 20s) instead of only at 35s.
- **Current code:**
  - Static: created/played when `phase === "glitch"` (lines 377–410); no preload before that.
  - Music: `new Audio(ENDGAME_MUSIC_SRC)` and `play()` when `(phase === "scroll" && scrollElapsedMs >= ENDGAME_REVEAL_START_MS) || phase === "endgame"` (lines 454–472). `ENDGAME_REVEAL_START_MS = 35000`.
- **Action:** When the overlay mounts (or when ending is triggered), create `new Audio(STATIC_ENDGAME_SRC)` and set `audio.preload = "auto"` (or assign `src` so it loads). For music, create the `Audio` instance earlier (e.g. when `phase === "scroll"` and `scrollElapsedMs >= 20000`) and call `play()` only when `scrollElapsedMs >= ENDGAME_REVEAL_START_MS` (35s), so the file is already loading by 20s.

---

## 8. Optional: performance monitoring

- **Plan:** Use `navigator.hardwareConcurrency`, `deviceMemory`, or frame-rate checks to apply extra reductions on low-end devices.
- **Current code:** No such checks in the overlay.
- **Action:** Optional. Can add a small helper that sets a “low performance” flag and use it to further reduce glitch counts or ghost complexity beyond the default mobile path.

---

## File and todo checklist

| Todo | File(s) | Status in code |
|------|---------|----------------|
| Add useIsMobile | `Level20EndingOverlay.tsx` | Not present |
| Reduce glitch counts on mobile | `Level20EndingOverlay.tsx` (hook + JSX) | All counts fixed (8, 8, 6, 5) |
| useImagePreloader | `Level20EndingOverlay.tsx` (new hook + use in slideshow) | No preloader |
| Simplify scroll/ghost on mobile | `Level20EndingOverlay.tsx` (ghost motion.div) | Single complex animate |
| Mobile CSS (will-change, GPU) | `mobile.css` | No ending-overlay rules |
| Slideshow (fade, zoom, loading) | `Level20EndingOverlay.tsx` | Fixed 1000ms fade; no loading attr |
| Audio preload / earlier music load | `Level20EndingOverlay.tsx` | Static at glitch start; music at 35s only |

---

## Conclusion

No re-scoping or invalidation of the plan is needed. Implementing the seven main todos in `Level20EndingOverlay.tsx` and `mobile.css` as above will align the code with the plan. The only design choice is how to pass “mobile” into `useGlitchRandom` (second argument vs. shared constants); the rest is straightforward conditional logic and new hooks/effects.
