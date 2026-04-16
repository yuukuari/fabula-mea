import type { Character } from '@/types';
import { CharacterAvatar } from './CharacterAvatar';
import { BookText, GitFork } from 'lucide-react';

interface CharacterCardProps {
  character: Character;
  onClick: () => void;
}

export function CharacterCard({ character, onClick }: CharacterCardProps) {
  return (
    <div onClick={onClick} className="card-fantasy p-4 cursor-pointer">
      <div className="flex gap-4">
        <div className="flex-shrink-0">
          <CharacterAvatar
            imageUrl={character.imageUrl}
            imageOffsetY={character.imageOffsetY}
            name={character.name}
            size={16}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-display font-bold text-ink-500 truncate">
              {character.name} {character.surname}
            </h3>
            {character.hideFromRelationshipGraph && (
              <span className="flex items-center gap-0.5 text-[10px] text-ink-300 bg-parchment-200 px-1.5 py-0.5 rounded-full flex-shrink-0">
                <GitFork className="w-3 h-3" />
                Généalogie
              </span>
            )}
            {character.inGlossary && (
              <BookText className="w-3.5 h-3.5 text-bordeaux-400 flex-shrink-0" />
            )}
          </div>
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
