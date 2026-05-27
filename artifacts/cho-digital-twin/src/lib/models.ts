
/**
 * CHO Cell Culture Model Equations — Richelle et al. (2025)
 *
 * All rate functions accept an optional ModelParams argument.
 * When omitted they fall back to DEFAULT_MODEL_PARAMS (Table 1 values).
 *
 * Fixes vs original:
 *  • B is capped at B_max to prevent unbounded accumulation (added param)
 *  • Product uses Luedeking-Piret: dTit/dt = (q_p_growth·μ_net + q_p)·Xv
 *  • mu_net passed through to product equation
 *
 * State vector:
 *   0 Xv  [Mc/mL]   1 Xd  [Mc/mL]   2 Xl  [Mc/mL]
 *   3 B   [–]        4 Glc [mM]      5 Lac [mM]
 *   6 Gln [mM]       7 Glu [mM]      8 NH4 [mM]
 *   9 Tit [mg/L]
 */

import { DEFAULT_MODEL_PARAMS, type ModelParams } from "./parameters";

// ── Biomass rates (Eqs. 12–14) ────────────────────────────────────────────────

/** Eq. 12  k_d = k_d⁰ + k_d¹ · min(B, B_max) */
export function deathRate(B: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
  return p.kd0 + p.kd1 * Math.min(Math.max(0, B), p.B_max);
}

/** Eq. 13  k_l = k_l⁰ + k_l¹ · Xl */
export function lysisRate(Xl: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
  return p.kl0 + p.kl1 * Math.max(0, Xl);
}

/** Eq. 14  μ_eff = μ_net + k_d */
export function effectiveGrowthRate(mu_net: number, B: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
  return mu_net + deathRate(B, p);
}

// ── FLEX metabolic rates (Eqs. 20–26) ────────────────────────────────────────

/** Eq. 20  q_Glc = Y_Glc · μ_eff · [Glc/(Km+Glc)] · [Ki_Lac/(Ki+Lac)] + m_Glc */
export function qGlc(mu_eff: number, Glc: number, Lac: number, p: ModelParams = DEFAULT_MODEL_PARAMS): number {
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

/** Eq. 24  q_Glu = Y_Glu · μ_eff · [Glu/(Km+Glu)] + m_Glu */
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

// ── Feed input ────────────────────────────────────────────────────────────────

export interface FeedInput {
  F: number;          // flow rate [mL/day]
  V: number;          // volume [mL]
  Glc_feed: number;   // [mM]
  Gln_feed: number;   // [mM]
  Glu_feed: number;   // [mM]
}

// ── Full ODE RHS ─────────────────────────────────────────────────────────────

/**
 * dy/dt for the combined biomass + FLEX system.
 *
 * @param mu_net  Net growth rate at this time step [day⁻¹] — supplied externally
 *                (sigmoid baseline or nutrient-coupled; see growth-rate.ts)
 * @param p       Model parameters (defaults to Table 1 values)
 */
export function choODE(
  _t: number,
  y: number[],
  mu_net: number,
  feed: FeedInput,
  p: ModelParams = DEFAULT_MODEL_PARAMS,
): number[] {
  const [Xv, Xd, Xl, B, Glc, Lac, Gln, Glu, NH4] = y;
  const D = feed.F / feed.V;

  // Biomass kinetics (Eqs. 8–11)
  const kd     = deathRate(B, p);
  const kl     = lysisRate(Xl, p);
  const mu_eff = mu_net + kd;

  const dXv = (mu_eff - kd - kl - D) * Math.max(0, Xv);
  const dXd = kd * Math.max(0, Xv) - kl * Math.max(0, Xd) - D * Math.max(0, Xd);
  const dXl = kl * (Math.max(0, Xv) + Math.max(0, Xd)) - D * Math.max(0, Xl);
  // B is capped at B_max via deathRate(); the accumulation itself is uncapped
  // so that kd can reflect the true biomaterial load
  const dB  = mu_net * Math.max(0, Xv) - D * Math.max(0, B);

  // FLEX metabolite kinetics (Eqs. 15–19, using rates 20–26)
  const q_glc = qGlc(mu_eff, Glc, Lac, p);
  const q_lac = qLacNet(q_glc, Lac, p);
  const q_glu = qGlu(mu_eff, Glu, p);
  const q_gln = qGln(Gln, p);
  const q_nh4 = qNH4(q_glu, q_gln, p);

  const dGlc = -q_glc * Math.max(0, Xv) + D * (feed.Glc_feed - Glc);
  const dLac =  q_lac * Math.max(0, Xv) - D * Lac;
  // Glutamine chemical degradation: Gln → pyroglutamate + NH₃ (non-enzymatic, 37 °C)
  const gln_chem = p.k_Gln_deg * Math.max(0, Gln);

  const dGln = -q_gln * Math.max(0, Xv) - gln_chem + D * (feed.Gln_feed - Gln);
  // Glu balance: consumption + production from Gln→Glu transamination (GLS)
  const dGlu = (-q_glu + p.Y_Glu_Gln * q_gln) * Math.max(0, Xv) + D * (feed.Glu_feed - Glu);
  const dNH4 =  q_nh4 * Math.max(0, Xv) + gln_chem - D * NH4;

  // Product titer — Luedeking-Piret (growth-associated + non-growth-associated)
  //   dTit/dt = (q_p_growth · μ_net + q_p) · Xv − D · Tit
  const dTit = (p.q_p_growth * Math.max(0, mu_net) + p.q_p) * Math.max(0, Xv)
             - D * Math.max(0, y[9]);

  return [dXv, dXd, dXl, dB, dGlc, dLac, dGln, dGlu, dNH4, dTit];
}
