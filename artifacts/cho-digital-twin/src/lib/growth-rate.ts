
/**
 * Growth Rate Model
 *
 * The paper (§2.3) uses a neural network to predict μ_net from metabolite
 * concentrations and specific rates. Since the NN weights require the
 * proprietary 23-batch dataset, this module provides two alternatives:
 *
 *  1. SIGMOID BASELINE — time-driven sum-of-sigmoids (Eq. 1 structure)
 *  2. NUTRIENT-COUPLED BASELINE — sigmoid × Monod limitations
 *     (§2.3 NN substitute: captures nutrient depletion / inhibition feedback)
 */

import { type NutrientCouplingParams } from "./parameters";

// ─── Sigmoid baseline ────────────────────────────────────────────────────────

export interface SigmoidComponent {
  a: number;  // amplitude
  b: number;  // steepness [day⁻¹]
  c: number;  // inflection day
}

export function sigmoid(x: number): number {
  if (x >  500) return 1;
  if (x < -500) return 0;
  return 1 / (1 + Math.exp(-x));
}

export function sigmaBaseline(t: number, components: SigmoidComponent[]): number {
  return components.reduce((s, { a, b, c }) => s + a * sigmoid(b * (t - c)), 0);
}

export function buildMuNetTrajectory(times: number[], components: SigmoidComponent[]): number[] {
  return times.map((t) => sigmaBaseline(t, components));
}

/**
 * Default sigmoid components calibrated to typical CHO fed-batch profile.
 * These replicate the *structure* of Eq. 1; actual NN weights need the paper's dataset.
 */
export const DEFAULT_SIGMOID_COMPONENTS: SigmoidComponent[] = [
  { a:  0.85, b: 1.4, c:  1.5 },
  { a: -0.95, b: 0.9, c:  7.0 },
  { a:  0.25, b: 0.5, c:  4.0 },
  { a: -0.18, b: 1.2, c: 11.0 },
];

// ─── Nutrient-coupled growth rate ────────────────────────────────────────────
//
//  μ_net_coupled(t) = μ_sigmoid(t)
//                   × [Glc / (Km_Glc_growth + Glc)]      ← Monod, glucose
//                   × [Gln / (Km_Gln_growth + Gln)]      ← Monod, glutamine
//                   × [Ki_Lac / (Ki_Lac + Lac)]           ← lactate inhibition
//                   × [Ki_NH4 / (Ki_NH4 + NH4)]           ← ammonium inhibition
//
//  This approximates the environmental feedback that the paper's NN learns from
//  data. The Km/Ki values are not from Table 1; they use typical CHO literature
//  values (see parameters.ts NutrientCouplingParams defaults).

export function nutrientCoupledMuNet(
  mu_base: number,
  Glc: number,
  Gln: number,
  Lac: number,
  NH4: number,
  nc: NutrientCouplingParams,
): number {
  if (!nc.enabled || mu_base <= 0) return mu_base;

  const f_Glc = Math.max(0, Glc) / (nc.Km_Glc_growth + Math.max(0, Glc));
  const f_Gln = Math.max(0, Gln) / (nc.Km_Gln_growth + Math.max(0, Gln));
  const f_Lac = nc.Ki_Lac_growth / (nc.Ki_Lac_growth + Math.max(0, Lac));
  const f_NH4 = nc.Ki_NH4_growth / (nc.Ki_NH4_growth + Math.max(0, NH4));

  return mu_base * f_Glc * f_Gln * f_Lac * f_NH4;
}
