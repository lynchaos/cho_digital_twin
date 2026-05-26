---
name: CHO Digital Twin — q_p unit equivalence
description: Specific productivity unit equivalence; wrong default caused titer to show 0 mg/L.
---

## Rule
In the CHO ODE model where Xv is in Mc/mL (10⁶ cells/mL) and Tit in mg/L:

  dTit/dt [mg/L/day] = q_p [mg/L/(Mc/mL)/day] × Xv [Mc/mL]

The numerical value of q_p in model units equals q_p in pg/cell/day exactly:
  1 mg/L/(Mc/mL)/day = 1 pg/cell/day

**Why:** The 1000 mL/L and 10⁶ cells/Mc factors cancel exactly.

**How to apply:** Typical CHO mAb specific productivity = 10–50 pg/cell/day, so
model defaults should be q_p ≈ 20, q_p_growth ≈ 5 (not 0.010/0.040 which gave 0 mg/L titer).
