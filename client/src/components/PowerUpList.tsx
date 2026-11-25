/**
 * The home page's power-up guide, driven by the content table. Items this device hasn't seen in
 * a game yet stay hidden as "???" with the level they unlock at, so finding them is a goal.
 */
import { useEffect, useRef, useState } from "react";
import { ITEMS } from "@/game/content";
import { drawPowerup, type PowerupType } from "@/game/art";

const SEEN_KEY = "carrotroll_seen_items";

function loadSeen(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}

/** The in-game icon, drawn with the same code as the game. */
function PowerUpIcon({ type, locked }: { type: PowerupType; locked: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = 40 * dpr;
    c.height = 40 * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, 40, 40);
    ctx.translate(20, 20);
    if (locked) {
      ctx.fillStyle = "#4b5563";
      ctx.strokeStyle = "#9ca3af";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-16, -16, 32, 32, 5);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#e5e7eb";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("?", 0, 1);
    } else {
      drawPowerup(ctx, type, 32, 32);
    }
  }, [type, locked]);
  return <canvas ref={ref} className="h-10 w-10 shrink-0" style={{ width: 40, height: 40 }} aria-hidden />;
}

export default function PowerUpList({ columns = 1 }: { columns?: 1 | 2 }) {
  const [seen, setSeen] = useState<Set<string>>(() => loadSeen());
  useEffect(() => {
    const refresh = () => setSeen(loadSeen());
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const found = ITEMS.filter((i) => seen.has(i.id)).length;

  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-indigo-200">
        Discovered {found} of {ITEMS.length}
      </p>
      <ul className={columns === 2 ? "grid grid-cols-2 gap-x-4 gap-y-3" : "space-y-3"}>
        {ITEMS.map((item) => {
          const locked = !seen.has(item.id);
          return (
            <li key={item.id} className="flex items-center gap-3">
              <PowerUpIcon type={item.entity as PowerupType} locked={locked} />
              <div className="min-w-0">
                <p className="text-sm font-bold">{locked ? "???" : item.name}</p>
                <p className="text-xs leading-snug text-indigo-200">{locked ? `Appears from level ${item.unlockLevel}` : item.blurb}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
