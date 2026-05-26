
/**
 * CHO Cell Culture Model Equations
 *
 * Implements every rate equation from Richelle et al. (2025) bioRxiv 2025.11.24.690194
 *
 * ──────────────────────────────────────────────────────────────────────────────
 *  Section 2.4.1 — ODE Biomass Population Kinetic Model  (Eqs. 8–14)
 *  Section 2.4.2 — ODE FLEX Metabolites Model            (Eqs. 15–26)
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * State vector indices  (used throughout the simulator)
 *   0  Xv   viable cell density          [10⁶ cells/mL]
 *   1  Xd   dead cell density            [10⁶ cells/mL]
 *   2  Xl   lysed cell density           [10⁶ cells/mL]
 *   3  B    biomaterial accumulation     [dimensionless]
 *   4  Glc  glucose concentration        [mM]
 *   5  Lac  lactate concentration        [mM]
 *   6  Gln  glutamine concentration      [mM]
 *   7  Glu  glutamate concentration      [mM]
 *   8  NH4  ammonium concentration       [mM]
 *   9  Tit  product titer                [mg/L]
 */

import { BIOMASS_PARAMS as BP, FLEX_PARAMS as FP, PRODUCT_PARAMS as PP } from "./parameters";

// ──────────────────────────────────────────────────────────────────────────────
//  Derived death / lysis rates  (Eqs. 12–13)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Eq. 12:  k_d = k_d⁰ + k_d¹ · B
 * Death rate modulated by biomaterial accumulation.
 */
export function deathRate(B: number): number {
  return BP.kd0 + BP.kd1 * Math.max(0, B);
}

/**
 * Eq. 13:  k_l = k_l⁰ + k_l¹ · Xl
 * Lysis rate modulated by lysed-cell density.
 */
export function lysisRate(Xl: number): number {
  return BP.kl0 + BP.kl1 * Math.max(0, Xl);
}

/**
 * Eq. 14:  μ_eff = μ_net + k_d
 * Effective (gross) growth rate from net growth rate.
 */
export function effectiveGrowthRate(mu_net: number, B: number): number {
  return mu_net + deathRate(B);
}

// ──────────────────────────────────────────────────────────────────────────────
//  Specific metabolic rates  (Eqs. 20–26)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Eq. 20  Glucose specific consumption rate  q_Glc  [mM · (10⁶cells/mL)⁻¹ · day⁻¹]
 *
 *   q_Glc = Y_Glc · μ_eff · (Glc / (Km_Glc + Glc)) · (Ki_Lac / (Ki_Lac + Lac)) + m_Glc
 */
export function qGlc(mu_eff: number, Glc: number, Lac: number): number {
  const satGlc = Math.max(0, Glc) / (FP.Km_Glc + Math.max(0, Glc));
  const inhLac = FP.Ki_Lac / (FP.Ki_Lac + Math.max(0, Lac));
  return FP.Y_Glc * Math.max(0, mu_eff) * satGlc * inhLac + FP.m_Glc;
}

/**
 * Eq. 21  Lactate production rate  [mM · (10⁶cells/mL)⁻¹ · day⁻¹]
 *
 *   q_Lac_prod = max(0, q_Glc − q_Glc_ox_max)
 */
export function qLacProd(q_glc: number): number {
  return Math.max(0, q_glc - FP.q_Glc_ox_max);
}

/**
 * Eq. 22  Lactate consumption rate  [mM · (10⁶cells/mL)⁻¹ · day⁻¹]
 *
 *   q_Lac_cons = max(0, q_Glc_ox_max − q_Glc) · (Lac / (Km_Lac + Lac))
 */
export function qLacCons(q_glc: number, Lac: number): number {
  const satLac = Math.max(0, Lac) / (FP.Km_Lac + Math.max(0, Lac));
  return Math.max(0, FP.q_Glc_ox_max - q_glc) * satLac;
}

/**
 * Eq. 23  Net lactate rate  [mM · (10⁶cells/mL)⁻¹ · day⁻¹]  (positive = net production)
 *
 *   q_Lac = Y_Lac_prod · q_Lac_prod − Y_Lac_cons · q_Lac_cons
 */
export function qLacNet(q_glc: number, Lac: number): number {
  return FP.Y_Lac_prod * qLacProd(q_glc) - FP.Y_Lac_cons * qLacCons(q_glc, Lac);
}

/**
 * Eq. 24  Glutamate specific consumption rate  [mM · (10⁶cells/mL)⁻¹ · day⁻¹]
 *
 *   q_Glu = Y_Glu · μ_eff · (Glu / (Km_Glu + Glu)) + m_Glu
 */
export function qGlu(mu_eff: number, Glu: number): number {
  const satGlu = Math.max(0, Glu) / (FP.Km_Glu + Math.max(0, Glu));
  return FP.Y_Glu * Math.max(0, mu_eff) * satGlu + FP.m_Glu;
}

