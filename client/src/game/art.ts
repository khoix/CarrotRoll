/**
 * Sprite art and the sprite cache.
 *
 * Everything that used to be re-drawn from paths/gradients (or re-rasterized from SVG, which Safari
 * does on every drawImage) each frame is rendered once into an offscreen canvas at the current
 * backing-store scale, so a frame is mostly cheap 1:1 drawImage copies.
 */

/** Carrot collectible body SVG (30×30); face is drawn separately via drawCarrotFace. */
export const CARROT_SVG =
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
export const BROCCOLI_SVG =
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
export const SPIKY_BALL_SVG =
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

/** Draw a carrot face (eyes + mouth) at (cx, cy) with given scale. expression 0-5: happy, sad, surprised, angry, sleepy, winky. compact=true halves eye–mouth distance (small carrots). */
export function drawCarrotFace(ctx: CanvasRenderingContext2D, expression: number, cx: number, cy: number, scale: number, compact?: boolean) {
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

export type PowerupType = "powerup_invincible" | "powerup_speed" | "powerup_blaster" | "powerup_heart" | "powerup_attract";

/** Power-up icon centred on (0,0), size w×h (shield / bolt / blasters / heart / magnet). */
export function drawPowerup(ctx: CanvasRenderingContext2D, type: PowerupType, w: number, h: number) {
  const hw = w / 2;
  const hh = h / 2;
  const box = (fill: string, stroke: string) => {
    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-hw, -hh, w, h, 4);
    ctx.fill();
    ctx.stroke();
  };
  if (type === "powerup_invincible") {
    box("#22c55e", "#86efac");
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
  } else if (type === "powerup_speed") {
    box("#eab308", "#fde047");
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
  } else if (type === "powerup_blaster") {
    box("#06B6D4", "#22D3EE");
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.35, hh * 0.5);
    ctx.lineTo(-hw * 0.35, -hh * 0.5);
    ctx.moveTo(hw * 0.35, hh * 0.5);
    ctx.lineTo(hw * 0.35, -hh * 0.5);
    ctx.stroke();
  } else if (type === "powerup_heart") {
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
  } else {
    box("#DC2626", "#F87171");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${Math.round(h * 0.72)}px sans-serif`;
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("🧲", 0, 0);
  }
}

export type RabbitVariant = "normal" | "gold" | "attract" | "speed";

/**
 * Front-facing rabbit (body, ears, inner ears, cheek tufts, tail) centred on (cx, cy).
 * "speed" uses time-based rainbow hues, so it is the only variant drawn live each frame.
 */
export function drawRabbit(ctx: CanvasRenderingContext2D, cx: number, cy: number, pw: number, ph: number, variant: RabbitVariant, time = 0) {
  const top = cy - ph / 2;
  // Body
  const bodyGrad = ctx.createRadialGradient(cx - pw * 0.2, cy - ph * 0.25, 0, cx, cy, pw * 0.5);
  if (variant === "speed") {
    const hue = (time / 25) % 360;
    bodyGrad.addColorStop(0, `hsl(${hue}, 80%, 82%)`);
    bodyGrad.addColorStop(0.4, `hsl(${(hue + 90) % 360}, 75%, 72%)`);
    bodyGrad.addColorStop(0.85, `hsl(${(hue + 180) % 360}, 70%, 58%)`);
    bodyGrad.addColorStop(1, `hsl(${(hue + 240) % 360}, 70%, 50%)`);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  } else if (variant === "gold") {
    bodyGrad.addColorStop(0, "#fff8dc");
    bodyGrad.addColorStop(0.4, "#ffd700");
    bodyGrad.addColorStop(0.85, "#daa520");
    bodyGrad.addColorStop(1, "#b8860b");
    ctx.strokeStyle = "rgba(255, 235, 59, 0.9)";
  } else if (variant === "attract") {
    bodyGrad.addColorStop(0, "#F87171");
    bodyGrad.addColorStop(0.4, "#DC2626");
    bodyGrad.addColorStop(0.85, "#B91C1C");
    bodyGrad.addColorStop(1, "#991B1B");
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  } else {
    bodyGrad.addColorStop(0, "#8bb8e8");
    bodyGrad.addColorStop(0.35, "#6b9bd1");
    bodyGrad.addColorStop(0.75, "#4a7ab8");
    bodyGrad.addColorStop(1, "#3d6ba3");
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
  }
  ctx.fillStyle = bodyGrad;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, pw * 0.42, ph * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Ears
  const earOuterW = 6;
  const earOuterH = 14;
  const earInnerW = 3.5;
  const earInnerH = 10;
  const earY = top + 2;
  const earGrad = ctx.createLinearGradient(cx, earY - 2, cx, earY + earOuterH);
  if (variant === "speed") {
    const hue = (time / 22 + 30) % 360;
    earGrad.addColorStop(0, `hsl(${hue}, 85%, 78%)`);
    earGrad.addColorStop(0.5, `hsl(${(hue + 70) % 360}, 80%, 68%)`);
    earGrad.addColorStop(1, `hsl(${(hue + 140) % 360}, 75%, 55%)`);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  } else if (variant === "gold") {
    earGrad.addColorStop(0, "#fffacd");
    earGrad.addColorStop(0.5, "#ffd700");
    earGrad.addColorStop(1, "#b8860b");
    ctx.strokeStyle = "rgba(255, 235, 59, 0.8)";
  } else if (variant === "attract") {
    earGrad.addColorStop(0, "#FCA5A5");
    earGrad.addColorStop(0.5, "#DC2626");
    earGrad.addColorStop(1, "#991B1B");
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
  } else {
    earGrad.addColorStop(0, "#8bb8e8");
    earGrad.addColorStop(0.5, "#6b9bd1");
    earGrad.addColorStop(1, "#3d6ba3");
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
  }
  ctx.fillStyle = earGrad;
  ctx.lineWidth = 1.5;
  for (const sx of [-9, 9]) {
    ctx.beginPath();
    ctx.ellipse(cx + sx, earY + 5, earOuterW, earOuterH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Ear inners
  if (variant === "speed") {
    ctx.fillStyle = `hsla(${(time / 20) % 360}, 60%, 95%, 0.95)`;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  } else if (variant === "gold") {
    ctx.fillStyle = "#fffef0";
    ctx.strokeStyle = "rgba(255, 235, 59, 0.7)";
  } else if (variant === "attract") {
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
  for (const sx of [-9, 9]) {
    ctx.beginPath();
    ctx.ellipse(cx + sx, earY + 5, earInnerW, earInnerH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Cheek tufts
  if (variant === "speed") {
    ctx.fillStyle = `hsla(${(time / 20) % 360}, 70%, 94%, 0.95)`;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  } else if (variant === "gold") {
    ctx.fillStyle = "#fffacd";
    ctx.strokeStyle = "rgba(255, 235, 59, 0.7)";
  } else if (variant === "attract") {
    ctx.fillStyle = "#FCA5A5";
    ctx.strokeStyle = "rgba(220, 38, 38, 0.5)";
  } else {
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  }
  ctx.lineWidth = 1;
  for (const sx of [-12, 12]) {
    ctx.beginPath();
    ctx.ellipse(cx + sx, cy + 2, 8, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Tail
  if (variant === "speed") {
    ctx.fillStyle = `hsl(${(time / 20) % 360}, 100%, 90%)`;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  } else if (variant === "gold") {
    ctx.fillStyle = "#fffacd";
    ctx.strokeStyle = "rgba(255, 235, 59, 0.8)";
  } else if (variant === "attract") {
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
}

// ---------------------------------------------------------------------------
// Sprite cache
// ---------------------------------------------------------------------------

type SvgName = "carrot" | "broccoli" | "ball";
const SVG_SOURCES: Record<SvgName, string> = { carrot: CARROT_SVG, broccoli: BROCCOLI_SVG, ball: SPIKY_BALL_SVG };

let svgImagesPromise: Promise<Partial<Record<SvgName, HTMLImageElement>>> | null = null;
function loadSvgImages() {
  if (!svgImagesPromise) {
    svgImagesPromise = Promise.all(
      (Object.keys(SVG_SOURCES) as SvgName[]).map(
        (name) =>
          new Promise<[SvgName, HTMLImageElement | null]>((resolve) => {
            const img = new Image();
            img.onload = () => resolve([name, img]);
            img.onerror = () => resolve([name, null]);
            img.src = "data:image/svg+xml," + encodeURIComponent(SVG_SOURCES[name]);
          })
      )
    ).then((pairs) => {
      const out: Partial<Record<SvgName, HTMLImageElement>> = {};
      for (const [n, img] of pairs) if (img) out[n] = img;
      return out;
    });
  }
  return svgImagesPromise;
}

/** A pre-rendered sprite: draw at (x - ox, y - oy) with size (w, h) in world units. */
export type Sprite = { canvas: HTMLCanvasElement; w: number; h: number; ox: number; oy: number };

function makeSprite(w: number, h: number, scale: number, ox: number, oy: number, draw: (ctx: CanvasRenderingContext2D) => void): Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(w * scale));
  canvas.height = Math.max(1, Math.ceil(h * scale));
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(canvas.width / w, canvas.height / h);
    draw(ctx);
  }
  return { canvas, w, h, ox, oy };
}

export function blit(ctx: CanvasRenderingContext2D, s: Sprite, x: number, y: number, scale = 1) {
  ctx.drawImage(s.canvas, x - s.ox * scale, y - s.oy * scale, s.w * scale, s.h * scale);
}

export class SpriteCache {
  readonly scale: number;
  carrots: Sprite[] = [];
  broccoli: Sprite | null = null;
  ball: Sprite | null = null;
  powerups: Partial<Record<PowerupType, Sprite>> = {};
  rabbits: Partial<Record<Exclude<RabbitVariant, "speed">, Sprite>> = {};
  shadow: Sprite;
  explosion: Sprite;
  shield: Sprite;
  aura: Sprite;
  private disposed = false;

  constructor(scale: number) {
    this.scale = scale;
    const types: PowerupType[] = ["powerup_invincible", "powerup_speed", "powerup_blaster", "powerup_heart", "powerup_attract"];
    for (const t of types) this.powerups[t] = makeSprite(34, 34, scale, 17, 17, (c) => { c.translate(17, 17); drawPowerup(c, t, 30, 30); });
    for (const v of ["normal", "gold", "attract"] as const) {
      // 40×40 rabbit; ears reach ~7 above its box, so pad the sprite.
      this.rabbits[v] = makeSprite(56, 64, scale, 28, 36, (c) => drawRabbit(c, 28, 36, 40, 40, v));
    }
    // Drop shadow (shadowBlur baked once instead of every frame). Same look as the old live version.
    this.shadow = makeSprite(64, 64, scale, 32, 32, (c) => {
      c.shadowColor = "rgba(0, 0, 0, 0.4)";
      c.shadowBlur = 8 * scale;
      c.shadowOffsetX = 4 * scale;
      c.shadowOffsetY = 4 * scale;
      c.fillStyle = "rgba(0, 0, 0, 0.25)";
      c.beginPath();
      c.ellipse(32 + 2, 32 + 4, 18, 16, 0, 0, Math.PI * 2);
      c.fill();
    });
    this.explosion = makeSprite(120, 120, scale, 60, 60, (c) => {
      const g = c.createRadialGradient(60, 60, 0, 60, 60, 60);
      g.addColorStop(0, "rgba(255, 237, 160, 0.95)");
      g.addColorStop(0.2, "rgba(251, 146, 60, 0.9)");
      g.addColorStop(0.5, "rgba(234, 88, 12, 0.5)");
      g.addColorStop(0.8, "rgba(120, 53, 15, 0.2)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      c.fillStyle = g;
      c.fillRect(0, 0, 120, 120);
    });
    // Shield bubble, radius 40 (scaled per frame for the pulse)
    this.shield = makeSprite(88, 88, scale, 44, 44, (c) => {
      const r = 40;
      c.translate(44, 44);
      const g = c.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r);
      g.addColorStop(0, "rgba(255, 255, 255, 0.55)");
      g.addColorStop(0.35, "rgba(200, 245, 255, 0.45)");
      g.addColorStop(0.7, "rgba(120, 220, 255, 0.35)");
      g.addColorStop(1, "rgba(80, 200, 255, 0.2)");
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fillStyle = g;
      c.fill();
      c.strokeStyle = "rgba(255, 255, 255, 0.9)";
      c.lineWidth = 2.5;
      c.stroke();
      c.beginPath();
      c.ellipse(-r * 0.25, -r * 0.3, r * 0.2, r * 0.25, 0, 0, Math.PI * 2);
      c.fillStyle = "rgba(255, 255, 255, 0.4)";
      c.fill();
    });
    // Max-hearts aura, base radius 64 (= 40 × 1.6), drawn scaled by the pulse
    this.aura = makeSprite(200, 220, scale, 100, 118, (c) => {
      const r = 64;
      c.translate(100, 118);
      const outerR = r * 1.4;
      const outer = c.createRadialGradient(0, -outerR * 0.2, 0, 0, 0, outerR);
      outer.addColorStop(0, "rgba(255, 255, 200, 0)");
      outer.addColorStop(0.4, "rgba(255, 200, 50, 0.35)");
      outer.addColorStop(0.7, "rgba(255, 180, 0, 0.2)");
      outer.addColorStop(1, "rgba(255, 150, 0, 0)");
      c.fillStyle = outer;
      c.beginPath();
      c.ellipse(0, -r * 0.15, outerR, outerR * 1.1, 0, 0, Math.PI * 2);
      c.fill();
      const mid = c.createRadialGradient(-r * 0.2, -r * 0.2, 0, 0, 0, r);
      mid.addColorStop(0, "rgba(255, 255, 255, 0.85)");
      mid.addColorStop(0.2, "rgba(255, 248, 180, 0.75)");
      mid.addColorStop(0.5, "rgba(255, 220, 80, 0.5)");
      mid.addColorStop(0.8, "rgba(255, 193, 7, 0.25)");
      mid.addColorStop(1, "rgba(255, 193, 7, 0)");
      c.fillStyle = mid;
      c.beginPath();
      c.arc(0, 0, r, 0, Math.PI * 2);
      c.fill();
      const innerR = r * 0.5;
      const inner = c.createRadialGradient(-innerR * 0.3, -innerR * 0.3, 0, 0, 0, innerR);
      inner.addColorStop(0, "rgba(255, 255, 255, 0.9)");
      inner.addColorStop(0.5, "rgba(255, 240, 150, 0.6)");
      inner.addColorStop(1, "rgba(255, 220, 80, 0)");
      c.fillStyle = inner;
      c.beginPath();
      c.arc(0, 0, innerR, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = "rgba(255, 255, 220, 0.7)";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(0, 0, r * 0.92, 0, Math.PI * 2);
      c.stroke();
    });

    loadSvgImages().then((imgs) => {
      if (this.disposed) return;
      const carrot = imgs.carrot;
      for (let face = 0; face < 6; face++) {
        this.carrots[face] = makeSprite(40, 40, scale, 20, 20, (c) => {
          if (carrot) c.drawImage(carrot, 0, 0, 40, 40);
          drawCarrotFace(c, face, 20, 20 + 40 * 0.08, 27, true);
        });
      }
      if (imgs.broccoli) { const b = imgs.broccoli; this.broccoli = makeSprite(40, 40, scale, 20, 20, (c) => c.drawImage(b, 0, 0, 40, 40)); }
      if (imgs.ball) { const b = imgs.ball; this.ball = makeSprite(40, 40, scale, 20, 20, (c) => c.drawImage(b, 0, 0, 40, 40)); }
    });
  }

  dispose() {
    this.disposed = true;
  }
}
