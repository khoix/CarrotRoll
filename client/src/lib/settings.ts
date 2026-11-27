/**
 * Player settings kept on this device: touch sensitivity and where the pause button sits.
 * A tiny store: read it anywhere with getSettings(), in React with useSettings().
 */
import { useSyncExternalStore } from "react";

/** Finger-to-bunny ratio for drag controls. 1 is the original 1:1; higher moves farther per finger move. */
export const TOUCH_SENSITIVITIES = [1, 1.25, 1.5] as const;
export type TouchSensitivity = (typeof TOUCH_SENSITIVITIES)[number];

export const PAUSE_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type PauseCorner = (typeof PAUSE_CORNERS)[number];

export type Settings = { touchSensitivity: TouchSensitivity; pauseCorner: PauseCorner };

const DEFAULTS: Settings = { touchSensitivity: 1, pauseCorner: "top-right" };
const KEYS: Record<keyof Settings, string> = {
  touchSensitivity: "carrotroll_touch_sensitivity",
  pauseCorner: "carrotroll_pause_corner",
};

function read(): Settings {
  try {
    const s = Number(localStorage.getItem(KEYS.touchSensitivity));
    const c = localStorage.getItem(KEYS.pauseCorner);
    return {
      touchSensitivity: (TOUCH_SENSITIVITIES as readonly number[]).includes(s) ? (s as TouchSensitivity) : DEFAULTS.touchSensitivity,
      pauseCorner: (PAUSE_CORNERS as readonly string[]).includes(c ?? "") ? (c as PauseCorner) : DEFAULTS.pauseCorner,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

let current: Settings | null = null;
const listeners = new Set<() => void>();

export function getSettings(): Settings {
  if (!current) current = typeof window === "undefined" ? { ...DEFAULTS } : read();
  return current;
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
  current = { ...getSettings(), [key]: value };
  try {
    localStorage.setItem(KEYS[key], String(value));
  } catch {
    // storage unavailable: the setting lasts for this visit only
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useSettings(): Settings {
  return useSyncExternalStore(subscribe, getSettings, () => DEFAULTS);
}
