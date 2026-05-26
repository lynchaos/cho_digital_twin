
/**
 * MetRaC — Metabolic Rate Calculation (simplified implementation)
 *
 * Based on §2.2 of Richelle et al. (2025). The paper uses Bayesian nested
 * sampling on B-spline coefficients; this implementation uses:
 *   1. Finite-difference derivatives (centered where possible)
 *   2. Bioreactor mass balance to convert dC/dt → specific rates q
 *   3. Gaussian error propagation for measurement uncertainty
 *   4. Nadaraya-Watson kernel smoother for posterior rate trajectories
 *   5. 95% credible intervals via propagated variance
 *
 * Reference bioreactor mass balance (between boluses, D = 0):
 *   q_i = − (dC_i/dt) / Xv
 *
 * For glucose specifically (Eq. 20):  q is a consumption rate (positive = uptake)
 * For lactate (Eq. 23):               q is net (positive = production, negative = consumption)
 */

import type { NoisyMeasurement } from "./simulator";

// ── Types ────────────────────────────────────────────────────────────────────

export interface RawRateEstimate {
  t: number;
  q_Glc: number; q_Glc_sd: number;
  q_Lac: number; q_Lac_sd: number;
  q_Gln: number; q_Gln_sd: number;
  q_Glu: number; q_Glu_sd: number;
  q_NH4: number; q_NH4_sd: number;
}

export interface SmoothedRate {
  t: number;
  q_Glc: number; q_Glc_lo95: number; q_Glc_hi95: number;
  q_Lac: number; q_Lac_lo95: number; q_Lac_hi95: number;
  q_Gln: number; q_Gln_lo95: number; q_Gln_hi95: number;
  q_Glu: number; q_Glu_lo95: number; q_Glu_hi95: number;
  q_NH4: number; q_NH4_lo95: number; q_NH4_hi95: number;
}

export interface MetRaCNoiseConfig {
  Xv_cv:   number;  // coefficient of variation for VCD    (e.g. 0.05)
  Glc_abs: number;  // absolute σ for glucose               [mM]
  Lac_abs: number;  // absolute σ for lactate               [mM]
  Gln_abs: number;  // absolute σ for glutamine             [mM]
  Glu_abs: number;  // absolute σ for glutamate             [mM]
  NH4_abs: number;  // absolute σ for ammonium              [mM]
}

export const DEFAULT_METRAC_NOISE: MetRaCNoiseConfig = {
  Xv_cv:   0.05,
  Glc_abs: 0.30,
  Lac_abs: 0.40,
  Gln_abs: 0.15,
  Glu_abs: 0.08,
  NH4_abs: 0.10,
};

// ── Step 1: Finite-difference rates ──────────────────────────────────────────

/**
 * Estimate raw specific rates from noisy concentration measurements.
 *
 * For each consecutive triplet (or pair at boundaries), computes:
 *   dC/dt ≈ (C_{k+1} − C_{k−1}) / (t_{k+1} − t_{k−1})   [centered]
 *   q = −dC/dt / Xv                                         [between boluses]
 *
 * Uncertainty via Gaussian error propagation:
 *   Var(dC/dt) ≈ (σ_C² + σ_C²) / Δt²   [centered]  or  σ_C² / Δt²  [forward/backward]
 *   Var(q)     = Var(dC/dt) / Xv² + q² · Var(Xv) / Xv²
 */
export function estimateRawRates(
  measurements: NoisyMeasurement[],
  noise: MetRaCNoiseConfig,
): RawRateEstimate[] {
  const n = measurements.length;
  if (n < 2) return [];

  const results: RawRateEstimate[] = [];

  for (let k = 0; k < n; k++) {
    const prev = measurements[Math.max(0, k - 1)];
    const curr = measurements[k];
    const next = measurements[Math.min(n - 1, k + 1)];

    let dt: number, factor: number;
    if (k === 0) {
      dt = next.t - curr.t; factor = 1;
    } else if (k === n - 1) {
      dt = curr.t - prev.t; factor = 1;
    } else {
      dt = next.t - prev.t; factor = 2;
    }

    if (dt < 1e-9) continue;

    // Numerical derivatives (mmol/mL/day → we keep mM/day = mmol/L/day; consistent with q_* units)
    const dGlc = (next.Glc - prev.Glc) / dt;
    const dLac = (next.Lac - prev.Lac) / dt;
    const dGln = (next.Gln - prev.Gln) / dt;
    const dGlu = (next.Glu - prev.Glu) / dt;
    const dNH4 = (next.NH4 - prev.NH4) / dt;
    const Xv   = curr.Xv;

    const eps = 1e-4;
    const safXv = Math.max(Xv, eps);

    const q_Glc = -dGlc / safXv;
    const q_Lac =  dLac / safXv;
    const q_Gln = -dGln / safXv;
    const q_Glu = -dGlu / safXv;
    const q_NH4 =  dNH4 / safXv;

    // Error propagation
    const varXv  = (safXv * noise.Xv_cv) ** 2;
    const nDiff  = factor === 2 ? 2 : 1;  // number of noisy points in numerator

    function qSD(sigma_C: number, q_i: number): number {
      const varDdt = nDiff * sigma_C ** 2 / dt ** 2;
      const varQ   = varDdt / safXv ** 2 + q_i ** 2 * varXv / safXv ** 2;
      return Math.sqrt(Math.max(varQ, 1e-12));
    }

    results.push({
      t:        curr.t,
      q_Glc,   q_Glc_sd: qSD(noise.Glc_abs, q_Glc),
      q_Lac,   q_Lac_sd: qSD(noise.Lac_abs, q_Lac),
      q_Gln,   q_Gln_sd: qSD(noise.Gln_abs, q_Gln),
      q_Glu,   q_Glu_sd: qSD(noise.Glu_abs, q_Glu),
      q_NH4,   q_NH4_sd: qSD(noise.NH4_abs, q_NH4),
    });
  }

  return results;
}

