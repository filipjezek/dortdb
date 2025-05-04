import { cloneDeep } from 'lodash-es';
import { ASTIdentifier } from '../../ast.js';
import { Trie } from '../../data-structures/trie.js';
import { DortDBAsFriend } from '../../db.js';
import {
  CartesianProduct,
  Difference,
  Distinct,
  Intersection,
  Join,
  OrderBy,
  Projection,
  ProjectionConcat,
  Selection,
  Union,
} from '../../plan/operators/index.js';
import { IdSet, PlanOperator, PlanTupleOperator } from '../../plan/visitor.js';
import {
  areDepsOnlyRenamed,
  RenamedDepsResult,
} from '../../utils/projection.js';
import { containsAll, restriction } from '../../utils/trie.js';
import { AttributeRenameChecker } from '../../visitors/attribute-rename-checker.js';
import { AttributeRenamer } from '../../visitors/attribute-renamer.js';
import { TransitiveDependencies } from '../../visitors/transitive-deps.js';
import { PatternRule } from '../rule.js';

export interface PushdownSelectionsBindings {
  selections: Selection[];
  source: PlanTupleOperator;
}

export class PushdownSelections
  implements PatternRule<Selection, PushdownSelectionsBindings>
{
  public operator = Selection;
  public alwaysSwap: {
    new (...args: any[]): PlanTupleOperator & { source: PlanTupleOperator };
  }[] = [OrderBy, Distinct];
  public setOps: {
    new (...args: any[]): PlanTupleOperator & {
      left: PlanOperator;
      right: PlanOperator;
    };
  }[] = [Union, Intersection, Difference];
  protected tdepsVmap: Record<string, TransitiveDependencies>;
  protected renamerVmap: Record<string, AttributeRenamer>;
  protected renameCheckerVmap: Record<string, AttributeRenameChecker>;

  constructor(protected db: DortDBAsFriend) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
    this.renamerVmap = this.db.langMgr.getVisitorMap('attributeRenamer');
    this.renameCheckerVmap = this.db.langMgr.getVisitorMap(
      'attributeRenameChecker',
    );
    this.cloneSelection = this.cloneSelection.bind(this);
  }

  public match(node: Selection) {
    if (node.parent.constructor === Selection) return null; // already handled
    const bindings: PushdownSelectionsBindings = {
      selections: [node],
      source: null,
    };
    while (node.source.constructor === Selection) {
      bindings.selections.push(node.source as Selection);
      node = node.source as Selection;
    }
    bindings.source = node.source;

    if (
      this.alwaysSwap.includes(bindings.source.constructor as any) ||
      (this.setOps.includes(bindings.source.constructor as any) &&
        bindings.source.schema)
    ) {
      return { bindings };
    }
    if (bindings.source.constructor === Projection) {
      return this.matchProjection(bindings);
    }
    if (
      (bindings.source.constructor === Join &&
        !(bindings.source as Join).leftOuter &&
        !(bindings.source as Join).rightOuter) ||
      bindings.source.constructor === CartesianProduct
    ) {
      return this.matchJoins(bindings);
    }
    if (
      bindings.source.constructor === ProjectionConcat &&
      !(bindings.source as ProjectionConcat).outer
    ) {
      return this.matchProjectionConcat(bindings);
    }
    return null;
  }

  protected matchJoins(bindings: PushdownSelectionsBindings) {
    const src = bindings.source as CartesianProduct;
    for (const s of bindings.selections) {
      const tdeps = restriction(this.getSelectionDeps(s), src.schemaSet);
      if (
        containsAll(src.left.schemaSet, tdeps) ||
        containsAll(src.right.schemaSet, tdeps)
      ) {
        return { bindings };
      }
    }
    return null;
  }
  protected matchProjectionConcat(bindings: PushdownSelectionsBindings) {
    const src = bindings.source as ProjectionConcat;
    for (const s of bindings.selections) {
      const tdeps = restriction(this.getSelectionDeps(s), src.schemaSet);
      if (
        containsAll(src.source.schemaSet, tdeps) ||
        containsAll(src.mapping.schemaSet, tdeps)
      ) {
        return { bindings };
      }
    }
    return null;
  }
  protected matchProjection(bindings: PushdownSelectionsBindings) {
    for (const s of bindings.selections) {
      if (this.checkProjection(s, bindings.source as Projection)) {
        return { bindings };
      }
    }
    return null;
  }

  protected getSelectionDeps(s: Selection): IdSet {
    if (s.condition instanceof ASTIdentifier) {
      return new Trie([s.condition.parts]);
    }
    return this.tdepsVmap[s.lang].visitCalculation(s.condition);
  }

  public transform(
    node: Selection,
    bindings: PushdownSelectionsBindings,
  ): PlanOperator {
    const { selections, source } = bindings;
    const last = selections[selections.length - 1];
    if (this.alwaysSwap.includes(source.constructor as any)) {
      return this.transformBasic(source as any, node, last);
    }
    if (this.setOps.includes(source.constructor as any)) {
      return this.tranformSetOp(source as any, node, last, selections);
    }
    if (source.constructor === Projection) {
      return this.transformProjection(source as any, selections);
    }
    if (
      source.constructor === CartesianProduct ||
      source.constructor === Join
    ) {
      return this.transformJoin(source as any, selections);
    }
    if (source.constructor === ProjectionConcat) {
      return this.transformProjectionConcat(source as any, selections);
    }
    return node;
  }

  protected transformBasic(
    source: { source: PlanTupleOperator } & PlanTupleOperator,
    first: Selection,
    last: Selection,
  ) {
    last.source = source.source;
    source.source.parent = last;
    source.source = first;
    first.parent = source;
    return source;
  }

  protected tranformSetOp(
    source: {
      left: PlanTupleOperator;
      right: PlanTupleOperator;
    } & PlanTupleOperator,
    first: Selection,
    last: Selection,
    selections: Selection[],
  ) {
    const clones = selections.map(this.cloneSelection);
    last.source = source.left;
    source.left.parent = last;
    source.left = first;
    first.parent = source;

    const cloneLast = clones[clones.length - 1];
    const cloneFirst = clones[0];
    cloneLast.source = source.right;
    source.right.parent = cloneLast;
    source.right = cloneFirst;
    cloneFirst.parent = source;

    return source;
  }

  protected transformProjection(source: Projection, selections: Selection[]) {
    const canPushdown: Selection[] = [];
    const mustStay: Selection[] = [];
    const toRename = new Set<Selection>();
    for (const s of selections) {
      if (this.checkProjection(s, source, toRename)) {
        canPushdown.push(s);
      } else {
        mustStay.push(s);
      }
    }

    for (let i = 0; i < mustStay.length - 1; i++) {
      mustStay[i].source = mustStay[i + 1];
      mustStay[i + 1].parent = mustStay[i];
    }
    for (let i = 0; i < canPushdown.length - 1; i++) {
      const curr = canPushdown[i];
      curr.source = canPushdown[i + 1];
      canPushdown[i + 1].parent = curr;
      if (toRename.has(curr)) {
        if (curr.condition instanceof ASTIdentifier) {
          const renamed = source.renamesInv.get(curr.condition.parts);
          if (renamed) curr.condition = ASTIdentifier.fromParts(renamed);
        } else {
          this.renamerVmap[curr.lang].rename(curr.condition, source.renamesInv);
        }
      }
    }

    for (const s of canPushdown) {
      s.schema = source.source.schema.slice();
      s.schemaSet = source.source.schemaSet.clone();
    }

    const lastCP = canPushdown[canPushdown.length - 1];
    lastCP.source = source.source;
    source.source.parent = lastCP;
    source.source = canPushdown[0];
    canPushdown[0].parent = source;
    if (toRename.has(lastCP)) {
      if (lastCP.condition instanceof ASTIdentifier) {
        const renamed = source.renamesInv.get(lastCP.condition.parts);
        if (renamed) lastCP.condition = ASTIdentifier.fromParts(renamed);
      } else {
        this.renamerVmap[lastCP.lang].rename(
          lastCP.condition,
          source.renamesInv,
        );
      }
    }

    if (mustStay.length) {
      mustStay[mustStay.length - 1].source = source;
      source.parent = mustStay[mustStay.length - 1];
      return mustStay[0];
    } else {
      return source;
    }
  }

  protected transformJoin(source: CartesianProduct, selections: Selection[]) {
    const lefts: Selection[] = [];
    const rights: Selection[] = [];
    const stays: Selection[] = [];
    for (const s of selections) {
      const tdeps = restriction(this.getSelectionDeps(s), source.schemaSet);
      let used = false;
      if (containsAll(source.left.schemaSet, tdeps)) {
        lefts.push(s);
        used = true;
      }
      if (containsAll(source.right.schemaSet, tdeps)) {
        if (used) {
          rights.push(this.cloneSelection(s));
        } else {
          rights.push(s);
        }
      } else if (!used) {
        stays.push(s);
      }
    }

    for (const arr of [lefts, rights, stays]) {
      for (let i = 0; i < arr.length - 1; i++) {
        arr[i].source = arr[i + 1];
        arr[i + 1].parent = arr[i];
      }
    }

    this.pushSelectionsUnder(lefts, 'left', source);
    this.pushSelectionsUnder(rights, 'right', source);
    if (stays.length) {
      stays[stays.length - 1].source = source;
      source.parent = stays[stays.length - 1];
      return stays[0];
    } else {
      return source;
    }
  }

  protected transformProjectionConcat(
    source: ProjectionConcat,
    selections: Selection[],
  ) {
    const horizs: Selection[] = [];
    const verts: Selection[] = [];
    const stays: Selection[] = [];
    for (const s of selections) {
      let used = false;
      const tdeps = restriction(this.getSelectionDeps(s), source.schemaSet);
      if (containsAll(source.mapping.schemaSet, tdeps)) {
        horizs.push(s);
        used = true;
      }
      if (containsAll(source.source.schemaSet, tdeps)) {
        if (used) {
          verts.push(this.cloneSelection(s));
        } else {
          verts.push(s);
        }
      } else if (!used) {
        stays.push(s);
      }
    }

    for (const arr of [horizs, verts, stays]) {
      for (let i = 0; i < arr.length - 1; i++) {
        arr[i].source = arr[i + 1];
        arr[i + 1].parent = arr[i];
      }
    }

    this.pushSelectionsUnder(horizs, 'mapping', source);
    this.pushSelectionsUnder(verts, 'source', source);
    if (stays.length) {
      stays[stays.length - 1].source = source;
      source.parent = stays[stays.length - 1];
      return stays[0];
    } else {
      return source;
    }
  }

  protected cloneSelection(s: Selection): Selection {
    const clone = new Selection(s.lang, cloneDeep(s.condition), s.source);
    clone.schema = clone.schema.slice();
    clone.schemaSet = clone.schemaSet.clone();
    return clone;
  }

  protected checkProjection(
    s: Selection,
    p: Projection,
    toRenameContainer?: Set<Selection>,
  ): boolean {
    const tdeps = this.getSelectionDeps(s);
    const areRenamed = areDepsOnlyRenamed(tdeps, p);
    if (areRenamed === RenamedDepsResult.modified) return false;
    if (areRenamed === RenamedDepsResult.unchanged) return true;

    if (
      s.condition instanceof ASTIdentifier ||
      this.renameCheckerVmap[s.condition.lang].canRename(s.condition, p.renames)
    ) {
      if (toRenameContainer) {
        toRenameContainer.add(s);
      }
      return true;
    }
    return false;
  }

  protected pushSelectionsUnder<
    Key extends string,
    Op extends PlanTupleOperator & Record<Key, PlanTupleOperator>,
  >(selections: Selection[], key: Key, source: Op): void {
    if (selections.length) {
      for (const s of selections) {
        s.schema = source[key].schema.slice();
        s.schemaSet = source[key].schemaSet.clone();
      }
      selections[selections.length - 1].source = source[key];
      source[key].parent = selections[selections.length - 1];
      source[key] = selections[0] as any;
      selections[0].parent = source;
    }
  }
}
