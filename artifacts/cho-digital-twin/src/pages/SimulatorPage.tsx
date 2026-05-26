
import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  runSimulation, defaultConfig, type TimePoint, type FeedBolus, type SimulationConfig,
  DEFAULT_FEED_BOLUSES,
} from "@/lib/simulator";
import { DEFAULT_SIGMOID_COMPONENTS, type SigmoidComponent } from "@/lib/growth-rate";

// ──────────────────────────────────────────────────────────────────────────────
//  Colour palette for charts
// ──────────────────────────────────────────────────────────────────────────────
const COLORS = {
  Xv:  "#1d6fa5",
  Xd:  "#e07b3c",
  Xl:  "#a05ca0",
  mu_net: "#2c9c56",
  mu_eff: "#1d6fa5",
  kd:  "#e07b3c",
  kl:  "#a05ca0",
  Glc: "#1d6fa5",
  Lac: "#e07b3c",
  Gln: "#2c9c56",
  Glu: "#a05ca0",
  NH4: "#c45252",
  Tit: "#8a6d1e",
  B:   "#5a7a5a",
};

// ──────────────────────────────────────────────────────────────────────────────
//  Sub-components
// ──────────────────────────────────────────────────────────────────────────────

interface ChartPanelProps {
  title: string;
  data: TimePoint[];
  lines: { key: keyof TimePoint; name: string; color: string; unit?: string }[];
  feedDays?: number[];
  yLabel?: string;
}

