/*

There is one expected reduce/reduce conflict in this grammar:
Conflict in grammar: multiple actions possible when lookahead token is RPAR in state 135 (number can change in future)
- reduce by rule: node-label-list_opt ->
- reduce by rule: atom -> variable

This is because of our limited lookahead and cannot be resolved using precedence rules, because
it is not shift/reduce. The parser will always choose the first rule in this case, which
is the correct one.

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

%nonassoc NODE_PATTERN_PRIORITY COMPR_PRIORITY
%nonassoc PAREN_EXPR_PRIORITY LISTLIT_PRIORITY

%nonassoc PARAM LCUR COLON RPAR EQ IN // need to specify some precedence for the other priorities to work

%%

scope-exit:
	RBRA
	| RPAR
	| RCUR
	| LANGEXIT ;

root:
	scope-exit { return null; }
	| scope-exit error { return null; }
  | full-query scope-exit { return $1; }
	| full-query scope-exit error { return $1; }
  | full-query { return $1; } ;

full-query:
  regular-query semicolon_opt
  | standalone-call semicolon_opt
  | in-query-call semicolon_opt ; // standalone call in reality overlaps in-query call, for grammar reasons they are disjunct and need to be specified both here

regular-query:
  single-query
  | regular-query setop single-query ;

setop:
  UNION
  | UNION ALL ;

single-query:
  single-part-query
  | multi-part-query ;

single-part-query:
  reading-clause-list_opt return-clause
  | reading-clause-list_opt updating-clause-list return-clause_opt ;

multi-part-query:
  mpq-start-list single-part-query ;

mpq-start-list:
  mpq-start { $$ = [$1]; }
  | mpq-start-list mpq-start { $$ = $1; $$.push($2); } ;

mpq-start:
  reading-clause-list_opt updating-clause-list_opt with-clause ;

reading-clause-list:
  reading-clause { $$ = [$1]; }
  | reading-clause-list reading-clause { $$ = $1; $$.push($2); } ;

reading-clause:
  match-clause
  | unwind-clause
  | in-query-call ;

match-clause:
  OPTIONAL MATCH pattern where-clause_opt
  | MATCH pattern where-clause_opt ;

unwind-clause:
  UNWIND expression AS variable ;

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
  MERGE pattern-part merge-actions-list_opt ;

merge-actions-list:
  merge-action { $$ = [$1]; }
  | merge-actions-list merge-action { $$ = $1; $$.push($2); } ;

merge-action:
  ON MATCH set-clause
  | ON CREATE set-clause ;

set-clause:
  SET set-item-list ;

set-item-list:
  set-item { $$ = [$1]; }
  | set-item-list COMMA set-item { $$ = $1; $$.push($3); } ;

set-item:
  property-expr EQ expression
  | variable EQ expression
  | variable PLUSEQ expression
  | variable node-label-list ;

remove-clause:
  REMOVE remove-item-list ;

remove-item-list:
  remove-item { $$ = [$1]; }
  | remove-item-list COMMA remove-item { $$ = $1; $$.push($3); } ;

remove-item:
  property-expr
  | variable node-label-list ;

delete-clause:
  DELETE expression-list
  | DETACH DELETE expression-list ;

expression-list:
  expression { $$ = [$1]; }
  | expression-list COMMA expression { $$ = $1; $$.push($3); } ;

in-query-call:
  CALL explicit-procedure-invocation
  | CALL explicit-procedure-invocation YIELD yield-item-list where-clause_opt ;

standalone-call:
  CALL implicit-procedure-invocation 
  | CALL implicit-procedure-invocation YIELD yield-item-list where-clause_opt
  | CALL explicit-procedure-invocation YIELD STAR
  | CALL implicit-procedure-invocation YIELD STAR ;

yield-item-list:
  yield-item { $$ = [$1]; }
  | yield-item-list COMMA yield-item { $$ = $1; $$.push($3); } ;

yield-item:
  symbolic-name AS variable
  | variable ;

with-clause:
  WITH projection-body where-clause_opt ;

return-clause:
  RETURN projection-body ;

projection-body:
  distinct_opt projection-item-list order-clause_opt skip-clause_opt limit-clause_opt ;

projection-item-list:
  projection-item { $$ = [$1]; }
  | STAR { $$ = [$1]; }
  | projection-item-list COMMA projection-item { $$ = $1; $$.push($3); } ;

projection-item:
  expression
  | expression AS variable ;

order-clause:
  ORDER BY sort-item-list ;

sort-item-list:
  sort-item { $$ = [$1]; }
  | sort-item-list COMMA sort-item { $$ = $1; $$.push($3); } ;

sort-item:
  expression
  | expression ASCENDING
  | expression ASC
  | expression DESCENDING
  | expression DESC ;

skip-clause:
  SKIP expression ;

limit-clause:
  LIMIT expression ;

where-clause:
  WHERE expression ;

// patterns

pattern:
  pattern-part { $$ = [$1]; }
  | pattern COMMA pattern-part { $$ = $1; $$.push($2); } ;

pattern-part:
  variable EQ pattern-element
  | pattern-element ;

pattern-element:
  pattern-el-chain
  | LPAR pattern-element RPAR ;

pattern-el-chain:
  node-pattern
  | pattern-el-chain rel-pattern node-pattern ;

node-pattern:
  LPAR variable node-label-list_opt properties_opt RPAR %prec NODE_PATTERN_PRIORITY
  | LPAR node-label-list_opt properties_opt RPAR ;

rel-pattern:
  LARROWDBLDASH arrow-body arrow-right_opt
  | LARROWDASHLBRA rel-detail arrow-body arrow-right_opt
  | DBLDASH arrow-right_opt
  | DASHLBRA rel-detail arrow-body arrow-right_opt ;

rel-detail:
  variable_opt rel-type-union_opt range-literal_opt properties_opt RBRA ;

properties:
  map-literal
  | PARAM ;

rel-type-union:
  COLON schema-name
  | rel-type-union PIPE COLON schema-name ;

node-label-list:
  COLON schema-name { $$ = [$1]; }
  | node-label-list COLON schema-name { $$ = $1; $$.push($2); } ;

range-literal:
  STAR int-literal_opt
  | STAR int-literal_opt DBLDOT int-literal_opt ;

arrow-right:
  RARROW
  | GT ;

arrow-body:
  MINUS
  | DASH ;

// expressions

property-expr:
  atom property-lookup-list ;

property-lookup-list:
  property-lookup { $$ = [$1]; }
  | property-lookup-list property-lookup { $$ = $1; $$.push($2); } ;

expression:
  or-expression ;

or-expression:
  xor-expression
  | or-expression OR xor-expression ;

xor-expression:
  and-expression
  | xor-expression XOR and-expression ;

and-expression:
  not-expression
  | and-expression AND not-expression ;

not-expression:
  comparison-expression
  | NOT not-expression ;

comparison-expression:
  string-list-null-predicate-expression
  | comparison-expression compop string-list-null-predicate-expression ;

compop:
  EQ
  | NEQ
  | LT
  | GT
  | LTE
  | GTE ;

string-list-null-predicate-expression:
  additive-expression
  | string-list-null-predicate-expression IS NULL
  | string-list-null-predicate-expression IS NOT NULL
  | string-list-null-predicate-expression CONTAINS additive-expression
  | string-list-null-predicate-expression STARTS WITH additive-expression
  | string-list-null-predicate-expression ENDS WITH additive-expression
  | string-list-null-predicate-expression IN additive-expression ;

additive-expression:
  multiplicative-expression
  | additive-expression PLUS multiplicative-expression
  | additive-expression MINUS multiplicative-expression ;

multiplicative-expression:
  power-expression
  | multiplicative-expression STAR power-expression
  | multiplicative-expression SLASH power-expression
  | multiplicative-expression PERCENT power-expression ;

power-expression:
  unary-expression
  | power-expression EXP unary-expression ;

unary-expression:
  non-arithmetic-op-expression
  | PLUS unary-expression
  | MINUS unary-expression ;

non-arithmetic-op-expression:
  label-filter-expression
  | non-arithmetic-op-expression LBRA expression RBRA
  | non-arithmetic-op-expression LBRA expression DBLDOT expression RBRA
  | non-arithmetic-op-expression property-lookup ;

property-lookup:
  DOT schema-name ;

label-filter-expression:
  atom
  | atom node-label-list ;

atom:
  atom-no-pattern
  | variable %prec PAREN_EXPR_PRIORITY
  | PARAM
  | map-literal ;

atom-no-pattern:
  literal
  | case-expression
  | COUNT LPAR STAR RPAR
  | list-comprehension
  | pattern-comprehension
  | quantified-expression
  | function-invocation
  | existential-subquery
  | pattern-el-chain
  | LANGSWITCH { $$ = yy.messageQueue.shift(); }
  | LPAR expression RPAR ;

case-expression:
  CASE case-expr-alternative-list else-clause_opt END
  | CASE expression case-expr-alternative-list else-clause_opt END ;

case-expr-alternative-list:
  case-expr-alternative { $$ = [$1]; }
  | case-expr-alternative-list case-expr-alternative { $$ = $1; $$.push($2); } ;

case-expr-alternative:
  WHEN expression THEN expression ;

list-comprehension:
  LBRA variable IN expression where-clause RBRA
  | LBRA variable IN expression where-clause_opt PIPE expression RBRA ;

pattern-comprehension:
  LBRA pattern-el-chain where-clause_opt PIPE expression RBRA
  | LBRA variable EQ pattern-el-chain where-clause_opt PIPE expression RBRA %prec COMPR_PRIORITY ;

quantified-expression:
  quantifier LPAR variable IN expression where-clause_opt RPAR ;

quantifier:
  ANY
  | ALL
  | NONE
  | SINGLE ;

function-invocation:
  symbolic-name LPAR distinct_opt expression-list RPAR { $$ = yy.wrapFn($1, $4, $3); }
  | SCHEMANAMELPAR distinct_opt expression-list RPAR { $$ = yy.wrapFn(new yy.ast.ASTIdentifier($1.slice(0, -1)), $3, $2); } ;

existential-subquery:
  EXISTS LCUR regular-query RCUR
  | EXISTS LCUR pattern where-clause_opt RCUR ;

explicit-procedure-invocation:
  symbolic-name LPAR distinct_opt expression-list RPAR { $$ = yy.wrapFn($1, $4, $3); }
  SCHEMANAMELPAR distinct_opt expression-list RPAR { $$ = yy.wrapFn(new yy.ast.ASTIdentifier($1.slice(0, -1)), $3, $2); } ;

implicit-procedure-invocation:
  | symbolic-name { $$ = yy.wrapFn($1); }
  symbolic-name DOT symbolic-name {
    $$ = yy.wrapFn(new yy.ast.ASTIdentifier($1.idOriginal, $2.idOriginal));
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
  schema-name COLON expression { $$ = [$1]; }
  | map-entry-list COMMA schema-name COLON expression { $$ = $1; $$.push($3); } ;

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
  | reserved-word { $$ = new yy.ast.ASTIdentifier($1); } ;

symbolic-name:
  ID { $$ = new yy.ast.ASTIdentifier($1); } ;

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
  | DISTINCT ;

order-clause_opt:
  | order-clause ;

skip-clause_opt:
  | skip-clause ;

limit-clause_opt:
  | limit-clause ;

variable_opt:
  | variable ;

node-label-list_opt:
  %prec PAREN_EXPR_PRIORITY
  | node-label-list %prec NODE_PATTERN_PRIORITY ;

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