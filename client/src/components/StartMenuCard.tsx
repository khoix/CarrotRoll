import { Button } from "@/components/ui/button";

interface StartMenuCardProps {
  onStartClick: () => void;
  className?: string;
}

export default function StartMenuCard({ onStartClick, className = "" }: StartMenuCardProps) {
  return (
    <div className={`bg-white p-8 rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center max-w-md w-full ${className}`.trim()}>
      <h1 className="text-6xl font-display text-primary mb-2 text-shadow-lg rotate-[-2deg]">CARROT ROLL</h1>
      <p className="text-gray-500 font-bold mb-8 text-lg">Avoid the giant carrot! Collect the small ones!</p>

      <Button
        onClick={onStartClick}
        className="w-full h-16 text-2xl font-display uppercase tracking-widest bg-green-500 hover:bg-green-600 text-white border-b-4 border-green-700 active:border-b-0 active:translate-y-1 mb-4"
      >
        Start Game
      </Button>

      <div className="grid grid-cols-2 gap-4 mt-8">
        <div className="bg-orange-50 p-4 rounded-xl border-2 border-orange-100 text-center overflow-visible">
          <span className="flex items-center justify-center mb-2 menu-card-carrot-icon">
            {/* Carrot (40×40) – thin outline */}
            <svg width="40" height="40" viewBox="0 0 30 30" className="flex-shrink-0" aria-hidden="true">
              <defs>
                <linearGradient id="carrotBodyMenu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fdba74" />
                  <stop offset="55%" stopColor="#fb923c" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
                <linearGradient id="carrotShineMenu" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#fff7ed" stopOpacity="0.55" />
                  <stop offset="60%" stopColor="#fff7ed" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="carrotLeafMenu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#86efac" />
                  <stop offset="100%" stopColor="#22c55e" />
                </linearGradient>
              </defs>
              <path d="M13.8 3.5 C12.1 2.6 10.8 3.4 10.7 5.0 C11.7 5.2 12.8 6.0 13.4 7.2 C14.1 6.0 14.4 4.5 13.8 3.5 Z" fill="url(#carrotLeafMenu)" stroke="rgba(0,0,0,0.9)" strokeWidth="1.0" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M16.0 3.1 C15.8 1.7 17.2 1.0 18.6 2.0 C19.5 2.7 19.9 4.1 19.2 5.4 C18.3 5.1 17.1 5.3 16.1 6.2 C15.8 5.0 15.8 4.0 16.0 3.1 Z" fill="url(#carrotLeafMenu)" stroke="rgba(0,0,0,0.9)" strokeWidth="1.0" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M15.0 4.8 C14.2 3.8 13.2 3.7 12.5 4.3 C11.6 5.0 12.1 6.4 13.3 7.2 C14.1 7.8 15.0 8.2 16.0 8.2 C16.1 7.0 15.7 5.8 15.0 4.8 Z" fill="url(#carrotLeafMenu)" stroke="rgba(0,0,0,0.9)" strokeWidth="1.0" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M11.2 8.6 C12.7 7.5 17.3 7.5 18.8 8.6 C18.2 10.1 16.8 11.0 15.0 11.0 C13.2 11.0 11.8 10.1 11.2 8.6 Z" fill="#22c55e" stroke="rgba(0,0,0,0.9)" strokeWidth="1.0" strokeLinejoin="round" />
              <path d="M15 9.6 C18.4 9.6 20.9 12.3 20.3 15.4 C19.6 18.9 17.8 22.3 16.0 25.6 C15.6 26.4 15.3 27.1 15 27.9 C14.7 27.1 14.4 26.4 14.0 25.6 C12.2 22.3 10.4 18.9 9.7 15.4 C9.1 12.3 11.6 9.6 15 9.6 Z" fill="url(#carrotBodyMenu)" stroke="rgba(0,0,0,0.9)" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />
              <path d="M12.2 12.0 C13.2 11.2 14.2 11.0 15.0 11.0 C14.4 13.0 13.9 15.5 14.1 18.5 C14.3 21.1 14.9 23.6 15.5 25.8 C14.6 24.4 13.6 22.3 12.9 20.0 C12.1 17.4 11.8 14.5 12.2 12.0 Z" fill="url(#carrotShineMenu)" opacity="0.9" />
              <path d="M11.6 14.3 C13.3 15.2 16.7 15.2 18.4 14.3" stroke="rgba(0,0,0,0.22)" strokeWidth="0.7" strokeLinecap="round" />
              <path d="M11.1 17.2 C13.1 18.2 16.9 18.2 18.9 17.2" stroke="rgba(0,0,0,0.22)" strokeWidth="0.7" strokeLinecap="round" />
              <path d="M11.4 20.2 C13.0 21.0 17.0 21.0 18.6 20.2" stroke="rgba(0,0,0,0.22)" strokeWidth="0.7" strokeLinecap="round" />
              <path d="M12.2 23.1 C13.4 23.7 16.6 23.7 17.8 23.1" stroke="rgba(0,0,0,0.22)" strokeWidth="0.7" strokeLinecap="round" />
            </svg>
          </span>
          <p className="text-xs font-bold text-orange-800">
            <span className="block sm:inline">Collect 10</span>{" "}
            <span className="block sm:inline">to level up</span>
          </p>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border-2 border-red-100 text-center overflow-visible">
          <span className="flex items-center justify-center gap-2 mb-2 min-h-[2rem] menu-card-hazards-icons">
            {/* Broccoli (40×40) – thin outline */}
            <svg width="40" height="40" viewBox="0 0 20 20" className="flex-shrink-0" aria-hidden="true">
              <defs>
                <radialGradient id="brocGlow2" cx="38%" cy="28%" r="72%">
                  <stop offset="0%" stopColor="#bbf7d0" stopOpacity="0.95" />
                  <stop offset="45%" stopColor="#4ade80" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#16a34a" stopOpacity="0.95" />
                </radialGradient>

                <radialGradient id="brocShadow2" cx="70%" cy="70%" r="80%">
                  <stop offset="0%" stopColor="#15803d" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#15803d" stopOpacity="0" />
                </radialGradient>

                <linearGradient id="stemGrad2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ade80" />
                  <stop offset="100%" stopColor="#15803d" />
                </linearGradient>
              </defs>

              {/* Crown silhouette */}
              <path
                d="M5.4 10.2
                   C4.1 10.0 3.2 9.0 3.3 7.8
                   C3.4 6.4 4.5 5.7 5.7 5.9
                   C6.0 4.5 7.3 3.4 9.2 3.4
                   C11.4 3.4 12.8 4.7 13.0 6.2
                   C14.6 5.9 16.1 6.8 16.2 8.3
                   C16.3 9.8 15.1 10.9 13.5 11.0
                   C13.0 12.2 11.8 13.1 10.0 13.1
                   C8.1 13.1 6.7 12.2 6.3 10.9
                   C6.0 10.7 5.7 10.4 5.4 10.2 Z"
                fill="url(#brocGlow2)"
                stroke="rgba(0,0,0,0.9)"
                strokeWidth="0.9"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Crown depth shading */}
              <path
                d="M5.4 10.2
                   C4.1 10.0 3.2 9.0 3.3 7.8
                   C3.4 6.4 4.5 5.7 5.7 5.9
                   C6.0 4.5 7.3 3.4 9.2 3.4
                   C11.4 3.4 12.8 4.7 13.0 6.2
                   C14.6 5.9 16.1 6.8 16.2 8.3
                   C16.3 9.8 15.1 10.9 13.5 11.0
                   C13.0 12.2 11.8 13.1 10.0 13.1
                   C8.1 13.1 6.7 12.2 6.3 10.9
                   C6.0 10.7 5.7 10.4 5.4 10.2 Z"
                fill="url(#brocShadow2)"
                opacity="0.9"
              />

              {/* Floret beads */}
              <circle cx="6.3" cy="7.7" r="1.05" fill="#86efac" opacity="0.75" />
              <circle cx="8.2" cy="6.0" r="1.15" fill="#86efac" opacity="0.72" />
              <circle cx="10.4" cy="5.7" r="1.05" fill="#86efac" opacity="0.70" />
              <circle cx="12.4" cy="6.8" r="1.10" fill="#86efac" opacity="0.70" />
              <circle cx="9.2" cy="8.5" r="1.00" fill="#86efac" opacity="0.62" />
              <circle cx="11.7" cy="8.8" r="0.95" fill="#86efac" opacity="0.58" />

              {/* Stem */}
              <path
                d="M8.2 12.0
                   C8.3 11.2 8.9 10.8 9.6 10.8
                   H10.4
                   C11.1 10.8 11.7 11.2 11.8 12.0
                   L12.2 18.4
                   C12.25 19.1 11.8 19.6 11.1 19.6
                   H8.9
                   C8.2 19.6 7.75 19.1 7.8 18.4
                   Z"
                fill="url(#stemGrad2)"
                stroke="rgba(0,0,0,0.9)"
                strokeWidth="0.9"
                strokeLinejoin="round"
                strokeLinecap="round"
              />

              {/* Stem ribs */}
              <path d="M9.1 12.1 L8.8 19.1" stroke="rgba(255,255,255,0.30)" strokeWidth="0.7" strokeLinecap="round" />
              <path d="M10.0 11.8 L10.0 19.3" stroke="rgba(0,0,0,0.20)" strokeWidth="0.7" strokeLinecap="round" />
              <path d="M10.9 12.1 L11.2 19.1" stroke="rgba(255,255,255,0.24)" strokeWidth="0.7" strokeLinecap="round" />

              {/* Branch nubs */}
              <path d="M7.6 12.0 C7.0 11.7 6.9 11.1 7.2 10.6 C7.9 10.8 8.3 11.4 8.1 12.0 Z" fill="#22c55e" opacity="0.95" />
              <path d="M12.4 12.0 C13.0 11.7 13.1 11.1 12.8 10.6 C12.1 10.8 11.7 11.4 11.9 12.0 Z" fill="#22c55e" opacity="0.95" />
            </svg>
            {/* Spiky ball (40×40, 3D wedge spikes, same as in-game) */}
            <svg width="40" height="40" viewBox="0 0 120 120" className="flex-shrink-0" fill="none" aria-hidden="true">
              <defs>
                <radialGradient id="menuBallBody" cx="42" cy="38" r="56" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#6B7280" />
                  <stop offset="0.35" stopColor="#4B5563" />
                  <stop offset="0.78" stopColor="#1F2937" />
                  <stop offset="1" stopColor="#0B1220" />
                </radialGradient>
                <linearGradient id="menuBallSheen" x1="22" y1="28" x2="92" y2="98" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="rgba(255,255,255,0.55)" />
                  <stop offset="0.18" stopColor="rgba(255,255,255,0.10)" />
                  <stop offset="0.52" stopColor="rgba(255,255,255,0.00)" />
                  <stop offset="0.78" stopColor="rgba(255,255,255,0.06)" />
                  <stop offset="1" stopColor="rgba(255,255,255,0.00)" />
                </linearGradient>
                <radialGradient id="menuBallRim" cx="60" cy="60" r="52" gradientUnits="userSpaceOnUse">
                  <stop offset="0.70" stopColor="rgba(255,255,255,0.00)" />
                  <stop offset="0.86" stopColor="rgba(255,255,255,0.22)" />
                  <stop offset="1" stopColor="rgba(0,0,0,0.55)" />
                </radialGradient>
                <linearGradient id="menuBallSpikeFace" x1="0" y1="0" x2="1" y2="1" gradientUnits="objectBoundingBox">
                  <stop offset="0" stopColor="#0B1220" />
                  <stop offset="0.35" stopColor="#111827" />
                  <stop offset="0.72" stopColor="#374151" />
                  <stop offset="1" stopColor="#6B7280" />
                </linearGradient>
                <linearGradient id="menuBallSpikeHi" x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
                  <stop offset="0" stopColor="rgba(255,255,255,0.00)" />
                  <stop offset="0.45" stopColor="rgba(255,255,255,0.32)" />
                  <stop offset="1" stopColor="rgba(255,255,255,0.10)" />
                </linearGradient>
                <linearGradient id="menuBallSpikeLo" x1="0" y1="1" x2="1" y2="0" gradientUnits="objectBoundingBox">
                  <stop offset="0" stopColor="rgba(0,0,0,0.52)" />
                  <stop offset="0.55" stopColor="rgba(0,0,0,0.18)" />
                  <stop offset="1" stopColor="rgba(0,0,0,0.00)" />
                </linearGradient>
                <radialGradient id="menuBallShadow" cx="60" cy="96" r="34" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="rgba(0,0,0,0.55)" />
                  <stop offset="1" stopColor="rgba(0,0,0,0.00)" />
                </radialGradient>
                <filter id="menuBallSpikeShadow" x="-30%" y="-30%" width="160%" height="160%" colorInterpolationFilters="sRGB">
                  <feDropShadow dx="0" dy="1.2" stdDeviation="1.0" floodColor="rgba(0,0,0,0.55)" />
                </filter>
                <filter id="menuBallBallShadow" x="-40%" y="-40%" width="180%" height="180%" colorInterpolationFilters="sRGB">
                  <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="rgba(0,0,0,0.55)" />
                </filter>
              </defs>
              <ellipse cx="60" cy="96" rx="34" ry="12" fill="url(#menuBallShadow)" />
              <g filter="url(#menuBallSpikeShadow)">
                <g transform="translate(60 60)">
                  <g id="menuBallSpike3d">
                    <path d="M 34 -6 C 40 -6 46 -3 56 0 C 46 3 40 6 34 6 Q 31 0 34 -6 Z" fill="url(#menuBallSpikeFace)" />
                    <path d="M 34 -6 C 41 -5.8 47 -3.1 56 0" fill="none" stroke="url(#menuBallSpikeHi)" strokeWidth="1.4" strokeLinecap="round" />
                    <path d="M 34 6 C 41 5.8 47 3.1 56 0" fill="none" stroke="url(#menuBallSpikeLo)" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M 34 -6 Q 31 0 34 6" fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeLinecap="round" />
                  </g>
                  <use href="#menuBallSpike3d" />
                  <g transform="rotate(30) scale(0.98)"><use href="#menuBallSpike3d" /></g>
                  <g transform="rotate(60) scale(1.02)"><use href="#menuBallSpike3d" /></g>
                  <g transform="rotate(90) scale(0.99)"><use href="#menuBallSpike3d" /></g>
                  <g transform="rotate(120) scale(1.03)"><use href="#menuBallSpike3d" /></g>
                  <g transform="rotate(150) scale(0.97)"><use href="#menuBallSpike3d" /></g>
                  <g transform="rotate(180) scale(1.01)"><use href="#menuBallSpike3d" /></g>
                  <g transform="rotate(210) scale(0.98)"><use href="#menuBallSpike3d" /></g>
                  <g transform="rotate(240) scale(1.02)"><use href="#menuBallSpike3d" /></g>
                  <g transform="rotate(270) scale(0.99)"><use href="#menuBallSpike3d" /></g>
                  <g transform="rotate(300) scale(1.03)"><use href="#menuBallSpike3d" /></g>
                  <g transform="rotate(330) scale(0.97)"><use href="#menuBallSpike3d" /></g>
                </g>
              </g>
              <g filter="url(#menuBallBallShadow)">
                <circle cx="60" cy="60" r="34" fill="url(#menuBallBody)" />
                <circle cx="60" cy="60" r="34" fill="url(#menuBallSheen)" opacity="0.35" />
                <circle cx="60" cy="60" r="34" fill="url(#menuBallRim)" />
                <circle cx="60" cy="60" r="34" stroke="rgba(255,255,255,0.52)" strokeWidth="2" fill="none" />
              </g>
              <g opacity="0.22" stroke="rgba(255,255,255,0.35)" strokeWidth="1" strokeLinecap="round">
                <path d="M40 62 Q46 58 52 60" />
                <path d="M58 74 Q64 70 70 72" />
                <path d="M50 52 Q56 48 62 50" />
              </g>
            </svg>
          </span>
          <p className="text-xs font-bold text-red-800">Avoid flying projectiles!</p>
        </div>
      </div>
    </div>
  );
}
