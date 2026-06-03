// Small shared helpers for the hand-rolled SVG charts.

export interface Scale {
  (v: number): number;
}

export function linearScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number): Scale {
  const d = domainMax - domainMin || 1;
  return (v: number) => rangeMin + ((v - domainMin) / d) * (rangeMax - rangeMin);
}

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const range = max - min;
  const rawStep = range / count;
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const norm = rawStep / mag;
  let step: number;
  if (norm < 1.5) step = 1;
  else if (norm < 3) step = 2;
  else if (norm < 7) step = 5;
  else step = 10;
  step *= mag;
  const start = Math.ceil(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + 1e-9; t += step) ticks.push(Math.round(t / step) * step);
  return ticks;
}

export function polyline(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

export function areaPath(
  pts: { x: number; upper: number; lower: number }[],
): string {
  if (pts.length === 0) return "";
  const top = pts.map((p) => `${p.x.toFixed(1)},${p.upper.toFixed(1)}`);
  const bottom = [...pts].reverse().map((p) => `${p.x.toFixed(1)},${p.lower.toFixed(1)}`);
  return `M${top.join(" L")} L${bottom.join(" L")} Z`;
}
