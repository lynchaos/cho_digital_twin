# From Lab Bench to Browser: A Live Digital Twin for CHO Cell Culture

*How a hybrid mechanistic-ML model, a genome-scale metabolic network, and a React web app are changing the way bioprocess engineers explore fed-batch bioreactors — without touching a single flask.*

---

## The Problem with Biologics Development

Monoclonal antibodies, recombinant proteins, vaccines. The medicines that have transformed oncology, immunology, and infectious disease over the past three decades are almost all made the same way: inside a living cell, in a stirred tank, fed a carefully tuned cocktail of nutrients over ten to fourteen days.

The host of choice is the Chinese Hamster Ovary (CHO) cell. CHO cells are robust, human-compatible in their protein glycosylation patterns, and well-understood — decades of industrial experience have turned them into the workhorse of biopharmaceutical manufacturing.

But "well-understood" is relative. A typical CHO fed-batch culture involves:

- Dozens of coupled metabolic reactions operating simultaneously
- Nutrient concentrations changing continuously as cells consume glucose and glutamine, secrete lactate and ammonium, and receive bolus feeds
- A net growth rate that depends nonlinearly on every one of those concentrations
- A product titer accumulating over two weeks, with a final quality profile that is exquisitely sensitive to culture conditions

Running experiments to explore this space takes weeks and costs thousands of dollars per bioreactor run. Scale-up from bench to manufacturing — from 15 mL ambr® to 2,000 L stainless — introduces further uncertainty. The fundamental challenge of bioprocess development is that the space of things you might want to know is vast, and experiments are expensive.

This is exactly the problem that mathematical modeling and digital twins are designed to solve.

---

## What Is a Digital Twin?

A digital twin is a computational replica of a physical system — one detailed enough to answer "what would happen if…" questions without running the physical experiment. In bioprocessing, a useful digital twin can tell you:

- What happens to titer if you increase the glucose setpoint by 5 mM on day 6?
- At what initial seeding density does the culture peak before nutrients are exhausted?
- Which metabolic pathways carry flux during exponential growth versus stationary phase?
- How sensitive is the final ammonia concentration to the glutamine feed rate?

Good answers to these questions can compress months of development work into days. They can flag failure modes before scale-up. They can support regulatory filings by demonstrating mechanistic understanding of the process.

The CHO Digital Twin app presented here is a live, interactive implementation of the state-of-the-art hybrid modeling framework published by **Richelle et al. (2025)** (*bioRxiv 2025.11.24.690194*) and extended with the GEM reduction pipeline from **Antonakoudis & Richelle (2026)** (*npj Systems Biology and Applications*). Every equation, every parameter, every algorithmic step is faithfully replicated — and placed directly in your browser.

---

## The Science: A Hybrid Model in Three Layers

### Layer 1: The ODE Kinetic Core

The foundation of the model is a system of ordinary differential equations (ODEs) describing how 8 state variables evolve over time in a fed-batch reactor:

| Variable | Meaning |
|---|---|
| X_v | Viable cell density (10⁶ cells/mL) |
| X_d | Dead cell density |
| X' | Lysed cell density |
| Glc | Glucose concentration (mM) |
| Lac | Lactate concentration (mM) |
| Gln | Glutamine concentration (mM) |
| Glu | Glutamate concentration (mM) |
| NH₄⁺ | Ammonium concentration (mM) |

Each state variable has a rate equation derived from first principles. Glucose, for example, is consumed by cells (at a specific uptake rate q_Glc that depends on the current growth rate and glucose concentration), diluted by feeding, and its metabolism is coupled to lactate production via a Warburg-like overflow stoichiometry that shifts as lactate accumulates. Glutamine spontaneously degrades to glutamate and ammonium — a side reaction that matters at physiological temperatures and must be accounted for.

In total, the kinetic model contains **26 coupled equations** (Eqs. 1–26 from the paper). All of them are implemented exactly, with all 40+ parameters at their published Table 1 values.

### Layer 2: The Net Growth Rate — Where Biology Meets Machine Learning

The cell growth rate μ_net is the master variable of the system. Every metabolite rate equation depends on it; the viable cell density trajectory is entirely determined by it.

Getting μ_net right is hard. It depends on multiple nutrients simultaneously, saturates as each nutrient becomes replete, and is inhibited by metabolic byproducts (lactate, ammonium). Richelle et al. model it as:

> **μ_net = μ_max · Σ A_k · B_k(T − C_k) · Π f_i(conc)**

where:
- The **logistic basis functions B_k** capture the temporal shape of the growth curve (exponential → stationary → decline)
- The **nutrient modulation terms f_i** apply Monod-style saturation for each nutrient (Glc, Gln) and inhibition terms for toxic byproducts (Lac, NH₄⁺)

The app provides three selectable implementations of this model:

