import { Trie } from './data-structures/trie.js';
import { ASTNode } from './ast.js';
import { Extension, core } from './extension.js';
import { Language, LanguageManager } from './lang-manager.js';
import { Optimizer, OptimizerOptions } from './optimizer.js';

export class DortDB<LangNames extends string> {
  private langMgr = new LanguageManager();
  private registeredSources = new Trie<symbol | string, unknown>();
  private friendInterface: DortDBAsFriend = {
    langMgr: this.langMgr,
    getSource: (source) => this.registeredSources.get(source),
  };

  public readonly optimizer = new Optimizer();

  constructor(private config: DortDBConfig<LangNames>) {
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
    return new Visitor(this.friendInterface).buildPlan(
      query,
      new Trie<symbol | string>(),
    );
  }

  public query<T = unknown>(
    query: string,
    options?: QueryOptions<LangNames>,
  ): QueryResult<T> {
    return {
      data: [
        { foo: 1, bar: 'a' },
        {
          foo: {
            baz: 2,
            qux: 3,
          },
          bar: 'b',
        },
      ] as any,
      schema: ['foo', 'bar'],
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
  optimizer?: OptimizerOptions;
}

export interface DortDBAsFriend {
  langMgr: LanguageManager;
  getSource(source: (symbol | string)[]): unknown;
}
