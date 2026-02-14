import { useScores } from "@/hooks/use-scores";
import { Loader2, Trophy } from "lucide-react";
import { motion } from "framer-motion";

export default function HighScoreList() {
  const { data: scores, isLoading } = useScores();

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const topScores = scores?.sort((a, b) => b.score - a.score).slice(0, 5) || [];

  return (
    <div className="bg-white rounded-2xl border-4 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-yellow-100 p-3 rounded-full border-2 border-yellow-300">
          <Trophy className="w-6 h-6 text-yellow-600" />
        </div>
        <h3 className="font-display text-2xl tracking-wide">Leaderboard</h3>
      </div>

      <div className="space-y-3">
        {topScores.length === 0 ? (
          <p className="text-center text-gray-400 py-4 font-bold italic">No scores yet. Be the first!</p>
        ) : (
          topScores.map((score, idx) => (
            <motion.div 
              key={score.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100 hover:bg-orange-50 hover:border-orange-100 transition-colors"
            >
              <div className="flex items-center gap-4">
                <span className={`
                  w-8 h-8 flex items-center justify-center rounded-full font-display text-lg border-2
                  ${idx === 0 ? 'bg-yellow-400 border-yellow-600 text-white' : 
                    idx === 1 ? 'bg-gray-300 border-gray-500 text-white' :
                    idx === 2 ? 'bg-amber-600 border-amber-800 text-white' :
                    'bg-white border-gray-200 text-gray-400'}
                `}>
                  {idx + 1}
                </span>
                <div>
                  <p className="font-bold text-gray-800 leading-none">{score.name}</p>
                  <p className="text-xs text-gray-500 font-medium">Lvl {score.level}</p>
                </div>
              </div>
              <span className="font-display text-xl text-primary">{score.score}</span>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
