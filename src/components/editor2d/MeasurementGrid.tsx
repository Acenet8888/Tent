type MeasurementGridProps = {
  width: number;
  height: number;
  scale: number; // px per mm
  offsetX: number;
  offsetY: number;
  minorSpacingMm?: number;
  majorEvery?: number;
};

/**
 * Background grid for the floor plan. Spacing is defined in millimetres and
 * converted to screen pixels via the current pan/zoom transform, so the
 * grid always represents a fixed physical distance regardless of zoom
 * level.
 */
export function MeasurementGrid({
  width,
  height,
  scale,
  offsetX,
  offsetY,
  minorSpacingMm = 100,
  majorEvery = 5,
}: MeasurementGridProps) {
  const minorSpacingPx = minorSpacingMm * scale;
  if (minorSpacingPx < 4) return null;

  const startX = Math.floor(-offsetX / minorSpacingPx) * minorSpacingPx + offsetX;
  const startY = Math.floor(-offsetY / minorSpacingPx) * minorSpacingPx + offsetY;

  const verticalLines: number[] = [];
  for (let x = startX; x < width; x += minorSpacingPx) verticalLines.push(x);

  const horizontalLines: number[] = [];
  for (let y = startY; y < height; y += minorSpacingPx) horizontalLines.push(y);

  const indexOf = (v: number, start: number) => Math.round((v - start) / minorSpacingPx);

  return (
    <g pointerEvents="none">
      {verticalLines.map((x, i) => {
        const isMajor = indexOf(x, startX) % majorEvery === 0;
        return (
          <line
            key={`v-${i}`}
            x1={x}
            y1={0}
            x2={x}
            y2={height}
            stroke={isMajor ? "#b7bec9" : "#e2e6eb"}
            strokeWidth={isMajor ? 1 : 0.5}
          />
        );
      })}
      {horizontalLines.map((y, i) => {
        const isMajor = indexOf(y, startY) % majorEvery === 0;
        return (
          <line
            key={`h-${i}`}
            x1={0}
            y1={y}
            x2={width}
            y2={y}
            stroke={isMajor ? "#b7bec9" : "#e2e6eb"}
            strokeWidth={isMajor ? 1 : 0.5}
          />
        );
      })}
      {/* Origin axes */}
      <line x1={offsetX} y1={0} x2={offsetX} y2={height} stroke="#94a3b8" strokeWidth={1.25} />
      <line x1={0} y1={offsetY} x2={width} y2={offsetY} stroke="#94a3b8" strokeWidth={1.25} />
    </g>
  );
}
