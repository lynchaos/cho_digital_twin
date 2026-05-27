/**
 * GEM Reduction Pipeline Page
 *
 * Interactive visualization of the iCHO1766 genome-scale model reduction
 * pipeline from Antonakoudis & Richelle (2026) npj Systems Biology and
 * Applications. https://doi.org/10.1038/s41540-026-00704-4
 *
 * The pipeline uses Bayesian MetRaC-derived CI bounds to systematically
 * prune iCHO1766 (6,663 reactions) to a compact ~860-reaction model suited
 * for real-time digital twin integration.
 */

import React, { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ── Static data from the paper ────────────────────────────────────────────────

interface PipelineStep {
  step: number;
  name: string;
  icon: string;
  method: string;
  desc: string;
  color: string;
  reactions?: number;
  metabolites?: number;
  genes?: number;
  tasks?: number;
  note?: string;
}

const PIPELINE: PipelineStep[] = [
  {
    step: 0, name: "Model Setup", icon: "⚙", method: "Manual curation",
    color: "#475569",
    desc: "Curate iCHO1766 for CHO-DG44 auxotrophies (Arg, Cys, Pro, Lys). Add fumarate/fucose exchange reactions missing from the original model. Set exchange bounds from 57 measured metabolites across all 12 cultures.",
    reactions: 6663, tasks: 155,
  },
  {
    step: 1, name: "Infeasibility Resolution", icon: "⚡", method: "Slack LP  (Eq. 3)",
    color: "#1d6fa5",
    desc: "For each time point, a slack-variable LP checks feasibility under imposed MetRaC bounds. If infeasible, minimal slack δ⁺/δ⁻ is added only to exchange reactions. Persistent infeasibilities get auxiliary demand reactions set to the minimum slack needed across all time points.",
    reactions: 4400, tasks: 136,
    note: "Network reduced by >1/3. No data-caused infeasibilities at 95% CI.",
  },
  {
    step: 2, name: "Exchange Pruning", icon: "🔍", method: "MILP  (Eq. 4)",
    color: "#2c9c56",
    desc: "Binary MILP (min Σwᵢ) identifies the smallest subset of exchange reactions needed for a feasible flux distribution at every time point. The MILP is solved separately at each time point and the union of active exchanges is retained.",
    tasks: 131,
    note: "Converges to 37 essential exchanges = 29 core metabolites + product + growth + 7 cofactors.",
  },
  {
    step: 3, name: "Transport Cleanup", icon: "🔄", method: "Biological rules",
    color: "#a05ca0",
    desc: "Each retained exchange typically has multiple possible transport mechanisms (passive diffusion, H⁺-coupled, Na⁺-coupled). Preference hierarchy: passive > proton-coupled > sodium-coupled. Redundant transport routes are removed.",
    note: "Eliminates MILP alternate-optima by fixing transport mechanism biologically.",
  },
  {
    step: 4, name: "pFBA Trimming", icon: "✂", method: "pFBA",
    color: "#e07b3c",
    desc: "Parsimonious FBA (minimise Σv² subject to max objective) is run at every experimental time point. Reactions that carry zero flux in every parsimonious solution are permanently removed. Dead-end metabolites arising from each removal are pruned by FVA.",
    reactions: 860, metabolites: 623, genes: 725, tasks: 105,
  },
  {
    step: 5, name: "Loop Removal", icon: "⟲", method: "Loopless FBA",
    color: "#c45252",
    desc: "Standard FBA vs. loopless FBA comparison across all time points and objectives (biomass + IgG1). Reactions active only under standard FBA (potential thermodynamic cycle participants) are flagged and removed.",
    reactions: 860, metabolites: 623, genes: 725, tasks: 105,
    note: "Structure unchanged — prior steps had already eliminated loop artifacts.",
  },
];

// CI threshold data — approximate from Fig. 1A–B
const CI_DATA = [
  { ci: "68%",  reactions: 770,  demandRxns: 10, tag: "Needs demand rxns" },
  { ci: "95%",  reactions: 860,  demandRxns: 0,  tag: "Optimal ★" },
  { ci: "99%",  reactions: 1040, demandRxns: 0,  tag: "Wider bounds" },
  { ci: "100%", reactions: 1260, demandRxns: 0,  tag: "Exact mean" },
];

// Subsystem data from Fig. 2A (% reaction reduction)
const SUBSYSTEM_DATA = [
  { name: "Exchange / Transport", pct: 92, color: "#1d6fa5" },
  { name: "Lipid Metabolism",     pct: 90, color: "#e07b3c" },
  { name: "Amino Acids",          pct: 73, color: "#2c9c56" },
  { name: "Nucleotides",          pct: 62, color: "#a05ca0" },
  { name: "Energy Metabolism",    pct: 34, color: "#c45252" },
];

// Method comparison (GIMME and constant-rate counts are approximate)
const METHOD_CMP = [
  {
    method: "MetRaC 95% CI",
    reactions: 860, metabolites: 623, genes: 725, tasks: "105/155",
    demandRxns: "None ✓", best: true,
  },
  {
    method: "Constant rate (α = 0.3)",
    reactions: 1075, metabolites: 700, genes: 810, tasks: "~100/155",
    demandRxns: "Several ✗", best: false,
  },
  {
    method: "GIMME (transcriptomics)",
    reactions: 1200, metabolites: 720, genes: 900, tasks: "<105/155",
    demandRxns: "Many ✗", best: false,
  },
];

// 29 core metabolites (★ = CHO-DG44 auxotrophy)
const CORE_METS: { name: string; aux: boolean }[] = [
  "Acetate", "Alanine", "Asparagine", "Aspartate", "Citrate",
  "Cystine", "Formate", "Fumarate", "Glucose", "Glutamine",
  "Glutamate", "Glycine", "Histidine", "Isoleucine", "Lactate",
  "Leucine", "Methionine", "Ammonium", "Phenylalanine",
  "Serine", "Succinate", "Threonine", "Tryptophan", "Tyrosine", "Valine",
].map((n) => ({ name: n, aux: false })).concat([
  { name: "Arginine",  aux: true },
  { name: "Cysteine",  aux: true },
  { name: "Lysine",    aux: true },
  { name: "Proline",   aux: true },
]).sort((a, b) => a.name.localeCompare(b.name));

const COFACTORS = ["CO₂", "H⁺", "H₂O", "HCO₃⁻", "O₂", "SO₄²⁻", "Pᵢ"];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function GEMReductionPage() {
  const [activeStep, setActiveStep] = useState<number | null>(null);

  const sel = activeStep !== null ? PIPELINE[activeStep] : null;

  return (
    <div className="gem-page">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="gem-header">
        <div>
          <h1 className="gem-title">GEM Reduction Pipeline</h1>
          <p className="gem-subtitle">
            Uncertainty-aware iCHO1766 → compact model for digital twin integration ·{" "}
            <a href="https://doi.org/10.1038/s41540-026-00704-4" target="_blank"
              rel="noopener" className="gem-paper-link">
              Antonakoudis & Richelle (2026) npj Syst. Biol. Appl.
            </a>
          </p>
        </div>
        <div className="gem-kpi-row">
          <div className="gem-kpi">
            <span className="gem-kpi-val">6,663</span>
            <span className="gem-kpi-lab">original reactions</span>
          </div>
          <span className="gem-kpi-arrow">→</span>
          <div className="gem-kpi">
            <span className="gem-kpi-val gem-kpi-green">860</span>
            <span className="gem-kpi-lab">reduced reactions</span>
          </div>
          <div className="gem-kpi">
            <span className="gem-kpi-val gem-kpi-red">−87%</span>
            <span className="gem-kpi-lab">compression</span>
          </div>
          <div className="gem-kpi">
            <span className="gem-kpi-val">105<span style={{ fontWeight: 400, fontSize: "0.75rem" }}>/155</span></span>
            <span className="gem-kpi-lab">tasks retained</span>
          </div>
        </div>
      </div>

      {/* ── Algorithm box ───────────────────────────────────────────────────── */}
      <div className="gem-algo-box">
        <strong>Pipeline:</strong>&nbsp;
        (0) Curate iCHO1766 → (1) Slack LP resolves infeasibilities → (2) MILP selects 37 essential exchanges →
        (3) Transport deduplication → (4) pFBA zeros out unused reactions → (5) Loopless FBA removes cycles.
        MetRaC 95% CI bounds constrain all steps.
        &nbsp;<span className="gem-algo-note">
          Implemented in COBRApy with HiGHS LP/MILP solver.
          Applied to 12 CHO DG44 fed-batch cultures (Ambr® 250, 14 days, ~60 measured metabolites).
        </span>
      </div>

      {/* ── Pipeline steps ──────────────────────────────────────────────────── */}
      <div className="gem-section-label">5-Step Pipeline — click any step for details</div>
      <div className="gem-pipeline-track">
        {PIPELINE.map((step, i) => (
          <React.Fragment key={step.step}>
            <div
              className={`gem-step-card${activeStep === i ? " gem-step-active" : ""}`}
              style={{ "--sc": step.color } as React.CSSProperties}
              onClick={() => setActiveStep(activeStep === i ? null : i)}>
              <div className="gem-step-icon">{step.icon}</div>
              <div className="gem-step-num">Step {step.step}</div>
              <div className="gem-step-name">{step.name}</div>
              <div className="gem-step-method">{step.method}</div>
              {step.reactions !== undefined && (
                <div className="gem-step-rxn">{step.reactions.toLocaleString()} rxns</div>
              )}
              {step.tasks !== undefined && (
                <div className="gem-step-tasks">{step.tasks}/155 tasks</div>
              )}
            </div>
            {i < PIPELINE.length - 1 && (
              <div className="gem-step-arrow">▶</div>
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step detail */}
      {sel && (
        <div className="gem-step-detail" style={{ borderLeftColor: sel.color }}>
          <div className="gem-step-detail-hd">
            <strong>Step {sel.step} — {sel.name}</strong>
            <span className="gem-method-badge" style={{ background: sel.color }}>{sel.method}</span>
          </div>
          <p className="gem-step-detail-body">{sel.desc}</p>
          {sel.note && <p className="gem-step-detail-note">💡 {sel.note}</p>}
          {(sel.reactions !== undefined || sel.metabolites !== undefined) && (
            <div className="gem-step-chips">
              {sel.reactions !== undefined && (
                <span className="gem-chip">{sel.reactions.toLocaleString()} reactions</span>
              )}
              {sel.metabolites !== undefined && (
                <span className="gem-chip">{sel.metabolites} metabolites</span>
              )}
              {sel.genes !== undefined && (
                <span className="gem-chip">{sel.genes} genes</span>
              )}
              {sel.tasks !== undefined && (
                <span className="gem-chip">{sel.tasks}/155 tasks</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Chart row ───────────────────────────────────────────────────────── */}
      <div className="gem-charts-row">

        {/* CI threshold analysis */}
        <div className="gem-chart-card">
          <h3 className="gem-chart-title">CI Threshold vs. Network Size</h3>
          <p className="gem-chart-sub">
            MetRaC bounds at four CI levels. 95% CI gives the smallest model that is
            fully feasible without extra demand reactions. Wider bounds reopen exchange directions,
            increasing network size.
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={CI_DATA} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
              <XAxis dataKey="ci" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} width={52}
                label={{ value: "Reactions", angle: -90, position: "insideLeft", fontSize: 9, dx: 10 }} />
              <Tooltip
                formatter={(v: number, _n: string, p: { payload: typeof CI_DATA[0] }) => [
                  `${v.toLocaleString()} (${p.payload.demandRxns > 0 ? p.payload.demandRxns + " demand rxns" : "no demand rxns"})`,
                  "Reactions",
                ]}
                contentStyle={{ fontSize: 10 }} />
              <Bar dataKey="reactions" radius={[3, 3, 0, 0]}>
                {CI_DATA.map((d, i) => (
                  <Cell key={i} fill={d.ci === "95%" ? "#1d4ed8" : d.demandRxns > 0 ? "#f59e0b" : "#94a3b8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="gem-ci-legend">
            {CI_DATA.map((d) => (
              <div key={d.ci}
                className={`gem-ci-chip${d.ci === "95%" ? " gem-ci-opt" : d.demandRxns > 0 ? " gem-ci-warn" : ""}`}>
                <strong>{d.ci}</strong> {d.tag}
              </div>
            ))}
          </div>
        </div>

        {/* Subsystem breakdown */}
        <div className="gem-chart-card">
          <h3 className="gem-chart-title">Subsystem Compression</h3>
          <p className="gem-chart-sub">
            % of reactions removed per metabolic subsystem at 95% CI.
            Energy metabolism is the most preserved; exchange/transport most aggressively pruned.
          </p>
          <div className="gem-subsys-list">
            {SUBSYSTEM_DATA.map((d) => (
              <div key={d.name} className="gem-subsys-row">
                <span className="gem-subsys-name">{d.name}</span>
                <div className="gem-subsys-track">
                  <div className="gem-subsys-fill"
                    style={{ width: `${d.pct}%`, background: d.color }} />
                </div>
                <span className="gem-subsys-pct">−{d.pct}%</span>
              </div>
            ))}
          </div>
          <p className="gem-chart-sub" style={{ marginTop: "0.5rem" }}>
            Overall: 87% reaction reduction, 92% fewer exchange reactions, 73% fewer amino-acid pathways.
          </p>
        </div>

        {/* Method comparison */}
        <div className="gem-chart-card">
          <h3 className="gem-chart-title">Method Comparison</h3>
          <p className="gem-chart-sub">
            MetRaC uncertainty-aware reduction vs. constant-rate and GIMME (transcriptomics-guided) baselines.
            MetRaC requires no artificial demand reactions and achieves better task coverage.
          </p>
          <table className="gem-cmp-table">
            <thead>
              <tr>
                <th>Method</th>
                <th>Rxns</th>
                <th>Tasks</th>
                <th>Demand</th>
              </tr>
            </thead>
            <tbody>
              {METHOD_CMP.map((m) => (
                <tr key={m.method} className={m.best ? "gem-cmp-best" : ""}>
                  <td>{m.method}{m.best && <span className="gem-best-badge">★ Best</span>}</td>
                  <td className="gem-td-num">{m.reactions.toLocaleString()}</td>
                  <td className="gem-td-num">{m.tasks}</td>
                  <td className="gem-td-num">{m.demandRxns}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="gem-chart-sub" style={{ marginTop: "0.6rem" }}>
            MetRaC is ~20% smaller than constant-rate reductions and achieves more metabolic
            tasks than GIMME — despite using only extracellular (no transcriptomic) data.
            <br />Shared with GIMME: 488 metabolites, 551 reactions, 509 genes.
          </p>
        </div>
      </div>

      {/* ── Lower row: metabolites + equations ──────────────────────────────── */}
      <div className="gem-lower-row">

        {/* Core metabolites */}
        <div className="gem-mets-card">
          <h3 className="gem-chart-title">37 Essential Exchanges — Step 2 MILP Result</h3>
          <p className="gem-chart-sub">
            The MILP converges to exactly this set across all 12 cultures × 14 days.
            ★ = CHO-DG44 auxotrophic amino acid (pathway blocked, must be supplied exogenously).
          </p>
          <div className="gem-mets-block">
            <div className="gem-mets-label">29 Core Metabolites</div>
            <div className="gem-mets-grid">
              {CORE_METS.map((m) => (
                <div key={m.name} className={`gem-met-chip${m.aux ? " gem-met-aux" : ""}`}>
                  {m.name}{m.aux && <span className="gem-aux-star">★</span>}
                </div>
              ))}
            </div>
          </div>
          <div className="gem-mets-block" style={{ marginTop: "0.6rem" }}>
            <div className="gem-mets-label">Essential Cofactors + Product/Growth</div>
            <div className="gem-mets-grid">
              {COFACTORS.map((m) => (
                <div key={m} className="gem-met-chip gem-met-cofactor">{m}</div>
              ))}
              <div className="gem-met-chip gem-met-product">IgG1 mAb</div>
              <div className="gem-met-chip gem-met-product">μ_eff</div>
            </div>
          </div>
        </div>

        {/* Key equations */}
        <div className="gem-eq-card">
          <h3 className="gem-chart-title">Key Optimisation Formulations</h3>

          <div className="gem-eq-block">
            <div className="gem-eq-label">Step 1 — Infeasibility slack LP (Eq. 3)</div>
            <pre className="gem-eq-pre">{`min   Σᵢ (δᵢ⁻ + δᵢ⁺)
s.t.  S · v  = 0
      vᵢ ≥ LBᵢ − δᵢ⁻    ∀i
      vᵢ ≤ UBᵢ + δᵢ⁺    ∀i
      δᵢ⁻, δᵢ⁺ ≥ 0
      δ  = 0  if i ∉ exchange reactions`}</pre>
          </div>

          <div className="gem-eq-block">
            <div className="gem-eq-label">Step 2 — Exchange pruning MILP (Eq. 4)</div>
            <pre className="gem-eq-pre">{`min   Σᵢ wᵢ               (wᵢ ∈ {0,1})
s.t.  S · v = 0
      vᵢ ≤ wᵢ · UBᵢ       ∀i ∈ removable
      vᵢ ≥ wᵢ · LBᵢ + ε   ∀i ∈ removable`}</pre>
          </div>

          <div className="gem-eq-block">
            <div className="gem-eq-label">Constant-rate baseline (Eq. 1 — comparison only)</div>
            <pre className="gem-eq-pre">{`Rateᵢᴹ = (Cᵢᴹ − Cᵢ₋₁ᴹ − Fᵢ₋₁ᴹ) / IVCD
Bounds: Rateᵢᴹ ± α · |Rateᵢᴹ|   (α user-defined)`}</pre>
          </div>

          <div className="gem-eq-note">
            <strong>MetRaC vs. constant rate:</strong> MetRaC models each rate as a linear combination
            of logistic basis functions with posterior estimated via nested sampling —
            giving time-resolved CI bounds rather than point estimates with arbitrary α bounds.
            This avoids spurious spikes and biologically implausible sign flips common in constant-rate profiles.
          </div>
        </div>
      </div>

      {/* ── Link to PC-dFBA ──────────────────────────────────────────────────── */}
      <div className="gem-link-box">
        <span className="gem-link-icon">⬡</span>
        <div>
          <strong>Connection to PC-dFBA:</strong> The reduced iCHO1766 model (860 reactions) produced
          here is the intended input to the PC-dFBA framework (Richelle et al. 2025). Flux distributions from
          this model are projected onto principal metabolic coordinates via PCA, then used to train the PC-dFBA
          neural network. The condensed 10-metabolite / 16-reaction network in the PC-dFBA tab is a
          hand-approximation of the further reduction to core central carbon metabolism —
          the systematic version would be this pipeline applied iteratively.
        </div>
      </div>

    </div>
  );
}
