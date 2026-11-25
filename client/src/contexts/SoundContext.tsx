/**
 * Sound engine.
 *
 * One shared AudioContext with a small mixing graph:
 *
 *   music <audio> element ─► fade gain ─► music gain ─┐
 *   SFX AudioBufferSources ─────────────► sfx gain  ───┼─► master gain ─► destination
 *   ambient loop AudioBufferSources ─────► ambient gain ┘
 *
 * Mute and every volume slider only change GainNode values. That matters on iOS, where
 * HTMLMediaElement.volume is ignored, so the old `el.volume = …` approach never muted music there.
 * Music stays a streamed <audio> element (AAC .m4a; WebKit applies Web Audio gain to AAC sources)
 * and there is exactly one of it, so once a tap has unlocked it, later track changes (game over,
 * golden bunny, the level-20 ending) keep playing on mobile without needing another gesture.
 *
 * All exported callbacks are stable (empty deps) and read settings from refs, so the game loop can
 * hold on to them without ever seeing stale volume or mute values.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEYS = {
  muted: "carrotroll_muted",
  master: "carrotroll_volume_master",
  music: "carrotroll_volume_music",
  sfx: "carrotroll_volume_sfx",
} as const;

function loadNumber(key: string, fallback: number): number {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 1 ? n : fallback;
  } catch {
    return fallback;
  }
}

function loadBool(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    if (v == null) return fallback;
    return v === "true";
  } catch {
    return fallback;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage unavailable (private mode etc.)
  }
}

const BASE = import.meta.env.BASE_URL || "/";
const soundUrl = (file: string) => `${BASE}sounds/${file}`.replace(/\/+/g, "/");

export type MusicState = "menu" | "playing" | "gameover";

export type SfxId =
  | "start"
  | "carrot_collect"
  | "level_up"
  | "powerup_heart"
  | "powerup_shield"
  | "powerup_speed"
  | "powerup_attract"
  | "hit_damage"
  | "shield_deflect"
  | "ball_explode"
  | "death"
  | "carrot_shoot"
  | "blaster_shoot"
  | "ui_click";

/** Gapless looping beds. `golden_bunny_loop` is a full music track, handled as a music override. */
export type AmbientId = "rapid_rabbit_loop" | "attract_loop" | "golden_bunny_loop" | "static_endgame";
type BufferAmbientId = Exclude<AmbientId, "golden_bunny_loop">;

const SFX_FILES: Record<SfxId, string> = {
  start: "start.wav",
  carrot_collect: "carrot_collect.wav",
  level_up: "level_up.wav",
  powerup_heart: "powerup_heart.wav",
  powerup_shield: "powerup_shield.wav",
  powerup_speed: "powerup_speed.wav",
  powerup_attract: "powerup_attract.wav",
  hit_damage: "hit_damage.wav",
  shield_deflect: "shield_deflect.wav",
  ball_explode: "ball_explode.wav",
  death: "death.wav",
  carrot_shoot: "carrot_shoot.wav",
  blaster_shoot: "blaster_shoot.wav",
  ui_click: "ui_click.wav",
};

const AMBIENT_FILES: Record<BufferAmbientId, string> = {
  rapid_rabbit_loop: "rapid_rabbit_loop.wav",
  attract_loop: "attract_loop.wav",
  static_endgame: "static_endgame.m4a",
};

/** Loops decoded during the title-screen preload (the endgame static is decoded on demand). */
const PRELOAD_AMBIENT: BufferAmbientId[] = ["rapid_rabbit_loop", "attract_loop"];

const MUSIC_FILES: Record<Exclude<MusicState, "playing">, string> = {
  menu: "music_menu.m4a",
  // No dedicated game-over track exists yet (the old demo file was a placeholder beep loop).
  gameover: "music_menu.m4a",
};

/** In-game music tracks, played in order; after the last, playback wraps to the first. */
const INGAME_MUSIC_FILES: string[] = [
  "music_ingame01.m4a",
  "music_ingame02.m4a",
  "music_ingame03.m4a",
  "music_ingame04.m4a",
];

