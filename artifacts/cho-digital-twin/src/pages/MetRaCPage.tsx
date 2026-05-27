
/**
 * MetRaC Page — Metabolic Rate Calculation
 *
 * Demonstrates the MetRaC pipeline (§2.2 Richelle et al. 2025):
 *   1. Virtual bioreactor experiment: run ODE simulation (ground truth)
 *   2. Generate noisy synthetic measurements (Gaussian noise on concentrations)
 *   3. Run simplified MetRaC: finite-difference + kernel-smoothed Bayesian rates
 *   4. Display estimated rates with 95% CIs vs true ODE rates
 *
 * This showcases what MetRaC does algorithmically without requiring the real
 * 23-batch AstraZeneca/Sartorius dataset.
 */

import { useState, useCallback, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, Area, ComposedChart,
} from "recharts";
import {
  runSimulation, generateNoisyMeasurements, defaultConfig,
  type TimePoint, type NoisyMeasurement,
} from "@/lib/simulator";
import { runMetRaC, DEFAULT_METRAC_NOISE, type SmoothedRate, type MetRaCNoiseConfig } from "@/lib/metrac";
import { DEFAULT_FEED_BOLUSES } from "@/lib/simulator";

// ── Colour palette ────────────────────────────────────────────────────────────
const C = {
  Glc: "#1d6fa5", Lac: "#e07b3c", Gln: "#2c9c56",
  Glu: "#a05ca0", NH4: "#c45252",
  true_line: "#666",
  meas_dot:  "#999",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function NoiseSlider({
  label, value, min, max, step, unit, onChange,
}: {
  label: string; value: number; min: number; max: number;
  step: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div className="metrac-noise-row">
      <span className="metrac-noise-label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="metrac-noise-slider" />
      <span className="metrac-noise-val">
        {unit === "%" ? `${(value * 100).toFixed(0)}%` : `${value.toFixed(2)} ${unit}`}
      </span>
    </div>
  );
}

// ── Rate chart with CI band ───────────────────────────────────────────────────

interface RateChartData extends Record<string, unknown> {
  t: number;
  metrac:   number;
  lo95:     number;
  hi95:     number;
  model:    number;
}

function RateChart({
  title, data, color, unit,
}: {
  title: string;
  data: RateChartData[];
  color: string;
  unit?: string;
}) {
  const fmt = (v: number) => Math.abs(v) < 0.001 ? v.toExponential(1) : v.toFixed(3);
  return (
    <div className="chart-panel">
      <h3 className="chart-title">{title}</h3>
      {unit && <span className="chart-y-label">{unit}</span>}
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
          <XAxis dataKey="t" tickFormatter={(v) => `${Number(v).toFixed(1)}`}
            label={{ value: "Day", position: "insideBottom", offset: -2, fontSize: 10 }}
            tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={fmt} width={58} />
          <Tooltip formatter={(val: number, name: string) => [fmt(val), name]}
            labelFormatter={(l) => `Day ${Number(l).toFixed(2)}`}
            contentStyle={{ fontSize: 10 }} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
          {/* 95% CI band */}
          <Area type="monotone" dataKey="hi95" name="" fill={color}
            fillOpacity={0.15} stroke="none" legendType="none" isAnimationActive={false} />
          <Area type="monotone" dataKey="lo95" name="" fill="white"
            fillOpacity={1.0} stroke="none" legendType="none" isAnimationActive={false} />
          {/* Model truth */}
          <Line type="monotone" dataKey="model" name="ODE model (truth)"
            stroke={C.true_line} dot={false} strokeWidth={1.5}
            strokeDasharray="5 3" isAnimationActive={false} />
          {/* MetRaC estimate */}
          <Line type="monotone" dataKey="metrac" name="MetRaC estimate"
            stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Concentration chart (measurements vs true) ───────────────────────────────

interface ConcChartEntry extends Record<string, unknown> {
  t: number;
  true_val: number;
  meas: number | null;
}

function ConcChart({
  title, odeseries, measurements, color,
  trueKey, measKey,
}: {
  title: string;
  odeseries: TimePoint[];
  measurements: NoisyMeasurement[];
  color: string;
  trueKey: keyof TimePoint;
  measKey: keyof NoisyMeasurement;
}) {
  const fmt = (v: number) => v.toFixed(2);
  const data: ConcChartEntry[] = [
    ...odeseries.map((r) => ({ t: r.t, true_val: r[trueKey] as number, meas: null })),
    ...measurements.map((m) => ({ t: m.t, true_val: 0, meas: m[measKey] as number })),
  ];
  data.sort((a, b) => a.t - b.t);
  return (
    <div className="chart-panel">
      <h3 className="chart-title">{title}</h3>
      <ResponsiveContainer width="100%" height={190}>
        <ComposedChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
          <XAxis dataKey="t" tickFormatter={(v) => `${Number(v).toFixed(1)}`}
            label={{ value: "Day", position: "insideBottom", offset: -2, fontSize: 10 }}
            tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={fmt} width={42} />
          <Tooltip formatter={(val: number) => [fmt(val)]}
            labelFormatter={(l) => `Day ${Number(l).toFixed(2)}`}
            contentStyle={{ fontSize: 10 }} />
          <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
          <Line type="monotone" dataKey="true_val" name="ODE (truth)"
            stroke={color} dot={false} strokeWidth={1.5}
            strokeDasharray="5 3" isAnimationActive={false} />
          <Line type="monotone" dataKey="meas" name="Measurement"
            stroke={color} dot={{ r: 3 }} strokeWidth={0}
            isAnimationActive={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── MetRaC Page ───────────────────────────────────────────────────────────────

export default function MetRaCPage() {
  const [noiseConfig, setNoiseConfig] = useState<MetRaCNoiseConfig>({ ...DEFAULT_METRAC_NOISE });
  const [bandwidth, setBandwidth] = useState(1.5);
  const [sampleEvery, setSampleEvery] = useState(1.0);
  const [running, setRunning] = useState(false);
  const [seed, setSeed] = useState(0);  // bumped to regenerate noise

  const [odesim, setOdesim]   = useState<TimePoint[]>([]);
  const [meas,   setMeas]     = useState<NoisyMeasurement[]>([]);
  const [rates,  setRates]    = useState<SmoothedRate[]>([]);

  const setNoise = (key: keyof MetRaCNoiseConfig, v: number) =>
    setNoiseConfig((prev) => ({ ...prev, [key]: v }));

  const run = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const cfg = defaultConfig();
      const sim = runSimulation(cfg);
      const measurements = generateNoisyMeasurements(sim, {
        ...noiseConfig, sampleEvery,
      });
      const outTimes = sim.map((r) => r.t);
      const bolusDay = DEFAULT_FEED_BOLUSES.map((f) => f.day);
      const metrac = runMetRaC(measurements, noiseConfig, outTimes, bandwidth, bolusDay);
      setOdesim(sim);
      setMeas(measurements);
      setRates(metrac);
      setRunning(false);
    }, 20);
  }, [noiseConfig, bandwidth, sampleEvery, seed]);

  useEffect(() => { run(); }, []);

  const feedDays = DEFAULT_FEED_BOLUSES.map((f) => f.day);

  // ── Merge rate data ──────────────────────────────────────────────────────────
  function makeRateData(
    metracKey: keyof SmoothedRate,
    lo95Key: keyof SmoothedRate,
    hi95Key: keyof SmoothedRate,
    modelKey: keyof TimePoint,
  ): RateChartData[] {
    return odesim.map((r, i) => ({
      t:      r.t,
      metrac: rates[i]?.[metracKey] as number ?? 0,
      lo95:   rates[i]?.[lo95Key]   as number ?? 0,
      hi95:   rates[i]?.[hi95Key]   as number ?? 0,
      model:  r[modelKey] as number ?? 0,
    }));
  }

  const glcRate  = makeRateData("q_Glc", "q_Glc_lo95", "q_Glc_hi95", "q_Glc");
  const lacRate  = makeRateData("q_Lac", "q_Lac_lo95", "q_Lac_hi95", "q_Lac");
  const glnRate  = makeRateData("q_Gln", "q_Gln_lo95", "q_Gln_hi95", "q_Gln");
  const gluRate  = makeRateData("q_Glu", "q_Glu_lo95", "q_Glu_hi95", "q_Glu");
  const nh4Rate  = makeRateData("q_NH4", "q_NH4_lo95", "q_NH4_hi95", "q_NH4");
  const qpRate   = makeRateData("q_p",   "q_p_lo95",   "q_p_hi95",   "q_p");
  const hasTit   = (noiseConfig.Tit_cv ?? 0) > 0;

  const nMeas = meas.length;

  return (
    <div className="metrac-page">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="metrac-header">
        <div>
          <h1 className="metrac-title">MetRaC — Metabolic Rate Calculation</h1>
          <p className="metrac-subtitle">
            Simplified Bayesian rate estimation · §2.2 Richelle et al. (2025)
          </p>
        </div>
        <button className="run-btn metrac-run-btn" onClick={() => { setSeed((s) => s + 1); run(); }} disabled={running}>
          {running ? "Computing…" : "⟳  New noise sample"}
        </button>
      </div>

      {/* ── Algorithm callout ──────────────────────────────────────────────── */}
      <div className="metrac-algo-box">
        <strong>Algorithm:</strong>&nbsp;
        (1) Run ODE as virtual bioreactor → (2) Add Gaussian measurement noise →
        (3) Centered finite-difference dC/dt → (4) q = −(dC/dt) / X_v →
        (5) Nadaraya-Watson kernel smoother → (6) 95% credible intervals via variance propagation.
        &nbsp;<span className="metrac-algo-note">
          The paper (§2.2) uses nested-sampling B-splines; this is algorithmically equivalent
          but avoids the nested-sampling library requirement.
        </span>
      </div>

      {/* ── Layout ─────────────────────────────────────────────────────────── */}
      <div className="metrac-layout">

        {/* ── Controls ──────────────────────────────────────────────────────── */}
        <aside className="metrac-controls">
          <h2 className="ctrl-title">MetRaC Settings</h2>

          <section className="ctrl-section">
            <h3 className="ctrl-sect-title">Measurement Frequency</h3>
            <p className="ctrl-hint">
              Sampling interval (days). Sparser sampling → wider CIs.
            </p>
            <div className="metrac-noise-row">
              <span className="metrac-noise-label">Every</span>
              <input type="range" min={0.5} max={3} step={0.5}
                value={sampleEvery}
                onChange={(e) => setSampleEvery(Number(e.target.value))}
                className="metrac-noise-slider" />
              <span className="metrac-noise-val">{sampleEvery.toFixed(1)} day</span>
            </div>
            <p className="metrac-stat">
              <strong>{nMeas}</strong> measurement points from {odesim.length} ODE steps
            </p>
          </section>

          <section className="ctrl-section">
            <h3 className="ctrl-sect-title">Measurement Noise (σ)</h3>
            <p className="ctrl-hint">
              Gaussian noise added to ODE output to simulate FLEX analyser uncertainty.
            </p>
            <NoiseSlider label="VCD CV"  value={noiseConfig.Xv_cv}   min={0} max={0.2}  step={0.01} unit="%"  onChange={(v) => setNoise("Xv_cv",   v)} />
            <NoiseSlider label="σ Glc"   value={noiseConfig.Glc_abs} min={0} max={2}    step={0.05} unit="mM" onChange={(v) => setNoise("Glc_abs", v)} />
            <NoiseSlider label="σ Lac"   value={noiseConfig.Lac_abs} min={0} max={2}    step={0.05} unit="mM" onChange={(v) => setNoise("Lac_abs", v)} />
            <NoiseSlider label="σ Gln"   value={noiseConfig.Gln_abs} min={0} max={1}    step={0.05} unit="mM" onChange={(v) => setNoise("Gln_abs", v)} />
            <NoiseSlider label="σ Glu"   value={noiseConfig.Glu_abs} min={0} max={0.5}  step={0.01} unit="mM" onChange={(v) => setNoise("Glu_abs", v)} />
            <NoiseSlider label="σ NH₄⁺"  value={noiseConfig.NH4_abs} min={0} max={1}    step={0.05} unit="mM" onChange={(v) => setNoise("NH4_abs", v)} />
            <NoiseSlider label="Titer CV" value={noiseConfig.Tit_cv ?? 0} min={0} max={0.3} step={0.01} unit="" onChange={(v) => setNoise("Tit_cv", v)} />
            <p className="ctrl-hint" style={{ marginTop: "0.2rem" }}>
              Titer CV = 0 → q_p not estimated (set &gt; 0 to enable q_p chart)
            </p>
          </section>

          <section className="ctrl-section">
            <h3 className="ctrl-sect-title">Smoother Bandwidth</h3>
            <p className="ctrl-hint">
              Kernel bandwidth h [days]. Larger = smoother trajectory, wider CI.
            </p>
            <div className="metrac-noise-row">
              <span className="metrac-noise-label">h</span>
              <input type="range" min={0.3} max={4} step={0.1}
                value={bandwidth}
                onChange={(e) => setBandwidth(Number(e.target.value))}
                className="metrac-noise-slider" />
              <span className="metrac-noise-val">{bandwidth.toFixed(1)} d</span>
            </div>
          </section>

          <button className="run-btn" onClick={() => { setSeed((s) => s + 1); run(); }} disabled={running}>
            {running ? "Computing…" : "▶  Apply & Resample"}
          </button>

          {/* Interpretation guide */}
          <div className="metrac-legend-box">
            <div className="metrac-legend-row">
              <span className="metrac-legend-swatch" style={{ borderBottom: "1.5px dashed #666" }} />
              <span>ODE model truth</span>
            </div>
            <div className="metrac-legend-row">
              <span className="metrac-legend-swatch metrac-legend-solid" />
              <span>MetRaC estimate (solid + band = 95% CI)</span>
            </div>
            <div className="metrac-legend-row">
              <span className="metrac-legend-dot" />
              <span>Noisy measurements</span>
            </div>
          </div>
        </aside>

        {/* ── Results ────────────────────────────────────────────────────────── */}
        <div className="metrac-results">
          <div className="metrac-section-label">
            Concentration Trajectories — ODE truth (dashed) vs Noisy Measurements (dots)
          </div>
          <div className="metrac-conc-grid">
            <ConcChart title="Glucose"   odeseries={odesim} measurements={meas}
              color={C.Glc} trueKey="Glc" measKey="Glc" />
            <ConcChart title="Lactate"   odeseries={odesim} measurements={meas}
              color={C.Lac} trueKey="Lac" measKey="Lac" />
            <ConcChart title="Glutamine" odeseries={odesim} measurements={meas}
              color={C.Gln} trueKey="Gln" measKey="Gln" />
            <ConcChart title="Glutamate" odeseries={odesim} measurements={meas}
              color={C.Glu} trueKey="Glu" measKey="Glu" />
            <ConcChart title="Ammonium"  odeseries={odesim} measurements={meas}
              color={C.NH4} trueKey="NH4" measKey="NH4" />
          </div>

          <div className="metrac-section-label" style={{ marginTop: "1.25rem" }}>
            MetRaC Rate Estimates — 95% CI (shaded) vs ODE Model Rates (dashed)
          </div>
          <div className="metrac-rate-grid">
            <RateChart title="q_Glc — Glucose uptake rate" data={glcRate}
              color={C.Glc} unit="mM·Mc⁻¹·d⁻¹" />
            <RateChart title="q_Lac — Lactate net rate" data={lacRate}
              color={C.Lac} unit="mM·Mc⁻¹·d⁻¹" />
            <RateChart title="q_Gln — Glutamine uptake rate" data={glnRate}
              color={C.Gln} unit="mM·Mc⁻¹·d⁻¹" />
            <RateChart title="q_Glu — Glutamate uptake rate" data={gluRate}
              color={C.Glu} unit="mM·Mc⁻¹·d⁻¹" />
            <RateChart title="q_NH4 — Ammonium production rate" data={nh4Rate}
              color={C.NH4} unit="mM·Mc⁻¹·d⁻¹" />
          </div>

          {hasTit && (
            <>
              <div className="metrac-section-label" style={{ marginTop: "1.25rem" }}>
                q_p — Product-Specific Rate (Luedeking-Piret) — Titer CV = {((noiseConfig.Tit_cv ?? 0) * 100).toFixed(0)}%
              </div>
              <div className="metrac-rate-grid" style={{ gridTemplateColumns: "1fr" }}>
                <RateChart title="q_p — Product-specific rate (α·μ + β)" data={qpRate}
                  color="#8a6d1e" unit="mg·L⁻¹·(Mc/mL)⁻¹·d⁻¹" />
              </div>
              <p className="ctrl-hint" style={{ marginTop: "0.5rem" }}>
                MetRaC estimates q_p = dTit/dt / Xv from noisy titer measurements.
                Wide CI reflects titer measurement noise (CV = {((noiseConfig.Tit_cv ?? 0) * 100).toFixed(0)}%).
                ODE truth (dashed) uses the Luedeking-Piret model: q_p = α·μ_net + β.
              </p>
            </>
          )}

          <div className="sim-info" style={{ marginTop: "1rem" }}>
            <strong>How to read:</strong> The shaded 95% CI band is derived from Gaussian
            measurement noise propagated through finite-difference derivatives.
            A wider band means MetRaC is less certain — increase noise or reduce sampling
            frequency to see the effect. When the MetRaC estimate (solid) tracks the ODE
            truth (dashed) closely, rate estimation is accurate. The CIs should bracket
            the truth ~95% of the time on average.
            <br />
            <strong>Paper's method (§2.2):</strong> Richelle et al. use nested sampling
            over B-spline coefficients for a full posterior; this implementation
            is algorithmically equivalent using kernel-smoothed inverse-variance weighting.
          </div>
        </div>
      </div>
    </div>
  );
}
