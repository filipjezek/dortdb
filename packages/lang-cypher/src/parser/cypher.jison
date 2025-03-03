/*

There is one expected reduce/reduce conflict in this grammar:
Conflict in grammar: multiple actions possible when lookahead token is RPAR in state 135 (number can change in future)
- reduce by rule: node-label-list_opt ->
- reduce by rule: atom -> variable

This is because of our limited lookahead and cannot be resolved using precedence rules, because
it is not shift/reduce. It is solved in lexer by using PARENVAR token, but the parser is not aware of that.

*/

%start root

%token YIELD
%token XOR
%token WITH
%token WHERE
%token WHEN
%token UNWIND
%token UNIQUE
%token UNION
%token TRUE
%token THEN
%token STARTS
%token SKIP
%token SINGLE
%token SET
%token SCALAR
%token RETURN
%token REQUIRE
%token REMOVE
%token ORDER
%token OR
%token OPTIONAL
%token ON
%token OF
%token NULL
%token NOT
%token NONE
%token MERGE
%token MATCH
%token MANDATORY
%token LIMIT
%token IS
%token IN
%token FROM
%token FOR
%token FALSE
%token EXISTS
%token ENDS
%token END
%token ELSE
%token DROP
%token DO
%token DISTINCT
%token DETACH
%token DESCENDING
%token DESC
%token DELETE
%token CREATE
%token COUNT
%token CONTAINS
%token CONSTRAINT
%token CASE
%token CALL
%token BY
%token ASCENDING
%token ASC
%token AS
%token ANY
%token AND
%token ALL
%token ADD

%token LBRA
%token RBRA
%token LPAR
%token RPAR
%token LCUR
%token RCUR
%token RARROW
%token GT
%token LT
%token EQ
%token NEQ
%token GTE
%token LTE
%token PLUS
%token MINUS
%token PLUSEQ
%token DASH
%token DBLDASH
%token DASHLBRA
%token LARROWDASHLBRA
%token LARROWDBLDASH
%token COMMA
%token SEMICOLON
%token COLON
%token PIPE
%token STAR
%token SLASH
%token PERCENT
%token EXP
%token DOT
%token DBLDOT
%token PARAM
%token INTLIT
%token FLOATLIT
%token STRLIT
%token ID
%token SCHEMANAMELPAR
%token LANGSWITCH
%token LANGEXIT
%token PARENVAR

%nonassoc COMPR_PRIORITY
%nonassoc PARAM LCUR COLON RPAR  // need to specify some precedence for the other priorities to work
%nonassoc PAREN_EXPR_PRIORITY
%nonassoc IN EQ


%%

scope-exit:
	RBRA
	| RPAR
	| RCUR
	| LANGEXIT ;

root:
	scope-exit { return null; }
	| scope-exit error { return null; }
  | full-query scope-exit { return [$1]; }
	| full-query scope-exit error { return [$1]; }
  | full-query { return [$1]; } ;

full-query:
  regular-query semicolon_opt
  | standalone-call semicolon_opt
  | in-query-call semicolon_opt ; // standalone call in reality overlaps in-query call, for grammar reasons they are disjunct and need to be specified both here

regular-query:
  single-query
  | from-clause single-query { $$ = $2; $2.from = $1; }
  | regular-query setop single-query { $$ = $1; $1.setOp = new yy.ast.SetOp($2, $3); }
  | regular-query setop from-clause single-query { $$ = $1; $1.setOp = new yy.ast.SetOp($2, $4); $4.from = $3; } ;

setop:
  UNION
  | UNION ALL { $$ = 'unionall' } ;

single-query:
  single-part-query
  | multi-part-query ;

single-part-query:
  reading-clause-list_opt return-clause { $$ = new yy.ast.Query($1); $1.push($2); }
  | reading-clause-list_opt updating-clause-list return-clause_opt { $$ = new yy.ast.Query([...$1, ...$2, $3]); } ;

multi-part-query:
  mpq-start-list single-part-query { $$ = $2; $2.statements = [$1, $2.statements].flat(Infinity); } ;

mpq-start-list:
  mpq-start { $$ = [$1]; }
  | mpq-start-list mpq-start { $$ = $1; $1.push($2); } ;

mpq-start:
  reading-clause-list_opt updating-clause-list_opt with-clause { $$ = [$1, $2, $3]; } ;

reading-clause-list:
  reading-clause { $$ = [$1]; }
  | reading-clause-list reading-clause { $$ = $1; $$.push($2); } ;

reading-clause:
  match-clause
  | unwind-clause
  | in-query-call ;