const GOLDEN_BUNNY_FILE = "golden_bunny.m4a";

/** Number of files preloadSfx decodes (used for the title-screen progress bar). */
export const SFX_PRECACHE_COUNT = Object.keys(SFX_FILES).length + PRELOAD_AMBIENT.length;

/** Minimum ms between two plays of the same SFX (stops machine-gun stacking when many hit at once). */
const SFX_THROTTLE_MS: Partial<Record<SfxId, number>> = {
  carrot_shoot: 300,
  shield_deflect: 120,
  ball_explode: 40,
  carrot_collect: 30,
  blaster_shoot: 60,
};
const MAX_VOICES_PER_SFX = 4;
const MAX_VOICES_TOTAL = 16;

const MUSIC_FADE_S = 0.25;

type CustomMusicOptions = { loop?: boolean; onEnded?: () => void; volume?: number };

interface SoundContextValue {
  muted: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  setMuted: (v: boolean) => void;
  setMasterVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  /** Call from a user gesture (tap / key) so audio can start on mobile. Safe to call repeatedly. */
  unlockAudio: () => void;
  /** Fetch + decode all SFX and short loops into memory (title screen). */
  preloadSfx: (onProgress?: (loaded: number, total: number) => void) => Promise<void>;
  playSfx: (id: SfxId) => void;
  playAmbient: (id: AmbientId) => void;
  stopAmbient: (id: AmbientId) => void;
  /** Set a buffered ambient loop's own volume (0–1), ramped over `rampS` seconds. */
  setAmbientVolume: (id: AmbientId, v: number, rampS?: number) => void;
  setMusicState: (state: MusicState) => void;
  /** Play an arbitrary track (e.g. the level-20 ending) on the shared, already-unlocked music element. */
  playCustomMusic: (file: string, opts?: CustomMusicOptions) => void;
  stopMusic: () => void;
  /** Pause in-game music without resetting position (resumeMusic continues the same track). */
  pauseMusic: () => void;
  resumeMusic: () => void;
  isMusicPlaying: boolean;
}

const SoundContext = createContext<SoundContextValue | null>(null);

type AudioCtor = typeof AudioContext;
function getAudioCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext ||
    null
  );
}

type Graph = {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  musicFade: GainNode;
  sfx: GainNode;
  ambient: GainNode;
};

type ActiveLoop = { src: AudioBufferSourceNode; gain: GainNode };

