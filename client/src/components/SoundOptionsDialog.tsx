import { useSound } from "@/contexts/SoundContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

/** Every sound control in one place: music on/off, mute, and the three volume sliders. */
export default function SoundOptionsDialog({
  open,
  onOpenChange,
  className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Extra classes for the dialog (e.g. a z-index above the full-screen game). */
  className?: string;
}) {
  const {
    muted,
    masterVolume,
    musicVolume,
    sfxVolume,
    setMuted,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
    isMusicPlaying,
    stopMusic,
    resumeMusic,
  } = useSound();

  const sliders = [
    ["Master", masterVolume, setMasterVolume],
    ["Music", musicVolume, setMusicVolume],
    ["Sound effects", sfxVolume, setSfxVolume],
  ] as const;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-sm rounded-3xl border-4 border-black bg-white p-6 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${className}`}>
        <DialogHeader>
          <DialogTitle className="font-display text-3xl text-gray-900">Sound Options</DialogTitle>
          <DialogDescription className="text-sm text-gray-500">Volume and mute settings are saved on this device.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-3 rounded-xl border-2 border-orange-100 bg-orange-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="sound-music" className="cursor-pointer text-sm font-bold text-gray-800">
                Background music
              </Label>
              <Switch
                id="sound-music"
                checked={isMusicPlaying}
                onCheckedChange={(on) => (on ? resumeMusic() : stopMusic())}
                disabled={muted}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="sound-mute" className="cursor-pointer text-sm font-bold text-gray-800">
                Mute all
              </Label>
              <Switch id="sound-mute" checked={muted} onCheckedChange={setMuted} />
            </div>
          </div>
          {sliders.map(([label, value, set]) => (
            <div key={label} className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label className="text-sm font-medium text-gray-700">{label}</Label>
                <span className="text-xs tabular-nums text-gray-500">{Math.round(value * 100)}%</span>
              </div>
              <Slider value={[value]} onValueChange={([v]) => set(v)} max={1} min={0} step={0.05} disabled={muted} aria-label={`${label} volume`} />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
