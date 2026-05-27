
/**
 * Surrogate Neural Network for μ_net — §2.3 Richelle et al. (2025)
 *
 * Architecture: 5 inputs → 8 hidden (tanh) → 1 output (linear)
 * Inputs (normalised): [t/14, Glc/30, Gln/10, Lac/60, NH4/25]
 * Output: μ_net [day⁻¹]
 *
 * The paper trains a NN on 23 proprietary fed-batch runs.  This module
 * implements the same architecture with weights calibrated (at runtime,
 * once) via Adam-SGD to match the sigmoid × Monod proxy.
 * Swap `CALIBRATED_WEIGHTS` with real weights when the dataset is available.
 */

export interface NNWeights {
  W1: number[];   // row-major  [N_H1 × N_IN]
  b1: number[];   // [N_H1]
  W2: number[];   // row-major  [N_OUT × N_H1]
  b2: number[];   // [N_OUT]
}

export const N_IN  = 5;
export const N_H1  = 8;
export const N_OUT = 1;

export const NN_NORM = { t: 14, Glc: 30, Gln: 10, Lac: 60, NH4: 25 } as const;

// ── Normalisation ──────────────────────────────────────────────────────────────
export function normaliseInputs(
  t: number, Glc: number, Gln: number, Lac: number, NH4: number,
): number[] {
  return [
    Math.min(t / NN_NORM.t,   1.5),
    Math.min(Math.max(Glc, 0) / NN_NORM.Glc, 1.5),
    Math.min(Math.max(Gln, 0) / NN_NORM.Gln, 1.5),
    Math.min(Math.max(Lac, 0) / NN_NORM.Lac, 1.5),
    Math.min(Math.max(NH4, 0) / NN_NORM.NH4, 1.5),
  ];
}

// ── Primitives ─────────────────────────────────────────────────────────────────
function affine(
  W: number[], nRows: number, nCols: number, x: number[], b: number[],
): number[] {
  const y = new Array<number>(nRows);
  for (let i = 0; i < nRows; i++) {
    let s = b[i];
    const off = i * nCols;
    for (let j = 0; j < nCols; j++) s += W[off + j] * x[j];
    y[i] = s;
  }
  return y;
}

// ── Forward pass ───────────────────────────────────────────────────────────────
export function forwardNN(
  t: number, Glc: number, Gln: number, Lac: number, NH4: number,
  w: NNWeights,
): number {
  const x   = normaliseInputs(t, Glc, Gln, Lac, NH4);
  const h   = affine(w.W1, N_H1, N_IN, x, w.b1).map(Math.tanh);
  return affine(w.W2, N_OUT, N_H1, h, w.b2)[0];
}

// ── Adam-SGD calibration ───────────────────────────────────────────────────────
function boxMuller(): number {
  const u1 = Math.random() + 1e-14, u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function makeWeights(): NNWeights {
  const s1 = Math.sqrt(2 / N_IN), s2 = Math.sqrt(2 / N_H1);
  return {
    W1: Array.from({ length: N_H1 * N_IN  }, () => boxMuller() * s1),
    b1: new Array<number>(N_H1).fill(0),
    W2: Array.from({ length: N_OUT * N_H1 }, () => boxMuller() * s2),
    b2: [0],
  };
}

/**
 * Calibrate the NN against a teacher function (sigmoid × Monod proxy).
 * Takes ≈ 5–15 ms for 3000 iterations on 500 training samples.
 */
export function calibrateNN(
  teacher: (t: number, Glc: number, Gln: number, Lac: number, NH4: number) => number,
  nIter = 3000,
  lr    = 0.004,
): NNWeights {
  const w = makeWeights();

  // Build synthetic training set covering realistic CHO fed-batch conditions
  const N = 600;
  const xs: number[][] = [];
  const ys: number[]   = [];
  for (let i = 0; i < N; i++) {
    const t   = Math.random() * 14;
    const Glc = 0.5 + Math.random() * 29;
    const Gln = Math.random() * 9.5;
    const Lac = Math.random() * 18;
    const NH4 = Math.random() * 20;
    xs.push(normaliseInputs(t, Glc, Gln, Lac, NH4));
    ys.push(teacher(t, Glc, Gln, Lac, NH4));
  }

  // Adam moments (regular arrays)
  const zero = (n: number) => new Array<number>(n).fill(0);
  const mW1 = zero(w.W1.length), vW1 = zero(w.W1.length);
  const mW2 = zero(w.W2.length), vW2 = zero(w.W2.length);
  const mb1 = zero(N_H1), vb1 = zero(N_H1);
  const mb2 = zero(N_OUT), vb2 = zero(N_OUT);

  const b1 = 0.9, b2 = 0.999, eps = 1e-8, B = 32;

  const adamStep = (
    p: number[], g: number[],
    m: number[], v: number[], step: number,
  ) => {
    for (let i = 0; i < p.length; i++) {
      m[i] = b1 * m[i] + (1 - b1) * g[i];
      v[i] = b2 * v[i] + (1 - b2) * g[i] ** 2;
      p[i] -= lr * (m[i] / (1 - b1 ** step)) / (Math.sqrt(v[i] / (1 - b2 ** step)) + eps);
    }
  };

  for (let iter = 1; iter <= nIter; iter++) {
    const gW1 = zero(w.W1.length), gb1 = zero(N_H1);
    const gW2 = zero(w.W2.length), gb2 = [0];

    const start = ((iter - 1) * B) % N;
    for (let di = 0; di < B; di++) {
      const idx = (start + di) % N;
      const x   = xs[idx], tgt = ys[idx];

      const pre = affine(w.W1, N_H1, N_IN, x, w.b1);
      const h   = pre.map(Math.tanh);
      const out = affine(w.W2, N_OUT, N_H1, h, w.b2)[0];

      const dOut = 2 * (out - tgt) / B;

      for (let i = 0; i < N_H1; i++) gW2[i] += dOut * h[i];
      gb2[0] += dOut;

      for (let i = 0; i < N_H1; i++) {
        const dh = dOut * w.W2[i] * (1 - h[i] ** 2);
        for (let j = 0; j < N_IN; j++) gW1[i * N_IN + j] += dh * x[j];
        gb1[i] += dh;
      }
    }

    adamStep(w.W1, gW1, mW1, vW1, iter);
    adamStep(w.b1, gb1, mb1, vb1, iter);
    adamStep(w.W2, gW2, mW2, vW2, iter);
    adamStep(w.b2, gb2, mb2, vb2, iter);
  }

  return w;
}
