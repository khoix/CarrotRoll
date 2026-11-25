import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "@/hooks/use-mobile";

type Phase = "glitch" | "black" | "scroll" | "endgame" | "fadeout";

const CAPTURE_STRIP_COUNT = 8;
const CAPTURE_STRIP_COUNT_MOBILE = 4;
const PATCH_COUNT = 8;
const PATCH_COUNT_MOBILE = 4;
const ARTIFACT_COUNT = 6;
const ARTIFACT_COUNT_MOBILE = 3;
const SLICE_COUNT = 5;
const SLICE_COUNT_MOBILE = 2;

interface Level20EndingOverlayProps {
  captureDataUrl?: string | null;
  /** When provided (e.g. from Level20Demo), use this audio for glitch static instead of creating one; avoids autoplay block after async capture. */
  preexistingStaticAudioRef?: React.RefObject<HTMLAudioElement | null>;
  /** When true, use mobile optimizations (e.g. for admin mobile preview). */
  forceMobile?: boolean;
  onComplete: () => void;
}

const GLITCH_DURATION_MS = 3500;

const POEM_LINES = [
  "Come away, O human child!",
  "To the waters and the wild",
  "With a faery, hand in hand,",
  "For the world's more full of weeping",
  "than you can understand.",
];
/** Single string for mobile so the poem has no line breaks and only word-wraps. */
const POEM_TEXT_MOBILE = POEM_LINES.join(" ");

// Intensity ramps from 0.15 to 1 over the glitch duration (ease-in so it builds more toward the end)
function glitchIntensityFactor(elapsedMs: number): number {
  const t = Math.min(1, elapsedMs / GLITCH_DURATION_MS);
  const eased = t * t;
  return 0.15 + 0.85 * eased;
}

// Per-frame random glitch values (updated every frame when phase is glitch); intensity increases over time. Fewer elements on mobile for performance.
function useGlitchRandom(active: boolean, isMobile: boolean) {
  const stripCount = isMobile ? CAPTURE_STRIP_COUNT_MOBILE : CAPTURE_STRIP_COUNT;
  const patchCount = isMobile ? PATCH_COUNT_MOBILE : PATCH_COUNT;
  const artifactCount = isMobile ? ARTIFACT_COUNT_MOBILE : ARTIFACT_COUNT;
  const sliceCount = isMobile ? SLICE_COUNT_MOBILE : SLICE_COUNT;
  const rgbScale = isMobile ? 0.6 : 1;
  const noiseOpacityScale = isMobile ? 0.6 : 1;
  const [r, setR] = useState({
    x: 0,
    y: 0,
    rotate: 0,
    rgbX: 0,
    rgbY: 0,
    flash: 0,
    slice: [] as Array<{ x: number; top: number; height: number; opacity: number }>,
    strip: [...Array(stripCount)].map(() => ({ x: 0, y: 0, rotate: 0 })),
    patch: [] as Array<{ left: number; top: number; width: number; height: number; opacity: number; offsetX: number; offsetY: number }>,
    artifact: [] as Array<{ left: number; top: number; width: number; height: number; opacity: number; scale: number }>,
  });
  const startRef = useRef<number>(0);
  useEffect(() => {
    if (!active) return;
    startRef.current = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - startRef.current;
      const k = glitchIntensityFactor(elapsed);
      setR({
        x: (Math.random() - 0.5) * 40 * k,
        y: (Math.random() - 0.5) * 30 * k,
        rotate: (Math.random() - 0.5) * 2 * k,
        rgbX: (Math.random() - 0.5) * 80 * k * rgbScale,
        rgbY: (Math.random() - 0.5) * 60 * k * rgbScale,
        flash: Math.random() > 0.92 - 0.1 * (1 - k) ? 1 : 0,
        slice: [...Array(sliceCount)].map(() => ({
          x: (Math.random() - 0.5) * 100 * k,
          top: Math.random() * 100,
          height: Math.random() * 30 * k + 20,
          opacity: Math.random() * 0.3 * k,
        })),
        strip: [...Array(stripCount)].map(() => ({
          x: (Math.random() - 0.5) * 60 * k,
          y: (Math.random() - 0.5) * 40 * k,
          rotate: (Math.random() - 0.5) * 4 * k,
        })),
        patch: [...Array(patchCount)].map(() => ({
          left: Math.random() * 80,
          top: Math.random() * 80,
          width: Math.random() * 200 * k + 50,
          height: Math.random() * 150 * k + 40,
          opacity: Math.random() * 0.8 * k,
          offsetX: (Math.random() - 0.5) * 20 * k,
          offsetY: (Math.random() - 0.5) * 20 * k,
        })),
        artifact: [...Array(artifactCount)].map(() => ({
          left: Math.random() * 90,
          top: Math.random() * 90,
          width: Math.random() * 100 * k + 30,
          height: Math.random() * 100 * k + 30,
          opacity: Math.random() > 0.7 - 0.2 * (1 - k) ? Math.random() * 0.8 * k : 0,
          scale: 0.5 + Math.random() * 1.5 * k,
        })),
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, stripCount, patchCount, artifactCount, sliceCount, rgbScale]);
  return { ...r, noiseOpacityScale };
}

const STATIC_VOLUME_START = 0.00;
const STATIC_VOLUME_END = 1;
const SCROLL_DURATION_MS = 50000;
const ENDGAME_REVEAL_START_MS = 20000; // 30s before scroll ends: start music and fade in slideshow
const ENDGAME_FADE_DURATION_MS = 15000;

const SOUNDS_BASE = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "") + "/sounds/";
const STATIC_ENDGAME_SRC = `${SOUNDS_BASE}static_endgame.wav`.replace(/\/+/g, "/");
const ENDGAME_MUSIC_SRC = `${SOUNDS_BASE}music_endgame01.wav`.replace(/\/+/g, "/");

// Slideshow constants
const SLIDESHOW_TOTAL_MS = 240000;
const SLIDESHOW_LAST_MS = 30000;
const SLIDESHOW_SLIDE05_MULT = 0.5;
const SLIDESHOW_SLIDE17_MULT = 0.5;
const SLIDESHOW_FADE_MS = 1000;
const SLIDESHOW_FADE_MS_MOBILE = 800;
const SLIDESHOW_FADE_BLACK_MS = 1250;
const SLIDESHOW_START_SCALE = 1.22;
const SLIDESHOW_END_SCALE = 1.00;
/** On mobile: zoom completes at this fraction of slide duration (e.g. 0.8 = done at 80%), so the rest of the slide is full-screen. */
const SLIDESHOW_ZOOM_COMPLETE_AT_MOBILE = 0.8;
const SLIDESHOW_NO_ZOOM_SLIDES = new Set([4, 16]);
const SLIDESHOW_DEFAULT_FOCALS = [
  { x: 0.44, y: 0.42 }, { x: 0.52, y: 0.55 }, { x: 0.62, y: 0.42 }, { x: 0.66, y: 0.55 },
  { x: 0.62, y: 0.44 }, { x: 0.78, y: 0.45 }, { x: 0.64, y: 0.58 }, { x: 0.55, y: 0.48 },
  { x: 0.55, y: 0.60 }, { x: 0.60, y: 0.56 }, { x: 0.50, y: 0.52 }, { x: 0.55, y: 0.52 },
  { x: 0.55, y: 0.52 }, { x: 0.52, y: 0.62 }, { x: 0.52, y: 0.62 }, { x: 0.58, y: 0.55 },
  { x: 0.56, y: 0.55 }, { x: 0.50, y: 0.45 },
];
const ENDGAME_IMAGES_BASE = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "") + "/endgame/";
const ENDGAME_IMAGES_BASE_MOBILE = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "") + "/endgame/mobile/";
const ENDGAME_IMAGES_BASE_FALLBACK = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "") + "/endgame/";

