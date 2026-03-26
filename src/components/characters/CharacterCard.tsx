import type { Character } from '@/types';
import { User } from 'lucide-react';

interface CharacterCardProps {
  character: Character;
  onClick: () => void;
}

export function CharacterCard({ character, onClick }: CharacterCardProps) {
  return (
    <div onClick={onClick} className="card-fantasy p-4 cursor-pointer">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          {character.imageUrl ? (
            <img
              src={character.imageUrl}
              alt={character.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-parchment-300"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-parchment-200 flex items-center justify-center border-2 border-parchment-300">
              <User className="w-8 h-8 text-ink-200" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display font-bold text-ink-500 truncate">
            {character.name} {character.surname}
          </h3>
          {character.nickname && (
            <p className="text-xs text-ink-300 italic">"{character.nickname}"</p>
          )}
          {character.profession && (
            <p className="text-sm text-bordeaux-500 mt-0.5">{character.profession}</p>
          )}
          {character.description && (
            <p className="text-sm text-ink-300 mt-1 line-clamp-2">{character.description}</p>
          )}
          <div className="flex gap-1 mt-2 flex-wrap">
            {character.qualities.slice(0, 2).map((q, i) => (
              <span key={i} className="badge bg-green-50 text-green-700">{q}</span>
            ))}
            {character.flaws.slice(0, 2).map((f, i) => (
              <span key={i} className="badge bg-red-50 text-red-700">{f}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
