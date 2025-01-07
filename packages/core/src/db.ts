import { ASTNode } from './ast.js';
import { Extension, core } from './extension.js';
import { Language, LanguageManager } from './lang-manager.js';

export class DortDB<LangNames extends string> {
  private langMgr: LanguageManager;

  constructor(private config: DortDBConfig<LangNames>) {
    this.langMgr = new LanguageManager();
    this.langMgr.registerExtension(core);
    this.langMgr.registerLang(config.mainLang);
    this.config.additionalLangs?.forEach((lang) =>
      this.langMgr.registerLang(lang)
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
    return query.accept(new Visitor(this.langMgr));
  }
}

export interface DortDBConfig<LangNames extends string> {
  mainLang: Language<LangNames>;
  additionalLangs?: Language<LangNames>[];
  extensions?: Extension<LangNames>[];
}
