interface ASTNode {
    accept(visitor: ASTVisitor): void;
}
declare class ASTLiteral<T> implements ASTNode {
    original: string;
    value: T;
    constructor(original: string, value: T);
    accept(visitor: ASTVisitor): void;
}
declare class ASTOperator implements ASTNode {
    lang: string;
    id: ASTIdentifier;
    operands: ASTNode[];
    constructor(lang: string, id: ASTIdentifier, operands: ASTNode[]);
    accept(visitor: ASTVisitor): void;
}
declare class ASTFunction implements ASTNode {
    lang: string;
    id: ASTIdentifier;
    args: ASTNode[];
    constructor(lang: string, id: ASTIdentifier, args: ASTNode[]);
    accept(visitor: ASTVisitor): void;
}
interface ASTIdentifier extends ASTNode {
    schema?: string;
    id: string;
}
interface ASTVisitor {
    acceptLiteral<T>(literal: ASTLiteral<T>): void;
    acceptOperator(op: ASTOperator): void;
    acceptFunction(fn: ASTFunction): void;
}

interface Operator {
    name: string;
    impl: (...args: any[]) => any;
}
interface Fn {
    name: string;
    impl: (...args: any[]) => any;
}
interface AggregateFn {
    name: string;
    init: () => any;
    step: (acc: any, val: any) => any;
    /**
     * Optional inverse step function for speeding up window functions
     */
    stepInverse?: (acc: any, val: any) => any;
    result: (acc: any) => any;
}
interface Extension<LangNames extends string = string> {
    schema?: string;
    operators: Operator[];
    functions: Fn[];
    aggregates: AggregateFn[];
    scope?: LangNames[];
}
declare const core: Extension;

interface Parser {
    parse: (input: string) => ParseResult;
}
interface ParseResult {
    value: any;
    remainingInput: string;
}
interface Language<Name extends string = string> {
    readonly name: Lowercase<Name>;
    operators: Operator[];
    functions: Fn[];
    aggregates: AggregateFn[];
    createParser: (mgr: LanguageManager) => Parser;
}
declare class LanguageManager {
    private langs;
    private static readonly allLangs;
    private static readonly defaultSchema;
    private implementations;
    registerExtension(ext: Extension): void;
    registerLang(lang: Language): void;
    getLang<Name extends string>(name: Name): Language<Name>;
    getOp(lang: string, name: string, schema?: string): Operator;
    getFn(lang: string, name: string, schema?: string): Fn;
    getAggr(lang: string, name: string, schema?: string): AggregateFn;
    private getImplementation;
}

declare class DortDB<LangNames extends string> {
    private config;
    private langMgr;
    constructor(config: DortDBConfig<LangNames>);
    parse(query: string): ParseResult;
}
interface DortDBConfig<LangNames extends string> {
    mainLang: Language<LangNames>;
    additionalLangs?: Language<LangNames>[];
    extensions?: Extension<LangNames>[];
}

export { ASTFunction, type ASTIdentifier, ASTLiteral, type ASTNode, ASTOperator, type ASTVisitor, type AggregateFn, DortDB, type DortDBConfig, type Extension, type Fn, type Language, LanguageManager, type Operator, type ParseResult, type Parser, core };
