import { Trie } from './data-structures/trie.js';
import { ASTIdentifier, ASTNode } from './ast.js';
import { Extension, core } from './extension.js';
import { Language, LanguageManager } from './lang-manager.js';
import { Optimizer, OptimizerConfig } from './optimizer/optimizer.js';
import { Index } from './indices/index.js';
import { Calculation, Projection } from './plan/operators/index.js';
import { idToCalculation } from './utils/calculation.js';
import { PlanTupleOperator } from './plan/visitor.js';

export class DortDB<LangNames extends string> {
  private langMgr: LanguageManager = null;
  private registeredSources = new Trie<symbol | string | number, unknown>();
  public readonly optimizer: Optimizer;
  public indices = new Trie<symbol | string | number, Index[]>();
  private friendInterface: DortDBAsFriend = {
    langMgr: null,
    optimizer: null,
    getSource: (source) => this.registeredSources.get(source),
    indices: this.indices,
  };

  constructor(private config: DortDBConfig<LangNames>) {
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

  public parse(query: string, options?: QueryOptions<LangNames>) {
    return this.langMgr
      .getLang(options?.mainLang ?? this.config.mainLang.name)
      .createParser(this.langMgr)
      .parse(query);
  }

  public buildPlan(query: ASTNode, options?: QueryOptions<LangNames>) {
    const Visitor = this.langMgr.getLang(
      options?.mainLang ?? this.config.mainLang.name,
    ).visitors.logicalPlanBuilder;
    const plan = new Visitor(this.friendInterface).buildPlan(
      query,
      new Trie<symbol | string>(),
    );
    return this.optimizer.optimize(plan.plan);
  }

  public query<T = unknown>(
    query: string,
    options?: QueryOptions<LangNames>,
  ): QueryResult<T> {
    const parsed = this.parse(query, options);
    const plan = this.buildPlan(parsed.value[0], options);
    const varMappers = this.langMgr.getVisitorMap('variableMapper');
    const executors = this.langMgr.getVisitorMap('executor');
    const serialize = this.langMgr.getLang(
      options?.mainLang ?? this.config.mainLang.name,
    ).serialize;

    const varMapCtx = varMappers[plan.lang].mapVariables(plan);
    const { result, ctx } = executors[plan.lang].execute(plan, varMapCtx);
    return serialize(
      result,
      ctx,
      plan instanceof PlanTupleOperator ? plan.schema : undefined,
    ) as QueryResult<T>;
  }

  public registerSource(source: (symbol | string | number)[], data: unknown) {
    this.registeredSources.set(source, data);
  }

  public createIndex(
    source: (symbol | string | number)[],
    expressions: [string],
    indexCls: { new (expressions: Calculation[], db: DortDBAsFriend): Index },
    options?: QueryOptions<LangNames>,
  ) {
    const lang = options?.mainLang ?? this.config.mainLang.name;
    const parser = this.langMgr.getLang(lang).createParser(this.langMgr);
    const calcs = expressions.map((expr) => {
      const parsed = parser.parseExpr(expr);
      if (parsed.remainingInput) {
        throw new Error(`Unparsed input: ${parsed.remainingInput}`);
      }
      const maybeProj = this.buildPlan(parsed.value[0], options);
      const res =
        maybeProj instanceof Projection
          ? maybeProj.attrs[0][0]
          : (maybeProj as Calculation | ASTIdentifier);

      if (res instanceof Calculation) {
        if (res.getChildren().length) {
          throw new Error('Expression cannot contain subqueries');
        }
        return res;
      }
      return idToCalculation(res, lang);
    });
    const index = new indexCls(calcs, this.friendInterface);
    const currIndices = this.indices.get(source);
    if (currIndices) {
      currIndices.push(index);
    } else {
      this.indices.set(source, [index]);
    }
  }
}

export interface QueryResult<T = unknown> {
  data: T[];
  schema?: string[];
}

export interface QueryOptions<LangNames extends string> {
  mainLang?: Lowercase<LangNames>;
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
