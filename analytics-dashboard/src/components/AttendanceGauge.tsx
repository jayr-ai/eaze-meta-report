interface AttendanceGaugeProps {
  percentage: number;
  delta: number;
}

export function AttendanceGauge({ percentage, delta }: AttendanceGaugeProps) {
  const circumference = 2 * Math.PI * 45;
  const offset = circumference - (percentage / 100) * circumference;
  const gaugeSize = 160; // Responsive size

  return (
    <div className="bg-navy-900/50 border border-white/10 rounded-2xl p-8 backdrop-blur-sm flex flex-col items-center justify-center min-h-[400px]">
      <h3 className="text-white font-bold text-xl mb-12">Attendance Overview</h3>
      <div className="relative w-56 h-56 mb-8">
        <svg width={gaugeSize} height={gaugeSize} viewBox="0 0 200 200" className="transform -rotate-90 w-full h-full">
          <circle
            cx="100"
            cy="100"
            r="45"
            fill="none"
            stroke="#1F2937"
            strokeWidth="8"
          />
          <circle
            cx="100"
            cy="100"
            r="45"
            fill="none"
            stroke="#10B981"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl md:text-4xl font-bold text-white">{percentage}%</span>
          <span className="text-xs md:text-sm text-gray-400">Rate</span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-green-400 text-xs md:text-sm">
        <span>↑ {delta}% last month</span>
      </div>
    </div>
  );
}
