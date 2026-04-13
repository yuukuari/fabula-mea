import { useEffect, useState } from 'react';
import { Users, ShieldCheck, Mail, Calendar, BookOpen, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

interface Member {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  spotifyEnabled?: boolean;
  createdAt: string;
  booksCount?: number;
}

export function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    setIsLoading(true);
    try {
      const { members: data } = await api.admin.members();
      setMembers(data);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSpotify = async (memberId: string, current: boolean) => {
    try {
      await api.admin.setSpotifyEnabled(memberId, !current);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, spotifyEnabled: !current } : m))
      );
    } catch {
      // ignore
    }
  };

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title flex items-center gap-3">
          <Users className="w-7 h-7 text-bordeaux-500" />
          Membres
        </h1>
        <span className="text-sm text-ink-200">{members.length} membre{members.length > 1 ? 's' : ''}</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-bordeaux-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3">
          {members.map((member) => (
            <div key={member.id} className="card-fantasy p-4 flex items-center gap-4">
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm',
                  member.isAdmin ? 'bg-bordeaux-500' : 'bg-ink-300'
                )}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-ink-500 truncate">{member.name}</span>
                  {member.isAdmin && (
                    <span className="badge bg-bordeaux-100 text-bordeaux-600">
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      Admin
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-ink-200 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {member.email}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Inscrit le {new Date(member.createdAt).toLocaleDateString('fr-FR')}
                  </span>
                  {member.booksCount !== undefined && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" />
                      {member.booksCount} livre{member.booksCount > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => toggleSpotify(member.id, !!member.spotifyEnabled)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-colors flex items-center gap-1 shrink-0',
                  member.spotifyEnabled
                    ? 'bg-[#1DB954]/10 text-[#1DB954] hover:bg-[#1DB954]/20'
                    : 'bg-parchment-200 text-ink-200 hover:bg-parchment-300'
                )}
                title={member.spotifyEnabled ? 'Désactiver Spotify' : 'Activer Spotify'}
              >
                <Music className="w-3 h-3" />
                Spotify
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
