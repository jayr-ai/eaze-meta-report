import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface RevenueData {
  month: string;
  revenue: number;
}

interface RevenueChartProps {
  data: RevenueData[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <div className="bg-navy-900/50 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
      <h3 className="text-white font-bold text-xl mb-8">Monthly Revenue Trend</h3>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <defs>
            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis dataKey="month" stroke="#9CA3AF" style={{ fontSize: '11px' }} />
          <YAxis stroke="#9CA3AF" style={{ fontSize: '11px' }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0B1120',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#fff' }}
            formatter={(value) => `₱${value.toFixed(2)}M`}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#10B981"
            fillOpacity={1}
            fill="url(#colorRevenue)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-4 md:mt-6 grid grid-cols-3 sm:grid-cols-6 gap-1 md:gap-2 text-center text-xs">
        {data.map((item, index) => (
          <div key={index} className="truncate">
            <p className="text-gray-400 text-xs truncate">{item.month}</p>
            <p className="text-white font-bold text-xs md:text-sm truncate">₱{item.revenue.toFixed(2)}M</p>
          </div>
        ))}
      </div>
    </div>
  );
}
