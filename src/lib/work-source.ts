// DHX budget policy: pricing strategy follows WHO OWNS THE WORK, not which product.
// Locked by founder 2026-07-17. Future DHX business units (E-Bike, Classic, Ride, ...)
// are added as dhx_business_unit and automatically inherit Money Safe — no new logic.

export const WORK_REQUEST_SOURCES = [
  "internal_fleet",
  "dhx_rental",
  "my_garage",
  "dhx_rebuild",
  "walk_in",
  "insurance",
  "partner_workshop",
] as const;
export type WorkRequestSource = (typeof WORK_REQUEST_SOURCES)[number];

export const WORK_REQUEST_SOURCE_LABELS: Record<WorkRequestSource, string> = {
  internal_fleet: "Internal Fleet",
  dhx_rental: "DHX Rental",
  my_garage: "My Garage",
  dhx_rebuild: "DHX Rebuild",
  walk_in: "Walk-in Customer",
  insurance: "Insurance",
  partner_workshop: "Partner Workshop",
};

export type WorkSourceCategory =
  | "dhx_business_unit" // any DHX-owned module: Rental, Fleet, Rebuild, future E-Bike...
  | "customer"          // vehicle owned by an external customer (walk-in, My Garage)
  | "insurance"
  | "partner";

export const WORK_SOURCE_CATEGORY: Record<WorkRequestSource, WorkSourceCategory> = {
  internal_fleet: "dhx_business_unit",
  dhx_rental: "dhx_business_unit",
  dhx_rebuild: "dhx_business_unit",
  my_garage: "customer",
  walk_in: "customer",
  insurance: "insurance",
  partner_workshop: "partner",
};

export type BudgetStrategy = "money_safe" | "market_value" | "conservative_growth";

export const CATEGORY_BUDGET_STRATEGY: Record<WorkSourceCategory, BudgetStrategy> = {
  dhx_business_unit: "money_safe",
  customer: "market_value",
  insurance: "market_value",
  partner: "conservative_growth",
};

export const BUDGET_STRATEGY_LABELS: Record<BudgetStrategy, string> = {
  money_safe: "Money Safe — protect DHX cash flow",
  market_value: "Market Value — fair competitive pricing",
  conservative_growth: "Conservative Growth — sustainable partner margin",
};

export function budgetStrategyFor(source: WorkRequestSource): BudgetStrategy {
  return CATEGORY_BUDGET_STRATEGY[WORK_SOURCE_CATEGORY[source]];
}

/** Guidance injected into AI estimation prompts, per strategy. */
export const BUDGET_STRATEGY_AI_GUIDANCE: Record<BudgetStrategy, string> = {
  money_safe:
    "Budget strategy: MONEY SAFE (internal DHX work). Minimize spend and protect company cash flow: prefer repair over replace wherever structurally safe, used/reconditioned parts are acceptable, quote at internal cost level.",
  market_value:
    "Budget strategy: MARKET VALUE. Fair, competitive customer/insurance pricing with standard parts and market labour rates.",
  conservative_growth:
    "Budget strategy: CONSERVATIVE GROWTH (partner workshop). Sustainable partner pricing: competitive but with a modest protected margin.",
};
