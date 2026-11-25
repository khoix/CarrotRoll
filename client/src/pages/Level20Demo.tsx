import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import GameCanvas, { GameCanvasHandle } from "@/components/GameCanvas";
import Level20EndingOverlay from "@/components/Level20EndingOverlay";
import { useSound } from "@/contexts/SoundContext";

type GameState = "menu" | "countdown" | "playing" | "gameover" | "level_transition" | "level20_ending";

export default function Level20Demo() {
  const [, setLocation] = useLocation();
  const gameCanvasRef = useRef<GameCanvasHandle>(null);
  const soundUnlockedRef = useRef(false);
  const { unlockAudio, setMusicState, preloadSfx } = useSound();
  const [gameState, setGameState] = useState<GameState>("menu");

  const enableSound = useCallback(() => {
    if (!soundUnlockedRef.current) {
      soundUnlockedRef.current = true;
      unlockAudio();
      setMusicState("playing");
      preloadSfx();
    }
  }, [unlockAudio, setMusicState, preloadSfx]);

  const handleOverlayComplete = () => {
    gameCanvasRef.current?.resetToMenu?.();
    setGameState("menu");
  };

  return (
    <div
      className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100 via-orange-50 to-white"
      onClick={enableSound}
      onKeyDown={enableSound}
      role="presentation"
    >
      {gameState === "level20_ending" &&
        createPortal(
          <Level20EndingOverlay onComplete={() => gameCanvasRef.current?.showGameOverAfterEnding?.()} />,
          gameCanvasRef.current?.getContainerElement() ?? document.body
        )}

      <div className="flex-none p-4 flex items-center justify-between gap-4 border-b border-black/10 bg-white/80">
        <h1 className="font-display text-xl text-gray-900">
          Endgame Demo — Level 19
        </h1>
        <p className="text-sm text-gray-500 hidden sm:block">
          Complete level 19 to trigger the ending sequence.
        </p>
        <Button
          onClick={() => setLocation("/")}
          variant="outline"
          size="sm"
          className="font-bold text-gray-500 hover:text-black shrink-0"
        >
          Back to Home
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0" onClick={enableSound}>
        <GameCanvas
          ref={gameCanvasRef}
          autoStart
          initialLevel={19}
          onStateChange={setGameState}
          onReturnToMenu={() => setLocation("/")}
          onSoundUnlock={enableSound}
        />
      </div>
    </div>
  );
}
