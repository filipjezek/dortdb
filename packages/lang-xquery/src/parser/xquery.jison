%start root

%token FOR
%token LET
%token WHERE
%token RETURN
%token AS
%token ALLOWING
%token EMPTY
%token AT
%token TUMBLING
%token SLIDING
%token WINDOW
%token START
%token ONLY
%token END
%token PREVIOUS
%token NEXT
%token COUNT
%token GROUPBY
%token STABLE
%token ORDERBY
%token ASCENDING
%token DESCENDING
%token GREATEST
%token LEAST
%token WHEN
%token SWITCH
%token CASE
%token DEFAULT
%token CAST
%token IF
%token THEN
%token ELSE
%token EVERY
%token SOME
%token INSTANCEOF
%token SATISFIES
%token AND
%token OR
%token IN
%token TO
%token DIV
%token IDIV
%token MOD
%token CHILD
%token DESCENDANT
%token PARENT
%token ANCESTOR
%token FOLLOWING_SIBLING
%token PRECEDING_SIBLING
%token FOLLOWING
%token PRECEDING
%token ATTRIBUTE
%token SELF
%token DESCENDANT_OR_SELF
%token ANCESTOR_OR_SELF
%token NODE
%token TEXT
%token COMMENT
%token NAMESPACENODE
%token ELEMENT
%token SCHEMA_ELEMENT
%token DOCUMENT_NODE
%token DECLARE
%token NAMESPACE
%token ORDERED
%token UNORDERED
%token BASEURI
%token ORDERING
%token ORDER

%token COMMA
%token DOT
%token DOLLAR
%token LPAR
%token DBLLPAR
%token RPAR
%token LBRA
%token RBRA
%token RCUR
%token CLOSEDBRAS
%token SEMICOLON
%token COLON
%token COLONEQ
%token DBLCOLON
%token PLUS
%token MINUS
%token STAR
%token EXP
%token EQ
%token NEQ
%token GT
%token GTE
%token LT
%token LTE
%token NUMBER
%token STRING
%token QNAME
%token NCNAME
%token LANGSWITCH
%token LANGEXIT

%%

// statements

scope-exit:
	RBRA
	| RPAR
	| RCUR
	| LANGEXIT ;

root:
	scope-exit { return []; }
	| scope-exit error { return []; }
  | module scope-exit { return $1; }
	| module scope-exit error { return $1; }
  | module { return $1; } ;

module:
	prolog querybody ;
	
prolog:
	declaration-list { $$ = new yy.ast.Prolog($1); } ;

declaration-list:
	declaration { $$ = [$1]; }
	| declaration-list declaration { $$ = $1; $$.push($2); } ;

declaration:
	DECLARE NAMESPACE NCNAME EQ string-literal { $$ = new yy.ast.NSDeclaration($3, $5); }
	| DECLARE DEFAULT ELEMENT NAMESPACE EQ string-literal { $$ = new yy.ast.DefaultNSDeclaration($6, $3); }
	| DECLARE BASEURI string-literal { $$ = new yy.ast.BaseURIDeclaration($3); }
	| DECLARE ORDERING ordering-mode { $$ = new yy.ast.OrderingDeclaration($3); }
	| DECLARE DEFAULT ORDER EMPTY empty-order { $$ = new yy.ast.EmptyOrderDeclaration($5); } ;

empty-order:
	GREATEST { $$ = true; }
	| LEAST { $$ = false; } ;

ordering-mode:
	ORDERED { $$ = true; }
	| UNORDERED { $$ = false; } ;

querybody:
	expr-list ;

expr-list:
	expr { $$ = [$1]; }
	| expr-list COMMA expr { $$ = $1; $$.push($3); } ;

expr:
	flwor-expr
	| quantified-expr
	| switch-expr
	| if-expr ;

flwor-expr:
	flwor-initial flwor-body flwor-return { $2.unshift($1); $2.push($3); $$ = new yy.ast.FLWORExpr($2); } ;

flwor-initial:
	for-clause
	| let-clause
	| window-clause ;

for-clause:
	FOR for-binding-list { $$ = new yy.ast.FLWORFor($2); };

for-binding:
	variable for-allow-empty positional-var IN expr { $$ = new yy.ast.FLWORForBinding($1, $5, $2, $3); } ;

positional-var:
	| AT variable { $$ = $2; } ;

for-allow-empty:
	{ $$ = false; }
	| ALLOWING EMPTY { $$ = true; } ;

