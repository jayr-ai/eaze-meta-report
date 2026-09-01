import {
  BarChart3,
  Users,
  BookOpen,
  TrendingUp,
  Calendar,
  Wallet,
  FileText,
  Clock,
  Settings,
  Shield,
} from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}

const navItems: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: <BarChart3 size={20} />, active: true },
  { id: 'students', label: 'Students', icon: <Users size={20} /> },
  { id: 'courses', label: 'Courses', icon: <BookOpen size={20} /> },
  { id: 'performance', label: 'Performance', icon: <TrendingUp size={20} /> },
  { id: 'attendance', label: 'Attendance', icon: <Calendar size={20} /> },
  { id: 'finance', label: 'Finance', icon: <Wallet size={20} /> },
  { id: 'reports', label: 'Reports', icon: <FileText size={20} /> },
  { id: 'calendar', label: 'Calendar', icon: <Clock size={20} /> },
  { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
];

export function Sidebar() {
  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-60 bg-navy-800 border-r border-white/10 flex-col">
        {/* Logo */}
        <div className="p-4 md:p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex-shrink-0">
              <Shield size={24} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-white text-base md:text-lg truncate">Prof. Dale</h1>
              <p className="text-xs text-gray-400 truncate">Analytics Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-sm font-medium ${
                item.active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-white/5'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Quote Card */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="bg-white/5 rounded-lg p-4 border border-white/10">
            <p className="text-xs text-gray-300 italic line-clamp-3">
              "Education is not the learning of facts, but the training of the mind to think."
            </p>
            <p className="text-xs text-gray-500 mt-3">— Prof. Dale</p>
          </div>
        </div>

        {/* User Profile */}
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-white/5 transition-all cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
              PD
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">Prof. Dale</p>
              <p className="text-xs text-gray-400 truncate">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-navy-800 border-b border-white/10 flex items-center px-4 z-50">
        <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex-shrink-0">
          <Shield size={20} className="text-white" />
        </div>
        <h1 className="font-bold text-white text-base ml-3">Prof. Dale</h1>
      </div>
    </>
  );
}
