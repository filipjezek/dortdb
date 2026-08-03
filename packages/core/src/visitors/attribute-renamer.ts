import { IdSet, OpOrId, PlanOperator, PlanVisitor } from '../plan/visitor.js';
import * as plan from '../plan/operators/index.js';
import { DortDBAsFriend } from '../db.js';
import { TransitiveDependencies } from './transitive-deps.js';
import { ASTIdentifier } from '../ast.js';
import { retI0, retI1 } from '../internal-fns/index.js';
import {
  VariableMap,
  VariableMapper,
  VariableMapperCtx,
} from './variable-mapper.js';
import { Trie } from '../data-structures/trie.js';

/** Maps plan operators to their respective variable maps. */
export type Translations = Map<PlanOperator, VariableMap>;

/**
 * Renames attributes in the plan.
 */
export class AttributeRenamer implements PlanVisitor<void, Translations> {
  /** Per-language {@link TransitiveDependencies} visitor map, used to invalidate the cache after renaming. */
  protected tdepsVmap: Record<string, TransitiveDependencies>;
  /** Per-language {@link VariableMapper} map, used for variable mapping. */
  protected varMappers: Record<string, VariableMapper>;

  constructor(
    /** Per-language visitor map used for recursive descent. */
    protected vmap: Record<string, PlanVisitor<void, Translations>>,
    /** Database instance providing access to the language manager. */
    protected db: DortDBAsFriend,
  ) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
    this.varMappers = this.db.langMgr.getVisitorMap('variableMapper');
  }

  /**
   * Applies `translations` to `plan` in place and invalidates the transitive-dependency cache
   * for the entire subtree rooted at `plan`.
   */
  public rename(plan: PlanOperator, renames: plan.RenameMap): void {
    const ctx = this.prepareVarMapCtx(renames);
    // first, map all variables to numeric indexes
    plan.accept(this.varMappers, ctx);
    // then, reverse the translation map to get the actual renames
    const translations = this.prepareTranslations(ctx, renames);

    plan.accept(this.vmap, translations);
    this.tdepsVmap[plan.lang].invalidateCacheUpstream(plan);
  }

  /**
   * First, the whole plan is mapped to numeric indexes. This method prepares the context for that mapping.
   */
  protected prepareVarMapCtx(renames: plan.RenameMap): VariableMapperCtx {
    const renameVarMap: VariableMap = new Trie();
    let index = 0;
    for (const from of renames.keys()) {
      renameVarMap.set(from, ASTIdentifier.fromParts([index++]));
    }

    return {
      scopeStack: [
        new Trie(), // for bound params
        renameVarMap,
      ],
      currentIndex: index,
      variableNames: [],
      translations: new Map(),
      calcIntermediates: true,
    };
  }

  /**
   * Prepares variable map for renaming by reversing the translation map from the variable-mapper context.
   */
  protected prepareTranslations(
    ctx: VariableMapperCtx,
    renames: plan.RenameMap,
  ): Translations {
    const translations: Translations = new Map();
    for (const [op, { scope, external }] of ctx.translations.entries()) {
      const consolidated: VariableMap = new Trie();
      for (const [from, to] of external.entries()) {
        consolidated.set(to.parts, ASTIdentifier.fromParts(from));
      }
      for (const [from, to] of scope.entries()) {
        consolidated.set(to.parts, ASTIdentifier.fromParts(from));
      }
      let index = 0;
      for (const from of renames.keys()) {
        consolidated.set([index++], ASTIdentifier.fromParts(renames.get(from)));
      }
      translations.set(op, consolidated);
    }
    return translations;
  }

  /** Rename a single identifier, keeping references to aggregates */
  protected renameIdentifier(id: ASTIdentifier, varmap: VariableMap) {
    let fromRenames = varmap.get(id.parts);
    if (!fromRenames)
      throw new Error(`No translation found for ${id.parts.join('.')}`);
    if (id.aggregate) {
      fromRenames = ASTIdentifier.fromParts([...fromRenames.parts]);
      fromRenames.aggregate = id.aggregate;
    }
    return fromRenames;
  }

  /**
   * Iterates `array` in place, replacing each {@link ASTIdentifier} element with
   * its renamed version.
   * @param updateFn Optional callback used instead of direct array assignment when the
   *   renamed identifier lives in a wrapper object (e.g. a projection pair).
   */
  protected processArray(
    array: OpOrId[],
    translations: Translations,
    containingOp: PlanOperator,
    updateFn?: (newId: ASTIdentifier, i: number) => void,
  ) {
    const varmap = translations.get(containingOp);
    for (let i = 0; i < array.length; i++) {
      const item = array[i];
      if (item instanceof ASTIdentifier) {
        const fromRenames = this.renameIdentifier(item, varmap);
        if (updateFn) {
          updateFn(fromRenames, i);
        } else {
          array[i] = fromRenames;
        }
      } else {
        item.accept(this.vmap, translations);
      }
    }
  }

  /**
   * Renames a single property `obj[key]` in place when it is an
   * {@link ASTIdentifier}; otherwise recurses into the operator.
   */
  protected processItem<Key extends string, Obj extends Record<Key, OpOrId>>(
    obj: Obj,
    key: Key,
    translations: Translations,
    containingOp: PlanOperator,
  ) {
    const item = obj[key];
    if (item instanceof ASTIdentifier) {
      const varmap = translations.get(containingOp);
      const newAttr = this.renameIdentifier(item, varmap);
      obj[key] = newAttr as Obj[Key];
    } else {
      item.accept(this.vmap, translations);
    }
  }

  visitRecursion(operator: plan.Recursion, translations: Translations): void {
    operator.source.accept(this.vmap, translations);
    this.processArray(operator.distinctKeys, translations, operator);
    operator.condition.accept(this.vmap, translations);
  }
  visitProjection(operator: plan.Projection, translations: Translations): void {
    const varmap = translations.get(operator);
    operator.source.accept(this.vmap, translations);

    operator.renames = new Trie();
    operator.renamesInv = new Trie();
    for (const attr of operator.attrs) {
      attr[1] = this.renameIdentifier(attr[1], varmap);
      if (attr[0] instanceof ASTIdentifier) {
        attr[0] = this.renameIdentifier(attr[0], varmap);
        operator.renames.set(attr[0].parts, attr[1].parts);
        operator.renamesInv.set(attr[1].parts, attr[0].parts);
      } else {
        attr[0].accept(this.vmap, translations);
      }
    }
  }
  visitSelection(operator: plan.Selection, translations: Translations): void {
    operator.source.accept(this.vmap, translations);
    operator.condition.accept(this.vmap, translations);
  }
  visitTupleSource(
    operator: plan.TupleSource,
    translations: Translations,
  ): void {}
  visitItemSource(
    operator: plan.ItemSource,
    translations: Translations,
  ): void {}
  visitFnCall(operator: plan.FnCall, translations: Translations): void {
    const varmap = translations.get(operator);
    for (let i = 0; i < operator.args.length; i++) {
      const item = operator.args[i];
      if (item instanceof ASTIdentifier) {
        const fromRenames = this.renameIdentifier(item, varmap);
        operator.args[i] = fromRenames;
      } else if (plan.CalcIntermediate in item.op) {
        item.op.accept(this.vmap, translations);
      }
    }
  }
  visitLiteral(operator: plan.Literal, translations: Translations): void {
    return;
  }
  visitCalculation(
    operator: plan.Calculation,
    translations: Translations,
  ): void {
    this.processArray(operator.args, translations, operator);
    if (operator.original) {
      operator.original.accept(this.vmap, translations);
    }
  }
  visitConditional(
    operator: plan.Conditional,
    translations: Translations,
  ): void {
    const renames = translations.get(operator);
    for (const key of ['condition', 'defaultCase'] as const) {
      const item = operator[key];
      if (item instanceof ASTIdentifier) {
        const fromRenames = this.renameIdentifier(item, renames);
        if (fromRenames) {
          operator[key] = fromRenames;
        }
      } else if (plan.CalcIntermediate in item) {
        item.accept(this.vmap, translations);
      }
    }

    for (const wt of operator.whenThens) {
      for (const key of [0, 1] as const) {
        const item = wt[key];
        if (item instanceof ASTIdentifier) {
          const fromRenames = this.renameIdentifier(item, renames);
          if (fromRenames) {
            wt[key] = fromRenames;
          }
        } else if (plan.CalcIntermediate in item) {
          item.accept(this.vmap, translations);
        }
      }
    }
  }
  visitCartesianProduct(
    operator: plan.CartesianProduct,
    translations: Translations,
  ): void {
    operator.left.accept(this.vmap, translations);
    operator.right.accept(this.vmap, translations);
  }
  visitJoin(operator: plan.Join, translations: Translations): void {
    this.visitCartesianProduct(operator, translations);
    this.processArray(operator.conditions, translations, operator);
  }
  visitProjectionConcat(
    operator: plan.ProjectionConcat,
    translations: Translations,
  ): void {
    operator.source.accept(this.vmap, translations);
    this.processItem(operator, 'mapping', translations, operator);
  }
  visitMapToItem(operator: plan.MapToItem, translations: Translations): void {
    operator.key = translations.get(operator).get(operator.key.parts);
    operator.source.accept(this.vmap, translations);
  }
  visitMapFromItem(
    operator: plan.MapFromItem,
    translations: Translations,
  ): void {
    operator.key = translations.get(operator).get(operator.key.parts);
    operator.source.accept(this.vmap, translations);
  }
  visitProjectionIndex(
    operator: plan.ProjectionIndex,
    translations: Translations,
  ): void {
    operator.indexCol = translations.get(operator).get(operator.indexCol.parts);
    operator.source.accept(this.vmap, translations);
  }
  visitOrderBy(operator: plan.OrderBy, translations: Translations): void {
    operator.source.accept(this.vmap, translations);
    this.processArray(
      operator.orders.map(plan.getKey),
      translations,
      operator,
      (id, i) => (operator.orders[i].key = id),
    );
  }
  visitGroupBy(operator: plan.GroupBy, translations: Translations): void {
    operator.source.accept(this.vmap, translations);
    this.processArray(
      operator.keys.map(retI0),
      translations,
      operator,
      (id, i) => (operator.keys[i][0] = id),
    );
    this.processArray(
      operator.keys.map(retI1),
      translations,
      operator,
      (id, i) => (operator.keys[i][1] = id),
    );
    this.processArray(operator.aggs, translations, operator);
  }
  visitLimit(operator: plan.Limit, translations: Translations): void {
    operator.source.accept(this.vmap, translations);
  }
  visitSetOp(operator: plan.SetOperator, translations: Translations): void {
    operator.left.accept(this.vmap, translations);
    operator.right.accept(this.vmap, translations);
  }
  visitUnion(operator: plan.Union, translations: Translations): void {
    this.visitSetOp(operator, translations);
  }
  visitIntersection(
    operator: plan.Intersection,
    translations: Translations,
  ): void {
    this.visitSetOp(operator, translations);
  }
  visitDifference(operator: plan.Difference, translations: Translations): void {
    this.visitSetOp(operator, translations);
  }
  visitDistinct(operator: plan.Distinct, translations: Translations): void {
    if (Array.isArray(operator.attrs)) {
      this.processArray(operator.attrs, translations, operator);
    }
    operator.source.accept(this.vmap, translations);
  }
  visitNullSource(
    operator: plan.NullSource,
    translations: Translations,
  ): void {}
  visitAggregate(
    operator: plan.AggregateCall,
    translations: Translations,
  ): void {
    operator.postGroupOp.accept(this.vmap, translations);
    operator.fieldName = translations
      .get(operator)
      .get(operator.fieldName.parts);
    this.processArray(operator.args, translations, operator);
  }
  visitItemFnSource(
    operator: plan.ItemFnSource,
    translations: Translations,
  ): void {
    this.processArray(operator.args, translations, operator);
  }
  visitTupleFnSource(
    operator: plan.TupleFnSource,
    translations: Translations,
  ): void {
    this.processArray(operator.args, translations, operator);
  }
  visitQuantifier(operator: plan.Quantifier, translations: Translations): void {
    // skip `query` because it was visited by the calculation.accept method
  }
  visitIndexScan(operator: plan.IndexScan, translations: Translations): void {
    if (operator.fromItemKey) {
      operator.fromItemKey = translations
        .get(operator)
        .get(operator.fromItemKey.parts);
    }
    operator.access.accept(this.vmap, translations);
  }
  visitIndexedRecursion(
    operator: plan.IndexedRecursion,
    translations: Translations,
  ): void {
    operator.source.accept(this.vmap, translations);
    this.processArray(operator.distinctKeys, translations, operator);
    this.processItem(operator, 'mapping', translations, operator);
  }
  visitBidirectionalRecursion(
    operator: plan.BidirectionalRecursion,
    translations: Translations,
  ): void {
    operator.source.accept(this.vmap, translations);
    operator.target.accept(this.vmap, translations);
    this.processItem(operator, 'mappingFwd', translations, operator);
    this.processItem(operator, 'mappingRev', translations, operator);
  }
}
