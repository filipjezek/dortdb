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
import { ExecutorConfig } from './visitors/executor.js';

/**
 * The main database class. Construct it with a {@link DortDBConfig} naming the
 * main language, then {@link query} (or {@link parse}/{@link buildPlan}) against it.
 *
 * @example
 * ```ts
 * import { DortDB } from '@dortdb/core';
 * import { SQL } from '@dortdb/lang-sql';
 *
 * const db = new DortDB({ mainLang: SQL() });
 * const { data } = db.query('SELECT 1 + 1 AS sum');
 * // data === [{ sum: 2 }]
 * ```
 */
export class DortDB<LangNames extends string = string> {
  /** Language manager that holds all registered languages and their extensions. */
  protected langMgr: LanguageManager = null;
  /** Trie of data sources registered via {@link registerSource}, keyed by their qualified name parts. */
  protected registeredSources = new Trie<symbol | string | number, unknown>();
  /** The query optimizer applied after every plan is built. */
  public readonly optimizer: Optimizer;
  /** Secondary indices registered via {@link createIndex}, keyed by the source's qualified name parts. */
  public indices = new Trie<symbol | string | number, Index[]>();
  /** Internal view of this instance exposed to language plug-ins and visitors. */
  protected friendInterface: DortDBAsFriend = {
    langMgr: null,
    optimizer: null,
    getSource: (source) => this.registeredSources.get(source),
    indices: this.indices,
    config: null,
  };

  constructor(
    /** Configuration used to initialise languages, extensions, and the optimizer. */
    protected config: DortDBConfig<LangNames>,
  ) {
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
    this.friendInterface.config = config;
  }

  /**
   * Parse a query into an AST (Abstract Syntax Tree).
   * The AST can be further manipulated and provided as an input to {@link buildPlan}.
   * @param query - The input query.
   * @returns - An array of root AST nodes for each query statement.
   */
  public parse(query: string, options?: QueryOptions<LangNames>): ASTNode[] {
    return this.langMgr
      .getLang(options?.mainLang ?? this.config.mainLang.name)
      .createParser(this.langMgr)
      .parse(query).value;
  }

  /**
   * Build an execution plan out of an AST (Abstract Syntax Tree).
   * The AST can be obtained, for example, by {@link parse}.
   * @param query - The root node of the AST.
   * @returns - The root node of the execution plan.
   */
  public buildPlan(
    query: ASTNode,
    options?: QueryOptions<LangNames>,
  ): PlanOperator {
    // const varMappers = this.langMgr.getVisitorMap('variableMapper');
    const Visitor = this.langMgr.getLang(
      options?.mainLang ?? this.config.mainLang.name,
    ).visitors.logicalPlanBuilder;
    const plan = new Visitor(this.friendInterface).buildPlan(
      query,
      new Trie(),
      {},
    );
    const optimized = this.optimizer.optimize(plan.plan);
    // console.log(varMappers[optimized.lang].mapVariables(optimized));
    return optimized;
  }

  /**
   * Parse a query, build a plan, and immediately execute it. If the query consists of multiple
   * independent statements (e.g., SQL `SELECT 1; SELECT 2;`), only the last statement is eecuted.
   */
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

  /**
   * Execute a query plan. Unlike {@link query}, the results are not materialized.
   * @param plan - The root node of the plan to execute.
   * @param boundParams - Values for any params in the query.
   */
  public executePlan<T = unknown>(
    plan: PlanOperator,
    boundParams?: Record<string, unknown>,
  ): {
    /** Lazy iterable of result rows; consume before the next call to avoid interference. */
    data: Iterable<T>;
    /** Column names in output order, when known. */
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

  /**
   * Register a data structure as a data source accessible from queries.
   * @param source - Qualified name of the source. The tokens start from the most general to the most specific.
   * @param data - The data structure to register. Can be anything, but the languages need to be configured with
   * suitable data adapters.
   * @example
   * ```ts
   * db.registerSource(['schema', 'table'], myTable);
   * ```
   */
  public registerSource(source: (symbol | string | number)[], data: unknown) {
    this.registeredSources.set(source, data);
  }

  /**
   * Create a secondary index for a specific registered data source.
   * @param source - Qualified name of the source. The tokens start from the most general to the most specific.
   * @param expressions - Expressions to index. Some indices may support multi-level indexing. Each expression
   * is applied to the data source after being parsed with the specified language.
   * @param indexCls - The index type to use.
   * @example
   * ```ts
   * db.createIndex(['schema', 'table'], ['col1 + 3'], MapIndex, { mainLang: 'sql' });
   * ```
   * @example
   * ```ts
   * db.createIndex(['itemStream'], ['val + 3'], MapIndex, { mainLang: 'xquery', fromItemKey: 'val' });
   * ```
   */
  public createIndex(
    source: (symbol | string | number)[],
    expressions: string[],
    indexCls: {
      new (expressions: Calculation[], db: DortDBAsFriend): Index;
    },
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
        {},
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
   * Renames expressions for item source indices to a common key.
   * @param expr - The expression to rename.
   * @param fromItemKey - The common key.
   */
  protected renameItemIndexExpr(
    expr: Calculation,
    fromItemKey: string[],
  ): void {
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

  /**
   * Fill a secondary index with data.
   * @param index - The index to fill.
   * @param source - Qualified name of the indexed data source. The tokens start from the most general to the most specific.
   * @param isItemSource - Is the data source to be interpreted as an item source?
   */
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

/** Fully materialized result of a {@link DortDB.query} call. */
export interface QueryResult<T = unknown> {
  /** All result rows, materialized into an array. */
  data: T[];
  /** Column names in output order, when provided by the language serializer. */
  schema?: string[];
}

/** Options accepted by {@link DortDB.query}, {@link DortDB.parse}, and related methods. */
export interface QueryOptions<LangNames extends string> {
  /** Language to use for parsing and planning; overrides {@link DortDBConfig.mainLang}. */
  mainLang?: Lowercase<LangNames>;
  /** Values for named parameters referenced in the query. */
  boundParams?: Record<string, unknown>;
}

/** Configuration supplied to the {@link DortDB} constructor. */
export interface DortDBConfig<LangNames extends string> {
  /** Primary language used when no per-query override is given. */
  mainLang: Language<LangNames>;
  /** Additional languages to register alongside the main one. */
  additionalLangs?: Language<LangNames>[];
  /** Extensions (operators, functions, aggregates, castables) to register globally. */
  extensions?: Extension<LangNames>[];
  /** Configuration for the query optimizer. */
  optimizer: OptimizerConfig;
  /** Executor configuration; currently reserved for future use. */
  executor?: ExecutorConfig;
}

/** Interface used by modules extending the framework. It exposes some of the internal DortDB
 * mechanisms.
 */
export interface DortDBAsFriend {
  /** The language manager that owns language registrations and visitor maps. */
  langMgr: LanguageManager;
  /** Returns the registered data source for the given qualified name parts, or `undefined`. */
  getSource(source: (symbol | string | number)[]): unknown;
  /** The query optimizer shared across all plan builds. */
  optimizer: Optimizer;
  /** All secondary indices, keyed by the source's qualified name parts. */
  indices: Trie<symbol | string | number, Index[]>;
  /** The configuration this database instance was created with. */
  config: DortDBConfig<string>;
}
