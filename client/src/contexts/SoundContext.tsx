import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

function saveNumber(key: string, value: number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {}
}

function saveBool(key: string, value: boolean) {
  try {
    localStorage.setItem(key, value ? "true" : "false");
  } catch {}
}

const BASE = import.meta.env.BASE_URL || "/";

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
  | "ui_click"
  | "golden_bunny";

export type AmbientId = "rapid_rabbit_loop" | "attract_loop" | "golden_bunny_loop";

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
  golden_bunny: "golden_bunny.wav",
};

export const SFX_PRECACHE_COUNT = (Object.keys(SFX_FILES) as SfxId[]).length;

const SFX_CACHE_NAME = "carrotroll-sfx";

const AMBIENT_FILES: Record<AmbientId, string> = {
  rapid_rabbit_loop: "rapid_rabbit_loop.wav",
  attract_loop: "attract_loop.wav",
  golden_bunny_loop: "golden_bunny.wav",
};

const MUSIC_FILES: Record<MusicState, string> = {
  menu: "music_menu.wav",
  playing: "music_ingame.wav", // not used; in-game uses INGAME_MUSIC_FILES
  gameover: "music_gameover.wav",
};

/** In-game music tracks, played in order; after the last, playback wraps to the first. Add more as needed (e.g. music_ingame05.wav). */
const INGAME_MUSIC_FILES: string[] = [
  "music_ingame01.wav",
  "music_ingame02.wav",
  "music_ingame03.wav",
  "music_ingame04.wav",
];

