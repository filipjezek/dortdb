import { AggregatorFn, Extension, Fn, Operator } from './extension.js';

export interface Parser {
  parse: (input: string) => ParseResult;
}
export interface ParseResult {
  value: any;
  remainingInput: string;
}
export interface Language<Name extends string = string> {
  readonly name: Lowercase<Name>;
  operators: Operator[];
  functions: Fn[];
  aggregators: AggregatorFn[];
  createParser: (mgr: LanguageManager) => Parser;
}

interface Implementations {
  operators: Record<string, Operator>;
  functions: Record<string, Fn>;
  aggregators: Record<string, AggregatorFn>;
}

export class LanguageManager {
  private langs: Record<string, Language> = {};
  private static readonly allLangs = Symbol('allLangs');
  private implementations: Record<
    string | (typeof LanguageManager)['allLangs'],
    Implementations
  > = {
    [LanguageManager.allLangs]: {
      operators: {},
      functions: {},
      aggregators: {},
    },
  };

  public registerExtension(ext: Extension) {
    const scope = ext.scope ?? ([LanguageManager.allLangs] as const);
    for (const lang of scope) {
      const ims = this.implementations[lang];
      for (const type of ['operators', 'functions', 'aggregators'] as const) {
        for (const item of ext[type]) {
          ims[type][item.name] = item;
        }
      }
    }
  }

  public registerLang(lang: Language) {
    this.langs[lang.name.toLowerCase()] = lang;
    this.registerExtension({ ...lang, scope: [lang.name] });
  }

  public getLang<Name extends string>(name: Name): Language<Name> {
    return this.langs[name.toLowerCase()] as Language<Name>;
  }

  public getOp(lang: string, name: string): Operator {
    return this.getImplementation('operators', lang, name);
  }

  private getImplementation<T extends keyof Implementations>(
    type: T,
    lang: string,
    name: string
  ): Implementations[T][string] {
    const scoped = this.implementations[lang][type][name];
    return (scoped ??
      this.implementations[LanguageManager.allLangs][type][
        name
      ]) as Implementations[T][string];
  }
}
