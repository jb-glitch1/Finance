import type { TornadoEntry } from "../../engine/sensitivity";
import { linearScale } from "./chartUtils";

interface Props {
  entries: TornadoEntry[];
  format: (v: number) => string;
  height?: number;
}

const W = 720;

export function Tornado({ entries, format, height }: Props) {
  if (entries.length === 0) return <div className="chart-empty">Run sensitivity analysis</div>;
  const rowH = 34;
  const h = height ?? entries.length * rowH + 30;
  const padL = 200;
  const padR = 70;

  const lo = Math.min(...entries.map((e) => Math.min(e.lowOutcome, e.highOutcome, e.baseline)));
  const hi = Math.max(...entries.map((e) => Math.max(e.lowOutcome, e.highOutcome, e.baseline)));
  const x = linearScale(lo, hi, padL, W - padR);
  const baseline = entries[0]?.baseline ?? 0;

  return (
    <svg viewBox={`0 0 ${W} ${h}`} className="chart" role="img" aria-label="Tornado sensitivity chart">
      <line x1={x(baseline)} x2={x(baseline)} y1={10} y2={h - 16} className="tornado-baseline" />
      {entries.map((e, i) => {
        const yTop = 14 + i * rowH;
        const x1 = x(Math.min(e.lowOutcome, e.highOutcome));
        const x2 = x(Math.max(e.lowOutcome, e.highOutcome));
        return (
          <g key={i}>
            <text x={padL - 10} y={yTop + rowH / 2 - 2} className="tornado-label" textAnchor="end">
              {e.name}
            </text>
            <rect x={x1} y={yTop} width={Math.max(2, x2 - x1)} height={rowH - 12} rx={3} className="tornado-bar" />
            <text x={x1 - 4} y={yTop + (rowH - 12) / 2 + 3} className="tornado-end" textAnchor="end">
              {format(Math.min(e.lowOutcome, e.highOutcome))}
            </text>
            <text x={x2 + 4} y={yTop + (rowH - 12) / 2 + 3} className="tornado-end" textAnchor="start">
              {format(Math.max(e.lowOutcome, e.highOutcome))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
