/**
 * Horizontal ruler in cm/mm. Used above a page rendered at its actual
 * physical size to help the user verify text legibility before printing.
 */
interface Props {
  widthMm: number;
  /** CSS pixels at which the ruler is displayed. Should match the associated page width. */
  widthPx: number;
  color?: string;
}

export function PageRuler({ widthMm, widthPx, color = '#555' }: Props) {
  const heightPx = 22;
  const cmCount = Math.floor(widthMm / 10);
  const tickEveryMm = 1;
  const mmToPx = widthPx / widthMm;

  const ticks: React.ReactNode[] = [];
  for (let mm = 0; mm <= widthMm; mm += tickEveryMm) {
    const x = mm * mmToPx;
    const isCm = mm % 10 === 0;
    const isHalfCm = mm % 5 === 0;
    const tickHeight = isCm ? 10 : isHalfCm ? 6 : 3;
    ticks.push(
      <line
        key={mm}
        x1={x}
        x2={x}
        y1={heightPx - tickHeight}
        y2={heightPx}
        stroke={color}
        strokeWidth={isCm ? 1 : 0.5}
      />,
    );
  }

  const labels: React.ReactNode[] = [];
  for (let cm = 0; cm <= cmCount; cm++) {
    const x = cm * 10 * mmToPx;
    labels.push(
      <text
        key={cm}
        x={x}
        y={heightPx - 13}
        textAnchor={cm === 0 ? 'start' : 'middle'}
        fontSize="9"
        fill={color}
        fontFamily="system-ui, sans-serif"
      >
        {cm}
      </text>,
    );
  }

  return (
    <div style={{ width: widthPx }}>
      <svg
        width={widthPx}
        height={heightPx}
        style={{ display: 'block' }}
        viewBox={`0 0 ${widthPx} ${heightPx}`}
      >
        {/* Baseline */}
        <line x1={0} x2={widthPx} y1={heightPx} y2={heightPx} stroke={color} strokeWidth={0.5} />
        {ticks}
        {labels}
        {/* cm label on the left */}
        <text
          x={-2}
          y={heightPx - 13}
          textAnchor="end"
          fontSize="7"
          fill={color}
          fontFamily="system-ui, sans-serif"
        >
          cm
        </text>
      </svg>
    </div>
  );
}
