import { useState, useMemo } from "react";
import { useScores } from "@/hooks/use-scores";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2, Trophy, RefreshCw, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { splitLeaderboard, type ScoreRow as ScoreRowFull } from "@/lib/leaderboard";


type HighScoreListProps = { onTitleClick?: () => void };


export default function HighScoreList({ onTitleClick }: HighScoreListProps) {
  const { data: scores, isLoading, refetch } = useScores();
  const [refreshing, setRefreshing] = useState(false);
  const isMobile = useIsMobile();

  const { dailyTop3, overallTop3, mobileTop3, mobileTop20, classicTop3, hasDaily, hasOverall } = useMemo(() => {
    const b = splitLeaderboard(scores as ScoreRowFull[] | undefined);
    return {
      dailyTop3: b.daily.slice(0, 3),
      overallTop3: b.overall.slice(0, 3),
      mobileTop3: b.mobile.slice(0, 3),
      mobileTop20: b.mobile,
      classicTop3: b.classic.slice(0, 3),
      hasDaily: b.daily.length > 0,
      hasOverall: b.overall.length > 0,
    };
  }, [scores]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading && !scores) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const headerContent = (
    <div className="flex items-center gap-3">
      <div className="bg-yellow-100 p-3 rounded-full border-2 border-yellow-300">
        <Trophy className="w-6 h-6 text-yellow-600" />
      </div>
      <h3 className="font-display text-2xl tracking-wide">Leaderboard</h3>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border-4 border-black p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)]">
      <div className="flex items-center justify-between mb-6">
        {onTitleClick ? (
          <button
            type="button"
            onClick={onTitleClick}
            className="flex items-center gap-3 rounded-xl hover:bg-orange-50 active:bg-orange-100 transition-colors -m-2 p-2 text-left"
            aria-label="Open leaderboard"
          >
            {headerContent}
          </button>
        ) : (
          headerContent
        )}
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
          aria-label="Refresh scores"
        >
          <RefreshCw className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      <Tabs defaultValue={hasDaily ? "daily" : hasOverall ? "overall" : "mobile"} className="w-full">
        <TabsList className="w-full grid grid-cols-4 h-10 rounded-xl bg-gray-100 p-1">
          <TabsTrigger value="daily" className="rounded-lg font-display font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Daily
          </TabsTrigger>
          <TabsTrigger value="overall" className="rounded-lg font-display font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Overall
          </TabsTrigger>
          <TabsTrigger value="mobile" className="rounded-lg font-display font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Mobile
          </TabsTrigger>
          <TabsTrigger value="classic" className="rounded-lg font-display font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm" title="The original 20-level game">
            Classic
          </TabsTrigger>
        </TabsList>
        <TabsContent value="daily" className="mt-4">
          <HighScoreListContent scores={dailyTop3} showPlaceholders={true} />
          {onTitleClick && (
            <button
              type="button"
              onClick={onTitleClick}
              className="w-full flex justify-center pt-3 mt-1 text-gray-400 hover:text-gray-600 active:text-gray-700 transition-colors"
              aria-label="View more daily scores"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}
        </TabsContent>
        <TabsContent value="overall" className="mt-4">
          <HighScoreListContent scores={overallTop3} showPlaceholders={true} />
          {onTitleClick && (
            <button
              type="button"
              onClick={onTitleClick}
              className="w-full flex justify-center pt-3 mt-1 text-gray-400 hover:text-gray-600 active:text-gray-700 transition-colors"
              aria-label="View more overall scores"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}
        </TabsContent>
        <TabsContent value="mobile" className="mt-4">
          <HighScoreListContent scores={mobileTop3} showPlaceholders={true} />
          {onTitleClick && (!isMobile || mobileTop20.length > 3) && (
            <button
              type="button"
              onClick={onTitleClick}
              className="w-full flex justify-center pt-3 mt-1 text-gray-400 hover:text-gray-600 active:text-gray-700 transition-colors"
              aria-label="View more mobile scores"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}
        </TabsContent>
        <TabsContent value="classic" className="mt-4">
          <p className="mb-2 text-center text-xs font-bold text-gray-400">Scores from the original 20-level game</p>
          <HighScoreListContent scores={classicTop3} showPlaceholders={true} />
          {onTitleClick && (
            <button
              type="button"
              onClick={onTitleClick}
              className="w-full flex justify-center pt-3 mt-1 text-gray-400 hover:text-gray-600 active:text-gray-700 transition-colors"
              aria-label="View more classic scores"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

type ScoreWithRank = { id: string | number; name: string; score: number; level: number; rank?: number };

function scoresWithTiedRanks(scores: Array<{ id: string | number; name: string; score: number; level: number }>): ScoreWithRank[] {
  let currentRank = 1;
  return scores.map((s, i) => {
    if (i > 0 && (scores[i - 1].score !== s.score || scores[i - 1].level !== s.level)) {
      currentRank++;
    }
    return { ...s, rank: currentRank };
  });
}

export function HighScoreListContent({ scores, showPlaceholders = false }: { scores: Array<{ id: string | number; name: string; score: number; level: number }>; showPlaceholders?: boolean }) {
  // Assign tied ranks: same score and level => same rank
  const scoresRanked = scoresWithTiedRanks(scores);
  // If showPlaceholders is true, always show 3 rows, pad with placeholders if needed
  let displayScores: ScoreWithRank[] = [...scoresRanked];
  if (showPlaceholders) {
    while (displayScores.length < 3) {
      displayScores.push({ id: `placeholder-${displayScores.length}`, name: "", score: 0, level: 0 });
    }
    displayScores = displayScores.slice(0, 3);
  }

  return (
      <div className="space-y-3">
        {displayScores.length === 0 ? (
          <p className="text-center text-gray-400 py-4 font-bold italic">No scores yet. Be the first!</p>
        ) : (
          displayScores.map((score, idx) => {
            const isPlaceholder = showPlaceholders && !score.name;
            const rank = score.rank ?? idx + 1;
            return (
              <motion.div 
                key={String(score.id)}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${
                  isPlaceholder 
                    ? 'bg-transparent border-transparent' 
                    : 'bg-gray-50 border-gray-100 hover:bg-orange-50 hover:border-orange-100'
                }`}
              >
                <div className="flex items-center gap-4">
                  <span className={`
                    w-8 h-8 flex items-center justify-center rounded-full font-display text-lg border-2
                    ${isPlaceholder ? 'bg-transparent border-transparent' :
                      rank === 1 ? 'bg-yellow-400 border-yellow-600 text-white' : 
                      rank === 2 ? 'bg-gray-300 border-gray-500 text-white' :
                      rank === 3 ? 'bg-amber-600 border-amber-800 text-white' :
                      'bg-white border-gray-200 text-gray-400'}
                  `}>
                    {isPlaceholder ? '' : rank}
                  </span>
                  <div>
                    {isPlaceholder ? (
                      <>
                        <p className="font-bold text-transparent leading-none">&nbsp;</p>
                        <p className="text-xs text-transparent font-medium">&nbsp;</p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-gray-800 leading-none">{score.name}</p>
                        <p className="text-xs text-gray-500 font-medium">Lvl {score.level}</p>
                      </>
                    )}
                  </div>
                </div>
                <span className={`font-display text-xl ${isPlaceholder ? 'text-transparent' : 'text-primary'}`}>
                  {isPlaceholder ? '—' : score.score}
                </span>
              </motion.div>
            );
          })
        )}
      </div>
  );
}
