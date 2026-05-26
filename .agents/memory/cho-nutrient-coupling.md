---
name: CHO Digital Twin — nutrient-coupled growth rate
description: Sigmoid-only μ_net is uncoupled from nutrients; added Monod proxy as NN substitute.
---

## Rule
The paper's §2.3 NN predicts μ_net from metabolite concentrations. Without the NN weights (proprietary 23-batch dataset), a time-only sigmoid causes VCD to grow without bound (reached 42 Mc/mL in testing).

The fix: μ_net_eff = μ_sigmoid(t) × [Glc/(Km_Glc+Glc)] × [Gln/(Km_Gln+Gln)] × [Ki_Lac/(Ki_Lac+Lac)] × [Ki_NH4/(Ki_NH4+NH4)]

**Why:** Monod saturation/inhibition captures the biological feedback the NN learns. Results in realistic VCD (2–5 Mc/mL for typical Ambr 15 CHO-S).

**How to apply:** Implemented in `growth-rate.ts:nutrientCoupledMuNet()`. Default Km/Ki values are CHO literature values, NOT from Table 1. Toggle ON/OFF in simulator sidebar. NutrientCouplingParams interface in parameters.ts.

**B_max cap:** Also added B_max = 500 in parameters.ts to cap biomaterial accumulation inside deathRate(), preventing unbounded kd at late timepoints.
