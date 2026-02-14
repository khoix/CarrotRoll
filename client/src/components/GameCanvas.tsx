import { useEffect, useRef, useState, useCallback } from "react";
import { useCreateScore } from "@/hooks/use-scores";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trophy, RotateCcw, Home } from "lucide-react";
import { Link } from "wouter";

// --- Game Constants & Types ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 40;
const BASE_SPEED = 5;
const SCROLL_SPEED = 3;

type GameObject = {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  type: "player" | "giant_carrot" | "spike" | "ball" | "carrot" | "powerup_invincible" | "powerup_speed";
  vx: number;
  vy: number;
  active: boolean;
  stunned?: number;
};

type GameState = "menu" | "playing" | "gameover" | "level_transition";

interface GameCanvasProps {
  onStateChange: (state: GameState) => void;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<GameState>("menu");
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [carrotsCollected, setCarrotsCollected] = useState(0);
  const [lives, setLives] = useState(3);
  const [playerName, setPlayerName] = useState("");
  
  // High score mutation
  const createScore = useCreateScore();

  // Game Ref State (for loop access without re-renders)
  const gameRef = useRef({
    player: { x: 400, y: 300, width: PLAYER_SIZE, height: PLAYER_SIZE, color: "#3B82F6", vx: 0, vy: 0, speed: BASE_SPEED, invincible: false, invincibilityTimer: 0 },
    keys: { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false },
    projectiles: [] as GameObject[],
    obstacles: [] as GameObject[],
    collectibles: [] as GameObject[],
    giantCarrot: { x: 0, y: CANVAS_HEIGHT + 100, width: 200, height: 200, angle: 0, nextShot: 0 },
    lastFrameTime: 0,
    animationId: 0,
    levelColor: "#FFF7ED", // Default bg
  });