export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMutedState] = useState(() => loadBool(STORAGE_KEYS.muted, false));
  const [masterVolume, setMasterVolumeState] = useState(() => loadNumber(STORAGE_KEYS.master, 0.8));
  const [musicVolume, setMusicVolumeState] = useState(() => loadNumber(STORAGE_KEYS.music, 1));
  const [sfxVolume, setSfxVolumeState] = useState(() => loadNumber(STORAGE_KEYS.sfx, 0.9));
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  // Live settings for the stable callbacks.
  const settingsRef = useRef({ muted, masterVolume, musicVolume, sfxVolume });
  settingsRef.current = { muted, masterVolume, musicVolume, sfxVolume };

  const graphRef = useRef<Graph | null>(null);
  const graphFailedRef = useRef(false);
  const buffersRef = useRef<Partial<Record<SfxId | BufferAmbientId, AudioBuffer>>>({});
  const loadingRef = useRef<Partial<Record<SfxId | BufferAmbientId, Promise<AudioBuffer | null>>>>({});
  const voicesRef = useRef<{ total: number; perId: Partial<Record<SfxId, number>> }>({ total: 0, perId: {} });
  const lastPlayedRef = useRef<Partial<Record<SfxId, number>>>({});
  const loopsRef = useRef<Partial<Record<BufferAmbientId, ActiveLoop>>>({});
  /** Requested per-loop volume ramps, kept so a loop that finishes decoding late still ramps correctly. */
  const loopVolumeRef = useRef<Partial<Record<BufferAmbientId, { from: number; to: number; startMs: number; durMs: number }>>>({});

  // Music
  const musicElRef = useRef<HTMLAudioElement | null>(null);
  const musicRoutedRef = useRef(false);
  const musicStateRef = useRef<MusicState | "custom" | null>(null);
  const ingameIndexRef = useRef(0);
  const customOnEndedRef = useRef<(() => void) | null>(null);
  const customVolumeRef = useRef(1);
  /** True while music should be audible (cleared by stop/pause); drives retry-on-gesture and tab resume. */
  const musicWantedRef = useRef(false);
  const musicPausedRef = useRef(false);
  /** Golden-bunny override: remembers the in-game track to return to. */
  const overrideRef = useRef<{ src: string; time: number; index: number } | null>(null);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hiddenRef = useRef(false);

  // --- Persistence ---
  useEffect(() => save(STORAGE_KEYS.muted, muted ? "true" : "false"), [muted]);
  useEffect(() => save(STORAGE_KEYS.master, String(masterVolume)), [masterVolume]);
  useEffect(() => save(STORAGE_KEYS.music, String(musicVolume)), [musicVolume]);
  useEffect(() => save(STORAGE_KEYS.sfx, String(sfxVolume)), [sfxVolume]);

  const setMuted = useCallback((v: boolean) => setMutedState(v), []);
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
  const setMasterVolume = useCallback((v: number) => setMasterVolumeState(clamp01(v)), []);
  const setMusicVolume = useCallback((v: number) => setMusicVolumeState(clamp01(v)), []);
  const setSfxVolume = useCallback((v: number) => setSfxVolumeState(clamp01(v)), []);

  // --- Graph ---
  const applyGains = useCallback((g: Graph, rampS = 0.05) => {
    const s = settingsRef.current;
    const t = g.ctx.currentTime;
    const set = (node: GainNode, v: number) => {
      node.gain.cancelScheduledValues(t);
      node.gain.setTargetAtTime(v, t, rampS / 3);
    };
    set(g.master, s.muted ? 0 : s.masterVolume);
    set(g.music, s.musicVolume * customVolumeRef.current);
    set(g.sfx, s.sfxVolume);
    set(g.ambient, s.sfxVolume);
  }, []);

  /** Fallback for browsers without Web Audio: element volume (works everywhere except iOS) plus muted. */
  const applyElementVolume = useCallback(() => {
    const el = musicElRef.current;
    if (!el || musicRoutedRef.current) return;
    const s = settingsRef.current;
    const v = s.masterVolume * s.musicVolume * customVolumeRef.current;
    el.muted = s.muted || v <= 0;
    try {
      el.volume = clamp01(v);
    } catch {
      // ignore
    }
  }, []);

  const routeMusicElement = useCallback(() => {
    const g = graphRef.current;
    const el = musicElRef.current;
    if (!g || !el || musicRoutedRef.current) return;
    try {
      const node = g.ctx.createMediaElementSource(el);
      node.connect(g.musicFade);
      musicRoutedRef.current = true;
      el.volume = 1;
      el.muted = false;
    } catch {
      // Already routed or unsupported: keep element-volume fallback.
    }
  }, []);

  const ensureGraph = useCallback((): Graph | null => {
    if (graphRef.current) return graphRef.current;
    if (graphFailedRef.current) return null;
    const Ctor = getAudioCtor();
    if (!Ctor) {
      graphFailedRef.current = true;
      return null;
    }
    try {
      const ctx = new Ctor({ latencyHint: "interactive" });
      const master = ctx.createGain();
      const music = ctx.createGain();
      const musicFade = ctx.createGain();
      const sfx = ctx.createGain();
      const ambient = ctx.createGain();
      musicFade.connect(music);
      music.connect(master);
      sfx.connect(master);
      ambient.connect(master);
      master.connect(ctx.destination);
      const g: Graph = { ctx, master, music, musicFade, sfx, ambient };
      graphRef.current = g;
      applyGains(g, 0);
      routeMusicElement();
      return g;
    } catch {
      graphFailedRef.current = true;
      return null;
    }
  }, [applyGains, routeMusicElement]);

  // React to slider / mute changes.
  useEffect(() => {
    const g = graphRef.current;
    if (g) applyGains(g);
    applyElementVolume();
  }, [muted, masterVolume, musicVolume, sfxVolume, applyGains, applyElementVolume]);

  // --- Music element ---
  const getMusicEl = useCallback((): HTMLAudioElement => {
    if (musicElRef.current) return musicElRef.current;
    const el = new Audio();
    el.preload = "auto";
    el.setAttribute("playsinline", "");
    el.addEventListener("play", () => setIsMusicPlaying(true));
    el.addEventListener("pause", () => setIsMusicPlaying(false));
    el.addEventListener("ended", () => {
      setIsMusicPlaying(false);
      const state = musicStateRef.current;
      if (state === "playing" && !overrideRef.current && INGAME_MUSIC_FILES.length > 0) {
        ingameIndexRef.current = (ingameIndexRef.current + 1) % INGAME_MUSIC_FILES.length;
        el.src = soundUrl(INGAME_MUSIC_FILES[ingameIndexRef.current]);
        el.play().catch(() => {});
      } else if (state === "custom") {
        const cb = customOnEndedRef.current;
        customOnEndedRef.current = null;
        musicWantedRef.current = false;
        cb?.();
      }
    });
    musicElRef.current = el;
    routeMusicElement();
    applyElementVolume();
    return el;
  }, [routeMusicElement, applyElementVolume]);

  const tryPlayMusic = useCallback(() => {
    const el = musicElRef.current;
    if (!el || !musicWantedRef.current || hiddenRef.current) return;
    if (!el.paused) return;
    el.play().catch(() => {
      // Autoplay blocked: the next user gesture (global unlock listener) retries.
    });
  }, []);

  /** Swap the music element to `src`, fading out/in through the fade gain when Web Audio is active. */
  const switchTrack = useCallback(
    (src: string, opts: { loop: boolean; startAt?: number }) => {
      const el = getMusicEl();
      const g = graphRef.current;
      musicWantedRef.current = true;
      musicPausedRef.current = false;
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);

      const begin = () => {
        switchTimerRef.current = null;
        el.loop = opts.loop;
        if (!el.src.endsWith(src)) el.src = src;
        if (opts.startAt != null) {
          const seek = () => {
            try {
              el.currentTime = opts.startAt!;
            } catch {
              // ignore
            }
          };
          if (el.readyState >= 1) seek();
          else el.addEventListener("loadedmetadata", seek, { once: true });
        } else {
          try {
            el.currentTime = 0;
          } catch {
            // ignore
          }
        }
        if (g) {
          const t = g.ctx.currentTime;
          g.musicFade.gain.cancelScheduledValues(t);
          g.musicFade.gain.setValueAtTime(0, t);
          g.musicFade.gain.linearRampToValueAtTime(1, t + MUSIC_FADE_S);
        }
        tryPlayMusic();
      };

      if (g && !el.paused) {
        const t = g.ctx.currentTime;
        g.musicFade.gain.cancelScheduledValues(t);
        g.musicFade.gain.setValueAtTime(g.musicFade.gain.value, t);
        g.musicFade.gain.linearRampToValueAtTime(0, t + MUSIC_FADE_S);
        switchTimerRef.current = setTimeout(begin, MUSIC_FADE_S * 1000);
      } else {
        begin();
      }
    },
    [getMusicEl, tryPlayMusic]
  );

  const setMusicState = useCallback(
    (state: MusicState) => {
      if (musicStateRef.current === state && musicWantedRef.current) return;
      musicStateRef.current = state;
      overrideRef.current = null;
      customVolumeRef.current = 1;
      if (graphRef.current) applyGains(graphRef.current);
      applyElementVolume();
      if (state === "playing") {
        ingameIndexRef.current = 0;
        if (INGAME_MUSIC_FILES.length === 0) return;
        switchTrack(soundUrl(INGAME_MUSIC_FILES[0]), { loop: false });
        return;
      }
      switchTrack(soundUrl(MUSIC_FILES[state]), { loop: true });
    },
    [switchTrack, applyGains, applyElementVolume]
  );

  const playCustomMusic = useCallback(
    (file: string, opts: CustomMusicOptions = {}) => {
      musicStateRef.current = "custom";
      overrideRef.current = null;
      customOnEndedRef.current = opts.onEnded ?? null;
      customVolumeRef.current = opts.volume ?? 1;
      if (graphRef.current) applyGains(graphRef.current);
      applyElementVolume();
      switchTrack(soundUrl(file), { loop: !!opts.loop });
    },
    [switchTrack, applyGains, applyElementVolume]
  );

  const stopMusic = useCallback(() => {
    musicWantedRef.current = false;
    musicPausedRef.current = false;
    if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    const el = musicElRef.current;
    if (el) {
      el.pause();
      try {
        el.currentTime = 0;
      } catch {
        // ignore
      }
    }
  }, []);

  const pauseMusic = useCallback(() => {
    const el = musicElRef.current;
    if (!el) return;
    musicWantedRef.current = false;
    musicPausedRef.current = true;
    el.pause();
  }, []);

  const resumeMusic = useCallback(() => {
    const el = musicElRef.current;
    // Already set to play (e.g. golden bunny just handed back to the in-game track): don't restart.
    if (musicWantedRef.current && el && el.src) {
      tryPlayMusic();
      return;
    }
    if (musicPausedRef.current && el && el.src) {
      musicPausedRef.current = false;
      musicWantedRef.current = true;
      tryPlayMusic();
      return;
    }
    const last = musicStateRef.current;
    musicStateRef.current = null;
    setMusicState(last && last !== "custom" ? last : "menu");
  }, [setMusicState, tryPlayMusic]);

  /** Golden bunny: temporarily replace the in-game track, remembering where to come back to. */
  const startGoldenBunny = useCallback(() => {
    if (overrideRef.current) return;
    const el = getMusicEl();
    overrideRef.current = { src: el.src, time: el.currentTime || 0, index: ingameIndexRef.current };
    switchTrack(soundUrl(GOLDEN_BUNNY_FILE), { loop: true });
  }, [getMusicEl, switchTrack]);

  const stopGoldenBunny = useCallback(() => {
    const o = overrideRef.current;
    if (!o) return;
    overrideRef.current = null;
    if (musicStateRef.current !== "playing" || !o.src) return;
    ingameIndexRef.current = o.index;
    switchTrack(o.src, { loop: false, startAt: o.time });
  }, [switchTrack]);

  // --- Buffers ---
  const loadBuffer = useCallback(
    (id: SfxId | BufferAmbientId, file: string): Promise<AudioBuffer | null> => {
      const cached = buffersRef.current[id];
      if (cached) return Promise.resolve(cached);
      const pending = loadingRef.current[id];
      if (pending) return pending;
      const g = ensureGraph();
      if (!g) return Promise.resolve(null);
      const p = fetch(soundUrl(file))
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then(
          (ab) =>
            // Callback form for older Safari, which lacks the promise-returning decodeAudioData.
            new Promise<AudioBuffer>((resolve, reject) => g.ctx.decodeAudioData(ab, resolve, reject))
        )
        .then((buf) => {
          buffersRef.current[id] = buf;
          return buf;
        })
        .catch(() => null)
        .finally(() => {
          delete loadingRef.current[id];
        });
      loadingRef.current[id] = p;
      return p;
    },
    [ensureGraph]
  );

  const preloadSfx = useCallback(
    async (onProgress?: (loaded: number, total: number) => void) => {
      const jobs: [SfxId | BufferAmbientId, string][] = [
        ...(Object.keys(SFX_FILES) as SfxId[]).map((id) => [id, SFX_FILES[id]] as [SfxId, string]),
        ...PRELOAD_AMBIENT.map((id) => [id, AMBIENT_FILES[id]] as [BufferAmbientId, string]),
      ];
      const total = jobs.length;
      let loaded = 0;
      await Promise.all(
        jobs.map(([id, file]) =>
          loadBuffer(id, file).then(() => {
            loaded += 1;
            onProgress?.(loaded, total);
          })
        )
      );
    },
    [loadBuffer]
  );

  // --- Unlock / lifecycle ---
  const unlockAudio = useCallback(() => {
    const g = ensureGraph();
    getMusicEl();
    if (g && g.ctx.state !== "running" && !hiddenRef.current) {
      g.ctx.resume().catch(() => {});
    }
    tryPlayMusic();
  }, [ensureGraph, getMusicEl, tryPlayMusic]);

  useEffect(() => {
    // Any gesture unlocks audio, retries blocked music, and recovers iOS "interrupted" contexts.
    const onGesture = () => unlockAudio();
    const opts = { capture: true, passive: true } as const;
    window.addEventListener("pointerdown", onGesture, opts);
    window.addEventListener("touchend", onGesture, opts);
    window.addEventListener("keydown", onGesture, opts);

    const onVisibility = () => {
      const hidden = document.visibilityState === "hidden";
      hiddenRef.current = hidden;
      const g = graphRef.current;
      const el = musicElRef.current;
      if (hidden) {
        g?.ctx.suspend().catch(() => {});
        el?.pause();
      } else {
        if (g && g.ctx.state !== "running") g.ctx.resume().catch(() => {});
        tryPlayMusic();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", onGesture, opts);
      window.removeEventListener("touchend", onGesture, opts);
      window.removeEventListener("keydown", onGesture, opts);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onVisibility);
    };
  }, [unlockAudio, tryPlayMusic]);

  // --- SFX ---
  const playSfx = useCallback(
    (id: SfxId) => {
      const s = settingsRef.current;
      if (s.muted || s.masterVolume * s.sfxVolume <= 0) return;
      const now = performance.now();
      const throttle = SFX_THROTTLE_MS[id];
      if (throttle != null && now - (lastPlayedRef.current[id] ?? -Infinity) < throttle) return;

      const g = ensureGraph();
      if (!g) {
        // No Web Audio at all: best-effort HTML audio.
        lastPlayedRef.current[id] = now;
        try {
          const a = new Audio(soundUrl(SFX_FILES[id]));
          a.volume = clamp01(s.masterVolume * s.sfxVolume);
          a.play().catch(() => {});
        } catch {
          // ignore
        }
        return;
      }
      if (g.ctx.state !== "running") g.ctx.resume().catch(() => {});

      const voices = voicesRef.current;
      if (voices.total >= MAX_VOICES_TOTAL || (voices.perId[id] ?? 0) >= MAX_VOICES_PER_SFX) return;

      const start = (buf: AudioBuffer) => {
        try {
          const src = g.ctx.createBufferSource();
          src.buffer = buf;
          src.connect(g.sfx);
          voices.total += 1;
          voices.perId[id] = (voices.perId[id] ?? 0) + 1;
          src.onended = () => {
            voices.total = Math.max(0, voices.total - 1);
            voices.perId[id] = Math.max(0, (voices.perId[id] ?? 1) - 1);
            src.disconnect();
          };
          src.start();
        } catch {
          // ignore
        }
      };

      lastPlayedRef.current[id] = now;
      const buf = buffersRef.current[id];
      if (buf) start(buf);
      else loadBuffer(id, SFX_FILES[id]).then((b) => b && start(b));
    },
    [ensureGraph, loadBuffer]
  );

  // --- Ambient loops ---
  const playAmbient = useCallback(
    (id: AmbientId) => {
      if (id === "golden_bunny_loop") {
        startGoldenBunny();
        return;
      }
      if (loopsRef.current[id]) return;
      const g = ensureGraph();
      if (!g) return;
      const startLoop = (buf: AudioBuffer) => {
        if (loopsRef.current[id]) return;
        const gain = g.ctx.createGain();
        const ramp = loopVolumeRef.current[id];
        if (ramp) {
          const p = ramp.durMs > 0 ? Math.min(1, (performance.now() - ramp.startMs) / ramp.durMs) : 1;
          const t = g.ctx.currentTime;
          gain.gain.setValueAtTime(ramp.from + (ramp.to - ramp.from) * p, t);
          if (p < 1) gain.gain.linearRampToValueAtTime(ramp.to, t + ((1 - p) * ramp.durMs) / 1000);
        }
        gain.connect(g.ambient);
        const src = g.ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(gain);
        src.start();
        loopsRef.current[id] = { src, gain };
      };
      const buf = buffersRef.current[id];
      if (buf) startLoop(buf);
      else loadBuffer(id, AMBIENT_FILES[id]).then((b) => b && startLoop(b));
    },
    [ensureGraph, loadBuffer, startGoldenBunny]
  );

  const stopAmbient = useCallback(
    (id: AmbientId) => {
      if (id === "golden_bunny_loop") {
        stopGoldenBunny();
        return;
      }
      const loop = loopsRef.current[id];
      delete loopVolumeRef.current[id];
      if (!loop) return;
      delete loopsRef.current[id];
      const g = graphRef.current;
      try {
        if (g) {
          const t = g.ctx.currentTime;
          loop.gain.gain.setTargetAtTime(0, t, 0.03);
          loop.src.stop(t + 0.15);
        } else {
          loop.src.stop();
        }
      } catch {
        // ignore
      }
    },
    [stopGoldenBunny]
  );

  const setAmbientVolume = useCallback((id: AmbientId, v: number, rampS = 0.05) => {
    if (id === "golden_bunny_loop") return;
    const loop = loopsRef.current[id];
    const g = graphRef.current;
    const prev = loopVolumeRef.current[id];
    const from = loop && g ? loop.gain.gain.value : prev ? prev.to : clamp01(v);
    loopVolumeRef.current[id] = { from, to: clamp01(v), startMs: performance.now(), durMs: rampS * 1000 };
    if (!loop || !g) return;
    const t = g.ctx.currentTime;
    loop.gain.gain.cancelScheduledValues(t);
    loop.gain.gain.setValueAtTime(loop.gain.gain.value, t);
    loop.gain.gain.linearRampToValueAtTime(clamp01(v), t + Math.max(0.01, rampS));
  }, []);

  // Dev hook for automated checks (gain values, context state).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __sound?: unknown }).__sound = {
      graph: () => graphRef.current,
      music: () => musicElRef.current,
      loops: () => Object.keys(loopsRef.current),
      buffers: () => Object.keys(buffersRef.current),
    };
  }, []);

  const value = useMemo<SoundContextValue>(
    () => ({
      muted,
      masterVolume,
      musicVolume,
      sfxVolume,
      setMuted,
      setMasterVolume,
      setMusicVolume,
      setSfxVolume,
      unlockAudio,
      preloadSfx,
      playSfx,
      playAmbient,
      stopAmbient,
      setAmbientVolume,
      setMusicState,
      playCustomMusic,
      stopMusic,
      pauseMusic,
      resumeMusic,
      isMusicPlaying,
    }),
    [
      muted,
      masterVolume,
      musicVolume,
      sfxVolume,
      setMuted,
      setMasterVolume,
      setMusicVolume,
      setSfxVolume,
      unlockAudio,
      preloadSfx,
      playSfx,
      playAmbient,
      stopAmbient,
      setAmbientVolume,
      setMusicState,
      playCustomMusic,
      stopMusic,
      pauseMusic,
      resumeMusic,
      isMusicPlaying,
    ]
  );

  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error("useSound must be used within SoundProvider");
  return ctx;
}