function ChartPanel({ title, data, lines, feedDays, yLabel }: ChartPanelProps) {
  const fmt = (v: number) => {
    if (v === undefined || v === null || isNaN(v)) return "–";
    return v < 0.01 ? v.toExponential(2) : v.toFixed(3);
  };

  return (
    <div className="chart-panel">
      <h3 className="chart-title">{title}</h3>
      {yLabel && <span className="chart-y-label">{yLabel}</span>}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
          <XAxis
            dataKey="t"
            tickFormatter={(v) => `${v.toFixed(1)}`}
            label={{ value: "Time (days)", position: "insideBottom", offset: -2, fontSize: 11 }}
            tick={{ fontSize: 11 }}
          />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} width={60} />
          <Tooltip
            formatter={(val: number, name: string) => [fmt(val), name]}
            labelFormatter={(l: number) => `Day ${Number(l).toFixed(2)}`}
            contentStyle={{ fontSize: 11 }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {feedDays?.map((d) => (
            <ReferenceLine key={d} x={d} stroke="#aaa" strokeDasharray="4 2"
              label={{ value: "↑", position: "top", fontSize: 10, fill: "#888" }} />
          ))}
          {lines.map(({ key, name, color }) => (
            <Line
              key={key as string}
              type="monotone"
              dataKey={key as string}
              name={name}
              stroke={color}
              dot={false}
              strokeWidth={2}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Slider({
  label, value, min, max, step, onChange, unit,
}: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="slider-row">
      <label className="slider-label">{label}</label>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider-input"
      />
      <span className="slider-val">{value.toFixed(2)}{unit ? ` ${unit}` : ""}</span>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
//  Stat cards
// ──────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value, unit, sub }: { label: string; value: string; unit: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value} <span className="stat-unit">{unit}</span></div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
//  Main page
// ──────────────────────────────────────────────────────────────────────────────
export default function SimulatorPage() {
  // Initial conditions
  const [Xv0,  setXv0]  = useState(0.30);
  const [Glc0, setGlc0] = useState(26.0);
  const [Gln0, setGln0] = useState(8.0);
  const [Glu0, setGlu0] = useState(2.0);
  const [Lac0, setLac0] = useState(0.5);
  const [NH40, setNH40] = useState(0.2);

  // Sigmoid components (growth rate baseline)
  const [sigA1, setSigA1] = useState(0.85);
  const [sigC1, setSigC1] = useState(1.5);
  const [sigA2, setSigA2] = useState(-0.95);
  const [sigC2, setSigC2] = useState(7.0);

  // Feeding toggle
  const [feedEnabled, setFeedEnabled] = useState(true);

  const [results, setResults] = useState<TimePoint[]>([]);
  const [running, setRunning] = useState(false);

  const feedDays = DEFAULT_FEED_BOLUSES.map((f) => f.day);

  const runSim = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const sigComponents: SigmoidComponent[] = [
        { a: sigA1,  b: 1.4, c: sigC1 },
        { a: sigA2,  b: 0.9, c: sigC2 },
        { a:  0.25,  b: 0.5, c: 4.0  },
        { a: -0.18,  b: 1.2, c: 11.0 },
      ];
      const config: SimulationConfig = {
        initialConditions: {
          Xv: Xv0, Xd: 0, Xl: 0, B: 0,
          Glc: Glc0, Lac: Lac0, Gln: Gln0, Glu: Glu0, NH4: NH40, Tit: 0,
        },
        initialVolume: 14,
        feedBoluses: feedEnabled ? DEFAULT_FEED_BOLUSES : [],
        muNetComponents: sigComponents,
        runDays: 14,
        outputInterval: 0.1,
      };
      try {
        const res = runSimulation(config);
        setResults(res);
      } catch (err) {
        console.error("Simulation error:", err);
      }
      setRunning(false);
    }, 10);
  }, [Xv0, Glc0, Lac0, Gln0, Glu0, NH40, feedEnabled, sigA1, sigC1, sigA2, sigC2]);

  // Run on mount
  useEffect(() => { runSim(); }, []);

  // Stats from results
  const last = results[results.length - 1];
  const peakVcd = results.reduce((m, r) => Math.max(m, r.Xv), 0);
  const peakVcdDay = results.find((r) => r.Xv >= peakVcd - 0.001)?.t ?? 0;

  return (
    <div className="sim-page">
      {/* ── Controls ─────────────────────────────────────────────── */}
      <aside className="sim-controls">
        <h2 className="ctrl-title">Simulation Controls</h2>
        <p className="ctrl-sub">Ambr® 15 mL  ·  14-day fed-batch  ·  CHO-S  ·  Omalizumab</p>

        <section className="ctrl-section">
          <h3 className="ctrl-sect-title">Initial Conditions (t = 0)</h3>
          <Slider label="Xᵥ₀"   value={Xv0}  min={0.1} max={1.0} step={0.05} onChange={setXv0}  unit="10⁶ cells/mL" />
          <Slider label="Glc₀"  value={Glc0} min={5}   max={50}  step={0.5}  onChange={setGlc0} unit="mM" />
          <Slider label="Lac₀"  value={Lac0} min={0}   max={5}   step={0.1}  onChange={setLac0} unit="mM" />
          <Slider label="Gln₀"  value={Gln0} min={1}   max={15}  step={0.25} onChange={setGln0} unit="mM" />
          <Slider label="Glu₀"  value={Glu0} min={0.5} max={5}   step={0.1}  onChange={setGlu0} unit="mM" />
          <Slider label="NH₄₀"  value={NH40} min={0}   max={2}   step={0.05} onChange={setNH40} unit="mM" />
        </section>

        <section className="ctrl-section">
          <h3 className="ctrl-sect-title">Growth Rate Baseline  (μ_net sigmoid terms)</h3>
          <p className="ctrl-hint">
            μ_net(t) = Σ aₖ · σ(bₖ·(t − cₖ))  — four sigmoid components calibrated
            to typical CHO dynamics. The full NN (§ 2.3) requires the 23-batch dataset.
          </p>
          <Slider label="a₁ (growth amp.)" value={sigA1} min={0.3} max={1.4} step={0.05} onChange={setSigA1} />
          <Slider label="c₁ (growth onset)" value={sigC1} min={0.5} max={4.0} step={0.25} onChange={setSigC1} unit="day" />
          <Slider label="a₂ (decline amp.)" value={sigA2} min={-1.5} max={-0.3} step={0.05} onChange={setSigA2} />
          <Slider label="c₂ (decline onset)" value={sigC2} min={4.0} max={12.0} step={0.25} onChange={setSigC2} unit="day" />
        </section>

        <section className="ctrl-section">
          <h3 className="ctrl-sect-title">Feeding Strategy</h3>
          <label className="feed-toggle">
            <input type="checkbox" checked={feedEnabled} onChange={(e) => setFeedEnabled(e.target.checked)} />
            <span>FMA+FMB boluses on days 3, 5, 7, 9, 11 (5% v/v each)</span>
          </label>
        </section>

        <button className="run-btn" onClick={runSim} disabled={running}>
          {running ? "Simulating…" : "▶  Run Simulation"}
        </button>
      </aside>

      {/* ── Results ──────────────────────────────────────────────── */}
      <main className="sim-results">
        {/* Stat strip */}
        {last && (
          <div className="stat-strip">
            <StatCard label="Peak VCD" value={peakVcd.toFixed(1)} unit="10⁶ cells/mL" sub={`Day ${peakVcdDay.toFixed(1)}`} />
            <StatCard label="Final VCD" value={last.Xv.toFixed(1)} unit="10⁶ cells/mL" sub={`Day ${last.t.toFixed(0)}`} />
            <StatCard label="Final Titer" value={last.Tit.toFixed(0)} unit="mg/L" sub={`~${(last.Tit/1000).toFixed(2)} g/L`} />
            <StatCard label="Final Glucose" value={last.Glc.toFixed(1)} unit="mM" />
            <StatCard label="Final Lactate" value={last.Lac.toFixed(1)} unit="mM" />
            <StatCard label="Final NH₄⁺" value={last.NH4.toFixed(2)} unit="mM" />
          </div>
        )}

        <div className="charts-grid">
          <ChartPanel
            title="Viable / Dead / Lysed Cell Density  (Eqs. 8–10)"
            data={results}
            feedDays={feedEnabled ? feedDays : []}
            yLabel="10⁶ cells/mL"
            lines={[
              { key: "Xv", name: "Xᵥ (viable)", color: COLORS.Xv },
              { key: "Xd", name: "Xd (dead)",   color: COLORS.Xd },
              { key: "Xl", name: "Xˡ (lysed)",  color: COLORS.Xl },
            ]}
          />
          <ChartPanel
            title="Net & Effective Growth Rates  (Eqs. 12–14)"
            data={results}
            feedDays={feedEnabled ? feedDays : []}
            yLabel="day⁻¹"
            lines={[
              { key: "mu_net", name: "μ_net (baseline sigmoid)", color: COLORS.mu_net },
              { key: "mu_eff", name: "μ_eff = μ_net + k_d",      color: COLORS.mu_eff },
              { key: "kd",     name: "k_d (death rate)",          color: COLORS.kd     },
              { key: "kl",     name: "k_l (lysis rate)",          color: COLORS.kl     },
            ]}
          />
          <ChartPanel
            title="Glucose & Lactate  (Eqs. 15–16, 20–23)"
            data={results}
            feedDays={feedEnabled ? feedDays : []}
            yLabel="mM"
            lines={[
              { key: "Glc", name: "Glucose", color: COLORS.Glc },
              { key: "Lac", name: "Lactate", color: COLORS.Lac },
            ]}
          />
          <ChartPanel
            title="Glutamine & Glutamate  (Eqs. 17–18, 24–25)"
            data={results}
            feedDays={feedEnabled ? feedDays : []}
            yLabel="mM"
            lines={[
              { key: "Gln", name: "Glutamine", color: COLORS.Gln },
              { key: "Glu", name: "Glutamate", color: COLORS.Glu },
            ]}
          />
          <ChartPanel
            title="Ammonium & Biomaterial  (Eqs. 11, 19, 26)"
            data={results}
            feedDays={feedEnabled ? feedDays : []}
            yLabel="mM / a.u."
            lines={[
              { key: "NH4", name: "NH₄⁺ (mM)", color: COLORS.NH4 },
              { key: "B",   name: "Biomaterial B (a.u.)", color: COLORS.B },
            ]}
          />
          <ChartPanel
            title="Product Titer (mAb)  — growth-associated model"
            data={results}
            feedDays={feedEnabled ? feedDays : []}
            yLabel="mg/L"
            lines={[
              { key: "Tit", name: "mAb Titer (mg/L)", color: COLORS.Tit },
            ]}
          />
        </div>

        <div className="sim-info">
          <strong>Model configuration:</strong> ODE biomass population (§2.4.1, Eqs. 8–14) +
          ODE FLEX metabolite model (§2.4.2, Eqs. 15–26) with all parameters from Table 1.
          Growth rate baseline (§2.3) uses four user-adjustable sigmoid components.
          Feeding: bolus additions at days 3, 5, 7, 9, 11 (5% v/v, FMA+FMB).
          RK4 integrator, dt = 0.005 days. Feed ↑ markers shown on charts.
        </div>
      </main>
    </div>
  );
}
