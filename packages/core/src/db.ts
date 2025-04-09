import { Trie } from './data-structures/trie.js';
import { ASTNode } from './ast.js';
import { Extension, core } from './extension.js';
import { Language, LanguageManager } from './lang-manager.js';
import { Optimizer, OptimizerConfig } from './optimizer/optimizer.js';

export class DortDB<LangNames extends string> {
  private langMgr: LanguageManager = null;
  private registeredSources = new Trie<symbol | string, unknown>();
  public readonly optimizer: Optimizer;
  private friendInterface: DortDBAsFriend;

  constructor(private config: DortDBConfig<LangNames>) {
    this.optimizer = new Optimizer(config.optimizer);
    this.friendInterface = {
      langMgr: this.langMgr,
      optimizer: this.optimizer,
      getSource: (source) => this.registeredSources.get(source),
    };
    this.langMgr = this.friendInterface.langMgr = new LanguageManager(
      this.friendInterface,
    );
    this.langMgr.registerExtension(core);
    this.langMgr.registerLang(config.mainLang);
    this.config.additionalLangs?.forEach((lang) =>
      this.langMgr.registerLang(lang),
    );
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
    return {
      data: [] as any,
      schema: [],
    };
  }

  public registerSource(source: (symbol | string)[], data: unknown) {
    this.registeredSources.set(source, data);
  }
}

export interface QueryResult<T = unknown> {
  data: T[];
  schema?: string[];
}

export interface QueryOptions<LangNames extends string> {
  mainLang?: LangNames;
}

export interface DortDBConfig<LangNames extends string> {
  mainLang: Language<LangNames>;
  additionalLangs?: Language<LangNames>[];
  extensions?: Extension<LangNames>[];
  optimizer: OptimizerConfig;
}

export interface DortDBAsFriend {
  langMgr: LanguageManager;
  getSource(source: (symbol | string)[]): unknown;
  optimizer: Optimizer;
}
