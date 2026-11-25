import { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import Level20EndingOverlay from "@/components/Level20EndingOverlay";

interface AdminEndingDemoMobileProps {
  onBackToAdmin: () => void;
}

const MOBILE_FRAME_WIDTH = 390;
const MOBILE_FRAME_HEIGHT = 844;

export default function AdminEndingDemoMobile({ onBackToAdmin }: AdminEndingDemoMobileProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [showEnding, setShowEnding] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#1a1a1a]">
      <div className="flex-none p-4 flex items-center justify-between gap-4 border-b border-white/10 bg-black/40">
        <Button
          onClick={onBackToAdmin}
          variant="outline"
          size="sm"
          className="font-bold text-gray-300 hover:text-white border-gray-500 shrink-0"
        >
          Back to Admin
        </Button>
        <span className="text-sm text-gray-400">Ending Sequence Demo (Mobile)</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-4 overflow-auto">
        <div
          ref={frameRef}
          className="rounded-[2rem] border-[10px] border-gray-700 bg-black overflow-hidden shadow-2xl"
          style={{
            width: MOBILE_FRAME_WIDTH,
            height: MOBILE_FRAME_HEIGHT,
            transform: "translateZ(0)",
            position: "relative",
          }}
        >
          {showEnding &&
            frameRef.current &&
            createPortal(
              <Level20EndingOverlay forceMobile onComplete={() => setShowEnding(false)} />,
              frameRef.current
            )}

          {!showEnding && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100 via-orange-50 to-white">
              <Button
                onClick={() => setShowEnding(true)}
                size="lg"
                className="font-bold bg-orange-500 hover:bg-orange-600 text-white"
              >
                View ending sequence
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
