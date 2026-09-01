import * as LucideIcons from 'lucide-react';

interface Action {
  id: string;
  label: string;
  icon: string;
}

interface QuickActionsProps {
  actions: Action[];
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="bg-navy-900/50 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
      <h3 className="text-white font-bold text-xl mb-8">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action) => {
          const IconComponent =
            LucideIcons[action.icon as keyof typeof LucideIcons] || LucideIcons.Zap;

          return (
            <button
              key={action.id}
              className="flex flex-col items-center justify-center gap-1 md:gap-3 p-2 md:p-4 rounded-lg md:rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10"
            >
              <div className="p-2 md:p-3 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/20">
                <IconComponent size={18} className="md:w-6 md:h-6 text-blue-400" />
              </div>
              <span className="text-white text-xs md:text-sm font-medium text-center line-clamp-2">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
