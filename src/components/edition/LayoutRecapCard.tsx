import { Type, ExternalLink } from 'lucide-react';
import { useBookStore } from '@/store/useBookStore';
import { FONT_STACKS, DEFAULT_LAYOUT } from '@/lib/fonts';
import { useNavigate } from 'react-router-dom';

export function LayoutRecapCard() {
  const navigate = useNavigate();
  const layout = useBookStore((s) => s.layout);

  const fontFamily = layout?.fontFamily ?? DEFAULT_LAYOUT.fontFamily;
  const fontSize = layout?.fontSize ?? DEFAULT_LAYOUT.fontSize;
  const lineHeight = layout?.lineHeight ?? DEFAULT_LAYOUT.lineHeight;
  const fontStack = FONT_STACKS[fontFamily];

  return (
    <div className="card-fantasy p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Type className="w-5 h-5 text-bordeaux-400" />
          <h3 className="font-display text-lg font-semibold text-ink-500">Mise en page</h3>
        </div>
        <button
          onClick={() => navigate('/edition/layout')}
          className="text-xs text-bordeaux-400 hover:text-bordeaux-600 flex items-center gap-1 transition-colors"
        >
          Modifier
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div>
          <p className="text-xs text-ink-300 mb-1">Police</p>
          <p className="text-sm font-medium text-ink-500">{fontFamily}</p>
        </div>
        <div>
          <p className="text-xs text-ink-300 mb-1">Taille</p>
          <p className="text-sm font-medium text-ink-500">{fontSize} pt</p>
        </div>
        <div>
          <p className="text-xs text-ink-300 mb-1">Interligne</p>
          <p className="text-sm font-medium text-ink-500">{lineHeight}</p>
        </div>
      </div>

      <div
        className="p-3 rounded-lg border border-parchment-200 bg-white text-ink-400"
        style={{
          fontFamily: fontStack,
          fontSize: `${fontSize}pt`,
          lineHeight,
        }}
      >
        Il était une fois, dans un royaume lointain, un écrivain qui rêvait de voir son livre prendre forme entre ses mains.
      </div>
    </div>
  );
}
