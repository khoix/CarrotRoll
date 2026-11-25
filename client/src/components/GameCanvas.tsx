/**
 * React host for the game: owns the canvas, sizing (HiDPI, full-viewport, both orientations),
 * input wiring, one persistent animation loop, and the DOM overlays (HUD, menu, pause, game over).
 * Simulation lives in `@/game/engine`, drawing in `@/game/render`.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Maximize2, Minimize2, Pause, Play as PlayIcon } from "lucide-react";
import { useCreateScore } from "@/hooks/use-scores";
import { useSound } from "@/contexts/SoundContext";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackgroundScroller } from "@/lib/BackgroundScroller";
import { useIsMobile, useCoarsePointer } from "@/hooks/use-mobile";
import StartMenuCard from "@/components/StartMenuCard";
import { validateName } from "@shared/schema";
import { BASE_H, BASE_W, GameEngine, type HudState, type Phase, type SpawnableType } from "@/game/engine";
import { TIERS, type TierTheme } from "@/game/tiers";
import { Renderer, type Quality } from "@/game/render";
import { attachDragControls } from "@/game/input";
import { GameBanner, useBannerQueue } from "@/components/GameBanners";

const SEEN_KEY = "carrotroll_seen_items";
function loadSeen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function saveSeen(ids: Iterable<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // storage unavailable
  }
}

export type { SpawnableType } from "@/game/engine";

const IMAGE_BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
const imageUrl = (path: string) => `${IMAGE_BASE}/${path.replace(/^\//, "")}`;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = imageUrl(src);
  });
}

/** Fallback 1024×1024 tile when baseTile is missing (so scroller + haze still run). */
function createFallbackBaseTile(): HTMLCanvasElement {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, "#2d5a27");
    g.addColorStop(0.5, "#3d6b35");
    g.addColorStop(0.7, "#2563a8");
    g.addColorStop(1, "#1e40af");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  return canvas;
}

type GameState = "menu" | "countdown" | "playing" | "gameover" | "level_transition" | "level20_ending";

// --- Sizing ---
/** Portrait world: fixed width, height grows with the screen (difficulty is scaled to match). */
const PORTRAIT_W = 600;
const PORTRAIT_MAX_H = 1400;
/** Touch devices in full-viewport mode see the game 1.25× larger (the world is shrunk to match). */
const MOBILE_ZOOM = 1.25;

// --- Adaptive quality ---
const QUALITY_KEY = "carrotroll_quality";
const DPR_CAP: Record<Quality, number> = { 0: 2, 1: 1.5, 2: 1 };
function loadQuality(): Quality {
  try {
    const v = Number(localStorage.getItem(QUALITY_KEY));
    return v === 1 || v === 2 ? v : 0;
  } catch {
    return 0;
  }
}

const SCROLLER_SPEED = 50;

interface GameCanvasProps {
  onStateChange?: (state: GameState) => void;
  /** Start the game on mount (or behind the tap-to-start gate when `startGate` is set). */
  autoStart?: boolean;
  /** Show a "tap to start" screen first (needed on mobile: audio and full screen require a tap). */
  startGate?: boolean;
  /** Fill the whole viewport (mobile): portrait gets a taller world, landscape a letterboxed 4:3. */
  fillViewport?: boolean;
  /** @deprecated Kept for compatibility; use fillViewport. */
  portraitAspect?: boolean;
  onReturnToMenu?: () => void;
  initialLevel?: number;
  /** Demo/sandbox: no damage from hazards or the giant carrot. */
  damageDisabled?: boolean;
  /** Called on the first key/touch that unlocks audio (demo pages use it to start preload + music). */
  onSoundUnlock?: () => void;
  /** Extra controls rendered on top of the game (e.g. the play page's menu button). */
  children?: ReactNode;
}

export interface GameCanvasHandle {
  handleKeyPress: (key: string, pressed: boolean) => void;
  /** Legacy touchpad: 360° movement (dx, dy normalized). (0, 0) clears. */
  handleMove: (dx: number, dy: number) => void;
  resetToMenu: () => void;
  showGameOverAfterEnding: () => void;
  getContainerElement: () => HTMLDivElement | null;
  setLevel: (n: number) => void;
  spawnEntity: (x: number, y: number, type: SpawnableType) => void;
  /** Client coordinates → game world coordinates; null if outside the canvas. */
  clientToGame: (clientX: number, clientY: number) => { x: number; y: number } | null;
  pause: () => void;
  resume: () => void;
  toggleFullscreen: () => void;
}

