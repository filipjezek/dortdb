import { AggregateFn, Castable, Extension, Fn, Operator } from './extension.js';
import {
  coreVisitors,
  LogicalPlanBuilder,
  PlanVisitors,
} from './visitors/index.js';
import { ASTNode } from './ast.js';
import { DortDBAsFriend } from './db.js';
import { Trie } from './data-structures/trie.js';
import { ExecutionContext } from './execution-context.js';
import { PlanOperator } from './plan/visitor.js';

export interface Parser {
  parse: (input: string) => ParseResult;
  /** should return AST which parses into a projection with one attribute or the one attribute
   * depending on whether the language returns tuples or items. Used when registering secondary
   * indices.
   */
  parseExpr: (input: string) => ParseResult;
}
export interface ParseResult {
  /** One AST root node for each statement of the input query (for languages that support multiple statements). */
  value: ASTNode[];
  /** When the parser detects a language exit, the unprocessed input is returned here. */
  remainingInput: string;
}

/** This will be used by the query executor, so it should be efficient. Serialize the executor output
 * into a format which will be returned to the user.
 */
export type SerializeFn = (
  /** Iterable of either sparse arrays of mapped variables, or opaque objects. */
  items: Iterable<unknown> | Iterable<unknown[]>,
  /** The execution context after the execution. */
  ctx: ExecutionContext,
  plan: PlanOperator,
) => {
  data: Iterable<unknown>;
  schema?: string[];
};

export interface Language<Name extends string = string> {
  readonly name: Lowercase<Name>;
  operators: Operator[];
  functions: Fn[];
  aggregates: AggregateFn[];
  castables: Castable[];
  createParser: (mgr: LanguageManager) => Parser;
  /** Visitors for extending the default DortDB behavior. Usually required when adding new {@link PlanOperator}s.
   * Some of the visitors are always required, for example, the logical plan builder.
   */
  visitors: Partial<PlanVisitors> &
    Pick<PlanVisitors, 'executor'> & {
      logicalPlanBuilder: {
        new (db: DortDBAsFriend): LogicalPlanBuilder;
      };
    };
  serialize: SerializeFn;
}

/**
 * Manages the registration and retrieval of language-specific features.
 */
export class LanguageManager {
  private langs: Record<string, Language> = {};
  private static readonly allLangs = Symbol('allLangs');

  private operators = new Trie<string | symbol | number, Operator>();
  private functions = new Trie<string | symbol | number, Fn>();
  private aggregates = new Trie<string | symbol | number, AggregateFn>();
  private castables = new Trie<string | symbol | number, Castable>();

  constructor(private db: DortDBAsFriend) {}

  /**
   * Registers a new language extension.
   * @param ext - The extension to register.
   */
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

  /**
   * Registers a new language.
   * @param lang  - The language to register.
   */
  public registerLang(lang: Language) {
    this.langs[lang.name.toLowerCase()] = lang;
    this.registerExtension({ ...lang, scope: [lang.name] });
  }

  /**
   * Retrieves a registered language by name.
   * @param name - The name of the language to retrieve.
   */
  public getLang<Name extends string, Lang extends Language<Name>>(
    name: Name,
  ): Lang {
    return this.langs[name.toLowerCase()] as Lang;
  }

  /**
   * Creates a map of visitor instances for a specific visitor type.
   * @param visitor - The visitor type to retrieve.
   * @returns A map of language names to visitor instances.
   */
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

  /**
   * Retrieves an operator by name and schema for a specific language. If no such operator
   * is registered specifically for the language, also checks for global operators.
   * @param lang - The language to search in.
   * @param name - The name of the operator to retrieve.
   * @param schema - The schema of the operator to retrieve.
   * @returns The requested operator, or throws an error if not found.
   */
  public getOp(lang: string, name: string, schema?: string | symbol): Operator {
    return this.getImplementation('operators', lang, name, schema);
  }
  /**
   * Retrieves a function by name and schema for a specific language. If no such function
   * is registered specifically for the language, also checks for global functions.
   * @param lang - The language to search in.
   * @param name - The name of the function to retrieve.
   * @param schema - The schema of the function to retrieve.
   * @returns The requested function, or throws an error if not found.
   */
  public getFn(lang: string, name: string, schema?: string | symbol): Fn {
    return this.getImplementation('functions', lang, name, schema);
  }
  /**
   * Retrieves an aggregate function by name and schema for a specific language. If no such aggregate function
   * is registered specifically for the language, also checks for global aggregate functions.
   * @param lang - The language to search in.
   * @param name - The name of the aggregate function to retrieve.
   * @param schema - The schema of the aggregate function to retrieve.
   * @returns The requested aggregate function, or throws an error if not found.
   */
  public getAggr(
    lang: string,
    name: string,
    schema?: string | symbol,
  ): AggregateFn {
    return this.getImplementation('aggregates', lang, name, schema);
  }
  /**
   * Retrieves a castable by name and schema for a specific language. If no such castable
   * is registered specifically for the language, also checks for global castables.
   * @param lang - The language to search in.
   * @param name - The name of the castable to retrieve.
   * @param schema - The schema of the castable to retrieve.
   * @returns The requested castable, or throws an error if not found.
   */
  public getCast(
    lang: string,
    name: string,
    schema?: string | symbol,
  ): Castable {
    return this.getImplementation('castables', lang, name, schema);
  }
  /**
   * Retrieves a function or aggregate function by name and schema for a specific language. First checks
   * for functions, then for global functions, then for aggregate functions, then for global aggregate functions.
   * @param lang - The language to search in.
   * @param name - The name of the function or aggregate function to retrieve.
   * @param schema - The schema of the function or aggregate function to retrieve.
   * @returns The requested function or aggregate function, or throws an error if not found.
   */
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
