import { Trie } from './data-structures/trie.js';
import { allAttrs, ASTIdentifier, ASTNode } from './ast.js';
import { Extension, core } from './extension.js';
import { Language, LanguageManager } from './lang-manager.js';
import { Optimizer, OptimizerConfig } from './optimizer/optimizer.js';
import { fromItemIndexKey, Index } from './indices/index.js';
import {
  Calculation,
  ItemSource,
  MapFromItem,
  Projection,
  RenameMap,
  TupleSource,
} from './plan/operators/index.js';
import { idToCalculation } from './utils/calculation.js';
import { toArray } from './internal-fns/index.js';
import { Aliased, PlanOperator } from './plan/visitor.js';

export class DortDB<LangNames extends string = string> {
  protected langMgr: LanguageManager = null;
  protected registeredSources = new Trie<symbol | string | number, unknown>();
  public readonly optimizer: Optimizer;
  public indices = new Trie<symbol | string | number, Index[]>();
  protected friendInterface: DortDBAsFriend = {
    langMgr: null,
    optimizer: null,
    getSource: (source) => this.registeredSources.get(source),
    indices: this.indices,
  };

  constructor(protected config: DortDBConfig<LangNames>) {
    this.langMgr = this.friendInterface.langMgr = new LanguageManager(
      this.friendInterface,
    );
    this.friendInterface.langMgr = this.langMgr;

    this.langMgr.registerExtension(core);
    this.langMgr.registerLang(config.mainLang);
    this.config.additionalLangs?.forEach((lang) =>
      this.langMgr.registerLang(lang),
    );
    this.optimizer = new Optimizer(config.optimizer, this.friendInterface);
    this.friendInterface.optimizer = this.optimizer;
    this.config.extensions?.forEach((e) => this.langMgr.registerExtension(e));
  }

  public parse(query: string, options?: QueryOptions<LangNames>): ASTNode[] {
    return this.langMgr
      .getLang(options?.mainLang ?? this.config.mainLang.name)
      .createParser(this.langMgr)
      .parse(query).value;
  }

  public buildPlan(
    query: ASTNode,
    options?: QueryOptions<LangNames>,
  ): PlanOperator {
    // const varMappers = this.langMgr.getVisitorMap('variableMapper');
    const Visitor = this.langMgr.getLang(
      options?.mainLang ?? this.config.mainLang.name,
    ).visitors.logicalPlanBuilder;
    const plan = new Visitor(this.friendInterface).buildPlan(query, new Trie());
    const optimized = this.optimizer.optimize(plan.plan);
    // varMappers[optimized.lang].mapVariables(optimized);
    return optimized;
  }

  public query<T = unknown>(
    query: string,
    options?: QueryOptions<LangNames>,
  ): QueryResult<T> {
    const parsed = this.parse(query, options);
    const plan = this.buildPlan(parsed.at(-1), options);
    const serialized = this.executePlan<T>(plan, options?.boundParams);
    return {
      data: toArray(serialized.data),
      schema: serialized.schema,
    };
  }

  public executePlan<T = unknown>(
    plan: PlanOperator,
    boundParams?: Record<string, unknown>,
  ): {
    data: Iterable<T>;
    schema?: string[];
  } {
    const varMappers = this.langMgr.getVisitorMap('variableMapper');
    const executors = this.langMgr.getVisitorMap('executor');
    const serialize = this.langMgr.getLang(plan.lang).serialize;

    const varMapCtx = varMappers[plan.lang].mapVariables(plan);
    const { result, ctx } = executors[plan.lang].execute(
      plan,
      varMapCtx,
      boundParams,
    );
    const serialized = serialize(result, ctx, plan);
    return serialized as {
      data: Iterable<T>;
      schema?: string[];
    };
  }

  public registerSource(source: (symbol | string | number)[], data: unknown) {
    this.registeredSources.set(source, data);
  }

