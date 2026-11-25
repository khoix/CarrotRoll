import { useState, useCallback, useEffect, useRef, useMemo, Fragment } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import GameCanvas, { GameCanvasHandle } from "@/components/GameCanvas";
import Level20EndingOverlay from "@/components/Level20EndingOverlay";
import TouchControls from "@/components/TouchControls";
import StartMenuCard from "@/components/StartMenuCard";
import HighScoreList, { HighScoreListContent } from "@/components/HighScoreList";
import { useScores } from "@/hooks/use-scores";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Menu, Info, ChevronDown, ChevronRight, Trophy, Sparkles, Volume2, VolumeX, RefreshCw, X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";

type GameState = "menu" | "countdown" | "playing" | "gameover" | "level_transition" | "level20_ending";

const SOUNDS_BASE = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "") + "/sounds/";
const PRECACHE_URLS = ["music_menu.m4a"];

export default function Home() {
  const [, setLocation] = useLocation();
  const {
    muted,
    masterVolume,
    musicVolume,
    sfxVolume,
    setMuted,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
    setMusicState,
    unlockAudio,
    preloadSfx,
    stopMusic,
    resumeMusic,
    isMusicPlaying,
  } = useSound();

  const [showTitleScreen, setShowTitleScreen] = useState(true);
  const [titleAnimating, setTitleAnimating] = useState(false);
  const [cacheProgress, setCacheProgress] = useState(0);
  const [cacheDone, setCacheDone] = useState(false);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const isMobile = useIsMobile();
  const { data: scores, refetch: refetchScores, isFetching: scoresFetching } = useScores();
  const { dailyTop20, overallTop20, mobileTop20 } = useMemo(() => {
    const list = scores ?? [];
    const sorted = [...list].sort((a, b) => b.score - a.score);
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const daily = list
      .filter((s) => {
        const createdAt = (s as { createdAt?: Date | string }).createdAt;
        if (!createdAt) return false;
        const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
        return d >= todayStart;
      })
      .sort((a, b) => b.score - a.score);
    const mobile = list
      .filter((s) => (s as { device?: string }).device === "mobile")
      .sort((a, b) => b.score - a.score);
    return {
      dailyTop20: daily.slice(0, 20),
      overallTop20: sorted.slice(0, 20),
      mobileTop20: mobile.slice(0, 20),
    };
  }, [scores]);
  const [showLeaderboardOverlay, setShowLeaderboardOverlay] = useState(false);
  const gameCanvasRef = useRef<GameCanvasHandle>(null);
  const sidebarContainerRef = useRef<HTMLDivElement>(null);
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const canvasColumnRef = useRef<HTMLDivElement>(null);
  const [sidebarScale, setSidebarScale] = useState(1);

  // Auto-refresh leaderboard every 10s while on main menu (past title screen)
  useEffect(() => {
    if (showTitleScreen || gameState !== "menu") return;
    const id = setInterval(() => refetchScores(), 60_000);
    return () => clearInterval(id);
  }, [showTitleScreen, gameState, refetchScores]);

  // On mobile, when returning from Play (Back to menu / submit score), skip title and show main menu
  useEffect(() => {
    if (!isMobile) return;
    if (sessionStorage.getItem("carrotroll_skip_title")) {
      sessionStorage.removeItem("carrotroll_skip_title");
      setShowTitleScreen(false);
    }
  }, [isMobile]);

  // Title-screen progress tracks only the small SFX/loop decodes. Music streams (AAC), and iOS
  // won't preload media elements without a gesture, so gating on music could stall forever.
  useEffect(() => {
    let cancelled = false;
    preloadSfx((loaded, total) => {
      if (cancelled) return;
      setCacheProgress(Math.min(100, total ? Math.round((100 * loaded) / total) : 100));
      if (loaded >= total) setCacheDone(true);
    }).then(() => {
      if (!cancelled) {
        setCacheProgress(100);
        setCacheDone(true);
      }
    });
    // Warm the HTTP cache for the menu track (best effort; no progress dependency).
    const warm = new Audio();
    warm.preload = "auto";
    warm.src = SOUNDS_BASE + PRECACHE_URLS[0];
    return () => {
      cancelled = true;
    };
  }, [preloadSfx]);

  const handleTitleClick = useCallback(() => {
    if (titleAnimating || !cacheDone) return;
    unlockAudio();
    setTitleAnimating(true);
    setMusicState("menu");
  }, [titleAnimating, cacheDone, setMusicState, unlockAudio]);

  const handleTitleAnimationComplete = useCallback(() => {
    setShowTitleScreen(false);
  }, []);

  // Scale sidebar to match canvas container height (game-canvas-container div) so both are the same height
  useEffect(() => {
    if (isMobile) return;
    const container = sidebarContainerRef.current;
    const content = sidebarContentRef.current;
    const canvasCol = canvasColumnRef.current;
    if (!container || !content || !canvasCol) return;
    const updateScale = () => {
      if (!container || !content || !canvasCol) return;
      const canvasContainerEl = gameCanvasRef.current?.getContainerElement?.();
      const targetHeight = canvasContainerEl
        ? canvasContainerEl.getBoundingClientRect().height
        : canvasCol.getBoundingClientRect().height;
      container.style.height = `${targetHeight}px`;
      const containerRect = container.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const ch = containerRect.height;
      const sh = contentRect.height;
      if (sh <= 0) return;
      // Scale by height only so content fits without Y overflow (no overflow hidden)
      const scaleY = ch / sh;
      setSidebarScale(Math.min(1, scaleY));
    };
    updateScale();
    // Re-run after layout has settled; on initial load canvas/content may not have final size yet
    let rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(() => {
        updateScale();
        rafId = 0;
      });
    });
    const timeoutId = setTimeout(updateScale, 150);
    const ro = new ResizeObserver(updateScale);
    ro.observe(canvasCol);
    ro.observe(container);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      ro.disconnect();
    };
  }, [isMobile]);

  // Conditional scrollbar: on mobile, only disable after game starts
  const shouldDisableScroll = isMobile 
    ? (gameState === "playing" || gameState === "countdown")
    : true; // Desktop always disabled

  const ContentWrapper = isMobile ? "main" : Fragment;

  return (
    <div className={`h-screen flex flex-col ${shouldDisableScroll ? 'overflow-y-hidden' : 'overflow-y-auto'} bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100 via-orange-50 to-white ${!isMobile ? 'p-4 md:p-8' : ''}`}>
      {/* Header: fixed with shadow/border on mobile, in-flow on desktop */}
      {isMobile ? (
      <div className="fixed top-0 left-0 right-0 z-10 bg-orange-50/95 backdrop-blur-sm border-b-2 border-gray-300 shadow-[0_4px_12px_rgba(0,0,0,0.12)]">
        <header className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
             <div className="w-12 h-12 bg-primary rounded-xl rotate-3 flex items-center justify-center shadow-lg border-2 border-black overflow-visible">
                <span className="text-2xl menu-carrot-icon">🥕</span>
             </div>
             <div>
                <h1 className="font-display text-4xl text-gray-900 leading-none">Carrot<span className="text-primary">Roll</span></h1>
                <p className="text-sm font-bold text-gray-400 tracking-wider uppercase">Arcade Survival</p>
             </div>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
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
                        <Label htmlFor="mute" className="text-sm font-medium cursor-pointer">Mute all</Label>
                        <Switch
                          id="mute"
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
        </header>
      </div>
      ) : (
      <header className="flex-shrink-0 max-w-7xl mx-auto mb-4 flex justify-between items-center w-full">
          <div className="flex items-center gap-2">
             <div className="w-12 h-12 bg-primary rounded-xl rotate-3 flex items-center justify-center shadow-lg border-2 border-black overflow-visible">
                <span className="text-2xl menu-carrot-icon">🥕</span>
             </div>
             <div>
                <h1 className="font-display text-4xl text-gray-900 leading-none">Carrot<span className="text-primary">Roll</span></h1>
                <p className="text-sm font-bold text-gray-400 tracking-wider uppercase">Arcade Survival</p>
             </div>
          </div>
          
          <div className="flex items-center gap-2 ml-auto">
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
                        <Label htmlFor="mute" className="text-sm font-medium cursor-pointer">Mute all</Label>
                        <Switch
                          id="mute"
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
      </header>
      )}

      {/* Content: wrapped in main on mobile (with top clearance), fragment on desktop; single content div with conditional layout */}
      <ContentWrapper {...(isMobile ? { className: "flex-1 min-h-0 flex flex-col pt-[5.5rem] px-0 pb-0" } : {})}>
      {/* Title load screen: full-screen overlay, click to morph title to header then dismiss */}
      <AnimatePresence>
        {showTitleScreen && (
          <motion.div
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100 via-orange-50 to-white"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{ cursor: cacheDone && !titleAnimating ? "pointer" : "default" }}
            onClick={handleTitleClick}
            aria-label={cacheDone ? (isMobile ? "Tap to continue" : "Click to continue") : "Loading"}
          >
            <motion.div
              className="absolute flex items-center gap-2 md:gap-3 pointer-events-none"
              initial={{
                left: "50%",
                top: "50%",
                x: "-50%",
                y: "-50%",
                scale: 1,
              }}
              animate={
                titleAnimating
                  ? {
                      left: 16,
                      top: 16,
                      x: 0,
                      y: 0,
                      scale: 0.32,
                    }
                  : undefined
              }
              transition={{
                type: "tween",
                duration: 0.7,
                ease: [0.32, 0.72, 0, 1],
              }}
              onAnimationComplete={handleTitleAnimationComplete}
            >
              <div className="w-20 h-20 md:w-24 md:h-24 bg-primary rounded-xl rotate-3 flex items-center justify-center shadow-lg border-2 border-black flex-shrink-0 overflow-visible">
                <span className="text-4xl md:text-5xl title-screen-logo-icon">🥕</span>
              </div>
              <div>
                <h1 className="font-display text-6xl md:text-8xl text-gray-900 leading-none">
                  Carrot<span className="text-primary">Roll</span>
                </h1>
                <p className="text-base md:text-lg font-bold text-gray-400 tracking-wider uppercase mt-1">
                  Arcade Survival
                </p>
              </div>
            </motion.div>

            {/* Progress bar: right under title; fades out when loading hits 100%. */}
            {!titleAnimating && (
              <motion.div
                className="absolute left-1/2 top-[calc(50%+5.5rem)] md:top-[calc(50%+5rem)] w-64 md:w-80 -translate-x-1/2 pointer-events-none z-10 title-screen-progress"
                aria-hidden="true"
                initial={{ opacity: 1 }}
                animate={{ opacity: cacheDone ? 0 : 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              >
                <div className="title-screen-progress-track h-3 w-full rounded-full overflow-hidden bg-gray-200/90 border border-gray-300/80">
                  <div
                    className="h-full rounded-full transition-[width] duration-200 ease-out min-w-0"
                    style={{
                      width: `${cacheProgress}%`,
                      background: "linear-gradient(to right, #22c55e, #ea580c)",
                    }}
                  />
                </div>
                <div
                  className="absolute top-1/2 text-xl md:text-2xl select-none -translate-y-1/2 pointer-events-none"
                  style={{
                    left: `${Math.min(100, Math.max(0, cacheProgress))}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  🥕
                </div>
              </motion.div>
            )}

            {cacheDone && !titleAnimating && (
              <motion.p
                className="absolute bottom-12 left-1/2 -translate-x-1/2 text-gray-500 font-bold text-sm md:text-base uppercase tracking-widest pointer-events-none"
                initial={{ opacity: 0 }}
                animate={{
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {isMobile ? "Tap to Continue" : "Click to continue"}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Level 20 ending: portal into canvas container so it shows in fullscreen too */}
      {gameState === "level20_ending" &&
        createPortal(
          <Level20EndingOverlay
            onComplete={() => {
              gameCanvasRef.current?.showGameOverAfterEnding?.();
            }}
          />,
          gameCanvasRef.current?.getContainerElement() ?? document.body
        )}

      <div className={`flex-1 min-h-0 max-w-7xl mx-auto w-full ${isMobile ? "pt-[0.5rem] px-4 md:px-8 flex flex-col overflow-y-auto" : "grid grid-cols-1 lg:grid-cols-[1fr_350px]"} gap-6`}>
        {/* Game Area: desktop only (canvas); mobile shows only sidebar with Start Game + Leaderboard + Power-ups) */}
        {!isMobile && (
          <div ref={canvasColumnRef} className="flex flex-col items-center gap-2 min-h-0">
            <GameCanvas ref={gameCanvasRef} onStateChange={setGameState} />
            <p className="text-center text-gray-400 text-sm font-bold w-full max-w-[800px]">
              Use WASD or Arrow Keys to move / Spacebar to Fire
            </p>
          </div>
        )}

        {/* Mobile: one column = content + footer at bottom (min-h-full + mt-auto) */}
        {isMobile ? (
          <div className="min-h-full flex flex-col">
          {/* Sidebar / Stats: Collapsible sections (Start Game, Leaderboard, Power-ups) */}
          <div className="space-y-4 flex-shrink-0 w-full">
            <Collapsible defaultOpen>
              <CollapsibleTrigger className="w-full bg-green-500 rounded-2xl border-4 border-green-700 p-4 text-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] flex items-center justify-between hover:bg-green-600 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-primary rounded-xl rotate-3 flex items-center justify-center shadow-lg border-2 border-black overflow-visible">
                    <span className="text-2xl menu-carrot-icon">🥕</span>
                  </div>
                  <h3 className="font-display text-2xl tracking-wide">Start Game</h3>
                </div>
                <ChevronDown className="w-5 h-5 transition-transform duration-200 data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <StartMenuCard onStartClick={() => { unlockAudio(); setLocation("/play"); }} className="max-w-none" />
              </CollapsibleContent>
            </Collapsible>
            <button
              type="button"
              onClick={() => setShowLeaderboardOverlay(true)}
              className="w-full bg-white rounded-2xl border-4 border-black p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] flex items-center justify-between hover:bg-orange-50 active:bg-orange-100 transition-colors touch-manipulation text-left"
              aria-label="Open leaderboard"
            >
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 p-3 rounded-full border-2 border-yellow-300">
                  <Trophy className="w-6 h-6 text-yellow-600" />
                </div>
                <h3 className="font-display text-2xl tracking-wide">Leaderboard</h3>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" aria-hidden />
            </button>
            
            <Collapsible>
              <CollapsibleTrigger className="w-full bg-indigo-900 rounded-2xl p-4 text-white border-4 border-indigo-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] flex items-center justify-between hover:bg-indigo-800 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-3 rounded-full border-2 border-purple-300">
                    <Sparkles className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="font-display text-2xl text-yellow-400">Power-Ups</h3>
                </div>
                <ChevronDown className="w-5 h-5 transition-transform duration-200 data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="bg-indigo-900 rounded-2xl p-6 text-white border-4 border-indigo-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]">
                  <div className="space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500 border-2 border-green-300 shadow-md flex items-center justify-center text-xl">🛡️</div>
                        <div>
                            <p className="font-bold text-sm">Carro-Shield</p>
                            <p className="text-xs text-indigo-200">Projectile Shield</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-yellow-500 border-2 border-yellow-300 shadow-md flex items-center justify-center text-xl">⚡</div>
                        <div>
                            <p className="font-bold text-sm">Rapid Rabbit</p>
                            <p className="text-xs text-indigo-200">Speed + Invincibility</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-cyan-500 border-2 border-cyan-300 shadow-md flex items-center justify-center relative overflow-hidden">
                          <span className="absolute top-[15%] bottom-[15%] w-1 bg-white rounded-full" style={{ left: "26%" }} aria-hidden />
                          <span className="absolute top-[15%] bottom-[15%] w-1 bg-white rounded-full" style={{ right: "26%" }} aria-hidden />
                        </div>
                        <div>
                            <p className="font-bold text-sm">Bunny Blasters</p>
                            <p className="text-xs text-indigo-200">Clear a path! With lasers!</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-red-500 border-2 border-red-300 shadow-md flex items-center justify-center text-xl"><span style={{ display: "inline-block", transform: "rotate(-90deg)" }}>🧲</span></div>
                        <div>
                            <p className="font-bold text-sm">Attract-o-Hare</p>
                            <p className="text-xs text-indigo-200">Carrots, draw closer...</p>
                        </div>
                     </div>
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-rose-500 border-2 border-rose-300 shadow-md flex items-center justify-center text-xl">❤️</div>
                        <div>
                            <p className="font-bold text-sm">Heart</p>
                            <p className="text-xs text-indigo-200">+1 Life</p>
                        </div>
                     </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

        {/* Mobile Footer: at bottom of all content; 2rem padding top and bottom */}
        <div className="w-full flex-shrink-0 pt-8 pb-8 mt-auto">
            <motion.hr
              className="w-full border-0 h-[1px] bg-gradient-to-r from-transparent via-gray-300 to-transparent"
              animate={{
                opacity: [0.3, 1, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
            <p className="text-center text-gray-400 text-sm font-medium">Created by my daughter, Nya<br/>2026</p>
          </div>
          </div>
        ) : (
          /* Desktop: sidebar aligned to canvas height, content scaled to fit */
          <div ref={sidebarContainerRef} className="h-full min-h-0 flex flex-col relative">
            <div
              ref={sidebarContentRef}
              className="absolute left-0 right-0 top-0 w-full flex flex-col justify-between gap-4"
              style={{
                transform: `scale(${sidebarScale})`,
                transformOrigin: "top left",
              }}
            >
              <HighScoreList onTitleClick={() => setShowLeaderboardOverlay(true)} />
              <div className="bg-indigo-900 rounded-2xl p-6 text-white border-4 border-indigo-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] flex-shrink-0">
                <h3 className="font-display text-2xl mb-4 text-yellow-400">Power-Ups</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500 border-2 border-green-300 shadow-md flex items-center justify-center text-xl">🛡️</div>
                    <div>
                      <p className="font-bold text-sm">Carro-Shield</p>
                      <p className="text-xs text-indigo-200">Projectile Shield</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500 border-2 border-yellow-300 shadow-md flex items-center justify-center text-xl">⚡</div>
                    <div>
                      <p className="font-bold text-sm">Rapid Rabbit</p>
                      <p className="text-xs text-indigo-200">Speed + Invincibility</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-cyan-500 border-2 border-cyan-300 shadow-md flex items-center justify-center relative overflow-hidden">
                      <span className="absolute top-[15%] bottom-[15%] w-1 bg-white rounded-full" style={{ left: "26%" }} aria-hidden />
                      <span className="absolute top-[15%] bottom-[15%] w-1 bg-white rounded-full" style={{ right: "26%" }} aria-hidden />
                    </div>
                    <div>
                      <p className="font-bold text-sm">Bunny Blasters</p>
                      <p className="text-xs text-indigo-200">Clear a path! With lasers!</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-red-500 border-2 border-red-300 shadow-md flex items-center justify-center text-xl"><span style={{ display: "inline-block", transform: "rotate(-90deg)" }}>🧲</span></div>
                    <div>
                      <p className="font-bold text-sm">Attract-o-Hare</p>
                      <p className="text-xs text-indigo-200">Carrots, draw closer...</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-rose-500 border-2 border-rose-300 shadow-md flex items-center justify-center text-xl">❤️</div>
                    <div>
                      <p className="font-bold text-sm">Heart</p>
                      <p className="text-xs text-indigo-200">+1 Life</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </ContentWrapper>

      {/* Leaderboard overlay: top 20 scores, mobile-optimized */}
      <AnimatePresence>
        {showLeaderboardOverlay && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 md:p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-modal="true"
            role="dialog"
            aria-label="Leaderboard"
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              aria-hidden
              onClick={() => setShowLeaderboardOverlay(false)}
            />
            <motion.div
              className="relative w-full max-w-md bg-white rounded-2xl md:rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden pb-[max(1rem,env(safe-area-inset-bottom))]"
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
              style={{
                maxHeight: isMobile ? "min(90dvh, 90%)" : "85vh",
              }}
            >
              <div className="flex-shrink-0 flex items-center justify-between p-4 md:p-6 pb-2 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-100 p-2.5 md:p-3 rounded-full border-2 border-yellow-300">
                    <Trophy className="w-6 h-6 md:w-7 md:h-7 text-yellow-600" />
                  </div>
                  <h2 className="font-display text-xl md:text-2xl tracking-wide">Leaderboard</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); refetchScores(); }}
                    disabled={scoresFetching}
                    className="p-2 -m-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-50 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Refresh scores"
                  >
                    <RefreshCw className={`w-5 h-5 ${scoresFetching ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLeaderboardOverlay(false)}
                    className="p-2 -m-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition-colors touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label="Close leaderboard"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div 
                className="flex-1 min-h-0 flex flex-col overflow-hidden p-4 md:p-6 pt-2"
                onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}
              >
                <div
                  onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                  onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}
                  className="flex flex-col flex-1 min-h-0"
                >
                <Tabs 
                  defaultValue={dailyTop20.length > 0 ? "daily" : overallTop20.length > 0 ? "overall" : "mobile"} 
                  className="flex flex-col flex-1 min-h-0"
                >
                  <TabsList 
                    className="w-full grid grid-cols-3 h-10 rounded-xl bg-gray-100 p-1 flex-shrink-0"
                    onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                    onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}
                  >
                    <TabsTrigger 
                      value="daily" 
                      className="rounded-lg font-display font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                      onPointerDown={(e: React.PointerEvent<HTMLButtonElement>) => e.stopPropagation()}
                    >
                      Daily
                    </TabsTrigger>
                    <TabsTrigger 
                      value="overall" 
                      className="rounded-lg font-display font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                      onPointerDown={(e: React.PointerEvent<HTMLButtonElement>) => e.stopPropagation()}
                    >
                      Overall
                    </TabsTrigger>
                    <TabsTrigger 
                      value="mobile" 
                      className="rounded-lg font-display font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm"
                      onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.stopPropagation()}
                      onPointerDown={(e: React.PointerEvent<HTMLButtonElement>) => e.stopPropagation()}
                    >
                      Mobile
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent 
                    value="daily" 
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mx-1 px-1 overscroll-contain mt-4 [&_.space-y-3>div]:min-h-[44px] data-[state=inactive]:hidden"
                    onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                    onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}
                  >
                    <HighScoreListContent scores={dailyTop20} />
                  </TabsContent>
                  <TabsContent 
                    value="overall" 
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mx-1 px-1 overscroll-contain mt-4 [&_.space-y-3>div]:min-h-[44px] data-[state=inactive]:hidden"
                    onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                    onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}
                  >
                    <HighScoreListContent scores={overallTop20} />
                  </TabsContent>
                  <TabsContent 
                    value="mobile" 
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mx-1 px-1 overscroll-contain mt-4 [&_.space-y-3>div]:min-h-[44px] data-[state=inactive]:hidden"
                    onClick={(e: React.MouseEvent<HTMLDivElement>) => e.stopPropagation()}
                    onPointerDown={(e: React.PointerEvent<HTMLDivElement>) => e.stopPropagation()}
                  >
                    <HighScoreListContent scores={mobileTop20} />
                  </TabsContent>
                </Tabs>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* About Dialog Overlay */}
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
                Use <kbd className="px-1.5 py-0.5 bg-gray-200 rounded border border-gray-300 font-mono">WASD</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-200 rounded border border-gray-300 font-mono">Arrow Keys</kbd> to move, <kbd className="px-1.5 py-0.5 bg-gray-200 rounded border border-gray-300 font-mono">Spacebar</kbd> to fire. Collect 10 carrots to level up; avoid the giant carrot and falling hazards!
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
