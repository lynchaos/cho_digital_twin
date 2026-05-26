
/**
 * Parameters Page — Table 1 from Richelle et al. (2025)
 */

interface ParamRow {
  symbol: string;
  value: string;
  units: string;
  description: string;
  eq: string;
}

const biomassParams: ParamRow[] = [
  { symbol: "k_d⁰",       value: "0.01794129",    units: "day⁻¹",                      description: "Base death rate constant",                    eq: "12" },
  { symbol: "k_d¹",       value: "0.00033013",    units: "day⁻¹ · B⁻¹",               description: "Biomaterial toxicity factor (death)",         eq: "12" },
  { symbol: "k_l⁰",       value: "0.02962941",    units: "day⁻¹",                      description: "Base lysis rate constant",                    eq: "13" },
  { symbol: "k_l¹",       value: "0.01359236",    units: "day⁻¹ · (10⁶ cells/mL)⁻¹", description: "Lysed-cell toxicity factor (lysis)",          eq: "13" },
];

const flexParams: ParamRow[] = [
  // Glucose
  { symbol: "Y_Glc",      value: "13.2705431",    units: "mM · μ_eff⁻¹",              description: "Glucose pseudo-stoichiometric yield",         eq: "20" },
  { symbol: "K_m,Glc",    value: "25.4521167",    units: "mM",                         description: "Half-saturation constant, glucose uptake",    eq: "20" },
  { symbol: "K_i,Lac",    value: "8.18034685",    units: "mM",                         description: "Lactate inhibition constant (glucose)",       eq: "20" },
  { symbol: "m_Glc",      value: "0.882132146",   units: "mM·(10⁶cells/mL)⁻¹·day⁻¹", description: "Glucose maintenance coefficient",             eq: "20" },
  // Lactate
  { symbol: "q_Glc,ox,max", value: "1.64619067", units: "mM·(10⁶cells/mL)⁻¹·day⁻¹", description: "Maximum oxidative glucose capacity (overflow threshold)", eq: "21–22" },
  { symbol: "K_m,Lac",    value: "53.1522878",    units: "mM",                         description: "Half-saturation constant, lactate re-uptake", eq: "22" },
  { symbol: "Y_Lac,prod", value: "2.56537542",    units: "—",                          description: "Lactate production yield coefficient",        eq: "23" },
  { symbol: "Y_Lac,cons", value: "1.17984249",    units: "—",                          description: "Lactate consumption yield coefficient",       eq: "23" },
  // Glutamate
  { symbol: "Y_Glu",      value: "2.99191279 × 10⁻⁷", units: "mM · μ_eff⁻¹",         description: "Glutamate pseudo-stoichiometric yield",       eq: "24" },
  { symbol: "K_m,Glu",    value: "0.00151171924", units: "mM",                         description: "Half-saturation constant, glutamate uptake",  eq: "24" },
  { symbol: "m_Glu",      value: "0.00926153436", units: "mM·(10⁶cells/mL)⁻¹·day⁻¹", description: "Glutamate maintenance coefficient",           eq: "24" },
  // Glutamine
  { symbol: "q_Gln,max",  value: "2.68030547",    units: "mM·(10⁶cells/mL)⁻¹·day⁻¹", description: "Maximum glutamine uptake rate",               eq: "25" },
  { symbol: "K_m,Gln",    value: "2.69282272",    units: "mM",                         description: "Half-saturation constant, glutamine uptake",  eq: "25" },
  // Ammonium
  { symbol: "Y_NH₄,Glu",  value: "20.8763687",    units: "—",                          description: "NH₄⁺ yield from glutamate catabolism",       eq: "26" },
  { symbol: "Y_NH₄,Gln",  value: "0.722160623",   units: "—",                          description: "NH₄⁺ yield from glutamine catabolism",       eq: "26" },
];

function ParamTable({ rows, caption }: { rows: ParamRow[]; caption: string }) {
  return (
    <div className="param-table-wrap">
      <p className="param-caption">{caption}</p>
      <table className="param-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Value</th>
            <th>Units</th>
            <th>Description</th>
            <th>Eq.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol}>
              <td className="param-symbol">{r.symbol}</td>
              <td className="param-value">{r.value}</td>
              <td className="param-units">{r.units}</td>
              <td className="param-desc">{r.description}</td>
              <td className="param-eq">{r.eq}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ParametersPage() {
  return (
    <div className="params-page">
      <h1 className="params-title">Table 1 — Identified ODE Model Parameters</h1>
      <p className="params-intro">
        All parameter values are taken verbatim from <strong>Table 1</strong> of Richelle et al. (2025)
        "<em>A Hybrid Modeling Framework for Predictive Digital Twins of CHO Cell Culture</em>",
        bioRxiv 2025.11.24.690194. Parameters were identified by fitting the ODE models to
        23 CHO fed-batch Ambr® 15 bioreactor runs.
      </p>

      <ParamTable
        caption="§ 2.4.1 — ODE Biomass Population Model (Eqs. 8–14)"
        rows={biomassParams}
      />

      <ParamTable
        caption="§ 2.4.2 — ODE FLEX Metabolites Model (Eqs. 15–26)"
        rows={flexParams}
      />

      <div className="params-note">
        <strong>Validation metrics (direct fit, all 23 batches):</strong>
        <ul>
          <li>Glucose:    R² = 0.91</li>
          <li>Lactate:    R² = 0.36 (limited by simplified lactate model — no TCA intermediates)</li>
          <li>Glutamine:  R² = 0.98</li>
          <li>Glutamate:  R² = 0.91</li>
          <li>Ammonium:   R² = 0.92</li>
        </ul>
        <p>
          Neural network (VCD predictor, §2.3) and PC-dFBA loading predictor (§2.6) weights
          are not reported in the paper; only the ODE parameters above are replicated here.
        </p>
      </div>
    </div>
  );
}
