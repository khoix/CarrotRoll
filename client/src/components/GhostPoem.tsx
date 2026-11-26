/**
 * The ending poem's haunting shimmer: every word breathes on its own (with the odd candle-like
 * gutter), two tinted spectral echoes drift apart and back, a sheen of moonlight sweeps across
 * the letters, and a cold glow sits around them. Everything is a CSS animation (opacity and
 * transform only, so it runs on the compositor); it all stops for prefers-reduced-motion.
 */
import type { CSSProperties } from "react";

const CSS = `
@keyframes ghost-poem-breathe {
  0%, 100% { opacity: .58 }
  16% { opacity: .92 }
  30% { opacity: .74 }
  48% { opacity: 1 }
  53% { opacity: .38 }
  56% { opacity: .9 }
  78% { opacity: .66 }
}
@keyframes ghost-poem-sheen {
  from { background-position: 135% 0 }
  to { background-position: -35% 0 }
}
@keyframes ghost-poem-drift-a {
  0%, 100% { transform: translate(-6px, 2px) skewX(0deg) }
  33% { transform: translate(5px, -3px) skewX(1.2deg) }
  66% { transform: translate(8px, 4px) skewX(-0.8deg) }
}
@keyframes ghost-poem-drift-b {
  0%, 100% { transform: translate(6px, -2px) scale(1.01) }
  40% { transform: translate(-7px, 3px) scale(0.99) }
  70% { transform: translate(-3px, -4px) scale(1.02) }
}
@keyframes ghost-poem-echo {
  0%, 100% { opacity: .22 }
  45% { opacity: .55 }
  60% { opacity: .3 }
}
@keyframes ghost-poem-mote {
  0% { transform: translate3d(0, 0, 0); opacity: 0 }
  15% { opacity: var(--o) }
  80% { opacity: var(--o) }
  100% { transform: translate3d(var(--dx), -105vh, 0); opacity: 0 }
}
@keyframes ghost-poem-fog {
  0%, 100% { transform: translate(-8%, 2%) scale(1) }
  50% { transform: translate(8%, -3%) scale(1.15) }
}
.ghost-poem-word { animation: ghost-poem-breathe var(--d) ease-in-out var(--delay) infinite; }
.ghost-poem-echo-a { animation: ghost-poem-drift-a 11s ease-in-out infinite, ghost-poem-echo 7s ease-in-out infinite; }
.ghost-poem-echo-b { animation: ghost-poem-drift-b 13s ease-in-out infinite, ghost-poem-echo 9s ease-in-out -3s infinite; }
.ghost-poem-sheen {
  color: transparent;
  -webkit-text-fill-color: transparent;
  background-image: linear-gradient(105deg, transparent 40%, rgba(235, 245, 255, .95) 50%, transparent 60%);
  background-size: 260% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  animation: ghost-poem-sheen 6.5s cubic-bezier(.45, 0, .55, 1) infinite;
}
.ghost-poem-mote { animation: ghost-poem-mote var(--d) linear var(--delay) infinite; }
.ghost-poem-fog { animation: ghost-poem-fog var(--d) ease-in-out var(--delay) infinite; }
@media (prefers-reduced-motion: reduce) {
  .ghost-poem-word, .ghost-poem-echo-a, .ghost-poem-echo-b, .ghost-poem-sheen, .ghost-poem-mote, .ghost-poem-fog { animation: none; }
  .ghost-poem-sheen, .ghost-poem-mote { display: none; }
}
`;