from-clause:
  FROM symbolic-name { $$ = $2; } ;

match-clause:
  OPTIONAL MATCH pattern where-clause_opt { $$ = new yy.ast.MatchClause($3, $4); $$.optional = true; }
  | MATCH pattern where-clause_opt { $$ = new yy.ast.MatchClause($2, $3); } ;

unwind-clause:
  UNWIND expression AS variable { $$ = new yy.ast.UnwindClause($2, $4); } ;

updating-clause-list:
  updating-clause { $$ = [$1]; }
  | updating-clause-list updating-clause { $$ = $1; $$.push($2); } ;

updating-clause:
  create-clause
  | merge-clause
  | set-clause
  | remove-clause
  | delete-clause ;

create-clause:
  CREATE pattern ;

merge-clause:
  MERGE pattern-part merge-actions-list_opt { $$ = new yy.ast.MergeClause($2, $3); } ;

merge-actions-list:
  merge-action { $$ = [$1]; }
  | merge-actions-list merge-action { $$ = $1; $$.push($2); } ;

merge-action:
  ON MATCH set-clause { $$ = new yy.ast.MergeAction('match', $3.items); }
  | ON CREATE set-clause { $$ = new yy.ast.MergeAction('create', $3.items); } ;

set-clause:
  SET set-item-list { $$ = new yy.ast.SetClause($2); } ;

set-item-list:
  set-item { $$ = [$1]; }
  | set-item-list COMMA set-item { $$ = $1; $$.push($3); } ;

set-item:
  property-expr EQ expression { $$ = new yy.ast.SetItem($1, $3); }
  | variable EQ expression { $$ = new yy.ast.SetItem($1, $3); }
  | variable PLUSEQ expression { $$ = new yy.ast.SetItem($1, $3); $$.add = true; }
  | variable node-label-list { $$ = new yy.ast.SetItem($1, $2); } ;

remove-clause:
  REMOVE remove-item-list { $$ = new yy.ast.RemoveClause($2); } ;

remove-item-list:
  remove-item { $$ = [$1]; }
  | remove-item-list COMMA remove-item { $$ = $1; $$.push($3); } ;

remove-item:
  property-expr { $$ = new yy.ast.RemoveItem($1); }
  | variable node-label-list { $$ = new yy.ast.RemoveItem($1, $2); } ;

delete-clause:
  DELETE expression-list { $$ = new yy.ast.DeleteClause($2); }
  | DETACH DELETE expression-list { $$ = new yy.ast.DeleteClause($3, true); } ;

expression-list:
  expression { $$ = [$1]; }
  | expression-list COMMA expression { $$ = $1; $$.push($3); } ;

in-query-call:
  CALL explicit-procedure-invocation { $$ = $2; }
  | CALL explicit-procedure-invocation YIELD yield-item-list where-clause_opt { $$ = $2; $$.yieldItems = $4; $$.where = $5; } ;

standalone-call:
  CALL implicit-procedure-invocation  { $$ = $2; }
  | CALL implicit-procedure-invocation YIELD yield-item-list where-clause_opt { $$ = $2; $$.yieldItems = $4; $$.where = $5; }
  | CALL explicit-procedure-invocation YIELD STAR { $$ = $2; $$.yieldItems = $4; }
  | CALL implicit-procedure-invocation YIELD STAR { $$ = $2; $$.yieldItems = $4; } ;

yield-item-list:
  yield-item { $$ = [$1]; }
  | yield-item-list COMMA yield-item { $$ = $1; $$.push($3); } ;

yield-item:
  symbolic-name AS variable { $$ = [$1, $3]; }
  | variable ;

with-clause:
  WITH projection-body where-clause_opt { $$ = new yy.ast.WithClause($2, $3); } ;

return-clause:
  RETURN projection-body { $$ = new yy.ast.ReturnClause($2); } ;

projection-body:
  distinct_opt projection-item-list order-clause_opt skip-clause_opt limit-clause_opt {
    $$ = new yy.ast.ProjectionBody($2, $3, $4, $5, $1);
  } ;

projection-item-list:
  projection-item { $$ = [$1]; }
  | STAR { $$ = [$1]; }
  | projection-item-list COMMA projection-item { $$ = $1; $$.push($3); } ;

projection-item:
  expression
  | expression AS variable { $$ = [$1, $3]; } ;

order-clause:
  ORDER BY sort-item-list { $$ = $3; };

sort-item-list:
  sort-item { $$ = [$1]; }
  | sort-item-list COMMA sort-item { $$ = $1; $$.push($3); } ;

