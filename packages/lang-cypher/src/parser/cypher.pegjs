// modified openCypher grammar file

// (*
//  * Copyright (c) 2015-2023 "Neo Technology"
//  * Network Engine for Objects in Lund AB [http://neotechnology.com]
//  * 
//  * Licensed under the Apache License Version 2.0 (the "License");
//  * you may not use this file except in compliance with the License.
//  * You may obtain a copy of the License at
//  * 
//  *     http://www.apache.org/licenses/LICENSE-2.0
//  * 
//  * Unless required by applicable law or agreed to in writing software
//  * distributed under the License is distributed on an "AS IS" BASIS,
//  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
//  * See the License for the specific language governing permissions and
//  * limitations under the License.
//  * 
//  * Attribution Notice under the terms of the Apache License 2.0
//  * 
//  * This work was created by the collective efforts of the openCypher community.
//  * Without limiting the terms of Section 6 any Derivative Work that is not
//  * approved by the public consensus process of the openCypher Implementers Group
//  * should not be described as “Cypher” (and Cypher® is a registered trademark of
//  * Neo4j Inc.) or as "openCypher". Extensions by implementers or prototypes or
//  * proposals for change that have been documented or implemented should only be
//  * described as "implementation extensions to Cypher" or as "proposed changes to
//  * Cypher that are not yet approved by the openCypher community".
//  *)

{
  const ast = options.ast;

  function makeOpSeq(
    initial,
    type,
    others,
  ) {
    let result = initial;
    const typeId =
      typeof type === 'string'
        ? new ast.CypherIdentifier(type.toLowerCase())
        : type;
    for (const node of others) {
      result = new ast.ASTOperator('cypher', typeId, [result, node]);
    }
    return result;
  }
}

Cypher = _? @Statement (_? ';')? _? !. ;

Statement = Query ;

Query = RegularQuery
  / StandaloneCall
  ;

RegularQuery = from:FromClause? q:SingleQuery setops:(_? @Union)* { 
  q.from = from;
  let curr = q;
  for (const [type, next] of setops) {
    curr.setOp = new ast.SetOp(type, next);
    curr = next;
  }
  return q;
} ;

FromClause = 'FROM'i _ @SymbolicName ;

Union = SetOp SingleQuery ;

SetOp = 'UNION'i _ 'ALL'i _? { return 'unionall'; }
  / 'UNION'i _? { return 'union'; }
  ;

SingleQuery = SinglePartQuery
            / MultiPartQuery
            ;

SinglePartQuery = read:ReadingClause|.., _?| ret:Return { read.push(ret); return new ast.Query(read); }
  / read:ReadingClause|.., _?| upd:UpdatingClause|1.., _?| ret:(_? @Return)? {
  return new ast.Query([...read, ...upd, ret]);
} ;

MultiPartQuery = wbs:WithQueryBlock+ spq:SinglePartQuery {
  spq.statements = [wbs, spq.statements].flat(Infinity);
  return spq;
} ;

WithQueryBlock = read:ReadingClause|.., _?| upd:UpdatingClause|.., _?| w:With _? {
  return [read, upd, w];
} ;

UpdatingClause = Create
  / Merge
  / Delete
  / Set
  / Remove
  ;

ReadingClause = Match
  / Unwind
  / InQueryCall
  ;

Match = opt:(@'OPTIONAL'i _)? 'MATCH'i _? pat:Pattern where:(_? @Where)? {
  const res = new ast.MatchClause(pat, where);
  res.optional = !!opt;
  return res;
} ;

Unwind = 'UNWIND'i _ e:Expression _ 'AS'i _ v:Variable {
  return new ast.UnwindClause(e, v);
} ;

Merge = 'MERGE'i _? p:PatternPart actions:( _ @MergeAction )* {
  return new ast.MergeClause(p, actions)
} ;

MergeAction =
    'ON'i _ 'MATCH'i _ s:Set { return new yy.ast.MergeAction('match', s.items); }
  / 'ON'i _ 'CREATE'i _ s:Set { return new yy.ast.MergeAction('create', s.items); } ;

Create = 'CREATE'i _? p:Pattern {
  return new ast.CreateClause(p);
} ;

Set = 'SET'i _? items:SetItem|1.., _? ',' _?| {
  return new ast.SetClause(items);
} ;

SetItem = a:PropertyExpression _? '=' _? b:Expression { return new ast.SetItem(a, b); }
  / a:Variable _? '=' _? b:Expression { return new ast.SetItem(a, b); }
  / a:Variable _? '+=' _? b:Expression { const res = new ast.SetItem(a, b); res.add = true; return res; }
  / a:Variable _? b:NodeLabels { return new ast.SetItem(a, b); }
  ;

