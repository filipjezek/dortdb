import { ASTVisitor } from './ast.js';
import { AggregateFn, Castable, Extension, Fn, Operator } from './extension.js';
import { LogicalPlanOperator } from './plan/visitor.js';
import { makePath } from './utils/make-path.js';
import { coreVisitors, LogicalPlanVisitors } from './visitors/index.js';

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
  visitors: Partial<LogicalPlanVisitors> & {
    logicalPlanBuilder: {
      new (langMgr: LanguageManager): ASTVisitor<LogicalPlanOperator>;
    };
  };
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
        if (ext[type]) {
          for (const item of ext[type]) {
            ims[type][item.name] = item;
          }
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

  public getVisitorMap<T extends keyof LogicalPlanVisitors>(
    visitor: T
  ): Record<string, InstanceType<LogicalPlanVisitors[T]>> {
    const vmap = {} as Record<string, InstanceType<LogicalPlanVisitors[T]>>;
    for (const lang in this.langs) {
      const VClass =
        this.langs[lang].visitors[visitor] ?? coreVisitors.logicalPlan[visitor];
      vmap[lang] = new VClass(vmap, this) as InstanceType<
        LogicalPlanVisitors[T]
      >;
    }
    return vmap;
  }

  public getOp(
    lang: string,
    name: string,
    schema?: string,
    throwOnMissing = true
  ): Operator {
    return this.getImplementation(
      'operators',
      lang,
      name,
      schema,
      throwOnMissing
    );
  }
  public getFn(
    lang: string,
    name: string,
    schema?: string,
    throwOnMissing = true
  ): Fn {
    return this.getImplementation(
      'functions',
      lang,
      name,
      schema,
      throwOnMissing
    );
  }
  public getAggr(
    lang: string,
    name: string,
    schema?: string,
    throwOnMissing = true
  ): AggregateFn {
    return this.getImplementation(
      'aggregates',
      lang,
      name,
      schema,
      throwOnMissing
    );
  }
  public getCast(
    lang: string,
    name: string,
    schema?: string,
    throwOnMissing = true
  ): Castable {
    return this.getImplementation(
      'castables',
      lang,
      name,
      schema,
      throwOnMissing
    );
  }

  private getImplementation<T extends keyof Implementations>(
    type: T,
    lang: string,
    name: string,
    schema:
      | string
      | (typeof LanguageManager)['defaultSchema'] = LanguageManager.defaultSchema,
    throwOnMissing = true
  ): Implementations[T][string] {
    let impl = this.implementations[lang]?.[schema]?.[type][name];
    impl =
      impl ??
      this.implementations[LanguageManager.allLangs][schema]?.[type][name];
    if (!impl && throwOnMissing)
      throw new Error(
        `${type.slice(0, -1)} not found: [${lang}] ${
          schema === LanguageManager.defaultSchema ? '<default>' : schema
        }.${name}`
      );
    return impl as Implementations[T][string];
  }
}