sort-item:
  expression { $$ = new yy.ast.OrderItem($1); }
  | expression ASCENDING { $$ = new yy.ast.OrderItem($1, true); }
  | expression ASC { $$ = new yy.ast.SortItem($1, true); }
  | expression DESCENDING { $$ = new yy.ast.OrderItem($1, false); }
  | expression DESC { $$ = new yy.ast.OrderItem($1, false); } ;

skip-clause:
  SKIP expression { $$ = $2; } ;

limit-clause:
  LIMIT expression { $$ = $2; } ;

where-clause:
  WHERE expression { $$ = $2; } ;

// patterns

pattern:
  pattern-part { $$ = [$1]; }
  | pattern COMMA pattern-part { $$ = $1; $$.push($2); } ;

pattern-part:
  variable EQ pattern-element { $$ = $3; $$.variable = $1; }
  | pattern-element ;

pattern-element:
  pattern-el-chain
  | LPAR pattern-element RPAR { $$ = $2; } ;

pattern-el-chain:
  node-pattern { $$ = new yy.ast.PatternElChain($1); }
  | pattern-el-chain rel-pattern node-pattern { $$ = $1; $$.chain.push($2, $3); } ;

node-pattern:
  PARENVAR { $$ = new yy.ast.NodePattern(new yy.ast.CypherIdentifier($1.slice(1, -1).trim())); }
  | LPAR variable node-label-list_opt properties_opt RPAR {
    $$ = new yy.ast.NodePattern($2, $3, $4);
  }
  | LPAR node-label-list_opt properties_opt RPAR { $$ = new yy.ast.NodePattern(undefined, $2, $3); } ;

rel-pattern:
  LARROWDBLDASH { $$ = new yy.ast.RelPattern(true, false); }
  | LARROWDASHLBRA rel-detail arrow-body { $$ = $2; $$.pointsLeft = true; }
  | DBLDASH arrow-right_opt { $$ = new yy.ast.RelPattern(false, !!$2); }
  | DASHLBRA rel-detail arrow-body arrow-right_opt { $$ = $2; $$.pointsRight = !!$4; } ;

rel-detail:
  variable_opt rel-type-union_opt range-literal_opt properties_opt RBRA {
    $$ = new yy.ast.RelPattern(false, false, $1, $2, $3, $4);
  } ;

properties:
  map-literal
  | PARAM { $$ = new yy.ast.ASTParameter($1); } ;

rel-type-union:
  COLON schema-name { $$ = [$2]; }
  | rel-type-union PIPE COLON schema-name { $$ = $1; $$.push($4); } ;

node-label-list:
  COLON schema-name { $$ = [$2]; }
  | node-label-list COLON schema-name { $$ = $1; $$.push($3); } ;

range-literal:
  STAR int-literal_opt { $$ = [$2]; }
  | STAR int-literal_opt DBLDOT int-literal_opt { $$ = [$2, $4]; } ;

arrow-right:
  RARROW
  | GT ;

arrow-body:
  MINUS
  | DASH ;

// expressions

property-expr:
  atom property-lookup { $$ = new yy.ast.PropLookup($1, $2); }
  | property-expr property-lookup { $$ = new yy.ast.PropLookup($1, $2); } ;

expression:
  or-expression ;

or-expression:
  xor-expression
  | or-expression OR xor-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

xor-expression:
  and-expression
  | xor-expression XOR and-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

and-expression:
  not-expression
  | and-expression AND not-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

not-expression:
  string-list-null-predicate-expression
  | comparison-expression-chain
  | NOT not-expression { $$ = yy.makeOp($1, [$2]); } ;

comparison-expression-chain:
  string-list-null-predicate-expression compop string-list-null-predicate-expression { $$ = yy.makeOp($2, [$1, $3]); }
  | comparison-expression-chain compop string-list-null-predicate-expression {
    $$ = yy.makeOp('and', [$1, yy.makeOp($2, [$1.operands[1], $3])]);
  } ;

compop:
  EQ
  | NEQ
  | LT
  | GT
  | LTE
  | GTE ;

string-list-null-predicate-expression:
  additive-expression
  | string-list-null-predicate-expression IS NULL { $$ = yy.makeOp('isnull', [$1]); }
  | string-list-null-predicate-expression IS NOT NULL { $$ = yy.makeOp('isnotnull', [$1]); }
  | string-list-null-predicate-expression CONTAINS additive-expression { $$ = yy.makeOp($2, [$1, $3]); }
  | string-list-null-predicate-expression STARTS WITH additive-expression { $$ = yy.makeOp('startswith', [$1, $3]); }
  | string-list-null-predicate-expression ENDS WITH additive-expression { $$ = yy.makeOp('startswith', [$1, $3]); }
  | string-list-null-predicate-expression IN additive-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

