import { linearScale, niceTicks, polyline } from "./chartUtils";

export interface Series {
  points: { x: number; y: number }[];
  color?: string;
  label?: string;
}

interface Props {
  series: Series[];
  height?: number;
  xLabel?: string;
  yLabel?: string;
  formatX?: (v: number) => string;
  formatY?: (v: number) => string;
  target?: { y: number; label: string };
}

const W = 720;

export function LineChart({ series, height = 240, formatX, formatY, target }: Props) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) return <div className="chart-empty">No data</div>;
  const xMin = Math.min(...all.map((p) => p.x));
  const xMax = Math.max(...all.map((p) => p.x));
  let yMin = Math.min(...all.map((p) => p.y));
  let yMax = Math.max(...all.map((p) => p.y));
  if (target) {
    yMin = Math.min(yMin, target.y);
    yMax = Math.max(yMax, target.y);
  }
  if (yMin === yMax) yMax = yMin + 1;

  const padL = 48;
  const padR = 12;
  const padB = 26;
  const padT = 10;
  const x = linearScale(xMin, xMax, padL, W - padR);
  const y = linearScale(yMin, yMax, height - padB, padT);
  const yTicks = niceTicks(yMin, yMax, 5);
  const xTicks = niceTicks(xMin, xMax, 6);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="chart" role="img" aria-label="Line chart">
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="grid-line" />
          <text x={padL - 6} y={y(t) + 3} className="axis-label" textAnchor="end">
            {formatY ? formatY(t) : t}
          </text>
        </g>
      ))}
      {target && (
        <g>
          <line x1={padL} x2={W - padR} y1={y(target.y)} y2={y(target.y)} className="target-line" />
          <text x={W - padR} y={y(target.y) - 4} className="axis-label" textAnchor="end" fill="#f59e0b">
            {target.label}
          </text>
        </g>
      )}
      {series.map((s, i) => (
        <g key={i}>
          <polyline points={polyline(s.points.map((p) => ({ x: x(p.x), y: y(p.y) })))} fill="none" stroke={s.color ?? "#38bdf8"} strokeWidth={2} />
          {s.points.map((p, j) => (
            <circle key={j} cx={x(p.x)} cy={y(p.y)} r={2.4} fill={s.color ?? "#38bdf8"} />
          ))}
        </g>
      ))}
      {xTicks.map((t, i) => (
        <text key={i} x={x(t)} y={height - 8} className="axis-label" textAnchor="middle">
          {formatX ? formatX(t) : t}
        </text>
      ))}
    </svg>
  );
}