  public createIndex(
    source: (symbol | string | number)[],
    expressions: string[],
    indexCls: { new (expressions: Calculation[], db: DortDBAsFriend): Index },
    options?: QueryOptions<LangNames> & {
      /** If the source is supposed to be an {@link ItemSource},
       * what is the key we are looking for in the expression? */
      fromItemKey?: string[];
    },
  ) {
    const lang = options?.mainLang ?? this.config.mainLang.name;
    const parser = this.langMgr.getLang(lang).createParser(this.langMgr);
    const calcs = expressions.map((expr) => {
      const parsed = parser.parseExpr(expr);
      const planBuilder = this.langMgr.getLang(
        options?.mainLang ?? this.config.mainLang.name,
      ).visitors.logicalPlanBuilder;
      const plan = new planBuilder(this.friendInterface).buildPlan(
        parsed.value[0],
        new Trie(options?.fromItemKey ? [options.fromItemKey] : []),
      );
      const maybeProj = this.optimizer.optimize(plan.plan);
      const res =
        maybeProj instanceof Projection
          ? maybeProj.attrs[0][0]
          : (maybeProj as Calculation | ASTIdentifier);

      if (res instanceof Calculation) {
        if (res.getChildren().length) {
          throw new Error('Expression cannot contain subqueries');
        }
        if (options?.fromItemKey)
          this.renameItemIndexExpr(res, options.fromItemKey);
        return res;
      }
      return idToCalculation(
        options?.fromItemKey
          ? ASTIdentifier.fromParts([fromItemIndexKey])
          : res,
        lang,
      );
    });
    const index = new indexCls(calcs, this.friendInterface);
    const currIndices = this.indices.get(source);
    if (currIndices) {
      currIndices.push(index);
    } else {
      this.indices.set(source, [index]);
    }

    this.fillIndex(index, source, !!options?.fromItemKey);
  }

  /**
   * Renames expressions for item source indices to a common key
   * @param expr The expression to rename
   */
  private renameItemIndexExpr(expr: Calculation, fromItemKey: string[]): void {
    if (expr.dependencies.size === 0) return;
    if (expr.original) {
      const renamers = this.langMgr.getVisitorMap('attributeRenamer');
      const renameMap: RenameMap = new Trie();
      renameMap.set(fromItemKey, [fromItemIndexKey]);
      renamers[expr.lang].rename(expr.original, renameMap);
    }
    const newId = ASTIdentifier.fromParts([fromItemIndexKey]);
    expr.args = expr.args.map(() => newId);
  }

  protected fillIndex(
    index: Index,
    source: (symbol | string | number)[],
    isItemSource = false,
  ) {
    if (index.expressions.length === 0) return;
    const lang = index.expressions[0].lang;

    const varMappers = this.langMgr.getVisitorMap('variableMapper');
    const executors = this.langMgr.getVisitorMap('executor');

    const exprs = index.expressions.map(
      (e, i) =>
        [e.clone(), ASTIdentifier.fromParts([i])] as Aliased<
          Calculation | ASTIdentifier
        >,
    );
    const allAttrsId = isItemSource
      ? ASTIdentifier.fromParts([fromItemIndexKey])
      : ASTIdentifier.fromParts([allAttrs]);
    exprs.unshift([allAttrsId, allAttrsId]);
    const projection = new Projection(
      lang,
      exprs,
      isItemSource
        ? new MapFromItem(
            lang,
            allAttrsId,
            new ItemSource(lang, ASTIdentifier.fromParts(source)),
          )
        : new TupleSource(lang, ASTIdentifier.fromParts(source)),
    );
    if (!isItemSource) {
      for (const expr of index.expressions) {
        projection.source.addToSchema(expr.dependencies);
      }
      projection.source.addToSchema(allAttrsId);
    }
    const varMapCtx = varMappers[lang].mapVariables(projection);

    const { result, ctx } = executors[lang].execute(projection, varMapCtx);
    const [itemKey, ...keys] = ctx.getKeys(projection);
    index.reindex(
      Iterator.from(result as Iterable<unknown[]>).map((item) => ({
        value: item[itemKey],
        keys: keys.map((key) => item[key]),
      })),
    );
  }
}

export interface QueryResult<T = unknown> {
  data: T[];
  schema?: string[];
}

export interface QueryOptions<LangNames extends string> {
  mainLang?: Lowercase<LangNames>;
  boundParams?: Record<string, unknown>;
}

export interface DortDBConfig<LangNames extends string> {
  mainLang: Language<LangNames>;
  additionalLangs?: Language<LangNames>[];
  extensions?: Extension<LangNames>[];
  optimizer: OptimizerConfig;
}

export interface DortDBAsFriend {
  langMgr: LanguageManager;
  getSource(source: (symbol | string | number)[]): unknown;
  optimizer: Optimizer;
  indices: Trie<symbol | string | number, Index[]>;
}
