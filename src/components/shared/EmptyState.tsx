import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 bg-parchment-200 rounded-full flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-ink-200" />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink-400 mb-2">{title}</h3>
      <p className="text-sm text-ink-300 max-w-sm mb-6">{description}</p>
      {action}
    </div>
  );
}