Delete = detach:(@'DETACH'i _)? 'DELETE'i _? exprs:Expression|1.., _? ',' _?| {
  return new ast.DeleteClause(exprs, !!detach);
} ;

Remove = 'REMOVE'i _ items:RemoveItem|1.., _? ',' _?| {
  return new ast.RemoveClause(items);
} ;

RemoveItem = v:Variable labels:NodeLabels { return new ast.RemoveItem(v, labels); }
  / expr:PropertyExpression { return new ast.RemoveItem(expr); }
  ;

InQueryCall = 'CALL'i _ proc:ExplicitProcedureInvocation y:(_? 'YIELD'i _ @YieldItems)? {
  const res = proc;
  proc.where = y[0];
  proc.yieldItems = y[1];
  return res;
} ;

StandaloneCall = 'CALL'i _ proc:ProcedureInvocation y:(_? 'YIELD'i _ YieldOrStar)? {
  const res = proc;
  proc.where = y[0];
  proc.yieldItems = y[1];
  return res;
} ;

ProcedureInvocation = ExplicitProcedureInvocation
  / ImplicitProcedureInvocation
  ;

YieldOrStar = '*' / YieldItems ;

YieldItems = YieldItem|1.., _? ',' _?| (_? @Where)? ;

YieldItem = (@ProcedureResultField _ 'AS'i _)? Variable ;

With = 'WITH'i proj:ProjectionBody where:(_? @Where)? {
  return new ast.WithClause(proj, where);
} ;

Return = 'RETURN'i proj:ProjectionBody { return new ast.ReturnClause(proj); } ;

ProjectionBody = dist:(_? @'DISTINCT'i)? _ items:ProjectionItems o:(_ @Order)? s:(_ @Skip)? lim:(_ @Limit)? {
  return new ast.ProjectionBody(items, o, s, lim, !!dist);
} ;

ProjectionItems = '*' items:(_? ',' _? @ProjectionItem)* { return ['*', ...items]; }
  / ProjectionItem|1.., _? ',' _?|
  ;

ProjectionItem = @Expression _ 'AS'i _ @Variable
  / Expression
  ;

Order = 'ORDER'i _ 'BY'i _ @SortItem|1.., _? ',' _?| ;

Skip = 'SKIP'i _ @Expression ;

Limit = 'LIMIT'i _ @Expression ;

SortItem = expr:Expression dir:(_? @('ASCENDING'i / 'ASC'i / 'DESCENDING'i / 'DESC'i))? {
  const asc = dir && (dir[0] === 'a' || dir[0] === 'A');
  return new ast.OrderItem(expr, asc);
};

Where = 'WHERE'i _ @Expression ;

Pattern = PatternPart|1.., _? ',' _?| ;

PatternPart = v:Variable _? '=' _? part:AnonymousPatternPart { part.variable = v; return part; }
  / AnonymousPatternPart
  ;

AnonymousPatternPart = PatternElement ;

PatternElement = np:NodePattern chain:(_? @PatternElementChain)* { return new ast.PatternElChain([np, chain].flat(Infinity)); }
  / '(' @PatternElement ')'
  ;

RelationshipsPattern = @NodePattern @(_? @PatternElementChain)+ ;

NodePattern = '(' _? v:(@Variable _?)? labels:(@NodeLabels _?)? props:(@Properties _?)? ')' {
  return new ast.NodePattern(v, labels ?? [], props);
} ;

PatternElementChain = @RelationshipPattern _? @NodePattern ;

RelationshipPattern = LeftArrowHead _? Dash _? rel:RelationshipDetail? _? Dash { rel ??= new ast.RelPattern(); rel.pointsLeft = true; return rel; }
  / Dash _? rel:RelationshipDetail? _? Dash _? RightArrowHead { rel ??= new ast.RelPattern(); rel.pointsRight = true; return rel; }
  / Dash _? rel:RelationshipDetail? _? Dash { return rel ?? new ast.RelPattern(); }
  ;

RelationshipDetail = '[' _? v:(@Variable _?)? types:(@RelationshipTypes _?)? range:RangeLiteral? props:(@Properties _?)? ']' {
  return new ast.RelPattern(false, false, v, types ?? [], range, props);
} ;

Properties = MapLiteral
  / Parameter
  ;

RelationshipTypes = (':' _? @RelTypeName)|1.., _? '|' _?| ;

NodeLabels = NodeLabel|1.., _?| ;

NodeLabel = ':' _? @LabelName ;

