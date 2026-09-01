import { AlertTriangle, AlertCircle, Info } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

interface Alert {
  id: string;
  type: 'warning' | 'danger' | 'info';
  title: string;
  subtitle: string;
  icon: string;
}

interface AlertsPanelProps {
  alerts: Alert[];
}

function getAlertStyles(type: string): {
  bg: string;
  border: string;
  icon: React.ReactNode;
  color: string;
} {
  switch (type) {
    case 'warning':
      return {
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/20',
        icon: <AlertTriangle size={20} className="text-yellow-400" />,
        color: 'text-yellow-400',
      };
    case 'danger':
      return {
        bg: 'bg-red-500/10',
        border: 'border-red-500/20',
        icon: <AlertCircle size={20} className="text-red-400" />,
        color: 'text-red-400',
      };
    case 'info':
      return {
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        icon: <Info size={20} className="text-blue-400" />,
        color: 'text-blue-400',
      };
    default:
      return {
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/20',
        icon: <Info size={20} className="text-gray-400" />,
        color: 'text-gray-400',
      };
  }
}

export function AlertsPanel({ alerts }: AlertsPanelProps) {
  return (
    <div className="bg-navy-900/50 border border-white/10 rounded-2xl p-8 backdrop-blur-sm">
      <h3 className="text-white font-bold text-xl mb-8">Alerts & Notifications</h3>
      <div className="space-y-4">
        {alerts.map((alert) => {
          const styles = getAlertStyles(alert.type);
          return (
            <div
              key={alert.id}
              className={`${styles.bg} border ${styles.border} rounded-lg p-3 md:p-4 flex items-start justify-between gap-2 md:gap-4 hover:border-opacity-100 transition-all`}
            >
              <div className="flex items-start gap-2 md:gap-3 flex-1 min-w-0">
                <div className="mt-0.5 flex-shrink-0">{styles.icon}</div>
                <div className="min-w-0">
                  <p className="text-white font-medium text-xs md:text-sm line-clamp-1">{alert.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5 md:mt-1 line-clamp-2">{alert.subtitle}</p>
                </div>
              </div>
              <button
                className={`${styles.color} text-xs font-medium hover:opacity-80 transition-all whitespace-nowrap flex-shrink-0`}
              >
                View
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
