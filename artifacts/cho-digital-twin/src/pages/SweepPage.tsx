
/**
 * Parameter Sweep — run the ODE N times over a parameter range and plot a
 * scalar output metric against the swept parameter.
 */

import { useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { runSimulation, defaultConfig } from "@/lib/simulator";
import { DEFAULT_MODEL_PARAMS, type ModelParams } from "@/lib/parameters";

// ── Sweep-able parameters ──────────────────────────────────────────────────────
interface SweepParam {
  key: keyof ModelParams; label: string; unit: string;
  defaultMin: number; defaultMax: number; defaultSteps: number;
}

const SWEEP_PARAMS: SweepParam[] = [
  { key: "q_p",        label: "q_p (β, non-growth productivity)",  unit: "pg/cell/d", defaultMin: 1,   defaultMax: 60,  defaultSteps: 20 },
  { key: "q_p_growth", label: "q_p,gr (α, growth-assoc.)",         unit: "pg/cell",   defaultMin: 0,   defaultMax: 20,  defaultSteps: 20 },
  { key: "kd0",        label: "k_d⁰ (base death rate)",            unit: "day⁻¹",    defaultMin: 0.005, defaultMax: 0.05, defaultSteps: 18 },
  { key: "kd1",        label: "k_d¹ (biomaterial death)",           unit: "day⁻¹/B", defaultMin: 0,   defaultMax: 0.001, defaultSteps: 20 },
  { key: "q_Gln_max",  label: "q_Gln,max (max Gln uptake)",        unit: "mM/Mc/d",  defaultMin: 0.5, defaultMax: 5,   defaultSteps: 18 },
  { key: "k_Gln_deg",  label: "k_Gln,deg (Gln chemical degradation)", unit: "day⁻¹", defaultMin: 0,   defaultMax: 0.2, defaultSteps: 20 },
  { key: "Y_Glu_Gln",  label: "Y_Glu,Gln (Gln→Glu transamination)", unit: "mol/mol", defaultMin: 0,   defaultMax: 1.0, defaultSteps: 20 },
  { key: "Y_Glc",      label: "Y_Glc (glucose yield coefficient)", unit: "–",        defaultMin: 5,   defaultMax: 30,  defaultSteps: 20 },
  { key: "Ki_Lac",     label: "K_i,Lac (lactate inhibition on Glc uptake)", unit: "mM", defaultMin: 2, defaultMax: 20,  defaultSteps: 18 },
  { key: "Km_Glc",     label: "K_m,Glc (Glc half-saturation)",     unit: "mM",       defaultMin: 5,   defaultMax: 50,  defaultSteps: 18 },
  { key: "B_max",      label: "B_max (biomaterial cap)",            unit: "–",        defaultMin: 50,  defaultMax: 1000, defaultSteps: 20 },
];

// ── Output metrics ─────────────────────────────────────────────────────────────
type MetricKey = "finalTiter" | "peakVCD" | "finalVCD" | "finalGlc" | "finalNH4" | "finalLac";

interface MetricDef { key: MetricKey; label: string; unit: string }

const METRICS: MetricDef[] = [
  { key: "finalTiter", label: "Final Titer",  unit: "mg/L"  },
  { key: "peakVCD",    label: "Peak VCD",     unit: "Mc/mL" },
  { key: "finalVCD",   label: "Final VCD",    unit: "Mc/mL" },
  { key: "finalGlc",   label: "Final Glc",    unit: "mM"    },
  { key: "finalNH4",   label: "Final NH₄⁺",   unit: "mM"    },
  { key: "finalLac",   label: "Final Lac",    unit: "mM"    },
];

function extractMetric(sim: ReturnType<typeof runSimulation>, key: MetricKey): number {
  const last = sim[sim.length - 1];
  switch (key) {
    case "finalTiter": return last.Tit;
    case "finalVCD":   return last.Xv;
    case "finalGlc":   return last.Glc;
    case "finalNH4":   return last.NH4;
    case "finalLac":   return last.Lac;
    case "peakVCD":    return Math.max(...sim.map((r) => r.Xv));
  }
}

// ── Sweep result type ──────────────────────────────────────────────────────────
interface SweepPoint { paramVal: number; metricVal: number }

// ── Main component ─────────────────────────────────────────────────────────────
export default function SweepPage() {
  const [sweepParamIdx, setSweepParamIdx] = useState(0);
  const [metricKey, setMetricKey]         = useState<MetricKey>("finalTiter");
  const [sweepMin,  setSweepMin]          = useState(SWEEP_PARAMS[0].defaultMin);
  const [sweepMax,  setSweepMax]          = useState(SWEEP_PARAMS[0].defaultMax);
  const [sweepN,    setSweepN]            = useState(SWEEP_PARAMS[0].defaultSteps);

  const [running,   setRunning]  = useState(false);
  const [results,   setResults]  = useState<SweepPoint[]>([]);
  const [elapsed,   setElapsed]  = useState<number | null>(null);

  const sp = SWEEP_PARAMS[sweepParamIdx];
  const metric = METRICS.find((m) => m.key === metricKey)!;

  // When param selection changes, update range to defaults
  const handleParamChange = (idx: number) => {
    const p = SWEEP_PARAMS[idx];
    setSweepParamIdx(idx);
    setSweepMin(p.defaultMin);
    setSweepMax(p.defaultMax);
    setSweepN(p.defaultSteps);
  };

  const runSweep = useCallback(() => {
    setRunning(true);
    const t0 = performance.now();
    setTimeout(() => {
      const pts: SweepPoint[] = [];
      const step = sweepN > 1 ? (sweepMax - sweepMin) / (sweepN - 1) : 0;
      for (let i = 0; i < sweepN; i++) {
        const val = sweepMin + step * i;
        const cfg = defaultConfig({
          modelParams: { ...DEFAULT_MODEL_PARAMS, [sp.key]: val },
        });
        try {
          const sim = runSimulation(cfg);
          pts.push({ paramVal: val, metricVal: extractMetric(sim, metricKey) });
        } catch {
          pts.push({ paramVal: val, metricVal: 0 });
        }
      }
      setResults(pts);
      setElapsed(performance.now() - t0);
      setRunning(false);
    }, 20);
  }, [sweepMin, sweepMax, sweepN, sp, metricKey]);

  const defVal = DEFAULT_MODEL_PARAMS[sp.key];
  const defResult = results.find((r) => Math.abs(r.paramVal - defVal) < (sweepMax - sweepMin) / sweepN);

  const fmt = (v: number) => Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(3);

  return (
    <div className="sweep-page">
      <div className="sweep-header">
        <h1 className="sweep-title">Parameter Sensitivity Sweep</h1>
        <p className="sweep-subtitle">
          Hold all other parameters at Table 1 defaults. Run the ODE N times over a parameter range.
        </p>
      </div>

      <div className="sweep-layout">
        {/* ── Controls ──────────────────────────────────────────────────── */}
        <aside className="sweep-controls">
          <section className="ctrl-section">
            <h3 className="ctrl-sect-title">Sweep Parameter</h3>
            <select className="sweep-select"
              value={sweepParamIdx}
              onChange={(e) => handleParamChange(Number(e.target.value))}>
              {SWEEP_PARAMS.map((p, i) => (
                <option key={p.key} value={i}>{p.label}</option>
              ))}
            </select>
            <p className="ctrl-hint" style={{ marginTop: "0.4rem" }}>
              Table 1 default: <strong>{defVal.toPrecision(5)}</strong> {sp.unit}
            </p>
          </section>

          <section className="ctrl-section">
            <h3 className="ctrl-sect-title">Range</h3>
            <div className="sweep-range-row">
              <label>From</label>
              <input type="number" className="sweep-num-input" value={sweepMin}
                onChange={(e) => setSweepMin(+e.target.value)} />
              <span>{sp.unit}</span>
            </div>
            <div className="sweep-range-row">
              <label>To</label>
              <input type="number" className="sweep-num-input" value={sweepMax}
                onChange={(e) => setSweepMax(+e.target.value)} />
              <span>{sp.unit}</span>
            </div>
            <div className="sweep-range-row">
              <label>Steps</label>
              <input type="number" className="sweep-num-input" value={sweepN}
                min={2} max={100}
                onChange={(e) => setSweepN(Math.max(2, Math.min(100, +e.target.value)))} />
            </div>
            <p className="ctrl-hint" style={{ marginTop: "0.3rem" }}>
              {sweepN} simulation runs. Each run: 14 days, RK4 dt = 0.005 d.
            </p>
          </section>

          <section className="ctrl-section">
            <h3 className="ctrl-sect-title">Output Metric</h3>
            <select className="sweep-select" value={metricKey}
              onChange={(e) => setMetricKey(e.target.value as MetricKey)}>
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>{m.label} [{m.unit}]</option>
              ))}
            </select>
          </section>

          <button className="run-btn" style={{ width: "100%", marginTop: "0.5rem" }}
            onClick={runSweep} disabled={running}>
            {running ? `Sweeping… (${sweepN} runs)` : `▶  Run Sweep  (${sweepN} runs)`}
          </button>

          {elapsed !== null && !running && (
            <p className="ctrl-hint" style={{ marginTop: "0.5rem", color: "#2c9c56" }}>
              ✓ Done in {elapsed.toFixed(0)} ms
            </p>
          )}

          {results.length > 0 && !running && (() => {
            const best = results.reduce((a, b) => b.metricVal > a.metricVal ? b : a);
            return (
              <div className="sweep-summary">
                <strong>Optimal:</strong> {sp.label.split(" ")[0]} = {fmt(best.paramVal)} {sp.unit}<br />
                → {metric.label} = {fmt(best.metricVal)} {metric.unit}
              </div>
            );
          })()}
        </aside>

        {/* ── Chart ─────────────────────────────────────────────────────── */}
        <div className="sweep-chart-area">
          {results.length === 0 ? (
            <div className="sweep-empty">
              Configure the sweep and press <strong>Run Sweep</strong> to see results.
            </div>
          ) : (
            <>
              <h2 className="sweep-chart-title">
                {metric.label} [{metric.unit}] vs {sp.label.split("(")[0].trim()} [{sp.unit}]
              </h2>
              <ResponsiveContainer width="100%" height={380}>
                <LineChart data={results} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                  <XAxis dataKey="paramVal"
                    type="number"
                    tickFormatter={fmt}
                    label={{ value: `${sp.label.split("(")[0].trim()} [${sp.unit}]`, position: "insideBottom", offset: -12, fontSize: 12 }}
                    tick={{ fontSize: 11 }} domain={["auto", "auto"]} />
                  <YAxis tickFormatter={fmt}
                    label={{ value: `${metric.label} [${metric.unit}]`, angle: -90, position: "insideLeft", offset: 10, fontSize: 12 }}
                    tick={{ fontSize: 11 }} width={65} />
                  <Tooltip
                    formatter={(val: number) => [`${fmt(val)} ${metric.unit}`, metric.label]}
                    labelFormatter={(l) => `${sp.key} = ${fmt(Number(l))} ${sp.unit}`}
                    contentStyle={{ fontSize: 11 }} />
                  {/* Table 1 default reference line */}
                  <ReferenceLine x={defVal} stroke="#e07b3c" strokeDasharray="5 3"
                    label={{ value: "Table 1 default", position: "top", fontSize: 10, fill: "#e07b3c" }} />
                  <Line type="monotone" dataKey="metricVal" name={metric.label}
                    stroke="#1d6fa5" dot={{ r: 3 }} strokeWidth={2} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>

              {defResult && (
                <p className="sweep-default-note">
                  At Table 1 default ({sp.key} = {fmt(defVal)}):&nbsp;
                  <strong>{metric.label} = {fmt(defResult.metricVal)} {metric.unit}</strong>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
