import {
  ASTIdentifier,
  CalculationParams,
  DortDBAsFriend,
  EqualityChecker,
  Index,
  IndexFillInput,
  IndexMatchInput,
  PlanVisitor,
  simplifyCalcParams,
} from '@dortdb/core';
import { Calculation, FnCall, PlanOpAsArg, RenameMap } from '@dortdb/core/plan';
import { CypherDataAdaper, EdgeDirection } from '../language/data-adapter.js';
import { CypherLanguage } from '../language/language.js';

export class ConnectionIndex implements Index {
  protected eqCheckers: Record<string, EqualityChecker>;
  protected calcBuilders: Record<string, PlanVisitor<CalculationParams>>;
  protected adapter: CypherDataAdaper;

  constructor(
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
        const matchesArg = (j: number) =>
          expr instanceof ASTIdentifier
            ? expr === exprs[i].containingFn.args[j]
            : expr === (exprs[i].containingFn.args[j] as PlanOpAsArg).op;
        if (matchesArg(1) || matchesArg(2)) {
          return [i];
        }
      }
    }
    return null;
  }
  createAccessor(expressions: IndexMatchInput[]): Calculation {
    const e = expressions[0];
    const selectEdges =
      e.expr instanceof ASTIdentifier
        ? e.expr === e.containingFn.args[2]
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
    let calcParams = fnCall.accept(this.calcBuilders);
    calcParams = simplifyCalcParams(calcParams, this.eqCheckers, fnCall.lang);
    return new Calculation(
      fnCall.lang,
      calcParams.impl,
      calcParams.args,
      calcParams.argMeta,
      fnCall,
    );
  }
}
