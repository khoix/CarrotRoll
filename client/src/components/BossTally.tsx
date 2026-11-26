import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Intermission } from "@/game/engine";

const COUNT_DELAY_MS = 1100;
const COUNT_MS = 1200;

/** The score counting up from `from` to `to`, starting after a short delay. */
function useCountUp(from: number, to: number, onDone?: () => void) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    setValue(from);
    let raf = 0;
    let done = false;
    const t0 = performance.now() + COUNT_DELAY_MS;
    const tick = (now: number) => {
      const k = Math.max(0, Math.min(1, (now - t0) / COUNT_MS));
      const eased = 1 - Math.pow(1 - k, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
      else if (!done) {
        done = true;
        onDone?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);
  return value;
}

function TallyCard({ info, onCounted }: { info: Intermission; onCounted?: () => void }) {
  const score = useCountUp(info.scoreFrom, info.scoreTo, onCounted);
  const rows: { label: string; value: string; tone?: string }[] = [
    { label: info.defeated ? "Boss bonus" : "Survival bonus", value: `+${info.bonus.toLocaleString()}`, tone: "text-primary" },
    ...(info.heart ? [{ label: "Extra heart", value: "+1 ❤️", tone: "text-rose-500" }] : []),
    { label: "Hits taken", value: info.hits === 0 ? "None! ✨" : String(info.hits), tone: info.hits === 0 ? "text-green-600" : "text-gray-700" },
    { label: "Fight time", value: `${info.seconds.toFixed(1)} s`, tone: "text-gray-700" },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { delay: 0.5, type: "spring", stiffness: 260, damping: 22 } }}
      exit={{ opacity: 0, y: -16, scale: 0.96, transition: { duration: 0.3 } }}
      className="boss-tally w-[88%] max-w-sm rounded-3xl border-4 border-black bg-white p-6 text-center shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
      role="status"
      aria-live="polite"
    >
      <h2 className={`font-display text-4xl leading-none text-shadow-lg ${info.defeated ? "text-green-500" : "text-orange-500"}`}>
        {info.defeated ? "BOSS DEFEATED!" : "BOSS SURVIVED!"}
      </h2>
      <p className="mt-1 text-sm font-bold text-gray-500">{info.bossName}</p>
      <div className="mt-4 space-y-1.5 rounded-xl border-2 border-gray-200 bg-gray-50 px-4 py-3">
        {rows.map((r, i) => (
          <motion.div
            key={r.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0, transition: { delay: 0.75 + i * 0.12 } }}
            className="flex items-baseline justify-between"
          >
            <span className="text-xs font-bold uppercase text-gray-500">{r.label}</span>
            <span className={`font-display text-xl ${r.tone ?? ""}`}>{r.value}</span>
          </motion.div>
        ))}
      </div>
      <div className="mt-3 flex items-end justify-between border-b-2 border-gray-200 pb-2">
        <span className="text-xs font-bold uppercase text-gray-500">Score</span>
        <span className="font-display text-5xl tabular-nums text-primary">{score.toLocaleString()}</span>
      </div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 2.4 } }} className="mt-3 font-display text-lg text-gray-800">
        Next: Level {info.next.level} · {info.next.tierName}
      </motion.p>
      {info.next.newHazards.length > 0 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 2.6 } }} className="text-xs font-bold text-gray-500">
          Watch for {info.next.newHazards.join(" and ").toLowerCase()}
        </motion.p>
      )}
    </motion.div>
  );
}

/** Between tiers: the boss fight's tally, over the game while the giant carrot is away. */
export default function BossTally({ info, onCounted }: { info: Intermission | null; onCounted?: () => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[15] flex items-center justify-center">
      <AnimatePresence>{info && <TallyCard key={info.scoreTo} info={info} onCounted={onCounted} />}</AnimatePresence>
    </div>
  );
}
