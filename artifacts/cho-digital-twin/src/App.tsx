
import { useState } from "react";
import SimulatorPage from "@/pages/SimulatorPage";
import EquationsPage from "@/pages/EquationsPage";
import ParametersPage from "@/pages/ParametersPage";
import MetRaCPage from "@/pages/MetRaCPage";
import SweepPage from "@/pages/SweepPage";

type Tab = "simulator" | "equations" | "parameters" | "metrac" | "sweep" | "about";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "simulator",  label: "Simulator",  icon: "⚙" },
  { id: "equations",  label: "Equations",  icon: "∑" },
  { id: "parameters", label: "Parameters", icon: "⊞" },
  { id: "metrac",     label: "MetRaC",     icon: "≈" },
  { id: "sweep",      label: "Sweep",      icon: "⊹" },
  { id: "about",      label: "About",      icon: "ℹ" },
];

function AboutPage() {
  return (
    <div className="about-page">
      <h1>CHO Cell Culture Digital Twin</h1>
      <p className="about-tagline">
        Replication of the hybrid modeling framework for predictive digital twins of CHO cell culture
      </p>

      <div className="about-ref">
        <strong>Source paper:</strong>{" "}
        Richelle A., Andersson D., Antonakoudis A., Jakobsson J., Pijeaud S., Vernersson A., Trygg J. (2025)
        <em> A Hybrid Modeling Framework for Predictive Digital Twins of CHO Cell Culture.</em>{" "}
        bioRxiv 2025.11.24.690194. doi:{" "}
        <a href="https://doi.org/10.1101/2025.11.24.690194" target="_blank" rel="noopener">
          10.1101/2025.11.24.690194
        </a>
      </div>

      <h2>What is replicated</h2>
      <table className="about-table">
        <thead><tr><th>Component</th><th>Equations</th><th>Status</th></tr></thead>
        <tbody>
          <tr><td>ODE biomass population model</td><td>Eqs. 8–14</td>
            <td className="status-yes">✓ Exact Table 1 parameters; B_max cap added</td></tr>
          <tr><td>ODE FLEX metabolite model</td><td>Eqs. 15–26</td>
            <td className="status-yes">✓ Exact Table 1 parameters</td></tr>
          <tr><td>RK4 integrator</td><td>—</td>
            <td className="status-yes">✓ dt = 0.005 days</td></tr>
          <tr><td>Fed-batch mass balance with bolus feeds</td><td>Eq. 34</td>
            <td className="status-yes">✓ Bolus feeding with exact volume mixing</td></tr>
          <tr><td>Luedeking-Piret product model</td><td>§2.4 extension</td>
            <td className="status-yes">✓ dTit/dt = (α·μ_net + β)·Xv — growth + non-growth associated</td></tr>
          <tr><td>Nutrient-coupled growth rate (§2.3 NN substitute)</td><td>§2.3 proxy</td>
            <td className="status-partial">⚠ Monod × sigmoid (NN weights need 23-batch dataset)</td></tr>
          <tr><td>MetRaC rate estimation</td><td>§2.2</td>
            <td className="status-partial">⚠ Simplified: finite-diff + kernel-smoothed Bayesian CI (no nested sampling)</td></tr>
          <tr><td>PC-dFBA hybrid LP</td><td>Eqs. 27–33</td>
            <td className="status-no">✗ Needs genome-scale CHO model (iCHO) + LP solver</td></tr>
        </tbody>
      </table>

      <h2>Framework overview</h2>
      <div className="framework-diagram">
        <div className="fw-node fw-input">
          Experimental data<br/><small>23 CHO fed-batch runs</small>
        </div>
        <div className="fw-arrow">→</div>
        <div className="fw-node fw-proc">
          MetRaC<br/><small>§2.2 Bayesian rates</small>
        </div>
        <div className="fw-arrow">→</div>
        <div className="fw-col">
          <div className="fw-node fw-model">ODE Biomass<br/><small>Eqs. 8–14 ✓</small></div>
          <div className="fw-node fw-model">ODE FLEX<br/><small>Eqs. 15–26 ✓</small></div>
          <div className="fw-node fw-model">VCD NN (μ_net)<br/><small>§2.3 → Monod proxy ⚠</small></div>
          <div className="fw-node fw-model">PC-dFBA<br/><small>Eqs. 27–33 ✗</small></div>
        </div>
        <div className="fw-arrow">→</div>
        <div className="fw-node fw-output">
          Digital Twin<br/><small>VCD · titer · metabolites</small>
        </div>
      </div>

      <h2>Implementation notes</h2>
      <ul className="about-list">
        <li>
          <strong>B_max cap (new):</strong> Biomaterial B is now capped at B_max (default 500) inside deathRate(),
          preventing the kd1·B term from growing unboundedly and producing unrealistic death rates after day 10.
        </li>
        <li>
          <strong>Luedeking-Piret product model (new):</strong> Product titer uses
          dTit/dt = (q_p_growth·μ_net + q_p)·Xv, distinguishing growth-associated (α = q_p_growth)
          from non-growth-associated (β = q_p) productivity.
        </li>
        <li>
          <strong>Nutrient-coupled growth (new):</strong> μ_net_eff = μ_sigmoid(t) × Monod(Glc) × Monod(Gln)
          × Inhibition(Lac) × Inhibition(NH4). This replaces the §2.3 NN for open exploration and
          gives biologically realistic VCD (10–20 Mc/mL range) without the training data.
        </li>
        <li>
          <strong>MetRaC tab (new):</strong> Demonstrates the full MetRaC pipeline — virtual
          measurements from the ODE + configurable noise → finite-difference rates → kernel-smoothed
          posterior with 95% credible intervals.
        </li>
        <li>
          <strong>CSV export:</strong> Click the ↓ CSV button in the Simulator after any run
          to download all state variables and specific rates at every output step.
        </li>
        <li><strong>Overflow metabolism:</strong> Aerobic lactate production when glucose uptake exceeds oxidative capacity (Eqs. 21–23)</li>
        <li><strong>Lactate switch:</strong> Cells re-consume lactate when glucose is limiting (Eq. 22)</li>
        <li><strong>Biomaterial inhibition:</strong> Accumulating by-products increase death and lysis (Eqs. 12–13)</li>
      </ul>

      <h2>What still needs experimental data</h2>
      <ul className="about-list">
        <li>
          <strong>§2.3 NN weights:</strong> The neural network that predicts μ_net from specific rates and metabolite
          concentrations was trained on 23 fed-batch CHO runs (AstraZeneca/Sartorius proprietary dataset).
          The Monod nutrient coupling is a structural substitute.
        </li>
        <li>
          <strong>PC-dFBA (Eqs. 27–33):</strong> Requires the CHO genome-scale model (e.g., iCHO2441, ~2000 reactions),
          a linear programming solver, PCA loadings predicted by a second NN, and MetRaC-derived exchange rates
          as boundary conditions.
        </li>
      </ul>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("simulator");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-logo">
            <span className="app-logo-icon">🔬</span>
            <span className="app-logo-text">
              CHO Digital Twin
              <span className="app-logo-sub"> — Richelle et al. (2025) Replication</span>
            </span>
          </div>
          <nav className="app-nav">
            {TABS.map((tab) => (
              <button key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? "nav-tab-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}>
                <span className="nav-tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <div className="app-content">
        {activeTab === "simulator"  && <SimulatorPage />}
        {activeTab === "equations"  && <EquationsPage />}
        {activeTab === "parameters" && <ParametersPage />}
        {activeTab === "metrac"     && <MetRaCPage />}
        {activeTab === "sweep"      && <SweepPage />}
        {activeTab === "about"      && <AboutPage />}
      </div>
    </div>
  );
}
