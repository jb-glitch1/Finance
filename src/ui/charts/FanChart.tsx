import { useMemo } from "react";
import type { YearBand } from "../../engine/types";
import { linearScale, niceTicks, polyline, areaPath } from "./chartUtils";
import { compactNum } from "../format";

interface Props {
  bands: YearBand[];
  height?: number;
}

const W = 720;

export function FanChart({ bands, height = 300 }: Props) {
  const data = useMemo(() => {
    if (bands.length === 0) return null;
    const ages = bands.map((b) => b.age);
    const lo = Math.min(...bands.map((b) => b.p10));
    const hi = Math.max(...bands.map((b) => b.p90));
    return { ages, lo: Math.min(0, lo), hi };
  }, [bands]);

  if (!data) return <div className="chart-empty">Run a simulation to see the net-worth fan chart</div>;

  const padL = 44;
  const padR = 10;
  const padB = 26;
  const padT = 10;
  const x = linearScale(data.ages[0], data.ages[data.ages.length - 1], padL, W - padR);
  const y = linearScale(data.lo, data.hi, height - padB, padT);

  const outer = bands.map((b) => ({ x: x(b.age), upper: y(b.p90), lower: y(b.p10) }));
  const inner = bands.map((b) => ({ x: x(b.age), upper: y(b.p75), lower: y(b.p25) }));
  const median = bands.map((b) => ({ x: x(b.age), y: y(b.p50) }));

  const yTicks = niceTicks(data.lo, data.hi, 5);
  const xTicks = niceTicks(data.ages[0], data.ages[data.ages.length - 1], 6);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="chart" role="img" aria-label="Net worth fan chart">
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} className="grid-line" />
          <text x={padL - 6} y={y(t) + 3} className="axis-label" textAnchor="end">
            {compactNum(t)}
          </text>
        </g>
      ))}
      <path d={areaPath(outer)} className="fan-outer" />
      <path d={areaPath(inner)} className="fan-inner" />
      <polyline points={polyline(median)} className="fan-median" fill="none" />
      {xTicks.map((t, i) => (
        <text key={i} x={x(t)} y={height - 8} className="axis-label" textAnchor="middle">
          age {t}
        </text>
      ))}
    </svg>
  );
}
