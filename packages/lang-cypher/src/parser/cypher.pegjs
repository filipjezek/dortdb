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

PatternElement = NodePattern (_? PatternElementChain)*
               / '(' @PatternElement ')'
               ;

RelationshipsPattern = NodePattern (_? PatternElementChain)+ ;

NodePattern = '(' _? (Variable _?)? (NodeLabels _?)? (Properties _?)? ')' ;

PatternElementChain = RelationshipPattern _? NodePattern ;

RelationshipPattern = LeftArrowHead _? Dash _? RelationshipDetail? _? Dash _? RightArrowHead
                    / LeftArrowHead _? Dash _? RelationshipDetail? _? Dash
                    / Dash _? RelationshipDetail? _? Dash _? RightArrowHead
                    / Dash _? RelationshipDetail? _? Dash
                    ;

RelationshipDetail = '[' _? (Variable _?)? (RelationshipTypes _?)? RangeLiteral? (Properties _?)? ']' ;

Properties = MapLiteral
           / Parameter
           ;

RelationshipTypes = ':' _? RelTypeName (_? '|' ':'* _? RelTypeName)* ;

NodeLabels = NodeLabel (_? NodeLabel)* ;

NodeLabel = ':' _? LabelName ;

RangeLiteral = '*' _? (IntegerLiteral _?)? ('..' _? (IntegerLiteral _?)?)? ;

LabelName = SchemaName ;

RelTypeName = SchemaName ;

PropertyExpression = Atom (_? PropertyLookup)+ ;

Expression = OrExpression ;

OrExpression = XorExpression (_ 'OR'i _ XorExpression)* ;

XorExpression = AndExpression (_ 'XOR'i _ AndExpression)* ;

AndExpression = NotExpression (_ 'AND'i _ NotExpression)* ;

NotExpression = ('NOT'i _?)* ComparisonExpression ;

ComparisonExpression = StringListNullPredicateExpression (_? PartialComparisonExpression)* ;

PartialComparisonExpression = RelOp _? StringListNullPredicateExpression ;

RelOp = '='
        / '<>'
        / '<'
        / '>'
        / '<='
        / '>='
        ;

StringListNullPredicateExpression = AddOrSubtractExpression StringListNullPredicate* ;

StringListNullPredicate = StringPredicateExpression / ListPredicateExpression / NullPredicateExpression ;

StringPredicateExpression = StringPredicate _? AddOrSubtractExpression ;

StringPredicate = _ 'STARTS'i _ 'WITH'i
                / _ 'ENDS'i _ 'WITH'i
                / _ 'CONTAINS'i
                ;

ListPredicateExpression = _ 'IN'i _? AddOrSubtractExpression ;

NullPredicateExpression = _ 'IS'i _ 'NULL'i
                        / _ 'IS'i _ 'NOT'i _ 'NULL'i
                        ;

AddOrSubtractExpression = MultiplyDivideModuloExpression (_? AddOp _? MultiplyDivideModuloExpression)* ;

AddOp = '+' / '-' ;

MultiplyDivideModuloExpression = PowerOfExpression (_? MulOp _? PowerOfExpression)* ;

MulOp = '*' / '/' / '%' ;

PowerOfExpression = UnaryAddOrSubtractExpression (_? '^' _? UnaryAddOrSubtractExpression)* ;

UnaryAddOrSubtractExpression = NonArithmeticOperatorExpression
                             / AddOp _? NonArithmeticOperatorExpression
                             ;

LabelledExpression = NonArithmeticOperatorExpression (_? NodeLabels)? ;

ListOrPropOp = ListOperatorExpression
              / PropertyLookup
              ;

NonArithmeticOperatorExpression = Atom (_? ListOrPropOp)* ;


ListOperatorExpression = '[' Expression ']'
                       / '[' Expression? '..' Expression? ']'
                       ;

PropertyLookup = '.' _? PropertyKeyName ;

Atom = Literal
     / Parameter
     / CaseExpression
     / 'COUNT'i _? '(' _? '*' _? ')'
     / ListComprehension
     / PatternComprehension
     / Quantifier
     / PatternPredicate
     / ParenthesizedExpression
     / FunctionInvocation
     / ExistentialSubquery
     / Variable
     ;

