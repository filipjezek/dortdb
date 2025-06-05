import { ASTIdentifier } from '../../ast.js';
import { Trie } from '../../data-structures/trie.js';
import { DortDBAsFriend } from '../../db.js';
import {
  fromItemIndexKey,
  Index,
  IndexMatchInput,
} from '../../indices/index.js';
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
import { PlanOperator } from '../../plan/visitor.js';
import { PatternRule, PatternRuleMatchResult } from '../rule.js';

export interface IndexScansBindings {
  selections: Selection[];
  source: TupleSource | ItemSource;
  index: Index;
  accessor: Calculation;
}

export class IndexScans implements PatternRule<Selection, IndexScansBindings> {
  constructor(protected db: DortDBAsFriend) {}

  match(node: Selection): PatternRuleMatchResult<IndexScansBindings> {
    if (node.parent.constructor === Selection) return null; // already handled
    const bindings: IndexScansBindings = {
      selections: node.condition.original instanceof FnCall ? [node] : [],
      source: null,
      index: null,
      accessor: null,
    };
    if (node.condition.original instanceof FnCall) {
      bindings.selections.push(node as Selection);
    }
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
      const match = index.match(candidates, renameMap);
      if (match) {
        candidates = candidates.filter((_, i) => match.includes(i));
        bindings.selections = bindings.selections.filter(
          (s, i) => candidates.find((c) => c.sIndex === i) !== undefined,
        );
        bindings.index = index;
        bindings.accessor = index.createAccessor(candidates);
        return {
          bindings,
        };
      }
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
      return firstSelectionIsMatch ? newSource : node;
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
    return firstSelectionIsMatch ? newSource : node;
  }
  operator = Selection;
}
