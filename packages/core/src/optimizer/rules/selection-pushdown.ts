import { ASTIdentifier } from '../../ast.js';
import { Trie } from '../../data-structures/trie.js';
import { DortDBAsFriend } from '../../db.js';
import { retI1 } from '../../internal-fns/index.js';
import {
  CartesianProduct,
  Difference,
  Distinct,
  GroupBy,
  Intersection,
  Join,
  OrderBy,
  Projection,
  ProjectionConcat,
  RenameMap,
  Selection,
  Union,
} from '../../plan/operators/index.js';
import { IdSet, PlanOperator, PlanTupleOperator } from '../../plan/visitor.js';
import {
  areDepsOnlyRenamed,
  RenamedDepsResult,
} from '../../utils/projection.js';
import {
  containsAll,
  containsAny,
  difference,
  invert,
  restriction,
  schemaToTrie,
} from '../../utils/trie.js';
import { AttributeRenameChecker } from '../../visitors/attribute-rename-checker.js';
import { AttributeRenamer } from '../../visitors/attribute-renamer.js';
import { TransitiveDependencies } from '../../visitors/transitive-deps.js';
import {
  BranchedOperator,
  PatternRule,
  PatternRuleMatchResult,
  TupleOperatorWithSource,
} from '../rule.js';

/** Pattern-match bindings for the {@link PushdownSelections} rule. */
export interface PushdownSelectionsBindings {
  /** Contiguous {@link Selection} operators to be pushed down. */
  selections: Selection[];
  /** The operator immediately below the selection stack. */
  source: PlanTupleOperator;
}

/**
 * Pushes down selection predicates through the query plan, so that
 * they can be applied as early as possible.
 */
export class PushdownSelections implements PatternRule<
  Selection,
  PushdownSelectionsBindings
