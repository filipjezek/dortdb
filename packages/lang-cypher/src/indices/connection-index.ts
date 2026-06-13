import {
  ASTIdentifier,
  CalculationParams,
  DortDBAsFriend,
  EqualityChecker,
  fromItemIndexKey,
  Index,
  IndexFillInput,
  IndexMatchInput,
  PlanOperator,
  PlanVisitor,
} from '@dortdb/core';
import { Calculation, FnCall, PlanOpAsArg, RenameMap } from '@dortdb/core/plan';
import { CypherDataAdaper, EdgeDirection } from '../language/data-adapter.js';
import { CypherLanguage } from '../language/language.js';
import { intermediateToCalc } from '@dortdb/core/utils';

/**
 * A secondary index that translates joins based on connected nodes into graph lookups.
 * This index does not actually store any indexed data.
 */
export class ConnectionIndex implements Index {
  /** Equality checkers keyed by language name, used when building the accessor calculation. */
  protected eqCheckers: Record<string, EqualityChecker>;
  /** Calculation builders keyed by language name, used when building the accessor calculation. */
  protected calcBuilders: Record<string, PlanVisitor<CalculationParams>>;
  /** Graph data adapter retrieved from the registered Cypher language. */
  protected adapter: CypherDataAdaper;

  constructor(
    /** Index key expressions — the edge or node identifiers this index is built on. */
    public expressions: Calculation[],
    db: DortDBAsFriend,
  ) {
    this.eqCheckers = db.langMgr.getVisitorMap('equalityChecker');
    this.calcBuilders = db.langMgr.getVisitorMap('calculationBuilder');
    this.adapter = db.langMgr.getLang<'cypher', CypherLanguage>(
      'cypher',
    ).dataAdapter;
  }

  reindex(values: Iterable<IndexFillInput>): void {}
  match(exprs: IndexMatchInput[], renameMap?: RenameMap): number[] | null {
    for (let i = 0; i < exprs.length; i++) {
      if (exprs[i].containingFn.impl === this.adapter.isConnected) {
        const expr = exprs[i].expr;
        if (this.matchesFromItemKey(expr, renameMap)) {
          return [i];
        }
      }
    }
    return null;
  }

  /**
   * Returns `true` when any dependency of `expr` is mapped to the
   * {@link fromItemIndexKey}, meaning the expression references the current
   * from-item and can be satisfied by a graph traversal.
   */
  protected matchesFromItemKey(
    expr: ASTIdentifier | PlanOperator,
    renames?: RenameMap,
  ): boolean {
    for (const dep of expr instanceof ASTIdentifier
      ? [expr.parts]
      : expr.dependencies) {
      if (renames?.get(dep)?.[0] === fromItemIndexKey) return true;
    }
    return false;
  }

  createAccessor(expressions: IndexMatchInput[]): Calculation {
    const e = expressions[0];
    const selectEdges =
      e.expr instanceof ASTIdentifier
        ? e.containingFn.args[2] instanceof ASTIdentifier &&
          e.expr.equals(e.containingFn.args[2])
        : e.expr === (e.containingFn.args[2] as PlanOpAsArg).op;
    const fnCall = new FnCall(
      e.containingFn.lang,
      [
        e.containingFn.args[0],
        e.containingFn.args[selectEdges ? 1 : 2],
        e.containingFn.args[3],
      ],
      selectEdges
        ? (g, n, dir) => this.adapter.filterNodeEdges(g, n, dir)
        : (g, e, dir: EdgeDirection) => {
            const results = [];
            if (dir === 'any' || dir === 'in') {
              results.push(this.adapter.getEdgeNode(g, e, 'target'));
            }
            if (dir === 'any' || dir === 'out') {
              results.push(this.adapter.getEdgeNode(g, e, 'source'));
            }
            return results;
          },
    );
    return intermediateToCalc(fnCall, this.calcBuilders, this.eqCheckers);
  }
}