1. **Sigmoid mode** — the exact mathematical form from Eq. 14 of the paper
2. **Monod proxy** — a biologically realistic reformulation that produces proper VCD trajectories tuned to match measured CHO DG44 fed-batch dynamics
3. **Surrogate Neural Network** — a single hidden-layer network (8 → 16 → 1 architecture) that is auto-calibrated from the Monod proxy at app load time, demonstrating how data-driven surrogates can replace mechanistic submodels in hybrid frameworks

The surrogate NN is a miniature example of the machine learning component that makes this a *hybrid* model: physics-based structure at the macro scale, data-driven flexibility where mechanistic knowledge is incomplete.

### Layer 3: PC-dFBA — Looking Inside the Cell

The ODE model tells you what concentrations look like in the bioreactor. But what is happening *inside* the cells? Which metabolic pathways are active? How much flux flows through glycolysis versus the TCA cycle?

This is where **Principal Component dynamic Flux Balance Analysis (PC-dFBA)** comes in.

Flux Balance Analysis (FBA) is a mathematical framework for computing steady-state metabolic fluxes through a metabolic network. Given:
- A stoichiometric matrix **S** describing all reactions
- Constraints on exchange fluxes (what enters and leaves the cell)
- An objective function (maximise growth, or minimise total flux via parsimonious FBA)

FBA finds the flux distribution that satisfies mass balance while optimising the objective. But a full genome-scale model has thousands of reactions — the solution space is high-dimensional and hard to interpret.

PC-dFBA (Richelle et al. 2025, Eqs. 27–33) solves this by:

1. **Reducing** the flux space to its principal components via PCA
2. **Tracking** how the PC trajectory evolves over the culture time course
3. **Identifying** which reactions and pathways dominate variance across conditions

The app implements this analytically for a condensed 10-metabolite / 16-reaction CHO network — no LP library required. The flux map renders as a live SVG showing flux magnitudes and directions across glycolysis, TCA cycle, amino acid metabolism, and biosynthesis nodes. Clicking any time point updates the entire flux map in real time.

---

## The GEM Reduction Pipeline: From 6,663 Reactions to 503

The condensed 10-met network used in PC-dFBA is powerful for visualization, but real cells have far more metabolic complexity. The **iCHOv1** genome-scale model (Hefzi et al. 2016) includes **6,663 reactions** across 4,456 metabolites spanning the entire known CHO metabolic network.

Using all 6,663 reactions for dynamic FBA would be computationally prohibitive and mathematically ill-constrained. The **GEM Reduction** tab implements the full 5-step pipeline from **Antonakoudis & Richelle (2026)** to compress iCHOv1 down to a tractable subnetwork:

### Step 0 — Model Curation
Apply CHO-DG44 auxotrophies: four amino acid biosynthesis pathways (arginine, cysteine, proline, lysine) are genetically blocked in this cell line and must be disabled in the model. Set exchange bounds from 57 metabolites measured across all 12 experimental cultures.

### Step 1 — Infeasibility Resolution (Slack LP, Eq. 3)
For each experimental time point, check whether the measured exchange flux bounds are simultaneously achievable. If not, solve a linear program that minimises the total slack required to restore feasibility — and add permanent demand reactions for exchanges that are persistently infeasible across cultures. At 95% CI bounds from MetRaC, zero demand reactions are needed. Tighter bounds (68% CI) force 10+ demand reactions.

### Step 2 — Exchange Pruning (MILP, Eq. 4)
A Mixed-Integer Linear Program asks: *what is the smallest subset of exchange reactions that still permits a feasible flux distribution at every time point?* The binary decision variable w_i = 1 if exchange i is retained. The MILP minimises Σw_i subject to mass balance and feasibility at each time point. Result: **37 essential exchanges** — 29 core metabolites, 7 cofactors, IgG1 product, and growth.

### Step 3 — Transport Deduplication
Each retained exchange metabolite can typically be transported across the plasma membrane via multiple mechanisms (passive diffusion, proton-coupled symport, sodium-coupled transport). A biological preference hierarchy eliminates redundant transport routes while preserving the thermodynamically and kinetically favoured mechanism.

### Step 4 — pFBA Trimming
Parsimonious FBA (minimise Σv² subject to max objective) is run at every time point. Reactions that carry zero flux in every parsimonious solution across all time points and all objectives are permanently removed — they contribute nothing to any observed metabolic state.

### Step 5 — Loop Removal (Loopless FBA)
Thermodynamically infeasible cycles can carry non-zero flux in standard FBA but zero flux in loopless FBA. Reactions active only under thermodynamically impossible cycling are removed.

**Result: 6,663 → 503 reactions (92.5% compression)**, retaining 105/155 metabolic tasks defined by Thiele et al. This compact model is what gets used for PC-dFBA in the digital twin.

