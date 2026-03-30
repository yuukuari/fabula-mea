import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CharacterAvatarProps {
  imageUrl?: string;
  imageOffsetY?: number;
  name: string;
  /** Size in Tailwind units (w-X h-X). Defaults to 16 (4rem / 64px). */
  size?: number;
  className?: string;
}

const sizeClasses: Record<number, { container: string; icon: string; border: string }> = {
  8: { container: 'w-8 h-8', icon: 'w-4 h-4', border: 'border' },
  10: { container: 'w-10 h-10', icon: 'w-5 h-5', border: 'border-2' },
  12: { container: 'w-12 h-12', icon: 'w-6 h-6', border: 'border-2' },
  16: { container: 'w-16 h-16', icon: 'w-8 h-8', border: 'border-2' },
  32: { container: 'w-32 h-32', icon: 'w-16 h-16', border: 'border-2' },
};

export function CharacterAvatar({ imageUrl, imageOffsetY = 50, name, size = 16, className }: CharacterAvatarProps) {
  const s = sizeClasses[size] ?? sizeClasses[16];

  if (imageUrl) {
    return (
      <div
        className={cn(s.container, s.border, 'rounded-full border-parchment-300 flex-shrink-0 overflow-hidden', className)}
      >
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
          style={{ transform: `scale(1.4) translateY(${(50 - imageOffsetY) * 0.6}%)` }}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className={cn(s.container, s.border, 'rounded-full bg-parchment-200 flex items-center justify-center border-parchment-300 flex-shrink-0', className)}>
      <User className={cn(s.icon, 'text-ink-200')} />
    </div>
  );
}
