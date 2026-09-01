import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Trophy } from 'lucide-react';

interface CourseData {
  name: string;
  gpa: number;
}

interface TopCoursesChartProps {
  data: CourseData[];
}

export function TopCoursesChart({ data }: TopCoursesChartProps) {
  return (
    <div className="bg-navy-900/50 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
      <div className="flex items-center gap-3 mb-8">
        <Trophy size={24} className="text-yellow-400 flex-shrink-0" />
        <h3 className="text-white font-bold text-xl">Top Performing Courses</h3>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
          <XAxis type="number" stroke="#9CA3AF" style={{ fontSize: '11px' }} />
          <YAxis dataKey="name" type="category" stroke="#9CA3AF" style={{ fontSize: '10px' }} width={75} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0B1120',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#fff' }}
          />
          <Bar dataKey="gpa" fill="#3B82F6" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