  // --- Input Handling ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (gameState !== "playing") return;
      if (gameRef.current.keys.hasOwnProperty(e.key)) {
        // @ts-ignore
        gameRef.current.keys[e.key] = true;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (gameRef.current.keys.hasOwnProperty(e.key)) {
        // @ts-ignore
        gameRef.current.keys[e.key] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [gameState]);

  // --- Game Loop ---
  const startGame = () => {
    setGameState("playing");
    setScore(0);
    setLevel(1);
    setCarrotsCollected(0);
    setLives(3);
    
    // Reset Game State
    gameRef.current.player = { x: 400, y: 300, width: PLAYER_SIZE, height: PLAYER_SIZE, color: "#3B82F6", vx: 0, vy: 0, speed: BASE_SPEED, invincible: false, invincibilityTimer: 0 };
    gameRef.current.projectiles = [];
    gameRef.current.obstacles = [];
    gameRef.current.collectibles = [];
    gameRef.current.giantCarrot = { x: CANVAS_WIDTH / 2 - 100, y: CANVAS_HEIGHT - 50, width: 200, height: 200, angle: 0, nextShot: 0 };
    gameRef.current.levelColor = "#FFF7ED";

    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
    gameRef.current.lastFrameTime = performance.now();
    requestAnimationFrame(gameLoop);
  };

  const gameLoop = useCallback((time: number) => {
    if (gameState !== "playing") return;

    const dt = (time - gameRef.current.lastFrameTime) / 1000;
    gameRef.current.lastFrameTime = time;
    const state = gameRef.current;
    const ctx = canvasRef.current?.getContext("2d");

    if (!ctx || !canvasRef.current) return;

    // --- Update Logic ---
    
    // 1. Player Movement
    let dx = 0;
    let dy = 0;
    
    // Automatic forward movement
    if (!state.player.stunned || state.player.stunned <= 0) {
        dy -= 0.5; // Constant forward urge
        if (state.keys.w || state.keys.ArrowUp) dy -= 1;
        if (state.keys.s || state.keys.ArrowDown) dy += 1;
        if (state.keys.a || state.keys.ArrowLeft) dx -= 1;
        if (state.keys.d || state.keys.ArrowRight) dx += 1;
    } else {
        state.player.stunned -= dt;
    }

    // Normalize diagonal movement
    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      dx /= length;
      dy /= length;
    }

    state.player.x += dx * state.player.speed;
    state.player.y += dy * state.player.speed;
    
    // Board scrolling effect (treadmill)
    state.player.y += SCROLL_SPEED;

    // Boundaries
    state.player.x = Math.max(0, Math.min(CANVAS_WIDTH - state.player.width, state.player.x));
    state.player.y = Math.max(0, Math.min(CANVAS_HEIGHT - state.player.height, state.player.y));

    // Invincibility Timer
    if (state.player.invincible) {
        state.player.invincibilityTimer -= dt;
        if (state.player.invincibilityTimer <= 0) {
            state.player.invincible = false;
            state.player.speed = BASE_SPEED; // Reset speed if it was speed boost
        }
    }

    // 2. Giant Carrot Logic
    // Rolling effect: Wobble and stay at bottom
    state.giantCarrot.x = (CANVAS_WIDTH / 2 - 100) + Math.sin(time / 500) * 100;
    state.giantCarrot.y = CANVAS_HEIGHT - 120 + Math.sin(time / 200) * 10;
    state.giantCarrot.angle += dt * 5; // Visual roll
    
    // Shooting Spikes
    state.giantCarrot.nextShot -= dt;
    if (state.giantCarrot.nextShot <= 0) {
        // Shoot at player
        const angle = Math.atan2(state.player.y - state.giantCarrot.y, state.player.x - (state.giantCarrot.x + 100));
        state.projectiles.push({
            x: state.giantCarrot.x + 100,
            y: state.giantCarrot.y,
            width: 20,
            height: 20,
            color: "#22C55E", // Green
            type: "spike",
            vx: Math.cos(angle) * (300 + level * 20),
            vy: Math.sin(angle) * (300 + level * 20),
            active: true
        });
        state.giantCarrot.nextShot = Math.max(0.5, 2.0 - (level * 0.1)); // Shoot faster per level
    }

    // 3. Falling Obstacles (Spiky Balls) - Stationary relative to board
    if (Math.random() < 0.01 + (level * 0.005)) {
        state.obstacles.push({
            x: Math.random() * CANVAS_WIDTH,
            y: -50,
            width: 30,
            height: 30,
            color: "#1F2937", // Dark Gray
            type: "ball",
            vx: 0,
            vy: SCROLL_SPEED * 60, // Moving down at treadmill speed (per second)
            active: true
        });
    }

    // 4. Collectibles (Carrots) - Stationary relative to board
    if (state.collectibles.length < 3 + level) {
        if (Math.random() < 0.02) {
            const typeRand = Math.random();
            let type: GameObject["type"] = "carrot";
            let color = "#F97316"; // Orange
            
            if (typeRand > 0.95) { type = "powerup_invincible"; color = "#22C55E"; } // Rare Green
            else if (typeRand > 0.90) { type = "powerup_speed"; color = "#EAB308"; } // Rare Yellow

            state.collectibles.push({
                x: Math.random() * (CANVAS_WIDTH - 40),
                y: -50, // Spawn at top
                width: 30,
                height: 30,
                color: color,
                type: type,
                vx: 0,
                vy: SCROLL_SPEED * 60, // Moving down at treadmill speed
                active: true
            });
        }
    }

    // --- Update Entities ---
    [...state.projectiles, ...state.obstacles, ...state.collectibles].forEach(obj => {
        obj.x += obj.vx * dt;
        obj.y += obj.vy * dt;
        
        // Remove out of bounds
        if (obj.y > CANVAS_HEIGHT + 100 || obj.y < -200 || obj.x < -100 || obj.x > CANVAS_WIDTH + 100) {
            obj.active = false;
        }

        // Collision with Player
        if (obj.active && !state.player.invincible && checkCollision(state.player, obj)) {
            if (obj.type === "spike" || obj.type === "ball") {
                obj.active = false;
                state.player.stunned = 0.5; // Stun on hit
                setLives(l => {
                    const newLives = l - 1;
                    if (newLives <= 0) {
                        endGame();
                        return 0;
                    }
                    // Temporary invincibility after hit
                    state.player.invincible = true;
                    state.player.invincibilityTimer = 1.0;
                    return newLives;
                });
            }
        }
    });

    state.collectibles.forEach(obj => {
        if (obj.active && checkCollision(state.player, obj)) {
            obj.active = false;
            
            if (obj.type === "carrot") {
                setScore(s => s + 10 * level);
                setCarrotsCollected(c => {
                    const next = c + 1;
                    if (next >= 10) {
                        levelUp();
                        return 0;
                    }
                    return next;
                });
            } else if (obj.type === "powerup_invincible") {
                state.player.invincible = true;
                state.player.invincibilityTimer = 5.0;
            } else if (obj.type === "powerup_speed") {
                state.player.speed = BASE_SPEED * 1.5;
                state.player.invincible = true; // Speed also gives brief invincibility visual
                state.player.invincibilityTimer = 5.0;
            }
        }
    });

    // Collision with Giant Carrot (Instant Death)
    if (checkCollision(state.player, state.giantCarrot) && !state.player.invincible) {
        setLives(0);
        endGame();
    }

    // Cleanup arrays
    state.projectiles = state.projectiles.filter(o => o.active);
    state.obstacles = state.obstacles.filter(o => o.active);
    state.collectibles = state.collectibles.filter(o => o.active);

    // --- Render ---
    // Background treadmill effect
    ctx.fillStyle = state.levelColor;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw treadmill lines
    ctx.strokeStyle = "rgba(0,0,0,0.05)";
    ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
        const lineY = (i * 100 + (time / 10) % 100);
        ctx.beginPath();
        ctx.moveTo(0, lineY);
        ctx.lineTo(CANVAS_WIDTH, lineY);
        ctx.stroke();
    }

    // Draw Giant Carrot
    ctx.save();
    ctx.translate(state.giantCarrot.x + 100, state.giantCarrot.y + 100);
    ctx.rotate(state.giantCarrot.angle);
    
    // Realistic Giant Carrot body
    const gradient = ctx.createLinearGradient(-100, -100, 100, 100);
    gradient.addColorStop(0, "#FB923C");
    gradient.addColorStop(0.5, "#F97316");
    gradient.addColorStop(1, "#EA580C");
    ctx.fillStyle = gradient;
    
    ctx.beginPath();
    ctx.moveTo(0, 120); // Tip
    ctx.quadraticCurveTo(-80, 0, -60, -80); // Left side
    ctx.lineTo(60, -80); // Top
    ctx.quadraticCurveTo(80, 0, 0, 120); // Right side
    ctx.fill();
    
    // Ridges
    ctx.strokeStyle = "rgba(0,0,0,0.1)";
    for(let i = -60; i < 100; i += 30) {
        ctx.beginPath();
        ctx.moveTo(-40, i);
        ctx.lineTo(40, i);
        ctx.stroke();
    }
    ctx.restore();

    // Draw Collectibles
    state.collectibles.forEach(obj => {
        ctx.save();
        ctx.translate(obj.x + obj.width/2, obj.y + obj.height/2);
        
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, obj.width/2);
        grad.addColorStop(0, obj.color);
        grad.addColorStop(1, "#EA580C");
        ctx.fillStyle = grad;

        // Realistic Small Carrot
        ctx.beginPath();
        ctx.moveTo(0, obj.height/2); // Tip
        ctx.lineTo(-obj.width/3, -obj.height/2);
        ctx.lineTo(obj.width/3, -obj.height/2);
        ctx.closePath();
        ctx.fill();
        
        // Green top
        ctx.fillStyle = "#22C55E";
        ctx.fillRect(-2, -obj.height/2 - 5, 4, 5);
        
        ctx.restore();
        
        // Glow effect for powerups
        if (obj.type !== "carrot") {
             ctx.shadowBlur = 10;
             ctx.shadowColor = obj.color;
             ctx.stroke();
             ctx.shadowBlur = 0;
        }
    });

