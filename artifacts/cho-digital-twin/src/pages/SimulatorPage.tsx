
import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import {
  runSimulation, type TimePoint, type FeedBolus, type SimulationConfig,
  DEFAULT_FEED_BOLUSES, exportToCsv,
} from "@/lib/simulator";
import { DEFAULT_SIGMOID_COMPONENTS, type SigmoidComponent } from "@/lib/growth-rate";
import {
  DEFAULT_MODEL_PARAMS, DEFAULT_NUTRIENT_COUPLING,
  type ModelParams, type NutrientCouplingParams,
} from "@/lib/parameters";

// ── Colours ────────────────────────────────────────────────────────────────────
const COLORS = {
  Xv: "#1d6fa5", Xd: "#e07b3c", Xl: "#a05ca0",
  mu_net: "#2c9c56", mu_eff: "#1d6fa5", kd: "#e07b3c", kl: "#a05ca0",
  Glc: "#1d6fa5", Lac: "#e07b3c", Gln: "#2c9c56", Glu: "#a05ca0",
  NH4: "#c45252", Tit: "#8a6d1e", B: "#5a7a5a",
};

// ── Chart panel ────────────────────────────────────────────────────────────────
function ChartPanel({ title, data, lines, feedDays, yLabel }: {
  title: string; data: TimePoint[];
  lines: { key: keyof TimePoint; name: string; color: string }[];
  feedDays?: number[]; yLabel?: string;
}) {
  const fmt = (v: number) => v < 0.01 ? v.toExponential(2) : v.toFixed(3);
  return (
    <div className="chart-panel">
      <h3 className="chart-title">{title}</h3>
      {yLabel && <span className="chart-y-label">{yLabel}</span>}
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
          <XAxis dataKey="t" tickFormatter={(v) => `${v.toFixed(1)}`}
            label={{ value: "Time (days)", position: "insideBottom", offset: -2, fontSize: 11 }}
            tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} width={60} />
          <Tooltip formatter={(val: number, name: string) => [fmt(val), name]}
            labelFormatter={(l: number) => `Day ${Number(l).toFixed(2)}`}
            contentStyle={{ fontSize: 11 }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
          {feedDays?.map((d) => (
            <ReferenceLine key={d} x={d} stroke="#aaa" strokeDasharray="4 2"
              label={{ value: "↑", position: "top", fontSize: 10, fill: "#888" }} />
          ))}
          {lines.map(({ key, name, color }) => (
            <Line key={key as string} type="monotone" dataKey={key as string} name={name}
              stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, unit }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; unit?: string;
}) {
  return (
    <div className="slider-row">
      <label className="slider-label">{label}</label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="slider-input" />
      <span className="slider-val">{value.toFixed(2)}{unit ? ` ${unit}` : ""}</span>
    </div>
  );
}

function StatCard({ label, value, unit, sub }: { label: string; value: string; unit: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value} <span className="stat-unit">{unit}</span></div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ── Parameter editor ────────────────────────────────────────────────────────────

interface ParamField {
  key: keyof ModelParams;
  label: string; units: string;
  min: number; max: number; step: number; digits: number;
}

const PARAM_GROUPS: { title: string; eq: string; fields: ParamField[] }[] = [
  {
    title: "Biomass", eq: "Eqs. 12–13",
    fields: [
      { key: "kd0", label: "k_d⁰", units: "day⁻¹", min: 0, max: 0.1, step: 0.0001, digits: 6 },
      { key: "kd1", label: "k_d¹", units: "day⁻¹·B⁻¹", min: 0, max: 0.005, step: 0.000001, digits: 6 },
      { key: "kl0", label: "k_l⁰", units: "day⁻¹", min: 0, max: 0.15, step: 0.0001, digits: 6 },
      { key: "kl1", label: "k_l¹", units: "day⁻¹·Mc⁻¹", min: 0, max: 0.1, step: 0.0001, digits: 6 },
      { key: "B_max", label: "B_max", units: "–", min: 50, max: 2000, step: 50, digits: 0 },
    ],
  },
  {
    title: "Glucose", eq: "Eq. 20",
    fields: [
      { key: "Y_Glc",  label: "Y_Glc",      units: "–",              min: 0,  max: 40,    step: 0.1,   digits: 4 },
      { key: "Km_Glc", label: "K_m,Glc",    units: "mM",             min: 0,  max: 100,   step: 0.1,   digits: 4 },
      { key: "Ki_Lac", label: "K_i,Lac",    units: "mM",             min: 0,  max: 50,    step: 0.1,   digits: 4 },
      { key: "m_Glc",  label: "m_Glc",      units: "mM·Mc⁻¹·d⁻¹",  min: 0,  max: 5,     step: 0.01,  digits: 4 },
    ],
  },
  {
    title: "Lactate", eq: "Eqs. 21–23",
    fields: [
      { key: "q_Glc_ox_max", label: "q_Glc,ox,max", units: "mM·Mc⁻¹·d⁻¹", min: 0, max: 10, step: 0.01, digits: 4 },
      { key: "Km_Lac",       label: "K_m,Lac",       units: "mM",            min: 0, max: 200, step: 1,   digits: 4 },
      { key: "Y_Lac_prod",   label: "Y_Lac,prod",    units: "–",             min: 0, max: 10, step: 0.01, digits: 4 },
      { key: "Y_Lac_cons",   label: "Y_Lac,cons",    units: "–",             min: 0, max: 10, step: 0.01, digits: 4 },
    ],
  },
  {
    title: "Glutamate", eq: "Eq. 24",
    fields: [
      { key: "Y_Glu",  label: "Y_Glu",   units: "–",             min: 0, max: 1e-6, step: 1e-8, digits: 9 },
      { key: "Km_Glu", label: "K_m,Glu", units: "mM",            min: 0, max: 0.01, step: 1e-5, digits: 7 },
      { key: "m_Glu",  label: "m_Glu",   units: "mM·Mc⁻¹·d⁻¹", min: 0, max: 0.1,  step: 0.001, digits: 5 },
    ],
  },
  {
    title: "Glutamine", eq: "Eq. 25",
    fields: [
      { key: "q_Gln_max", label: "q_Gln,max", units: "mM·Mc⁻¹·d⁻¹", min: 0, max: 10, step: 0.01, digits: 4 },
      { key: "Km_Gln",    label: "K_m,Gln",   units: "mM",            min: 0, max: 15, step: 0.01, digits: 4 },
    ],
  },
  {
    title: "Ammonium", eq: "Eq. 26",
    fields: [
      { key: "Y_NH4_Glu", label: "Y_NH4,Glu", units: "–", min: 0, max: 50, step: 0.1, digits: 4 },
      { key: "Y_NH4_Gln", label: "Y_NH4,Gln", units: "–", min: 0, max: 5,  step: 0.01, digits: 4 },
    ],
  },
  {
    title: "Product — Luedeking-Piret", eq: "LP model",
    fields: [
      { key: "q_p",        label: "q_p (β, non-growth)", units: "pg·cell⁻¹·d⁻¹", min: 0, max: 80,  step: 0.5, digits: 1 },
      { key: "q_p_growth", label: "q_p,gr (α, growth)",  units: "pg·cell⁻¹",      min: 0, max: 30,  step: 0.5, digits: 1 },
    ],
  },
];

function ParamEditor({
  params, onChange,
}: {
  params: ModelParams;
  onChange: (key: keyof ModelParams, value: number) => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (t: string) => setOpenGroups((p) => ({ ...p, [t]: !p[t] }));
  const isDefault = (key: keyof ModelParams) => params[key] === DEFAULT_MODEL_PARAMS[key];

  return (
    <div className="param-editor">
      {PARAM_GROUPS.map((group) => {
        const isOpen = openGroups[group.title] ?? false;
        const anyMod = group.fields.some((f) => !isDefault(f.key));
        return (
          <div key={group.title} className={`param-group ${anyMod ? "param-group-modified" : ""}`}>
            <button className="param-group-header" onClick={() => toggleGroup(group.title)}>
              <span className="param-group-name">
                {group.title}
                {anyMod && <span className="param-modified-dot" title="Modified">●</span>}
              </span>
              <span className="param-group-meta">{group.eq}</span>
              <span className="param-group-chevron">{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && (
              <div className="param-group-body">
                {group.fields.map((f) => {
                  const def = DEFAULT_MODEL_PARAMS[f.key];
                  const cur = params[f.key];
                  const modified = cur !== def;
                  return (
                    <div key={f.key} className={`param-row ${modified ? "param-row-modified" : ""}`}>
                      <div className="param-row-top">
                        <span className="param-row-label">{f.label}</span>
                        <span className="param-row-units">{f.units}</span>
                        {modified && (
                          <button className="param-reset-btn"
                            title={`Reset: ${def.toExponential(4)}`}
                            onClick={() => onChange(f.key, def)}>↺</button>
                        )}
                      </div>
                      <div className="param-row-inputs">
                        <input type="range" min={f.min} max={f.max} step={f.step} value={cur}
                          onChange={(e) => onChange(f.key, Number(e.target.value))}
                          className="param-slider" />
                        <input type="number" value={cur.toFixed(f.digits)} step={f.step}
                          min={f.min} max={f.max}
                          onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(f.key, v); }}
                          className="param-num-input" />
                      </div>
                      {modified && (
                        <div className="param-default-hint">Table 1: {def.toPrecision(7)}</div>
                      )}
                    </div>
                  );
                })}
                <button className="param-reset-group-btn"
                  onClick={() => group.fields.forEach((f) => onChange(f.key, DEFAULT_MODEL_PARAMS[f.key]))}>
                  Reset {group.title} to defaults
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Nutrient coupling panel ─────────────────────────────────────────────────────
function NutrientCouplingPanel({
  nc, onChange,
}: {
  nc: NutrientCouplingParams;
  onChange: (key: keyof NutrientCouplingParams, v: number | boolean) => void;
}) {
  return (
    <div className="nc-panel">
      <label className="feed-toggle">
        <input type="checkbox" checked={nc.enabled}
          onChange={(e) => onChange("enabled", e.target.checked)} />
        <span>
          <strong>Enable nutrient-coupled μ_net</strong> (§2.3 NN substitute)
        </span>
      </label>
      {nc.enabled && (
        <div className="nc-sliders">
          <p className="ctrl-hint">
            Monod/inhibition factors modulate μ_sigmoid by nutrient availability.
            Not in Table 1 — uses CHO literature defaults.
          </p>
          <Slider label="K_m,Glc"  value={nc.Km_Glc_growth} min={0.1} max={5}   step={0.1}  onChange={(v) => onChange("Km_Glc_growth", v)} unit="mM" />
          <Slider label="K_m,Gln"  value={nc.Km_Gln_growth} min={0.1} max={3}   step={0.05} onChange={(v) => onChange("Km_Gln_growth", v)} unit="mM" />
          <Slider label="Ki_Lac"   value={nc.Ki_Lac_growth}  min={10}  max={100} step={2.5}  onChange={(v) => onChange("Ki_Lac_growth",  v)} unit="mM" />
          <Slider label="Ki_NH4⁺"  value={nc.Ki_NH4_growth}  min={2}   max={30}  step={1}    onChange={(v) => onChange("Ki_NH4_growth",  v)} unit="mM" />
        </div>
      )}
    </div>
  );
}

// ── CSV export ─────────────────────────────────────────────────────────────────
function downloadCsv(results: TimePoint[]) {
  const csv = exportToCsv(results);
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = "cho_simulation.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SimulatorPage() {
  const [Xv0,  setXv0]  = useState(0.30);
  const [Glc0, setGlc0] = useState(26.0);
  const [Lac0, setLac0] = useState(0.5);
  const [Gln0, setGln0] = useState(8.0);
  const [Glu0, setGlu0] = useState(2.0);
  const [NH40, setNH40] = useState(0.2);

  const [sigA1, setSigA1] = useState(0.85);
  const [sigC1, setSigC1] = useState(1.5);
  const [sigA2, setSigA2] = useState(-0.95);
  const [sigC2, setSigC2] = useState(7.0);

  const [feedEnabled, setFeedEnabled] = useState(true);
  const [modelParams, setModelParams] = useState<ModelParams>({ ...DEFAULT_MODEL_PARAMS });
  const [nc, setNc]   = useState<NutrientCouplingParams>({ ...DEFAULT_NUTRIENT_COUPLING });

  const [results, setResults] = useState<TimePoint[]>([]);
  const [running, setRunning] = useState(false);

  const feedDays = DEFAULT_FEED_BOLUSES.map((f) => f.day);

  const updateParam = useCallback((key: keyof ModelParams, value: number) =>
    setModelParams((p) => ({ ...p, [key]: value })), []);
  const updateNc = useCallback((key: keyof NutrientCouplingParams, value: number | boolean) =>
    setNc((p) => ({ ...p, [key]: value })), []);
  const resetAllParams = useCallback(() => setModelParams({ ...DEFAULT_MODEL_PARAMS }), []);

  const anyParamModified = Object.keys(DEFAULT_MODEL_PARAMS).some(
    (k) => modelParams[k as keyof ModelParams] !== DEFAULT_MODEL_PARAMS[k as keyof ModelParams],
  );

  const runSim = useCallback(() => {
    setRunning(true);
    setTimeout(() => {
      const sigComponents: SigmoidComponent[] = [
        { a: sigA1, b: 1.4, c: sigC1 },
        { a: sigA2, b: 0.9, c: sigC2 },
        { a:  0.25, b: 0.5, c: 4.0  },
        { a: -0.18, b: 1.2, c: 11.0 },
      ];
      const config: SimulationConfig = {
        initialConditions: { Xv: Xv0, Xd: 0, Xl: 0, B: 0, Glc: Glc0, Lac: Lac0, Gln: Gln0, Glu: Glu0, NH4: NH40, Tit: 0 },
        initialVolume: 14,
        feedBoluses: feedEnabled ? DEFAULT_FEED_BOLUSES : [],
        muNetComponents: sigComponents,
        nutrientCoupling: { ...nc },
        modelParams: { ...modelParams },
        runDays: 14,
        outputInterval: 0.1,
      };
      try { setResults(runSimulation(config)); }
      catch (err) { console.error("Simulation error:", err); }
      setRunning(false);
    }, 10);
  }, [Xv0, Glc0, Lac0, Gln0, Glu0, NH40, feedEnabled, sigA1, sigC1, sigA2, sigC2, modelParams, nc]);

  useEffect(() => { runSim(); }, []);

  const last = results[results.length - 1];
  const peakVcd    = results.reduce((m, r) => Math.max(m, r.Xv), 0);
  const peakVcdDay = results.find((r) => r.Xv >= peakVcd - 0.001)?.t ?? 0;

  return (
    <div className="sim-page">
      {/* ── Controls ────────────────────────────────────────────────────────── */}
      <aside className="sim-controls">
        <h2 className="ctrl-title">Simulation Controls</h2>
        <p className="ctrl-sub">Ambr® 15 mL · 14-day fed-batch · CHO-S</p>

        <section className="ctrl-section">
          <h3 className="ctrl-sect-title">Initial Conditions (t = 0)</h3>
          <Slider label="Xᵥ₀"  value={Xv0}  min={0.1} max={1.0} step={0.05} onChange={setXv0}  unit="Mc/mL" />
          <Slider label="Glc₀" value={Glc0} min={5}   max={50}  step={0.5}  onChange={setGlc0} unit="mM" />
          <Slider label="Lac₀" value={Lac0} min={0}   max={5}   step={0.1}  onChange={setLac0} unit="mM" />
          <Slider label="Gln₀" value={Gln0} min={1}   max={15}  step={0.25} onChange={setGln0} unit="mM" />
          <Slider label="Glu₀" value={Glu0} min={0.5} max={5}   step={0.1}  onChange={setGlu0} unit="mM" />
          <Slider label="NH₄₀" value={NH40} min={0}   max={2}   step={0.05} onChange={setNH40} unit="mM" />
        </section>

        <section className="ctrl-section">
          <h3 className="ctrl-sect-title">Growth Rate Baseline (μ_net sigmoids)</h3>
          <p className="ctrl-hint">
            μ_net(t) = Σ aₖ·σ(bₖ·(t−cₖ)).  Full §2.3 NN needs the 23-batch dataset.
            Nutrient coupling applies on top of this.
          </p>
          <Slider label="a₁" value={sigA1} min={0.3}  max={1.4}  step={0.05} onChange={setSigA1} />
          <Slider label="c₁" value={sigC1} min={0.5}  max={4.0}  step={0.25} onChange={setSigC1} unit="day" />
          <Slider label="a₂" value={sigA2} min={-1.5} max={-0.3} step={0.05} onChange={setSigA2} />
          <Slider label="c₂" value={sigC2} min={4.0}  max={12.0} step={0.25} onChange={setSigC2} unit="day" />
        </section>

        {/* ── Nutrient coupling ─────────────────────────────────────────────── */}
        <section className="ctrl-section">
          <h3 className="ctrl-sect-title">Nutrient-Coupled Growth (§2.3 NN substitute)</h3>
          <p className="ctrl-hint">
            Multiplies μ_sigmoid(t) by Monod-type factors for Glc/Gln saturation
            and Lac/NH4 inhibition. Prevents unbounded VCD when nutrients deplete.
          </p>
          <NutrientCouplingPanel nc={nc} onChange={updateNc} />
        </section>

        <section className="ctrl-section">
          <h3 className="ctrl-sect-title">Feeding Strategy</h3>
          <label className="feed-toggle">
            <input type="checkbox" checked={feedEnabled}
              onChange={(e) => setFeedEnabled(e.target.checked)} />
            <span>FMA+FMB boluses on days 3, 5, 7, 9, 11 (5% v/v each)</span>
          </label>
        </section>

        <section className="ctrl-section">
          <div className="params-header">
            <h3 className="ctrl-sect-title" style={{ margin: 0 }}>
              Model Parameters (Table 1)
              {anyParamModified && <span className="param-modified-dot" title="Modified from Table 1">●</span>}
            </h3>
            {anyParamModified && (
              <button className="reset-all-btn" onClick={resetAllParams}>Reset all</button>
            )}
          </div>
          <p className="ctrl-hint">
            Click a group to expand. Sliders + number inputs stay in sync.
            Modified values highlighted in amber.
          </p>
          <ParamEditor params={modelParams} onChange={updateParam} />
        </section>

        <div className="ctrl-btn-row">
          <button className="run-btn" style={{ flex: 1 }} onClick={runSim} disabled={running}>
            {running ? "Simulating…" : "▶  Run Simulation"}
          </button>
          {results.length > 0 && (
            <button className="export-btn" onClick={() => downloadCsv(results)}
              title="Download simulation data as CSV">
              ↓ CSV
            </button>
          )}
        </div>
      </aside>

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      <main className="sim-results">
        {last && (
          <div className="stat-strip">
            <StatCard label="Peak VCD"    value={peakVcd.toFixed(1)} unit="Mc/mL"  sub={`Day ${peakVcdDay.toFixed(1)}`} />
            <StatCard label="Final VCD"   value={last.Xv.toFixed(1)} unit="Mc/mL"  sub={`Day ${last.t.toFixed(0)}`} />
            <StatCard label="Final Titer" value={last.Tit.toFixed(0)} unit="mg/L"  sub={`~${(last.Tit/1000).toFixed(2)} g/L`} />
            <StatCard label="Final Glc"   value={last.Glc.toFixed(1)} unit="mM" />
            <StatCard label="Final Lac"   value={last.Lac.toFixed(1)} unit="mM" />
            <StatCard label="Final NH₄⁺"  value={last.NH4.toFixed(2)} unit="mM" />
          </div>
        )}

        <div className="charts-grid">
          <ChartPanel title="Viable / Dead / Lysed Cell Density (Eqs. 8–10)" data={results}
            feedDays={feedEnabled ? feedDays : []} yLabel="10⁶ cells/mL"
            lines={[
              { key: "Xv", name: "Xᵥ (viable)", color: COLORS.Xv },
              { key: "Xd", name: "Xd (dead)",   color: COLORS.Xd },
              { key: "Xl", name: "Xˡ (lysed)",  color: COLORS.Xl },
            ]} />
          <ChartPanel title="Net & Effective Growth Rates (Eqs. 12–14)" data={results}
            feedDays={feedEnabled ? feedDays : []} yLabel="day⁻¹"
            lines={[
              { key: "mu_net", name: "μ_net", color: COLORS.mu_net },
              { key: "mu_eff", name: "μ_eff", color: COLORS.mu_eff },
              { key: "kd",     name: "k_d",   color: COLORS.kd },
              { key: "kl",     name: "k_l",   color: COLORS.kl },
            ]} />
          <ChartPanel title="Glucose & Lactate (Eqs. 15–16, 20–23)" data={results}
            feedDays={feedEnabled ? feedDays : []} yLabel="mM"
            lines={[
              { key: "Glc", name: "Glucose", color: COLORS.Glc },
              { key: "Lac", name: "Lactate", color: COLORS.Lac },
            ]} />
          <ChartPanel title="Glutamine & Glutamate (Eqs. 17–18, 24–25)" data={results}
            feedDays={feedEnabled ? feedDays : []} yLabel="mM"
            lines={[
              { key: "Gln", name: "Glutamine", color: COLORS.Gln },
              { key: "Glu", name: "Glutamate", color: COLORS.Glu },
            ]} />
          <ChartPanel title="Ammonium & Biomaterial (Eqs. 11, 19, 26)" data={results}
            feedDays={feedEnabled ? feedDays : []} yLabel="mM / a.u."
            lines={[
              { key: "NH4", name: "NH₄⁺ (mM)",    color: COLORS.NH4 },
              { key: "B",   name: "Biomaterial B", color: COLORS.B   },
            ]} />
          <ChartPanel title="Product Titer — Luedeking-Piret (dTit/dt = (α·μ + β)·Xv)" data={results}
            feedDays={feedEnabled ? feedDays : []} yLabel="mg/L"
            lines={[
              { key: "Tit", name: "Titer (mg/L)", color: COLORS.Tit },
            ]} />
        </div>

        <div className="sim-info">
          <strong>Model:</strong> ODE biomass (Eqs. 8–14) + FLEX metabolites (Eqs. 15–26),
          RK4 dt = 0.005 d.{" "}
          <strong>Product:</strong> Luedeking-Piret dTit/dt = (q_p_growth·μ_net + q_p)·Xv.{" "}
          {nc.enabled && <strong style={{ color: "#2c9c56" }}>Nutrient coupling: ON.</strong>}
          {anyParamModified && <span className="sim-info-warn"> ⚠ Some parameters deviate from published Table 1 values.</span>}
        </div>
      </main>
    </div>
  );
}
