
import { useState } from "react";
import SimulatorPage from "@/pages/SimulatorPage";
import EquationsPage from "@/pages/EquationsPage";
import ParametersPage from "@/pages/ParametersPage";

type Tab = "simulator" | "equations" | "parameters" | "about";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "simulator",  label: "Simulator",   icon: "⚙" },
  { id: "equations",  label: "Equations",   icon: "∑" },
  { id: "parameters", label: "Parameters",  icon: "⊞" },
  { id: "about",      label: "About",       icon: "ℹ" },
];

function AboutPage() {
  return (
    <div className="about-page">
      <h1>CHO Cell Culture Digital Twin</h1>
      <p className="about-tagline">
        Replication of the hybrid modeling framework for predictive digital twins
        of CHO cell culture
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
          <tr><td>ODE biomass population model</td><td>Eqs. 8–14</td><td className="status-yes">✓ Exact parameters (Table 1)</td></tr>
          <tr><td>ODE FLEX metabolite model</td><td>Eqs. 15–26</td><td className="status-yes">✓ Exact parameters (Table 1)</td></tr>
          <tr><td>RK4 integrator</td><td>—</td><td className="status-yes">✓ dt = 0.005 days</td></tr>
          <tr><td>Fed-batch mass balance</td><td>Eq. 34</td><td className="status-yes">✓ Bolus feeding with volume update</td></tr>
          <tr><td>Growth rate sigmoid baseline</td><td>Eq. 1 proxy</td><td className="status-partial">⚠ Structure only — NN weights need 23-batch dataset</td></tr>
          <tr><td>PC-dFBA hybrid LP</td><td>Eqs. 27–33</td><td className="status-partial">⚠ Equations documented — full LP needs genome-scale model + MetRaC rates</td></tr>
          <tr><td>MetRaC Bayesian rate estimation</td><td>§2.2</td><td className="status-no">✗ Requires nested sampling library + raw concentration data</td></tr>
        </tbody>
      </table>

      <h2>Framework overview</h2>
      <div className="framework-diagram">
        <div className="fw-node fw-input">
          Experimental data<br/><small>23 CHO fed-batch runs</small>
        </div>
        <div className="fw-arrow">→</div>
        <div className="fw-node fw-proc">
          MetRaC<br/><small>Bayesian rate estimation</small>
        </div>
        <div className="fw-arrow">→</div>
        <div className="fw-col">
          <div className="fw-node fw-model">
            ODE Biomass<br/><small>Eqs. 8–14</small>
          </div>
          <div className="fw-node fw-model">
            ODE FLEX<br/><small>Eqs. 15–26</small>
          </div>
          <div className="fw-node fw-model">
            VCD NN<br/><small>Eqs. 1–7</small>
          </div>
          <div className="fw-node fw-model">
            PC-dFBA<br/><small>Eqs. 27–33</small>
          </div>
        </div>
        <div className="fw-arrow">→</div>
        <div className="fw-node fw-output">
          Digital Twin<br/><small>VCD · titer · metabolites</small>
        </div>
      </div>

      <h2>Key biological features modelled</h2>
      <ul className="about-list">
        <li><strong>Overflow metabolism</strong> — aerobic lactate production when glucose uptake exceeds oxidative capacity (Eqs. 21–23)</li>
        <li><strong>Lactate switch</strong> — cells re-consume lactate when glucose is limiting (Eq. 22)</li>
        <li><strong>Biomaterial inhibition</strong> — accumulating by-products increase death and lysis rates (Eqs. 12–13)</li>
        <li><strong>Maintenance metabolism</strong> — non-growth-associated glucose/glutamate consumption (Eqs. 20, 24)</li>
        <li><strong>Fed-batch dynamics</strong> — bolus feeding with instantaneous volume dilution (Eq. 34)</li>
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
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? "nav-tab-active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
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
        {activeTab === "about"      && <AboutPage />}
      </div>
    </div>
  );
}
