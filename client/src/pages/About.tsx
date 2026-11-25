import { Link } from "wouter";

export default function About() {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-100 via-orange-50 to-white p-4 md:p-8 safe-area-pad-top">
      <div className="max-w-2xl mx-auto py-12">
        <div className="bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-8 md:p-10">
          <h1 className="font-display text-4xl text-gray-900 mb-2">About Carrot Roll</h1>
          <p className="text-primary font-bold text-lg mb-6">Arcade Survival</p>

          <p className="text-gray-700 mb-6 leading-relaxed">
            Carrot Roll is a fast-paced arcade game. You play as a flying rabbit dodging a giant rolling carrot that shoots broccoli. Collect small carrots to level up, avoid broccoli and spiky balls, and grab power-ups for shields, speed, and extra lives.
          </p>

          <div className="bg-orange-50 rounded-xl p-4 mb-6 border-2 border-orange-100">
            <h2 className="font-display text-xl text-gray-900 mb-2">Controls</h2>
            <p className="text-gray-700 text-sm">
              Use <kbd className="px-1.5 py-0.5 bg-gray-200 rounded border border-gray-300 font-mono">WASD</kbd> or <kbd className="px-1.5 py-0.5 bg-gray-200 rounded border border-gray-300 font-mono">Arrow Keys</kbd> to move, <kbd className="px-1.5 py-0.5 bg-gray-200 rounded border border-gray-300 font-mono">Spacebar</kbd> to fire. Collect 10 carrots to level up; avoid the giant carrot and falling hazards!
            </p>
          </div>

          <p className="text-gray-500 text-sm mb-8">
            Created by my daughter, Nya.
          </p>

          <Link href="/">
            <a className="inline-block font-display font-bold text-primary hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
              ← Back to Menu
            </a>
          </Link>
        </div>
      </div>
    </div>
  );
}