CaseExpression = 'CASE'i (_? CaseAlternative)+ (_? 'ELSE'i _? Expression)? _? 'END'i
               / 'CASE'i _? Expression (_? CaseAlternative)+ (_? 'ELSE'i _? Expression)? _? 'END'i ;

CaseAlternative = 'WHEN'i _? Expression _? 'THEN'i _? Expression ;

ListComprehension = '[' _? FilterExpression (_? '|' _? Expression)? _? ']' ;

PatternComprehension = '[' _? (Variable _? '=' _?)? RelationshipsPattern _? (Where _?)? '|' _? Expression _? ']' ;

Quantifier = 'ALL'i _? '(' _? FilterExpression _? ')'
           / 'ANY'i _? '(' _? FilterExpression _? ')'
           / 'NONE'i _? '(' _? FilterExpression _? ')'
           / 'SINGLE'i _? '(' _? FilterExpression _? ')'
           ;

FilterExpression = IdInColl (_? Where)? ;

PatternPredicate = RelationshipsPattern ;

ParenthesizedExpression = '(' _? Expression _? ')' ;

IdInColl = Variable _ 'IN'i _ Expression ;

FunctionInvocation = FunctionName _? '(' _? ('DISTINCT'i _?)? (Expression _? (',' _? Expression _?)*)? ')' ;

FunctionName = Namespace SymbolicName ;

ExistentialSubquery = 'EXISTS'i _? '{' _? RegularQuery _? '}'
                    / 'EXISTS'i _? '{' _? Pattern (_? Where)? _? '}' ;

ExplicitProcedureInvocation = ProcedureName _? '(' _? (Expression _? (',' _? Expression _?)*)? ')' ;

ImplicitProcedureInvocation = ProcedureName ;

ProcedureResultField = SymbolicName ;

ProcedureName = Namespace SymbolicName ;

Namespace = (SymbolicName '.')* ;

Variable = SymbolicName ;

Literal = BooleanLiteral
        / 'NULL'i
        / NumberLiteral
        / StringLiteral
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
               / DecimalInteger
               ;

HexInteger = '0x' HexDigit+ ;

DecimalInteger = ZeroDigit
               / NonZeroDigit Digit*
               ;

OctalInteger = '0o' OctDigit+ ;

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

ExponentDecimalReal = (Digit+ / (Digit+ '.' Digit+) / ('.' Digit+)) 'E'i '-'? Digit+ ;

RegularDecimalReal = Digit* '.' Digit+ ;

StringLiteral = '"' ([^"\\] / EscapedChar)* '"'
              / "'" ([^'\\] / EscapedChar)* "'"
              ;

EscapedChar = '\\' ('\\' / "'" / '"' / [bfnrt]i / ('U'i HexDigit|4|) / ('U'i HexDigit|8|)) ;

ListLiteral = '[' _? (Expression _? (',' _? Expression _?)*)? ']' ;

MapLiteral = '{' _? (PropertyKeyName _? ':' _? Expression _? (',' _? PropertyKeyName _? ':' _? Expression _?)*)? '}' ;

PropertyKeyName = SchemaName ;

Parameter = '$' SymbolicName
          / '$' DecimalInteger
          ;

SchemaName = SymbolicName
           / ReservedWord
           ;

ReservedWord = 'ALL'i
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

SymbolicName = UnescapedSymbolicName
             / EscapedSymbolicName
             / HexLetter
             / 'COUNT'i
             / 'FILTER'i
             / 'EXTRACT'i
             / 'ANY'i
             / 'NONE'i
             / 'SINGLE'i
             ;

UnescapedSymbolicName = IdentifierStart { IdentifierPart } ;

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

whitespace = [\s]
           / Comment
           ;

Comment = '/*' ([^*] / ('*' [^/]))* '*/'
        / '//' ([^\r\n])* '\r'? ('\n' / !.)
        ;

LeftArrowHead = [<⟨〈﹤＜] ;

RightArrowHead = [>⟩〉﹥＞] ;

Dash = [-­‐‑‒–—―−﹘﹣－] ;