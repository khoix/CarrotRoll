import GameCanvas from "@/components/GameCanvas";
import HighScoreList from "@/components/HighScoreList";

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100 via-orange-50 to-white p-4 md:p-8">
      
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex justify-between items-center">
        <div className="flex items-center gap-2">
           <div className="w-12 h-12 bg-primary rounded-xl rotate-3 flex items-center justify-center shadow-lg border-2 border-black">
              <span className="text-2xl">🥕</span>
           </div>
           <div>
              <h1 className="font-display text-4xl text-gray-900 leading-none">Carrot<span className="text-primary">Roll</span></h1>
              <p className="text-sm font-bold text-gray-400 tracking-wider uppercase">Arcade Survival</p>
           </div>
        </div>
        
        <div className="hidden md:block">
           <span className="bg-black text-white px-4 py-2 rounded-full font-bold text-sm shadow-md">
             Use WASD or Arrows to move
           </span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-8">
        {/* Game Area */}
        <div className="flex justify-center items-start">
           <GameCanvas />
        </div>

        {/* Sidebar / Stats */}
        <div className="space-y-6">
           <HighScoreList />
           
           <div className="bg-indigo-900 rounded-2xl p-6 text-white border-4 border-indigo-950 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)]">
              <h3 className="font-display text-2xl mb-4 text-yellow-400">Power-Ups</h3>
              <div className="space-y-4">
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500 border-2 border-green-300 shadow-md flex items-center justify-center text-xl">🛡️</div>
                    <div>
                        <p className="font-bold text-sm">Green Carrot</p>
                        <p className="text-xs text-indigo-200">Shield vs Spikes</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500 border-2 border-yellow-300 shadow-md flex items-center justify-center text-xl">⚡</div>
                    <div>
                        <p className="font-bold text-sm">Golden Carrot</p>
                        <p className="text-xs text-indigo-200">Super Speed</p>
                    </div>
                 </div>
              </div>
           </div>
           
           <div className="md:hidden text-center text-gray-400 text-sm font-bold">
              Use WASD or Arrow Keys to move
           </div>
        </div>
      </div>
      
      <footer className="max-w-7xl mx-auto mt-12 text-center text-gray-400 text-sm font-medium py-8 border-t border-gray-100">
         <p>Created for the Carrot Roll Challenge</p>
      </footer>
    </div>
  );
}
