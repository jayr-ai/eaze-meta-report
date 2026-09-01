import { TrendingUp } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string;
  delta: number;
  icon: string;
  gradient: string;
  bgGradient: string;
}

export function KpiCard({
  label,
  value,
  delta,
  icon,
  gradient,
  bgGradient,
}: KpiCardProps) {
  const IconComponent =
    LucideIcons[icon as keyof typeof LucideIcons] || TrendingUp;

  return (
    <div
      className={`bg-gradient-to-br ${bgGradient} rounded-2xl p-6 lg:p-8 border border-white/10 backdrop-blur-sm hover:border-white/20 transition-all hover:shadow-lg hover:shadow-blue-500/10 min-h-[180px] flex flex-col justify-between w-full`}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex-1 pr-4">
          <p className="text-gray-400 text-sm lg:text-base font-medium mb-2">{label}</p>
          <h3 className="text-white text-2xl lg:text-4xl font-bold">{value}</h3>
        </div>
        <div
          className={`p-3 lg:p-4 rounded-lg bg-gradient-to-br ${gradient} text-white opacity-80 flex-shrink-0`}
        >
          <IconComponent size={24} />
        </div>
      </div>
      <div className="flex items-center gap-2 text-green-400 text-xs lg:text-sm">
        <TrendingUp size={16} className="flex-shrink-0" />
        <span className="font-medium">↑ {delta}% from last month</span>
      </div>
    </div>
  );
}