// ── Step 2: Nadaraya-Watson kernel smoother ───────────────────────────────────

/**
 * Gaussian kernel smoother with variance propagation.
 *
 * At each output time t*:
 *   q̂(t*) = Σ w_k · q_k / Σ w_k          [weighted mean]
 *   w_k    = K(t*, t_k) / σ²_k            [inverse-variance weighted by kernel]
 *   K(t*,t_k) = exp(−|t* − t_k|² / 2h²)  [Gaussian kernel]
 *   Var(q̂)  = 1 / Σ w_k                  [posterior variance, conjugate Gaussian]
 *
 * @param h  Bandwidth [days]. Default 1.5 days.
 */
function kernelSmooth(
  outputTimes: number[],
  rawEstimates: RawRateEstimate[],
  key: keyof RawRateEstimate,
  sdKey: keyof RawRateEstimate,
  h = 1.5,
): { mean: number[]; lo95: number[]; hi95: number[] } {
  const means:   number[] = [];
  const lo95s:   number[] = [];
  const hi95s:   number[] = [];

  for (const t_star of outputTimes) {
    let wSum = 0, wySum = 0, w2s2Sum = 0;

    for (const r of rawEstimates) {
      const K  = Math.exp(-((t_star - r.t) ** 2) / (2 * h * h));
      const sd = (r[sdKey] as number) + 1e-12;
      const w  = K / (sd * sd);
      wSum  += w;
      wySum += w * (r[key] as number);
      w2s2Sum += w * w * sd * sd;
    }

    if (wSum < 1e-12) {
      means.push(0); lo95s.push(0); hi95s.push(0);
    } else {
      const mean = wySum / wSum;
      const varPost = w2s2Sum / (wSum * wSum);
      const sd95 = 1.96 * Math.sqrt(varPost);
      means.push(mean);
      lo95s.push(mean - sd95);
      hi95s.push(mean + sd95);
    }
  }
  return { mean: means, lo95: lo95s, hi95: hi95s };
}

// ── Step 3: Full MetRaC pipeline ─────────────────────────────────────────────

/**
 * Run the MetRaC pipeline on a set of noisy measurements.
 *
 * @param measurements   Noisy concentration time-series (from generateNoisyMeasurements)
 * @param noise          Noise configuration (must match what was used to generate measurements)
 * @param outputTimes    Dense time grid for the smoothed output [days]
 * @param bandwidth      Kernel smoother bandwidth [days] (default 1.5)
 * @returns              Smoothed specific rate trajectories with 95% credible intervals
 */
export function runMetRaC(
  measurements: NoisyMeasurement[],
  noise: MetRaCNoiseConfig,
  outputTimes: number[],
  bandwidth = 1.5,
): SmoothedRate[] {
  const raw = estimateRawRates(measurements, noise);
  if (raw.length < 2) return [];

  const glc = kernelSmooth(outputTimes, raw, "q_Glc", "q_Glc_sd", bandwidth);
  const lac = kernelSmooth(outputTimes, raw, "q_Lac", "q_Lac_sd", bandwidth);
  const gln = kernelSmooth(outputTimes, raw, "q_Gln", "q_Gln_sd", bandwidth);
  const glu = kernelSmooth(outputTimes, raw, "q_Glu", "q_Glu_sd", bandwidth);
  const nh4 = kernelSmooth(outputTimes, raw, "q_NH4", "q_NH4_sd", bandwidth);

  return outputTimes.map((t, i) => ({
    t,
    q_Glc: glc.mean[i], q_Glc_lo95: glc.lo95[i], q_Glc_hi95: glc.hi95[i],
    q_Lac: lac.mean[i], q_Lac_lo95: lac.lo95[i], q_Lac_hi95: lac.hi95[i],
    q_Gln: gln.mean[i], q_Gln_lo95: gln.lo95[i], q_Gln_hi95: gln.hi95[i],
    q_Glu: glu.mean[i], q_Glu_lo95: glu.lo95[i], q_Glu_hi95: glu.hi95[i],
    q_NH4: nh4.mean[i], q_NH4_lo95: nh4.lo95[i], q_NH4_hi95: nh4.hi95[i],
  }));
}
