
/**
 * Table 1 — Identified parameter values (Richelle et al. 2025, bioRxiv 2025.11.24.690194)
 *
 * Units: time = days, VCD = 10⁶ cells/mL (Mc/mL), metabolites = mM
 */

// ─────────────────────────────────────────────────────────────────────────────
//  Combined mutable model parameter type
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelParams {
  // ── Biomass (Eqs. 12–13) ──────────────────────────────────────────────────
  kd0: number;           // k_d⁰  base death rate constant              [day⁻¹]
  kd1: number;           // k_d¹  biomaterial-dependent death            [day⁻¹·B⁻¹]
  kl0: number;           // k_l⁰  base lysis rate                        [day⁻¹]
  kl1: number;           // k_l¹  lysed-cell lysis amplification         [day⁻¹·(Mc/mL)⁻¹]
  B_max: number;         // saturation ceiling for biomaterial B          [Mc·day/mL] (prevents unbounded growth)
  // ── Glucose (Eq. 20) ──────────────────────────────────────────────────────
  Y_Glc: number;
  Km_Glc: number;        // [mM]
  Ki_Lac: number;        // [mM]
  m_Glc: number;         // [mM·(Mc/mL)⁻¹·day⁻¹]
  // ── Lactate (Eqs. 21–23) ──────────────────────────────────────────────────
  q_Glc_ox_max: number;  // [mM·(Mc/mL)⁻¹·day⁻¹]
  Km_Lac: number;        // [mM]
  Y_Lac_prod: number;
  Y_Lac_cons: number;
  // ── Glutamate (Eq. 24) ────────────────────────────────────────────────────
  Y_Glu: number;
  Km_Glu: number;        // [mM]
  m_Glu: number;         // [mM·(Mc/mL)⁻¹·day⁻¹]
  // ── Glutamine (Eq. 25) ────────────────────────────────────────────────────
  q_Gln_max: number;     // [mM·(Mc/mL)⁻¹·day⁻¹]
  Km_Gln: number;        // [mM]
  // ── Ammonium (Eq. 26) ─────────────────────────────────────────────────────
  Y_NH4_Glu: number;
  Y_NH4_Gln: number;
  // ── Glutamine chemical degradation (non-enzymatic, 37 °C) ─────────────────
  k_Gln_deg: number;     // Gln → pyroglutamate + NH₃  [day⁻¹]
  // ── Gln → Glu transamination yield ────────────────────────────────────────
  Y_Glu_Gln: number;     // Glu produced per Gln consumed via GLS  [mol/mol]
  // ── Product — Luedeking-Piret: dTit/dt = (q_p_growth·μ + q_p) · Xv ──────
  q_p: number;           // non-growth-associated productivity  [mg·L⁻¹·(Mc/mL)⁻¹·day⁻¹]
  q_p_growth: number;    // growth-associated productivity      [mg·L⁻¹·(Mc/mL)⁻¹]
}

/** Table 1 defaults (exact values from the paper; B_max and q_p_growth are additions) */
export const DEFAULT_MODEL_PARAMS: ModelParams = {
  // Biomass (Table 1)
  kd0:           0.01794129,
  kd1:           0.00033013,
  kl0:           0.02962941,
  kl1:           0.01359236,
  B_max:         500,           // added: prevents B accumulating to infinity
  // Glucose (Table 1)
  Y_Glc:         13.2705431,
  Km_Glc:        25.4521167,
  Ki_Lac:         8.18034685,
  m_Glc:          0.882132146,
  // Lactate (Table 1)
  q_Glc_ox_max:   1.64619067,
  Km_Lac:        53.1522878,
  Y_Lac_prod:     2.56537542,
  Y_Lac_cons:     1.17984249,
  // Glutamate (Table 1)
  Y_Glu:          2.99191279e-7,
  Km_Glu:         0.00151171924,
  m_Glu:          0.00926153436,
  // Glutamine (Table 1)
  q_Gln_max:      2.68030547,
  Km_Gln:         2.69282272,
  // Ammonium (Table 1)
  Y_NH4_Glu:     20.8763687,
  Y_NH4_Gln:      0.722160623,
  // Glutamine chemical degradation (literature: non-enzymatic at 37 °C, pH 7.4)
  k_Gln_deg:      0.006,        // ~0.6%/day  (Tritsch & Moore 1986; conservative)
  // Gln → Glu transamination yield (GLS pathway, CHO literature)
  Y_Glu_Gln:      0.35,         // 35% of Gln consumed yields Glu via GLS
  // Product (literature: typical CHO mAb, Luedeking-Piret)
  // Units: q_p_model [mg/L/(Mc/mL)/day] ≡ q_p_real [pg/cell/day]  (exact unit equivalence)
  // Typical CHO mAb: 10–50 pg/cell/day total; 60–80% non-growth-associated
  q_p:            20.0,         // non-growth-associated β ~20 pg/cell/day
  q_p_growth:      5.0,         // growth-associated     α ~5 pg/cell/day per day⁻¹ of μ
};

