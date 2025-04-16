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
import {
  IdSet,
  LogicalPlanOperator,
  LogicalPlanTupleOperator,
} from '../../plan/visitor.js';
import { areDepsOnlyRenamed } from '../../utils/projection.js';
import { containsAll, difference, invert, union } from '../../utils/trie.js';
import { AttributeRenameChecker } from '../../visitors/attribute-rename-checker.js';
import { AttributeRenamer } from '../../visitors/attribute-renamer.js';
import { TransitiveDependencies } from '../../visitors/transitive-deps.js';
import { PatternRule } from '../rule.js';

export interface PushdownSelectionsBindings {
  selections: Selection[];
  source: LogicalPlanTupleOperator;
}

export class PushdownSelections
  implements PatternRule<Selection, PushdownSelectionsBindings>
{
  public operator = Selection;
  public alwaysSwap = new Set<{
    new (
      ...args: any[]
    ): LogicalPlanTupleOperator & { source: LogicalPlanTupleOperator };
  }>([OrderBy, Distinct]);
  public setOps = new Set<{
    new (...args: any[]): LogicalPlanTupleOperator & {
      left: LogicalPlanOperator;
      right: LogicalPlanOperator;
    };
  }>([Union, Intersection, Difference]);
  protected tdepsVmap: Record<string, TransitiveDependencies>;
  protected renamerVmap: Record<string, AttributeRenamer>;
  protected renameCheckerVmap: Record<string, AttributeRenameChecker>;

  constructor(protected db: DortDBAsFriend) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
    this.renamerVmap = this.db.langMgr.getVisitorMap('attributeRenamer');
    this.renameCheckerVmap = this.db.langMgr.getVisitorMap(
      'attributeRenameChecker',
    );
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
      this.alwaysSwap.has(bindings.source.constructor as any) ||
      (this.setOps.has(bindings.source.constructor as any) &&
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
      const tdeps = difference(src.schemaSet, this.getSelectionDeps(s));
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
      const tdeps = difference(src.schemaSet, this.getSelectionDeps(s));
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
      const tdeps = this.getSelectionDeps(s);
      if (
        areDepsOnlyRenamed(tdeps, bindings.source as Projection) &&
        (s.condition instanceof ASTIdentifier ||
          this.renameCheckerVmap[s.condition.lang].canRename(
            s.condition,
            (bindings.source as Projection).renames,
          ))
      ) {
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
  ): LogicalPlanOperator {
    const { selections, source } = bindings;
    const last = selections[selections.length - 1];
    if (this.alwaysSwap.has(source.constructor as any)) {
      return this.transformBasic(source as any, node, last);
    }
    if (this.setOps.has(source.constructor as any)) {
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
    source: { source: LogicalPlanTupleOperator } & LogicalPlanTupleOperator,
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
      left: LogicalPlanTupleOperator;
      right: LogicalPlanTupleOperator;
    } & LogicalPlanTupleOperator,
    first: Selection,
    last: Selection,
    selections: Selection[],
  ) {
    const clones = this.cloneSelections(selections);
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
    for (const s of selections) {
      const tdeps = this.getSelectionDeps(s);
      if (
        areDepsOnlyRenamed(tdeps, source) &&
        (s.condition instanceof ASTIdentifier ||
          this.renameCheckerVmap[s.condition.lang].canRename(
            s.condition,
            source.renames,
          ))
      ) {
        canPushdown.push(s);
      } else {
        mustStay.push(s);
      }
    }
    const renamesInv = invert(source.renames);

    for (let i = 0; i < mustStay.length - 1; i++) {
      mustStay[i].source = mustStay[i + 1];
      mustStay[i + 1].parent = mustStay[i];
    }
    for (let i = 0; i < canPushdown.length - 1; i++) {
      canPushdown[i].source = canPushdown[i + 1];
      canPushdown[i + 1].parent = canPushdown[i];
      this.renamerVmap[canPushdown[i].lang].rename(canPushdown[i], renamesInv);
    }
    canPushdown[canPushdown.length - 1].source = source.source;
    source.source.parent = canPushdown[canPushdown.length - 1];
    source.source = canPushdown[0];
    canPushdown[0].parent = source;
    this.renamerVmap[canPushdown[0].lang].rename(canPushdown[0], renamesInv);
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
      const tdeps = difference(source.schemaSet, this.getSelectionDeps(s));
      if (containsAll(source.left.schemaSet, tdeps)) {
        lefts.push(s);
      } else if (containsAll(source.right.schemaSet, tdeps)) {
        rights.push(s);
      } else {
        stays.push(s);
      }
    }

    for (const arr of [lefts, rights, stays]) {
      for (let i = 0; i < arr.length - 1; i++) {
        arr[i].source = arr[i + 1];
        arr[i + 1].parent = arr[i];
      }
    }

    if (lefts.length) {
      lefts[lefts.length - 1].source = source.left;
      source.left.parent = lefts[lefts.length - 1];
      source.left = lefts[0];
      lefts[0].parent = source;
    }
    if (rights.length) {
      rights[rights.length - 1].source = source.right;
      source.right.parent = rights[rights.length - 1];
      source.right = rights[0];
      rights[0].parent = source;
    }
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
      const tdeps = difference(source.schemaSet, this.getSelectionDeps(s));
      if (containsAll(source.mapping.schemaSet, tdeps)) {
        horizs.push(s);
      } else if (containsAll(source.source.schemaSet, tdeps)) {
        verts.push(s);
      } else {
        stays.push(s);
      }
    }

    for (const arr of [horizs, verts, stays]) {
      for (let i = 0; i < arr.length - 1; i++) {
        arr[i].source = arr[i + 1];
        arr[i + 1].parent = arr[i];
      }
    }

    if (horizs.length) {
      horizs[horizs.length - 1].source = source.mapping;
      source.mapping.parent = horizs[horizs.length - 1];
      source.mapping = horizs[0];
      horizs[0].parent = source;
    }
    if (verts.length) {
      verts[verts.length - 1].source = source.source;
      source.source.parent = verts[verts.length - 1];
      source.source = verts[0];
      verts[0].parent = source;
    }
    if (stays.length) {
      stays[stays.length - 1].source = source;
      source.parent = stays[stays.length - 1];
      return stays[0];
    } else {
      return source;
    }
  }

  protected cloneSelections(selections: Selection[]) {
    return selections.map((s) => {
      const clone = new Selection(
        s.lang,
        structuredClone(s.condition),
        s.source,
      );
      clone.schema = clone.schema.slice();
      clone.schemaSet = union(clone.schemaSet);
      return clone;
    });
  }
}
