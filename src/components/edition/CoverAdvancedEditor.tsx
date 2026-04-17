/**
 * Advanced cover editor.
 *
 * Allows the user to upload a flat cover image (back + spine + front + bleed)
 * and add positioned text overlays (title, author, ISBN, etc.) with drag,
 * resize, rotation, and font/color/size properties.
 *
 * Opens in a fullscreen modal (via React Portal) so the canvas has room to
 * breathe regardless of the page layout.
 *
 * Implementation: SVG for guides, HTML divs positioned with `position: absolute`
 * for the overlays, pointer events for drag/resize. No external library.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus, Trash2, MoveUp, MoveDown, Upload, Bold, Italic,
  AlignLeft, AlignCenter, AlignRight, Loader2, X, Maximize2, Image as ImageIcon,
} from 'lucide-react';
import type { BookLayout, CoverTextOverlay } from '@/types';
import type { CoverDimensions } from '@/lib/print-edition';
import { uploadImage } from '@/lib/upload';
import { generateId } from '@/lib/utils';
import { getAdvancedCover, defaultOverlaysFor } from '@/lib/cover-composition';
import { AVAILABLE_FONTS, FONT_STACKS } from '@/lib/fonts';
import { CoverFlatPreview } from './CoverFlatPreview';

interface Props {
  layout: BookLayout | undefined;
  title: string;
  author: string;
  dims: CoverDimensions;
  onUpdateAdvanced: (data: { flatImage?: string; overlays?: CoverTextOverlay[] }) => void;
}

const FONT_CHOICES: string[] = [
  ...AVAILABLE_FONTS,
  'Playfair Display',
  'Inter',
];

export function CoverAdvancedEditor({ layout, title, author, dims, onUpdateAdvanced }: Props) {
  const advanced = getAdvancedCover(layout);
  const overlays = advanced.overlays ?? [];
  const flatImage = advanced.flatImage;

  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      setIsUploading(true);
      try {
        const url = await uploadImage(reader.result, 'cover-flat');
        onUpdateAdvanced({
          flatImage: url,
          overlays: overlays.length > 0 ? overlays : defaultOverlaysFor(title, author),
        });
        setIsOpen(true);
      } catch {
        onUpdateAdvanced({
          flatImage: reader.result,
          overlays: overlays.length > 0 ? overlays : defaultOverlaysFor(title, author),
        });
        setIsOpen(true);
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  return (
    <div>
      {/* Inline preview / trigger */}
      {!flatImage ? (
        <div className="card-fantasy p-6">
          <h4 className="font-display font-semibold text-ink-500 mb-1">Couverture dépliée (image de fond)</h4>
          <p className="text-xs text-ink-300 mb-3">
            Téléversez une image (ou PDF converti en image) aux dimensions exactes :
            <b> {dims.totalWidthMm} × {dims.totalHeightMm} mm</b>
            {' '}(fond perdu inclus). Utilisez le gabarit téléchargeable pour aligner vos éléments.
          </p>
          {isUploading ? (
            <div className="w-full h-64 border-2 border-dashed border-parchment-300 rounded-lg flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-ink-300 animate-spin" />
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-64 border-2 border-dashed border-parchment-300 rounded-lg
                         flex flex-col items-center justify-center gap-2
                         hover:border-bordeaux-300 hover:bg-bordeaux-50/20 transition-all"
            >
              <Upload className="w-8 h-8 text-ink-300" />
              <span className="text-sm text-ink-400">Cliquez pour téléverser votre couverture dépliée</span>
              <span className="text-xs text-ink-200">PNG, JPG ou image exportée depuis Photoshop / Canva / GIMP</span>
            </button>
          )}
        </div>
      ) : (
        <div className="card-fantasy p-4 space-y-3">
          <CoverFlatPreview
            layout={layout}
            dims={dims}
            title={title}
            author={author}
            widthPx={500}
          />
          <div>
            <h4 className="font-display font-semibold text-ink-500 mb-0.5">Couverture dépliée importée</h4>
            <p className="text-xs text-ink-300 mb-3">
              {overlays.length > 0
                ? `${overlays.length} élément${overlays.length > 1 ? 's' : ''} texte positionné${overlays.length > 1 ? 's' : ''}.`
                : 'Aucun texte positionné pour l\'instant.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsOpen(true)}
                className="btn-primary text-sm flex items-center gap-1.5"
              >
                <Maximize2 className="w-4 h-4" /> Ouvrir l'éditeur
              </button>
              <button
                onClick={() => {
                  if (confirm('Remplacer l\'image de fond ?')) fileInputRef.current?.click();
                }}
                className="btn-secondary text-sm flex items-center gap-1.5"
              >
                <ImageIcon className="w-4 h-4" /> Changer l'image
              </button>
            </div>
          </div>
        </div>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {/* Fullscreen editor modal */}
      {isOpen && flatImage && createPortal(
        <FullscreenEditor
          flatImage={flatImage}
          overlays={overlays}
          dims={dims}
          onClose={() => setIsOpen(false)}
          onUpdateAdvanced={onUpdateAdvanced}
          onReplaceImage={() => fileInputRef.current?.click()}
        />,
        document.body,
      )}
    </div>
  );
}

// ─── Fullscreen editor ───

interface FullscreenEditorProps {
  flatImage: string;
  overlays: CoverTextOverlay[];
  dims: CoverDimensions;
  onClose: () => void;
  onUpdateAdvanced: (data: { flatImage?: string; overlays?: CoverTextOverlay[] }) => void;
  onReplaceImage: () => void;
}

function FullscreenEditor({
  flatImage, overlays, dims, onClose, onUpdateAdvanced, onReplaceImage,
}: FullscreenEditorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Responsive canvas size — fit to available area
  const [canvasArea, setCanvasArea] = useState({ w: 1024, h: 768 });
  useLayoutEffect(() => {
    const update = () => {
      const el = canvasAreaRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setCanvasArea({ w: rect.width - 32, h: rect.height - 32 });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const aspectRatio = dims.totalWidthMm / dims.totalHeightMm;
  let canvasW = canvasArea.w;
  let canvasH = canvasW / aspectRatio;
  if (canvasH > canvasArea.h) {
    canvasH = canvasArea.h;
    canvasW = canvasH * aspectRatio;
  }
  canvasW = Math.max(320, canvasW);
  canvasH = Math.max(200, canvasH);
  const scale = canvasW / dims.totalWidthMm;

  const selected = overlays.find((o) => o.id === selectedId) ?? null;

  const updateOverlay = (id: string, data: Partial<CoverTextOverlay>) => {
    onUpdateAdvanced({ overlays: overlays.map((o) => (o.id === id ? { ...o, ...data } : o)) });
  };

  const deleteOverlay = (id: string) => {
    onUpdateAdvanced({ overlays: overlays.filter((o) => o.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };

  const addOverlay = () => {
    const newOverlay: CoverTextOverlay = {
      id: generateId(),
      xPct: 35, yPct: 45, widthPct: 30, heightPct: 10,
      rotation: 0,
      content: 'Nouveau texte',
      fontFamily: 'Inter',
      fontSize: 24, color: '#ffffff',
      fontWeight: 'normal', fontStyle: 'normal', textAlign: 'center',
    };
    onUpdateAdvanced({ overlays: [...overlays, newOverlay] });
    setSelectedId(newOverlay.id);
  };

  const moveOverlay = (id: string, direction: 'up' | 'down') => {
    const idx = overlays.findIndex((o) => o.id === id);
    if (idx < 0) return;
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= overlays.length) return;
    const next = [...overlays];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    onUpdateAdvanced({ overlays: next });
  };

  // Keyboard: Escape closes, Delete removes selected
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inField = !!(e.target as HTMLElement)?.closest('input, textarea, select');
      if (e.key === 'Escape' && !inField) {
        if (selectedId) setSelectedId(null);
        else onClose();
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !inField) {
        e.preventDefault();
        deleteOverlay(selectedId);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Drag/resize handlers ──

  const dragStartRef = useRef<{
    id: string;
    mode: 'move' | 'resize' | 'rotate';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    origRotation: number;
  } | null>(null);

  const handlePointerDown = (
    e: React.PointerEvent,
    overlay: CoverTextOverlay,
    mode: 'move' | 'resize' | 'rotate',
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(overlay.id);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStartRef.current = {
      id: overlay.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: overlay.xPct,
      origY: overlay.yPct,
      origW: overlay.widthPct,
      origH: overlay.heightPct,
      origRotation: overlay.rotation,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragStartRef.current;
    if (!drag) return;
    const dxPx = e.clientX - drag.startX;
    const dyPx = e.clientY - drag.startY;
    const dxPct = (dxPx / canvasW) * 100;
    const dyPct = (dyPx / canvasH) * 100;

    if (drag.mode === 'move') {
      updateOverlay(drag.id, {
        xPct: Math.max(0, Math.min(100 - drag.origW, drag.origX + dxPct)),
        yPct: Math.max(0, Math.min(100 - drag.origH, drag.origY + dyPct)),
      });
    } else if (drag.mode === 'resize') {
      updateOverlay(drag.id, {
        widthPct: Math.max(5, Math.min(100 - drag.origX, drag.origW + dxPct)),
        heightPct: Math.max(3, Math.min(100 - drag.origY, drag.origH + dyPct)),
      });
    } else if (drag.mode === 'rotate') {
      updateOverlay(drag.id, {
        rotation: Math.round(drag.origRotation + dxPct * 3.6) % 360,
      });
    }
  };

  const handlePointerUp = () => {
    dragStartRef.current = null;
  };

  return (
    <div className="fixed inset-0 z-[60] bg-parchment-100 flex flex-col">
      {/* Header */}
      <header className="shrink-0 h-14 border-b border-parchment-200 bg-white flex items-center gap-3 px-4">
        <h3 className="font-display font-semibold text-ink-500">Éditeur de couverture</h3>
        <span className="text-xs text-ink-300 hidden md:inline">
          {dims.totalWidthMm} × {dims.totalHeightMm} mm · Dos ~{dims.spineWidthMm} mm
        </span>
        <div className="flex-1" />
        <button
          onClick={addOverlay}
          className="btn-secondary text-sm flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" /> Ajouter un texte
        </button>
        <button
          onClick={() => {
            if (confirm('Remplacer l\'image de fond ?')) onReplaceImage();
          }}
          className="btn-ghost text-sm flex items-center gap-1.5"
        >
          <Upload className="w-4 h-4" /> Changer l'image
        </button>
        <button
          onClick={onClose}
          className="p-2 rounded hover:bg-parchment-100 text-ink-400"
          title="Fermer (Échap)"
        >
          <X className="w-5 h-5" />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Canvas area */}
        <div
          ref={canvasAreaRef}
          className="flex-1 overflow-auto flex items-center justify-center p-4 bg-[radial-gradient(circle,rgba(0,0,0,0.04)_1px,transparent_1px)] bg-[length:16px_16px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          <div
            ref={canvasRef}
            className="relative bg-parchment-100 rounded-lg overflow-hidden shadow-xl"
            style={{ width: canvasW, height: canvasH }}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={(e) => {
              if (e.target === e.currentTarget) setSelectedId(null);
            }}
          >
            {/* Background image */}
            <img
              src={flatImage}
              alt="Couverture dépliée"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none"
              draggable={false}
            />

            {/* Guides overlay */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox={`0 0 ${canvasW} ${canvasH}`}
            >
              <rect
                x={dims.bleedMm * scale}
                y={dims.bleedMm * scale}
                width={(dims.totalWidthMm - 2 * dims.bleedMm) * scale}
                height={(dims.totalHeightMm - 2 * dims.bleedMm) * scale}
                fill="none" stroke="#e53e3e" strokeWidth={0.8}
              />
              <line
                x1={(dims.bleedMm + dims.backWidthMm) * scale}
                x2={(dims.bleedMm + dims.backWidthMm) * scale}
                y1={0} y2={canvasH}
                stroke="#3b82f6" strokeWidth={0.6} strokeDasharray="3 2"
              />
              <line
                x1={(dims.bleedMm + dims.backWidthMm + dims.spineWidthMm) * scale}
                x2={(dims.bleedMm + dims.backWidthMm + dims.spineWidthMm) * scale}
                y1={0} y2={canvasH}
                stroke="#3b82f6" strokeWidth={0.6} strokeDasharray="3 2"
              />
            </svg>

            {/* Overlays.
                fontSize is stored in "CSS px at 96 DPI reference" (1 px ≈ 0.2646 mm).
                Scale to the editor canvas so the text looks proportional to the
                real cover regardless of window size. */}
            {overlays.map((o) => {
              const isSelected = o.id === selectedId;
              const left = (o.xPct / 100) * canvasW;
              const top = (o.yPct / 100) * canvasH;
              const width = (o.widthPct / 100) * canvasW;
              const height = (o.heightPct / 100) * canvasH;
              const scaledFontSize = o.fontSize * (canvasW / dims.totalWidthMm) * 0.2646;
              return (
                <div
                  key={o.id}
                  data-overlay-id={o.id}
                  onPointerDown={(e) => handlePointerDown(e, o, 'move')}
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width,
                    height,
                    transform: `rotate(${o.rotation}deg)`,
                    transformOrigin: 'center',
                    cursor: 'move',
                    outline: isSelected ? '2px dashed #7a1b3a' : 'none',
                    outlineOffset: isSelected ? 2 : 0,
                    userSelect: 'none',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: o.textAlign === 'left' ? 'flex-start'
                        : o.textAlign === 'right' ? 'flex-end' : 'center',
                      fontFamily: FONT_STACKS[o.fontFamily as keyof typeof FONT_STACKS] ?? o.fontFamily,
                      fontSize: `${scaledFontSize}px`,
                      fontWeight: o.fontWeight,
                      fontStyle: o.fontStyle,
                      color: o.color,
                      textAlign: o.textAlign,
                      lineHeight: 1.1,
                      overflow: 'hidden',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {o.content || '—'}
                  </div>
                  {isSelected && (
                    <>
                      <div
                        onPointerDown={(e) => handlePointerDown(e, o, 'resize')}
                        style={{
                          position: 'absolute',
                          bottom: -6, right: -6,
                          width: 14, height: 14,
                          background: '#7a1b3a',
                          border: '2px solid white',
                          borderRadius: 2,
                          cursor: 'nwse-resize',
                        }}
                      />
                      <div
                        onPointerDown={(e) => handlePointerDown(e, o, 'rotate')}
                        style={{
                          position: 'absolute',
                          top: -24, left: '50%',
                          transform: 'translateX(-50%)',
                          width: 14, height: 14,
                          background: '#3b82f6',
                          border: '2px solid white',
                          borderRadius: '50%',
                          cursor: 'grab',
                        }}
                        title="Faire pivoter"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Side panel */}
        <aside className="w-80 shrink-0 border-l border-parchment-200 bg-white overflow-y-auto">
          <div className="p-4">
            {selected ? (
              <OverlayProperties
                overlay={selected}
                onChange={(data) => updateOverlay(selected.id, data)}
                onDelete={() => deleteOverlay(selected.id)}
                onMoveUp={() => moveOverlay(selected.id, 'up')}
                onMoveDown={() => moveOverlay(selected.id, 'down')}
              />
            ) : (
              <>
                <h4 className="font-display font-semibold text-ink-500 text-sm mb-2">Éléments</h4>
                {overlays.length === 0 ? (
                  <p className="text-xs text-ink-300 italic">
                    Aucun texte pour l'instant. Cliquez sur « Ajouter un texte ».
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {overlays.map((o) => (
                      <li key={o.id}>
                        <button
                          onClick={() => setSelectedId(o.id)}
                          className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-parchment-100 transition-colors text-ink-400 truncate"
                        >
                          {o.content || '—'}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-4 text-[11px] text-ink-200 italic leading-relaxed">
                  Cliquez + glissez pour déplacer · poignée rose : redim. · poignée bleue : rotation · Suppr. pour supprimer · Échap pour fermer
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

// ─── Overlay property panel ───

function OverlayProperties({
  overlay, onChange, onDelete, onMoveUp, onMoveDown,
}: {
  overlay: CoverTextOverlay;
  onChange: (data: Partial<CoverTextOverlay>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-display font-semibold text-ink-500 text-sm">Texte</h4>
        <div className="flex items-center gap-1">
          <button onClick={onMoveUp} className="p-1 rounded hover:bg-parchment-100" title="Monter">
            <MoveUp className="w-3.5 h-3.5 text-ink-300" />
          </button>
          <button onClick={onMoveDown} className="p-1 rounded hover:bg-parchment-100" title="Descendre">
            <MoveDown className="w-3.5 h-3.5 text-ink-300" />
          </button>
          <button onClick={onDelete} className="p-1 rounded hover:bg-red-50" title="Supprimer (Suppr.)">
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-medium text-ink-300 uppercase">Contenu</label>
        <textarea
          value={overlay.content}
          onChange={(e) => onChange({ content: e.target.value })}
          className="textarea-field text-sm min-h-[60px] mt-1"
        />
      </div>

      <div>
        <label className="text-[11px] font-medium text-ink-300 uppercase">Police</label>
        <select
          value={overlay.fontFamily}
          onChange={(e) => onChange({ fontFamily: e.target.value as CoverTextOverlay['fontFamily'] })}
          className="input-field text-sm mt-1"
        >
          {FONT_CHOICES.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-medium text-ink-300 uppercase">Taille (px)</label>
          <input
            type="number"
            min={6}
            max={200}
            value={overlay.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            className="input-field text-sm mt-1"
          />
        </div>
        <div>
          <label className="text-[11px] font-medium text-ink-300 uppercase">Couleur</label>
          <input
            type="color"
            value={overlay.color}
            onChange={(e) => onChange({ color: e.target.value })}
            className="w-full h-9 mt-1 rounded cursor-pointer border border-parchment-300"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange({ fontWeight: overlay.fontWeight === 'bold' ? 'normal' : 'bold' })}
          className={`p-1.5 rounded ${overlay.fontWeight === 'bold' ? 'bg-bordeaux-100 text-bordeaux-600' : 'hover:bg-parchment-100 text-ink-400'}`}
          title="Gras"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => onChange({ fontStyle: overlay.fontStyle === 'italic' ? 'normal' : 'italic' })}
          className={`p-1.5 rounded ${overlay.fontStyle === 'italic' ? 'bg-bordeaux-100 text-bordeaux-600' : 'hover:bg-parchment-100 text-ink-400'}`}
          title="Italique"
        >
          <Italic className="w-4 h-4" />
        </button>
        <span className="mx-1 w-px h-5 bg-parchment-300" />
        {(['left', 'center', 'right'] as const).map((a) => {
          const Icon = a === 'left' ? AlignLeft : a === 'right' ? AlignRight : AlignCenter;
          return (
            <button
              key={a}
              onClick={() => onChange({ textAlign: a })}
              className={`p-1.5 rounded ${overlay.textAlign === a ? 'bg-bordeaux-100 text-bordeaux-600' : 'hover:bg-parchment-100 text-ink-400'}`}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      <div>
        <label className="text-[11px] font-medium text-ink-300 uppercase">Rotation</label>
        <input
          type="number"
          value={overlay.rotation}
          onChange={(e) => onChange({ rotation: Number(e.target.value) })}
          step={15}
          className="input-field text-sm mt-1"
        />
      </div>
    </div>
  );
}
