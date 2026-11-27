import { Pause } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCoarsePointer } from "@/hooks/use-mobile";
import { PAUSE_CORNERS, TOUCH_SENSITIVITIES, setSetting, useSettings, type PauseCorner } from "@/lib/settings";

const CORNER_LABEL: Record<PauseCorner, string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
};

/** Gameplay settings saved on this device: touch sensitivity (touch screens) and pause button corner. */
export default function SettingsDialog({
  open,
  onOpenChange,
  className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
}) {
  const { touchSensitivity, pauseCorner } = useSettings();
  const touch = useCoarsePointer();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-sm rounded-3xl border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${className}`}>
        <DialogHeader>
          <DialogTitle className="font-display text-3xl text-gray-900">Settings</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">Saved on this device.</DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {touch && (
            <section className="space-y-2" aria-labelledby="settings-sensitivity">
              <h3 id="settings-sensitivity" className="text-sm font-bold text-gray-800">
                Touch sensitivity
              </h3>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-labelledby="settings-sensitivity">
                {TOUCH_SENSITIVITIES.map((v) => {
                  const on = v === touchSensitivity;
                  return (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSetting("touchSensitivity", v)}
                      className={`rounded-xl border-2 px-2 py-2 font-display text-lg transition-colors ${
                        on ? "border-black bg-primary text-white shadow-[0_3px_0_rgba(0,0,0,0.6)]" : "border-gray-300 bg-white text-gray-700 hover:bg-orange-50"
                      }`}
                    >
                      {v === 1 ? "Normal" : `${v}×`}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500">
                Higher moves the bunny farther for the same finger movement, so your thumb travels less. Its top speed stays the same.
              </p>
            </section>
          )}
          <section className="space-y-2" aria-labelledby="settings-pause">
            <h3 id="settings-pause" className="text-sm font-bold text-gray-800">
              Pause button position
            </h3>
            <div className="flex items-center gap-4">
              {/* A little screen: tap the corner where the pause button should go */}
              <div
                className="relative h-28 w-20 flex-shrink-0 rounded-xl border-2 border-black bg-gradient-to-b from-sky-100 to-green-100"
                role="radiogroup"
                aria-labelledby="settings-pause"
              >
                {PAUSE_CORNERS.map((c) => {
                  const on = c === pauseCorner;
                  const [v, h] = c.split("-");
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      aria-label={CORNER_LABEL[c]}
                      onClick={() => setSetting("pauseCorner", c)}
                      className={`absolute flex h-7 w-7 items-center justify-center rounded-lg border-2 transition-colors ${v === "top" ? "top-1" : "bottom-1"} ${
                        h === "left" ? "left-1" : "right-1"
                      } ${on ? "border-black bg-primary text-white" : "border-dashed border-gray-400 bg-white/70 text-transparent hover:text-gray-400"}`}
                    >
                      <Pause className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
              <p className="text-sm text-gray-700">
                <span className="font-bold">{CORNER_LABEL[pauseCorner]}</span>
                {pauseCorner === "top-right" ? " (default)" : ""}
                <br />
                <span className="text-xs text-gray-500">Tap a corner to move the pause button there.</span>
              </p>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