// ─────────────────────────────────────────────────────────────────────────────
//  Nutrient coupling parameters (substitute for the paper's NN, §2.3)
//  These modulate μ_net by metabolite availability:
//  μ_eff_coupled = μ_sigmoid(t) · f(Glc) · f(Gln) · f_inh(Lac) · f_inh(NH4)
// ─────────────────────────────────────────────────────────────────────────────

export interface NutrientCouplingParams {
  enabled: boolean;
  Km_Glc_growth: number;  // Monod half-saturation for Glc limitation  [mM]
  Km_Gln_growth: number;  // Monod half-saturation for Gln limitation  [mM]
  Ki_Lac_growth: number;  // Lactate inhibition constant (growth)      [mM]
  Ki_NH4_growth: number;  // Ammonium inhibition constant (growth)     [mM]
}

export const DEFAULT_NUTRIENT_COUPLING: NutrientCouplingParams = {
  enabled:        true,
  Km_Glc_growth:  0.5,    // CHO literature: ~0.3–0.8 mM
  Km_Gln_growth:  0.3,    // CHO literature: ~0.2–0.5 mM
  Ki_Lac_growth: 45.0,    // CHO literature: 30–60 mM inhibition
  Ki_NH4_growth:  8.0,    // CHO literature: 5–15 mM inhibition
};

// ─────────────────────────────────────────────────────────────────────────────
//  Legacy exports (backward compat)
// ─────────────────────────────────────────────────────────────────────────────

export const BIOMASS_PARAMS = {
  kd0: DEFAULT_MODEL_PARAMS.kd0, kd1: DEFAULT_MODEL_PARAMS.kd1,
  kl0: DEFAULT_MODEL_PARAMS.kl0, kl1: DEFAULT_MODEL_PARAMS.kl1,
} as const;

export const FLEX_PARAMS = {
  Y_Glc:        DEFAULT_MODEL_PARAMS.Y_Glc,
  Km_Glc:       DEFAULT_MODEL_PARAMS.Km_Glc,
  Ki_Lac:       DEFAULT_MODEL_PARAMS.Ki_Lac,
  m_Glc:        DEFAULT_MODEL_PARAMS.m_Glc,
  q_Glc_ox_max: DEFAULT_MODEL_PARAMS.q_Glc_ox_max,
  Km_Lac:       DEFAULT_MODEL_PARAMS.Km_Lac,
  Y_Lac_prod:   DEFAULT_MODEL_PARAMS.Y_Lac_prod,
  Y_Lac_cons:   DEFAULT_MODEL_PARAMS.Y_Lac_cons,
  Y_Glu:        DEFAULT_MODEL_PARAMS.Y_Glu,
  Km_Glu:       DEFAULT_MODEL_PARAMS.Km_Glu,
  m_Glu:        DEFAULT_MODEL_PARAMS.m_Glu,
  q_Gln_max:    DEFAULT_MODEL_PARAMS.q_Gln_max,
  Km_Gln:       DEFAULT_MODEL_PARAMS.Km_Gln,
  Y_NH4_Glu:    DEFAULT_MODEL_PARAMS.Y_NH4_Glu,
  Y_NH4_Gln:    DEFAULT_MODEL_PARAMS.Y_NH4_Gln,
} as const;

export const PRODUCT_PARAMS = { q_p: DEFAULT_MODEL_PARAMS.q_p } as const;

export const SIGMOID_BASELINE_PARAMS = [
  { a:  0.85, b: 1.4, c: 1.5 },
  { a: -0.95, b: 0.9, c: 7.0 },
  { a:  0.25, b: 0.5, c: 4.0 },
  { a: -0.18, b: 1.2, c: 11.0 },
] as const;

export type BiomassParams = typeof BIOMASS_PARAMS;
export type FlexParams    = typeof FLEX_PARAMS;