/** Stable pseudo-random in [0, 1) for index i (so the flicker pattern is the same every time). */
function rand(i: number, salt = 0) {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Lines of words; each word gets its own breathing rhythm. */
function Words({ lines, paragraph, breathe }: { lines: string[]; paragraph: boolean; breathe: boolean }) {
  let n = 0;
  const renderLine = (line: string) =>
    line.split(" ").map((w, j, all) => {
      const i = n++;
      const style = breathe
        ? ({ "--d": `${6 + rand(i) * 4}s`, "--delay": `${-rand(i, 1) * 10}s` } as CSSProperties)
        : undefined;
      return (
        <span key={j}>
          <span className={breathe ? "ghost-poem-word" : undefined} style={style}>
            {w}
          </span>
          {j < all.length - 1 ? " " : ""}
        </span>
      );
    });
  if (paragraph) {
    return (
      <div style={{ textAlign: "center", whiteSpace: "normal" }}>
        {lines.map((line, k) => (
          <span key={k}>
            {renderLine(line)}
            {k < lines.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    );
  }
  return (
    <>
      {lines.map((line, k) => (
        <div key={k} style={{ textAlign: "center", whiteSpace: "nowrap" }}>
          {renderLine(line)}
        </div>
      ))}
    </>
  );
}

export function GhostPoem({
  lines,
  paragraph,
  fontSize,
  lineHeight,
  letterSpacing,
  lite,
}: {
  lines: string[];
  /** Mobile: one word-wrapped paragraph instead of one line per verse. */
  paragraph: boolean;
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
  /** Phones: one spectral echo instead of two. */
  lite: boolean;
}) {
  const text: CSSProperties = { width: "100%", fontSize, lineHeight, letterSpacing };
  const layer: CSSProperties = { ...text, position: "absolute", top: 0, left: 0, pointerEvents: "none" };
  return (
    <div className="relative" style={{ width: "100%", textAlign: "center" }}>
      <style>{CSS}</style>
      {/* Spectral echoes: tinted, blurred copies drifting on their own paths */}
      <div
        className="font-crawl ghost-poem-echo-a"
        aria-hidden
        style={{ ...layer, color: "rgb(150, 205, 255)", filter: "blur(5px)", mixBlendMode: "screen", fontStyle: "italic" }}
      >
        <Words lines={lines} paragraph={paragraph} breathe={false} />
      </div>
      {!lite && (
        <div
          className="font-crawl ghost-poem-echo-b"
          aria-hidden
          style={{ ...layer, color: "rgb(205, 175, 255)", filter: "blur(8px)", mixBlendMode: "screen" }}
        >
          <Words lines={lines} paragraph={paragraph} breathe={false} />
        </div>
      )}
      {/* The words themselves: pale, cold glow, each breathing on its own */}
      <div
        className="font-crawl relative"
        style={{
          ...text,
          color: "rgba(236, 242, 255, 0.97)",
          textShadow: "0 0 10px rgba(185, 215, 255, 0.55), 0 0 26px rgba(140, 175, 255, 0.28), 0 2px 4px rgba(0, 0, 0, 0.6)",
        }}
      >
        <Words lines={lines} paragraph={paragraph} breathe />
      </div>
      {/* Moonlight sheen sweeping across the letters */}
      <div className="font-crawl ghost-poem-sheen" aria-hidden style={{ ...layer, mixBlendMode: "plus-lighter" }}>
        <Words lines={lines} paragraph={paragraph} breathe={false} />
      </div>
    </div>
  );
}

/** Fog and rising specks of dust behind the poem (fills its positioned parent). */
export function GhostAtmosphere({ lite }: { lite: boolean }) {
  const motes = Array.from({ length: lite ? 9 : 18 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {[0, 1].map((i) => (
        <div
          key={`fog-${i}`}
          className="ghost-poem-fog absolute"
          style={
            {
              left: i ? "35%" : "-25%",
              top: i ? "35%" : "10%",
              width: "90%",
              height: "70%",
              background: `radial-gradient(closest-side, rgba(${i ? "120, 140, 190" : "150, 170, 210"}, 0.16), transparent)`,
              "--d": `${22 + i * 7}s`,
              "--delay": `${-i * 9}s`,
            } as CSSProperties
          }
        />
      ))}
      {motes.map((i) => {
        const size = 2 + rand(i, 3) * 3;
        return (
          <div
            key={`mote-${i}`}
            className="ghost-poem-mote absolute rounded-full"
            style={
              {
                left: `${rand(i, 4) * 100}%`,
                bottom: "-4%",
                width: size,
                height: size,
                background: "rgba(220, 232, 255, 0.9)",
                boxShadow: "0 0 6px rgba(190, 215, 255, 0.8)",
                filter: size > 3.5 ? "blur(1px)" : undefined,
                "--o": `${0.25 + rand(i, 5) * 0.4}`,
                "--dx": `${(rand(i, 6) - 0.5) * 120}px`,
                "--d": `${14 + rand(i, 7) * 12}s`,
                "--delay": `${-rand(i, 8) * 26}s`,
              } as CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
