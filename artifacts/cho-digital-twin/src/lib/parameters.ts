
/**
 * Table 1 — Identified parameter values for the ODE biomass and FLEX metabolite models
 * Source: Richelle et al. (2025) bioRxiv 2025.11.24.690194
 *
 * Units notes:
 *  - Time:        days
 *  - VCD (Xv):    10⁶ cells/mL
 *  - Metabolites: mM
 *  - Biomaterial: dimensionless accumulation proxy
 */

/** Combined mutable model parameter object (all Table 1 values + q_p) */
export interface ModelParams {
  // ── Biomass (Eqs. 12–13) ─────────────────────────────────────────────────
  kd0: number;         // k_d⁰  base death rate constant              [day⁻¹]
  kd1: number;         // k_d¹  biomaterial-dependent death toxicity   [day⁻¹·B⁻¹]
  kl0: number;         // k_l⁰  base lysis rate constant              [day⁻¹]
  kl1: number;         // k_l¹  lysed-cell-density lysis toxicity      [day⁻¹·(10⁶c/mL)⁻¹]
  // ── Glucose (Eq. 20) ────────────────────────────────────────────────────
  Y_Glc: number;       // pseudo-stoichiometric yield
  Km_Glc: number;      // half-saturation constant                    [mM]
  Ki_Lac: number;      // lactate inhibition constant                 [mM]
  m_Glc: number;       // maintenance coefficient                     [mM·(10⁶c/mL)⁻¹·d⁻¹]
  // ── Lactate (Eqs. 21–23) ────────────────────────────────────────────────
  q_Glc_ox_max: number; // max oxidative capacity / overflow threshold [mM·(10⁶c/mL)⁻¹·d⁻¹]
  Km_Lac: number;       // half-saturation for lactate re-uptake      [mM]
  Y_Lac_prod: number;   // lactate production yield                   [–]
  Y_Lac_cons: number;   // lactate consumption yield                  [–]
  // ── Glutamate (Eq. 24) ──────────────────────────────────────────────────
  Y_Glu: number;        // pseudo-stoichiometric yield for glutamate
  Km_Glu: number;       // half-saturation constant                   [mM]
  m_Glu: number;        // maintenance coefficient                    [mM·(10⁶c/mL)⁻¹·d⁻¹]
  // ── Glutamine (Eq. 25) ──────────────────────────────────────────────────
  q_Gln_max: number;    // max glutamine uptake rate                  [mM·(10⁶c/mL)⁻¹·d⁻¹]
  Km_Gln: number;       // half-saturation constant                   [mM]
  // ── Ammonium (Eq. 26) ───────────────────────────────────────────────────
  Y_NH4_Glu: number;    // NH₄⁺ yield from glutamate
  Y_NH4_Gln: number;    // NH₄⁺ yield from glutamine
  // ── Product ─────────────────────────────────────────────────────────────
  q_p: number;          // specific productivity                      [mg/L·(10⁶c/mL)⁻¹·d⁻¹]
}

/** Table 1 default values (verbatim from the paper) */
export const DEFAULT_MODEL_PARAMS: ModelParams = {
  // Biomass
  kd0:          0.01794129,
  kd1:          0.00033013,
  kl0:          0.02962941,
  kl1:          0.01359236,
  // Glucose
  Y_Glc:        13.2705431,
  Km_Glc:       25.4521167,
  Ki_Lac:        8.18034685,
  m_Glc:         0.882132146,
  // Lactate
  q_Glc_ox_max:  1.64619067,
  Km_Lac:       53.1522878,
  Y_Lac_prod:    2.56537542,
  Y_Lac_cons:    1.17984249,
  // Glutamate
  Y_Glu:         2.99191279e-7,
  Km_Glu:        0.00151171924,
  m_Glu:         0.00926153436,
  // Glutamine
  q_Gln_max:     2.68030547,
  Km_Gln:        2.69282272,
  // Ammonium
  Y_NH4_Glu:    20.8763687,
  Y_NH4_Gln:     0.722160623,
  // Product (not in Table 1 — typical CHO literature value)
  q_p:           0.015,
};

// Legacy exports kept for backward compatibility
export const BIOMASS_PARAMS = {
  kd0: DEFAULT_MODEL_PARAMS.kd0,
  kd1: DEFAULT_MODEL_PARAMS.kd1,
  kl0: DEFAULT_MODEL_PARAMS.kl0,
  kl1: DEFAULT_MODEL_PARAMS.kl1,
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

export const PRODUCT_PARAMS = {
  q_p: DEFAULT_MODEL_PARAMS.q_p,
} as const;

export const SIGMOID_BASELINE_PARAMS = [
  { a:  0.85, b: 1.4, c: 1.5 },
  { a: -0.95, b: 0.9, c: 7.0 },
  { a:  0.25, b: 0.5, c: 4.0 },
  { a: -0.18, b: 1.2, c: 11.0 },
] as const;

export type BiomassParams = typeof BIOMASS_PARAMS;
export type FlexParams    = typeof FLEX_PARAMS;
