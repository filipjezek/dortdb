export interface CostModel {
  forward: number;
  createAttribute: number;
  distinctValuesEstimator: (cardinality: number) => number;
}

export const defaultCostModel: CostModel = {
  forward: 0.0001,
  createAttribute: 0.0001,
  distinctValuesEstimator: Math.sqrt,
};
