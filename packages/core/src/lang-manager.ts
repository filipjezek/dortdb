import { ASTNode } from './ast.js';
import { AggregateFn, Castable, Extension, Fn, Operator } from './extension.js';
import { LogicalPlanOperator } from './plan/visitor.js';
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
  aggregates: AggregateFn[];
  createParser: (mgr: LanguageManager) => Parser;
  buildLogicalPlan: (
    mgr: LanguageManager,
    params: Record<string, any>,
    ast: ASTNode
  ) => LogicalPlanOperator;
}

interface Implementations {
  operators: Record<string, Operator>;
  functions: Record<string, Fn>;
  aggregates: Record<string, AggregateFn>;
  castables: Record<string, Castable>;
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
        aggregates: {},
        castables: {},
      },
    },
  };

  public registerExtension(ext: Extension) {
    const scope = ext.scope ?? ([LanguageManager.allLangs] as const);
    const schema = ext.schema ?? LanguageManager.defaultSchema;

    for (const lang of scope) {
      makePath(this.implementations, lang, schema);
      const ims = this.implementations[lang][schema];

      for (const type of [
        'operators',
        'functions',
        'aggregates',
        'castables',
      ] as const) {
        ims[type] = (ims[type] as any) ?? {};
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
  public getAggr(lang: string, name: string, schema?: string): AggregateFn {
    return this.getImplementation('aggregates', lang, name, schema);
  }
  public getCast(lang: string, name: string, schema?: string): Castable {
    return this.getImplementation('castables', lang, name, schema);
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