for-binding-list:
	for-binding { $$ = [$1]; }
	| for-binding-list COMMA for-binding { $$ = $1; $$.push($3); } ;

let-clause:
	LET let-binding-list { $$ = new yy.ast.FLWORLet($2); } ;

let-binding:
	variable COLONEQ expr { $$ = [$1, $3]; } ;

let-binding-list:
	let-binding { $$ = [$1]; }
	| let-binding-list COMMA let-binding { $$ = $1; $$.push($3); } ;

window-clause:
	FOR SLIDING WINDOW variable IN expr window-start window-end_opt { $$ = new yy.ast.FLWORWindow($2, $4, $6, $7, $8); }
	| FOR TUMBLING WINDOW variable IN expr window-start window-end { $$ = new yy.ast.FLWORWindow($2, $4, $6, $7, $8); } ;

window-start:
	START window-vars WHEN expr { $$ = $2; $$.expr = $4; } ;

window-end:
	ONLY END window-vars WHEN expr { $$ = $3; $$.only = true; $$.expr = $5; }
	| END window-vars WHEN expr { $$ = $2; $$.expr = $4; } ;

window-vars:
	variable-opt positional-var previous-item next-item { $$ = new yy.ast.WindowBoundary($1, $2, $3, $4); };

previous-item:
	| PREVIOUS variable { $$ = $2; } ;

next-item:
	| NEXT variable { $$ = $2; } ;

flwor-body:
	flwor-body-clause { $$ = [$1]; }
	| flwor-body flwor-body-clause { $$ = $1; $$.push($2); } ;

flwor-body-clause:
	flwor-initial
	| where-clause
	| groupby-clause
	| orderby-clause
	| count-clause ;

where-clause:
	WHERE expr { $$ = new yy.ast.FLWORWhere($2); } ;

groupby-clause:
	GROUPBY let-binding-list { $$ = new yy.ast.FLWORGroupBy($2); } ;

orderby-clause:
	stable_opt ORDERBY orderby-list { $$ = new yy.ast.FLWOROrderBy($3, $1); } ;

orderby-direction:
	ASCENDING { $$ = true; }
	| DESCENDING { $$ = false; } ;

orderby-item:
	expr orderby-direction empty-order_opt { $$ = new yy.ast.FLWOROrderByItem($1, $2, $3); } ;

orderby-list:
	orderby-item { $$ = [$1]; }
	| orderby-list COMMA orderby-item { $$ = $1; $$.push($3); } ;

count-clause:
	COUNT variable { $$ = new yy.ast.FLWORCount($2); } ;

flwor-return:
	RETURN expr { $$ = new yy.ast.FLWORReturn($2); } ;

quantifier:
	SOME
	| EVERY ;

quantified-expr:
	quantifier quantifier-binding-list SATISFIES expr { $$ = new yy.ast.QuantifiedExpr($1, $2, $4); } ;

quantifier-binding:
	variable IN expr { $$ = [$1, $3]; } ;

quantifier-binding-list:
	quantifier-binding { $$ = [$1]; }
	| quantifier-binding-list COMMA quantifier-binding { $$ = $1; $$.push($3); } ;

switch-expr:
	SWITCH LPAR expr RPAR switch-case-list DEFAULT RETURN expr { $$ = new yy.ast.SwitchExpr($3, $5, $8); } ;

switch-case-list:
	switch-case { $$ = [$1]; }
	| switch-case-list switch-case { $$ = $1; $$.push($2); } ;

switch-case:
	case-list RETURN expr { $$ = [$2, $4]; } ;

case-list:
	CASE expr { $$ = [$2]; }
	| case-list CASE expr { $$ = $1; $$.push($3); } ;

if-expr:
	IF LPAR expr RPAR THEN expr ELSE expr { $$ = new yy.ast.IfExpr($3, $6, $8); } ;

// expression

string-literal:
	STRING { $$ = new yy.ast.ASTStringLiteral($1); } ;

number-literal:
	NUMBER { $$ = new yy.ast.ASTNumberLiteral($1); } ;

variable:
	DOLLAR name { $$ = new yy.ast.ASTVariable($2); } ;

name:
	QNAME { $$ = new yy.ast.ASTName($1); }
	| NCNAME { $$ = new yy.ast.ASTName($1); } ;


// optionals

window-end_opt:
	| window-end ;

variable-opt:
	| variable ;

stable_opt:
	| STABLE ;

empty-order_opt:
	| empty-order ;