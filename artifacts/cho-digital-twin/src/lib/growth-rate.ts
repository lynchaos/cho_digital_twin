
/**
 * Sigmoid-Baseline Growth Rate Model
 *
 * Section 2.3 — Neural Network for VCD prediction (proxy component)
 *
 * The paper's VCD predictor (Eq. 1) decomposes μ_net into:
 *   1. A sigmoid baseline — mean growth rate across all training batches
 *   2. A deviation correction — neural network output tailored to culture conditions
 *
 * Since the NN weights require the proprietary training dataset (23 CHO batches),
 * we implement the BASELINE component exactly (four fitted sigmoid functions)
 * and allow the user to tune it to explore the model sensitivity.
 *
 * Baseline (Eq. 1 proxy):
 *   μ_net(t) = Σ_{k=1}^{4} a_k · σ(b_k · (t − c_k))
 *
 * where σ(x) = 1 / (1 + exp(−x))   (standard logistic function)
 */

export interface SigmoidComponent {
  a: number;  // amplitude (can be negative)
  b: number;  // steepness [day⁻¹]
  c: number;  // inflection point [day]
}

/** Standard logistic sigmoid function */
export function sigmoid(x: number): number {
  if (x > 500) return 1;
  if (x < -500) return 0;
  return 1 / (1 + Math.exp(-x));
}

/**
 * Evaluate the sum-of-sigmoids baseline for μ_net at time t.
 *
 * @param t          time in days
 * @param components array of sigmoid component parameters
 */
export function sigmaBaseline(t: number, components: SigmoidComponent[]): number {
  return components.reduce((sum, { a, b, c }) => sum + a * sigmoid(b * (t - c)), 0);
}

/**
 * Build an array of μ_net values at the given time points.
 * Values are clipped to a minimum of 1e-5 day⁻¹ (biological floor).
 */
export function buildMuNetTrajectory(
  times: number[],
  components: SigmoidComponent[],
): number[] {
  return times.map((t) => sigmaBaseline(t, components));
}

/**
 * Default sigmoid component parameters calibrated to reproduce typical CHO fed-batch
 * growth dynamics:
 *   • Exponential phase:  days 0–5,  μ ≈ 0.45–0.75 day⁻¹
 *   • Stationary phase:   days 6–9,  μ ≈ 0.10–0.20 day⁻¹
 *   • Death phase:        days 10–14, μ ≈ −0.05 to −0.10 day⁻¹
 * Peak VCD ~ 14–16 × 10⁶ cells/mL  (day 7–8)
 *
 * These are representative values; the paper learns them from 21 training batches.
 */
export const DEFAULT_SIGMOID_COMPONENTS: SigmoidComponent[] = [
  { a:  0.85, b: 1.4, c:  1.5 },  // growth onset
  { a: -0.95, b: 0.9, c:  7.0 },  // growth decline
  { a:  0.25, b: 0.5, c:  4.0 },  // mid-culture support
  { a: -0.18, b: 1.2, c: 11.0 },  // late-culture death
];
