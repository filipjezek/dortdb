import { ASTIdentifier } from '../../ast.js';
import { Trie } from '../../data-structures/trie.js';
import { DortDBAsFriend } from '../../db.js';
import { CalculationParams, EqualityChecker } from '../../index.js';
import {
  fromItemIndexKey,
  Index,
  IndexMatchInput,
} from '../../indices/index.js';
import { ret1 } from '../../internal-fns/index.js';
import {
  Calculation,
  FnCall,
  IndexScan,
  ItemSource,
  MapFromItem,
  RenameMap,
  Selection,
  TupleSource,
} from '../../plan/operators/index.js';
import { PlanOperator, PlanVisitor } from '../../plan/visitor.js';
import { intermediateToCalc } from '../../utils/calculation.js';
import { getIMIAlternatives } from '../../utils/indices.js';
import { PatternRule, PatternRuleMatchResult } from '../rule.js';

export interface IndexScansBindings {
  selections: Selection[];
  source: TupleSource | ItemSource;
  index: Index;
  accessor: Calculation;
}

/**
 * Finds selections that can be satisfied by an index scan and replaces them with an index scan operator.
 */
export class IndexScans implements PatternRule<Selection, IndexScansBindings> {
  protected calcBuilders: Record<string, PlanVisitor<CalculationParams>>;
  protected eqCheckers: Record<string, EqualityChecker>;

  constructor(protected db: DortDBAsFriend) {
    this.calcBuilders = db.langMgr.getVisitorMap('calculationBuilder');
    this.eqCheckers = db.langMgr.getVisitorMap('equalityChecker');
  }

  match(node: Selection): PatternRuleMatchResult<IndexScansBindings> {
    if (node.parent.constructor === Selection) return null; // already handled
    const bindings: IndexScansBindings = {
      selections: node.condition.original instanceof FnCall ? [node] : [],
      source: null,
      index: null,
      accessor: null,
    };
    while (node.source.constructor === Selection) {
      if ((node.source as Selection).condition.original instanceof FnCall) {
        bindings.selections.push(node.source as Selection);
      }
      node = node.source as Selection;
    }
    if (
      node.source.constructor !== TupleSource &&
      !(
        node.source.constructor === MapFromItem &&
        (node.source as MapFromItem).source.constructor === ItemSource
      )
    )
      return null;
    bindings.source =
      (node.source as any).constructor === TupleSource
        ? node.source
        : ((node.source as MapFromItem).source as ItemSource);

    const indices =
      this.db.indices.get(
        (Array.isArray(bindings.source.name)
          ? bindings.source.name[0]
          : bindings.source.name
        ).parts,
      ) ?? [];
    let candidates = this.getExprCandidates(bindings.selections);
    let renameMap: RenameMap;
    if ((node as any).source instanceof MapFromItem) {
      renameMap = new Trie();
      renameMap.set((node.source as MapFromItem).key.parts, [fromItemIndexKey]);
    }

    for (const index of indices) {
      const match = this.matchIndex(index, candidates, renameMap);
      if (match) {
        candidates = match.candidates;
        bindings.selections = bindings.selections.filter((s, i) =>
          candidates.some((c) => c.sIndex === i),
        );
        bindings.index = index;
        bindings.accessor = match.accessor;
        return {
          bindings,
        };
      }
    }
    return null;
  }

  protected matchIndex(
    index: Index,
    candidates: (IndexMatchInput & { sIndex: number })[],
    renameMap: RenameMap,
  ) {
    const origMatch = index.match(candidates, renameMap);
    if (origMatch) {
      candidates = candidates.filter((_, i) => origMatch.includes(i));
      return { candidates, accessor: index.createAccessor(candidates) };
    }

    const { alternatives } = getIMIAlternatives(candidates);

    for (const [topOr, alternativeGroup] of alternatives) {
      const matches = alternativeGroup.map((alternatives) =>
        index.match(alternatives, renameMap),
      );
      if (!matches.every(ret1)) continue;
      const accessors = matches.map((g, gi) => {
        return index.createAccessor(g.map((i) => alternativeGroup[gi][i]));
      });

      const combinedAccessor = new FnCall(
        accessors[0].lang,
        accessors.map((a) => ({ op: a.original ?? a })),
        function* (...iters) {
          const seen = new Trie<unknown>();
          for (const iter of iters) {
            for (const item of iter) {
              if (!seen.has([item])) {
                seen.add([item]);
                yield item;
              }
            }
          }
        },
      );
      return {
        accessor: intermediateToCalc(
          combinedAccessor,
          this.calcBuilders,
          this.eqCheckers,
        ),
        candidates: candidates.filter((c) => c.containingFn === topOr),
      };
    }
    return null;
  }

  protected getExprCandidates(
    selections: Selection[],
  ): (IndexMatchInput & { sIndex: number })[] {
    return selections.flatMap((s, si) => {
      return (s.condition.original as FnCall).args.map((arg) => ({
        sIndex: si,
        containingFn: s.condition.original as FnCall,
        expr: arg instanceof ASTIdentifier ? arg : arg.op,
      }));
    });
  }

  transform(node: Selection, bindings: IndexScansBindings): PlanOperator {
    const { selections, source, index, accessor } = bindings;
    const firstSelectionIsMatch = selections[0] === node;
    // cannot remove the `node`, as that is handled by the parent call
    for (let i = firstSelectionIsMatch ? 1 : 0; i < selections.length; i++) {
      const s = selections[i];
      s.parent.replaceChild(s, s.source);
    }
    if (source instanceof TupleSource) {
      const newSource = new IndexScan(
        source.lang,
        source.name as ASTIdentifier,
        index,
        accessor,
      );
      newSource.schemaSet = source.schemaSet;
      newSource.schema = source.schema;
      source.parent.replaceChild(source, newSource);
      return firstSelectionIsMatch ? node.source : node;
    }

    const newSource = new IndexScan(
      source.lang,
      source.name as ASTIdentifier,
      index,
      accessor,
      (source.parent as MapFromItem).key,
    );
    newSource.addToSchema((source.parent as MapFromItem).key);
    source.parent.parent.replaceChild(source.parent, newSource);
    return firstSelectionIsMatch ? node.source : node;
  }
  operator = Selection;
}
