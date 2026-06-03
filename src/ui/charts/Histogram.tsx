import { useMemo } from "react";
import { histogram, kde } from "../../engine/stats";
import { linearScale, niceTicks, polyline } from "./chartUtils";
import { compactNum } from "../format";

interface Props {
  values: number[];
  bins?: number;
  markers?: { label: string; value: number; color?: string }[];
  height?: number;
}

const W = 720;

export function Histogram({ values, bins = 40, markers = [], height = 280 }: Props) {
  const data = useMemo(() => {
    const bars = histogram(values, bins);
    const density = kde(values, 140);
    const xMin = bars.length ? bars[0].x0 : 0;
    const xMax = bars.length ? bars[bars.length - 1].x1 : 1;
    const yMax = Math.max(
      ...bars.map((b) => b.density),
      ...density.map((d) => d.y),
      1e-9,
    );
    return { bars, density, xMin, xMax, yMax };
  }, [values, bins]);

  if (values.length === 0) return <div className="chart-empty">No data</div>;

  const padL = 8;
  const padR = 8;
  const padB = 28;
  const padT = 10;
  const x = linearScale(data.xMin, data.xMax, padL, W - padR);
  const y = linearScale(0, data.yMax, height - padB, padT);
  const ticks = niceTicks(data.xMin, data.xMax, 6);
  const curve = data.density.map((d) => ({ x: x(d.x), y: y(d.y) }));

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="chart" role="img" aria-label="Outcome distribution histogram">
      {data.bars.map((b, i) => {
        const bx = x(b.x0);
        const bw = Math.max(0.5, x(b.x1) - x(b.x0) - 1);
        const by = y(b.density);
        return <rect key={i} x={bx} y={by} width={bw} height={height - padB - by} className="hist-bar" />;
      })}
      <polyline points={polyline(curve)} className="hist-density" fill="none" />
      {markers.map((m, i) => {
        const mx = x(m.value);
        return (
          <g key={i}>
            <line x1={mx} x2={mx} y1={padT} y2={height - padB} stroke={m.color ?? "#f59e0b"} strokeDasharray="4 3" strokeWidth={1.5} />
            <text x={mx} y={padT + 10 + i * 12} className="hist-marker-label" fill={m.color ?? "#f59e0b"}>
              {m.label}
            </text>
          </g>
        );
      })}
      {ticks.map((t, i) => (
        <text key={i} x={x(t)} y={height - 10} className="axis-label" textAnchor="middle">
          {compactNum(t)}
        </text>
      ))}
    </svg>
  );
}
