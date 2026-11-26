import { FINAL_LEVEL } from "@/game/content";
import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import GameCanvas, { GameCanvasHandle } from "@/components/GameCanvas";
import Level20EndingOverlay from "@/components/Level20EndingOverlay";

type GameState = "menu" | "countdown" | "playing" | "gameover" | "level_transition" | "level20_ending";

interface AdminEndingDemoProps {
  onBackToAdmin: () => void;
}

export default function AdminEndingDemo({ onBackToAdmin }: AdminEndingDemoProps) {
  const gameCanvasRef = useRef<GameCanvasHandle>(null);
  const [gameState, setGameState] = useState<GameState>("menu");

  const handleOverlayComplete = () => {
    gameCanvasRef.current?.resetToMenu?.();
    setGameState("menu");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100 via-orange-50 to-white">
      {gameState === "level20_ending" &&
        createPortal(
          <Level20EndingOverlay onComplete={() => gameCanvasRef.current?.showGameOverAfterEnding?.()} />,
          gameCanvasRef.current?.getContainerElement() ?? document.body
        )}

      <div className="flex-none p-4 flex items-center justify-between gap-4 border-b border-black/10 bg-white/80">
        <h1 className="font-display text-xl text-gray-900">
          Ending Sequence Demo — Level {FINAL_LEVEL} (final boss)
        </h1>
        <p className="text-sm text-gray-500 hidden sm:block">
          Beat (or survive) the final boss to trigger the ending sequence.
        </p>
        <Button
          onClick={onBackToAdmin}
          variant="outline"
          size="sm"
          className="font-bold text-gray-500 hover:text-black shrink-0"
        >
          Back to Admin
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0">
        <GameCanvas
          ref={gameCanvasRef}
          autoStart
          initialLevel={FINAL_LEVEL}
          onStateChange={setGameState}
          onReturnToMenu={onBackToAdmin}
        />
      </div>
    </div>
  );
}