    // Draw Projectiles
    state.projectiles.forEach(obj => {
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.moveTo(obj.x + obj.width/2, obj.y); // Top
        ctx.lineTo(obj.x + obj.width, obj.y + obj.height); // Right bot
        ctx.lineTo(obj.x, obj.y + obj.height); // Left bot
        ctx.fill();
    });

    // Draw Obstacles
    state.obstacles.forEach(obj => {
        ctx.fillStyle = obj.color;
        ctx.beginPath();
        ctx.arc(obj.x + obj.width/2, obj.y + obj.height/2, obj.width/2, 0, Math.PI * 2);
        ctx.fill();
        // Spikes on ball
        for(let i=0; i<8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const sx = (obj.x + obj.width/2) + Math.cos(angle) * (obj.width/2 + 5);
            const sy = (obj.y + obj.height/2) + Math.sin(angle) * (obj.width/2 + 5);
            ctx.beginPath();
            ctx.moveTo(obj.x + obj.width/2, obj.y + obj.height/2);
            ctx.lineTo(sx, sy);
            ctx.stroke();
        }
    });

    // Draw Player
    ctx.fillStyle = state.player.color;
    if (state.player.invincible) {
        ctx.globalAlpha = 0.5 + Math.sin(time / 50) * 0.5; // Flash effect
    }
    // Bunny shape (simplified)
    ctx.fillRect(state.player.x, state.player.y + 10, state.player.width, state.player.height - 10);
    // Ears
    ctx.fillRect(state.player.x + 5, state.player.y - 10, 8, 20);
    ctx.fillRect(state.player.x + state.player.width - 13, state.player.y - 10, 8, 20);
    ctx.globalAlpha = 1.0;


