import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import GameCanvas, { GameCanvasHandle } from "@/components/GameCanvas";
import Level20EndingOverlay from "@/components/Level20EndingOverlay";
import TouchControls from "@/components/TouchControls";
import { useSound } from "@/contexts/SoundContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Menu, Info, Home, Volume2, VolumeX } from "lucide-react";
import { useLocation } from "wouter";
import { useIsMobile } from "@/hooks/use-mobile";

type GameState = "menu" | "countdown" | "playing" | "gameover" | "level_transition" | "level20_ending";

export default function Play() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const gameCanvasRef = useRef<GameCanvasHandle>(null);
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [gameState, setGameState] = useState<GameState>("countdown");
  const {
    muted,
    masterVolume,
    musicVolume,
    sfxVolume,
    setMuted,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
    unlockAudio,
    stopMusic,
    resumeMusic,
    isMusicPlaying,
  } = useSound();

  // Lock orientation to portrait on mobile so the game is not used in landscape
  useEffect(() => {
    if (!isMobile) return;
    try {
      screen.orientation?.lock?.("portrait");
    } catch {
      // API may be unavailable (e.g. iOS, iframe) or lock may be denied
    }
    return () => {
      try {
        screen.orientation?.unlock?.();
      } catch {
        // ignore
      }
    };
  }, [isMobile]);

  /** On mobile: go to main menu (skip title) without URL params. */
  const goToMainMenu = () => {
    if (isMobile) sessionStorage.setItem("carrotroll_skip_title", "1");
    setLocation("/");
  };

  return (
    <div className="play-page h-screen flex flex-col overflow-y-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100 via-orange-50 to-white">
      {gameState === "level20_ending" &&
        createPortal(
          <Level20EndingOverlay onComplete={() => gameCanvasRef.current?.showGameOverAfterEnding?.()} />,
          isMobile ? document.body : (gameCanvasRef.current?.getContainerElement() ?? document.body)
        )}
      <div className="play-content flex-1 min-h-0 flex flex-col items-center justify-start w-full max-w-[min(100vw,400px)] mx-auto pt-2 pb-4 px-2 overflow-y-auto">
        <div className="relative w-full flex flex-col items-center justify-start shrink-0">
          <GameCanvas
            ref={gameCanvasRef}
            autoStart
            portraitAspect
            onStateChange={setGameState}
            onReturnToMenu={goToMainMenu}
          />
          {/* Hamburger menu: top-right, in-line with HUD (space reserved in .game-hud on mobile) */}
          <div className="game-menu-button absolute top-4 right-4 z-30 pointer-events-auto">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl border-2 border-black bg-white shadow-md hover:bg-orange-50"
                  aria-label="Menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-xl border-2 border-black shadow-lg">
                {isMobile && (
                  <>
                    <DropdownMenuItem
                      onClick={() => (isMusicPlaying ? stopMusic() : resumeMusic())}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      {isMusicPlaying ? (
                        <Volume2 className="h-4 w-4" />
                      ) : (
                        <VolumeX className="h-4 w-4" />
                      )}
                      {isMusicPlaying ? "Stop Music" : "Start Music"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={goToMainMenu} className="flex items-center gap-2 cursor-pointer">
                      <Home className="h-4 w-4" />
                      Back to Menu
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => setShowAboutDialog(true)} className="flex items-center gap-2 cursor-pointer">
                  <Info className="h-4 w-4" />
                  About
                </DropdownMenuItem>
                {!isMobile && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="font-display">Sound</DropdownMenuLabel>
                    <div
                      className="px-2 py-3 space-y-4"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="play-mute" className="text-sm font-medium cursor-pointer">Mute all</Label>
                        <Switch
                          id="play-mute"
                          checked={muted}
                          onCheckedChange={setMuted}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Master</Label>
                        <Slider
                          value={[masterVolume]}
                          onValueChange={([v]) => setMasterVolume(v)}
                          max={1}
                          min={0}
                          step={0.05}
                          disabled={muted}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Music</Label>
                        <Slider
                          value={[musicVolume]}
                          onValueChange={([v]) => setMusicVolume(v)}
                          max={1}
                          min={0}
                          step={0.05}
                          disabled={muted}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">SFX</Label>
                        <Slider
                          value={[sfxVolume]}
                          onValueChange={([v]) => setSfxVolume(v)}
                          max={1}
                          min={0}
                          step={0.05}
                          disabled={muted}
                        />
                      </div>
                    </div>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="touch-controls-container w-full flex-shrink-0 mt-2">
          <TouchControls
            onKeyPress={(key, pressed) => {
              gameCanvasRef.current?.handleKeyPress(key, pressed);
            }}
            onMove={(dx, dy) => {
              gameCanvasRef.current?.handleMove(dx, dy);
            }}
          />
        </div>
      </div>

      {/* About Dialog */}
      <Dialog open={showAboutDialog} onOpenChange={setShowAboutDialog}>
        <DialogContent className="max-w-2xl rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 md:p-10 bg-white">
          <DialogHeader>
            <DialogTitle className="font-display text-4xl text-gray-900 mb-2">About Carrot Roll</DialogTitle>
            <DialogDescription className="text-primary font-bold text-lg mb-6">Arcade Survival</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <p className="text-gray-700 leading-relaxed">
              Carrot Roll is a fast-paced arcade game. You play as a flying rabbit dodging a giant rolling carrot that shoots broccoli. Collect small carrots to level up, avoid broccoli and spiky balls, and grab power-ups for shields, speed, and extra lives.
            </p>
            <div className="bg-orange-50 rounded-xl p-4 border-2 border-orange-100">
              <h2 className="font-display text-xl text-gray-900 mb-2">Controls</h2>
              <p className="text-gray-700 text-sm">
                Use the touchpad to move and the fire button to shoot. Collect 10 carrots to level up; avoid the giant carrot and falling hazards!
              </p>
            </div>
            <p className="text-gray-500 text-sm">
              Created by my daughter, Nya.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