The entire pipeline runs live in the browser via a FastAPI + COBRApy backend, completing in approximately 22 seconds. Step results arrive incrementally via polling so you can watch the network compress in real time.

---

## The Seven Tabs: A Tour

### 🔬 Simulator
The main event. A 14-day fed-batch simulation runs in your browser in under a second, driven by a custom RK45-like ODE integrator written in TypeScript. Six interactive charts update live as you adjust:

- Initial cell density, glucose, lactate, glutamine, glutamate, ammonium
- Growth rate parameters (a₁, c₁, a₂, c₂ logistic basis coefficients)
- Nutrient coupling constants (K_Glc, K_Gln, K_I_Lac, K_I_Amm)
- Feed strategy (bolus feed days and volumes)
- μ_net mode (Sigmoid / Monod proxy / Surrogate NN)

Key performance indicators (peak VCD, final titer, final glucose/lactate/ammonium) update at the top of the page. A "Set Reference" button locks the current run for side-by-side comparison.

### Σ Equations
Every mathematical equation from the paper (Eqs. 1–26 + PC-dFBA Eqs. 27–33) rendered in LaTeX-quality notation, grouped by biological subsystem. Hover any equation to see its role in the model.

### ⊞ Parameters
Table 1 from the paper — all 40+ parameters — rendered as an interactive editor. Change any value and the simulator tab will use your custom parameter set. Reset to paper defaults with one click. Each parameter shows its symbol, value, units, and the equation number it appears in.

### ≈ MetRaC
The **Metabolic Rate Calculator** computes specific exchange rates (q_Glc, q_Lac, q_Gln, q_Glu, q_NH₄, q_mAb) from concentration time series using a Gaussian Process regression model — the same approach used in the paper to generate the exchange flux constraints for FBA. Bayesian 95% credible intervals are shown for each rate. The q_p (specific productivity) chart quantifies antibody production rate over the culture time course.

### ⊕ Sweep
Parameter sensitivity analysis. Select any model parameter, set a range and step size, and the app runs the full ODE simulation at every point in the sweep, plotting final titer, peak VCD, and final metabolite concentrations as functions of the swept parameter. Identifies optimal operating points and quantifies sensitivity.

### ⬡ PC-dFBA
The intracellular flux analysis tab. A live SVG metabolic network map (10 metabolite nodes, 16 reaction edges) shows flux magnitudes and directions at any selected time point. Accompanying time series plots show how each flux evolves across the culture. A PC trajectory plot shows the path through principal metabolic coordinate space — the "metabolic fingerprint" of the culture.

### ⊗ GEM Red.
The live GEM Reduction pipeline described above. Runs iCHOv1 through the full 5-step Antonakoudis & Richelle (2026) pipeline on the FastAPI + COBRApy backend, with incremental step results, a comparison table (live result vs. paper target), and a waterfall chart of network size at each step.

---

## Why This Matters

### Democratising Bioprocess Modeling

Building and running these models traditionally requires MATLAB licenses, a COBRApy installation, a GLPK or Gurobi LP solver, access to the original paper's code repository, and hours of setup time. The CHO Digital Twin puts all of that in a browser tab — no installation, no licenses, no setup.

A process development scientist at a contract manufacturer, a graduate student learning metabolic modeling, a regulatory reviewer evaluating a manufacturing change — all of them can now interact directly with the quantitative framework underlying CHO cell culture science.

### Making Research Reproducible

Scientific reproducibility is a crisis in computational biology. Papers describe models in equations, but the actual implementation — the numerical integrator, the sign conventions, the handling of edge cases — is often buried in supplementary code that may or may not match the paper's description.

This app is a *living replication*: every equation is numbered to its paper source, every parameter value is from Table 1, every algorithmic step is documented. When the app and the paper disagree, the discrepancy is flagged explicitly in the About tab. This is what reproducible computational science looks like.

### Compressing Development Time

The canonical use case: a process development team wants to understand why their CHO culture peaks at day 8 instead of day 10, and whether adjusting the glucose feed on day 5 would help. Traditionally: design the experiment, order the media, run the ambr® for two weeks, analyse the samples, interpret the data. 3–4 weeks, $15,000–30,000.

With the digital twin: adjust the slider, observe the simulation, form a hypothesis, design a targeted experiment to confirm it. The experiment still happens — but now it's testing a specific, model-derived prediction rather than exploring blindly. Development time compresses.

### A Template for the Industry

The CHO Digital Twin is built on a framework that generalises. The same hybrid ODE + FBA + ML architecture applies to any mammalian cell culture process. The same MetRaC uncertainty quantification applies to any exchange rate measurement. The same GEM reduction pipeline applies to any organism with a genome-scale metabolic model (and there are hundreds: *E. coli*, yeast, human hepatocytes, stem cells).