RangeLiteral = '*' _? frst:(@$IntegerLiteral _?)? secW:(@'..' _? @(@$IntegerLiteral _?)?)? {
  frst = frst === null ? undefined : new ast.ASTNumberLiteral(frst);
  const sec = secW ? (secW[1] === null ? undefined : new ast.ASTNumberLiteral(secW[1])) : frst;
  return [frst, sec];
} ;

LabelName = SchemaName ;

RelTypeName = SchemaName ;

PropertyExpression = a:Atom path:(_? @PropertyLookup)+ {
  for (const p of path) {
    a = new ast.PropLookup(a, p);
  }
  return a;
} ;

Expression = OrExpression ;

OrExpression = a:XorExpression bs:(_ 'OR'i _ @XorExpression)* { return makeOpSeq(a, 'or', bs); } ;

XorExpression = a:AndExpression bs:(_ 'XOR'i _ @AndExpression)* { return makeOpSeq(a, 'xor', bs); } ;

AndExpression = a:NotExpression bs:(_ 'AND'i _ @NotExpression)* { return makeOpSeq(a, 'and', bs); } ;

NotExpression = nots:(@'NOT'i _?)* expr:ComparisonExpression {
  for (let i = 0; i < nots.length; i++) {
    expr = options.makeOp('not', [expr]);
  }
  return expr;
} ;

ComparisonExpression = a:StringListNullPredicateExpression bs:(_? @PartialComparisonExpression)* {
  if (!bs.length) return a;
  const [head, ...rest] = bs;
  a = options.makeOp(head[0], [a, head[1]]);
  for (const [op, expr] of rest) {
    a = options.makeOp('and', [a, options.makeOp(op, [a.operands[1], expr])]);
  }
  return a;
} ;

PartialComparisonExpression = @RelOp _? @StringListNullPredicateExpression ;

RelOp = '='
  / '<>'
  / '<'
  / '>'
  / '<='
  / '>='
  ;

StringListNullPredicateExpression = a:AddOrSubtractExpression bs:StringListNullPredicate* {
  for (const [op, expr] of bs) {
    a = options.makeOp(op, expr ? [a, expr] : [a]);
  }
  return a;
} ;

StringListNullPredicate = StringPredicateExpression / ListPredicateExpression / NullPredicateExpression ;

StringPredicateExpression = @StringPredicate _? @AddOrSubtractExpression ;

StringPredicate = _ 'STARTS'i _ 'WITH'i { return 'startswith'; }
  / _ 'ENDS'i _ 'WITH'i { return 'endswith'; }
  / _ @'CONTAINS'i
  ;

ListPredicateExpression = _ @'IN'i _? @AddOrSubtractExpression ;

NullPredicateExpression = _ 'IS'i _ 'NULL'i { return 'isnull'; }
  / _ 'IS'i _ 'NOT'i _ 'NULL'i { return 'isnotnull'; }
  ;

AddOrSubtractExpression = a:MultiplyDivideModuloExpression bs:(_? @AddOp _? @MultiplyDivideModuloExpression)* {
  for (const [op, expr] of bs) {
    a = options.makeOp(op, [a, expr]);
  }
  return a;
} ;

AddOp = '+' / '-' ;

MultiplyDivideModuloExpression = a:PowerOfExpression bs:(_? @MulOp _? @PowerOfExpression)* {
  for (const [op, expr] of bs) {
    a = options.makeOp(op, [a, expr]);
  }
  return a;
} ;

MulOp = '*' / '/' / '%' ;

PowerOfExpression = a:UnaryAddOrSubtractExpression bs:(_? '^' _? @UnaryAddOrSubtractExpression)* {
  return makeOpSeq(a, '^', bs);
} ;

UnaryAddOrSubtractExpression = LabelledExpression
  / op:AddOp _? expr:LabelledExpression { return options.makeOp(op, [expr]); }
  ;

LabelledExpression = expr:NonArithmeticOperatorExpression labels:(_? @NodeLabels)? {
  return labels ? new ast.LabelFilterExpr(expr, labels) : expr;
} ;

ListOrPropOp = ListOperatorExpression
  / PropertyLookup
  ;

NonArithmeticOperatorExpression = a:Atom bs:(_? @ListOrPropOp)* {
  for (const b of bs) {
    if (Array.isArray(b)) {
      a = new ast.SubscriptExpr(a, b);
    } else {
      a = new ast.PropLookup(a, b);
    }
  }
  return a;
} ;


ListOperatorExpression = '[' expr:Expression ']' { return [expr]; }
  / '[' @Expression? '..' @Expression? ']'
  ;

