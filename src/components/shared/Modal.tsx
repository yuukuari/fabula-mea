import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max width class (default: max-w-lg) */
  maxWidth?: string;
  /** If true, clicking the backdrop will not close the modal */
  persistent?: boolean;
}

export function Modal({ open, onClose, children, maxWidth = 'max-w-lg', persistent = false }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !persistent) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose, persistent]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-black/40"
        onClick={persistent ? undefined : onClose}
      />
      <div className={`relative bg-white rounded-xl shadow-xl p-6 ${maxWidth} w-full mx-4 max-h-[90vh] overflow-y-auto`}>
        {children}
      </div>
    </div>
  );
}
