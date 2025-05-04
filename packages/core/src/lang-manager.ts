import { AggregateFn, Castable, Extension, Fn, Operator } from './extension.js';
import {
  coreVisitors,
  LogicalPlanBuilder,
  PlanVisitors,
} from './visitors/index.js';
import { ASTNode } from './ast.js';
import { DortDBAsFriend } from './db.js';
import { Trie } from './data-structures/trie.js';

export interface Parser {
  parse: (input: string) => ParseResult;
  /** should return AST which parses into a projection with one attribute or the one attribute
   * depending on whether the language returns tuples or items.
   */
  parseExpr: (input: string) => ParseResult;
}
export interface ParseResult {
  value: ASTNode[];
  remainingInput: string;
}
export interface Language<Name extends string = string> {
  readonly name: Lowercase<Name>;
  operators: Operator[];
  functions: Fn[];
  aggregates: AggregateFn[];
  castables: Castable[];
  createParser: (mgr: LanguageManager) => Parser;
  visitors: Partial<PlanVisitors> & {
    logicalPlanBuilder: {
      new (db: DortDBAsFriend): LogicalPlanBuilder;
    };
  };
}

export class LanguageManager {
  private langs: Record<string, Language> = {};
  private static readonly allLangs = Symbol('allLangs');

  private operators = new Trie<string | symbol, Operator>();
  private functions = new Trie<string | symbol, Fn>();
  private aggregates = new Trie<string | symbol, AggregateFn>();
  private castables = new Trie<string | symbol, Castable>();

  constructor(private db: DortDBAsFriend) {}

  public registerExtension(ext: Extension) {
    const scope = ext.scope ?? ([LanguageManager.allLangs] as const);
    const types = [
      'operators',
      'functions',
      'aggregates',
      'castables',
    ] as const;

    for (const lang of scope) {
      for (const type of types) {
        for (const op of ext[type] ?? []) {
          this[type].set(
            [
              lang,
              (op as AggregateFn | Fn | Castable).schema ?? ext.schema,
              op.name,
            ],
            op as any,
          );
        }
      }
    }
  }

  public registerLang(lang: Language) {
    this.langs[lang.name.toLowerCase()] = lang;
    this.registerExtension({ ...lang, scope: [lang.name] });
  }

  public getLang<Name extends string, Lang extends Language<Name>>(
    name: Name,
  ): Lang {
    return this.langs[name.toLowerCase()] as Lang;
  }

  public getVisitorMap<T extends keyof PlanVisitors>(
    visitor: T,
  ): Record<string, InstanceType<PlanVisitors[T]>> {
    const vmap = {} as Record<string, InstanceType<PlanVisitors[T]>>;
    for (const lang in this.langs) {
      const VClass =
        (this.langs[lang].visitors[visitor] as PlanVisitors[T]) ??
        coreVisitors.logicalPlan[visitor];
      vmap[lang] = new VClass(vmap as any, this.db) as InstanceType<
        PlanVisitors[T]
      >;
    }
    return vmap;
  }

  public getOp(lang: string, name: string, schema?: string | symbol): Operator {
    return this.getImplementation('operators', lang, name, schema);
  }
  public getFn(lang: string, name: string, schema?: string | symbol): Fn {
    return this.getImplementation('functions', lang, name, schema);
  }
  public getAggr(
    lang: string,
    name: string,
    schema?: string | symbol,
  ): AggregateFn {
    return this.getImplementation('aggregates', lang, name, schema);
  }
  public getCast(
    lang: string,
    name: string,
    schema?: string | symbol,
  ): Castable {
    return this.getImplementation('castables', lang, name, schema);
  }
  public getFnOrAggr(
    lang: string,
    name: string,
    schema?: string | symbol,
  ): Fn | AggregateFn {
    const res =
      this.getImplementation('functions', lang, name, schema, false) ??
      this.getImplementation('aggregates', lang, name, schema, false);
    if (!res)
      throw new Error(
        `Function or aggregate not found: [${lang}] ${
          schema ? schema.toString() : '<default>'
        }.${name}`,
      );
    return res;
  }

  private getImplementation<
    T extends 'operators' | 'functions' | 'aggregates' | 'castables',
  >(
    type: T,
    lang: string,
    name: string,
    schema: string | symbol,
    throwOnMissing = true,
  ): Extension[T][number] {
    let impl =
      this[type].get([lang, schema, name]) ??
      this[type].get([lang, schema, name.toLowerCase()]);
    impl ??=
      this[type].get([LanguageManager.allLangs, schema, name]) ??
      this[type].get([LanguageManager.allLangs, schema, name.toLowerCase()]);
    if (!impl && throwOnMissing)
      throw new Error(
        `${type.slice(0, -1)} not found: [${lang}] ${
          schema ? schema.toString() : '<default>'
        }.${name}`,
      );
    return impl as Extension[T][number];
  }
}
