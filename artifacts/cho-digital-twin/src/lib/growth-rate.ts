
/**
 * Growth Rate Model
 *
 * Three modes, in order of increasing fidelity:
 *  1. SIGMOID BASELINE  — time-driven sum of sigmoids (structure from §2.3 Eq. 1)
 *  2. NUTRIENT-COUPLED  — sigmoid × Monod factors (NN proxy, no training data needed)
 *  3. SURROGATE NN      — small MLP calibrated at startup against (2) above
 *                         Replace weights with real ones from the 23-batch dataset.
 */

import { type NutrientCouplingParams } from "./parameters";
import { calibrateNN, forwardNN, type NNWeights } from "./neural-net";

// ── Sigmoid baseline ──────────────────────────────────────────────────────────

export interface SigmoidComponent {
  a: number;   // amplitude
  b: number;   // steepness [day⁻¹]
  c: number;   // inflection day
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

export const DEFAULT_SIGMOID_COMPONENTS: SigmoidComponent[] = [
  { a:  0.85, b: 1.4, c:  1.5 },
  { a: -0.95, b: 0.9, c:  7.0 },
  { a:  0.25, b: 0.5, c:  4.0 },
  { a: -0.18, b: 1.2, c: 11.0 },
];

// ── Nutrient-coupled growth rate ──────────────────────────────────────────────
// μ_net_coupled = μ_sigmoid × f(Glc) × f(Gln) × f_inh(Lac) × f_inh(NH4)

export function nutrientCoupledMuNet(
  mu_base: number,
  Glc: number, Gln: number, Lac: number, NH4: number,
  nc: NutrientCouplingParams,
): number {
  if (!nc.enabled || mu_base <= 0) return mu_base;
  const f_Glc = Math.max(0, Glc) / (nc.Km_Glc_growth + Math.max(0, Glc));
  const f_Gln = Math.max(0, Gln) / (nc.Km_Gln_growth + Math.max(0, Gln));
  const f_Lac = nc.Ki_Lac_growth / (nc.Ki_Lac_growth + Math.max(0, Lac));
  const f_NH4 = nc.Ki_NH4_growth / (nc.Ki_NH4_growth + Math.max(0, NH4));
  return mu_base * f_Glc * f_Gln * f_Lac * f_NH4;
}

// ── Surrogate NN ──────────────────────────────────────────────────────────────

export type MuNetMode = "sigmoid" | "nutrient-coupled" | "surrogate-nn";

let _nnWeights: NNWeights | null = null;
let _nnCalibrating = false;

/**
 * Trigger async calibration of the surrogate NN against the sigmoid×Monod proxy.
 * Subsequent calls to nnMuNet() will use the calibrated weights.
 * @param onDone  Optional callback when calibration completes
 */
export function calibrateSurrogateNN(
  components: SigmoidComponent[],
  nc: NutrientCouplingParams,
  onDone?: (w: NNWeights) => void,
): void {
  if (_nnCalibrating) return;
  _nnCalibrating = true;
  // Defer to next tick so UI remains responsive
  setTimeout(() => {
    const teacher = (t: number, Glc: number, Gln: number, Lac: number, NH4: number) => {
      const mu_base = sigmaBaseline(t, components);
      return nutrientCoupledMuNet(mu_base, Glc, Gln, Lac, NH4, nc);
    };
    _nnWeights = calibrateNN(teacher, 3000, 0.004);
    _nnCalibrating = false;
    onDone?.(_nnWeights);
  }, 0);
}

export function getNNWeights(): NNWeights | null {
  return _nnWeights;
}

export function setNNWeights(w: NNWeights): void {
  _nnWeights = w;
}

export function isNNCalibrating(): boolean {
  return _nnCalibrating;
}

/** Compute μ_net using the surrogate NN (falls back to nutrient-coupled if not ready). */
export function nnMuNet(
  t: number, Glc: number, Gln: number, Lac: number, NH4: number,
  nc: NutrientCouplingParams,
  components: SigmoidComponent[],
  weights: NNWeights | null,
): number {
  if (!weights) {
    // NN not calibrated yet — fall back to nutrient-coupled proxy
    const mu_base = sigmaBaseline(t, components);
    return nutrientCoupledMuNet(mu_base, Glc, Gln, Lac, NH4, nc);
  }
  return forwardNN(t, Glc, Gln, Lac, NH4, weights);
}

// Re-export for convenience
export type { NNWeights };
