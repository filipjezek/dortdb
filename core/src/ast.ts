import { Fn, Operator } from './extension.js';

export interface ASTNode {
  accept(visitor: ASTVisitor): void;
}

export interface ASTExpression extends ASTNode {
  evaluate(): any;
}

export class ASTLiteral<T> implements ASTExpression {
  constructor(public original: string, public value: T) {}

  accept(visitor: ASTVisitor): void {
    visitor.acceptLiteral(this);
  }

  evaluate(): T {
    return this.value;
  }
}

export class ASTOperator implements ASTExpression {
  constructor(public op: Operator, public operands: ASTExpression[]) {
    if (operands.length < op.impl.length) {
      throw new Error(`Operator ${op.name} is at least ${op.impl.length}-ary`);
    }
  }

  accept(visitor: ASTVisitor): void {
    visitor.acceptOperator(this);
  }

  evaluate(): any {
    return this.op.impl(...this.operands);
  }
}

export class ASTFunction implements ASTExpression {
  constructor(public fn: Fn, public args: ASTExpression[]) {
    if (args.length < fn.impl.length) {
      throw new Error(`Operator ${fn.name} is at least ${fn.impl.length}-ary`);
    }
  }

  accept(visitor: ASTVisitor): void {
    visitor.acceptFunction(this);
  }

  evaluate(): any {
    return this.fn.impl(...this.args);
  }
}

export interface ASTVisitor {
  acceptLiteral<T>(literal: ASTLiteral<T>): void;
  acceptOperator(op: ASTOperator): void;
  acceptFunction(fn: ASTFunction): void;
}
