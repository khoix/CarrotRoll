/**
 * Short, non-blocking banners over the game: an item's first appearance on this device, a new
 * tier, a boss. Shown one at a time (queued), never pausing play or catching touches.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Announcement } from "@/game/engine";

const SHOW_MS: Record<Announcement["kind"], number> = { new: 3000, tier: 2600, boss: 2200 };
const GAP_MS = 350;

export function useBannerQueue() {
  const queueRef = useRef<Announcement[]>([]);
  const [current, setCurrent] = useState<Announcement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showNext = useCallback(() => {
    const next = queueRef.current.shift() ?? null;
    setCurrent(next);
    if (next) {
      timerRef.current = setTimeout(() => {
        setCurrent(null);
        timerRef.current = setTimeout(showNext, GAP_MS);
      }, SHOW_MS[next.kind]);
    } else {
      timerRef.current = null;
    }
  }, []);

  const push = useCallback(
    (a: Announcement) => {
      // A tier or boss banner jumps ahead of item intros; duplicates are dropped.
      if (queueRef.current.some((q) => q.kind === a.kind && q.title === a.title)) return;
      if (a.kind === "new") queueRef.current.push(a);
      else queueRef.current.unshift(a);
      if (!timerRef.current) showNext();
    },
    [showNext]
  );

  const clear = useCallback(() => {
    queueRef.current = [];
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setCurrent(null);
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { current, push, clear };
}

export function GameBanner({ banner }: { banner: Announcement | null }) {
  return (
    <div className="game-banner-slot pointer-events-none absolute inset-x-0 z-20 flex justify-center px-4">
      <AnimatePresence>
        {banner && (
          <motion.div
            key={`${banner.kind}:${banner.title}`}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
            className={`game-banner game-banner--${banner.kind}`}
            role="status"
            aria-live="polite"
          >
            {banner.kind === "new" && <span className="game-banner-badge">NEW</span>}
            <span className="game-banner-title">{banner.title}</span>
            {banner.body && <span className="game-banner-body">{banner.body}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
