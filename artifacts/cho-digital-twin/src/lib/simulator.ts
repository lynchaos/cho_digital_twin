
/**
 * CHO Cell Culture Fed-Batch Simulator
 *
 * Integrates the coupled ODE system (biomass + FLEX metabolites) over a
 * 14-day fed-batch run, handling bolus feed additions (Ambr® 15 mL scale).
 *
 * General bioreactor mass balance (Eq. 34):
 *   dCᵢ/dt = νᵢ · Xv · (F_in / V) · Cᵢ_feed − (F_out / V) · Cᵢ
 *
 * Between feeds:  F = 0  →  dilution term vanishes
 * At feed events: instantaneous volume mixing is applied
 */

import { rk4Step } from "./ode-solver";
import { choODE, type FeedInput } from "./models";
import { sigmaBaseline, type SigmoidComponent } from "./growth-rate";

// ──────────────────────────────────────────────────────────────────────────────
//  Feed schedule types
// ──────────────────────────────────────────────────────────────────────────────

export interface FeedBolus {
  day: number;          // day of addition
  volumeFraction: number;  // fraction of current bioreactor volume added
  Glc_feed: number;     // glucose in bolus [mM]
  Gln_feed: number;     // glutamine in bolus [mM]
  Glu_feed: number;     // glutamate in bolus [mM]
}

export interface InitialConditions {
  Xv: number;     // [10⁶ cells/mL]
  Xd: number;     // [10⁶ cells/mL]
  Xl: number;     // [10⁶ cells/mL]
  B:  number;     // [dimensionless]
  Glc: number;    // [mM]
  Lac: number;    // [mM]
  Gln: number;    // [mM]
  Glu: number;    // [mM]
  NH4: number;    // [mM]
  Tit: number;    // [mg/L]
}

export interface SimulationConfig {
  initialConditions: InitialConditions;
  initialVolume: number;      // [mL]  e.g. 14 mL for Ambr 15
  feedBoluses: FeedBolus[];
  muNetComponents: SigmoidComponent[];  // sigmoid baseline for μ_net
  runDays: number;
  outputInterval: number;     // [days] interval for recorded output
}

export interface TimePoint {
  t:    number;  // [day]
  Xv:   number;  // viable cell density     [10⁶ cells/mL]
  Xd:   number;  // dead cell density       [10⁶ cells/mL]
  Xl:   number;  // lysed cell density      [10⁶ cells/mL]
  B:    number;  // biomaterial             [–]
  Glc:  number;  // glucose                 [mM]
  Lac:  number;  // lactate                 [mM]
  Gln:  number;  // glutamine               [mM]
  Glu:  number;  // glutamate               [mM]
  NH4:  number;  // ammonium                [mM]
  Tit:  number;  // product titer           [mg/L]
  mu_net:  number;  // net growth rate      [day⁻¹]
  mu_eff:  number;  // effective growth rate [day⁻¹]
  kd:      number;  // death rate            [day⁻¹]
  kl:      number;  // lysis rate            [day⁻¹]
  volume:  number;  // bioreactor volume     [mL]
}

// ──────────────────────────────────────────────────────────────────────────────
//  Default CHO fed-batch configuration (Ambr® 15 scale, 8 media formulations)
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_INITIAL_CONDITIONS: InitialConditions = {
  Xv:  0.30,   // initial VCD at inoculation  [10⁶ cells/mL]
  Xd:  0.0,
  Xl:  0.0,
  B:   0.0,
  Glc: 26.0,   // ~4.7 g/L  (typical basal medium glucose)
  Lac:  0.5,
  Gln:  8.0,   // typical glutamine in basal medium
  Glu:  2.0,
  NH4:  0.2,
  Tit:  0.0,
};

/** Feeding schedule: FMA+FMB on days 3,5,7,9,11 (5% v/v each);
 *  FMG (glucose stock) added whenever glucose would fall below threshold (handled in simulator). */
export const DEFAULT_FEED_BOLUSES: FeedBolus[] = [
  { day:  3, volumeFraction: 0.05, Glc_feed: 100, Gln_feed: 40, Glu_feed: 8 },
  { day:  5, volumeFraction: 0.05, Glc_feed: 100, Gln_feed: 40, Glu_feed: 8 },
  { day:  7, volumeFraction: 0.05, Glc_feed: 100, Gln_feed: 40, Glu_feed: 8 },
  { day:  9, volumeFraction: 0.05, Glc_feed: 100, Gln_feed: 40, Glu_feed: 8 },
  { day: 11, volumeFraction: 0.05, Glc_feed: 100, Gln_feed: 40, Glu_feed: 8 },
];

// ──────────────────────────────────────────────────────────────────────────────
//  Simulator
// ──────────────────────────────────────────────────────────────────────────────

