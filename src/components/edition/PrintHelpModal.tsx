/**
 * Pedagogical modal that explains a print concept with illustrative SVG diagrams.
 * Three topics: bleed (fonds perdus), safety margins (marges de sécurité),
 * and flat cover layout (couverture à plat).
 */
import { X } from 'lucide-react';

export type HelpTopic = 'bleed' | 'safety' | 'flat-cover';

interface Props {
  topic: HelpTopic;
  onClose: () => void;
}

export function PrintHelpModal({ topic, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-parchment-100 transition-colors z-10"
          aria-label="Fermer"
        >
          <X className="w-5 h-5 text-ink-300" />
        </button>
        <div className="p-6">
          {topic === 'bleed' && <BleedContent />}
          {topic === 'safety' && <SafetyContent />}
          {topic === 'flat-cover' && <FlatCoverContent />}

          <button
            onClick={onClose}
            className="btn-primary w-full mt-6"
          >
            J'ai compris
          </button>
        </div>
      </div>
    </div>
  );
}

/** Small info button that opens the modal. */
export function HelpTrigger({ topic, label, onClick }: { topic: HelpTopic; label?: string; onClick: (topic: HelpTopic) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(topic)}
      className="inline-flex items-center gap-1 text-xs text-bordeaux-400 hover:text-bordeaux-600 transition-colors"
    >
      <InfoIcon />
      {label ?? 'En savoir plus'}
    </button>
  );
}

function InfoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

// ─── Bleed content ───
function BleedContent() {
  return (
    <>
      <h2 className="font-display text-xl font-bold text-ink-500 mb-1">Comprendre les fonds perdus</h2>
      <p className="text-sm text-ink-300 mb-4">
        Le fond perdu est la zone située autour du format fini (ligne rouge) qui sera <b>coupée</b> lors
        de la finition. Il évite les liserés blancs sur les bords si la coupe est imparfaite.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <BleedExample variant="bad-1" />
        <BleedExample variant="bad-2" />
        <BleedExample variant="good" />
      </div>

      <div className="space-y-2 text-sm text-ink-400">
        <p>
          <span className="inline-block w-4 h-4 align-middle mr-2 rounded-sm" style={{ background: '#e53e3e' }} />
          <b>Ligne rouge</b> : zone de coupe (format fini).
        </p>
        <p>
          <span className="inline-block w-4 h-4 align-middle mr-2 rounded-sm" style={{ background: '#059669' }} />
          <b>Pointillés verts</b> : zone de sécurité. Tout élément important doit rester dedans.
        </p>
      </div>
    </>
  );
}

function BleedExample({ variant }: { variant: 'bad-1' | 'bad-2' | 'good' }) {
  const bad1 = variant === 'bad-1';
  const bad2 = variant === 'bad-2';
  const good = variant === 'good';
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="140" viewBox="0 0 100 140">
        {/* Paper area */}
        <rect x="0" y="0" width="100" height="140" fill={bad1 ? '#fff' : '#8b6d4b'} />
        {/* Content area (only for good & bad-2) */}
        {!bad1 && (
          <rect x={bad2 ? '18' : '4'} y={bad2 ? '26' : '4'} width={bad2 ? '64' : '92'} height={bad2 ? '88' : '132'} fill="#d4a574" />
        )}
        {/* Trim line */}
        <rect x="10" y="15" width="80" height="110" fill="none" stroke="#e53e3e" strokeWidth="1" />
        {/* Safety zone */}
        <rect x="16" y="21" width="68" height="98" fill="none" stroke="#059669" strokeWidth="0.7" strokeDasharray="3 2" />
        {/* Example text */}
        <text x="50" y="72" textAnchor="middle" fontSize="7" fill="#2c2417" fontWeight="bold">TITRE</text>
      </svg>
      <div className="flex items-center justify-center mt-2">
        {good ? (
          <span className="text-xs font-semibold text-green-600">✓ Parfait</span>
        ) : (
          <span className="text-xs font-semibold text-red-500">✗ À éviter</span>
        )}
      </div>
      <p className="text-[10px] text-ink-300 text-center mt-1 leading-tight">
        {bad1 && "Pas de fond perdu : risque de bandes blanches."}
        {bad2 && "Contenu dans la zone à couper."}
        {good && "Fond perdu OK, texte dans la zone sûre."}
      </p>
    </div>
  );
}