type Slide = {
  i: number;
  name: string;
  url: string;
  focal: { x: number; y: number };
  durMs: number;
  startMs: number;
  endMs: number;
};

function buildSlideshowTimeline(isMobile: boolean): Slide[] {
  const basePath = isMobile ? ENDGAME_IMAGES_BASE_MOBILE : ENDGAME_IMAGES_BASE;
  const ext = isMobile ? "jpg" : "png";
  const BASE_POOL_MS = SLIDESHOW_TOTAL_MS - SLIDESHOW_LAST_MS;
  const BASE_MS = BASE_POOL_MS / 17;
  const SHORT = new Map([
    [4, SLIDESHOW_SLIDE05_MULT],
    [16, SLIDESHOW_SLIDE17_MULT],
  ]);
  const REDIST_TARGETS = new Set([0, 1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
  let freed = 0;
  SHORT.forEach((mult, idx) => {
    freed += BASE_MS * (1 - mult);
  });
  const extraEach = freed / REDIST_TARGETS.size;
  let cursor = 0;
  const slides: Slide[] = [];
  for (let i = 0; i < 18; i++) {
    const isLast = i === 17;
    let dur: number;
    if (isLast) {
      dur = SLIDESHOW_LAST_MS;
    } else if (SHORT.has(i)) {
      dur = BASE_MS * SHORT.get(i)!;
    } else {
      dur = BASE_MS + extraEach;
    }
    const startMs = cursor;
    const endMs = cursor + dur;
    cursor = endMs;
    slides.push({
      i,
      name: `Slide ${String(i + 1).padStart(2, "0")}`,
      url: `${basePath}${String(i + 1).padStart(2, "0")}.${ext}`.replace(/\/+/g, "/"),
      focal: SLIDESHOW_DEFAULT_FOCALS[i] || { x: 0.5, y: 0.5 },
      durMs: dur,
      startMs,
      endMs,
    });
  }
  const drift = cursor - SLIDESHOW_TOTAL_MS;
  if (Math.abs(drift) > 0.01) {
    slides[17].endMs = SLIDESHOW_TOTAL_MS;
    slides[17].durMs = SLIDESHOW_TOTAL_MS - slides[17].startMs;
  }
  return slides;
}

function useSlideshow(active: boolean, isMobile: boolean) {
  const slides = useRef<Slide[]>(buildSlideshowTimeline(isMobile));
  const fadeMs = isMobile ? SLIDESHOW_FADE_MS_MOBILE : SLIDESHOW_FADE_MS;
  const layerARef = useRef<HTMLDivElement>(null);
  const layerBRef = useRef<HTMLDivElement>(null);
  const imgARef = useRef<HTMLImageElement>(null);
  const imgBRef = useRef<HTMLImageElement>(null);
  const blackRef = useRef<HTMLDivElement>(null);
  const runningRef = useRef(false);
  const t0Ref = useRef(0);
  const rafRef = useRef<number>(0);
  const fadeRef = useRef<{ active: boolean; fromIdx: number; toIdx: number; startMs: number }>({
    active: false,
    fromIdx: 0,
    toIdx: 0,
    startMs: 0,
  });
  const [isComplete, setIsComplete] = useState(false);

  // Keep timeline in sync with isMobile (ref is only initialized once; update when isMobile changes)
  useEffect(() => {
    slides.current = buildSlideshowTimeline(isMobile);
    const currentIdx = Number(imgARef.current?.dataset.slideIndex ?? -1);
    if (currentIdx >= 0 && currentIdx < slides.current.length) {
      const imgEl = imgARef.current;
      if (imgEl) {
        imgEl.src = slides.current[currentIdx].url;
        if (isMobile) {
          imgEl.style.transformOrigin = "50% 50%";
          imgEl.style.transform = "scale(1)";
        }
      }
    }
  }, [isMobile]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const nearestSlideIndex = (t: number): number => {
    for (let i = 0; i < slides.current.length; i++) {
      if (t >= slides.current[i].startMs && t < slides.current[i].endMs) return i;
    }
    return slides.current.length - 1;
  };

  const slideProgress = (slide: Slide, t: number): number => {
    return clamp((t - slide.startMs) / slide.durMs, 0, 1);
  };

  /** Zoom progress 0..1; on mobile reaches 1 earlier so the slide ends with image full-screen. */
  const zoomProgress = (slide: Slide, t: number): number => {
    const raw = slideProgress(slide, t);
    if (isMobile) {
      return clamp(raw / SLIDESHOW_ZOOM_COMPLETE_AT_MOBILE, 0, 1);
    }
    return raw;
  };

  const applyZoom = (imgEl: HTMLImageElement | null, idx: number, t: number, freezeAtT: number | null) => {
    if (!imgEl) return;
    if (isMobile || SLIDESHOW_NO_ZOOM_SLIDES.has(idx)) {
      imgEl.style.transformOrigin = "50% 50%";
      imgEl.style.transform = "scale(1)";
      return;
    }
    const slide = slides.current[idx];
    const focal = slide.focal;
    const tt = freezeAtT == null ? t : freezeAtT;
    const p = zoomProgress(slide, tt);
    const s = SLIDESHOW_START_SCALE + (SLIDESHOW_END_SCALE - SLIDESHOW_START_SCALE) * p;
    imgEl.style.transformOrigin = `${(focal.x * 100).toFixed(2)}% ${(focal.y * 100).toFixed(2)}%`;
    imgEl.style.transform = `scale(${s.toFixed(5)})`;
  };

  const setLayer = (layerKey: "A" | "B", slideIdx: number) => {
    const imgEl = layerKey === "A" ? imgARef.current : imgBRef.current;
    if (imgEl) {
      imgEl.src = slides.current[slideIdx].url;
      imgEl.dataset.slideIndex = String(slideIdx);
      if (isMobile) {
        imgEl.style.transformOrigin = "50% 50%";
        imgEl.style.transform = "scale(1)";
      }
    }
  };

  const setOpacity = (layerKey: "A" | "B", v: number) => {
    const layer = layerKey === "A" ? layerARef.current : layerBRef.current;
    if (layer) layer.style.opacity = String(v);
  };

  const hardShow = (idx: number, t: number | null) => {
    fadeRef.current.active = false;
    setLayer("A", idx);
    setOpacity("A", 1);
    setOpacity("B", 0);
    if (!isMobile) {
      const tt = t == null ? slides.current[idx].startMs : t;
      applyZoom(imgARef.current, idx, tt, null);
    }
  };

  const updateBlack = (t: number) => {
    if (!blackRef.current) return;
    if (t < SLIDESHOW_FADE_BLACK_MS) {
      blackRef.current.style.opacity = String(1 - t / SLIDESHOW_FADE_BLACK_MS);
    } else if (t < SLIDESHOW_TOTAL_MS - SLIDESHOW_FADE_BLACK_MS) {
      blackRef.current.style.opacity = "0";
    } else {
      const dt = t - (SLIDESHOW_TOTAL_MS - SLIDESHOW_FADE_BLACK_MS);
      blackRef.current.style.opacity = String(clamp(dt / SLIDESHOW_FADE_BLACK_MS, 0, 1));
    }
  };

  const updateCrossfadeState = (t: number) => {
    const curIdx = nearestSlideIndex(t);
    if (curIdx > 0) {
      const cur = slides.current[curIdx];
      const local = t - cur.startMs;
      const shouldFade = local < fadeMs;
      if (shouldFade) {
        const prevIdx = curIdx - 1;
        if (!(fadeRef.current.active && fadeRef.current.fromIdx === prevIdx && fadeRef.current.toIdx === curIdx)) {
          fadeRef.current = { active: true, fromIdx: prevIdx, toIdx: curIdx, startMs: cur.startMs };
          setLayer("A", prevIdx);
          setLayer("B", curIdx);
        }
        return;
      }
    }
    if (fadeRef.current.active) {
      fadeRef.current.active = false;
      hardShow(curIdx, t);
    } else {
      const shown = Number(imgARef.current?.dataset.slideIndex || -1);
      if (shown !== curIdx) hardShow(curIdx, null);
    }
  };

  const updateLayers = (t: number) => {
    updateCrossfadeState(t);
    if (fadeRef.current.active) {
      const p = clamp((t - fadeRef.current.startMs) / fadeMs, 0, 1);
      setOpacity("A", 1 - p);
      setOpacity("B", p);
      if (!isMobile) {
        const freezeOldT = slides.current[fadeRef.current.fromIdx].endMs;
        const freezeNewT = slides.current[fadeRef.current.toIdx].startMs;
        applyZoom(imgARef.current, fadeRef.current.fromIdx, t, freezeOldT);
        applyZoom(imgBRef.current, fadeRef.current.toIdx, t, freezeNewT);
      }
      return;
    }
    if (!isMobile) {
      const idx = nearestSlideIndex(t);
      applyZoom(imgARef.current, idx, t, null);
    }
  };

  const updateFrame = (t: number) => {
    const clampedT = clamp(t, 0, SLIDESHOW_TOTAL_MS);
    updateLayers(clampedT);
    updateBlack(clampedT);
  };

  useEffect(() => {
    if (!active) {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      setIsComplete(false);
      return;
    }
    runningRef.current = true;
    t0Ref.current = performance.now();
    hardShow(0, 0);
    if (blackRef.current) blackRef.current.style.opacity = "1";
    updateFrame(0);
    const loop = () => {
      if (!runningRef.current) return;
      const t = clamp(performance.now() - t0Ref.current, 0, SLIDESHOW_TOTAL_MS);
      updateFrame(t);
      if (t < SLIDESHOW_TOTAL_MS) {
        rafRef.current = requestAnimationFrame(loop);
      } else {
        runningRef.current = false;
        setIsComplete(true);
      }
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [active]);

  return { layerARef, layerBRef, imgARef, imgBRef, blackRef, isComplete };
}

const PRELOAD_FIRST = 4;
const PRELOAD_SECOND_BATCH_AT_MS = 25000;
const PRELOAD_SECOND_COUNT = 6;

function useImagePreloader(slideUrls: string[], phase: Phase, scrollElapsedMs: number) {
  const preloadedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (slideUrls.length === 0) return;
    const toPreload: number[] = [];
    for (let i = 0; i < Math.min(PRELOAD_FIRST, slideUrls.length); i++) {
      if (!preloadedRef.current.has(i)) toPreload.push(i);
    }
    toPreload.forEach((i) => {
      preloadedRef.current.add(i);
      const img = new Image();
      img.src = slideUrls[i];
    });
  }, [slideUrls]);

  useEffect(() => {
    if (phase !== "scroll" || slideUrls.length === 0) return;
    if (scrollElapsedMs < PRELOAD_SECOND_BATCH_AT_MS) return;
    const start = PRELOAD_FIRST;
    const end = Math.min(start + PRELOAD_SECOND_COUNT, slideUrls.length);
    for (let i = start; i < end; i++) {
      if (preloadedRef.current.has(i)) continue;
      preloadedRef.current.add(i);
      const img = new Image();
      img.src = slideUrls[i];
    }
  }, [phase, scrollElapsedMs, slideUrls]);

  useEffect(() => {
    if ((phase !== "endgame" && phase !== "scroll") || slideUrls.length === 0) return;
    const start = PRELOAD_FIRST + PRELOAD_SECOND_COUNT;
    for (let i = start; i < slideUrls.length; i++) {
      if (preloadedRef.current.has(i)) continue;
      preloadedRef.current.add(i);
      const img = new Image();
      img.src = slideUrls[i];
    }
  }, [phase, slideUrls]);
}

export default function Level20EndingOverlay({ captureDataUrl, preexistingStaticAudioRef, forceMobile, onComplete }: Level20EndingOverlayProps) {
  const isMobile = useIsMobile() || forceMobile === true;
  const [phase, setPhase] = useState<Phase>("glitch");
  const [scrollElapsedMs, setScrollElapsedMs] = useState(0);
  const glitch = useGlitchRandom(phase === "glitch", isMobile);
  const ownedStaticAudioRef = useRef<HTMLAudioElement | null>(null);
  const rampRafRef = useRef<number>(0);
  const scrollStartRef = useRef<number>(0);
  const slideshowActive = (phase === "scroll" && scrollElapsedMs >= ENDGAME_REVEAL_START_MS) || phase === "endgame";
  const slideUrls = useMemo(() => buildSlideshowTimeline(isMobile).map((s) => s.url), [isMobile]);
  useImagePreloader(slideUrls, phase, scrollElapsedMs);
  const slideshow = useSlideshow(slideshowActive, isMobile);
  const [showThanks, setShowThanks] = useState(false);
  const thanksTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Preload static audio when overlay mounts so it's cached when glitch starts
  useEffect(() => {
    const a = new Audio(STATIC_ENDGAME_SRC);
    a.load();
  }, []);

  // Preload endgame music early in scroll so it's ready when we start at ENDGAME_REVEAL_START_MS (20s)
  useEffect(() => {
    if (phase !== "scroll" || scrollElapsedMs < 5000) return;
    const a = new Audio(ENDGAME_MUSIC_SRC);
    a.load();
  }, [phase, scrollElapsedMs]);

  // When slideshow completes, show thanks screen for 5s, then fade to title
  useEffect(() => {
    if (!slideshow.isComplete) return;
    setShowThanks(true);
    thanksTimerRef.current = setTimeout(() => {
      setPhase("fadeout");
    }, 5000);
    return () => {
      if (thanksTimerRef.current) clearTimeout(thanksTimerRef.current);
    };
  }, [slideshow.isComplete]);

  useEffect(() => {
    // Phase 1: Glitch animation (3-4 seconds)
    const glitchTimer = setTimeout(() => {
      setPhase("black");
    }, GLITCH_DURATION_MS);

    return () => clearTimeout(glitchTimer);
  }, []);

  // Static.wav during glitch: use preexisting audio (from Demo) or create one; ramp volume, stop when screen goes black
  useEffect(() => {
    if (phase !== "glitch") return;

    const audio = preexistingStaticAudioRef?.current ?? (() => {
      const a = new Audio(STATIC_ENDGAME_SRC);
      a.loop = true;
      a.volume = STATIC_VOLUME_START;
      ownedStaticAudioRef.current = a;
      a.play().catch(() => {});
      return a;
    })();
    const startVol = Math.max(0, Math.min(1, preexistingStaticAudioRef?.current ? audio.volume : STATIC_VOLUME_START));

    const start = performance.now();
    const setVolume = (v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      try {
        audio.volume = clamped;
      } catch {
        // Some environments throw if volume was ever set out of range; avoid repeated failures
      }
    };
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= GLITCH_DURATION_MS) {
        setVolume(STATIC_VOLUME_END);
        return;
      }
      const t = Math.max(0, Math.min(1, elapsed / GLITCH_DURATION_MS));
      const vol = startVol + t * (STATIC_VOLUME_END - startVol);
      setVolume(vol);
      rampRafRef.current = requestAnimationFrame(tick);
    };
    rampRafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rampRafRef.current);
      audio.pause();
      audio.currentTime = 0;
      if (ownedStaticAudioRef.current === audio) ownedStaticAudioRef.current = null;
    };
  }, [phase, preexistingStaticAudioRef]);

  useEffect(() => {
    if (phase === "black") {
      // Phase 2: Black screen (0.5-1 second)
      const blackTimer = setTimeout(() => {
        setPhase("scroll");
      }, 800);
      return () => clearTimeout(blackTimer);
    }
  }, [phase]);

  // Track scroll elapsed so we can start music and fade 15s before scroll ends
  useEffect(() => {
    if (phase !== "scroll") {
      setScrollElapsedMs(0);
      return;
    }
    scrollStartRef.current = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = Math.min(SCROLL_DURATION_MS, performance.now() - scrollStartRef.current);
      setScrollElapsedMs(elapsed);
      if (elapsed < SCROLL_DURATION_MS) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (phase === "scroll") {
      // After scroll completes, wait 0.5s, then go to endgame (image already visible, music already playing).
      const scrollTimer = setTimeout(() => {
        holdTimerRef.current = setTimeout(() => setPhase("endgame"), 500);
      }, SCROLL_DURATION_MS);
      return () => {
        clearTimeout(scrollTimer);
        if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      };
    }
  }, [phase]);

  // Start endgame music when scrollElapsedMs >= ENDGAME_REVEAL_START_MS; listener fires when music ends → fadeout
  const endgameMusicRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const shouldStart =
      (phase === "scroll" && scrollElapsedMs >= ENDGAME_REVEAL_START_MS) || phase === "endgame";
    if (!shouldStart) return;
    if (endgameMusicRef.current) return; // already started at ENDGAME_REVEAL_START_MS
    const audio = new Audio(ENDGAME_MUSIC_SRC);
    endgameMusicRef.current = audio;
    audio.play().catch(() => setPhase("fadeout"));
    const onEnded = () => {
      endgameMusicRef.current = null;
      setPhase("fadeout");
    };
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("ended", onEnded);
      // Do not pause here when leaving scroll→endgame; fadeout effect cleans up when phase === "fadeout"
    };
  }, [phase, scrollElapsedMs]);

  // When in endgame phase only: ensure we don't double-start music. Clean up audio when leaving endgame for fadeout.
  useEffect(() => {
    if (phase !== "fadeout") return;
    const audio = endgameMusicRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      endgameMusicRef.current = null;
    }
  }, [phase]);

  useEffect(() => {
    if (phase === "fadeout") {
      // Phase 5: Fade out (1.5 seconds), then call onComplete
      const fadeTimer = setTimeout(() => {
        onComplete();
      }, 1500);
      return () => clearTimeout(fadeTimer);
    }
  }, [phase, onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[100] pointer-events-none"
      initial={{ opacity: 1 }}
      animate={{
        opacity: phase === "fadeout" ? 0 : 1,
      }}
      transition={{
        duration: phase === "fadeout" ? 1.5 : 0,
      }}
    >
      {/* Phase 1: Blocky, patchy, digitized crash glitch - extremely randomized per frame */}
      <AnimatePresence>
        {phase === "glitch" && (
          <motion.div
            className="absolute inset-0 glitch-container overflow-hidden"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0 }}
            style={{
              imageRendering: "pixelated",
              transform: `translate(${glitch.x}px, ${glitch.y}px) rotate(${glitch.rotate}deg)`,
            }}
          >
            {/* Base: captured page (zoomed) or empty pixelated layer */}
            {captureDataUrl ? (
              <>
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `url(${captureDataUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    imageRendering: "pixelated",
                    transform: "scale(1.06)",
                  }}
                />
                {/* Break-up: horizontal strips with per-frame offset */}
                {glitch.strip.map((s, i) => {
                  const stripCount = glitch.strip.length;
                  const topPct = (i / stripCount) * 100;
                  const heightPct = 100 / stripCount;
                  return (
                    <div
                      key={`capture-strip-${i}`}
                      className="absolute left-0 right-0 pointer-events-none overflow-hidden"
                      style={{
                        top: `${topPct}%`,
                        height: `${heightPct}%`,
                        backgroundImage: `url(${captureDataUrl})`,
                        backgroundSize: `100% ${stripCount * 100}%`,
                        backgroundPosition: `0 ${topPct}%`,
                        imageRendering: "pixelated",
                        transform: `translate(${s.x}px, ${s.y}px) rotate(${s.rotate}deg)`,
                      }}
                    />
                  );
                })}
              </>
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  filter: "contrast(1.5) brightness(1.2)",
                  imageRendering: "pixelated",
                }}
              />
            )}
            {/* Heavy scanlines */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent 0px, transparent 1px, rgba(0, 255, 0, 0.2) 1px, rgba(0, 255, 0, 0.2) 3px)",
                backgroundSize: "100% 3px",
              }}
            />
            {/* Blocky corruption patches - positions randomized every frame */}
            {[...Array(8)].map((_, i) => {
              const p = glitch.patch[i];
              if (!p) return null;
              return (
                <div
                  key={i}
                  className="absolute pointer-events-none"
                  style={{
                    width: `${p.width}px`,
                    height: `${p.height}px`,
                    left: `${p.left}%`,
                    top: `${p.top}%`,
                    backgroundColor: i % 3 === 0 ? "#00ff00" : i % 3 === 1 ? "#ff00ff" : "#00ffff",
                    mixBlendMode: "screen",
                    opacity: p.opacity,
                    imageRendering: "pixelated",
                    transform: `translate(${p.offsetX}px, ${p.offsetY}px)`,
                  }}
                />
              );
            })}
            {/* Strong RGB channel split - per-frame offset */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(90deg, rgba(255,0,0,0.5) 0%, transparent 30%, transparent 70%, rgba(0,0,255,0.5) 100%)",
                mixBlendMode: "screen",
                filter: "blur(1px) contrast(2)",
                imageRendering: "pixelated",
                transform: `translateX(${glitch.rgbX}px)`,
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "linear-gradient(180deg, rgba(0,255,255,0.4) 0%, transparent 40%, transparent 60%, rgba(255,255,0,0.4) 100%)",
                mixBlendMode: "screen",
                filter: "blur(1px) contrast(2)",
                imageRendering: "pixelated",
                transform: `translateY(${glitch.rgbY}px)`,
              }}
            />
            {/* Dense pixelated noise - opacity randomized per frame */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                opacity: 0.3 + (glitch.patch[0]?.opacity ?? 0) * 0.4,
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 64 64' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
                backgroundSize: "32px 32px",
                imageRendering: "pixelated",
              }}
            />
            {/* Full-screen flash - per-frame random */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundColor: glitch.flash > 0.5 ? "#fff" : "#000",
                opacity: glitch.flash,
              }}
            />
            {/* Horizontal blocky slices - positions randomized every frame */}
            {glitch.slice.map((s, i) => (
              <div
                key={`slice-${i}`}
                className="absolute left-0 right-0 pointer-events-none bg-black"
                style={{
                  height: `${s.height}px`,
                  top: `${s.top}%`,
                  mixBlendMode: "difference",
                  imageRendering: "pixelated",
                  transform: `translateX(${s.x}px)`,
                  opacity: s.opacity,
                }}
              />
            ))}
            {/* Digital artifact blocks - positions randomized every frame */}
            {glitch.artifact.map((a, i) => (
              <div
                key={`artifact-${i}`}
                className="absolute pointer-events-none"
                style={{
                  width: `${a.width}px`,
                  height: `${a.height}px`,
                  left: `${a.left}%`,
                  top: `${a.top}%`,
                  backgroundColor: "#000",
                  border: "2px solid #00ff00",
                  imageRendering: "pixelated",
                  opacity: a.opacity,
                  transform: `scale(${a.scale})`,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 2 & 3: Black background with scroll - abrupt blackout */}
      {(phase === "black" || phase === "scroll") && (
        <motion.div
          className="absolute inset-0 bg-black"
          initial={{ opacity: phase === "black" ? 1 : 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0 }}
        >
          {/* Star Wars style scroll: crisp layer on top + drifting/breathing additive glow behind; centered */}
          {phase === "scroll" && (
            <div
              className="absolute inset-0 overflow-hidden flex justify-center"
              style={{
                perspective: "1000px",
                perspectiveOrigin: "50% 50%",
              }}
            >
              <motion.div
                className="flex justify-center"
                style={{
                  width: "100%",
                  flexShrink: 0,
                  transformStyle: "preserve-3d",
                  transform: "rotateX(25deg)",
                  transformOrigin: "50% 0%",
                }}
                initial={{
                  y: "100vh",
                }}
                animate={{
                  y: "-150vh",
                }}
                transition={{
                  duration: 50,
                  ease: "linear",
                }}
              >
                <div
                  className="relative"
                  style={{
                    width: "90vw",
                    textAlign: "center",
                  }}
                >
                  {/* Ghost layer: semi-transparent duplicate behind, additive glow; simplified on mobile for performance */}
                  <motion.div
                    className="font-crawl absolute top-0 left-0"
                    style={{
                      width: "100%",
                      fontSize: isMobile ? "clamp(1rem, 4vw, 2rem)" : "clamp(2rem, 5vw, 4rem)",
                      lineHeight: isMobile ? "1.6" : "1.8",
                      letterSpacing: isMobile ? "0.08em" : "0.12em",
                      fontStyle: "italic",
                      color: "rgba(255, 255, 255, 0.82)",
                      mixBlendMode: "plus-lighter",
                      pointerEvents: "none",
                    }}
                    animate={
                      isMobile
                        ? {
                            x: 5,
                            y: 5,
                            opacity: [0.6, 0.8, 0.6],
                            filter: ["blur(4px)", "blur(8px)", "blur(4px)"],
                          }
                        : {
                            x: 5,
                            y: 5,
                            opacity: [0.55, 0.8, 0.65, 0.85, 0.6, 0.55],
                            filter: ["blur(4px)", "blur(10px)", "blur(6px)", "blur(12px)", "blur(5px)", "blur(4px)"],
                            scaleX: [1, 1.02, 0.98, 1.015, 0.99, 1.01, 1],
                            scaleY: [1, 0.99, 1.02, 0.985, 1.01, 0.995, 1],
                            rotate: [0, 0.8, -0.5, 0.4, -0.6, 0.3, 0],
                            skewX: [0, 1, -0.8, 0.5, -1.2, 0.3, 0],
                            skewY: [0, -0.5, 0.6, -0.3, 0.4, -0.2, 0],
                          }
                    }
                    transition={{
                      duration: 12,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    {isMobile ? (
                      <div style={{ textAlign: "center", whiteSpace: "normal" }}>{POEM_TEXT_MOBILE}</div>
                    ) : (
                      POEM_LINES.map((line, i) => (
                        <div key={i} style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                          {line}
                        </div>
                      ))
                    )}
                  </motion.div>
                  {/* Crisp text layer on top */}
                  <div
                    className="font-crawl relative"
                    style={{
                      width: "100%",
                      fontSize: isMobile ? "clamp(1rem, 4vw, 2rem)" : "clamp(2rem, 5vw, 4rem)",
                      lineHeight: isMobile ? "1.6" : "1.8",
                      letterSpacing: isMobile ? "0.08em" : "0.12em",
                      color: "rgba(248, 248, 255, 0.98)",
                      textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                    }}
                  >
                    {isMobile ? (
                      <div style={{ textAlign: "center", whiteSpace: "normal" }}>{POEM_TEXT_MOBILE}</div>
                    ) : (
                      POEM_LINES.map((line, i) => (
                        <div key={i} style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                          {line}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}

      {/* Phase 4: Endgame — fullscreen slideshow (01.png–18.png); fades in over 15s starting 15s before scroll ends */}
      {slideshowActive && (
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{
            opacity:
              phase === "endgame"
                ? 1
                : Math.min(1, (scrollElapsedMs - ENDGAME_REVEAL_START_MS) / ENDGAME_FADE_DURATION_MS),
          }}
          transition={{ duration: 0.15 }}
          style={{
            position: "relative",
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            background: "#000",
          }}
        >
          <div
            ref={slideshow.layerARef}
            className="absolute inset-0"
            style={{ opacity: 0, willChange: "opacity" }}
          >
            <img
              ref={slideshow.imgARef}
              alt=""
              className="absolute inset-0 w-full h-full"
              style={{
                objectFit: isMobile ? "contain" : "cover",
                transform: "scale(1)",
                transformOrigin: "50% 50%",
                willChange: "transform",
              }}
              onError={(e) => {
                const img = e.currentTarget;
                const idx = img.dataset.slideIndex;
                if (idx != null && isMobile) {
                  img.src = `${ENDGAME_IMAGES_BASE_FALLBACK}${String(Number(idx) + 1).padStart(2, "0")}.png`.replace(/\/+/g, "/");
                }
              }}
            />
          </div>
          <div
            ref={slideshow.layerBRef}
            className="absolute inset-0"
            style={{ opacity: 0, willChange: "opacity" }}
          >
            <img
              ref={slideshow.imgBRef}
              alt=""
              className="absolute inset-0 w-full h-full endgame-slide-img"
              style={{
                objectFit: isMobile ? "contain" : "cover",
                transform: "scale(1)",
                transformOrigin: "50% 50%",
                willChange: "transform",
              }}
              onError={(e) => {
                const img = e.currentTarget;
                const idx = img.dataset.slideIndex;
                if (idx != null && isMobile) {
                  img.src = `${ENDGAME_IMAGES_BASE_FALLBACK}${String(Number(idx) + 1).padStart(2, "0")}.png`.replace(/\/+/g, "/");
                }
              }}
            />
          </div>
          <div
            ref={slideshow.blackRef}
            className="absolute inset-0"
            style={{
              background: "#000",
              opacity: 1,
              pointerEvents: "none",
              zIndex: 5,
            }}
          />
        </motion.div>
      )}

      {/* Thanks screen: shown when slideshow completes, displayed for 5s, then crossfades to title */}
      {showThanks && (
        <motion.div
          className="absolute inset-0 flex flex-col items-center justify-center bg-black"
          style={{ zIndex: 10 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === "fadeout" ? 0 : 1 }}
          transition={{ duration: phase === "fadeout" ? 1.5 : 1 }}
        >
          <div
            className="text-center"
            style={{
              fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
            }}
          >
            <h1
              className="font-display mb-8"
              style={{
                fontSize: "clamp(3rem, 8vw, 6rem)",
                fontWeight: 900,
                color: "#fff",
                textShadow: "0 4px 8px rgba(0,0,0,0.5)",
                letterSpacing: "0.05em",
              }}
            >
              THANKS FOR PLAYING!
            </h1>
            <div className="flex justify-center items-center">
              <img
                src={`${(import.meta.env.BASE_URL || "/").replace(/\/?$/, "")}/carrot.png`.replace(/\/+/g, "/")}
                alt=""
                className="block"
                style={{
                  maxWidth: "min(400px, 40vw)",
                  height: "auto",
                  objectFit: "contain",
                }}
                onError={(e) => {
                  // Fallback if carrot image not found - hide the image
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