> {
  public operator = Selection;
  /**
   * Operator classes whose selection can always be pushed below them (e.g. {@link OrderBy}, {@link Distinct}).
   */
  public alwaysSwap: {
    new (...args: any[]): TupleOperatorWithSource;
  }[] = [OrderBy, Distinct];
  /**
   * Set-operation operator classes through which selections are duplicated to both branches.
   */
  public setOps: {
    new (...args: any[]): BranchedOperator;
  }[] = [Union, Intersection, Difference];
  /** Per-language transitive-dependency visitor instances. */
  protected tdepsVmap: Record<string, TransitiveDependencies>;
  /** Per-language attribute-renamer visitor instances. */
  protected renamerVmap: Record<string, AttributeRenamer>;
  /** Per-language attribute-rename-checker visitor instances. */
  protected renameCheckerVmap: Record<string, AttributeRenameChecker>;

  constructor(
    /** Internal database interface. */
    protected db: DortDBAsFriend,
  ) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
    this.renamerVmap = this.db.langMgr.getVisitorMap('attributeRenamer');
    this.renameCheckerVmap = this.db.langMgr.getVisitorMap(
      'attributeRenameChecker',
    );
    this.cloneSelection = this.cloneSelection.bind(this);
  }

  public match(
    node: Selection,
  ): PatternRuleMatchResult<PushdownSelectionsBindings> | null {
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

    if (this.alwaysSwap.includes(bindings.source.constructor as any)) {
      return { bindings };
    }
    if (
      this.setOps.includes(bindings.source.constructor as any) &&
      bindings.source.schema
    ) {
      return this.matchSetOp(bindings);
    }
    if (bindings.source.constructor === Projection) {
      return this.matchProjection(bindings);
    }
    if (
      bindings.source.constructor === Join ||
      bindings.source.constructor === CartesianProduct
    ) {
      return this.matchJoins(bindings);
    }
    if (bindings.source.constructor === ProjectionConcat) {
      return this.matchProjectionConcat(bindings);
    }
    if (bindings.source.constructor === GroupBy) {
      return this.matchGroupBy(bindings);
    }
    return null;
  }

  /** Returns match bindings when at least one selection depends only on group-by keys. */
  protected matchGroupBy(
    bindings: PushdownSelectionsBindings,
  ): PatternRuleMatchResult<PushdownSelectionsBindings> | null {
    const src = bindings.source as GroupBy;
    const keySet = schemaToTrie(src.keys.map(retI1));
    for (const s of bindings.selections) {
      const tdeps = restriction(this.getSelectionDeps(s), src.schemaSet);
      if (containsAll(keySet, tdeps)) {
        return { bindings };
      }
    }
    return null;
  }

  /** Returns match bindings when at least one selection can be pushed to one side of a join. */
  protected matchJoins(
    bindings: PushdownSelectionsBindings,
  ): PatternRuleMatchResult<PushdownSelectionsBindings> | null {
    const src = bindings.source as CartesianProduct;
    for (const s of bindings.selections) {
      const tdeps = restriction(this.getSelectionDeps(s), src.schemaSet);
      if (
        (!(src as Join).rightOuter && containsAll(src.left.schemaSet, tdeps)) ||
        (!(src as Join).leftOuter && containsAll(src.right.schemaSet, tdeps))
      ) {
        return { bindings };
      }
    }
    return null;
  }
  /** Returns match bindings when at least one selection can be pushed into the source or mapping branch of a projection concat. */
  protected matchProjectionConcat(
    bindings: PushdownSelectionsBindings,
  ): PatternRuleMatchResult<PushdownSelectionsBindings> | null {
    const src = bindings.source as ProjectionConcat;
    for (const s of bindings.selections) {
      const tdeps = restriction(this.getSelectionDeps(s), src.schemaSet);
      if (
        containsAll(src.source.schemaSet, tdeps) ||
        (!src.outer && containsAll(src.mapping.schemaSet, tdeps))
      ) {
        return { bindings };
      }
    }
    return null;
  }
  /** Returns match bindings when at least one selection can be pushed through the projection. */
  protected matchProjection(
    bindings: PushdownSelectionsBindings,
  ): PatternRuleMatchResult<PushdownSelectionsBindings> | null {
    for (const s of bindings.selections) {
      if (this.checkProjection(s, bindings.source as Projection)) {
        return { bindings };
      }
    }
    return null;
  }

  /** Returns match bindings when at least one selection can be pushed through a set operation. */
  protected matchSetOp(
    bindings: PushdownSelectionsBindings,
  ): PatternRuleMatchResult<PushdownSelectionsBindings> | null {
    const src = bindings.source as BranchedOperator<PlanTupleOperator>;
    if (src.right.schema.every((id, i) => id.equals(src.left.schema[i]))) {
      // no need to rename
      return { bindings };
    }
    const renamesInv: RenameMap = new Trie();
    for (let i = 0; i < src.right.schema.length; i++) {
      renamesInv.set(src.right.schema[i].parts, src.left.schema[i].parts);
    }
    for (const s of bindings.selections) {
      if (this.renameCheckerVmap[s.lang].canRename(s.condition, renamesInv)) {
        return { bindings };
      }
    }
    return null;
  }

  /** Returns the set of identifiers that the selection's condition transitively depends on. */
  protected getSelectionDeps(s: Selection): IdSet {
    return this.tdepsVmap[s.lang].visitCalculation(s.condition);
  }

  public transform(
    node: Selection,
    bindings: PushdownSelectionsBindings,
  ): PlanOperator {
    const { selections, source } = bindings;
    const last = selections.at(-1);
    let res: PlanOperator;
    if (this.alwaysSwap.includes(source.constructor as any)) {
      res = this.transformBasic(source as any, node, last);
    } else if (this.setOps.includes(source.constructor as any)) {
      res = this.tranformSetOp(source as any, selections);
    } else if (source.constructor === Projection) {
      res = this.transformProjection(source as Projection, selections);
    } else if (
      source.constructor === CartesianProduct ||
      source.constructor === Join
    ) {
      res = this.transformJoin(source as CartesianProduct, selections);
    } else if (source.constructor === ProjectionConcat) {
      res = this.transformProjectionConcat(
        source as ProjectionConcat,
        selections,
      );
    } else if (source.constructor === GroupBy) {
      res = this.transformGroupBy(source as GroupBy, selections);
    } else {
      res = node;
    }

    for (const s of selections) {
      this.tdepsVmap[s.lang].invalidateCacheElement(s);
    }
    this.tdepsVmap[node.lang].invalidateCacheElement(source);

    return res;
  }

  /** Moves the selection stack below `source`, which is an operator that simply wraps a single child. */
  protected transformBasic(
    source: TupleOperatorWithSource,
    first: Selection,
    last: Selection,
  ) {
    last.source = source.source;
    source.source.parent = last;
    source.source = first;
    first.parent = source;
    return source;
  }

  /** Partitions selections into those that can be pushed below `source` and those that must stay above it. */
  protected transformGroupBy(source: GroupBy, selections: Selection[]) {
    const canPushdown: Selection[] = [];
    const mustStay: Selection[] = [];
    const toRename = new Set<Selection>();
    const keySet = schemaToTrie(source.keys.map(retI1));
    const renamesInv = new Trie() as RenameMap;
    for (const [orig, alias] of source.keys) {
      if (orig instanceof ASTIdentifier && !orig.equals(alias)) {
        renamesInv.set(alias.parts, orig.parts);
      }
    }

    for (const s of selections) {
      const tdeps = restriction(this.getSelectionDeps(s), source.schemaSet);
      if (containsAll(keySet, tdeps)) {
        canPushdown.push(s);
        if (renamesInv.size && containsAny(renamesInv, tdeps)) {
          toRename.add(s);
        }
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
        this.renamerVmap[curr.lang].rename(curr.condition, renamesInv);
      }
    }

    for (const s of canPushdown) {
      s.schema = source.source.schema.slice();
      s.schemaSet = source.source.schemaSet.clone();
    }

    const lastCP = canPushdown.at(-1);
    lastCP.source = source.source;
    source.source.parent = lastCP;
    source.source = canPushdown[0];
    canPushdown[0].parent = source;
    if (toRename.has(lastCP)) {
      this.renamerVmap[lastCP.lang].rename(lastCP.condition, renamesInv);
    }

    if (mustStay.length) {
      mustStay.at(-1).source = source;
      source.parent = mustStay.at(-1);
      return mustStay[0];
    } else {
      return source;
    }
  }

  /** Duplicates the selection stack into both branches of the set operation. */
  protected tranformSetOp(
    source: BranchedOperator<PlanTupleOperator>,
    selections: Selection[],
  ) {
    let canPushdown: Selection[] = [];
    const mustStay: Selection[] = [];
    const toRename = new Set<Selection>();
    const renamesInv: RenameMap = new Trie();

    if (
      source.left.schema.every((id, i) => id.equals(source.right.schema[i]))
    ) {
      canPushdown = selections;
    } else {
      for (let i = 0; i < source.right.schema.length; i++) {
        renamesInv.set(
          source.right.schema[i].parts,
          source.left.schema[i].parts,
        );
      }
      for (const s of selections) {
        if (this.renameCheckerVmap[s.lang].canRename(s.condition, renamesInv)) {
          canPushdown.push(s);
          toRename.add(s);
        } else {
          mustStay.push(s);
        }
      }
    }
    const renames: RenameMap = invert(renamesInv);

    const clones = canPushdown.map(this.cloneSelection);
    for (let i = 0; i < mustStay.length - 1; i++) {
      mustStay[i].source = mustStay[i + 1];
      mustStay[i + 1].parent = mustStay[i];
    }
    for (let i = 0; i < canPushdown.length - 1; i++) {
      const curr = canPushdown[i];
      curr.source = canPushdown[i + 1];
      canPushdown[i + 1].parent = curr;
      if (toRename.has(curr)) {
        this.renamerVmap[curr.lang].rename(curr.condition, renames);
      }

      clones[i].source = clones[i + 1];
      clones[i + 1].parent = clones[i];
    }

    for (const s of canPushdown) {
      s.schema = source.right.schema.slice();
      s.schemaSet = source.right.schemaSet.clone();
    }
    for (const s of clones) {
      s.schema = source.left.schema.slice();
      s.schemaSet = source.left.schemaSet.clone();
    }

    const lastCP = canPushdown.at(-1);
    lastCP.source = source.right;
    source.right.parent = lastCP;
    source.right = canPushdown[0];
    canPushdown[0].parent = source;
    if (toRename.has(lastCP)) {
      this.renamerVmap[lastCP.lang].rename(lastCP.condition, renames);
    }

    const lastC = clones.at(-1);
    lastC.source = source.left;
    source.left.parent = lastC;
    source.left = clones[0];
    clones[0].parent = source;

    if (mustStay.length) {
      mustStay.at(-1).source = source;
      source.parent = mustStay.at(-1);
      return mustStay[0];
    } else {
      return source;
    }
  }

  /** Pushes selections that can pass through `source` below it, renaming their conditions as needed. */
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
        this.renamerVmap[curr.lang].rename(curr.condition, source.renamesInv);
      }
    }

    for (const s of canPushdown) {
      s.schema = source.source.schema.slice();
      s.schemaSet = source.source.schemaSet.clone();
    }

    const lastCP = canPushdown.at(-1);
    lastCP.source = source.source;
    source.source.parent = lastCP;
    source.source = canPushdown[0];
    canPushdown[0].parent = source;
    if (toRename.has(lastCP)) {
      this.renamerVmap[lastCP.lang].rename(lastCP.condition, source.renamesInv);
    }

    if (mustStay.length) {
      mustStay.at(-1).source = source;
      source.parent = mustStay.at(-1);
      return mustStay[0];
    } else {
      return source;
    }
  }

  /** Routes each selection to the left branch, right branch, or leaves it above the join. */
  protected transformJoin(source: CartesianProduct, selections: Selection[]) {
    const lefts: Selection[] = [];
    const rights: Selection[] = [];
    const stays: Selection[] = [];
    for (const s of selections) {
      const tdeps = restriction(this.getSelectionDeps(s), source.schemaSet);
      let used = false;
      if (
        !(source as Join).rightOuter &&
        containsAll(source.left.schemaSet, tdeps)
      ) {
        lefts.push(s);
        used = true;
      }
      if (
        !(source as Join).leftOuter &&
        containsAll(source.right.schemaSet, tdeps)
      ) {
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
      stays.at(-1).source = source;
      source.parent = stays.at(-1);
      return stays[0];
    } else {
      return source;
    }
  }

  /** Pushes selections into the source or mapping branch of a projection concat where possible. */
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
      if (!source.outer && containsAll(source.mapping.schemaSet, tdeps)) {
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
      stays.at(-1).source = source;
      source.parent = stays.at(-1);
      return stays[0];
    } else {
      return source;
    }
  }

  /** Returns a shallow clone of `s` with its own schema copy. */
  protected cloneSelection(s: Selection): Selection {
    const clone = new Selection(s.lang, s.condition.clone(), s.source);
    clone.schema = clone.schema.slice();
    clone.schemaSet = clone.schemaSet.clone();
    return clone;
  }

  /** Returns `true` if selection `s` can be pushed through projection `p`; adds `s` to `toRenameContainer` when a rename is also needed. */
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
      this.renameCheckerVmap[s.condition.lang].canRename(s.condition, p.renames)
    ) {
      const madeByProj = difference(tdeps, p.schemaSet);
      if (containsAny(madeByProj, p.renames)) return false;
      if (toRenameContainer) {
        toRenameContainer.add(s);
      }
      return true;
    }
    return false;
  }

  /** Rewires `selections` so they sit between `source` and `source[key]`, updating parent references and schemas. */
  protected pushSelectionsUnder<
    Key extends string,
    Op extends PlanTupleOperator & Record<Key, PlanTupleOperator>,
  >(selections: Selection[], key: Key, source: Op): void {
    if (selections.length) {
      for (const s of selections) {
        s.schema = source[key].schema.slice();
        s.schemaSet = source[key].schemaSet.clone();
      }
      selections.at(-1).source = source[key];
      source[key].parent = selections.at(-1);
      source[key] = selections[0] as any;
      selections[0].parent = source;
    }
  }
}
