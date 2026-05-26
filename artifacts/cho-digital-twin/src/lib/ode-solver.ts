
/**
 * 4th-order Runge-Kutta (RK4) ODE integrator
 *
 * Integrates systems of the form:
 *   dy/dt = f(t, y)
 *
 * where y is an arbitrary-length numeric vector.
 */

export type ODEFn = (t: number, y: number[]) => number[];

/** Single RK4 step: advance state y from t to t+dt */
export function rk4Step(f: ODEFn, t: number, y: number[], dt: number): number[] {
  const n = y.length;

  const k1 = f(t, y);
  const y2 = y.map((v, i) => v + 0.5 * dt * k1[i]);

  const k2 = f(t + 0.5 * dt, y2);
  const y3 = y.map((v, i) => v + 0.5 * dt * k2[i]);

  const k3 = f(t + 0.5 * dt, y3);
  const y4 = y.map((v, i) => v + dt * k3[i]);

  const k4 = f(t + dt, y4);

  return y.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}

export interface IntegrationOptions {
  /** Fixed time step size in days (default 0.01) */
  dt?: number;
  /** Callback called after each step; return false to stop early */
  onStep?: (t: number, y: number[]) => void;
}

/**
 * Integrate an ODE system from t0 to tEnd, recording state at each output time.
 *
 * @param f          Right-hand side: f(t, y) → dy/dt
 * @param y0         Initial state vector
 * @param t0         Start time
 * @param tEnd       End time
 * @param outputTimes Times at which to record the solution (must be sorted ascending)
 * @param opts       Integration options
 * @returns          Array of state vectors at outputTimes
 */
export function integrate(
  f: ODEFn,
  y0: number[],
  t0: number,
  tEnd: number,
  outputTimes: number[],
  opts: IntegrationOptions = {},
): number[][] {
  const dt = opts.dt ?? 0.01;
  let t = t0;
  let y = [...y0];
  const results: number[][] = [];
  let outIdx = 0;

  // Collect initial state if t0 is in outputTimes
  while (outIdx < outputTimes.length && outputTimes[outIdx] <= t + 1e-10) {
    results.push([...y]);
    outIdx++;
  }

  while (t < tEnd - 1e-10 && outIdx < outputTimes.length) {
    const nextOut = outputTimes[outIdx];
    // Integrate up to the next output time
    while (t < nextOut - 1e-10) {
      const stepDt = Math.min(dt, nextOut - t);
      y = rk4Step(f, t, y, stepDt);
      t += stepDt;
      opts.onStep?.(t, y);
    }
    results.push([...y]);
    outIdx++;
  }

  return results;
}
