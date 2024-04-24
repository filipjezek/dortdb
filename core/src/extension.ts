import { ASTExpression } from './ast.js';

export interface Operator {
  name: string;
  impl: (...args: ASTExpression[]) => any;
}

export interface Fn {
  name: string;
  impl: (...args: any[]) => any;
}

export interface AggregatorFn {
  name: string;
}

export interface Extension<LangNames extends string = string> {
  schema?: string;
  operators: Operator[];
  functions: Fn[];
  aggregators: AggregatorFn[];
  scope?: LangNames[];
}
