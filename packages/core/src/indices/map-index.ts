import { Calculation } from '../plan/operators/index.js';
import { PlanOperator } from '../plan/visitor.js';
import { Index } from './indices.js';

export class MapIndex implements Index {
  expressions: Calculation[];
  private map: Map<unknown, unknown[]> = new Map();

  constructor(expression: Calculation) {
    this.expressions = [expression];
  }

  query(value: unknown): Iterable<unknown> {
    return this.map.get(value) ?? [];
  }

  create(values: Iterable<unknown>): void {}

  match(expressions: PlanOperator[]): number[] | null {
    return null;
  }
}