The specific implementation here is for CHO-S with an IgG1 mAb product in a 15 mL ambr® bioreactor. But the methodology — and the open-source code — is a template for digital twins of any bioprocess.

---

## The Technical Architecture

The app is a **TypeScript monorepo** managed with pnpm workspaces:

```
React 19 + Vite 7               ← UI, charts, ODE solver, FBA
     │
     ├─ /gem/*  → Express proxy → FastAPI (Python)
     │                              └─ COBRApy + GLPK
     └─ /api/*  → Express API   ← (future: persistence, auth)
```

**Client-side computation:** The ODE simulator, MetRaC rate calculator, PC-dFBA analytical solver, and surrogate neural network all run entirely in the browser. There is no server round-trip for any of these — the RK45 integrator runs in TypeScript, completing a 14-day simulation in under 50 ms.

**Server-side COBRApy:** The GEM reduction pipeline requires an LP/MILP solver (GLPK) and the COBRApy Python library. This runs on a FastAPI backend with a job-queue pattern: `POST /gem/run-pipeline` returns a `job_id` immediately; the browser polls `GET /gem/job/{job_id}` every 1.5 seconds; step results arrive incrementally as the ~22-second pipeline progresses.

**Key design decisions:**
- The iCHOv1 model (5.6 MB JSON) is loaded once at startup and cached as a pickle (~0.12 s to copy vs. ~2.5 s to reload from JSON). Each pipeline run gets a fresh copy from the pickle cache.
- The Express proxy uses no body-parsing middleware before the proxy block — a subtle but critical detail: `express.json()` consumes the request stream, which breaks `http-proxy-middleware`'s ability to forward POST bodies.
- All ODE state is immutable between time steps; the integrator returns a full trajectory array, making it trivial to render any time range without re-running the simulation.

---

## The Papers Behind the App

**Richelle et al. (2025).** *Integrating mechanistic and machine learning models for predictive digital twins of CHO cell culture.* bioRxiv 2025.11.24.690194. https://doi.org/10.1101/2025.11.24.690194

This paper introduces the hybrid ODE + PC-dFBA + surrogate NN framework implemented in the Simulator, Equations, Parameters, MetRaC, Sweep, and PC-dFBA tabs. It describes the 26 kinetic equations, the three μ_net model variants, the MetRaC Bayesian rate estimation methodology, and the PC-dFBA principal component projection.

**Antonakoudis & Richelle (2026).** *Uncertainty-aware genome-scale model reduction for dynamic flux balance analysis of CHO cell culture.* npj Systems Biology and Applications. https://doi.org/10.1038/s41540-026-00704-4

This paper introduces the 5-step GEM reduction pipeline implemented in the GEM Red. tab. It describes how MetRaC credible interval bounds constrain the MILP exchange pruning step, why 95% CI is the optimal threshold (smallest model, no demand reactions), and how the resulting 860-reaction network achieves 87% compression while retaining 105/155 metabolic tasks. (The live app achieves 92.5% compression to 503 reactions using a quick-mode MILP solver.)

**Hefzi et al. (2016).** *A Consensus Genome-scale Reconstruction of Chinese Hamster Ovary Cell Metabolism.* Cell Systems 3(5):434–443. https://doi.org/10.1016/j.cels.2016.10.020

The iCHOv1 genome-scale model (6,663 reactions, 4,456 metabolites) that serves as input to the GEM reduction pipeline.

---

## What's Next

The current app is a faithful replication of two published frameworks. Future directions include:

- **Multi-culture parameter estimation** — fit the 40+ model parameters to a user-uploaded concentration time series dataset using Bayesian inference (nested sampling or MCMC), replicating the full model calibration workflow from the paper
- **Scale-up prediction** — extend the model to 200 L and 2,000 L bioreactors with mixing time and oxygen transfer corrections
- **Process optimisation** — integrate the digital twin with an optimisation loop to find feed strategies that maximise titer subject to quality constraints
- **Real-time monitoring** — connect to live bioreactor data streams for continuous state estimation via moving-horizon estimation

---

## Try It

The app is live at the Replit preview URL. Navigate to the **GEM Red.** tab and click **▶ Run Pipeline** to watch 6,663 reactions compress to 503 in real time. Adjust the CI level selector to see how tighter bounds force additional demand reactions — the quantitative trade-off that motivates the MetRaC framework in the first place.

Then head to the **Simulator** tab, push the glutamine initial condition to 12 mM, and watch the ammonium accumulate to toxic levels by day 4. Switch to Surrogate NN mode and notice how the neural network captures the same growth dynamics with a fundamentally different mathematical representation. That's the hybrid model in action.

---

*Built with React 19, TypeScript, Recharts, FastAPI, COBRApy, and a lot of stoichiometry.*