    // Loop
    state.animationId = requestAnimationFrame(gameLoop);
  }, [gameState, level]);

  const checkCollision = (rect1: GameObject, rect2: GameObject) => {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
  };

  const levelUp = () => {
    setLevel(l => l + 1);
    setCarrotsCollected(0);
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    
    // Change background color slightly based on level
    const colors = ["#FFF7ED", "#ECFCCB", "#E0F2FE", "#FAE8FF", "#FFF1F2"];
    gameRef.current.levelColor = colors[level % colors.length];
  };

  const endGame = () => {
    setGameState("gameover");
    if (gameRef.current.animationId) cancelAnimationFrame(gameRef.current.animationId);
  };

  const handleSubmitScore = async () => {
    if (!playerName.trim()) return;
    try {
        await createScore.mutateAsync({
            name: playerName,
            score: score,
            level: level
        });
        setGameState("menu"); // Go back to menu after submitting
    } catch (e) {
        console.error(e);
    }
  };

  // Resume/Restart handlers
  useEffect(() => {
    if (gameState === "playing") {
        gameRef.current.animationId = requestAnimationFrame(gameLoop);
    }
    return () => cancelAnimationFrame(gameRef.current.animationId);
  }, [gameState, gameLoop]);


  return (
    <div className="relative w-full max-w-[800px] mx-auto bg-white rounded-2xl shadow-2xl overflow-hidden border-4 border-gray-900">
      <canvas 
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="block w-full h-auto bg-orange-50"
      />

      {/* HUD Layer */}
      {gameState === "playing" && (
        <div className="absolute top-4 left-0 right-0 flex justify-between px-8 pointer-events-none">
            <div className="flex gap-4">
                 <div className="bg-white/90 border-2 border-black px-4 py-2 rounded-xl shadow-md font-display text-xl text-primary">
                    🥕 {carrotsCollected}/10
                 </div>
                 <div className="bg-white/90 border-2 border-black px-4 py-2 rounded-xl shadow-md font-display text-xl text-red-500">
                    ❤️ {lives}
                 </div>
            </div>
            <div className="flex gap-4">
                 <div className="bg-white/90 border-2 border-black px-4 py-2 rounded-xl shadow-md font-display text-xl">
                    LEVEL {level}
                 </div>
                 <div className="bg-white/90 border-2 border-black px-4 py-2 rounded-xl shadow-md font-display text-xl text-blue-600">
                    SCORE: {score}
                 </div>
            </div>
        </div>
      )}

      {/* Menu Overlay */}
      <AnimatePresence>
        {gameState === "menu" && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-8"
            >
                <div className="bg-white p-8 rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center max-w-md w-full">
                    <h1 className="text-6xl font-display text-primary mb-2 text-shadow-lg rotate-[-2deg]">CARROT ROLL</h1>
                    <p className="text-gray-500 font-bold mb-8 text-lg">Avoid the giant carrot! Collect the small ones!</p>
                    
                    <Button 
                        onClick={startGame}
                        className="w-full h-16 text-2xl font-display uppercase tracking-widest bg-green-500 hover:bg-green-600 text-white border-b-4 border-green-700 active:border-b-0 active:translate-y-1 mb-4"
                    >
                        Start Game
                    </Button>
                    
                    <div className="grid grid-cols-2 gap-4 text-left mt-8">
                        <div className="bg-orange-50 p-4 rounded-xl border-2 border-orange-100">
                            <span className="text-2xl block mb-2">🥕</span>
                            <p className="text-xs font-bold text-orange-800">Collect 10 to level up</p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-xl border-2 border-red-100">
                            <span className="text-2xl block mb-2">🌵</span>
                            <p className="text-xs font-bold text-red-800">Avoid falling spikes!</p>
                        </div>
                    </div>
                </div>
            </motion.div>
        )}

        {gameState === "gameover" && (
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
            >
                <div className="bg-white p-8 rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(255,0,0,1)] text-center max-w-md w-full">
                    <h2 className="text-5xl font-display text-red-500 mb-4 text-shadow-lg">GAME OVER</h2>
                    
                    <div className="bg-gray-100 rounded-xl p-6 mb-6 border-2 border-gray-200">
                        <div className="flex justify-between items-end border-b-2 border-gray-200 pb-2 mb-2">
                            <span className="text-gray-500 font-bold uppercase text-xs">Final Score</span>
                            <span className="text-4xl font-display text-primary">{score}</span>
                        </div>
                        <div className="flex justify-between items-end">
                            <span className="text-gray-500 font-bold uppercase text-xs">Level Reached</span>
                            <span className="text-2xl font-display text-blue-500">{level}</span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <Input 
                                placeholder="Enter your name" 
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                className="text-center font-display text-xl h-12 border-2 border-black focus-visible:ring-primary"
                                maxLength={10}
                            />
                        </div>
                        
                        <Button 
                            onClick={handleSubmitScore}
                            disabled={createScore.isPending || !playerName.trim()}
                            className="w-full h-14 text-xl font-display bg-primary hover:bg-orange-600 border-b-4 border-orange-800 active:border-b-0 active:translate-y-1"
                        >
                            {createScore.isPending ? <Loader2 className="animate-spin" /> : "Submit Score"}
                        </Button>

                        <Button 
                            variant="ghost" 
                            onClick={() => setGameState("menu")}
                            className="w-full font-bold text-gray-500 hover:text-black"
                        >
                            Back to Menu
                        </Button>
                    </div>
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
