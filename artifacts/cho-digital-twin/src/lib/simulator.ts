
/**
 * CHO Cell Culture Fed-Batch Simulator
 *
 * Integrates the coupled ODE system (biomass + FLEX metabolites) over a
 * 14-day fed-batch run, handling bolus feed additions (Ambr® 15 mL scale).
 */

import { rk4Step } from "./ode-solver";
import { choODE, type FeedInput } from "./models";
import { sigmaBaseline, type SigmoidComponent } from "./growth-rate";
import { DEFAULT_MODEL_PARAMS, type ModelParams } from "./parameters";

// ──────────────────────────────────────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────────────────────────────────────

export interface FeedBolus {
  day: number;
  volumeFraction: number;
  Glc_feed: number;   // [mM]
  Gln_feed: number;   // [mM]
  Glu_feed: number;   // [mM]
}

export interface InitialConditions {
  Xv: number; Xd: number; Xl: number; B: number;
  Glc: number; Lac: number; Gln: number; Glu: number; NH4: number; Tit: number;
}

export interface SimulationConfig {
  initialConditions: InitialConditions;
  initialVolume: number;
  feedBoluses: FeedBolus[];
  muNetComponents: SigmoidComponent[];
  modelParams: ModelParams;        // ← modifiable Table 1 parameters
  runDays: number;
  outputInterval: number;
}

export interface TimePoint {
  t: number; Xv: number; Xd: number; Xl: number; B: number;
  Glc: number; Lac: number; Gln: number; Glu: number; NH4: number; Tit: number;
  mu_net: number; mu_eff: number; kd: number; kl: number; volume: number;
}

// ──────────────────────────────────────────────────────────────────────────────
//  Defaults
// ──────────────────────────────────────────────────────────────────────────────

export const DEFAULT_INITIAL_CONDITIONS: InitialConditions = {
  Xv: 0.30, Xd: 0, Xl: 0, B: 0,
  Glc: 26.0, Lac: 0.5, Gln: 8.0, Glu: 2.0, NH4: 0.2, Tit: 0,
};

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

function applyBolus(y: number[], volume: number, bolus: FeedBolus): [number[], number] {
  const dV = bolus.volumeFraction * volume;
  const V_new = volume + dV;
  const f = volume / V_new;
  const y_new = [...y];
  y_new[0] = y[0] * f; y_new[1] = y[1] * f; y_new[2] = y[2] * f; y_new[3] = y[3] * f;
  y_new[4] = (y[4] * volume + bolus.Glc_feed * dV) / V_new;
  y_new[5] = y[5] * f;
  y_new[6] = (y[6] * volume + bolus.Gln_feed * dV) / V_new;
  y_new[7] = (y[7] * volume + bolus.Glu_feed * dV) / V_new;
  y_new[8] = y[8] * f;
  y_new[9] = y[9] * f;
  return [y_new, V_new];
}

export function runSimulation(config: SimulationConfig): TimePoint[] {
  const { initialConditions: ic, initialVolume, feedBoluses, muNetComponents,
          modelParams: mp, runDays, outputInterval } = config;

  const dt = 0.005;
  const nOut = Math.round(runDays / outputInterval) + 1;
  const outputTimes = Array.from({ length: nOut }, (_, i) => i * outputInterval);
  const sortedBoluses = [...feedBoluses].sort((a, b) => a.day - b.day);

  let y: number[] = [ic.Xv, ic.Xd, ic.Xl, ic.B, ic.Glc, ic.Lac, ic.Gln, ic.Glu, ic.NH4, ic.Tit];
  let volume = initialVolume;
  const results: TimePoint[] = [];
  let t = 0;
  let bolusIdx = 0;

  const record = (t: number, y: number[], vol: number) => {
    const mu_net = sigmaBaseline(t, muNetComponents);
    const kd_val = Math.max(0, mp.kd0 + mp.kd1 * Math.max(0, y[3]));
    const kl_val = Math.max(0, mp.kl0 + mp.kl1 * Math.max(0, y[2]));
    results.push({
      t,
      Xv: Math.max(0, y[0]), Xd: Math.max(0, y[1]), Xl: Math.max(0, y[2]),
      B:  Math.max(0, y[3]), Glc: Math.max(0, y[4]), Lac: Math.max(0, y[5]),
      Gln: Math.max(0, y[6]), Glu: Math.max(0, y[7]), NH4: Math.max(0, y[8]),
      Tit: Math.max(0, y[9]),
      mu_net, mu_eff: mu_net + kd_val, kd: kd_val, kl: kl_val, volume: vol,
    });
  };

  record(0, y, volume);

  for (let oi = 1; oi < outputTimes.length; oi++) {
    const t_out = outputTimes[oi];

    while (t < t_out - 1e-9) {
      while (bolusIdx < sortedBoluses.length && sortedBoluses[bolusIdx].day <= t + 1e-9) {
        [y, volume] = applyBolus(y, volume, sortedBoluses[bolusIdx++]);
      }
      const stepDt = Math.min(dt, t_out - t);
      const feed: FeedInput = { F: 0, V: volume, Glc_feed: 0, Gln_feed: 0, Glu_feed: 0 };
      y = rk4Step(
        (tt, yy) => choODE(tt, yy, sigmaBaseline(tt, muNetComponents), feed, mp),
        t, y, stepDt,
      );
      t += stepDt;
    }

    while (bolusIdx < sortedBoluses.length && sortedBoluses[bolusIdx].day <= t + 1e-9) {
      [y, volume] = applyBolus(y, volume, sortedBoluses[bolusIdx++]);
    }
    record(t_out, y, volume);
  }

  return results;
}

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
    modelParams: { ...DEFAULT_MODEL_PARAMS },
    runDays: 14,
    outputInterval: 0.1,
    ...overrides,
  };
}
