import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSound } from "@/contexts/SoundContext";
import GameCanvas, { GameCanvasHandle, type SpawnableType } from "@/components/GameCanvas";

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const SPAWN_MARGIN = 60;

const SPAWNABLE_ENTRIES: { type: SpawnableType; label: string }[] = [
  { type: "spike", label: "Broccoli" },
  { type: "ball", label: "Spiky ball" },
  { type: "carrot", label: "Carrot" },
  { type: "powerup_heart", label: "Heart" },
  { type: "powerup_invincible", label: "Shield" },
  { type: "powerup_speed", label: "Speed" },
  { type: "powerup_blaster", label: "Blaster" },
  { type: "powerup_attract", label: "Attract" },
];

const defaultSpawnCounts: Record<SpawnableType, number> = {
  spike: 1,
  ball: 1,
  carrot: 1,
  powerup_heart: 1,
  powerup_invincible: 1,
  powerup_speed: 1,
  powerup_blaster: 1,
  powerup_attract: 1,
};

interface AdminDemoProps {
  onBackToAdmin: () => void;
}

export default function AdminDemo({ onBackToAdmin }: AdminDemoProps) {
  const gameCanvasRef = useRef<GameCanvasHandle>(null);
  const soundUnlockedRef = useRef(false);
  const { unlockAudio, setMusicState, preloadSfx } = useSound();
  const [damageOn, setDamageOn] = useState(false);
  const [demoLevel, setDemoLevel] = useState(1);
  const [spawnCounts, setSpawnCounts] = useState<Record<SpawnableType, number>>(() => ({ ...defaultSpawnCounts }));

  const enableSound = useCallback(() => {
    if (!soundUnlockedRef.current) {
      soundUnlockedRef.current = true;
      unlockAudio();
      setMusicState("playing");
      preloadSfx();
    }
  }, [unlockAudio, setMusicState, preloadSfx]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData("text/plain") as SpawnableType | "";
      if (!type || !SPAWNABLE_ENTRIES.some((entry) => entry.type === type)) return;
      const pt = gameCanvasRef.current?.clientToGame(e.clientX, e.clientY);
      if (pt) gameCanvasRef.current?.spawnEntity(pt.x, pt.y, type as SpawnableType);
    },
    []
  );

  const handleLevelChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const n = Number(e.target.value);
      setDemoLevel(n);
      gameCanvasRef.current?.setLevel(n);
    },
    []
  );

  const setSpawnCount = useCallback((type: SpawnableType, value: number) => {
    const n = Math.max(1, Math.min(99, Math.floor(value) || 1));
    setSpawnCounts((prev) => ({ ...prev, [type]: n }));
  }, []);

  const spawnMany = useCallback((type: SpawnableType) => {
    const handle = gameCanvasRef.current;
    if (!handle) return;
    const n = Math.max(1, Math.min(99, spawnCounts[type] ?? 1));
    const minX = SPAWN_MARGIN;
    const maxX = CANVAS_WIDTH - SPAWN_MARGIN;
    const minY = SPAWN_MARGIN;
    const maxY = CANVAS_HEIGHT - SPAWN_MARGIN;
    for (let i = 0; i < n; i++) {
      const x = minX + Math.random() * (maxX - minX);
      const y = minY + Math.random() * (maxY - minY);
      handle.spawnEntity(x, y, type);
    }
  }, [spawnCounts]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 min-w-0 w-full" onClick={enableSound} onKeyDown={enableSound} role="presentation">
      <div className="flex-none flex flex-wrap items-center gap-4 p-4 border-b border-gray-200 bg-white min-w-0">
        <Button variant="ghost" size="sm" onClick={() => { enableSound(); onBackToAdmin(); }} className="shrink-0">
          Back to Admin
        </Button>
        <h1 className="font-display text-xl font-bold text-gray-900 shrink-0 break-words min-w-0">Demo</h1>
        <div className="flex items-center gap-2 shrink-0" onClick={enableSound}>
          <input
            id="admin-demo-damage"
            type="checkbox"
            checked={damageOn}
            onChange={(e) => { enableSound(); setDamageOn(e.target.checked); }}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="admin-demo-damage" className="text-sm font-medium cursor-pointer">
            Damage on
          </Label>
        </div>
        <div className="flex items-center gap-2 shrink-0" onClick={enableSound}>
          <Label htmlFor="admin-demo-level" className="text-sm font-medium">
            Level
          </Label>
          <select
            id="admin-demo-level"
            value={demoLevel}
            onChange={(e) => { enableSound(); handleLevelChange(e); }}
            className="rounded border border-input bg-background px-2 py-1.5 text-sm"
          >
            {Array.from({ length: 19 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div className="w-56 flex-none border-r border-gray-200 bg-white p-3 overflow-y-auto shrink-0">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 break-words">Spawn (drag to canvas or set count + Spawn)</p>
          <ul className="space-y-2">
            {SPAWNABLE_ENTRIES.map(({ type, label }) => (
              <li key={type} className="flex flex-col gap-1.5">
                <div
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", type);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="cursor-grab active:cursor-grabbing rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-100 touch-manipulation break-words"
                >
                  {label}
                </div>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={spawnCounts[type]}
                    onChange={(e) => setSpawnCount(type, e.target.valueAsNumber)}
                    onFocus={enableSound}
                    className="h-8 w-14 text-center text-sm rounded border-2 border-gray-300 px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    aria-label={`Number of ${label} to spawn`}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-2 text-xs shrink-0 rounded border-2 border-black hover:bg-orange-50"
                    onClick={() => { enableSound(); spawnMany(type); }}
                  >
                    Spawn
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div
          className="flex-1 flex flex-col items-center justify-center p-4 min-h-0 min-w-0 bg-orange-50"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={enableSound}
        >
          <GameCanvas
            ref={gameCanvasRef}
            autoStart
            initialLevel={1}
            damageDisabled={!damageOn}
            onReturnToMenu={onBackToAdmin}
            onSoundUnlock={enableSound}
          />
        </div>
      </div>
    </div>
  );
}
