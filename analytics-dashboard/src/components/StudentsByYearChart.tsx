import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface YearData {
  name: string;
  value: number;
  color: string;
}

interface StudentsByYearChartProps {
  data: YearData[];
}

export function StudentsByYearChart({ data }: StudentsByYearChartProps) {
  return (
    <div className="bg-navy-900/50 border border-white/10 rounded-2xl p-8 backdrop-blur-sm min-h-[400px] flex flex-col">
      <h3 className="text-white font-bold text-xl mb-8">Students by Year Level</h3>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={30}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#0B1120',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#fff' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-4 md:mt-6 space-y-2">
        {data.map((year, index) => (
          <div key={index} className="flex items-center justify-between text-xs md:text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className="w-2 md:w-3 h-2 md:h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: year.color }}
              />
              <span className="text-gray-300 truncate">{year.name}</span>
            </div>
            <span className="text-white font-medium flex-shrink-0 ml-2">{year.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
