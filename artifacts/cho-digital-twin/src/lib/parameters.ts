
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

/** ODE Biomass Population Model parameters (Eqs. 8–14) */
export const BIOMASS_PARAMS = {
  kd0: 0.01794129,   // k_d⁰  – base death rate constant                             [day⁻¹]
  kd1: 0.00033013,   // k_d¹  – biomaterial-dependent toxicity factor for death        [day⁻¹ · B⁻¹]
  kl0: 0.02962941,   // k_l⁰  – base lysis rate constant                               [day⁻¹]
  kl1: 0.01359236,   // k_l¹  – lysed-cell density toxicity factor for lysis           [day⁻¹ · (10⁶ cells/mL)⁻¹]
} as const;

/** ODE FLEX Metabolite Model parameters (Eqs. 15–26) */
export const FLEX_PARAMS = {
  // ── Glucose kinetics (Eq. 20) ──────────────────────────────────────────────
  Y_Glc:          13.2705431,       // pseudo-stoichiometric yield (glucose consumed per unit of μ_eff)
  Km_Glc:         25.4521167,       // half-saturation constant for glucose uptake          [mM]
  Ki_Lac:          8.18034685,      // lactate inhibition constant for glucose uptake       [mM]
  m_Glc:           0.882132146,     // glucose maintenance coefficient                      [mM·(10⁶cells/mL)⁻¹·day⁻¹]

  // ── Lactate kinetics (Eqs. 21–23) ──────────────────────────────────────────
  q_Glc_ox_max:    1.64619067,      // maximum oxidative glucose capacity (threshold)       [mM·(10⁶cells/mL)⁻¹·day⁻¹]
  Km_Lac:         53.1522878,       // half-saturation constant for lactate re-uptake       [mM]
  Y_Lac_prod:      2.56537542,      // lactate production yield coefficient                 [–]
  Y_Lac_cons:      1.17984249,      // lactate consumption yield coefficient                [–]

  // ── Glutamate kinetics (Eq. 24) ────────────────────────────────────────────
  Y_Glu:           2.99191279e-7,   // pseudo-stoichiometric yield for glutamate            [mM per μ_eff unit]
  Km_Glu:          0.00151171924,   // half-saturation constant for glutamate uptake        [mM]
  m_Glu:           0.00926153436,   // glutamate maintenance coefficient                    [mM·(10⁶cells/mL)⁻¹·day⁻¹]

  // ── Glutamine kinetics (Eq. 25) ────────────────────────────────────────────
  q_Gln_max:       2.68030547,      // maximum glutamine uptake rate                        [mM·(10⁶cells/mL)⁻¹·day⁻¹]
  Km_Gln:          2.69282272,      // half-saturation constant for glutamine uptake        [mM]

  // ── Ammonium production (Eq. 26) ───────────────────────────────────────────
  Y_NH4_Glu:      20.8763687,       // NH₄⁺ yield coefficient from glutamate catabolism    [–]
  Y_NH4_Gln:       0.722160623,     // NH₄⁺ yield coefficient from glutamine catabolism    [–]
} as const;

/** Specific productivity for monoclonal antibody (mAb) titer – not in Table 1, set to a
 *  typical literature value for CHO producing Omalizumab-like IgG.
 *  q_p ≈ 15 pg/cell/day  →  0.015 mg/L per (10⁶ cells/mL) per day */
export const PRODUCT_PARAMS = {
  q_p: 0.015,   // specific productivity  [mg/L · (10⁶cells/mL)⁻¹ · day⁻¹]
} as const;

/** Sigmoid baseline parameters for μ_net (Eq. 1 proxy)
 *  Four sigmoidal components calibrated to reproduce typical CHO fed-batch
 *  growth dynamics (peak VCD ~14 × 10⁶ cells/mL around day 7).
 *  In the paper these are *learned* from 21 training batches. */
export const SIGMOID_BASELINE_PARAMS = [
  { a:  0.85, b: 1.4, c: 1.5 },   // exponential growth onset
  { a: -0.95, b: 0.9, c: 7.0 },   // growth decline (mid-culture)
  { a:  0.25, b: 0.5, c: 4.0 },   // secondary growth support
  { a: -0.18, b: 1.2, c: 11.0 },  // death-phase onset
] as const;

export type BiomassParams  = typeof BIOMASS_PARAMS;
export type FlexParams     = typeof FLEX_PARAMS;
