import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import GameCanvas, { GameCanvasHandle } from "@/components/GameCanvas";
import Level20EndingOverlay from "@/components/Level20EndingOverlay";
import TouchControls from "@/components/TouchControls";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Menu, Info, Home, SlidersHorizontal, Settings as SettingsIcon, Maximize2, Gamepad2 } from "lucide-react";
import SoundOptionsDialog from "@/components/SoundOptionsDialog";
import SettingsDialog from "@/components/SettingsDialog";
import { useLocation } from "wouter";
import { useCoarsePointer, useIsMobile } from "@/hooks/use-mobile";

type GameState = "menu" | "countdown" | "playing" | "gameover" | "level_transition" | "level20_ending";

const CLASSIC_KEY = "carrotroll_classic_controls";
function loadClassic() {
  try {
    return localStorage.getItem(CLASSIC_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Full-viewport play screen. Touch: drag anywhere to fly, blasters auto-fire.
 * Works in portrait (taller playfield) and landscape (4:3 with blurred side bars).
 */
export default function Play() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const coarse = useCoarsePointer();
  const gameCanvasRef = useRef<GameCanvasHandle>(null);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showSoundOptions, setShowSoundOptions] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [classicControls, setClassicControls] = useState(loadClassic);
  const [isFullscreen, setIsFullscreen] = useState(false);
  /** /play?daily=1 plays today's daily challenge. */
  const [daily] = useState(() => new URLSearchParams(window.location.search).get("daily") === "1");


  useEffect(() => {
    try {
      localStorage.setItem(CLASSIC_KEY, classicControls ? "1" : "0");
    } catch {
      // ignore
    }
  }, [classicControls]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  /** Back to the main menu (skip the title screen on the way). */
  const goToMainMenu = useCallback(() => {
    sessionStorage.setItem("carrotroll_skip_title", "1");
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setLocation("/");
  }, [setLocation]);

  const isActive = gameState === "playing" || gameState === "countdown";
  const fullscreenSupported = typeof document !== "undefined" && !!document.fullscreenEnabled;

  return (
    <div className="play-page">
      <GameCanvas
        ref={gameCanvasRef}
        autoStart
        startGate
        fillViewport
        daily={daily}
        onStateChange={setGameState}
        onReturnToMenu={goToMainMenu}
      >
        <DropdownMenu
          onOpenChange={(open) => {
            // Opening the menu mid-run pauses the game.
            if (open && isActive) gameCanvasRef.current?.pause();
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="game-control-btn hover:bg-orange-50" aria-label="Menu">
              <Menu className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="z-[60] w-64 rounded-xl border-2 border-black shadow-lg">
            <DropdownMenuItem onClick={() => setShowSoundOptions(true)} className="flex cursor-pointer items-center gap-2">
              <SlidersHorizontal className="h-4 w-4" />
              Sound Options
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowSettings(true)} className="flex cursor-pointer items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            {fullscreenSupported && (
              <DropdownMenuItem onClick={() => gameCanvasRef.current?.toggleFullscreen()} className="flex cursor-pointer items-center gap-2">
                <Maximize2 className="h-4 w-4" />
                {isFullscreen ? "Exit Full Screen" : "Full Screen"}
              </DropdownMenuItem>
            )}
            {coarse && (
              <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                onClick={() => setClassicControls((v) => !v)}
                className="flex cursor-pointer items-center gap-2"
              >
                <Gamepad2 className="h-4 w-4" />
                <span className="flex-1">Classic touchpad</span>
                <Switch checked={classicControls} aria-label="Classic touchpad" className="pointer-events-none" />
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={goToMainMenu} className="flex cursor-pointer items-center gap-2">
              <Home className="h-4 w-4" />
              Back to Menu
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowAboutDialog(true)} className="flex cursor-pointer items-center gap-2">
              <Info className="h-4 w-4" />
              About
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </GameCanvas>

      {classicControls && coarse && isActive && (
        <div className="classic-controls fixed inset-x-0 bottom-0 z-[45] flex justify-center px-2 opacity-90" data-no-drag>
          <TouchControls
            onKeyPress={(key, pressed) => gameCanvasRef.current?.handleKeyPress(key, pressed)}
            onMove={(dx, dy) => gameCanvasRef.current?.handleMove(dx, dy)}
          />
        </div>
      )}

      {gameState === "level20_ending" &&
        createPortal(
          <Level20EndingOverlay onComplete={() => gameCanvasRef.current?.showGameOverAfterEnding?.()} />,
          gameCanvasRef.current?.getContainerElement() ?? document.body
        )}

      <SoundOptionsDialog open={showSoundOptions} onOpenChange={setShowSoundOptions} className="z-[70]" />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} className="z-[70]" />

      <Dialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <DialogContent className="z-[70] max-w-2xl rounded-3xl border-4 border-black bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:p-10">
          <DialogHeader>
            <DialogTitle className="mb-2 font-display text-4xl text-gray-900">About Carrot Roll</DialogTitle>
            <DialogDescription className="mb-6 text-lg font-bold text-primary">Arcade Survival</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <p className="leading-relaxed text-gray-700">
              Carrot Roll is a fast-paced arcade game. You play as a flying rabbit dodging a giant rolling carrot that shoots broccoli. Collect small
              carrots to level up, avoid broccoli and spiky balls, and grab power-ups for shields, speed, and extra lives.
            </p>
            <div className="rounded-xl border-2 border-orange-100 bg-orange-50 p-4">
              <h2 className="mb-2 font-display text-xl text-gray-900">Controls</h2>
              <p className="text-sm text-gray-700">
                {coarse || isMobile
                  ? "Drag anywhere on the screen to fly. Blasters fire automatically while the power-up is active. Rotate your phone any time."
                  : "WASD or arrow keys to move, Space to fire, P or Esc to pause."}{" "}
                Collect 10 carrots to level up; avoid the giant carrot and falling hazards!
              </p>
            </div>
            <p className="text-sm text-gray-500">Created by my daughter, Nya.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
