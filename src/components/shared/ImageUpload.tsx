import { useRef, useState, useCallback } from 'react';
import { Upload, X, Move, Check, Loader2 } from 'lucide-react';
import { uploadImage } from '@/lib/upload';

interface ImageUploadProps {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  className?: string;
  /** Display as a circle (for avatars) */
  round?: boolean;
  /** Vertical offset percentage (0-100) for avatar centering */
  offsetY?: number;
  /** Called when offset changes via drag */
  onOffsetYChange?: (offsetY: number) => void;
}

export function ImageUpload({ value, onChange, className = '', round, offsetY = 50, onOffsetYChange }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const dragStartRef = useRef<{ startY: number; startOffset: number } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxSize = 400;
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) {
            h = (h / w) * maxSize;
            w = maxSize;
          } else {
            w = (w / h) * maxSize;
            h = maxSize;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        // Upload to CDN (in prod) or keep base64 (in dev)
        setIsUploading(true);
        try {
          const url = await uploadImage(dataUrl, round ? 'avatar' : 'image');
          onChange(url);
          onOffsetYChange?.(50);
        } catch {
          // Fallback to base64 on error
          onChange(dataUrl);
          onOffsetYChange?.(50);
        } finally {
          setIsUploading(false);
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const handleClickUpload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    inputRef.current?.click();
  };

  const handleClickRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onChange(undefined);
  };

  // Drag to pan offset (only in crop mode)
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!round || !value || !onOffsetYChange || !isCropping) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = { startY: e.clientY, startOffset: offsetY };
  }, [round, value, offsetY, onOffsetYChange, isCropping]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragStartRef.current || !containerRef.current) return;
    e.preventDefault();
    const containerHeight = containerRef.current.getBoundingClientRect().height;
    const dy = e.clientY - dragStartRef.current.startY;
    const newOffset = Math.max(0, Math.min(100, dragStartRef.current.startOffset + (dy / containerHeight) * 100));
    onOffsetYChange?.(Math.round(newOffset));
  }, [onOffsetYChange]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  if (round) {
    return (
      <div className={`flex flex-col items-center gap-2 ${className}`}>
        {value ? (
          <div className="relative group" ref={containerRef}>
            <div
              className={`w-32 h-32 rounded-full overflow-hidden border-2 border-parchment-300 ${isCropping ? 'cursor-grab active:cursor-grabbing ring-2 ring-bordeaux-400' : ''}`}
              onPointerDown={isCropping ? handlePointerDown : undefined}
              onPointerMove={isCropping ? handlePointerMove : undefined}
              onPointerUp={isCropping ? handlePointerUp : undefined}
              title={isCropping ? 'Glissez pour ajuster le cadrage' : undefined}
              style={isCropping ? { touchAction: 'none' } : undefined}
            >
              <img
                src={value}
                alt=""
                className="w-full h-full object-cover select-none"
                style={{
                  transform: `scale(1.4) translateY(${(50 - offsetY) * 0.6}%)`,
                  WebkitUserDrag: 'none',
                } as React.CSSProperties}
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
              />
            </div>
            {!isCropping && (
              <button
                type="button"
                onClick={handleClickRemove}
                className="absolute top-0 right-0 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center
                           text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {isCropping ? (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full flex items-center gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCropping(false)}
                  className="px-3 py-1 bg-bordeaux-500 text-white rounded-full text-xs font-medium hover:bg-bordeaux-600 transition-colors flex items-center gap-1"
                >
                  <Check className="w-3 h-3" /> Valider
                </button>
              </div>
            ) : (
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 translate-y-full flex items-center gap-1.5 pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={handleClickUpload}
                  className="px-3 py-1 bg-parchment-100 border border-parchment-300 rounded-full text-xs text-ink-400 hover:bg-parchment-200 transition-colors"
                >
                  Changer
                </button>
                {onOffsetYChange && (
                  <button
                    type="button"
                    onClick={() => setIsCropping(true)}
                    className="px-3 py-1 bg-parchment-100 border border-parchment-300 rounded-full text-xs text-ink-400 hover:bg-parchment-200 transition-colors flex items-center gap-1"
                  >
                    <Move className="w-3 h-3" /> Recadrer
                  </button>
                )}
              </div>
            )}
            {isCropping && (
              <div className="absolute inset-0 rounded-full pointer-events-none">
                <div className="w-full h-full rounded-full border-2 border-dashed border-bordeaux-400/40" />
              </div>
            )}
          </div>
        ) : isUploading ? (
          <div className="w-32 h-32 rounded-full border-2 border-parchment-300 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-ink-300 animate-spin" />
          </div>
        ) : (
          <button
            type="button"
            onClick={handleClickUpload}
            className="w-32 h-32 rounded-full border-2 border-dashed border-parchment-300
                       flex flex-col items-center justify-center gap-1 text-ink-200
                       hover:border-gold-400 hover:text-ink-300 transition-colors"
          >
            <Upload className="w-6 h-6" />
            <span className="text-xs">Avatar</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isUploading ? (
        <div className="w-full h-48 border-2 border-parchment-300 rounded-lg flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-ink-300 animate-spin" />
        </div>
      ) : value ? (
        <div className="relative group">
          <img
            src={value}
            alt=""
            className="w-full h-48 object-cover rounded-lg cursor-pointer"
            onClick={handleClickUpload}
            title="Cliquez pour changer l'image"
          />
          <button
            type="button"
            onClick={handleClickRemove}
            className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center
                       text-white opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors pointer-events-none flex items-center justify-center">
            <span className="text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">
              Changer l'image
            </span>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClickUpload}
          className="w-full h-48 border-2 border-dashed border-parchment-300 rounded-lg
                     flex flex-col items-center justify-center gap-2 text-ink-200
                     hover:border-gold-400 hover:text-ink-300 transition-colors"
        >
          <Upload className="w-8 h-8" />
          <span className="text-sm">Ajouter une image</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