additive-expression:
  multiplicative-expression
  | additive-expression PLUS multiplicative-expression { $$ = yy.makeOp($2, [$1, $3]); }
  | additive-expression MINUS multiplicative-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

multiplicative-expression:
  power-expression
  | multiplicative-expression STAR power-expression { $$ = yy.makeOp($2, [$1, $3]); }
  | multiplicative-expression SLASH power-expression { $$ = yy.makeOp($2, [$1, $3]); }
  | multiplicative-expression PERCENT power-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

power-expression:
  unary-expression
  | power-expression EXP unary-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

unary-expression:
  non-arithmetic-op-expression
  | PLUS unary-expression { $$ = yy.makeOp($1, [$2]); }
  | MINUS unary-expression { $$ = yy.makeOp($1, [$2]); } ;

non-arithmetic-op-expression:
  label-filter-expression
  | non-arithmetic-op-expression LBRA expression RBRA { $$ = new yy.ast.SubscriptExpr($1, [$3]); }
  | non-arithmetic-op-expression LBRA expression_opt DBLDOT expression_opt RBRA { $$ = new yy.ast.SubscriptExpr($1, [$3, $5]); }
  | non-arithmetic-op-expression property-lookup { $$ = new yy.ast.PropLookup($1, $2); };

property-lookup:
  DOT schema-name { $$ = $2; } ;

label-filter-expression:
  atom
  | atom node-label-list { $$ = new yy.ast.LabelFilterExpr($1, $2); } ;

atom:
  atom-no-pattern
  | PARAM { $$ = new yy.ast.ASTParameter($1); }
  | variable %prec PAREN_EXPR_PRIORITY
  | map-literal ;

atom-no-pattern:
  literal
  | case-expression
  | COUNT LPAR STAR RPAR { $$ = new yy.ast.CountAll(); }
  | list-comprehension
  | pattern-comprehension
  | quantified-expression
  | function-invocation
  | existential-subquery
  | pattern-el-chain
  | LANGSWITCH { $$ = yy.messageQueue.shift(); }
  | LPAR expression RPAR { $$ = $2; } ; 

case-expression:
  CASE case-expr-alternative-list else-clause_opt END { $$ = new yy.ast.CaseExpr(undefined, $2, $3); }
  | CASE expression case-expr-alternative-list else-clause_opt END { $$ = new yy.ast.CaseExpr($2, $3, $4); } ;

case-expr-alternative-list:
  case-expr-alternative { $$ = [$1]; }
  | case-expr-alternative-list case-expr-alternative { $$ = $1; $$.push($2); } ;

case-expr-alternative:
  WHEN expression THEN expression { $$ = [$2, $4]; } ;

list-comprehension:
  LBRA variable IN expression where-clause RBRA { $$ = new yy.ast.ListComprehension($2, $4, $5); }
  | LBRA variable IN expression where-clause_opt PIPE expression RBRA { $$ = new yy.ast.ListComprehension($2, $4, $5, $7); } ;

pattern-comprehension:
  LBRA pattern-el-chain where-clause_opt PIPE expression RBRA { $$ = new yy.ast.PatternComprehension($2, $3, $5); }
  | LBRA variable EQ pattern-el-chain where-clause_opt PIPE expression RBRA %prec COMPR_PRIORITY {
    $4.variable = $2;
    $$ = new yy.ast.PatternComprehension($4, $5, $7);
  } ;

quantified-expression:
  quantifier LPAR variable IN expression where-clause_opt RPAR { $$ = new yy.ast.QuantifiedExpr($1, $3, $5, $6); } ;

quantifier:
  ANY
  | ALL
  | NONE
  | SINGLE ;

function-invocation:
  symbolic-name LPAR distinct_opt expression-list RPAR { $$ = yy.wrapFn($1, $4, $3); }
  | SCHEMANAMELPAR distinct_opt expression-list RPAR { $$ = yy.wrapFn(new yy.ast.CypherIdentifier($1.slice(0, -1)), $3, $2); } ;

existential-subquery:
  EXISTS LCUR regular-query RCUR { $$ = new yy.ast.ASTExists(); $$.query = $3; }
  | EXISTS LCUR LANGSWITCH RCUR { $$ = new yy.ast.ASTExists(); $$.query = $yy.messageQueue.shift(); }
  | EXISTS LCUR pattern where-clause_opt RCUR { $$ = new yy.ast.ASTExists(); $$.pattern = $3; $$.where = $4; } ;

