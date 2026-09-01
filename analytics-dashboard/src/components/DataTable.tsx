interface StudentRecord {
  id: string;
  name: string;
  course: string;
  gpa: number;
  status: string;
}

interface DataTableProps {
  data: StudentRecord[];
}

function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'Passed':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'On Probation':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'Failed':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
}

export function DataTable({ data }: DataTableProps) {
  return (
    <div className="bg-navy-900/50 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
      <h3 className="text-white font-bold text-xl mb-8">Recent Students Performance</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-gray-400 font-medium py-2 md:py-3 px-2 md:px-4">#</th>
              <th className="text-left text-gray-400 font-medium py-2 md:py-3 px-2 md:px-4">ID</th>
              <th className="text-left text-gray-400 font-medium py-2 md:py-3 px-2 md:px-4">Name</th>
              <th className="hidden sm:table-cell text-left text-gray-400 font-medium py-2 md:py-3 px-2 md:px-4">Course</th>
              <th className="text-left text-gray-400 font-medium py-2 md:py-3 px-2 md:px-4">GPA</th>
              <th className="text-left text-gray-400 font-medium py-2 md:py-3 px-2 md:px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((record, index) => (
              <tr key={record.id} className="border-b border-white/5 hover:bg-white/5 transition-all">
                <td className="text-white py-2 md:py-3 px-2 md:px-4">{index + 1}</td>
                <td className="text-gray-300 py-2 md:py-3 px-2 md:px-4 truncate">{record.id}</td>
                <td className="text-white py-2 md:py-3 px-2 md:px-4 truncate">{record.name}</td>
                <td className="hidden sm:table-cell text-gray-300 py-2 md:py-3 px-2 md:px-4">{record.course}</td>
                <td className="text-white py-2 md:py-3 px-2 md:px-4 font-medium">{record.gpa}</td>
                <td className="py-2 md:py-3 px-2 md:px-4">
                  <span
                    className={`inline-block px-2 md:px-3 py-1 rounded-full text-xs font-medium border ${getStatusBadgeColor(
                      record.status
                    )}`}
                  >
                    {record.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
