import { Extension } from './extension.js';
import { Language, LanguageManager } from './lang-manager.js';

export class DortDB<LangNames extends string> {
  private langMgr: LanguageManager;

  constructor(private config: DortDBConfig<LangNames>) {
    this.langMgr = new LanguageManager();
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
}

export interface DortDBConfig<LangNames extends string> {
  mainLang: Language<LangNames>;
  additionalLangs?: Language<LangNames>[];
  extensions?: Extension<LangNames>[];
}
