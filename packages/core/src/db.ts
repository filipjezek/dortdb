import { Trie } from './data-structures/trie.js';
import { ASTNode } from './ast.js';
import { Extension, core } from './extension.js';
import { Language, LanguageManager } from './lang-manager.js';

export class DortDB<LangNames extends string> {
  private langMgr = new LanguageManager();
  private registeredSources = new Trie<symbol | string, unknown>();
  private friendInterface: DortDBAsFriend = {
    langMgr: this.langMgr,
    getSource: (source) => this.registeredSources.get(source),
  };

  constructor(private config: DortDBConfig<LangNames>) {
    this.langMgr.registerExtension(core);
    this.langMgr.registerLang(config.mainLang);
    this.config.additionalLangs?.forEach((lang) =>
      this.langMgr.registerLang(lang),
    );
    this.config.extensions?.forEach((e) => this.langMgr.registerExtension(e));
  }

  public parse(query: string) {
    return this.langMgr
      .getLang(this.config.mainLang.name)
      .createParser(this.langMgr)
      .parse(query);
  }

  public buildPlan(query: ASTNode) {
    const Visitor = this.langMgr.getLang(this.config.mainLang.name).visitors
      .logicalPlanBuilder;
    return new Visitor(this.friendInterface).buildPlan(
      query,
      new Trie<symbol | string>(),
    );
  }

  public query<T = unknown>(query: string): T[] {
    return [];
  }

  public registerSource(source: (symbol | string)[], data: unknown) {
    this.registeredSources.set(source, data);
  }
}

export interface DortDBConfig<LangNames extends string> {
  mainLang: Language<LangNames>;
  additionalLangs?: Language<LangNames>[];
  extensions?: Extension<LangNames>[];
}

export interface DortDBAsFriend {
  langMgr: LanguageManager;
  getSource(source: (symbol | string)[]): unknown;
}