/**
 * Eq. 25  Glutamine specific consumption rate  [mM · (10⁶cells/mL)⁻¹ · day⁻¹]
 *
 *   q_Gln = q_Gln_max · (Gln / (Km_Gln + Gln))
 */
export function qGln(Gln: number): number {
  return FP.q_Gln_max * Math.max(0, Gln) / (FP.Km_Gln + Math.max(0, Gln));
}

/**
 * Eq. 26  Ammonium production rate  [mM · (10⁶cells/mL)⁻¹ · day⁻¹]
 *
 *   q_NH4 = Y_NH4_Glu · q_Glu + Y_NH4_Gln · q_Gln
 */
export function qNH4(q_glu: number, q_gln: number): number {
  return FP.Y_NH4_Glu * q_glu + FP.Y_NH4_Gln * q_gln;
}

// ──────────────────────────────────────────────────────────────────────────────
//  Full ODE right-hand side  (Eqs. 8–11, 15–19)
// ──────────────────────────────────────────────────────────────────────────────

export interface FeedInput {
  /** Feeding rate F [mL/day] */
  F: number;
  /** Current volume V [mL] */
  V: number;
  /** Feed concentrations */
  Glc_feed: number;   // [mM]
  Gln_feed: number;   // [mM]
  Glu_feed: number;   // [mM]
}

/**
 * Computes dy/dt for the combined biomass-population + FLEX-metabolite ODE system.
 *
 * @param t       current time [days]
 * @param y       state vector [Xv, Xd, Xl, B, Glc, Lac, Gln, Glu, NH4, Tit]
 * @param mu_net  net specific growth rate at time t  [day⁻¹]
 * @param feed    feed conditions at time t
 */
export function choODE(
  t: number,
  y: number[],
  mu_net: number,
  feed: FeedInput,
): number[] {
  const [Xv, Xd, Xl, B, Glc, Lac, Gln, Glu, NH4] = y;

  // Dilution rate D = F / V  [day⁻¹]
  const D = feed.F / feed.V;

  // ── Biomass kinetics ──────────────────────────────────────────────────────
  const kd    = deathRate(B);                         // Eq. 12
  const kl    = lysisRate(Xl);                        // Eq. 13
  const mu_eff = mu_net + kd;                         // Eq. 14

  // Eq. 8:  dXv/dt = (μ_eff − k_d − k_l − D) · Xv
  const dXv = (mu_eff - kd - kl - D) * Math.max(0, Xv);

  // Eq. 9:  dXd/dt = k_d · Xv − k_l · Xd − D · Xd
  const dXd = kd * Math.max(0, Xv) - kl * Math.max(0, Xd) - D * Math.max(0, Xd);

  // Eq. 10: dXl/dt = k_l · (Xv + Xd) − D · Xl
  const dXl = kl * (Math.max(0, Xv) + Math.max(0, Xd)) - D * Math.max(0, Xl);

  // Eq. 11: dB/dt  = μ_net · Xv − D · B
  const dB  = mu_net * Math.max(0, Xv) - D * Math.max(0, B);

  // ── FLEX metabolite rates ─────────────────────────────────────────────────
  const q_glc = qGlc(mu_eff, Glc, Lac);
  const q_lac = qLacNet(q_glc, Lac);
  const q_glu = qGlu(mu_eff, Glu);
  const q_gln = qGln(Gln);
  const q_nh4 = qNH4(q_glu, q_gln);

  // Eq. 15: dGlc/dt = −q_Glc · Xv + (F/V) · (Glc_feed − Glc)
  const dGlc = -q_glc * Math.max(0, Xv) + D * (feed.Glc_feed - Glc);

  // Eq. 16: dLac/dt = q_Lac · Xv − D · Lac
  const dLac =  q_lac * Math.max(0, Xv) - D * Lac;

  // Eq. 17: dGln/dt = −q_Gln · Xv + (F/V) · (Gln_feed − Gln)
  const dGln = -q_gln * Math.max(0, Xv) + D * (feed.Gln_feed - Gln);

  // Eq. 18: dGlu/dt = −q_Glu · Xv + (F/V) · (Glu_feed − Glu)
  const dGlu = -q_glu * Math.max(0, Xv) + D * (feed.Glu_feed - Glu);

  // Eq. 19: dNH4/dt = q_NH4 · Xv − D · NH4  (no NH4 in feed)
  const dNH4 =  q_nh4 * Math.max(0, Xv) - D * NH4;

  // Product titer  (not in Table 1 — growth-associated production model)
  const dTit = PP.q_p * Math.max(0, Xv) - D * Math.max(0, y[9]);

  return [dXv, dXd, dXl, dB, dGlc, dLac, dGln, dGlu, dNH4, dTit];
}
