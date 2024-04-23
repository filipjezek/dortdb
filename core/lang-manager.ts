export interface Language {
  name: string;
  createParser: (mgr: LanguageManager) => Parser;
}
export interface Parser {
  parse: (input: string) => ParseResult;
}
export interface ParseResult {
  value: any;
  remainingInput: string;
}

export class LanguageManager {
  private langs: Record<string, Language> = {};

  public registerLang(lang: Language) {
    this.langs[lang.name.toLowerCase()] = lang;
  }

  public getLang(name: string): Language {
    return this.langs[name.toLowerCase()];
  }

  public static langExit = Symbol('langExit');
}
