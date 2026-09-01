import { Calendar } from 'lucide-react';

export function Header() {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-12 gap-6 sm:gap-4">
      <div className="flex-1">
        <h1 className="text-white text-3xl lg:text-4xl font-bold mb-2">Welcome back, Prof. Dale! 👋</h1>
        <p className="text-gray-400 text-base">Here's an overview of the academic performance and activities.</p>
      </div>
      <button className="flex items-center gap-3 px-6 py-3 rounded-lg bg-white/10 border border-white/20 text-gray-300 hover:bg-white/20 transition-all text-sm font-medium flex-shrink-0">
        <Calendar size={20} />
        <span>May 1 – May 31, 2024</span>
      </button>
    </div>
  );
}
