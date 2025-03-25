export interface OptimizerOptions {
  components: OptimizerComponent[];
}

export interface OptimizerComponent {
  match: () => void;
}

export const pushdownSelections: OptimizerComponent = {
  match: () => {},
};
export const mergeToFromItems: OptimizerComponent = {
  match: () => {},
};
export const mergeSelections: OptimizerComponent = {
  match: () => {},
};
export const mergeProjections: OptimizerComponent = {
  match: () => {},
};
export const csToJoin: OptimizerComponent = {
  match: () => {},
};

export class Optimizer {
  public reconfigure(options: OptimizerOptions) {}
}
