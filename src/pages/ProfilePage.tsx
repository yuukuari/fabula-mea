import { useState } from 'react';
import { AlertTriangle, Trash2, Loader2, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { ImageUpload } from '@/components/shared/ImageUpload';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const changePassword = useAuthStore((s) => s.changePassword);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);

  // Profile info
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [avatarOffsetY, setAvatarOffsetY] = useState(user?.avatarOffsetY ?? 50);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // Password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!user) return null;

  const handleAvatarChange = async (dataUrl: string | undefined) => {
    const newUrl = dataUrl ?? '';
    setAvatarUrl(newUrl);
    if (!dataUrl) setAvatarOffsetY(50);
    try {
      await updateProfile({ avatarUrl: newUrl, avatarOffsetY: dataUrl ? avatarOffsetY : 50 });
    } catch {
      // silent
    }
  };

  const handleAvatarOffsetChange = async (offsetY: number) => {
    setAvatarOffsetY(offsetY);
    await updateProfile({ avatarOffsetY: offsetY });
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) return;
    setProfileSaving(true);
    setProfileMsg('');
    try {
      await updateProfile({ name: name.trim(), email: email.trim() });
      setProfileMsg('Profil mis à jour');
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err) {
      setProfileMsg((err as Error).message);
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Les mots de passe ne correspondent pas');
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg('Min. 8 caractères');
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg('');
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMsg('Mot de passe modifié');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMsg(''), 3000);
    } catch (err) {
      setPasswordMsg((err as Error).message);
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
    } catch {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="min-h-screen bg-parchment-50">
      <div className="max-w-2xl mx-auto px-8 pt-8 pb-2">
        <h2 className="font-display text-2xl font-bold text-ink-500">Profil</h2>
        <p className="text-ink-300 text-sm mt-1">Gérez vos informations personnelles</p>
      </div>

      <div className="max-w-2xl mx-auto px-8 py-6 space-y-6">
        {/* Avatar + Info */}
        <div className="card-fantasy p-6">
          <h3 className="font-display text-lg font-semibold text-ink-500 mb-5">Informations</h3>

          {/* Avatar */}
          <div className="flex items-center gap-5 mb-6">
            <ImageUpload
              value={avatarUrl || undefined}
              onChange={handleAvatarChange}
              round
              offsetY={avatarOffsetY}
              onOffsetYChange={handleAvatarOffsetChange}
            />
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink-500">{user.name}</p>
              <p className="text-xs text-ink-300">{user.email}</p>
            </div>
          </div>

          {/* Name + Email */}
          <div className="space-y-4">
            <div>
              <label className="label-field">Nom d'affichage</label>
              <input
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Email</label>
              <input
                type="email"
                className="input-field"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={handleSaveProfile}
              disabled={profileSaving || !name.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {profileSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
            {profileMsg && (
              <p className={`text-sm ${profileMsg.includes('Erreur') || profileMsg.includes('utilisé') ? 'text-red-500' : 'text-green-600'}`}>
                {profileMsg}
              </p>
            )}
          </div>
        </div>

        {/* Change Password */}
        <div className="card-fantasy p-6">
          <h3 className="font-display text-lg font-semibold text-ink-500 mb-4">Mot de passe</h3>
          <div className="space-y-4">
            <div>
              <label className="label-field">Mot de passe actuel</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  className="input-field pr-10"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-200 hover:text-ink-400"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label-field">Nouveau mot de passe <span className="text-ink-200 font-normal">(min. 8 caractères)</span></label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  className="input-field pr-10"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-200 hover:text-ink-400"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="label-field">Confirmer le nouveau mot de passe</label>
              <input
                type="password"
                className="input-field"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-5">
            <button
              onClick={handleChangePassword}
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              className="btn-primary flex items-center gap-2"
            >
              {passwordSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              Changer le mot de passe
            </button>
            {passwordMsg && (
              <p className={`text-sm ${passwordMsg.includes('modifié') ? 'text-green-600' : 'text-red-500'}`}>
                {passwordMsg}
              </p>
            )}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="card-fantasy p-6 border-red-200">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-red-600">Zone dangereuse</h3>
              <p className="text-sm text-ink-300 mt-1">
                La suppression de votre compte est irréversible. Toutes vos données (livres, personnages, relectures...) seront définitivement perdues.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-red-200 text-red-600
                       hover:bg-red-50 hover:border-red-300 transition-all text-sm font-medium"
          >
            <Trash2 className="w-4 h-4" />
            Supprimer mon compte
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Supprimer votre compte ?"
        description="Cette action est irréversible. Toutes vos données seront définitivement supprimées."
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmLabel={deleting ? 'Suppression...' : 'Supprimer définitivement'}
      />
    </div>
  );
}
