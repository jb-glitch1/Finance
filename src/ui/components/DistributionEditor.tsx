import type { DistributionSpec } from "../../engine/distributions";
import { theoreticalMean, theoreticalVariance, describeDistribution } from "../../engine/distributions";
import { currency } from "../format";

interface Props {
  value: DistributionSpec;
  onChange: (spec: DistributionSpec) => void;
  /** Whether values represent dollars (show $ helper) vs raw numbers (returns). */
  money?: boolean;
  compact?: boolean;
}

const KINDS: DistributionSpec["kind"][] = ["fixed", "normal", "lognormal", "uniform", "triangular", "pert", "studentT", "discrete"];

function defaultFor(kind: DistributionSpec["kind"], prev: DistributionSpec): DistributionSpec {
  const m = theoreticalMean(prev) ?? 0;
  switch (kind) {
    case "fixed":
      return { kind, value: m };
    case "normal":
      return { kind, mean: m, sd: Math.abs(m) * 0.1 || 1 };
    case "lognormal":
      return { kind, mean: Math.log(Math.abs(m) || 1), sd: 0.3 };
    case "uniform":
      return { kind, min: m * 0.8, max: m * 1.2 };
    case "triangular":
      return { kind, min: m * 0.8, mode: m, max: m * 1.3 };
    case "pert":
      return { kind, min: m * 0.8, mode: m, max: m * 1.3 };
    case "studentT":
      return { kind, mean: m, sd: Math.abs(m) * 0.1 || 1, nu: 5 };
    case "discrete":
      return { kind, values: [m * 0.5, m, m * 1.5], weights: [1, 2, 1] };
  }
}

function Num({ label, value, onChange, step }: { label: string; value: number; onChange: (n: number) => void; step?: number }) {
  return (
    <label className="dist-field">
      <span>{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : 0}
        step={step ?? "any"}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

export function DistributionEditor({ value, onChange, money, compact }: Props) {
  const mean = theoreticalMean(value);
  const variance = theoreticalVariance(value);
  const sd = variance != null && Number.isFinite(variance) ? Math.sqrt(variance) : undefined;

  return (
    <div className={`dist-editor${compact ? " compact" : ""}`}>
      <div className="dist-row">
        <select value={value.kind} onChange={(e) => onChange(defaultFor(e.target.value as DistributionSpec["kind"], value))}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        {value.kind === "fixed" && <Num label="value" value={value.value} onChange={(n) => onChange({ ...value, value: n })} />}
        {value.kind === "normal" && (
          <>
            <Num label="mean" value={value.mean} onChange={(n) => onChange({ ...value, mean: n })} />
            <Num label="sd" value={value.sd} onChange={(n) => onChange({ ...value, sd: n })} />
          </>
        )}
        {value.kind === "lognormal" && (
          <>
            <Num label="μ(log)" value={value.mean} onChange={(n) => onChange({ ...value, mean: n })} />
            <Num label="σ(log)" value={value.sd} onChange={(n) => onChange({ ...value, sd: n })} />
          </>
        )}
        {value.kind === "uniform" && (
          <>
            <Num label="min" value={value.min} onChange={(n) => onChange({ ...value, min: n })} />
            <Num label="max" value={value.max} onChange={(n) => onChange({ ...value, max: n })} />
          </>
        )}
        {(value.kind === "triangular" || value.kind === "pert") && (
          <>
            <Num label="min" value={value.min} onChange={(n) => onChange({ ...value, min: n })} />
            <Num label="mode" value={value.mode} onChange={(n) => onChange({ ...value, mode: n })} />
            <Num label="max" value={value.max} onChange={(n) => onChange({ ...value, max: n })} />
          </>
        )}
        {value.kind === "studentT" && (
          <>
            <Num label="mean" value={value.mean} onChange={(n) => onChange({ ...value, mean: n })} />
            <Num label="sd" value={value.sd} onChange={(n) => onChange({ ...value, sd: n })} />
            <Num label="ν" value={value.nu} step={1} onChange={(n) => onChange({ ...value, nu: Math.max(1, n) })} />
          </>
        )}
        {value.kind === "discrete" && (
          <input
            className="dist-discrete"
            value={value.values.join(", ")}
            onChange={(e) => {
              const values = e.target.value.split(",").map((s) => parseFloat(s.trim())).filter((n) => Number.isFinite(n));
              onChange({ ...value, values });
            }}
          />
        )}
      </div>
      {!compact && (
        <div className="dist-summary" title={describeDistribution(value)}>
          mean {money && mean != null ? currency(mean) : mean?.toFixed(3) ?? "—"}
          {sd != null && ` · sd ${money ? currency(sd) : sd.toFixed(3)}`}
        </div>
      )}
    </div>
  );
}