const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(
  (
    {
      onStateChange,
      autoStart = false,
      startGate = false,
      fillViewport = false,
      onReturnToMenu,
      initialLevel = 1,
      damageDisabled = false,
      onSoundUnlock,
      children,
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const leftBezelRef = useRef<HTMLCanvasElement>(null);
    const rightBezelRef = useRef<HTMLCanvasElement>(null);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const isMobile = useIsMobile();
    const coarse = useCoarsePointer();
    const coarseRef = useRef(coarse);
    coarseRef.current = coarse;
    const [gameState, setGameState] = useState<GameState>("menu");
    const gameStateRef = useRef<GameState>("menu");
    gameStateRef.current = gameState;
    const [hud, setHud] = useState<HudState>({ score: 0, level: initialLevel, carrots: 0, lives: 3, combo: 1, comboChain: 0, boss: false });
    const [paused, setPausedState] = useState(false);
    const pausedRef = useRef(false);
    const [gateOpen, setGateOpen] = useState(autoStart && startGate);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [playerName, setPlayerName] = useState("");
    const [nameError, setNameError] = useState("");
    const nameErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const createScore = useCreateScore();
    const sound = useSound();
    const { playSfx, playAmbient, stopAmbient, setMusicState, stopMusic, pauseMusic, resumeMusic, unlockAudio } = sound;

    // Engine + renderer are created once and live for the component's lifetime.
    const engineRef = useRef<GameEngine | null>(null);
    const rendererRef = useRef<Renderer | null>(null);
    const qualityRef = useRef<Quality>(loadQuality());
    const reducedMotionRef = useRef(false);
    const layoutRef = useRef({ W: BASE_W, H: BASE_H, cssW: 0, cssH: 0, left: 0, top: 0, scale: 1, bezelW: 0 });
    const onSoundUnlockRef = useRef(onSoundUnlock);
    onSoundUnlockRef.current = onSoundUnlock;
    const onStateChangeRef = useRef(onStateChange);
    onStateChangeRef.current = onStateChange;

    const soundRef = useRef(sound);
    soundRef.current = sound;

    const banners = useBannerQueue();
    const applyTierRef = useRef<(index: number, crossfade: boolean) => void>(() => {});
    const bannersRef = useRef(banners);
    bannersRef.current = banners;

    if (!engineRef.current) {
      engineRef.current = new GameEngine({
        announce: (a) => bannersRef.current.push(a),
        tier: (i) => applyTierRef.current(i, true),
        discovered: () => saveSeen(engineRef.current!.seenItems),
        sfx: (id) => soundRef.current.playSfx(id),
        ambient: (id, on) => (on ? soundRef.current.playAmbient(id) : soundRef.current.stopAmbient(id)),
        goldenBunny: (on) => {
          const s = soundRef.current;
          if (on) {
            s.pauseMusic();
            s.playAmbient("golden_bunny_loop");
          } else {
            s.stopAmbient("golden_bunny_loop");
            s.resumeMusic();
          }
        },
        hud: (h) => setHud(h),
        phase: (p: Phase) => {
          if (p === "countdown") setGameState("countdown");
          else if (p === "playing") setGameState("playing");
          else if (p === "over") {
            setNameError("");
            setGameState("gameover");
          } else if (p === "ending") {
            soundRef.current.stopMusic();
            setGameState("level20_ending");
          }
        },
      });
    }
    const engine = engineRef.current;
    engine.damageDisabled = damageDisabled;
    useState(() => {
      for (const id of loadSeen()) engine.seenItems.add(id);
      return null;
    });
    if (import.meta.env.DEV) (window as unknown as { __game?: GameEngine }).__game = engine;

    useEffect(() => {
      onStateChangeRef.current?.(gameState);
      if (gameState !== "playing" && gameState !== "countdown") bannersRef.current.clear();
    }, [gameState]);

    // --- Pause ---
    const setPaused = useCallback((p: boolean) => {
      const e = engineRef.current!;
      const st = gameStateRef.current;
      if (p && st !== "playing" && st !== "countdown") return;
      e.setPaused(p);
      pausedRef.current = p;
      setPausedState(p);
      if (p) soundRef.current.pauseMusic();
      else soundRef.current.resumeMusic();
    }, []);

    useEffect(() => {
      if (gameState !== "playing" && gameState !== "countdown" && pausedRef.current) {
        engine.setPaused(false);
        pausedRef.current = false;
        setPausedState(false);
      }
    }, [gameState, engine]);

    // Auto-pause when the tab/app is hidden
    useEffect(() => {
      const onVis = () => {
        if (document.visibilityState === "hidden") setPaused(true);
      };
      document.addEventListener("visibilitychange", onVis);
      return () => document.removeEventListener("visibilitychange", onVis);
    }, [setPaused]);

    // --- Start / menu ---
    const startGame = useCallback(() => {
      unlockAudio();
      playSfx("start");
      setMusicState("playing");
      setGateOpen(false);
      engine.start(initialLevel);
    }, [unlockAudio, playSfx, setMusicState, engine, initialLevel]);
    const startGameRef = useRef(startGame);
    startGameRef.current = startGame;

    useEffect(() => {
      if (autoStart && !startGate) startGameRef.current();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const goToMenu = useCallback(() => {
      engine.stop();
      setMusicState("menu");
      setGameState("menu");
    }, [engine, setMusicState]);

    const resetToMenu = useCallback(() => {
      engine.stop();
      setMusicState("menu");
      setGameState("menu");
    }, [engine, setMusicState]);

    const showGameOverAfterEnding = useCallback(() => {
      setMusicState("menu");
      setGameState("gameover");
    }, [setMusicState]);

    // Unmount: leave no loops playing.
    useEffect(() => () => engineRef.current?.stop(), []);

    // --- Fullscreen ---
    const fullscreenSupported = typeof document !== "undefined" && !!document.fullscreenEnabled;
    const toggleFullscreen = useCallback(() => {
      playSfx("ui_click");
      if (!document.fullscreenElement) {
        // Fullscreen the whole document (so menus/portals stay visible); the game container
        // switches to a fixed full-viewport layout via isFullscreen.
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    }, [playSfx]);

    useEffect(() => {
      const onChange = () => setIsFullscreen(!!document.fullscreenElement);
      document.addEventListener("fullscreenchange", onChange);
      return () => document.removeEventListener("fullscreenchange", onChange);
    }, []);

    const handleGateTap = useCallback(() => {
      if (fillViewport && coarse && fullscreenSupported && !document.fullscreenElement) {
        document.documentElement.requestFullscreen?.({ navigationUI: "hide" }).catch(() => {});
      }
      onSoundUnlockRef.current?.();
      startGameRef.current();
    }, [fillViewport, coarse, fullscreenSupported]);

    // --- Layout: world size, CSS fit, HiDPI backing store ---
    const applyLayout = useCallback(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      if (!container || !canvas || !stage) return;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw <= 0 || ch <= 0) return;

      const zoom = fillViewport && coarseRef.current ? MOBILE_ZOOM : 1;
      let W = Math.round(BASE_W / zoom);
      let H = Math.round(BASE_H / zoom);
      if (fillViewport && cw / ch < 1) {
        W = Math.round(PORTRAIT_W / zoom);
        H = Math.round(Math.max(BASE_H / zoom, Math.min(PORTRAIT_MAX_H / zoom, W / (cw / ch))));
      }
      const fit = Math.min(cw / W, ch / H);
      const cssW = Math.floor(W * fit);
      const cssH = Math.floor(H * fit);
      const left = Math.floor((cw - cssW) / 2);
      const top = Math.floor((ch - cssH) / 2);
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP[qualityRef.current]);
      const bw = Math.max(1, Math.round(cssW * dpr));
      const bh = Math.max(1, Math.round(cssH * dpr));
      if (canvas.width !== bw) canvas.width = bw;
      if (canvas.height !== bh) canvas.height = bh;
      stage.style.width = `${cssW}px`;
      stage.style.height = `${cssH}px`;
      stage.style.left = `${left}px`;
      stage.style.top = `${top}px`;

      const scale = bw / W;
      const prev = layoutRef.current;
      const worldChanged = prev.W !== W || prev.H !== H;
      layoutRef.current = { W, H, cssW, cssH, left, top, scale, bezelW: left };

      const e = engineRef.current!;
      if (worldChanged) {
        // Orientation change mid-game: pause so the player can re-grip, then rescale the world.
        if (gameStateRef.current === "playing") setPaused(true);
        e.setWorldSize(W, H);
      }
      const r = rendererRef.current;
      if (r) {
        r.setWorldSize(W, H);
        r.setScale(scale);
      }

      // Bezels (letterbox sides): low-res canvases, blurred by CSS
      for (const [bez, side] of [[leftBezelRef.current, "left"], [rightBezelRef.current, "right"]] as const) {
        if (!bez) continue;
        const visible = left > 2;
        bez.style.display = visible ? "block" : "none";
        if (!visible) continue;
        bez.style.width = `${left + 2}px`;
        bez.style.height = `${ch}px`;
        bez.style[side] = "0px";
        const lw = Math.max(1, Math.ceil(left / 6));
        const lh = Math.max(1, Math.ceil(ch / 6));
        if (bez.width !== lw) bez.width = lw;
        if (bez.height !== lh) bez.height = lh;
      }
    }, [fillViewport, setPaused]);

    // Pointer type can resolve after first layout (e.g. hydration); re-fit when it changes.
    useEffect(() => {
      applyLayout();
    }, [coarse, applyLayout]);

    useLayoutEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      applyLayout();
      const ro = new ResizeObserver(() => applyLayout());
      ro.observe(container);
      window.addEventListener("orientationchange", applyLayout);
      return () => {
        ro.disconnect();
        window.removeEventListener("orientationchange", applyLayout);
      };
    }, [applyLayout, isFullscreen]);

    // --- Renderer + background assets (one graded tile per tier, loaded on demand) ---
    const tierAssetsRef = useRef<{
      shared: Promise<{ detail: HTMLImageElement | null; mask: HTMLImageElement | null }> | null;
      scrollers: Map<string, Promise<BackgroundScroller>>;
      current: number;
    }>({ shared: null, scrollers: new Map(), current: -1 });

    const scrollerFor = useCallback((theme: TierTheme): Promise<BackgroundScroller> => {
      const assets = tierAssetsRef.current;
      const cached = assets.scrollers.get(theme.key);
      if (cached) return cached;
      if (!assets.shared) {
        assets.shared = Promise.all([loadImage("images/detailTile.webp").catch(() => null), loadImage("images/waterMask.png").catch(() => null)]).then(
          ([detail, mask]) => ({ detail, mask })
        );
      }
      const { W, H } = layoutRef.current;
      const p = Promise.all([loadImage(theme.tile).catch(() => loadImage("images/baseTile.webp")).catch(() => null), assets.shared]).then(([tile, { detail, mask }]) => {
        const s = tile
          ? new BackgroundScroller(W, H, tile, detail ?? undefined, mask ?? undefined, theme.shimmer)
          : new BackgroundScroller(W, H, createFallbackBaseTile());
        s.setSpeed(SCROLLER_SPEED);
        return s;
      });
      assets.scrollers.set(theme.key, p);
      return p;
    }, []);

    /** Show a tier's look; crossfades from the previous tier's background. Preloads the next tier. */
    const applyTier = useCallback(
      (index: number, crossfade: boolean) => {
        const assets = tierAssetsRef.current;
        if (assets.current === index) return;
        assets.current = index;
        const theme = TIERS[index].theme;
        scrollerFor(theme).then((sc) => {
          if (assets.current !== index) return;
          rendererRef.current?.setTheme(theme, sc, crossfade);
        });
        const next = TIERS[index + 1];
        if (next) scrollerFor(next.theme);
      },
      [scrollerFor]
    );
    applyTierRef.current = applyTier;

    useEffect(() => {
      const { W, H, scale } = layoutRef.current;
      const r = new Renderer(scale, W, H);
      rendererRef.current = r;
      const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
      reducedMotionRef.current = !!mq?.matches;
      tierAssetsRef.current.current = -1;
      applyTier(engineRef.current!.tierIndex >= 0 ? engineRef.current!.tierIndex : 0, false);
      return () => {
        r.sprites.dispose();
        rendererRef.current = null;
      };
    }, [applyTier]);

    // --- The one animation loop ---
    useEffect(() => {
      let raf = 0;
      let last = performance.now();
      let bezelFrame = 0;
      // Adaptive quality: rolling average of frame time while playing.
      let slowMs = 0;
      let avg = 16.7;

      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(250, now - last);
        last = now;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        const r = rendererRef.current;
        const e = engineRef.current!;
        if (!canvas || !ctx || !r) return;
        const st = gameStateRef.current;
        const active = st === "playing" || st === "countdown";
        const isPaused = pausedRef.current;

        if (active && !isPaused) e.advance(dt);
        else if (!active && st !== "level20_ending") e.advanceEffects(dt);

        // Paused / ending: keep the last frame on screen (saves battery).
        if ((active && isPaused) || st === "level20_ending") return;

        const { scale } = layoutRef.current;
        const q = qualityRef.current;
        ctx.setTransform(scale, 0, 0, scale, 0, 0);
        if (active && e.shake > 0 && !reducedMotionRef.current) {
          const k = (e.shake / 260) * e.shakeStrength;
          ctx.translate((Math.random() - 0.5) * 2 * k, (Math.random() - 0.5) * 2 * k);
        }
        const bgDt = st === "gameover" ? 0 : dt / 1000;
        const w = e.wind;
        r.renderBackground(ctx, bgDt, now, q, w && e.time >= w.start && active ? w.dir * w.strength : 0);
        if (active || st === "gameover") r.renderGame(ctx, e, q);
        r.haze.renderVignette(ctx);

        // Letterbox bezels: copy edge slices of this frame (every 3rd frame; they're blurred anyway)
        const lb = leftBezelRef.current;
        const rb = rightBezelRef.current;
        if (layoutRef.current.bezelW > 2 && lb && rb && ++bezelFrame % 3 === 0) {
          const slice = Math.round(100 * scale);
          const lctx = lb.getContext("2d");
          const rctx = rb.getContext("2d");
          lctx?.drawImage(canvas, 0, 0, slice, canvas.height, 0, 0, lb.width, lb.height);
          rctx?.drawImage(canvas, canvas.width - slice, 0, slice, canvas.height, 0, 0, rb.width, rb.height);
        }

        if (active) {
          avg = avg * 0.95 + dt * 0.05;
          slowMs = avg > 22 ? slowMs + dt : Math.max(0, slowMs - dt * 0.5);
          if (slowMs > 3000 && qualityRef.current < 2) {
            qualityRef.current = (qualityRef.current + 1) as Quality;
            slowMs = 0;
            avg = 16.7;
            try {
              localStorage.setItem(QUALITY_KEY, String(qualityRef.current));
            } catch {
              // ignore
            }
            applyLayout();
          }
        }
      };
      raf = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(raf);
    }, [applyLayout]);

    // --- Coordinate mapping ---
    const clientToWorld = useCallback((clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0) return null;
      const { W, H } = layoutRef.current;
      return {
        x: ((clientX - rect.left) / rect.width) * W,
        y: ((clientY - rect.top) / rect.height) * H,
        unitsPerCss: W / rect.width,
        inside: clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom,
      };
    }, []);

    const clientToGame = useCallback(
      (clientX: number, clientY: number) => {
        const w = clientToWorld(clientX, clientY);
        return w && w.inside ? { x: w.x, y: w.y } : null;
      },
      [clientToWorld]
    );

    // --- Touch: drag anywhere on the game area ---
    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      return attachDragControls(el, {
        engine: () => engineRef.current!,
        toWorld: clientToWorld,
        enabled: () => {
          const st = gameStateRef.current;
          return (st === "playing" || st === "countdown") && !pausedRef.current;
        },
        onStart: () => {
          unlockAudio();
          onSoundUnlockRef.current?.();
        },
      });
    }, [clientToWorld, unlockAudio]);

    // --- Keyboard ---
    useEffect(() => {
      const codeToKey: Record<string, string> = {
        KeyW: "w",
        KeyA: "a",
        KeyS: "s",
        KeyD: "d",
        ArrowUp: "ArrowUp",
        ArrowDown: "ArrowDown",
        ArrowLeft: "ArrowLeft",
        ArrowRight: "ArrowRight",
        Space: "space",
      };
      const keyOf = (e: KeyboardEvent) =>
        codeToKey[e.code] ?? (e.key === " " ? "space" : ["w", "a", "s", "d"].includes(e.key.toLowerCase()) ? e.key.toLowerCase() : e.key.startsWith("Arrow") ? e.key : null);
      const inField = () => {
        const a = document.activeElement;
        return a instanceof HTMLInputElement || a instanceof HTMLTextAreaElement;
      };
      const down = (e: KeyboardEvent) => {
        if (inField()) return;
        const st = gameStateRef.current;
        const active = st === "playing" || st === "countdown";
        if (active && (e.code === "KeyP" || e.code === "Escape")) {
          setPaused(!pausedRef.current);
          return;
        }
        if (active && pausedRef.current && (e.key === " " || e.key === "Enter")) {
          e.preventDefault();
          setPaused(false);
          return;
        }
        const k = keyOf(e);
        if (!k) return;
        if (active) e.preventDefault(); // no page scrolling while playing
        const eng = engineRef.current!;
        eng.autoFire = false;
        eng.setKey(k, true);
        if (!e.repeat) {
          unlockAudio();
          onSoundUnlockRef.current?.();
        }
      };
      const up = (e: KeyboardEvent) => {
        const k = keyOf(e);
        if (k) engineRef.current!.setKey(k, false);
      };
      const blur = () => {
        const eng = engineRef.current!;
        for (const k of Object.keys(eng.keys)) eng.setKey(k, false);
      };
      window.addEventListener("keydown", down);
      window.addEventListener("keyup", up);
      window.addEventListener("blur", blur);
      return () => {
        window.removeEventListener("keydown", down);
        window.removeEventListener("keyup", up);
        window.removeEventListener("blur", blur);
      };
    }, [setPaused, unlockAudio]);

    // Menu / gate / game over: Space or Enter
    useEffect(() => {
      if (gameState !== "menu" && gameState !== "gameover") return;
      const onKey = (e: KeyboardEvent) => {
        if (gameState === "menu") {
          if (e.key !== " " && e.key !== "Enter") return;
          if (document.activeElement instanceof HTMLInputElement) return;
          e.preventDefault();
          startGameRef.current();
          return;
        }
        if (e.key !== "Enter" || document.activeElement === nameInputRef.current) return;
        e.preventDefault();
        playSfx("ui_click");
        goToMenu();
        onReturnToMenu?.();
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [gameState, playSfx, goToMenu, onReturnToMenu]);

    // --- Imperative handle ---
    const handleKeyPress = useCallback(
      (key: string, pressed: boolean) => {
        if (pressed) {
          unlockAudio();
          onSoundUnlockRef.current?.();
        }
        const eng = engineRef.current!;
        if (key === "space") eng.autoFire = false;
        eng.setKey(key, pressed);
      },
      [unlockAudio]
    );

    const handleMove = useCallback(
      (dx: number, dy: number) => {
        if (dx !== 0 || dy !== 0) {
          unlockAudio();
          onSoundUnlockRef.current?.();
        }
        const eng = engineRef.current!;
        eng.dragTarget = null;
        eng.touchMove = dx === 0 && dy === 0 ? null : { dx, dy };
      },
      [unlockAudio]
    );

    useImperativeHandle(
      ref,
      () => ({
        handleKeyPress,
        handleMove,
        resetToMenu,
        showGameOverAfterEnding,
        getContainerElement: () => containerRef.current,
        setLevel: (n: number) => engineRef.current!.setLevel(n),
        spawnEntity: (x, y, type) => engineRef.current!.spawnEntity(x, y, type),
        clientToGame,
        pause: () => setPaused(true),
        resume: () => setPaused(false),
        toggleFullscreen,
      }),
      [handleKeyPress, handleMove, resetToMenu, showGameOverAfterEnding, clientToGame, setPaused, toggleFullscreen]
    );

    // --- Score submit ---
    const startNameErrorDismissTimer = useCallback(() => {
      if (nameErrorTimerRef.current) clearTimeout(nameErrorTimerRef.current);
      nameErrorTimerRef.current = setTimeout(() => {
        nameErrorTimerRef.current = null;
        setNameError("");
      }, 5000);
    }, []);
    useEffect(() => () => {
      if (nameErrorTimerRef.current) clearTimeout(nameErrorTimerRef.current);
    }, []);

    const handleSubmitScore = async () => {
      const trimmed = playerName.trim();
      const validation = validateName(trimmed);
      if (!validation.success) {
        setNameError(validation.error);
        startNameErrorDismissTimer();
        return;
      }
      setNameError("");
      if (nameErrorTimerRef.current) {
        clearTimeout(nameErrorTimerRef.current);
        nameErrorTimerRef.current = null;
      }
      playSfx("ui_click");
      try {
        await createScore.mutateAsync({ name: trimmed, score: hud.score, level: hud.level, device: isMobile ? "mobile" : "web" });
        goToMenu();
        onReturnToMenu?.();
      } catch (err) {
        setNameError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
        startNameErrorDismissTimer();
        console.error(err);
      }
    };

    // --- Render ---
    const isActive = gameState === "playing" || gameState === "countdown";
    const fixedLayout = fillViewport || isFullscreen;
    const isIOS = typeof navigator !== "undefined" && /iP(hone|od|ad)/.test(navigator.userAgent);
    const isStandalone =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
        window.matchMedia?.("(display-mode: fullscreen)").matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true);
    const showA2hsHint = gateOpen && isIOS && !isStandalone && !fullscreenSupported;

    return (
      <div
        ref={containerRef}
        className={
          fixedLayout
            ? "game-root game-root--fill fixed inset-0 z-40 overflow-hidden bg-gray-900"
            : "game-root game-canvas-container relative w-full max-w-[800px] mx-auto overflow-hidden rounded-2xl border-4 border-gray-900 bg-gray-900 shadow-2xl"
        }
        style={fixedLayout ? undefined : { aspectRatio: `${BASE_W} / ${BASE_H}` }}
      >
        <canvas ref={leftBezelRef} className="game-bezel absolute top-0" style={{ display: "none" }} aria-hidden />
        <canvas ref={rightBezelRef} className="game-bezel absolute top-0" style={{ display: "none" }} aria-hidden />

        <div ref={stageRef} className="game-stage absolute">
          <canvas
            ref={canvasRef}
            width={BASE_W}
            height={BASE_H}
            className={`block w-full h-full bg-orange-50 transition-[filter] duration-300 ${gameState === "menu" || gateOpen ? "game-canvas--blurred" : ""}`}
          />

          {isActive && (
            <div className="game-hud pointer-events-none absolute left-0 right-0 flex justify-between items-start">
              <div className="flex">
                <div className="game-hud-pill text-primary">{hud.boss ? "⚔️ BOSS" : `🥕 ${hud.carrots}/10`}</div>
                <div className="game-hud-pill text-red-500">❤️ {hud.lives === 10 ? "MAX" : hud.lives}</div>
                {hud.combo > 1 && (
                  <div key={hud.comboChain} className="game-hud-pill game-hud-combo" aria-label={`Combo times ${hud.combo}`}>
                    x{hud.combo}
                  </div>
                )}
              </div>
              <div className="flex">
                <div className="game-hud-pill">LEVEL {hud.level}</div>
                <div className="game-hud-pill text-blue-600">SCORE: {hud.score}</div>
              </div>
            </div>
          )}
        </div>

        {/* Controls (pause + host extras such as the play page's menu), below the HUD on the right */}
        <div className="game-controls absolute z-30 flex gap-2" data-no-drag>
          {isActive && !paused && (
            <Button
              {...({
                type: "button",
                variant: "outline",
                size: "icon",
                onClick: () => setPaused(true),
                className: "game-control-btn",
                "aria-label": "Pause",
                children: <Pause className="h-5 w-5" />,
              } as ButtonProps)}
            />
          )}
          {children}
        </div>
        {isActive && !paused && <GameBanner banner={banners.current} />}
        {!fillViewport && fullscreenSupported && (
          <Button
            {...({
              type: "button",
              variant: "outline",
              size: "icon",
              onClick: toggleFullscreen,
              onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
                if (e.key === " " || e.key === "Enter") e.preventDefault();
              },
              className: "game-fullscreen-btn absolute bottom-4 right-4 z-30 h-10 w-10 rounded-xl border-2 border-black bg-white/95 shadow-md hover:bg-orange-50",
              "aria-label": isFullscreen ? "Exit fullscreen" : "Enter fullscreen",
              children: isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />,
            } as ButtonProps)}
          />
        )}
        <AnimatePresence>
          {gateOpen && (
            <motion.button
              key="gate"
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleGateTap}
              className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/40 text-white select-none"
              aria-label="Tap to start"
            >
              <span className="text-6xl tracking-wide drop-shadow-[0_4px_0_rgba(0,0,0,0.6)]" style={{ fontFamily: "var(--font-display)" }}>🥕 Carrot Roll</span>
              <span className="text-3xl animate-pulse" style={{ fontFamily: "var(--font-display)" }}>{coarse ? "Tap to start" : "Click or press Space"}</span>
              {coarse && (
                <span className="max-w-xs px-6 text-center text-base font-medium text-white/85">
                  Drag anywhere to fly. Blasters fire on their own.
                </span>
              )}
              {showA2hsHint && (
                <span className="max-w-xs px-6 text-center text-sm text-white/70">
                  Tip: Share → <b>Add to Home Screen</b> to play full screen.
                </span>
              )}
            </motion.button>
          )}

          {paused && isActive && (
            <motion.div
              key="paused"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 p-6"
              data-no-drag
            >
              <div className="rounded-3xl border-4 border-black bg-white p-8 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <h2 className="mb-6 font-display text-5xl text-gray-900">PAUSED</h2>
                <Button
                  onClick={() => setPaused(false)}
                  className="h-14 w-full gap-2 border-b-4 border-orange-800 bg-primary font-display text-2xl hover:bg-orange-600"
                >
                  <PlayIcon className="h-6 w-6" /> Resume
                </Button>
                {onReturnToMenu && (
                  <Button
                    {...({
                      variant: "ghost",
                      onClick: () => {
                        playSfx("ui_click");
                        goToMenu();
                        onReturnToMenu();
                      },
                      className: "mt-3 w-full font-bold text-gray-500 hover:text-black",
                      children: "Quit to Menu",
                    } as ButtonProps)}
                  />
                )}
              </div>
            </motion.div>
          )}

          {gameState === "menu" && !gateOpen && (
            <motion.div
              key="menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 p-8"
            >
              <StartMenuCard onStartClick={startGame} />
            </motion.div>
          )}

          {gameState === "gameover" && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4"
            >
              <div className="gameover-card w-full max-w-md rounded-3xl border-4 border-black bg-white p-8 text-center shadow-[8px_8px_0px_0px_rgba(255,0,0,1)]">
                <h2 className="mb-4 font-display text-5xl text-red-500 text-shadow-lg">GAME OVER</h2>
                <div className="mb-6 rounded-xl border-2 border-gray-200 bg-gray-100 p-6">
                  <div className="mb-2 flex items-end justify-between border-b-2 border-gray-200 pb-2">
                    <span className="text-xs font-bold uppercase text-gray-500">Final Score</span>
                    <span className="font-display text-4xl text-primary">{hud.score}</span>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-xs font-bold uppercase text-gray-500">Level Reached</span>
                    <span className="font-display text-2xl text-blue-500">{hud.level}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="relative">
                    {nameError && (
                      <div
                        id="name-error"
                        role="alert"
                        aria-live="polite"
                        className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700 shadow-lg"
                      >
                        {nameError}
                      </div>
                    )}
                    <Input
                      ref={nameInputRef}
                      placeholder="Enter Name"
                      value={playerName}
                      onChange={(e) => {
                        setPlayerName(e.target.value);
                        if (nameError) {
                          setNameError("");
                          if (nameErrorTimerRef.current) {
                            clearTimeout(nameErrorTimerRef.current);
                            nameErrorTimerRef.current = null;
                          }
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleSubmitScore();
                        }
                      }}
                      className="h-12 border-2 border-black text-center font-display text-xl focus-visible:ring-primary"
                      maxLength={10}
                      aria-invalid={!!nameError}
                      aria-describedby={nameError ? "name-error" : undefined}
                    />
                  </div>
                  <Button
                    onClick={handleSubmitScore}
                    disabled={createScore.isPending || !playerName.trim()}
                    className="h-14 w-full border-b-4 border-orange-800 bg-primary font-display text-xl hover:bg-orange-600 active:translate-y-1 active:border-b-0"
                  >
                    {createScore.isPending ? <Loader2 className="animate-spin" /> : "Submit Score"}
                  </Button>
                  <Button
                    {...({
                      variant: "ghost",
                      onClick: () => {
                        playSfx("ui_click");
                        goToMenu();
                        onReturnToMenu?.();
                      },
                      className: "w-full font-bold text-gray-500 hover:text-black",
                      children: "Back to Menu",
                    } as ButtonProps)}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

GameCanvas.displayName = "GameCanvas";

export default GameCanvas;
