import { useEffect, useLayoutEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from "react";
import { useCreateScore } from "@/hooks/use-scores";
import { useSound } from "@/contexts/SoundContext";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import { drawEarthBackground } from "@/lib/drawEarthBackground";
import { BackgroundScroller } from "@/lib/BackgroundScroller";
import { HazeLayer } from "@/lib/HazeLayer";
import { useIsMobile } from "@/hooks/use-mobile";
import StartMenuCard from "@/components/StartMenuCard";
import { validateName } from "@shared/schema";

const IMAGE_BASE =
  typeof import.meta !== "undefined" && (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL != null
    ? ((import.meta as { env: { BASE_URL: string } }).env.BASE_URL).replace(/\/$/, "") || ""
    : "";

function imageUrl(path: string): string {
  const p = path.replace(/^\//, "");
  return IMAGE_BASE ? `${IMAGE_BASE}/${p}` : `/${p}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src.startsWith("http") ? src : imageUrl(src);
  });
}

/** Carrot collectible body SVG (30×30); face is drawn separately via drawCarrotFace. */
const CARROT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 30 30">' +
  '<defs>' +
  '<linearGradient id="carrotBody30" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0%" stop-color="#fdba74"/>' +
  '<stop offset="55%" stop-color="#fb923c"/>' +
  '<stop offset="100%" stop-color="#f97316"/>' +
  '</linearGradient>' +
  '<linearGradient id="carrotShine30" x1="0" y1="0" x2="1" y2="1">' +
  '<stop offset="0%" stop-color="#fff7ed" stop-opacity="0.55"/>' +
  '<stop offset="60%" stop-color="#fff7ed" stop-opacity="0"/>' +
  '</linearGradient>' +
  '<linearGradient id="carrotLeaf30" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0%" stop-color="#86efac"/>' +
  '<stop offset="100%" stop-color="#22c55e"/>' +
  '</linearGradient>' +
  '</defs>' +
  '<path d="M13.8 3.5 C12.1 2.6 10.8 3.4 10.7 5.0 C11.7 5.2 12.8 6.0 13.4 7.2 C14.1 6.0 14.4 4.5 13.8 3.5 Z" fill="url(#carrotLeaf30)" stroke="rgba(0,0,0,0.9)" stroke-width="1.0" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M16.0 3.1 C15.8 1.7 17.2 1.0 18.6 2.0 C19.5 2.7 19.9 4.1 19.2 5.4 C18.3 5.1 17.1 5.3 16.1 6.2 C15.8 5.0 15.8 4.0 16.0 3.1 Z" fill="url(#carrotLeaf30)" stroke="rgba(0,0,0,0.9)" stroke-width="1.0" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M15.0 4.8 C14.2 3.8 13.2 3.7 12.5 4.3 C11.6 5.0 12.1 6.4 13.3 7.2 C14.1 7.8 15.0 8.2 16.0 8.2 C16.1 7.0 15.7 5.8 15.0 4.8 Z" fill="url(#carrotLeaf30)" stroke="rgba(0,0,0,0.9)" stroke-width="1.0" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M11.2 8.6 C12.7 7.5 17.3 7.5 18.8 8.6 C18.2 10.1 16.8 11.0 15.0 11.0 C13.2 11.0 11.8 10.1 11.2 8.6 Z" fill="#22c55e" stroke="rgba(0,0,0,0.9)" stroke-width="1.0" stroke-linejoin="round"/>' +
  '<path d="M15 9.6 C18.4 9.6 20.9 12.3 20.3 15.4 C19.6 18.9 17.8 22.3 16.0 25.6 C15.6 26.4 15.3 27.1 15 27.9 C14.7 27.1 14.4 26.4 14.0 25.6 C12.2 22.3 10.4 18.9 9.7 15.4 C9.1 12.3 11.6 9.6 15 9.6 Z" fill="url(#carrotBody30)" stroke="rgba(0,0,0,0.9)" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M12.2 12.0 C13.2 11.2 14.2 11.0 15.0 11.0 C14.4 13.0 13.9 15.5 14.1 18.5 C14.3 21.1 14.9 23.6 15.5 25.8 C14.6 24.4 13.6 22.3 12.9 20.0 C12.1 17.4 11.8 14.5 12.2 12.0 Z" fill="url(#carrotShine30)" opacity="0.9"/>' +
  '<path d="M11.6 14.3 C13.3 15.2 16.7 15.2 18.4 14.3" stroke="rgba(0,0,0,0.22)" stroke-width="0.7" stroke-linecap="round"/>' +
  '<path d="M11.1 17.2 C13.1 18.2 16.9 18.2 18.9 17.2" stroke="rgba(0,0,0,0.22)" stroke-width="0.7" stroke-linecap="round"/>' +
  '<path d="M11.4 20.2 C13.0 21.0 17.0 21.0 18.6 20.2" stroke="rgba(0,0,0,0.22)" stroke-width="0.7" stroke-linecap="round"/>' +
  '<path d="M12.2 23.1 C13.4 23.7 16.6 23.7 17.8 23.1" stroke="rgba(0,0,0,0.22)" stroke-width="0.7" stroke-linecap="round"/>' +
  '</svg>';

/** Broccoli projectile SVG (20×20); used in-game and matches StartMenuCard. */
const BROCCOLI_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">' +
  '<defs>' +
  '<radialGradient id="brocGlowGame" cx="38%" cy="28%" r="72%">' +
  '<stop offset="0%" stop-color="#bbf7d0" stop-opacity="0.95"/>' +
  '<stop offset="45%" stop-color="#4ade80" stop-opacity="0.95"/>' +
  '<stop offset="100%" stop-color="#16a34a" stop-opacity="0.95"/>' +
  '</radialGradient>' +
  '<radialGradient id="brocShadowGame" cx="70%" cy="70%" r="80%">' +
  '<stop offset="0%" stop-color="#15803d" stop-opacity="0.55"/>' +
  '<stop offset="100%" stop-color="#15803d" stop-opacity="0"/>' +
  '</radialGradient>' +
  '<linearGradient id="stemGradGame" x1="0" y1="0" x2="0" y2="1">' +
  '<stop offset="0%" stop-color="#4ade80"/>' +
  '<stop offset="100%" stop-color="#15803d"/>' +
  '</linearGradient>' +
  '</defs>' +
  '<path d="M5.4 10.2 C4.1 10.0 3.2 9.0 3.3 7.8 C3.4 6.4 4.5 5.7 5.7 5.9 C6.0 4.5 7.3 3.4 9.2 3.4 C11.4 3.4 12.8 4.7 13.0 6.2 C14.6 5.9 16.1 6.8 16.2 8.3 C16.3 9.8 15.1 10.9 13.5 11.0 C13.0 12.2 11.8 13.1 10.0 13.1 C8.1 13.1 6.7 12.2 6.3 10.9 C6.0 10.7 5.7 10.4 5.4 10.2 Z" fill="url(#brocGlowGame)" stroke="rgba(0,0,0,0.9)" stroke-width="0.9" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M5.4 10.2 C4.1 10.0 3.2 9.0 3.3 7.8 C3.4 6.4 4.5 5.7 5.7 5.9 C6.0 4.5 7.3 3.4 9.2 3.4 C11.4 3.4 12.8 4.7 13.0 6.2 C14.6 5.9 16.1 6.8 16.2 8.3 C16.3 9.8 15.1 10.9 13.5 11.0 C13.0 12.2 11.8 13.1 10.0 13.1 C8.1 13.1 6.7 12.2 6.3 10.9 C6.0 10.7 5.7 10.4 5.4 10.2 Z" fill="url(#brocShadowGame)" opacity="0.9"/>' +
  '<circle cx="6.3" cy="7.7" r="1.05" fill="#86efac" opacity="0.75"/>' +
  '<circle cx="8.2" cy="6.0" r="1.15" fill="#86efac" opacity="0.72"/>' +
  '<circle cx="10.4" cy="5.7" r="1.05" fill="#86efac" opacity="0.70"/>' +
  '<circle cx="12.4" cy="6.8" r="1.10" fill="#86efac" opacity="0.70"/>' +
  '<circle cx="9.2" cy="8.5" r="1.00" fill="#86efac" opacity="0.62"/>' +
  '<circle cx="11.7" cy="8.8" r="0.95" fill="#86efac" opacity="0.58"/>' +
  '<path d="M8.2 12.0 C8.3 11.2 8.9 10.8 9.6 10.8 H10.4 C11.1 10.8 11.7 11.2 11.8 12.0 L12.2 18.4 C12.25 19.1 11.8 19.6 11.1 19.6 H8.9 C8.2 19.6 7.75 19.1 7.8 18.4 Z" fill="url(#stemGradGame)" stroke="rgba(0,0,0,0.9)" stroke-width="0.9" stroke-linejoin="round" stroke-linecap="round"/>' +
  '<path d="M9.1 12.1 L8.8 19.1" stroke="rgba(255,255,255,0.30)" stroke-width="0.7" stroke-linecap="round"/>' +
  '<path d="M10.0 11.8 L10.0 19.3" stroke="rgba(0,0,0,0.20)" stroke-width="0.7" stroke-linecap="round"/>' +
  '<path d="M10.9 12.1 L11.2 19.1" stroke="rgba(255,255,255,0.24)" stroke-width="0.7" stroke-linecap="round"/>' +
  '<path d="M7.6 12.0 C7.0 11.7 6.9 11.1 7.2 10.6 C7.9 10.8 8.3 11.4 8.1 12.0 Z" fill="#22c55e" opacity="0.95"/>' +
  '<path d="M12.4 12.0 C13.0 11.7 13.1 11.1 12.8 10.6 C12.1 10.8 11.7 11.4 11.9 12.0 Z" fill="#22c55e" opacity="0.95"/>' +
  '</svg>';

/** Spiky ball obstacle SVG (40×40 display, viewBox 120); 3D wedge spikes. */
const SPIKY_BALL_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 120 120" fill="none">' +
  '<defs>' +
  '<radialGradient id="ballBody" cx="42" cy="38" r="56" gradientUnits="userSpaceOnUse">' +
  '<stop offset="0" stop-color="#6B7280"/>' +
  '<stop offset="0.35" stop-color="#4B5563"/>' +
  '<stop offset="0.78" stop-color="#1F2937"/>' +
  '<stop offset="1" stop-color="#0B1220"/>' +
  '</radialGradient>' +
  '<linearGradient id="ballSheen" x1="22" y1="28" x2="92" y2="98" gradientUnits="userSpaceOnUse">' +
  '<stop offset="0" stop-color="rgba(255,255,255,0.55)"/>' +
  '<stop offset="0.18" stop-color="rgba(255,255,255,0.10)"/>' +
  '<stop offset="0.52" stop-color="rgba(255,255,255,0.00)"/>' +
  '<stop offset="0.78" stop-color="rgba(255,255,255,0.06)"/>' +
  '<stop offset="1" stop-color="rgba(255,255,255,0.00)"/>' +
  '</linearGradient>' +
  '<radialGradient id="ballRim" cx="60" cy="60" r="52" gradientUnits="userSpaceOnUse">' +
  '<stop offset="0.70" stop-color="rgba(255,255,255,0.00)"/>' +
  '<stop offset="0.86" stop-color="rgba(255,255,255,0.22)"/>' +
  '<stop offset="1" stop-color="rgba(0,0,0,0.55)"/>' +
  '</radialGradient>' +
  '<linearGradient id="ballSpikeFace" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">' +
  '<stop offset="0" stop-color="#0B1220"/>' +
  '<stop offset="0.35" stop-color="#111827"/>' +
  '<stop offset="0.72" stop-color="#374151"/>' +
  '<stop offset="1" stop-color="#6B7280"/>' +
  '</linearGradient>' +
  '<linearGradient id="ballSpikeHi" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">' +
  '<stop offset="0" stop-color="rgba(255,255,255,0.00)"/>' +
  '<stop offset="0.45" stop-color="rgba(255,255,255,0.32)"/>' +
  '<stop offset="1" stop-color="rgba(255,255,255,0.10)"/>' +
  '</linearGradient>' +
  '<linearGradient id="ballSpikeLo" x1="0" y1="1" x2="1" y2="0" gradientUnits="objectBoundingBox">' +
  '<stop offset="0" stop-color="rgba(0,0,0,0.52)"/>' +
  '<stop offset="0.55" stop-color="rgba(0,0,0,0.18)"/>' +
  '<stop offset="1" stop-color="rgba(0,0,0,0.00)"/>' +
  '</linearGradient>' +
  '<radialGradient id="ballShadow" cx="60" cy="96" r="34" gradientUnits="userSpaceOnUse">' +
  '<stop offset="0" stop-color="rgba(0,0,0,0.55)"/>' +
  '<stop offset="1" stop-color="rgba(0,0,0,0.00)"/>' +
  '</radialGradient>' +
  '<filter id="ballSpikeShadow" x="-30%" y="-30%" width="160%" height="160%" color-interpolation-filters="sRGB">' +
  '<feDropShadow dx="0" dy="1.2" stdDeviation="1.0" flood-color="rgba(0,0,0,0.55)"/>' +
  '</filter>' +
  '<filter id="ballBallShadow" x="-40%" y="-40%" width="180%" height="180%" color-interpolation-filters="sRGB">' +
  '<feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="rgba(0,0,0,0.55)"/>' +
  '</filter>' +
  '</defs>' +
  '<ellipse cx="60" cy="96" rx="34" ry="12" fill="url(#ballShadow)"/>' +
  '<g filter="url(#ballSpikeShadow)">' +
  '<g transform="translate(60 60)">' +
  '<g id="ballSpike3d">' +
  '<path d="M 34 -6 C 40 -6 46 -3 56 0 C 46 3 40 6 34 6 Q 31 0 34 -6 Z" fill="url(#ballSpikeFace)"/>' +
  '<path d="M 34 -6 C 41 -5.8 47 -3.1 56 0" fill="none" stroke="url(#ballSpikeHi)" stroke-width="1.4" stroke-linecap="round"/>' +
  '<path d="M 34 6 C 41 5.8 47 3.1 56 0" fill="none" stroke="url(#ballSpikeLo)" stroke-width="1.8" stroke-linecap="round"/>' +
  '<path d="M 34 -6 Q 31 0 34 6" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1" stroke-linecap="round"/>' +
  '</g>' +
  '<use href="#ballSpike3d"/>' +
  '<g transform="rotate(30) scale(0.98)"><use href="#ballSpike3d"/></g>' +
  '<g transform="rotate(60) scale(1.02)"><use href="#ballSpike3d"/></g>' +
  '<g transform="rotate(90) scale(0.99)"><use href="#ballSpike3d"/></g>' +
  '<g transform="rotate(120) scale(1.03)"><use href="#ballSpike3d"/></g>' +
  '<g transform="rotate(150) scale(0.97)"><use href="#ballSpike3d"/></g>' +
  '<g transform="rotate(180) scale(1.01)"><use href="#ballSpike3d"/></g>' +
  '<g transform="rotate(210) scale(0.98)"><use href="#ballSpike3d"/></g>' +
  '<g transform="rotate(240) scale(1.02)"><use href="#ballSpike3d"/></g>' +
  '<g transform="rotate(270) scale(0.99)"><use href="#ballSpike3d"/></g>' +
  '<g transform="rotate(300) scale(1.03)"><use href="#ballSpike3d"/></g>' +
  '<g transform="rotate(330) scale(0.97)"><use href="#ballSpike3d"/></g>' +
  '</g></g>' +
  '<g filter="url(#ballBallShadow)">' +
  '<circle cx="60" cy="60" r="34" fill="url(#ballBody)"/>' +
  '<circle cx="60" cy="60" r="34" fill="url(#ballSheen)" opacity="0.35"/>' +
  '<circle cx="60" cy="60" r="34" fill="url(#ballRim)"/>' +
  '<circle cx="60" cy="60" r="34" stroke="rgba(255,255,255,0.52)" stroke-width="2" fill="none"/>' +
  '</g>' +
  '<g opacity="0.22" stroke="rgba(255,255,255,0.35)" stroke-width="1" stroke-linecap="round">' +
  '<path d="M40 62 Q46 58 52 60"/>' +
  '<path d="M58 74 Q64 70 70 72"/>' +
  '<path d="M50 52 Q56 48 62 50"/>' +
  '</g>' +
  '</svg>';

/** Fallback 1024x1024 tile when baseTile.png is missing (so scroller + haze still run). */
function createFallbackBaseTile(): HTMLCanvasElement {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, "#2d5a27");
  g.addColorStop(0.5, "#3d6b35");
  g.addColorStop(0.7, "#2563a8");
  g.addColorStop(1, "#1e40af");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

// --- Game Constants & Types ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 40;
const BASE_SPEED = 5;
const SCROLL_SPEED = 3;
const ATTRACT_RADIUS = 400;
const ATTRACT_STRENGTH = 480;
const ATTRACT_MAX_CARROT_SPEED = 300;
const ATTRACT_FADE_THRESHOLD = 1.5;
const RIPPLE_PERIOD_MS = 900;
const RIPPLE_MAX_RADIUS_FACTOR = 1.5;

type GameObject = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  type: "player" | "giant_carrot" | "spike" | "ball" | "carrot" | "powerup_invincible" | "powerup_speed" | "powerup_heart" | "powerup_blaster" | "powerup_attract" | "player_laser";
  vx: number;
  vy: number;
  active: boolean;
  stunned?: number;
  face?: number; // 0-5 randomized expression for carrots
  angle?: number; // rotation for projectiles (spikes)
};

type GameState = "menu" | "countdown" | "playing" | "gameover" | "level_transition" | "level20_ending";

/** Draw a carrot face (eyes + mouth) at (cx, cy) with given scale. expression 0-5: happy, sad, surprised, angry, sleepy, winky. compact=true halves eye–mouth distance (small carrots). */
function drawCarrotFace(ctx: CanvasRenderingContext2D, expression: number, cx: number, cy: number, scale: number, compact?: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = scale;
  const eyeY = compact ? -s * 0.21 : -s * 0.35;
  const eyeOffset = s * 0.25;
  const eyeR = s * 0.12;
  const mouthY = compact ? s * 0.065 : s * 0.2;
  ctx.fillStyle = "#1a1a1a";
  ctx.strokeStyle = "#1a1a1a";
  ctx.lineWidth = Math.max(1, s * 0.08);
  ctx.lineCap = "round";

  switch (expression) {
    case 0: // happy: dot eyes + smile
      ctx.beginPath();
      ctx.arc(-eyeOffset, eyeY, eyeR, 0, Math.PI * 2);
      ctx.arc(eyeOffset, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, mouthY, s * 0.3, 0.2 * Math.PI, 0.8 * Math.PI);
      ctx.stroke();
      break;
    case 1: // sad: dot eyes + frown
      ctx.beginPath();
      ctx.arc(-eyeOffset, eyeY, eyeR, 0, Math.PI * 2);
      ctx.arc(eyeOffset, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, mouthY + s * 0.15, s * 0.25, 0.8 * Math.PI, 1.2 * Math.PI);
      ctx.stroke();
      break;
    case 2: // surprised: big dot eyes + O mouth
      ctx.beginPath();
      ctx.arc(-eyeOffset, eyeY, eyeR * 1.2, 0, Math.PI * 2);
      ctx.arc(eyeOffset, eyeY, eyeR * 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(0, mouthY, s * 0.15, s * 0.25, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 3: // angry: slanted brows + frown
      ctx.beginPath();
      ctx.moveTo(-eyeOffset - eyeR, eyeY - eyeR);
      ctx.lineTo(-eyeOffset + eyeR, eyeY + eyeR);
      ctx.moveTo(eyeOffset - eyeR, eyeY + eyeR);
      ctx.lineTo(eyeOffset + eyeR, eyeY - eyeR);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(-eyeOffset, eyeY, eyeR * 0.7, 0, Math.PI * 2);
      ctx.arc(eyeOffset, eyeY, eyeR * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, mouthY + s * 0.1, s * 0.2, 0.7 * Math.PI, 1.3 * Math.PI);
      ctx.stroke();
      break;
    case 4: // sleepy: half eyes + line mouth
      ctx.beginPath();
      ctx.ellipse(-eyeOffset, eyeY, eyeR, eyeR * 0.4, 0, 0, Math.PI);
      ctx.ellipse(eyeOffset, eyeY, eyeR, eyeR * 0.4, 0, 0, Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-s * 0.2, mouthY);
      ctx.lineTo(s * 0.2, mouthY);
      ctx.stroke();
      break;
    default: // 5 winky: one eye closed, smile
      ctx.beginPath();
      ctx.arc(-eyeOffset, eyeY, eyeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(eyeOffset - eyeR, eyeY);
      ctx.lineTo(eyeOffset + eyeR, eyeY);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, mouthY, s * 0.28, 0.25 * Math.PI, 0.75 * Math.PI);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** Entity types that can be spawned in demo/sandbox mode. */
export type SpawnableType =
  | "spike"
  | "ball"
  | "carrot"
  | "powerup_heart"
  | "powerup_invincible"
  | "powerup_speed"
  | "powerup_blaster"
  | "powerup_attract";

interface GameCanvasProps {
  onStateChange?: (state: GameState) => void;
  /** When true, start game (countdown) on mount and do not show menu. */
  autoStart?: boolean;
  /** When true, display canvas at 9:10 aspect ratio and crop 1/8 width on each side; constrain player to visible area. */
  portraitAspect?: boolean;
  /** When provided, called when user returns to menu (Back to Menu or after submitting score). Used by play page to navigate to main menu. */
  onReturnToMenu?: () => void;
  /** Initial level (e.g. 19 for demo). Default 1. */
  initialLevel?: number;
  /** When true, player does not take damage from spikes, balls, or giant carrot (demo/sandbox). */
  damageDisabled?: boolean;
  /** When provided, called whenever the canvas unlocks audio (e.g. first key/touch). Use on demo pages to run preload + music. */
  onSoundUnlock?: () => void;
}

export interface GameCanvasHandle {
  handleKeyPress: (key: string, pressed: boolean) => void;
  /** Set 360° touchpad movement (dx, dy normalized). Call with (0, 0) to clear. */
  handleMove: (dx: number, dy: number) => void;
  /** Return to menu state (e.g. after level-20 ending overlay completes). */
  resetToMenu: () => void;
  /** Transition from level-20 ending to game-over so the user can submit their score. */
  showGameOverAfterEnding: () => void;
  /** DOM element for the game canvas container (for layout sync, e.g. sidebar height). */
  getContainerElement: () => HTMLDivElement | null;
  /** Set game level (1–19; demo use). */
  setLevel: (n: number) => void;
  /** Spawn an entity at game coordinates (top-left). Demo/sandbox only. */
  spawnEntity: (x: number, y: number, type: SpawnableType) => void;
  /** Convert client coordinates to game space (800×600). Returns null if outside canvas. */
  clientToGame: (clientX: number, clientY: number) => { x: number; y: number } | null;
}

const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(({ onStateChange, autoStart = false, portraitAspect = false, onReturnToMenu, initialLevel = 1, damageDisabled = false, onSoundUnlock }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const damageDisabledRef = useRef(damageDisabled);
  damageDisabledRef.current = damageDisabled;
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [gameState, setGameState] = useState<GameState>(autoStart ? "menu" : "menu");
  const isMobile = useIsMobile();
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(initialLevel);
  const [carrotsCollected, setCarrotsCollected] = useState(0);
  const [lives, setLives] = useState(3);
  const [playerName, setPlayerName] = useState("");
  const [nameError, setNameError] = useState("");
  const nameErrorDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const startGameRef = useRef<() => void>(() => {});
  
  const createScore = useCreateScore();
  const { playSfx, playAmbient, stopAmbient, setMusicState, stopMusic, pauseMusic, resumeMusic, unlockAudio } = useSound();
  const soundRef = useRef(playSfx);
  soundRef.current = playSfx;
  const rapidAmbientOnRef = useRef(false);
  const attractAmbientOnRef = useRef(false);
  const goldenBunnyAmbientOnRef = useRef(false);
  const prevLivesRef = useRef(3);
  const shieldDeflectLastPlayedRef = useRef<number>(0);

  const carrotImageRef = useRef<HTMLImageElement | null>(null);
  const broccoliImageRef = useRef<HTMLImageElement | null>(null);
  const spikyBallImageRef = useRef<HTMLImageElement | null>(null);
  const backgroundScrollerRef = useRef<BackgroundScroller | null>(null);
  const hazeLayerRef = useRef<HazeLayer | null>(null);
  const menuLoopIdRef = useRef<number>(0);
  const menuLastFrameRef = useRef<number>(0);
  const prevGameStateRef = useRef<GameState | null>(null);

  // Fullscreen bezel: offscreen scroller buffer + left/right strip canvases
  const scrollerBufferRef = useRef<HTMLCanvasElement | null>(null);
  const leftBezelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rightBezelCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const leftBezelContainerRef = useRef<HTMLDivElement | null>(null);
  const rightBezelContainerRef = useRef<HTMLDivElement | null>(null);

  // HUD container-based font scaling (avoid truncation on narrow viewports)
  const hudContainerRef = useRef<HTMLDivElement | null>(null);
  const hudLeftRef = useRef<HTMLDivElement | null>(null);
  const hudRightRef = useRef<HTMLDivElement | null>(null);
  const [hudContainerWidth, setHudContainerWidth] = useState(0);
  const [hudFontSizeRem, setHudFontSizeRem] = useState<number | null>(null);

  // Game Ref State (for loop access without re-renders)
  const gameRef = useRef({
    player: { x: 400, y: 300, width: PLAYER_SIZE, height: PLAYER_SIZE, color: "#3B82F6", vx: 0, vy: 0, speed: BASE_SPEED, invincible: false, invincibilityTimer: 0, shieldTimer: 0, speedBoostTimer: 0, blasterTimer: 0, attractTimer: 0, stunned: 0 },
    keys: { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false, space: false },
    projectiles: [] as GameObject[],
    obstacles: [] as GameObject[],
    collectibles: [] as GameObject[],
    giantCarrot: { x: 0, y: CANVAS_HEIGHT + 100, width: 200, height: 200, angle: 0, nextShot: 0, face: 0 },
    lastFrameTime: 0,
    lastBlasterShot: 0,
    animationId: 0,
    levelColor: "#FFF7ED", // Default bg
    heartSpawnedThisLevel: false,
    explosions: [] as { x: number; y: number; startTime: number; duration: number }[],
    countdownStartTime: 0,
    isFullscreen: false,
    portraitAspect: false,
    lives: 3,
    maxHeartsExplosionStartTime: null as number | null,
    sparkleTrail: [] as { x: number; y: number; startTime: number }[],
    maxHeartsBonusAwarded: false,
    touchMove: null as { dx: number; dy: number } | null,
  });
  gameRef.current.portraitAspect = portraitAspect;

  // Sync menu music only when transitioning into menu (not on initial mount), so title-screen click can start music
  useEffect(() => {
    const prev = prevGameStateRef.current;
    prevGameStateRef.current = gameState;
    if (gameState === "menu" && prev !== null && prev !== "menu") {
      setMusicState("menu");
    }
    // Notify parent component of state changes
    onStateChange?.(gameState);
  }, [gameState, setMusicState, onStateChange]);

  // When lives drop from 10 to <10: stop golden bunny ambient and resume in-game music
  useEffect(() => {
    const prev = prevLivesRef.current;
    prevLivesRef.current = lives;
    if (prev === 10 && lives < 10 && goldenBunnyAmbientOnRef.current) {
      goldenBunnyAmbientOnRef.current = false;
      stopAmbient("golden_bunny_loop");
      resumeMusic();
    }
  }, [lives, stopAmbient, resumeMusic]);

  // ResizeObserver: store HUD container width for font scaling (only when HUD visible)
  useEffect(() => {
    if (gameState !== "playing" && gameState !== "countdown") {
      setHudContainerWidth(0);
      return;
    }
    const el = hudContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setHudContainerWidth(e.contentRect.width);
    });
    ro.observe(el);
    setHudContainerWidth(el.clientWidth);
    return () => {
      ro.disconnect();
      setHudContainerWidth(0);
    };
  }, [gameState]);

  // HUD font scaling: measure at 1rem and set --hud-font-size so content fits (no truncation)
  const MIN_HUD_FONT_REM = 0.5;
  useLayoutEffect(() => {
    if (hudContainerWidth <= 0) return;
    const container = hudContainerRef.current;
    const left = hudLeftRef.current;
    const right = hudRightRef.current;
    if (!container || !left || !right) return;
    container.style.setProperty("--hud-font-size", "1rem");
    void container.offsetHeight; // reflow
    const contentWidth = left.scrollWidth + right.scrollWidth;
    const availableWidth = hudContainerWidth;
    if (contentWidth <= 0) return;
    const scale = Math.min(1, availableWidth / contentWidth);
    const fontSizeRem = Math.max(MIN_HUD_FONT_REM, scale);
    setHudFontSizeRem(fontSizeRem);
  }, [hudContainerWidth, score, level, lives, carrotsCollected]);

  // Expose key press handler via ref (unlockAudio on first touch so mobile SFX work)
  const handleKeyPress = useCallback((key: string, pressed: boolean) => {
    if (pressed) {
      unlockAudio();
      onSoundUnlock?.();
    }
    if (key === "space") {
      gameRef.current.keys.space = pressed;
    } else if (key === "ArrowUp") {
      gameRef.current.keys.ArrowUp = pressed;
    } else if (key === "ArrowDown") {
      gameRef.current.keys.ArrowDown = pressed;
    } else if (key === "ArrowLeft") {
      gameRef.current.keys.ArrowLeft = pressed;
    } else if (key === "ArrowRight") {
      gameRef.current.keys.ArrowRight = pressed;
    }
  }, [unlockAudio, onSoundUnlock]);

  const handleMove = useCallback((dx: number, dy: number) => {
    if (dx !== 0 || dy !== 0) {
      unlockAudio();
      onSoundUnlock?.();
    }
    gameRef.current.touchMove = dx === 0 && dy === 0 ? null : { dx, dy };
  }, [unlockAudio, onSoundUnlock]);

  const resetToMenu = useCallback(() => {
    setGameState("menu");
  }, []);

  const showGameOverAfterEnding = useCallback(() => {
    setMusicState("menu");
    setGameState("gameover");
  }, [setMusicState]);

  const clientToGame = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;
    if (relX < 0 || relY < 0 || relX > rect.width || relY > rect.height) return null;
    return { x: relX * scaleX, y: relY * scaleY };
  }, []);

  const spawnEntity = useCallback((x: number, y: number, type: SpawnableType) => {
    const state = gameRef.current;
    const clampX = (v: number, w: number) => Math.max(0, Math.min(CANVAS_WIDTH - w, v));
    const clampY = (v: number, h: number) => Math.max(0, Math.min(CANVAS_HEIGHT - h, v));
    if (type === "spike") {
      state.projectiles.push({
        x: clampX(x - 20, 40),
        y: clampY(y - 20, 40),
        width: 40,
        height: 40,
        color: "#22C55E",
        type: "spike",
        vx: 0,
        vy: -200,
        active: true,
        angle: 0,
      });
      return;
    }
    if (type === "ball") {
      state.obstacles.push({
        x: clampX(x - 20, 40),
        y: clampY(y - 20, 40),
        width: 40,
        height: 40,
        color: "#1F2937",
        type: "ball",
        vx: 0,
        vy: SCROLL_SPEED * 60,
        active: true,
      });
      return;
    }
    const colors: Record<string, string> = {
      carrot: "#F97316",
      powerup_heart: "#E11D48",
      powerup_invincible: "#22C55E",
      powerup_speed: "#EAB308",
      powerup_blaster: "#06B6D4",
      powerup_attract: "#DC2626",
    };
    const w = type === "carrot" ? 40 : 30;
    const h = w;
    state.collectibles.push({
      x: clampX(x - w / 2, w),
      y: clampY(y - h / 2, h),
      width: w,
      height: h,
      color: colors[type] ?? "#F97316",
      type: type as GameObject["type"],
      vx: 0,
      vy: SCROLL_SPEED * 60,
      active: true,
      ...(type === "carrot" && { face: Math.floor(Math.random() * 6) }),
    });
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      handleKeyPress,
      handleMove,
      resetToMenu,
      showGameOverAfterEnding,
      getContainerElement: () => containerRef.current,
      setLevel: (n: number) => setLevel(n),
      spawnEntity,
      clientToGame,
    }),
    [handleKeyPress, handleMove, resetToMenu, showGameOverAfterEnding, spawnEntity, clientToGame]
  );

  // --- Fullscreen ---
  const toggleFullscreen = useCallback(() => {
    playSfx("ui_click");
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, [playSfx]);

  useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    gameRef.current.isFullscreen = isFullscreen;
  }, [isFullscreen]);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { carrotImageRef.current = img; };
    img.src = "data:image/svg+xml," + encodeURIComponent(CARROT_SVG);
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { broccoliImageRef.current = img; };
    img.src = "data:image/svg+xml," + encodeURIComponent(BROCCOLI_SVG);
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => { spikyBallImageRef.current = img; };
    img.src = "data:image/svg+xml," + encodeURIComponent(SPIKY_BALL_SVG);
  }, []);

  // Offscreen buffer for fullscreen bezel (scroller only, 800x600)
  useEffect(() => {
    const buf = document.createElement("canvas");
    buf.width = CANVAS_WIDTH;
    buf.height = CANVAS_HEIGHT;
    scrollerBufferRef.current = buf;
    return () => {
      scrollerBufferRef.current = null;
    };
  }, []);

  // --- Background scroller assets; use base-relative paths and fallback tile if image missing ---
  useEffect(() => {
    let cancelled = false;
    loadImage("images/baseTile.webp")
      .then((baseTile) => {
        if (cancelled) return;
        Promise.all([
          loadImage("images/detailTile.webp").catch(() => null),
          loadImage("images/waterMask.png").catch(() => null),
        ]).then(([detailTile, waterMask]) => {
          if (cancelled) return;
          const scroller = new BackgroundScroller(
            CANVAS_WIDTH,
            CANVAS_HEIGHT,
            baseTile,
            detailTile ?? undefined,
            waterMask ?? undefined
          );
          scroller.setSpeed(50);
          backgroundScrollerRef.current = scroller;
        });
      })
      .catch(() => {
        if (cancelled) return;
        const fallbackTile = createFallbackBaseTile();
        const scroller = new BackgroundScroller(CANVAS_WIDTH, CANVAS_HEIGHT, fallbackTile);
        scroller.setSpeed(50);
        backgroundScrollerRef.current = scroller;
      });
    return () => {
      cancelled = true;
      backgroundScrollerRef.current = null;
    };
  }, []);

  // --- Input Handling (normalize so WASD works with capslock; use e.code for letters and Space) ---
  useEffect(() => {
    const codeToKey: Record<string, string> = {
      KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d",
      ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight",
      Space: "space",
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = codeToKey[e.code] ?? (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "space"].includes(e.key) ? (e.key === " " ? "space" : e.key) : null);
      if (key && gameRef.current.keys.hasOwnProperty(key)) {
        gameRef.current.keys[key as keyof typeof gameRef.current.keys] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const key = codeToKey[e.code] ?? (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D", " "].includes(e.key) ? (e.key === " " ? "space" : e.key.toLowerCase()) : null);
      if (key && gameRef.current.keys.hasOwnProperty(key)) {
        gameRef.current.keys[key as keyof typeof gameRef.current.keys] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState]);

  // --- Menu / Game Over: Space or Enter to start or go back (gameover: only Enter, not Space) ---
  useEffect(() => {
    if (gameState !== "menu" && gameState !== "gameover") return;
    const handleMenuKey = (e: KeyboardEvent) => {
      if (gameState === "menu") {
        if (e.key !== " " && e.key !== "Enter") return;
        e.preventDefault();
        startGameRef.current();
        return;
      }
      // gameover: Space disabled; only Enter goes back to menu (Enter in name field submits via input onKeyDown)
      if (e.key === " ") return;
      if (e.key !== "Enter") return;
      const inNameInput = document.activeElement === nameInputRef.current;
      if (inNameInput) return; // let input handle submit
      e.preventDefault();
      playSfx("ui_click");
      setMusicState("menu");
      setGameState("menu");
    };
    window.addEventListener("keydown", handleMenuKey);
    return () => window.removeEventListener("keydown", handleMenuKey);
  }, [gameState, setMusicState, playSfx]);

  // --- Game Loop ---
  const COUNTDOWN_DURATION_MS = 3000;
  const CARROT_ROLL_UP_START_Y = CANVAS_HEIGHT + 180;
  const CARROT_ROLL_UP_END_Y = CANVAS_HEIGHT - 120;

  const startGame = () => {
    unlockAudio();
    playSfx("start");
    setMusicState("playing");
    setGameState("countdown");
    setScore(0);
    setLevel(initialLevel);
    setCarrotsCollected(0);
    setLives(3);
    prevLivesRef.current = 3;
    goldenBunnyAmbientOnRef.current = false;

    // Reset Game State (carrot starts below screen for roll-up)
    gameRef.current.player = { x: 400, y: 300, width: PLAYER_SIZE, height: PLAYER_SIZE, color: "#3B82F6", vx: 0, vy: 0, speed: BASE_SPEED, invincible: false, invincibilityTimer: 0, shieldTimer: 0, speedBoostTimer: 0, blasterTimer: 0, attractTimer: 0, stunned: 0 };
    gameRef.current.projectiles = [];
    gameRef.current.obstacles = [];
    gameRef.current.collectibles = [];
    gameRef.current.giantCarrot = { x: 0, width: CANVAS_WIDTH, y: CARROT_ROLL_UP_START_Y, height: 200, angle: 0, nextShot: 0, face: Math.floor(Math.random() * 6) };
    gameRef.current.lastBlasterShot = 0;
    gameRef.current.levelColor = "#FFF7ED";
    gameRef.current.heartSpawnedThisLevel = false;
    gameRef.current.explosions = [];
    gameRef.current.lives = 3;
    gameRef.current.maxHeartsExplosionStartTime = null;
    gameRef.current.sparkleTrail = [];
    gameRef.current.maxHeartsBonusAwarded = false;
    gameRef.current.touchMove = null;
    gameRef.current.countdownStartTime = performance.now();

    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    gameRef.current.lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
  };
  startGameRef.current = startGame;

  // When autoStart is true, start game on mount (for play window).
  useEffect(() => {
    if (autoStart && canvasRef.current) {
      startGameRef.current();
    }
  }, [autoStart]);

  const gameLoop = useCallback((time: number) => {
    if (gameState !== "playing" && gameState !== "countdown") return;

    const dt = (time - gameRef.current.lastFrameTime) / 1000;
    gameRef.current.lastFrameTime = time;
    const state = gameRef.current;
    const ctx = canvasRef.current?.getContext("2d");

    if (!ctx || !canvasRef.current) return;

    const isCountdown = gameState === "countdown";
    const countdownElapsed = isCountdown ? time - state.countdownStartTime : 0;

    // --- Countdown: transition to playing when done ---
    if (isCountdown && countdownElapsed >= COUNTDOWN_DURATION_MS) {
      state.giantCarrot.y = CARROT_ROLL_UP_END_Y;
      state.giantCarrot.nextShot = 2.0;
      setGameState("playing");
    }

    // --- Update Logic ---

    // 1. Player Movement (allowed during countdown and playing) - Velocity-based with fast acceleration/deceleration
    let targetDx = 0;
    let targetDy = 0;
    const touch = state.touchMove;

    if (!state.player.stunned || state.player.stunned <= 0) {
      if (touch) {
        targetDx = touch.dx;
        targetDy = touch.dy;
      } else {
        if (state.keys.w || state.keys.ArrowUp) targetDy -= 1;
        if (state.keys.s || state.keys.ArrowDown) targetDy += 1;
        if (state.keys.a || state.keys.ArrowLeft) targetDx -= 1;
        if (state.keys.d || state.keys.ArrowRight) targetDx += 1;
        if (targetDx !== 0 || targetDy !== 0) {
          const length = Math.sqrt(targetDx * targetDx + targetDy * targetDy);
          targetDx /= length;
          targetDy /= length;
        }
      }
    } else {
        state.player.stunned -= dt;
    }

    // On mobile: instant response with no acceleration delay for immediate feel
    // On desktop: smooth acceleration for better feel
    if (isMobile) {
      // Mobile: Direct movement - instant response, no velocity smoothing
      if (targetDx !== 0 || targetDy !== 0) {
        const targetSpeed = state.player.speed;
        state.player.x += targetDx * targetSpeed;
        state.player.y += targetDy * targetSpeed;
        // Reset velocity to match for consistency
        state.player.vx = targetDx * targetSpeed;
        state.player.vy = targetDy * targetSpeed;
      } else {
        // Instant stop on mobile
        state.player.vx = 0;
        state.player.vy = 0;
      }
    } else {
      // Desktop: Velocity-based with smooth acceleration
      const ACCELERATION_FACTOR = 0.65;
      const DECELERATION_FACTOR = 0.75;
      
      const targetSpeed = state.player.speed;
      const targetVx = targetDx * targetSpeed;
      const targetVy = targetDy * targetSpeed;
      
      if (targetDx !== 0 || targetDy !== 0) {
        const dx = targetVx - state.player.vx;
        const dy = targetVy - state.player.vy;
        state.player.vx += dx * ACCELERATION_FACTOR;
        state.player.vy += dy * ACCELERATION_FACTOR;
        
        if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) {
          state.player.vx = targetVx;
          state.player.vy = targetVy;
        }
      } else {
        const speed = Math.sqrt(state.player.vx * state.player.vx + state.player.vy * state.player.vy);
        if (speed > 0.1) {
          state.player.vx *= (1 - DECELERATION_FACTOR);
          state.player.vy *= (1 - DECELERATION_FACTOR);
        } else {
          state.player.vx = 0;
          state.player.vy = 0;
        }
      }
      
      state.player.x += state.player.vx;
      state.player.y += state.player.vy;
    }

    // Boundaries (when portraitAspect, constrain player to visible center 600px to avoid cropped zones)
    if (state.portraitAspect) {
      const visibleMinX = 100;
      const visibleMaxX = 700 - state.player.width;
      state.player.x = Math.max(visibleMinX, Math.min(visibleMaxX, state.player.x));
    } else {
      state.player.x = Math.max(0, Math.min(CANVAS_WIDTH - state.player.width, state.player.x));
    }
    state.player.y = Math.max(0, Math.min(CANVAS_HEIGHT - state.player.height, state.player.y));

    // Timers: shield (Carro-Shield), speed boost (Rapid Rabbit), blaster, post-hit invincibility
    if (state.player.shieldTimer > 0) state.player.shieldTimer = Math.max(0, state.player.shieldTimer - dt);
    if (state.player.speedBoostTimer > 0) {
        state.player.speedBoostTimer = Math.max(0, state.player.speedBoostTimer - dt);
        if (state.player.speedBoostTimer <= 0) {
          state.player.speed = BASE_SPEED;
          if (rapidAmbientOnRef.current) {
            stopAmbient("rapid_rabbit_loop");
            rapidAmbientOnRef.current = false;
          }
        }
    } else {
        state.player.speed = BASE_SPEED;
    }
    if (state.player.blasterTimer > 0) state.player.blasterTimer = Math.max(0, state.player.blasterTimer - dt);
    if (state.player.attractTimer > 0) state.player.attractTimer = Math.max(0, state.player.attractTimer - dt);
    if (state.player.attractTimer <= 0 && attractAmbientOnRef.current) {
      stopAmbient("attract_loop");
      attractAmbientOnRef.current = false;
    }
    if (state.player.invincible) {
        state.player.invincibilityTimer -= dt;
        if (state.player.invincibilityTimer <= 0) {
            state.player.invincible = false;
        }
    }

    // 2. Giant Carrot Logic
    state.giantCarrot.x = 0;
    state.giantCarrot.width = CANVAS_WIDTH;
    if (isCountdown) {
      // Roll up from below screen (ease-out over countdown)
      const t = Math.min(1, countdownElapsed / COUNTDOWN_DURATION_MS);
      const easeOut = 1 - (1 - t) * (1 - t);
      state.giantCarrot.y = CARROT_ROLL_UP_START_Y + (CARROT_ROLL_UP_END_Y - CARROT_ROLL_UP_START_Y) * easeOut;
      state.giantCarrot.angle += dt * 5; // Visual roll during entrance
    } else {
      // Playing: wobble at bottom and shoot
      state.giantCarrot.y = CANVAS_HEIGHT - 120 + Math.sin(time / 200) * 10;
      state.giantCarrot.angle += dt * 5; // Visual roll

      // Shooting Spikes
      state.giantCarrot.nextShot -= dt;
      if (state.giantCarrot.nextShot <= 0) {
          const margin = 40;
          const sourceX = state.giantCarrot.x + margin + Math.random() * (state.giantCarrot.width - 2 * margin);
          const angle = Math.atan2(state.player.y - state.giantCarrot.y, state.player.x - sourceX);
          state.projectiles.push({
              x: sourceX,
              y: state.giantCarrot.y,
              width: 40,
              height: 40,
              color: "#22C55E",
              type: "spike",
              vx: Math.cos(angle) * (300 + level * 20),
              vy: Math.sin(angle) * (300 + level * 20),
              active: true,
              angle: 0
          });
          soundRef.current("carrot_shoot");
          state.giantCarrot.nextShot = Math.max(0.5, 2.0 - (level * 0.1));
      }
    }

    if (!isCountdown) {
    // 2b. Bunny Blasters: fire two lasers when space held (elongated thin lines, lower fire rate)
    const BLASTER_COOLDOWN_MS = 200; // 0.2 s between shots (3x previous rate)
    const LASER_SPEED = -1050;
    const LASER_WIDTH = 2;
    const LASER_HEIGHT = 54;
    if (state.player.blasterTimer > 0 && state.keys.space && time - state.lastBlasterShot >= BLASTER_COOLDOWN_MS) {
        state.lastBlasterShot = time;
        const cx = state.player.x + state.player.width / 2;
        const cy = state.player.y;
        const offset = 14;
        [-1, 1].forEach(sign => {
            state.projectiles.push({
                x: cx + sign * offset - LASER_WIDTH / 2,
                y: cy - LASER_HEIGHT / 2,
                width: LASER_WIDTH,
                height: LASER_HEIGHT,
                color: "#67E8F9",
                type: "player_laser",
                vx: 0,
                vy: LASER_SPEED,
                active: true,
            });
        });
        soundRef.current("blaster_shoot");
    }

    // 3. Falling Obstacles (Spiky Balls) - Stationary relative to board
    if (Math.random() < 0.01 + (level * 0.005)) {
        state.obstacles.push({
            x: Math.random() * CANVAS_WIDTH,
            y: -50,
            width: 40,
            height: 40,
            color: "#1F2937", // Dark Gray
            type: "ball",
            vx: 0,
            vy: SCROLL_SPEED * 60, // Moving down at treadmill speed (per second)
            active: true
        });
    }

    // 4. Collectibles (Carrots) - Stationary relative to board
    if (state.collectibles.length < 3 + level) {
        if (Math.random() < 0.02) {
            const typeRand = Math.random();
            let type: GameObject["type"] = "carrot";
            let color = "#F97316"; // Orange
            
            if (typeRand < 0.05) { type = "powerup_heart"; color = "#E11D48"; } // 5% heart
            else if (typeRand > 0.92) { type = "powerup_blaster"; color = "#06B6D4"; } // 8% (rate +0.2)
            else if (typeRand > 0.83) { type = "powerup_invincible"; color = "#22C55E"; } // 9%
            else if (typeRand > 0.70) { type = "powerup_speed"; color = "#EAB308"; } // 13%
            else if (typeRand > 0.58) { type = "powerup_attract"; color = "#DC2626"; } // 12% Attract-o-Hare (red magnet)

            state.collectibles.push({
                x: Math.random() * (CANVAS_WIDTH - (type === "carrot" ? 50 : 40)),
                y: -50, // Spawn at top
                width: type === "carrot" ? 40 : 30,
                height: type === "carrot" ? 40 : 30,
                color: color,
                type: type,
                vx: 0,
                vy: SCROLL_SPEED * 60, // Moving down at treadmill speed
                active: true,
                ...(type === "carrot" && { face: Math.floor(Math.random() * 6) })
            });
        }
    }

    // --- Update Entities ---
    [...state.projectiles, ...state.obstacles, ...state.collectibles].forEach(obj => {
        obj.x += obj.vx * dt;
        obj.y += obj.vy * dt;
        if (obj.type === "spike" && obj.angle !== undefined) obj.angle += dt * 12;
        // Remove out of bounds
        if (obj.y > CANVAS_HEIGHT + 100 || obj.y < -200 || obj.x < -100 || obj.x > CANVAS_WIDTH + 100) {
            obj.active = false;
        }
    });

    // Attract-o-Hare: carrots accelerate straight toward the avatar
    if (state.player.attractTimer > 0) {
        const px = state.player.x + state.player.width / 2;
        const py = state.player.y + state.player.height / 2;
        // dt is already in seconds (see gameLoop: dt = (time - lastFrameTime) / 1000)
        state.collectibles.forEach(obj => {
            if (!obj.active || obj.type !== "carrot") return;
            const cx = obj.x + obj.width / 2;
            const cy = obj.y + obj.height / 2;
            const dx = px - cx;
            const dy = py - cy;
            const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
            if (d > ATTRACT_RADIUS) return;
            const nx = dx / d;
            const ny = dy / d;
            // Velocity is purely toward the avatar; speed accelerates each frame up to cap
            const currentTowardSpeed = obj.vx * nx + obj.vy * ny;
            const newSpeed = Math.min(Math.max(0, currentTowardSpeed) + ATTRACT_STRENGTH * dt, ATTRACT_MAX_CARROT_SPEED);
            obj.vx = nx * newSpeed;
            obj.vy = ny * newSpeed;
            obj.x = Math.max(0, Math.min(CANVAS_WIDTH - obj.width, obj.x));
            obj.y = Math.max(0, Math.min(CANVAS_HEIGHT - obj.height, obj.y));
        });
    }

    // Spiky ball vs spiky ball collision (bounce off each other)
    const balls = state.obstacles.filter(o => o.active && o.type === "ball");
    for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
            const a = balls[i];
            const b = balls[j];
            const ax = a.x + a.width / 2;
            const ay = a.y + a.height / 2;
            const bx = b.x + b.width / 2;
            const by = b.y + b.height / 2;
            const ra = a.width / 2;
            const rb = b.width / 2;
            const dx = bx - ax;
            const dy = by - ay;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1e-6;
            const overlap = ra + rb - dist;
            if (overlap > 0) {
                const nx = dx / dist;
                const ny = dy / dist;
                // Separate so they don't overlap
                a.x -= nx * (overlap * 0.5);
                a.y -= ny * (overlap * 0.5);
                b.x += nx * (overlap * 0.5);
                b.y += ny * (overlap * 0.5);
                // Elastic bounce: swap velocity components along normal
                const v1n = a.vx * nx + a.vy * ny;
                const v2n = b.vx * nx + b.vy * ny;
                a.vx += (v2n - v1n) * nx;
                a.vy += (v2n - v1n) * ny;
                b.vx += (v1n - v2n) * nx;
                b.vy += (v1n - v2n) * ny;
            }
        }
    }

    // Laser vs spiky ball: destroy ball, apply explosion physics to nearby balls
    const EXPLOSION_RADIUS = 110;
    const PUSH_STRENGTH = 380;
    state.projectiles.forEach(proj => {
        if (!proj.active || proj.type !== "player_laser") return;
        state.obstacles.forEach(ball => {
            if (!ball.active || ball.type !== "ball") return;
            if (!checkCollision(proj, ball)) return;
            proj.active = false;
            const ex = ball.x + ball.width / 2;
            const ey = ball.y + ball.height / 2;
            ball.active = false;
            soundRef.current("ball_explode");
            state.explosions.push({ x: ex, y: ey, startTime: time, duration: 400 }); // duration in ms
            setScore(s => s + 5);
            // 10% chance to drop a heart at the ball's position
            if (Math.random() < 0.1) {
                state.collectibles.push({
                    x: ball.x,
                    y: ball.y,
                    width: 30,
                    height: 30,
                    color: "#E11D48",
                    type: "powerup_heart",
                    vx: 0,
                    vy: SCROLL_SPEED * 60,
                    active: true
                });
            }
            state.obstacles.forEach(other => {
                if (!other.active || other.type !== "ball" || other === ball) return;
                const ox = other.x + other.width / 2;
                const oy = other.y + other.height / 2;
                const ddx = ox - ex;
                const ddy = oy - ey;
                const d = Math.sqrt(ddx * ddx + ddy * ddy) || 1e-6;
                if (d >= EXPLOSION_RADIUS) return;
                const factor = (1 - d / EXPLOSION_RADIUS) * PUSH_STRENGTH;
                const nx = ddx / d;
                const ny = ddy / d;
                other.vx += nx * factor;
                other.vy += ny * factor;
                const maxV = 400;
                const v = Math.sqrt(other.vx * other.vx + other.vy * other.vy);
                if (v > maxV) {
                    other.vx *= maxV / v;
                    other.vy *= maxV / v;
                }
            });
        });
    });

    // Remove expired explosions
    state.explosions = state.explosions.filter(e => (time - e.startTime) < e.duration);

    // Collision with Player
    [...state.projectiles, ...state.obstacles, ...state.collectibles].forEach(obj => {
        if (obj.type === "player_laser") return;
        if (obj.active && checkCollision(state.player, obj)) {
            if (obj.type === "spike" || obj.type === "ball") {
                const hasShield = state.player.shieldTimer > 0;
                if (hasShield) {
                    const now = Date.now();
                    if (now - shieldDeflectLastPlayedRef.current >= 500) {
                        shieldDeflectLastPlayedRef.current = now;
                        soundRef.current("shield_deflect");
                    }
                    if (obj.type === "ball") setScore(s => s + 5); // 5 points for deflecting a spiky ball with shield
                    // Bounce off shield: reflect velocity away from player
                    const px = state.player.x + state.player.width / 2;
                    const py = state.player.y + state.player.height / 2;
                    const ox = obj.x + obj.width / 2;
                    const oy = obj.y + obj.height / 2;
                    const dx = ox - px;
                    const dy = oy - py;
                    const len = Math.sqrt(dx * dx + dy * dy) || 1;
                    const nx = dx / len;
                    const ny = dy / len;
                    const speed = Math.sqrt(obj.vx * obj.vx + obj.vy * obj.vy);
                    obj.vx = nx * speed;
                    obj.vy = ny * speed;
                } else if (
                    !damageDisabledRef.current &&
                    state.player.speedBoostTimer <= 0 &&
                    !(state.player.invincible && state.player.invincibilityTimer > 0)
                ) {
                    obj.active = false;
                    soundRef.current("hit_damage");
                    state.player.stunned = 0.5; // Stun on hit
                    state.giantCarrot.face = Math.floor(Math.random() * 6);
                    setLives(l => {
                        const newLives = l - 1;
                        gameRef.current.lives = newLives;
                        if (newLives < 10) gameRef.current.sparkleTrail = [];
                        if (newLives <= 0) {
                            endGame();
                            return 0;
                        }
                        state.player.invincible = true;
                        state.player.invincibilityTimer = 1.0;
                        return newLives;
                    });
                }
            }
        }
    });

    state.collectibles.forEach(obj => {
        if (obj.active && checkCollision(state.player, obj)) {
            obj.active = false;
            if (obj.type === "carrot") {
                soundRef.current("carrot_collect");
                setScore(s => s + 10 * level);
                setCarrotsCollected(c => {
                    const next = c + 1;
                    if (next >= 10) {
                        levelUp();
                        return 0;
                    }
                    return next;
                });
            } else if (obj.type === "powerup_invincible") {
                soundRef.current("powerup_shield");
                state.player.shieldTimer = 5.0;
                state.giantCarrot.face = Math.floor(Math.random() * 6);
            } else if (obj.type === "powerup_speed") {
                soundRef.current("powerup_speed");
                state.player.speedBoostTimer = 5.0;
                state.player.speed = BASE_SPEED * 1.5;
                playAmbient("rapid_rabbit_loop");
                rapidAmbientOnRef.current = true;
                state.giantCarrot.face = Math.floor(Math.random() * 6);
            } else if (obj.type === "powerup_blaster") {
                soundRef.current("powerup_speed");
                state.player.blasterTimer = 10.0;
                state.giantCarrot.face = Math.floor(Math.random() * 6);
            } else if (obj.type === "powerup_attract") {
                soundRef.current("powerup_attract");
                state.player.attractTimer = 6.0;
                playAmbient("attract_loop");
                attractAmbientOnRef.current = true;
                state.giantCarrot.face = Math.floor(Math.random() * 6);
            } else if (obj.type === "powerup_heart") {
                soundRef.current("powerup_heart");
                setLives(l => {
                  const next = Math.min(l + 1, 10);
                  gameRef.current.lives = next;
                  if (next === 10) {
                    gameRef.current.maxHeartsExplosionStartTime = time;
                    pauseMusic();
                    playAmbient("golden_bunny_loop");
                    goldenBunnyAmbientOnRef.current = true;
                    if (!gameRef.current.maxHeartsBonusAwarded) {
                      gameRef.current.maxHeartsBonusAwarded = true;
                      setScore(s => s + 500);
                    }
                    // 3 seconds of invincibility when achieving MAX
                    state.player.invincible = true;
                    state.player.invincibilityTimer = 3.0;
                    // Explosion destroys nearby projectiles (broccoli) and spiky balls
                    const px = state.player.x + state.player.width / 2;
                    const py = state.player.y + state.player.height / 2;
                    const MAX_HEARTS_BLAST_RADIUS = 500;
                    state.projectiles.forEach(proj => {
                      if (!proj.active || proj.type === "player_laser") return;
                      const cx = proj.x + proj.width / 2;
                      const cy = proj.y + proj.height / 2;
                      const d = Math.hypot(cx - px, cy - py);
                      if (d < MAX_HEARTS_BLAST_RADIUS) proj.active = false;
                    });
                    state.obstacles.forEach(ball => {
                      if (!ball.active || ball.type !== "ball") return;
                      const bx = ball.x + ball.width / 2;
                      const by = ball.y + ball.height / 2;
                      const d = Math.hypot(bx - px, by - py);
                      if (d < MAX_HEARTS_BLAST_RADIUS) {
                        ball.active = false;
                        soundRef.current("ball_explode");
                        state.explosions.push({ x: bx, y: by, startTime: time, duration: 400 });
                        setScore(s => s + 5);
                      }
                    });
                  }
                  return next;
                });
            }
        }
    });

    // Collision with Giant Carrot (Instant Death)
    const safeFromCarrot =
      damageDisabledRef.current ||
      (state.player.invincible && state.player.invincibilityTimer > 0) ||
      state.player.speedBoostTimer > 0;
    if (checkCollision(state.player, state.giantCarrot) && !safeFromCarrot) {
        gameRef.current.lives = 0;
        gameRef.current.sparkleTrail = [];
        setLives(0);
        endGame();
    }

    // Cleanup arrays
    state.projectiles = state.projectiles.filter(o => o.active);
    state.obstacles = state.obstacles.filter(o => o.active);
    state.collectibles = state.collectibles.filter(o => o.active);
    }

    // --- Render ---
    const scroller = backgroundScrollerRef.current;
    if (scroller) {
      scroller.update(dt);
      scroller.render(ctx);
      // Fullscreen bezel: render scroller to buffer and copy slices to left/right strips
      if (gameRef.current.isFullscreen && scrollerBufferRef.current && leftBezelCanvasRef.current && rightBezelCanvasRef.current && leftBezelContainerRef.current && rightBezelContainerRef.current) {
        const buf = scrollerBufferRef.current;
        const bufCtx = buf.getContext("2d");
        if (bufCtx) {
          scroller.render(bufCtx);
          const leftDiv = leftBezelContainerRef.current;
          const rightDiv = rightBezelContainerRef.current;
          const lw = leftDiv.offsetWidth;
          const lh = leftDiv.offsetHeight;
          const rw = rightDiv.offsetWidth;
          const rh = rightDiv.offsetHeight;
          const slice = 100;
          leftBezelCanvasRef.current.width = lw;
          leftBezelCanvasRef.current.height = lh;
          rightBezelCanvasRef.current.width = rw;
          rightBezelCanvasRef.current.height = rh;
          const lctx = leftBezelCanvasRef.current.getContext("2d");
          const rctx = rightBezelCanvasRef.current.getContext("2d");
          if (lctx) lctx.drawImage(buf, 0, 0, slice, CANVAS_HEIGHT, 0, 0, lw, lh);
          if (rctx) rctx.drawImage(buf, CANVAS_WIDTH - slice, 0, slice, CANVAS_HEIGHT, 0, 0, rw, rh);
        }
      }
    } else {
      drawEarthBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, time);
    }

    if (!hazeLayerRef.current) {
      hazeLayerRef.current = new HazeLayer(CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    hazeLayerRef.current.render(ctx, time / 1000);

    if (scroller) scroller.renderWaterShimmer(ctx);

    // Draw Giant Carrot
    ctx.save();
    ctx.translate(CANVAS_WIDTH / 2, state.giantCarrot.y + 60);
    
    // Log-like roll animation (vertical shift of ridges) — reversed direction
    const rollOffset = (60 - (time / 5) % 60) % 60;
    
    // Realistic Giant Carrot body (Log shape)
    const gradient = ctx.createLinearGradient(0, -60, 0, 60);
    gradient.addColorStop(0, "#EA580C");
    gradient.addColorStop(0.5, "#F97316");
    gradient.addColorStop(1, "#EA580C");
    ctx.fillStyle = gradient;
    
    ctx.beginPath();
    ctx.roundRect(-CANVAS_WIDTH / 2 - 20, -60, CANVAS_WIDTH + 40, 120, 20);
    ctx.fill();
    
    // Ridges (rolling log effect) — thick, soft, low opacity
    ctx.save();
    ctx.strokeStyle = "rgba(0,0,0,0.08)";
    ctx.lineWidth = 10;
    ctx.shadowColor = "rgba(0,0,0,0.15)";
    ctx.shadowBlur = 8;
    for (let i = -120; i < 120; i += 60) {
      const yPos = i + rollOffset - 60;
      if (yPos > -60 && yPos < 60) {
        ctx.beginPath();
        ctx.moveTo(-CANVAS_WIDTH / 2, yPos);
        ctx.lineTo(CANVAS_WIDTH / 2, yPos);
        ctx.stroke();
      }
    }
    ctx.restore();
    // Giant carrot face (changes on hit, level-up, power-up)
    drawCarrotFace(ctx, state.giantCarrot.face ?? 0, 0, 0, 58);
    ctx.restore();

    // Draw Collectibles (carrot = carrot shape; powerups = shield / lightning like main page)
    state.collectibles.forEach(obj => {
        ctx.save();
        ctx.translate(obj.x + obj.width/2, obj.y + obj.height/2);

        if (obj.type === "powerup_invincible") {
            // Shield icon (green box + shield shape, same as main page)
            const hw = obj.width / 2;
            const hh = obj.height / 2;
            ctx.fillStyle = "#22c55e";
            ctx.strokeStyle = "#86efac";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-hw, -hh, obj.width, obj.height, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.moveTo(0, -hh * 0.5);
            ctx.lineTo(hw * 0.5, -hh * 0.2);
            ctx.lineTo(hw * 0.45, hh * 0.2);
            ctx.lineTo(0, hh * 0.55);
            ctx.lineTo(-hw * 0.45, hh * 0.2);
            ctx.lineTo(-hw * 0.5, -hh * 0.2);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (obj.type === "powerup_speed") {
            // Lightning icon (yellow box + bolt, same as main page)
            const hw = obj.width / 2;
            const hh = obj.height / 2;
            ctx.fillStyle = "#eab308";
            ctx.strokeStyle = "#fde047";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-hw, -hh, obj.width, obj.height, 4);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.moveTo(hw * 0.15, -hh * 0.6);
            ctx.lineTo(-hw * 0.35, hh * 0.1);
            ctx.lineTo(hw * 0.1, hh * 0.1);
            ctx.lineTo(-hw * 0.4, hh * 0.65);
            ctx.lineTo(-hw * 0.15, hh * 0.05);
            ctx.lineTo(-hw * 0.5, hh * 0.05);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
            ctx.lineWidth = 1;
            ctx.stroke();
        } else if (obj.type === "powerup_blaster") {
            // Bunny Blasters: cyan box + two parallel laser lines
            const hw = obj.width / 2;
            const hh = obj.height / 2;
            ctx.fillStyle = "#06B6D4";
            ctx.strokeStyle = "#22D3EE";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-hw, -hh, obj.width, obj.height, 4);
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-hw * 0.35, hh * 0.5);
            ctx.lineTo(-hw * 0.35, -hh * 0.5);
            ctx.moveTo(hw * 0.35, hh * 0.5);
            ctx.lineTo(hw * 0.35, -hh * 0.5);
            ctx.stroke();
        } else if (obj.type === "powerup_heart") {
            // Heart shape — same size as other power-ups (full hw/hh)
            const hw = obj.width / 2;
            const hh = obj.height / 2;
            ctx.fillStyle = "#E11D48";
            ctx.strokeStyle = "#F43F5E";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0, hh * 0.45);
            ctx.bezierCurveTo(-hw, -hh * 0.2, -hw * 0.55, -hh * 0.95, 0, -hh * 0.35);
            ctx.bezierCurveTo(hw * 0.55, -hh * 0.95, hw, -hh * 0.2, 0, hh * 0.45);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        } else if (obj.type === "powerup_attract") {
            // Attract-o-Hare: red box + magnet emoji (same as Home page)
            const hw = obj.width / 2;
            const hh = obj.height / 2;
            ctx.fillStyle = "#DC2626";
            ctx.strokeStyle = "#F87171";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(-hw, -hh, obj.width, obj.height, 4);
            ctx.fill();
            ctx.stroke();
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.font = `${Math.round(obj.height * 0.72)}px sans-serif`;
            ctx.rotate(-Math.PI / 2);
            ctx.fillText("🧲", 0, 0);
        } else {
            // Regular carrot — SVG body (30×30) + existing face
            const hw = obj.width / 2;
            const hh = obj.height / 2;
            const img = carrotImageRef.current;
            if (img) {
                ctx.drawImage(img, -hw, -hh, obj.width, obj.height);
            } else {
                // Fallback until SVG image has loaded
                const bodyGrad = ctx.createLinearGradient(-hw * 0.8, 0, hw * 0.8, 0);
                bodyGrad.addColorStop(0, "#C2410C");
                bodyGrad.addColorStop(0.25, "#EA580C");
                bodyGrad.addColorStop(0.5, "#FB923C");
                bodyGrad.addColorStop(0.75, "#EA580C");
                bodyGrad.addColorStop(1, "#B45309");
                ctx.fillStyle = bodyGrad;
                ctx.beginPath();
                ctx.moveTo(0, hh);
                ctx.lineTo(-hw * 0.95, -hh * 0.95);
                ctx.lineTo(hw * 0.95, -hh * 0.95);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
                ctx.lineWidth = 2;
                ctx.stroke();
                const stemGrad = ctx.createLinearGradient(0, -hh - 8, 0, -hh);
                stemGrad.addColorStop(0, "#15803D");
                stemGrad.addColorStop(0.5, "#22C55E");
                stemGrad.addColorStop(1, "#16A34A");
                ctx.fillStyle = stemGrad;
                ctx.fillRect(-2.5, -hh - 6, 5, 6);
                ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
                ctx.lineWidth = 1;
                ctx.strokeRect(-2.5, -hh - 6, 5, 6);
            }
            drawCarrotFace(ctx, obj.face ?? 0, 0, obj.height * 0.08, 27, true); // scale for 40×40 carrots; compact face
        }
        ctx.restore();
    });

    // Draw Projectiles (broccoli spikes or player lasers)
    state.projectiles.forEach(obj => {
        ctx.save();
        const cx = obj.x + obj.width / 2;
        const cy = obj.y + obj.height / 2;
        ctx.translate(cx, cy);
        if (obj.type === "player_laser") {
            const w = obj.width;
            const h = obj.height;
            ctx.strokeStyle = "rgba(34, 211, 238, 1)";
            ctx.lineWidth = Math.max(2, w);
            ctx.lineCap = "round";
            ctx.shadowColor = "#67E8F9";
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(0, -h / 2);
            ctx.lineTo(0, h / 2);
            ctx.stroke();
            ctx.shadowBlur = 0;
            ctx.restore();
            return;
        }
        ctx.rotate(obj.angle ?? 0);
        const w = obj.width;
        const h = obj.height;
        const brocImg = broccoliImageRef.current;
        if (brocImg) {
            ctx.drawImage(brocImg, -w / 2, -h / 2, w, h);
        } else {
            // Fallback until broccoli SVG has loaded
            const sx = -w * 0.2;
            const sy = h * 0.35;
            const sw = w * 0.4;
            const sh = h * 0.65;
            const sr = Math.min(sw, sh) * 0.25;
            const pi = Math.PI;
            ctx.fillStyle = "#22c55e";
            ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(sx + sr, sy);
            ctx.lineTo(sx + sw - sr, sy);
            ctx.arc(sx + sw - sr, sy + sr, sr, -pi / 2, 0);
            ctx.lineTo(sx + sw, sy + sh - sr);
            ctx.arc(sx + sw - sr, sy + sh - sr, sr, 0, pi / 2);
            ctx.lineTo(sx + sr, sy + sh);
            ctx.arc(sx + sr, sy + sh - sr, sr, pi / 2, pi);
            ctx.lineTo(sx, sy + sr);
            ctx.arc(sx + sr, sy + sr, sr, pi, pi * 1.5);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#34d399";
            ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
            ctx.lineWidth = 2.5;
            const centers = [[0, -h * 0.15], [-w * 0.28, h * 0.1], [w * 0.25, h * 0.05], [-w * 0.12, h * 0.25], [w * 0.15, h * 0.22]];
            const radii = [h * 0.28, h * 0.2, h * 0.2, h * 0.15, h * 0.15];
            centers.forEach(([x, y], i) => {
                ctx.beginPath();
                ctx.arc(x, y, radii[i], 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });
        }
        ctx.restore();
    });

    // Draw Obstacles
    state.obstacles.forEach(obj => {
        ctx.save();
        ctx.translate(obj.x + obj.width/2, obj.y + obj.height/2);
        ctx.rotate(time / 200); // Rotate balls

        const ballImg = spikyBallImageRef.current;
        if (ballImg) {
            ctx.drawImage(ballImg, -obj.width / 2, -obj.height / 2, obj.width, obj.height);
        } else {
            const ballGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, obj.width/2);
            ballGrad.addColorStop(0, "#4B5563");
            ballGrad.addColorStop(1, "#111827");
            ctx.fillStyle = ballGrad;
            ctx.beginPath();
            ctx.arc(0, 0, obj.width/2, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.fillStyle = "#111827";
            for(let i=0; i<12; i++) {
                const angle = (i / 12) * Math.PI * 2;
                ctx.save();
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(obj.width/2 - 2, -4);
                ctx.lineTo(obj.width/2 + 10, 0);
                ctx.lineTo(obj.width/2 - 2, 4);
                ctx.fill();
                ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.restore();
            }
        }
        ctx.restore();
    });

    // Draw explosions (spiky ball destroyed by laser; startTime/duration in ms)
    state.explosions.forEach(e => {
        const elapsed = time - e.startTime;
        if (elapsed >= e.duration) return;
        const t = elapsed / e.duration; // t in [0, 1]
        const radius = 15 + t * 45;
        const alpha = 1 - t;
        ctx.save();
        ctx.translate(e.x, e.y);
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
        grad.addColorStop(0, `rgba(251, 146, 60, ${alpha * 0.9})`);
        grad.addColorStop(0.4, `rgba(234, 88, 12, ${alpha * 0.5})`);
        grad.addColorStop(0.8, `rgba(120, 53, 15, ${alpha * 0.2})`);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Draw Player — front-facing rabbit avatar (rounded body, ears, cheek tufts, tail)
    const px = state.player.x;
    const py = state.player.y;
    const pw = state.player.width;
    const ph = state.player.height;
    const cx = px + pw / 2;
    const cy = py + ph / 2;

    // Max hearts (10): SUPER SAIYAN–style explosion of light when just reached 10
    const maxHeartsExplosionDuration = 1200;
    if (state.maxHeartsExplosionStartTime != null) {
      const elapsed = time - state.maxHeartsExplosionStartTime;
      if (elapsed >= maxHeartsExplosionDuration) {
        state.maxHeartsExplosionStartTime = null;
      } else {
        const t = elapsed / maxHeartsExplosionDuration;
        ctx.save();
        ctx.translate(cx, cy);
        // Core: blinding white burst that expands fast then fades
        const coreRadius = 20 + t * 280;
        const coreAlpha = t < 0.15 ? (t / 0.15) : (1 - (t - 0.15) / 0.85) * 0.98;
        const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreRadius);
        coreGrad.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha})`);
        coreGrad.addColorStop(0.15, `rgba(255, 255, 230, ${coreAlpha * 0.85})`);
        coreGrad.addColorStop(0.4, `rgba(255, 236, 120, ${coreAlpha * 0.4})`);
        coreGrad.addColorStop(0.7, `rgba(255, 200, 0, ${coreAlpha * 0.12})`);
        coreGrad.addColorStop(1, "rgba(255, 180, 0, 0)");
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
        ctx.fill();
        // Second wave: golden ring that lags and expands (dramatic pulse)
        const ringT = Math.max(0, (elapsed - 80) / (maxHeartsExplosionDuration - 80));
        const ringRadius = 40 + ringT * 320;
        const ringAlpha = (1 - ringT) * 0.7;
        ctx.strokeStyle = `rgba(255, 255, 200, ${ringAlpha})`;
        ctx.lineWidth = 12 - ringT * 10;
        ctx.beginPath();
        ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
        // Third: outer flame-like spikes (simplified as radial lines that fade)
        const spikeT = Math.max(0, (elapsed - 150) / 900);
        const spikeR = 60 + spikeT * 260;
        const spikeAlpha = (1 - spikeT) * 0.5;
        ctx.strokeStyle = `rgba(255, 220, 100, ${spikeAlpha})`;
        ctx.lineWidth = 3;
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * Math.PI * 2 + (elapsed / 30) * 0.02;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(a) * spikeR, Math.sin(a) * spikeR);
          ctx.stroke();
        }
        ctx.restore();
      }
    }

    const invincibleFromHit = state.player.invincible && state.player.invincibilityTimer > 0;
    const hasShieldBubble = state.player.shieldTimer > 0;
    const isMaxHearts = state.lives === 10;

    // Glitter trail when at max hearts: add position every 40ms, prune after 1.4s
    if (isMaxHearts) {
      const last = state.sparkleTrail[state.sparkleTrail.length - 1];
      if (!last || time - last.startTime > 40) state.sparkleTrail.push({ x: cx, y: cy, startTime: time });
      state.sparkleTrail = state.sparkleTrail.filter(s => time - s.startTime < 1400);
    }
    // Draw glitter trail (sharp star/diamond shapes, twinkling — not bubbles)
    if (state.sparkleTrail.length > 0) {
      state.sparkleTrail.forEach((s, i) => {
        const age = time - s.startTime;
        const life = 1 - age / 1400;
        if (life <= 0) return;
        const twinkle = 0.6 + 0.4 * Math.sin(age / 80 + i * 2.1);
        const alpha = life * twinkle;
        const size = 2.5 + (1 - life) * 1.5;
        const rot = (age / 60 + i * 0.5) % (Math.PI * 2);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(rot);
        ctx.fillStyle = `rgba(255, 252, 240, ${alpha * 0.95})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.8})`;
        ctx.lineWidth = 0.8;
        // 4-point star (diamond / glitter)
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.4, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.4, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(0, size * 0.4);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, -size * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      });
    }

    // Blinking when player is hit (brief invincibility after damage)
    if (invincibleFromHit && state.player.invincibilityTimer <= 1.5) {
      ctx.globalAlpha = 0.5 + Math.sin(time / 50) * 0.5;
    }

    // Max hearts: SUPER SAIYAN–style aura (multiple layers, big and dramatic)
    if (isMaxHearts && !hasShieldBubble) {
      ctx.save();
      ctx.translate(cx, cy);
      const pulse = 1 + Math.sin(time / 90) * 0.12;
      const breath = 1 + Math.sin(time / 180) * 0.08;
      const r = Math.max(pw, ph) * 1.6 * pulse;
      // Outer flame layer: elongated upward, intense gold
      const outerR = r * 1.4 * breath;
      const outerGrad = ctx.createRadialGradient(0, -outerR * 0.2, 0, 0, 0, outerR);
      outerGrad.addColorStop(0, "rgba(255, 255, 200, 0)");
      outerGrad.addColorStop(0.4, "rgba(255, 200, 50, 0.35)");
      outerGrad.addColorStop(0.7, "rgba(255, 180, 0, 0.2)");
      outerGrad.addColorStop(1, "rgba(255, 150, 0, 0)");
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.15, outerR, outerR * 1.1, 0, 0, Math.PI * 2);
      ctx.fill();
      // Middle aura: bright gold
      const midGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
      midGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
      midGrad.addColorStop(0.2, "rgba(255, 248, 180, 0.75)");
      midGrad.addColorStop(0.5, "rgba(255, 220, 80, 0.5)");
      midGrad.addColorStop(0.8, "rgba(255, 193, 7, 0.25)");
      midGrad.addColorStop(1, "rgba(255, 193, 7, 0)");
      ctx.fillStyle = midGrad;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
      ctx.fill();
      // Inner core glow
      const innerR = r * 0.5;
      const innerGrad = ctx.createRadialGradient(-innerR * 0.3, -innerR * 0.3, 0, 0, 0, innerR);
      innerGrad.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      innerGrad.addColorStop(0.5, "rgba(255, 240, 150, 0.6)");
      innerGrad.addColorStop(1, "rgba(255, 220, 80, 0)");
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(0, 0, innerR, 0, Math.PI * 2);
      ctx.fill();
      // Sharp outline
      ctx.strokeStyle = "rgba(255, 255, 220, 0.7)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.92, r * 0.92, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Shield power-up: larger, brighter, reflective bubble (Carro-Shield); flicker when about to expire
    const SHIELD_FLICKER_THRESHOLD = 1.5; // seconds left when flicker starts
    const shieldFlicker = state.player.shieldTimer > 0 && state.player.shieldTimer < SHIELD_FLICKER_THRESHOLD;
    if (hasShieldBubble && (!shieldFlicker || Math.floor(time / 80) % 2 === 0)) {
      ctx.save();
      if (shieldFlicker) ctx.globalAlpha = 0.5 + Math.sin(time / 70) * 0.5;
      ctx.translate(cx, cy);
      const bubblePulse = 1 + Math.sin(time / 120) * 0.04;
      const r = Math.max(pw, ph) * 0.92 * bubblePulse;
      const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.55)");
      grad.addColorStop(0.35, "rgba(200, 245, 255, 0.45)");
      grad.addColorStop(0.7, "rgba(120, 220, 255, 0.35)");
      grad.addColorStop(1, "rgba(80, 200, 255, 0.2)");
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r, 0, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Reflection highlight
      ctx.beginPath();
      ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.2, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fill();
      ctx.restore();
    }

    // Attract-o-Hare: inward-shrinking red ripples (magnet attractor)
    const isAttractPowerUp = state.player.attractTimer > 0;
    if (isAttractPowerUp) {
      const rippleAlpha = state.player.attractTimer < ATTRACT_FADE_THRESHOLD
        ? (state.player.attractTimer / ATTRACT_FADE_THRESHOLD) * 0.35
        : 0.35;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.strokeStyle = `rgba(220, 38, 38, ${rippleAlpha})`;
      ctx.lineWidth = 2;
      const Rmax = Math.max(pw, ph) * RIPPLE_MAX_RADIUS_FACTOR;
      const phaseOffset = RIPPLE_PERIOD_MS / 5;
      for (let ring = 0; ring < 5; ring++) {
        const phase = (time + ring * phaseOffset) % RIPPLE_PERIOD_MS;
        const radius = Rmax * (1 - phase / RIPPLE_PERIOD_MS);
        if (radius <= 0) continue;
        ctx.beginPath();
        ctx.ellipse(0, 0, radius, radius, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }

    const SPEED_FLICKER_THRESHOLD = 1.5;
    const speedBoostFlicker = state.player.speedBoostTimer > 0 && state.player.speedBoostTimer < SPEED_FLICKER_THRESHOLD;
    const isSpeedPowerUp = state.player.speedBoostTimer > 0 && (!speedBoostFlicker || Math.floor(time / 80) % 2 === 0);
    if (isSpeedPowerUp && speedBoostFlicker) {
      ctx.save();
      ctx.globalAlpha = 0.5 + Math.sin(time / 70) * 0.5;
    }

    // Attract-o-Hare expiry: fade red theme gently
    if (isAttractPowerUp && state.player.attractTimer < ATTRACT_FADE_THRESHOLD) {
      ctx.save();
      ctx.globalAlpha = state.player.attractTimer / ATTRACT_FADE_THRESHOLD;
    }

    // Drop shadow (oval, offset down-right)
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 4;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy + 4, pw * 0.45, ph * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    ctx.restore();
    // Body — rounded blue head/body with glossy shading (highlight top, darker sides/bottom)
    if (isSpeedPowerUp) {
      const bodyHue = (time / 25) % 360;
      const bodyGrad = ctx.createRadialGradient(cx - pw * 0.2, cy - ph * 0.25, 0, cx, cy, pw * 0.5);
      bodyGrad.addColorStop(0, `hsl(${bodyHue}, 80%, 82%)`);
      bodyGrad.addColorStop(0.4, `hsl(${(bodyHue + 90) % 360}, 75%, 72%)`);
      bodyGrad.addColorStop(0.85, `hsl(${(bodyHue + 180) % 360}, 70%, 58%)`);
      bodyGrad.addColorStop(1, `hsl(${(bodyHue + 240) % 360}, 70%, 50%)`);
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    } else if (isMaxHearts) {
      const bodyGrad = ctx.createRadialGradient(cx - pw * 0.2, cy - ph * 0.25, 0, cx, cy, pw * 0.5);
      bodyGrad.addColorStop(0, "#fff8dc");
      bodyGrad.addColorStop(0.4, "#ffd700");
      bodyGrad.addColorStop(0.85, "#daa520");
      bodyGrad.addColorStop(1, "#b8860b");
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = "rgba(255, 235, 59, 0.9)";
    } else if (isAttractPowerUp) {
      const bodyGrad = ctx.createRadialGradient(cx - pw * 0.2, cy - ph * 0.25, 0, cx, cy, pw * 0.5);
      bodyGrad.addColorStop(0, "#F87171");
      bodyGrad.addColorStop(0.4, "#DC2626");
      bodyGrad.addColorStop(0.85, "#B91C1C");
      bodyGrad.addColorStop(1, "#991B1B");
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    } else {
      const bodyGrad = ctx.createRadialGradient(cx - pw * 0.2, cy - ph * 0.25, 0, cx, cy, pw * 0.5);
      bodyGrad.addColorStop(0, "#8bb8e8");
      bodyGrad.addColorStop(0.35, "#6b9bd1");
      bodyGrad.addColorStop(0.75, "#4a7ab8");
      bodyGrad.addColorStop(1, "#3d6ba3");
      ctx.fillStyle = bodyGrad;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    }
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy, pw * 0.42, ph * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Ears — two large ovals (blue outer + white inner), protruding upward
    const earOuterW = 6;
    const earOuterH = 14;
    const earInnerW = 3.5;
    const earInnerH = 10;
    const earY = py + 2;
    if (isSpeedPowerUp) {
      const earHue = (time / 22 + 30) % 360;
      const earGrad = ctx.createLinearGradient(cx, earY - 2, cx, earY + earOuterH);
      earGrad.addColorStop(0, `hsl(${earHue}, 85%, 78%)`);
      earGrad.addColorStop(0.5, `hsl(${(earHue + 70) % 360}, 80%, 68%)`);
      earGrad.addColorStop(1, `hsl(${(earHue + 140) % 360}, 75%, 55%)`);
      ctx.fillStyle = earGrad;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    } else if (isMaxHearts) {
      const earGrad = ctx.createLinearGradient(cx, earY - 2, cx, earY + earOuterH);
      earGrad.addColorStop(0, "#fffacd");
      earGrad.addColorStop(0.5, "#ffd700");
      earGrad.addColorStop(1, "#b8860b");
      ctx.fillStyle = earGrad;
      ctx.strokeStyle = "rgba(255, 235, 59, 0.8)";
    } else if (isAttractPowerUp) {
      const earGrad = ctx.createLinearGradient(cx, earY - 2, cx, earY + earOuterH);
      earGrad.addColorStop(0, "#FCA5A5");
      earGrad.addColorStop(0.5, "#DC2626");
      earGrad.addColorStop(1, "#991B1B");
      ctx.fillStyle = earGrad;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    } else {
      const earGrad = ctx.createLinearGradient(cx, earY - 2, cx, earY + earOuterH);
      earGrad.addColorStop(0, "#8bb8e8");
      earGrad.addColorStop(0.5, "#6b9bd1");
      earGrad.addColorStop(1, "#3d6ba3");
      ctx.fillStyle = earGrad;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    }
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx - 9, earY + 5, earOuterW, earOuterH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 9, earY + 5, earOuterW, earOuterH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Ear inners (white/off-white with subtle highlight)
    if (isSpeedPowerUp) {
      ctx.fillStyle = `hsla(${(time / 20) % 360}, 60%, 95%, 0.95)`;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    } else if (isMaxHearts) {
      ctx.fillStyle = "#fffef0";
      ctx.strokeStyle = "rgba(255, 235, 59, 0.7)";
    } else if (isAttractPowerUp) {
      ctx.fillStyle = "#FFE4E4";
      ctx.strokeStyle = "rgba(220, 38, 38, 0.5)";
    } else {
      const innerEarGrad = ctx.createRadialGradient(cx - 10, earY, 0, cx - 9, earY + 4, earInnerW * 2);
      innerEarGrad.addColorStop(0, "#f8fcff");
      innerEarGrad.addColorStop(0.6, "#f0f4f8");
      innerEarGrad.addColorStop(1, "#e8ecf0");
      ctx.fillStyle = innerEarGrad;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    }
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx - 9, earY + 5, earInnerW, earInnerH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 9, earY + 5, earInnerW, earInnerH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Cheek tufts — two rounded white shapes on sides (glossy)
    if (isSpeedPowerUp) {
      ctx.fillStyle = `hsla(${(time / 20) % 360}, 70%, 94%, 0.95)`;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    } else if (isMaxHearts) {
      ctx.fillStyle = "#fffacd";
      ctx.strokeStyle = "rgba(255, 235, 59, 0.7)";
    } else if (isAttractPowerUp) {
      ctx.fillStyle = "#FCA5A5";
      ctx.strokeStyle = "rgba(220, 38, 38, 0.5)";
    } else {
      ctx.fillStyle = "#f8fafc";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
    }
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx - 12, cy + 2, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx + 12, cy + 2, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Tail — small white fluffy circle at bottom; rainbow when speed, gold when max hearts, red when attract
    if (isSpeedPowerUp) {
      ctx.fillStyle = `hsl(${(time / 20) % 360}, 100%, 90%)`;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    } else if (isMaxHearts) {
      ctx.fillStyle = "#fffacd";
      ctx.strokeStyle = "rgba(255, 235, 59, 0.8)";
    } else if (isAttractPowerUp) {
      ctx.fillStyle = "#FCA5A5";
      ctx.strokeStyle = "rgba(220, 38, 38, 0.6)";
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
    }
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy + ph * 0.32, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isAttractPowerUp && state.player.attractTimer < ATTRACT_FADE_THRESHOLD) ctx.restore();
    // Speed power-up: sparkle overlay on the avatar (Metal Mario–style rainbow sparkle)
    if (isSpeedPowerUp) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, pw * 0.5, ph * 0.5, 0, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < 36; i++) {
        const sx = cx + (Math.sin(i * 1.7 + time / 200) * 0.4 + Math.cos(i * 2.3) * 0.35) * pw;
        const sy = cy + (Math.cos(i * 1.4 + time / 180) * 0.35 + Math.sin(i * 2.1) * 0.4) * ph;
        const hue = (time / 10 + i * 25) % 360;
        const size = 1.5 + Math.sin(time / 60 + i) * 0.8;
        ctx.fillStyle = `hsla(${hue}, 100%, 90%, ${0.4 + Math.sin(time / 50 + i * 1.5) * 0.35})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    } else if (isMaxHearts) {
      // Max hearts: glitter on the avatar (sharp star/diamond shapes, twinkling)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, pw * 0.52, ph * 0.52, 0, 0, Math.PI * 2);
      ctx.clip();
      for (let i = 0; i < 32; i++) {
        const sx = cx + (Math.sin(i * 1.7 + time / 200) * 0.38 + Math.cos(i * 2.3) * 0.32) * pw;
        const sy = cy + (Math.cos(i * 1.4 + time / 170) * 0.32 + Math.sin(i * 2.1) * 0.38) * ph;
        const twinkle = 0.5 + 0.5 * Math.sin(time / 45 + i * 1.3);
        const size = 1.8 + Math.sin(time / 60 + i * 0.8) * 0.8;
        const rot = (time / 120 + i * 0.4) % (Math.PI * 2);
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(rot);
        ctx.fillStyle = `rgba(255, 252, 245, ${0.4 * twinkle})`;
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * twinkle})`;
        ctx.lineWidth = 0.6;
        // 4-point glitter (diamond cross)
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size * 0.35, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size * 0.35, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-size, 0);
        ctx.lineTo(0, size * 0.35);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, -size * 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    }
    if (isSpeedPowerUp && speedBoostFlicker) ctx.restore();
    ctx.globalAlpha = 1.0;

    // Ready-Set-Go overlay during countdown
    if (isCountdown && countdownElapsed < COUNTDOWN_DURATION_MS) {
      const wordDur = COUNTDOWN_DURATION_MS / 3;
      const phase = Math.floor(countdownElapsed / wordDur);
      const phaseElapsed = countdownElapsed - phase * wordDur;
      const words = ["Ready", "Set", "Go!"];
      const word = words[Math.min(phase, 2)];
      const popIn = Math.min(1, phaseElapsed / 120); // quick pop-in over 120ms
      const scale = 0.3 + 0.7 * (1 - (1 - popIn) * (1 - popIn));
      const alpha = Math.min(1, phaseElapsed / 80) * (phaseElapsed < wordDur - 200 ? 1 : Math.max(0, (wordDur - phaseElapsed) / 200));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#1a1a1a";
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 6;
      ctx.font = `bold ${72 * scale}px system-ui, sans-serif`;
      ctx.strokeText(word, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
      ctx.fillText(word, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 40);
      ctx.restore();
    }

    // Loop
    state.animationId = requestAnimationFrame(gameLoop);
  }, [gameState, level]);

  type Rect = { x: number; y: number; width: number; height: number };
  const checkCollision = (rect1: Rect, rect2: Rect) => {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
  };

  const triggerLevel20Ending = () => {
    stopMusic();
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    if (rapidAmbientOnRef.current) {
      stopAmbient("rapid_rabbit_loop");
      rapidAmbientOnRef.current = false;
    }
    if (attractAmbientOnRef.current) {
      stopAmbient("attract_loop");
      attractAmbientOnRef.current = false;
    }
    if (goldenBunnyAmbientOnRef.current) {
      stopAmbient("golden_bunny_loop");
      goldenBunnyAmbientOnRef.current = false;
    }
    setLevel(20);
    setGameState("level20_ending");
  };

  const levelUp = () => {
    if (level === 19) {
      triggerLevel20Ending();
      return;
    }
    playSfx("level_up");
    setLevel(l => l + 1);
    setCarrotsCollected(0);
    gameRef.current.heartSpawnedThisLevel = false;
    gameRef.current.giantCarrot.face = Math.floor(Math.random() * 6);
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    // Change background color slightly based on level
    const colors = ["#FFF7ED", "#ECFCCB", "#E0F2FE", "#FAE8FF", "#FFF1F2"];
    gameRef.current.levelColor = colors[level % colors.length];
  };

  const endGame = () => {
    setNameError("");
    setGameState("gameover");
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    if (rapidAmbientOnRef.current) {
      stopAmbient("rapid_rabbit_loop");
      rapidAmbientOnRef.current = false;
    }
    if (attractAmbientOnRef.current) {
      stopAmbient("attract_loop");
      attractAmbientOnRef.current = false;
    }
    if (goldenBunnyAmbientOnRef.current) {
      stopAmbient("golden_bunny_loop");
      goldenBunnyAmbientOnRef.current = false;
      resumeMusic();
    }
  };

  const startNameErrorDismissTimer = useCallback(() => {
    if (nameErrorDismissTimerRef.current) clearTimeout(nameErrorDismissTimerRef.current);
    nameErrorDismissTimerRef.current = setTimeout(() => {
      nameErrorDismissTimerRef.current = null;
      setNameError("");
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (nameErrorDismissTimerRef.current) clearTimeout(nameErrorDismissTimerRef.current);
    };
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
    if (nameErrorDismissTimerRef.current) {
      clearTimeout(nameErrorDismissTimerRef.current);
      nameErrorDismissTimerRef.current = null;
    }
    playSfx("ui_click");
    try {
      await createScore.mutateAsync({
        name: trimmed,
        score: score,
        level: level,
        device: isMobile ? "mobile" : "web",
      });
      setMusicState("menu");
      setGameState("menu");
      onReturnToMenu?.();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong. Please try again.";
      setNameError(message);
      startNameErrorDismissTimer();
      console.error(e);
    }
  };

  // Menu background: blurred scroller animating in canvas behind the start window
  const menuLoop = useCallback((time: number) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) {
      menuLoopIdRef.current = requestAnimationFrame(menuLoop);
      return;
    }
    const dt = (time - menuLastFrameRef.current) / 1000;
    menuLastFrameRef.current = time;

    const scroller = backgroundScrollerRef.current;
    if (scroller) scroller.update(dt);

    // Fullscreen bezel: render scroller to buffer and copy to left/right strips (no blur on buffer)
    if (gameRef.current.isFullscreen && scroller && scrollerBufferRef.current && leftBezelCanvasRef.current && rightBezelCanvasRef.current && leftBezelContainerRef.current && rightBezelContainerRef.current) {
      const buf = scrollerBufferRef.current;
      const bufCtx = buf.getContext("2d");
      if (bufCtx) {
        scroller.render(bufCtx);
        const leftDiv = leftBezelContainerRef.current;
        const rightDiv = rightBezelContainerRef.current;
        const lw = leftDiv.offsetWidth;
        const lh = leftDiv.offsetHeight;
        const rw = rightDiv.offsetWidth;
        const rh = rightDiv.offsetHeight;
        const slice = 100;
        leftBezelCanvasRef.current.width = lw;
        leftBezelCanvasRef.current.height = lh;
        rightBezelCanvasRef.current.width = rw;
        rightBezelCanvasRef.current.height = rh;
        const lctx = leftBezelCanvasRef.current.getContext("2d");
        const rctx = rightBezelCanvasRef.current.getContext("2d");
        if (lctx) lctx.drawImage(buf, 0, 0, slice, CANVAS_HEIGHT, 0, 0, lw, lh);
        if (rctx) rctx.drawImage(buf, CANVAS_WIDTH - slice, 0, slice, CANVAS_HEIGHT, 0, 0, rw, rh);
      }
    }

    ctx.save();
    ctx.filter = "blur(10px)";
    if (scroller) {
      scroller.render(ctx);
    } else {
      drawEarthBackground(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, time);
    }
    if (!hazeLayerRef.current) {
      hazeLayerRef.current = new HazeLayer(CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    hazeLayerRef.current.render(ctx, time / 1000);
    if (scroller) scroller.renderWaterShimmer(ctx);
    ctx.restore();

    menuLoopIdRef.current = requestAnimationFrame(menuLoop);
  }, []);

  useEffect(() => {
    if (gameState !== "menu") return;
    menuLastFrameRef.current = performance.now();
    menuLoopIdRef.current = requestAnimationFrame(menuLoop);
    return () => cancelAnimationFrame(menuLoopIdRef.current);
  }, [gameState, menuLoop]);

  // Resume/Restart handlers (run loop during countdown and playing)
  useEffect(() => {
    if (gameState === "playing" || gameState === "countdown") {
        gameRef.current.animationId = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(gameRef.current.animationId);
  }, [gameState, gameLoop]);


  const GAME_ASPECT = CANVAS_WIDTH / CANVAS_HEIGHT; // 4/3

  // Determine if canvas should be full-width on mobile
  const isGameActive = gameState === "playing" || gameState === "countdown";
  const shouldBeFullWidth = isMobile && isGameActive && !isFullscreen;

  return (
    <div
      ref={containerRef}
      className={
        isFullscreen
          ? "flex flex-row items-center justify-center w-screen h-screen min-w-0 min-h-0 bg-gray-900"
          : `relative w-full ${shouldBeFullWidth ? 'game-canvas-fullwidth' : 'max-w-[800px]'} mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-gray-900 game-canvas-container`
      }
    >
      {isFullscreen && (
        <div
          ref={leftBezelContainerRef}
          className="flex-1 min-w-0 h-full flex items-center justify-end overflow-hidden"
          aria-hidden
        >
          <canvas
            ref={leftBezelCanvasRef}
            className="h-full w-auto max-w-full object-cover"
            style={{ filter: "blur(14px) contrast(0.7)", width: "100%", height: "100%" }}
          />
        </div>
      )}
      <div
        className={
          isFullscreen
            ? "relative overflow-visible bg-white border-4 border-gray-900 flex-shrink-0"
            : portraitAspect
              ? "relative w-full overflow-hidden"
              : "relative w-full"
        }
        style={
          isFullscreen
            ? {
                width: "min(100vw, 100vh * " + GAME_ASPECT + ")",
                height: "min(100vh, 100vw / " + GAME_ASPECT + ")",
                boxShadow: "0 0 50px rgba(0,0,0,0.45), 0 0 100px rgba(0,0,0,0.25)",
              }
            : portraitAspect
              ? { aspectRatio: "9/10" }
              : undefined
        }
      >
        {/* Fullscreen toggle — hidden on mobile; Space/Enter must not activate so game fire mechanic works */}
        {!isMobile && (
          <Button
            {...({
              type: "button",
              variant: "outline",
              size: "icon",
              onClick: toggleFullscreen,
              onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
                if (e.key === " " || e.key === "Enter") e.preventDefault();
              },
              className: "absolute bottom-4 right-4 z-20 h-10 w-10 rounded-xl border-2 border-black bg-white/95 shadow-md hover:bg-orange-50 focus-visible:ring-primary",
              "aria-label": isFullscreen ? "Exit fullscreen" : "Enter fullscreen",
              children: isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />,
            } as ButtonProps)}
          />
        )}
        {portraitAspect && !isFullscreen ? (
          <div className="absolute inset-0 flex items-center justify-center bg-orange-50">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block h-full w-auto max-w-none bg-orange-50"
            />
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className={
              isFullscreen
                ? "block w-full h-full bg-orange-50"
                : "block w-full h-auto bg-orange-50"
            }
          />
        )}

      {/* HUD Layer (countdown + playing). Mobile: .game-hud in mobile.css for size + menu space. --hud-font-size scales to avoid truncation. */}
      {(gameState === "playing" || gameState === "countdown") && (
        <div
          ref={hudContainerRef}
          className="game-hud absolute top-4 left-0 right-0 flex justify-between items-center px-8 pointer-events-none"
          style={{ ["--hud-font-size" as string]: `${hudFontSizeRem ?? 1}rem` }}
        >
            <div ref={hudLeftRef} className="flex gap-4">
                 <div className="bg-white/90 border-2 border-black px-4 py-2 rounded-xl shadow-md font-display text-xl text-primary">
                    🥕 {carrotsCollected}/10
                 </div>
                 <div className="bg-white/90 border-2 border-black px-4 py-2 rounded-xl shadow-md font-display text-xl text-red-500">
                    ❤️ {lives === 10 ? "MAX" : lives}
                 </div>
            </div>
            <div ref={hudRightRef} className="flex gap-4">
                 <div className="bg-white/90 border-2 border-black px-4 py-2 rounded-xl shadow-md font-display text-xl">
                    LEVEL {level}
                 </div>
                 <div className="bg-white/90 border-2 border-black px-4 py-2 rounded-xl shadow-md font-display text-xl text-blue-600">
                    SCORE: {score}
                 </div>
            </div>
        </div>
      )}

      {/* Menu Overlay */}
      <AnimatePresence>
        {gameState === "menu" && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 flex items-center justify-center p-8"
            >
                <StartMenuCard onStartClick={startGame} />
            </motion.div>
        )}

        {gameState === "gameover" && (
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            >
                <div className="gameover-card bg-white p-8 rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,0,0,1)] text-center max-w-md w-full">
                    <h2 className="text-5xl font-display text-red-500 mb-4 text-shadow-lg">GAME OVER</h2>
                    
                    <div className="bg-gray-100 rounded-xl p-6 mb-6 border-2 border-gray-200">
                        <div className="flex justify-between items-end border-b-2 border-gray-200 pb-2 mb-2">
                            <span className="text-gray-500 font-bold uppercase text-xs">Final Score</span>
                            <span className="text-4xl font-display text-primary">{score}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-gray-500 font-bold uppercase text-xs">Level Reached</span>
                            <span className="text-2xl font-display text-blue-500">{level}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="relative">
                            {nameError && (
                              <div
                                id="name-error"
                                role="alert"
                                className="absolute bottom-full left-0 right-0 mb-2 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 text-center text-sm font-medium text-red-700 shadow-lg"
                                aria-live="polite"
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
                                    if (nameErrorDismissTimerRef.current) {
                                      clearTimeout(nameErrorDismissTimerRef.current);
                                      nameErrorDismissTimerRef.current = null;
                                    }
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSubmitScore();
                                  }
                                }}
                                className="text-center font-display text-xl h-12 border-2 border-black focus-visible:ring-primary"
                                maxLength={10}
                                aria-invalid={!!nameError}
                                aria-describedby={nameError ? "name-error" : undefined}
                            />
                        </div>
                        
                        <Button 
                            onClick={handleSubmitScore}
                            disabled={createScore.isPending || !playerName.trim()}
                            className="w-full h-14 text-xl font-display bg-primary hover:bg-orange-600 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1"
                        >
                            {createScore.isPending ? <Loader2 className="animate-spin" /> : "Submit Score"}
                        </Button>

                        <Button
                            {...({
                              variant: "ghost",
                              onClick: () => {
                                playSfx("ui_click");
                                setMusicState("menu");
                                setGameState("menu");
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
      {isFullscreen && (
        <div
          ref={rightBezelContainerRef}
          className="flex-1 min-w-0 h-full flex items-center justify-start overflow-hidden"
          aria-hidden
        >
          <canvas
            ref={rightBezelCanvasRef}
            className="h-full w-auto max-w-full object-cover"
            style={{ filter: "blur(14px) contrast(0.7)", width: "100%", height: "100%" }}
          />
        </div>
      )}
    </div>
  );
});

GameCanvas.displayName = "GameCanvas";

export default GameCanvas;