// ─── Safety content ───
function SafetyContent() {
  return (
    <>
      <h2 className="font-display text-xl font-bold text-ink-500 mb-1">Zones de sécurité</h2>
      <p className="text-sm text-ink-300 mb-4">
        Tous les éléments importants (texte, visages, logos) doivent rester à l'intérieur de la zone
        de sécurité, c'est-à-dire à au moins <b>5 mm</b> du bord de coupe, et <b>à au moins 15 mm</b> du
        bord côté reliure (la gouttière) pour ne pas être « avalés » par la colle.
      </p>

      <div className="flex justify-center mb-4">
        <svg width="360" height="220" viewBox="0 0 360 220">
          {/* Left page */}
          <g>
            <rect x="20" y="20" width="150" height="180" fill="#fafaf5" stroke="#888" strokeWidth="1" />
            <rect x="28" y="28" width="134" height="164" fill="none" stroke="#059669" strokeWidth="1" strokeDasharray="3 2" />
            {/* Large inner margin */}
            <rect x="150" y="28" width="12" height="164" fill="#fef9ec" opacity="0.6" />
            <text x="95" y="115" textAnchor="middle" fontSize="7" fill="#888">Zone utile</text>
          </g>
          {/* Spine (binding) */}
          <rect x="170" y="10" width="20" height="200" fill="#d4a574" opacity="0.4" />
          <text x="180" y="115" textAnchor="middle" fontSize="6" fill="#7a1b3a" fontWeight="bold" transform="rotate(-90 180 115)">RELIURE</text>
          {/* Right page */}
          <g>
            <rect x="190" y="20" width="150" height="180" fill="#fafaf5" stroke="#888" strokeWidth="1" />
            <rect x="198" y="28" width="134" height="164" fill="none" stroke="#059669" strokeWidth="1" strokeDasharray="3 2" />
            {/* Large inner margin */}
            <rect x="198" y="28" width="12" height="164" fill="#fef9ec" opacity="0.6" />
            <text x="265" y="115" textAnchor="middle" fontSize="7" fill="#888">Zone utile</text>
          </g>
          {/* Arrows */}
          <g stroke="#7a1b3a" strokeWidth="1" fill="none">
            <line x1="156" y1="210" x2="162" y2="210" markerEnd="url(#arr)" />
            <line x1="198" y1="210" x2="204" y2="210" markerStart="url(#arr)" />
          </g>
          <text x="180" y="218" textAnchor="middle" fontSize="6" fill="#7a1b3a">marge intérieure</text>
          <defs>
            <marker id="arr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#7a1b3a" />
            </marker>
          </defs>
        </svg>
      </div>

      <ul className="text-sm text-ink-400 space-y-1.5 list-disc pl-5">
        <li><b>Marges extérieures</b> : 12 à 15 mm suffisent.</li>
        <li><b>Marge intérieure (reliure)</b> : 15 à 20 mm recommandés. Si le livre fait &gt; 400 pages, passez à 20-25 mm.</li>
        <li><b>Images qui doivent toucher le bord</b> : faites-les dépasser dans le fond perdu.</li>
      </ul>
    </>
  );
}

// ─── Flat cover content ───
function FlatCoverContent() {
  return (
    <>
      <h2 className="font-display text-xl font-bold text-ink-500 mb-1">Couverture à plat — disposition</h2>
      <p className="text-sm text-ink-300 mb-4">
        Quand on déplie la couverture d'un livre, on obtient (de gauche à droite) :
        <b> 4ème de couverture</b>, <b>dos</b>, <b>1ère de couverture</b>.
        Dans le PDF envoyé à l'imprimeur, l'ordre est identique.
      </p>

      <div className="flex justify-center mb-4">
        <svg width="420" height="180" viewBox="0 0 420 180">
          {/* Bleed area */}
          <rect x="0" y="0" width="420" height="180" fill="#fef4f4" />
          {/* Trim area */}
          <rect x="10" y="10" width="400" height="160" fill="#fafaf5" stroke="#e53e3e" strokeWidth="1" />

          {/* Back cover */}
          <rect x="10" y="10" width="170" height="160" fill="#f0e6d2" />
          <text x="95" y="92" textAnchor="middle" fontSize="10" fill="#7a1b3a" fontWeight="bold">4ème de couverture</text>
          <text x="95" y="106" textAnchor="middle" fontSize="7" fill="#888">résumé, bio, code-barres</text>

          {/* Spine */}
          <rect x="180" y="10" width="60" height="160" fill="#e6d9b8" />
          <text x="210" y="95" textAnchor="middle" fontSize="8" fill="#7a1b3a" fontWeight="bold" transform="rotate(-90 210 95)">DOS</text>

          {/* Front cover */}
          <rect x="240" y="10" width="170" height="160" fill="#f0e6d2" />
          <text x="325" y="92" textAnchor="middle" fontSize="10" fill="#7a1b3a" fontWeight="bold">1ère de couverture</text>
          <text x="325" y="106" textAnchor="middle" fontSize="7" fill="#888">titre, auteur, visuel</text>

          {/* Safety zones */}
          <rect x="15" y="15" width="160" height="150" fill="none" stroke="#059669" strokeWidth="0.5" strokeDasharray="2 2" />
          <rect x="245" y="15" width="160" height="150" fill="none" stroke="#059669" strokeWidth="0.5" strokeDasharray="2 2" />

          {/* Spine dashed boundaries */}
          <line x1="180" y1="10" x2="180" y2="170" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="2 2" />
          <line x1="240" y1="10" x2="240" y2="170" stroke="#3b82f6" strokeWidth="0.5" strokeDasharray="2 2" />

          {/* Dimension labels */}
          <g fill="#888" fontSize="6">
            <text x="95" y="176" textAnchor="middle">largeur page</text>
            <text x="210" y="176" textAnchor="middle">dos calculé</text>
            <text x="325" y="176" textAnchor="middle">largeur page</text>
          </g>
        </svg>
      </div>

      <ul className="text-sm text-ink-400 space-y-1.5 list-disc pl-5">
        <li>Le <b>dos</b> accueille le titre vertical (lisible tête en haut) si sa largeur est ≥ 6 mm.</li>
        <li>La <b>4ème</b> contient généralement le résumé, la bio auteur, et le code-barres ISBN.</li>
        <li>La <b>1ère</b> porte le titre, le nom de l'auteur, et le visuel principal.</li>
        <li>Prévoyez du fond perdu sur les 4 bords extérieurs du PDF final.</li>
      </ul>
    </>
  );
}