interface SoundContextValue {
  muted: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  setMuted: (v: boolean) => void;
  setMasterVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  /** Call on first user gesture (e.g. tap Start) so in-game SFX work on mobile. */
  unlockAudio: () => void;
  /** Preload all SFX (fetch, cache in Cache API + decode into memory) during title screen. */
  preloadSfx: (onProgress?: (loaded: number, total: number) => void) => Promise<void>;
  playSfx: (id: SfxId) => void;
  playAmbient: (id: AmbientId) => void;
  stopAmbient: (id: AmbientId) => void;
  setMusicState: (state: MusicState) => void;
  stopMusic: () => void;
  /** Pause in-game music without resetting position (so resumeMusic can continue from same track). */
  pauseMusic: () => void;
  resumeMusic: () => void;
  isMusicPlaying: boolean;
}

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMutedState] = useState(() => loadBool(STORAGE_KEYS.muted, false));
  const [masterVolume, setMasterVolumeState] = useState(() =>
    loadNumber(STORAGE_KEYS.master, 0.8)
  );
  const [musicVolume, setMusicVolumeState] = useState(() =>
    loadNumber(STORAGE_KEYS.music, 1)
  );
  const [sfxVolume, setSfxVolumeState] = useState(() =>
    loadNumber(STORAGE_KEYS.sfx, 0.9)
  );

  const musicRef = useRef<HTMLAudioElement | null>(null);
  const musicStateRef = useRef<MusicState | null>(null);
  const musicPausedRef = useRef(false);
  const ingameMusicIndexRef = useRef(0);
  const musicEndedAttachedRef = useRef(false);
  const lastCarrotShootRef = useRef(0);
  const ambientRef = useRef<Partial<Record<AmbientId, HTMLAudioElement>>>({});
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);

  // Web Audio API: unlock on first user gesture so in-game SFX play on mobile
  const audioContextRef = useRef<AudioContext | null>(null);
  const unlockedRef = useRef(false);
  const bufferCacheRef = useRef<Partial<Record<SfxId, AudioBuffer>>>({});
  const sfxGainRef = useRef<GainNode | null>(null);
  const unlockAudioRef = useRef<() => void>(() => {});

  useEffect(() => {
    saveBool(STORAGE_KEYS.muted, muted);
  }, [muted]);
  useEffect(() => {
    saveNumber(STORAGE_KEYS.master, masterVolume);
  }, [masterVolume]);
  useEffect(() => {
    saveNumber(STORAGE_KEYS.music, musicVolume);
  }, [musicVolume]);
  useEffect(() => {
    saveNumber(STORAGE_KEYS.sfx, sfxVolume);
  }, [sfxVolume]);

  const setMuted = useCallback((v: boolean) => setMutedState(v), []);
  const setMasterVolume = useCallback((v: number) => setMasterVolumeState(Math.max(0, Math.min(1, v))), []);
  const setMusicVolume = useCallback((v: number) => setMusicVolumeState(Math.max(0, Math.min(1, v))), []);
  const setSfxVolume = useCallback((v: number) => setSfxVolumeState(Math.max(0, Math.min(1, v))), []);

  const unlockAudio = useCallback(() => {
    try {
      const ctx = audioContextRef.current ?? new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = ctx;
      if (!sfxGainRef.current) {
        const gain = ctx.createGain();
        gain.connect(ctx.destination);
        sfxGainRef.current = gain;
      }
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      unlockedRef.current = true;
    } catch {
      // ignore
    }
  }, []);
  unlockAudioRef.current = unlockAudio;

  const preloadSfx = useCallback(async (onProgress?: (loaded: number, total: number) => void) => {
    const ids = Object.keys(SFX_FILES) as SfxId[];
    const total = ids.length;
    let loaded = 0;
    const report = () => {
      loaded += 1;
      onProgress?.(loaded, total);
    };
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const cache = typeof caches !== "undefined" ? await caches.open(SFX_CACHE_NAME) : null;
    for (const id of ids) {
      const src = `${BASE}sounds/${SFX_FILES[id]}`.replace(/\/+/g, "/");
      try {
        const res = await fetch(src);
        const ab = await res.arrayBuffer();
        if (cache && res.ok) {
          cache.put(src, new Response(ab)).catch(() => {});
        }
        const buffer = await ctx.decodeAudioData(ab);
        bufferCacheRef.current[id] = buffer;
      } catch {
        // skip failed file
      }
      report();
    }
    ctx.close();
  }, []);

  const playSfx = useCallback(
    (id: SfxId) => {
      if (muted) return;
      if (id === "carrot_shoot") {
        const now = Date.now();
        if (now - lastCarrotShootRef.current < 300) return;
        lastCarrotShootRef.current = now;
      }
      const vol = masterVolume * sfxVolume;
      if (vol <= 0) return;

      // Ensure context exists and is unlocked (e.g. when autoStart runs in useEffect without user gesture)
      if (!unlockedRef.current || !audioContextRef.current || !sfxGainRef.current) {
        unlockAudioRef.current();
      }
      const ctx = audioContextRef.current;
      const gainNode = sfxGainRef.current;
      const useWebAudio = ctx && gainNode && unlockedRef.current;

      const src = `${BASE}sounds/${SFX_FILES[id]}`.replace(/\/+/g, "/");

      if (useWebAudio) {
        const playBuffer = (buffer: AudioBuffer) => {
          try {
            gainNode.gain.setValueAtTime(vol, ctx!.currentTime);
            const source = ctx!.createBufferSource();
            source.buffer = buffer;
            source.connect(gainNode!);
            source.start(0);
          } catch {
            // ignore
          }
        };

        const cached = bufferCacheRef.current[id];
        if (cached) {
          playBuffer(cached);
          return;
        }

        const getArrayBuffer = (): Promise<ArrayBuffer> => {
          if (typeof caches !== "undefined") {
            return caches.open(SFX_CACHE_NAME).then((c) => c.match(src)).then((r) => (r ? r.arrayBuffer() : fetch(src).then((res) => res.arrayBuffer())));
          }
          return fetch(src).then((r) => r.arrayBuffer());
        };
        getArrayBuffer()
          .then((ab) => ctx!.decodeAudioData(ab))
          .then((buffer) => {
            bufferCacheRef.current[id] = buffer;
            playBuffer(buffer);
          })
          .catch(() => {});
        return;
      }

      // Fallback: Web Audio not available (e.g. mobile without user-gesture unlock). Use HTML Audio so WAVs are at least requested and can play after first gesture.
      try {
        const audio = new Audio(src);
        audio.volume = vol;
        audio.play().catch(() => {});
      } catch {
        // ignore
      }
    },
    [muted, masterVolume, sfxVolume]
  );

  const playAmbient = useCallback(
    (id: AmbientId) => {
      if (ambientRef.current[id]) return;
      if (muted) return;
      const vol = masterVolume * sfxVolume;
      if (vol <= 0) return;
      const src = `${BASE}sounds/${AMBIENT_FILES[id]}`;
      const audio = new Audio(src);
      audio.loop = true;
      audio.volume = vol;
      ambientRef.current[id] = audio;
      audio.play().catch(() => {});
    },
    [muted, masterVolume, sfxVolume]
  );

  const stopAmbient = useCallback((id: AmbientId) => {
    const el = ambientRef.current[id];
    if (!el) return;
    el.pause();
    delete ambientRef.current[id];
  }, []);

  const setMusicState = useCallback(
    (state: MusicState) => {
      if (musicStateRef.current === state) return;
      musicStateRef.current = state;
      if (!musicRef.current) {
        musicRef.current = new Audio();
        musicRef.current.loop = true;
      }
      const el = musicRef.current;

      if (!musicEndedAttachedRef.current) {
        musicEndedAttachedRef.current = true;
        el.addEventListener("ended", () => {
          if (musicStateRef.current !== "playing" || INGAME_MUSIC_FILES.length === 0) return;
          const nextIndex = (ingameMusicIndexRef.current + 1) % INGAME_MUSIC_FILES.length;
          ingameMusicIndexRef.current = nextIndex;
          el.src = `${BASE}sounds/${INGAME_MUSIC_FILES[nextIndex]}`;
          el.play().catch(() => {});
        });
      }

      if (state === "playing") {
        ingameMusicIndexRef.current = 0;
        el.loop = false;
        if (INGAME_MUSIC_FILES.length > 0) {
          el.src = `${BASE}sounds/${INGAME_MUSIC_FILES[0]}`;
          el.volume = muted ? 0 : masterVolume * musicVolume;
          el.play().then(() => setIsMusicPlaying(true)).catch(() => setIsMusicPlaying(false));
        }
        return;
      }

      el.loop = true;
      el.src = `${BASE}sounds/${MUSIC_FILES[state]}`;
      el.volume = muted ? 0 : masterVolume * musicVolume;
      el.play().then(() => setIsMusicPlaying(true)).catch(() => setIsMusicPlaying(false));
    },
    [muted, masterVolume, musicVolume]
  );

  useEffect(() => {
    const el = musicRef.current;
    if (!el) return;
    el.volume = muted ? 0 : masterVolume * musicVolume;
    // Update playing state based on whether audio is actually playing
    if (el.paused) {
      setIsMusicPlaying(false);
    }
  }, [muted, masterVolume, musicVolume]);

  // Listen for play/pause events to track state
  useEffect(() => {
    const el = musicRef.current;
    if (!el) return;
    
    const handlePlay = () => setIsMusicPlaying(true);
    const handlePause = () => setIsMusicPlaying(false);
    const handleEnded = () => setIsMusicPlaying(false);
    
    el.addEventListener('play', handlePlay);
    el.addEventListener('pause', handlePause);
    el.addEventListener('ended', handleEnded);
    
    return () => {
      el.removeEventListener('play', handlePlay);
      el.removeEventListener('pause', handlePause);
      el.removeEventListener('ended', handleEnded);
    };
  }, []);

  const stopMusic = useCallback(() => {
    musicPausedRef.current = false;
    const el = musicRef.current;
    if (el) {
      el.pause();
      el.currentTime = 0;
      setIsMusicPlaying(false);
    }
  }, []);

  const pauseMusic = useCallback(() => {
    if (musicStateRef.current !== "playing") return;
    const el = musicRef.current;
    if (el) {
      el.pause();
      musicPausedRef.current = true;
      setIsMusicPlaying(false);
    }
  }, []);

  const resumeMusic = useCallback(() => {
    if (musicPausedRef.current && musicStateRef.current === "playing") {
      musicPausedRef.current = false;
      const el = musicRef.current;
      if (el) {
        el.play().then(() => setIsMusicPlaying(true)).catch(() => setIsMusicPlaying(false));
      }
      return;
    }
    const lastState = musicStateRef.current;
    const stateToPlay = lastState ?? "menu";
    musicStateRef.current = null;
    setMusicState(stateToPlay);
  }, [setMusicState]);

  const value: SoundContextValue = {
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
    setMusicState,
    stopMusic,
    pauseMusic,
    resumeMusic,
    isMusicPlaying,
  };

  return (
    <SoundContext.Provider value={value}>{children}</SoundContext.Provider>
  );
}

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error("useSound must be used within SoundProvider");
  return ctx;
}
