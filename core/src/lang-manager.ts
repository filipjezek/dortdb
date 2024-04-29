import { AggregatorFn, Extension, Fn, Operator } from './extension.js';
import { makePath } from './utils/make-path.js';

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
  private static readonly defaultSchema = Symbol('defaultSchema');
  private implementations: Record<
    string | (typeof LanguageManager)['allLangs'],
    Record<string | (typeof LanguageManager)['defaultSchema'], Implementations>
  > = {
    [LanguageManager.allLangs]: {
      [LanguageManager.defaultSchema]: {
        operators: {},
        functions: {},
        aggregators: {},
      },
    },
  };

  public registerExtension(ext: Extension) {
    const scope = ext.scope ?? ([LanguageManager.allLangs] as const);
    const schema = ext.schema ?? LanguageManager.defaultSchema;

    for (const lang of scope) {
      makePath(this.implementations, lang, schema);
      const ims = this.implementations[lang][schema];
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

  public getOp(lang: string, name: string, schema?: string): Operator {
    return this.getImplementation('operators', lang, name, schema);
  }
  public getFn(lang: string, name: string, schema?: string): Fn {
    return this.getImplementation('functions', lang, name, schema);
  }
  public getAggr(lang: string, name: string, schema?: string): AggregatorFn {
    return this.getImplementation('aggregators', lang, name, schema);
  }

  private getImplementation<T extends keyof Implementations>(
    type: T,
    lang: string,
    name: string,
    schema:
      | string
      | (typeof LanguageManager)['defaultSchema'] = LanguageManager.defaultSchema
  ): Implementations[T][string] {
    let impl = this.implementations[lang]?.[schema]?.[type][name];
    impl =
      impl ??
      this.implementations[LanguageManager.allLangs][schema]?.[type][name];
    return impl as Implementations[T][string];
  }
}
