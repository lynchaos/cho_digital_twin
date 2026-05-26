
/**
 * CHO Cell Culture Model Equations
 *
 * All rate functions accept an optional `params: ModelParams` argument.
 * When omitted they fall back to DEFAULT_MODEL_PARAMS (Table 1 values).
 *
 * State vector indices:
 *   0  Xv   viable cell density   [10⁶ cells/mL]
 *   1  Xd   dead cell density     [10⁶ cells/mL]
 *   2  Xl   lysed cell density    [10⁶ cells/mL]
 *   3  B    biomaterial           [–]
 *   4  Glc  glucose               [mM]
 *   5  Lac  lactate               [mM]
 *   6  Gln  glutamine             [mM]
 *   7  Glu  glutamate             [mM]
 *   8  NH4  ammonium              [mM]
 *   9  Tit  product titer         [mg/L]
 */

import { DEFAULT_MODEL_PARAMS, type ModelParams } from "./parameters";

// ── Biomass rates (Eqs. 12–14) ───────────────────────────────────────────────

/** Eq. 12  k_d = k_d⁰ + k_d¹ · B */
export function deathRate(B: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
  return p.kd0 + p.kd1 * Math.max(0, B);
}

/** Eq. 13  k_l = k_l⁰ + k_l¹ · Xl */
export function lysisRate(Xl: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
  return p.kl0 + p.kl1 * Math.max(0, Xl);
}

/** Eq. 14  μ_eff = μ_net + k_d */
export function effectiveGrowthRate(mu_net: number, B: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
  return mu_net + deathRate(B, p);
}

// ── FLEX metabolic rates (Eqs. 20–26) ───────────────────────────────────────

/**
 * Eq. 20  q_Glc = Y_Glc · μ_eff · [Glc/(Km_Glc+Glc)] · [Ki_Lac/(Ki_Lac+Lac)] + m_Glc
 */
export function qGlc(
  mu_eff: number, Glc: number, Lac: number,
  p: ModelParams = DEFAULT_MODEL_PARAMS,
): number {
  const satGlc = Math.max(0, Glc) / (p.Km_Glc + Math.max(0, Glc));
  const inhLac = p.Ki_Lac / (p.Ki_Lac + Math.max(0, Lac));
  return p.Y_Glc * Math.max(0, mu_eff) * satGlc * inhLac + p.m_Glc;
}

/** Eq. 21  q_Lac,prod = max(0, q_Glc − q_Glc,ox,max) */
export function qLacProd(q_glc: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
  return Math.max(0, q_glc - p.q_Glc_ox_max);
}

/** Eq. 22  q_Lac,cons = max(0, q_Glc,ox,max − q_Glc) · Lac/(Km_Lac+Lac) */
export function qLacCons(q_glc: number, Lac: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
  const satLac = Math.max(0, Lac) / (p.Km_Lac + Math.max(0, Lac));
  return Math.max(0, p.q_Glc_ox_max - q_glc) * satLac;
}

/** Eq. 23  q_Lac = Y_Lac,prod · q_Lac,prod − Y_Lac,cons · q_Lac,cons */
export function qLacNet(q_glc: number, Lac: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
  return p.Y_Lac_prod * qLacProd(q_glc, p) - p.Y_Lac_cons * qLacCons(q_glc, Lac, p);
}

/** Eq. 24  q_Glu = Y_Glu · μ_eff · [Glu/(Km_Glu+Glu)] + m_Glu */
export function qGlu(mu_eff: number, Glu: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
  const satGlu = Math.max(0, Glu) / (p.Km_Glu + Math.max(0, Glu));
  return p.Y_Glu * Math.max(0, mu_eff) * satGlu + p.m_Glu;
}

/** Eq. 25  q_Gln = q_Gln,max · Gln/(Km_Gln+Gln) */
export function qGln(Gln: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
  return p.q_Gln_max * Math.max(0, Gln) / (p.Km_Gln + Math.max(0, Gln));
}

/** Eq. 26  q_NH4 = Y_NH4,Glu · q_Glu + Y_NH4,Gln · q_Gln */
export function qNH4(q_glu: number, q_gln: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
  return p.Y_NH4_Glu * q_glu + p.Y_NH4_Gln * q_gln;
}

// ── Full ODE RHS ─────────────────────────────────────────────────────────────

export interface FeedInput {
  F: number;          // feed flow rate [mL/day]
  V: number;          // current volume [mL]
  Glc_feed: number;   // [mM]
  Gln_feed: number;   // [mM]
  Glu_feed: number;   // [mM]
}

/**
 * Combined biomass-population + FLEX-metabolite ODE right-hand side.
 * @param p  Model parameters; defaults to Table 1 values if omitted.
 */
export function choODE(
  t: number,
  y: number[],
  mu_net: number,
  feed: FeedInput,
  p: ModelParams = DEFAULT_MODEL_PARAMS,
): number[] {
  const [Xv, Xd, Xl, B, Glc, Lac, Gln, Glu, NH4] = y;
  const D = feed.F / feed.V;

  const kd     = deathRate(B, p);
  const kl     = lysisRate(Xl, p);
  const mu_eff = mu_net + kd;

  // Eqs. 8–11
  const dXv = (mu_eff - kd - kl - D) * Math.max(0, Xv);
  const dXd = kd * Math.max(0, Xv) - kl * Math.max(0, Xd) - D * Math.max(0, Xd);
  const dXl = kl * (Math.max(0, Xv) + Math.max(0, Xd)) - D * Math.max(0, Xl);
  const dB  = mu_net * Math.max(0, Xv) - D * Math.max(0, B);

  // Eqs. 15–19
  const q_glc = qGlc(mu_eff, Glc, Lac, p);
  const q_lac = qLacNet(q_glc, Lac, p);
  const q_glu = qGlu(mu_eff, Glu, p);
  const q_gln = qGln(Gln, p);
  const q_nh4 = qNH4(q_glu, q_gln, p);

  const dGlc = -q_glc * Math.max(0, Xv) + D * (feed.Glc_feed - Glc);
  const dLac =  q_lac * Math.max(0, Xv) - D * Lac;
  const dGln = -q_gln * Math.max(0, Xv) + D * (feed.Gln_feed - Gln);
  const dGlu = -q_glu * Math.max(0, Xv) + D * (feed.Glu_feed - Glu);
  const dNH4 =  q_nh4 * Math.max(0, Xv) - D * NH4;
  const dTit = p.q_p  * Math.max(0, Xv) - D * Math.max(0, y[9]);

  return [dXv, dXd, dXl, dB, dGlc, dLac, dGln, dGlu, dNH4, dTit];
}