explicit-procedure-invocation:
  symbolic-name LPAR expression-list RPAR { $$ = yy.wrapFn($1, $4, $3); $$.procedure = true; }
  | SCHEMANAMELPAR expression-list RPAR { $$ = yy.wrapFn(new yy.ast.CypherIdentifier($1.slice(0, -1)), $3, $2); $$.procedure = true; } ;

implicit-procedure-invocation:
  symbolic-name { $$ = yy.wrapFn($1); $$.procedure = true; }
  | symbolic-name DOT symbolic-name {
    $$ = yy.wrapFn(new yy.ast.CypherIdentifier($1.idOriginal, $2.idOriginal));
    $$.procedure = true;
  } ;

variable:
  symbolic-name ;

literal:
  number-literal
  | TRUE { $$ = new yy.ast.ASTBooleanLiteral($1); }
  | FALSE { $$ = new yy.ast.ASTBooleanLiteral($1); }
  | NULL { $$ = new yy.ast.ASTBooleanLiteral($1); }
  | STRLIT { $$ = new yy.ast.ASTStringLiteral($1); }
  | list-literal ;

number-literal:
  int-literal
  | FLOATLIT { $$ = new yy.ast.ASTNumberLiteral($1); } ;

int-literal:
  INTLIT { $$ = new yy.ast.ASTNumberLiteral($1); } ;

list-literal:
  LBRA expression-list_opt RBRA { $$ = new yy.ast.ASTListLiteral($2); } ;

map-literal:
  LCUR map-entry-list_opt RCUR { $$ = new yy.ast.ASTMapLiteral($2); } ;

map-entry-list:
  schema-name COLON expression { $$ = [[$3, $1]]; }
  | map-entry-list COMMA schema-name COLON expression { $$ = $1; $$.push([$5, $3]); } ;

reserved-word:
  ALL
  | ASC
  | ASCENDING
  | BY
  | CREATE
  | DELETE
  | DESC
  | DESCENDING
  | DETACH
  | EXISTS
  | LIMIT
  | MATCH
  | MERGE
  | ON
  | OPTIONAL
  | ORDER
  | REMOVE
  | RETURN
  | SET
  | SKIP
  | WHERE
  | WITH
  | UNION
  | UNWIND
  | AND
  | AS
  | CONTAINS
  | DISTINCT
  | ENDS
  | IN
  | IS
  | NOT
  | OR
  | STARTS
  | XOR
  | FALSE
  | TRUE
  | NULL
  | CONSTRAINT
  | DO
  | FOR
  | REQUIRE
  | UNIQUE
  | CASE
  | WHEN
  | THEN
  | ELSE
  | END
  | MANDATORY
  | SCALAR
  | OF
  | ADD
  | DROP
  | COUNT
  | NONE
  | ANY
  | SINGLE
  ;

schema-name:
  symbolic-name
  | reserved-word { $$ = new yy.ast.CypherIdentifier($1); } ;

symbolic-name:
  ID { $$ = new yy.ast.CypherIdentifier($1); } ;

// optionals

semicolon_opt:
  | SEMICOLON ;

reading-clause-list_opt:
  { $$ = []; }
  | reading-clause-list ;

updating-clause-list_opt:
  { $$ = []; }
  | updating-clause-list ;

where-clause_opt:
  | where-clause ;

return-clause_opt:
  | return-clause ;

merge-actions-list_opt:
  { $$ = []; }
  | merge-actions-list ;

distinct_opt:
  { $$ = false; }
  | DISTINCT { $$ = true; } ;

order-clause_opt:
  | order-clause ;

skip-clause_opt:
  | skip-clause ;

limit-clause_opt:
  | limit-clause ;

variable_opt:
  | variable ;

node-label-list_opt:
  %prec PAREN_EXPR_PRIORITY { $$ = []; }
  | node-label-list ;

properties_opt:
  | properties ;

arrow-right_opt:
  | arrow-right ;

rel-type-union_opt:
  { $$ = []; }
  | rel-type-union ;

range-literal_opt:
  | range-literal ;

else-clause_opt:
  | ELSE expression { $$ = $2; } ;

int-literal_opt:
  | int-literal ;

expression-list_opt:
  { $$ = []; }
  | expression-list ;

map-entry-list_opt:
  { $$ = []; }
  | map-entry-list ;

expression_opt:
  | expression ;

from-clause_opt:
  | from-clause ;