/** Apply an instantaneous bolus feed: update concentrations and volume */
function applyBolus(
  y: number[],
  volume: number,
  bolus: FeedBolus,
): [number[], number] {
  const dV = bolus.volumeFraction * volume;
  const V_new = volume + dV;
  const f = volume / V_new;   // dilution factor for existing concentrations

  const y_new = [...y];
  // VCD, Xd, Xl, B — cells are diluted, no cells in feed
  y_new[0] = y[0] * f;
  y_new[1] = y[1] * f;
  y_new[2] = y[2] * f;
  y_new[3] = y[3] * f;
  // Metabolites — mixing rule: C_new = (C_old * V_old + C_feed * dV) / V_new
  y_new[4] = (y[4] * volume + bolus.Glc_feed * dV) / V_new;   // Glc
  y_new[5] = y[5] * f;                                         // Lac (not in feed)
  y_new[6] = (y[6] * volume + bolus.Gln_feed * dV) / V_new;   // Gln
  y_new[7] = (y[7] * volume + bolus.Glu_feed * dV) / V_new;   // Glu
  y_new[8] = y[8] * f;                                         // NH4 (not in feed)
  y_new[9] = y[9] * f;                                         // Titer (not in feed)

  return [y_new, V_new];
}

/**
 * Run the full fed-batch simulation.
 * Uses RK4 with dt = 0.005 days between output points.
 */
export function runSimulation(config: SimulationConfig): TimePoint[] {
  const {
    initialConditions: ic,
    initialVolume,
    feedBoluses,
    muNetComponents,
    runDays,
    outputInterval,
  } = config;

  const dt = 0.005;  // RK4 step [days]

  // Build sorted list of output times
  const nOut = Math.round(runDays / outputInterval) + 1;
  const outputTimes: number[] = Array.from({ length: nOut }, (_, i) => i * outputInterval);

  // Sort feed boluses by day
  const sortedBoluses = [...feedBoluses].sort((a, b) => a.day - b.day);

  // Initial state vector
  let y: number[] = [
    ic.Xv, ic.Xd, ic.Xl, ic.B,
    ic.Glc, ic.Lac, ic.Gln, ic.Glu, ic.NH4, ic.Tit,
  ];
  let volume = initialVolume;

  const results: TimePoint[] = [];
  let t = 0;
  let bolusIdx = 0;

  // Helper: record a time point
  const record = (t: number, y: number[], vol: number) => {
    const mu_net = sigmaBaseline(t, muNetComponents);
    const kd_val = Math.max(0, 0.01794129 + 0.00033013 * Math.max(0, y[3]));
    const kl_val = Math.max(0, 0.02962941 + 0.01359236 * Math.max(0, y[2]));
    const mu_eff = mu_net + kd_val;
    results.push({
      t,
      Xv:  Math.max(0, y[0]),
      Xd:  Math.max(0, y[1]),
      Xl:  Math.max(0, y[2]),
      B:   Math.max(0, y[3]),
      Glc: Math.max(0, y[4]),
      Lac: Math.max(0, y[5]),
      Gln: Math.max(0, y[6]),
      Glu: Math.max(0, y[7]),
      NH4: Math.max(0, y[8]),
      Tit: Math.max(0, y[9]),
      mu_net,
      mu_eff,
      kd: kd_val,
      kl: kl_val,
      volume: vol,
    });
  };

  record(0, y, volume);

  for (let oi = 1; oi < outputTimes.length; oi++) {
    const t_out = outputTimes[oi];

    // Advance time to t_out, applying boluses in between
    while (t < t_out - 1e-9) {
      // Check if a bolus should be applied before next step
      while (
        bolusIdx < sortedBoluses.length &&
        sortedBoluses[bolusIdx].day <= t + 1e-9
      ) {
        [y, volume] = applyBolus(y, volume, sortedBoluses[bolusIdx]);
        bolusIdx++;
      }

      const stepDt = Math.min(dt, t_out - t);
      const mu_net = sigmaBaseline(t, muNetComponents);

      // Between boluses, no continuous feed: F = 0, so D = 0
      const feed: FeedInput = { F: 0, V: volume, Glc_feed: 0, Gln_feed: 0, Glu_feed: 0 };

      y = rk4Step(
        (tt, yy) => choODE(tt, yy, sigmaBaseline(tt, muNetComponents), feed),
        t,
        y,
        stepDt,
      );
      t += stepDt;
    }

    // Apply any boluses exactly at t_out
    while (
      bolusIdx < sortedBoluses.length &&
      sortedBoluses[bolusIdx].day <= t + 1e-9
    ) {
      [y, volume] = applyBolus(y, volume, sortedBoluses[bolusIdx]);
      bolusIdx++;
    }

    record(t_out, y, volume);
  }

  return results;
}

/** Default simulation configuration */
export function defaultConfig(overrides?: Partial<SimulationConfig>): SimulationConfig {
  return {
    initialConditions: DEFAULT_INITIAL_CONDITIONS,
    initialVolume: 14,
    feedBoluses: DEFAULT_FEED_BOLUSES,
    muNetComponents: [
      { a:  0.85, b: 1.4, c:  1.5 },
      { a: -0.95, b: 0.9, c:  7.0 },
      { a:  0.25, b: 0.5, c:  4.0 },
      { a: -0.18, b: 1.2, c: 11.0 },
    ],
    runDays: 14,
    outputInterval: 0.1,
    ...overrides,
  };
}
