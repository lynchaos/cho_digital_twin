
/**
 * Mathematical Equations Page
 * Displays all model equations from Richelle et al. (2025) with precise typesetting.
 */

interface EqProps {
  number: string;
  label: string;
  latex: string;
  description?: string;
}

function Eq({ number, label, latex, description }: EqProps) {
  return (
    <div className="equation-block">
      <div className="eq-header">
        <span className="eq-label">{label}</span>
        <span className="eq-number">({number})</span>
      </div>
      <div className="eq-body">
        <pre className="eq-math">{latex}</pre>
      </div>
      {description && <p className="eq-desc">{description}</p>}
    </div>
  );
}

interface SectionProps {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

function Section({ id, title, subtitle, children }: SectionProps) {
  return (
    <section id={id} className="eq-section">
      <h2 className="eq-section-title">{title}</h2>
      {subtitle && <p className="eq-section-sub">{subtitle}</p>}
      {children}
    </section>
  );
}

export default function EquationsPage() {
  return (
    <div className="equations-page">
      <div className="eq-nav">
        <span className="eq-nav-label">Jump to:</span>
        {[
          ["#biomass", "Biomass ODE"],
          ["#flex", "FLEX Metabolites"],
          ["#growth", "Growth Rates"],
          ["#pcdFBA", "PC-dFBA"],
          ["#massBal", "Mass Balance"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="eq-nav-link">{label}</a>
        ))}
      </div>

      <Section id="biomass" title="§ 2.4.1 — ODE Biomass Population Kinetic Model"
        subtitle="Eqs. 8–14  ·  State variables: viable (Xᵥ), dead (Xd), lysed (Xˡ) cells and biomaterial (B)">

        <Eq number="8" label="Viable cell dynamics"
          latex="dXᵥ/dt = (μ_eff − k_d − k_l − D) · Xᵥ"
          description="Net accumulation of viable cells: growth minus death, lysis, and dilution." />

        <Eq number="9" label="Dead cell dynamics"
          latex="dXd/dt = k_d · Xᵥ − k_l · Xd − D · Xd"
          description="Dead cells produced by cell death, removed by lysis and dilution." />

        <Eq number="10" label="Lysed cell dynamics"
          latex="dXˡ/dt = k_l · (Xᵥ + Xd) − D · Xˡ"
          description="Lysed cells accumulate from both viable and dead cell lysis." />

        <Eq number="11" label="Biomaterial accumulation"
          latex="dB/dt = μ_net · Xᵥ − D · B"
          description="Proxy variable capturing latent inhibitory by-products (e.g. metabolic waste)." />

        <Eq number="12" label="Effective death rate"
          latex="k_d = k_d⁰ + k_d¹ · B"
          description="Toxicity-modulated death rate; increases with biomaterial accumulation." />

        <Eq number="13" label="Effective lysis rate"
          latex="k_l = k_l⁰ + k_l¹ · Xˡ"
          description="Lysis rate increases with lysed cell density (positive feedback)." />

        <Eq number="14" label="Effective growth rate"
          latex="μ_eff = μ_net + k_d"
          description="Gross biosynthesis rate; accounts for the fraction of newly synthesised biomass that immediately dies." />
      </Section>

      <Section id="flex" title="§ 2.4.2 — ODE FLEX Metabolites Model"
        subtitle="Eqs. 15–26  ·  State variables: Glc, Lac, Gln, Glu, NH₄⁺ — measured with BioProfile® FLEX2">

        <Eq number="15" label="Glucose dynamics"
          latex="dGlc/dt = q_Glc · Xᵥ + (F/V) · (Glc_feed − Glc)" />

        <Eq number="16" label="Lactate dynamics"
          latex="dLac/dt = q_Lac · Xᵥ − D · Lac" />

        <Eq number="17" label="Glutamine dynamics"
          latex="dGln/dt = q_Gln · Xᵥ + (F/V) · (Gln_feed − Gln)" />

        <Eq number="18" label="Glutamate dynamics"
          latex="dGlu/dt = q_Glu · Xᵥ + (F/V) · (Glu_feed − Glu)" />

        <Eq number="19" label="Ammonium dynamics"
          latex="dNH₄/dt = q_NH₄ · Xᵥ − D · NH₄" />

        <div className="eq-divider">Specific rate definitions</div>

        <Eq number="20" label="Glucose consumption rate"
          latex="q_Glc = Y_Glc · μ_eff · [Glc/(K_m,Glc + Glc)] · [K_i,Lac/(K_i,Lac + Lac)] + m_Glc"
          description="Michaelis–Menten kinetics with competitive lactate inhibition and maintenance term. Overflow metabolism triggers lactate production when q_Glc exceeds oxidative capacity." />

        <Eq number="21" label="Lactate production rate"
          latex="q_Lac,prod = max(0,  q_Glc − q_Glc,ox,max)"
          description="Aerobic lactate overflow: excess glucose uptake above oxidative capacity is shunted to lactate." />

        <Eq number="22" label="Lactate consumption rate"
          latex="q_Lac,cons = max(0, q_Glc,ox,max − q_Glc) · Lac/(K_m,Lac + Lac)"
          description="When glucose uptake is below oxidative capacity, cells re-consume lactate (lactate switch)." />

        <Eq number="23" label="Net lactate flux"
          latex="q_Lac = Y_Lac,prod · q_Lac,prod − Y_Lac,cons · q_Lac,cons"
          description="Net: positive = production, negative = consumption." />

        <Eq number="24" label="Glutamate consumption rate"
          latex="q_Glu = Y_Glu · μ_eff · [Glu/(K_m,Glu + Glu)] + m_Glu"
          description="Growth-coupled Michaelis–Menten kinetics plus maintenance." />

        <Eq number="25" label="Glutamine consumption rate"
          latex="q_Gln = q_Gln,max · [Gln/(K_m,Gln + Gln)]"
          description="Pure Michaelis–Menten saturation kinetics for glutamine." />

        <Eq number="26" label="Ammonium production rate"
          latex="q_NH₄ = Y_NH₄,Glu · q_Glu + Y_NH₄,Gln · q_Gln"
          description="Ammonium is a catabolism by-product of both glutamate and glutamine." />
      </Section>

      <Section id="growth" title="§ 2.3 — Neural Network VCD Predictor (Structure)"
        subtitle="Eqs. 1–7  ·  Predicts μ_net from metabolic rates and concentrations">

        <Eq number="1" label="VCD predictor"
          latex="μ̂(i) = f(q_i, c_i, t_i,  B_{i-1},  μ̂_{i-1})"
          description="At each time step i, the network receives specific consumption rates (q), metabolite concentrations (c), current time (t), previous biomaterial (B), and previous predicted growth rate." />

        <Eq number="2" label="Training loss"
          latex="L = (1/N) Σ_i ℒᵢ" />

        <Eq number="3" label="Per-batch loss"
          latex="ℒᵢ = (nTraj)⁻¹ Σ w_t · Σ w_k · (μ̂_k − μ_k)²  +  MSE(⟨μ̂⟩, ⟨μ⟩)  +  λ · ∫|μ̂''| dt"
          description="Three terms: (1) trajectory MSE with time-decreasing and outlier-down-weighting; (2) endpoint mean constraint; (3) smoothness regularisation via absolute second derivative." />

        <Eq number="4" label="Trajectory weight"
          latex="w_k = 1 / (1 + |⟨μ_k⟩ − ⟨μ̄⟩|)"
          description="Upweights trajectories whose mean is near the batch mean; downweights outlier MetRaC trajectories." />

        <Eq number="5" label="Biomaterial variable"
          latex="B_i = μ_net,i · Xᵥ,i   (used in Eq. 11)"
          description="Recurrent term capturing latent inhibitory metabolite accumulation." />

        <Eq number="6" label="VCD discrete update"
          latex="Xᵥ,i = Xᵥ,i-1 + Δt · μ̂_{i-1} · Xᵥ,i-1" />

        <Eq number="7" label="Biomaterial discrete update"
          latex="B_i = B_{i-1} + Δt · μ̂_{i-1}" />
      </Section>

      <Section id="pcdFBA" title="§ 2.6 — PC-dFBA Hybrid Linear Program"
        subtitle="Eqs. 27–33  ·  Principal Component – dynamic Flux Balance Analysis">

        <Eq number="27" label="Objective function"
          latex="min_{v, s_PC}   cᵀ · v + 1ᵀ · s_PC"
          description="Simultaneously minimises: (1) metabolic objective (typically biomass growth rate) and (2) empirical PCA contribution." />

        <Eq number="28" label="Stoichiometric mass balance"
          latex="S · v = 0"
          description="Steady-state flux balance: net production of every intracellular metabolite is zero." />

        <Eq number="29" label="Reaction flux bounds"
          latex="lb ≤ v ≤ ub" />

        <Eq number="30" label="Hard exchange bounds"
          latex="lb' ≤ v_ex ≤ ub'"
          description="Exchange fluxes of FLEX metabolites + VCD are fixed to MetRaC mean rates; relaxed to 5th/95th percentiles if infeasible." />

        <Eq number="31" label="PCA empirical constraint"
          latex="med(v_ex) − RF · IQR(v_ex) ≤ L_PC · s_PC ≤ med(v_ex) + RF · IQR(v_ex)"
          description="Predicted PCA loadings L_PC (from ANN) link scores s_PC to exchange fluxes via median ± IQR bounds. RF is a relaxation factor." />

        <Eq number="32" label="PCA score bounds"
          latex="lb_PC ≤ s_PC ≤ ub_PC" />

        <Eq number="33" label="MOMA flux continuity"
          latex="min ‖v_t − v_{t-1}‖²"
          description="Minimisation of Metabolic Adjustment (MOMA) penalty between consecutive time steps ensures smooth, non-physical flux transitions." />
      </Section>

      <Section id="massBal" title="§ 3.1 — General Bioreactor Mass Balance"
        subtitle="Eq. 34  ·  Unified simulation engine">

        <Eq number="34" label="Bioreactor mass balance"
          latex="dCᵢ/dt = νᵢ · Xᵥ + (F_in / V) · Cᵢ_feed − (F_out / V) · Cᵢ"
          description="General mass balance for extracellular metabolite Cᵢ. νᵢ is the net specific rate from the VCD, kinetic, or metabolic model. Xᵥ = viable cell density, V = bioreactor volume, F_in/F_out = feed/harvest flow rates." />
      </Section>
    </div>
  );
}