PropertyLookup = '.' _? @PropertyKeyName ;

Atom = Literal
  / Parameter
  / CaseExpression
  / 'COUNT'i _? '(' _? '*' _? ')' {
    return options.wrapFn(ast.ASTIdentifier.fromParts(['count']), [ast.ASTIdentifier.fromParts([ast.allAttrs])])
  }
  / ListComprehension
  / PatternComprehension
  / Quantifier
  / PatternPredicate
  / ParenthesizedExpression
  / FunctionInvocation
  / ExistentialSubquery
  / Variable
  ;

CaseExpression
  = 'CASE'i wts:(_? @CaseAlternative)+ els:(_? 'ELSE'i _? @Expression)? _? 'END'i {
    return new ast.CaseExpr(undefined, wts, els);
  }
  / 'CASE'i _? expr:Expression wts:(_? @CaseAlternative)+ els:(_? 'ELSE'i _? @Expression)? _? 'END'i {
    return new ast.CaseExpr(expr, wts, els);
  } ;

CaseAlternative = 'WHEN'i _? @Expression _? 'THEN'i _? @Expression ;

ListComprehension = '[' _? filter:FilterExpression map:(_? '|' _? @Expression)? _? ']' {
  return new ast.ListComprehension(filter.v, filter.expr, filter.where, map);
} ;

PatternComprehension = '[' _? v:(@Variable _? '=' _?)? pattern:RelationshipsPattern _? where:(@Where _?)? '|' _? map:Expression _? ']' {
  pattern = new ast.PatternElChain(pattern.flat(Infinity));
  pattern.variable = v;
  return new ast.PatternComprehension(pattern, where, map);
} ;

Quantifier = t:QuantifierType _? '(' _? f:FilterExpression _? ')' {
  return new ast.QuantifiedExpr(t.toLowerCase(), f.v, f.expr, f.where);
} ;

QuantifierType = 'ALL'i
  / 'ANY'i
  / 'NONE'i
  / 'SINGLE'i
  ;

FilterExpression = idcol:IdInColl where:(_? @Where)? {
  return { where, v: idcol[0], expr: idcol[1] };
} ;

PatternPredicate = pattern:RelationshipsPattern {
  return new ast.PatternElChain(pattern.flat(Infinity));
} ;

ParenthesizedExpression = '(' _? @Expression _? ')' ;

IdInColl = @Variable _ 'IN'i _ @Expression ;

FunctionInvocation = name:FunctionName _? '(' _? distinct:(@'DISTINCT'i _?)? args:(@Expression|1.., _? ',' _?| _?)? ')' {
  return options.wrapFn(name, args ?? [], !!distinct);
} ;

FunctionName = Namespace SymbolicName {
  return new ast.CypherIdentifier(text());
} ;

ExistentialSubquery
  = 'EXISTS'i _? '{' _? q:RegularQuery _? '}' { return new ast.ExistsSubquery(q); }
  / 'EXISTS'i _? '{' _? p:Pattern w:(_? @Where)? _? '}' { return new ast.ExistsSubquery(null, p, w); } ;

ExplicitProcedureInvocation = name:ProcedureName _? '(' _? args:(@Expression|1.., _? ',' _?| _?)? ')' {
  const res = new options.wrapFn(name, args ?? []);
  res.procedure = true;
  return res;
} ;

ImplicitProcedureInvocation = name:ProcedureName {
  const res = new options.wrapFn(name);
  res.procedure = true;
  return res;
} ;

ProcedureResultField = SymbolicName ;

ProcedureName = Namespace SymbolicName { return new ast.CypherIdentifier(text()); } ;

Namespace = (SymbolicName '.')* ;

Variable = SymbolicName ;

Literal = x:BooleanLiteral { return new ast.ASTBooleanLiteral(x); }
  / x:'NULL'i { return new ast.ASTBooleanLiteral(x); }
  / x:$NumberLiteral { return new ast.ASTNumberLiteral(x); }
  / x:$StringLiteral { return new ast.ASTStringLiteral(x); }
  / ListLiteral
  / MapLiteral
  ;

BooleanLiteral = 'TRUE'i
  / 'FALSE'i
  ;

NumberLiteral = DoubleLiteral
  / IntegerLiteral
  ;

IntegerLiteral = HexInteger
  / OctalInteger
  / BinInteger
  / DecimalInteger
  ;

HexInteger = '0x' HexDigit+ ;

DecimalInteger = ZeroDigit
  / NonZeroDigit Digit*
  ;

OctalInteger = '0o' OctDigit+ ;

BinInteger = '0b' [01]+ ;

HexLetter = [a-f]i ;

HexDigit = Digit
  / HexLetter
  ;

Digit = ZeroDigit
  / NonZeroDigit
  ;

NonZeroDigit = NonZeroOctDigit
  / [89]
  ;

NonZeroOctDigit = [1-7] ;

OctDigit = ZeroDigit
  / NonZeroOctDigit
  ;

ZeroDigit = '0' ;

DoubleLiteral = ExponentDecimalReal
  / RegularDecimalReal
  ;

ExponentDecimalReal
  = Digit+  'E'i '-'? Digit+
  / Digit* '.' Digit+  'E'i '-'? Digit+ ;

RegularDecimalReal = Digit* '.' Digit+ ;

StringLiteral = '"' ([^"\\] / EscapedChar)* '"'
  / "'" ([^'\\] / EscapedChar)* "'"
  ;

EscapedChar = '\\' . ;

ListLiteral = '[' _? items:(@Expression|1.., _? ',' _?| _?)? ']' {
  return new ast.ASTListLiteral(items ?? []);
} ;

MapLiteral = '{' _? props:(@(@PropertyKeyName _? ':' _? @Expression)|1.., _? ',' _?| _?)? '}' {
  props ??= [];
  return new ast.ASTMapLiteral(props.map(([k, v]) => [v, k]));
} ;

PropertyKeyName = SchemaName ;

Parameter
  = '$' name:(SymbolicName / $DecimalInteger) {
    const res = new ast.CypherIdentifier(name);
    res.parts.unshift(ast.boundParam);
    return res;
  }
  ;

SchemaName = SymbolicName
  / name:ReservedWord { return new ast.CypherIdentifier(name); }
  ;

ReservedWord 
  = 'ALL'i
  / 'ASC'i
  / 'ASCENDING'i
  / 'BY'i
  / 'CREATE'i
  / 'DELETE'i
  / 'DESC'i
  / 'DESCENDING'i
  / 'DETACH'i
  / 'EXISTS'i
  / 'LIMIT'i
  / 'MATCH'i
  / 'MERGE'i
  / 'ON'i
  / 'OPTIONAL'i
  / 'ORDER'i
  / 'REMOVE'i
  / 'RETURN'i
  / 'SET'i
  / 'SKIP'i
  / 'WHERE'i
  / 'WITH'i
  / 'UNION'i
  / 'UNWIND'i
  / 'AND'i
  / 'AS'i
  / 'CONTAINS'i
  / 'DISTINCT'i
  / 'ENDS'i
  / 'IN'i
  / 'IS'i
  / 'NOT'i
  / 'OR'i
  / 'STARTS'i
  / 'XOR'i
  / 'FALSE'i
  / 'TRUE'i
  / 'NULL'i
  / 'CONSTRAINT'i
  / 'DO'i
  / 'FOR'i
  / 'REQUIRE'i
  / 'UNIQUE'i
  / 'CASE'i
  / 'WHEN'i
  / 'THEN'i
  / 'ELSE'i
  / 'END'i
  / 'MANDATORY'i
  / 'SCALAR'i
  / 'OF'i
  / 'ADD'i
  / 'DROP'i
  ;

SymbolicName
  = ( UnescapedSymbolicName
  / EscapedSymbolicName
  / 'COUNT'i
  / 'FILTER'i
  / 'EXTRACT'i
  / 'ANY'i
  / 'NONE'i
  / 'SINGLE'i ) { return new ast.CypherIdentifier(text()); }
  ;

UnescapedSymbolicName = IdentifierStart IdentifierPart* ;

// (* Based on the unicode identifier and pattern syntax
//  *   (http://www.unicode.org/reports/tr31/)
//  * And extended with a few characters.
//  *)
IdentifierStart = [\p{ID_Start}\p{Pc}] ;

// (* Based on the unicode identifier and pattern syntax
//  *   (http://www.unicode.org/reports/tr31/)
//  * And extended with a few characters.
//  *)
IdentifierPart = [\p{ID_Continue}\p{Sc}] ;

// Any character except "`" enclosed within `backticks`. Backticks are escaped with double backticks.
EscapedSymbolicName = ('`' [^`]* '`')+ ;

_ = whitespace+ ;

whitespace = [\p{White_Space}]
           / Comment
           ;

Comment = '/*' ([^*] / ('*' [^/]))* '*/'
        / '//' ([^\r\n])* '\r'? ('\n' / !.)
        ;

LeftArrowHead = [<⟨〈﹤＜] ;

RightArrowHead = [>⟩〉﹥＞] ;

Dash = [-­‐‑‒–—―−﹘﹣－] ;