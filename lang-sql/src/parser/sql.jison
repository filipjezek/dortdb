%start root

%token SELECT
%token ALL
%token DISTINCT
%token AS
%token FROM
%token WHERE
%token GROUPBY
%token ROLLUP
%token CUBE
%token GROUPINGSETS
%token HAVING
%token UNION
%token INTERSECT
%token EXCEPT
%token ORDERBY
%token LIMIT
%token OFFSET
%token JOIN
%token INNER
%token LEFT
%token RIGHT
%token FULL
%token OUTER
%token ON
%token CROSS
%token NATURAL
%token USING
%token AND
%token OR
%token NOT
%token IS
%token NULL
%token TRUE
%token FALSE
%token BETWEEN
%token IN
%token LIKE
%token ILIKE
%token CAST
%token OPERATOR
%token ASC
%token DESC
%token ARRAY
%token ANY

%token NUMBER
%token STRING
%token ID
%token PARAM
%token COMMA
%token DOT
%token DOTSTAR
%token LPAR
%token RPAR
%token LBRA
%token RBRA
%token RCUR
%token CLOSEDBRAS
%token SEMICOLON
%token COLON
%token DBLCOLON
%token PLUS
%token MINUS
%token STAR
%token DIV
%token MOD
%token EXP
%token EQ
%token NEQ
%token GT
%token GTE
%token LT
%token LTE
%token USEROP
%token LANGSWITCH
%token LANGEXIT

%%

// statements

scope-exit:
	RBRA { yy.lexer.unput($1); }
	| RPAR { yy.lexer.unput($1); }
	| RCUR { yy.lexer.unput($1); }
	| LANGEXIT ;

root:
	scope-exit { return {}; }
  | statement semicolon_opt
  | statement SEMICOLON root ;

statement:
  select-stmt ;

select-stmt:
	select-set-list orderby-clause_opt limit-clause_opt ;

select-set:
	SELECT select-list
	| SELECT select-list FROM table-item
	where-clause_opt groupby-clause_opt having-clause_opt ;

select-set-list:
	select-set
	| select-set-list setop select-set
	| select-set-list setop LPAR subquery RPAR ;

select-list:
	expression alias_opt { return $1; }
	| select-list COMMA expression alias_opt ;

one-table:
	scoped-id table-alias_opt
	| LPAR subquery RPAR table-alias_opt
	| LPAR table-item RPAR table-alias_opt;

table-item:
	one-table
	| table-item join-type one-table join-condition_opt ;

join-type:
	JOIN
	| INNER JOIN
	| LEFT outer_opt JOIN
	| RIGHT outer_opt JOIN
	| FULL outer_opt JOIN
	| CROSS JOIN
	| NATURAL JOIN ;

join-condition:
	ON expression
	| USING LPAR column-list RPAR alias_opt ;

column-list:
	ID
	| column-list COMMA ID ;

where-clause:
	WHERE expression ;

groupby-clause:
	GROUPBY expression
	| GROUPBY expression ROLLUP LPAR expression-list RPAR
	| GROUPBY expression CUBE LPAR expression-list RPAR
	| GROUPBY expression GROUPINGSETS LPAR expression-list_opt-list RPAR ;

having-clause:
	HAVING expression ;

setop:
	UNION
	| INTERSECT
	| EXCEPT ;

orderby-clause:
	ORDERBY expression
	| ORDERBY expression ASC
	| ORDERBY expression DESC
	| orderby-clause COMMA expression
	| orderby-clause COMMA expression ASC
	| orderby-clause COMMA expression DESC ;

limit-clause:
	LIMIT NUMBER
	| OFFSET NUMBER
	| LIMIT NUMBER OFFSET NUMBER ;


// expressions

scoped-id:
	ID { $$ = new yy.ast.ASTIdentifier($1); }
	| ID DOT ID { $$ = new yy.ast.ASTIdentifier($1, $3); } ;

field-selector:
	STAR { $$ = new yy.ast.ASTFieldSelector($1); }
	| scoped-id { $$ = new yy.ast.ASTFieldSelector($1.idOriginal, new yy.ast.ASTIdentifier($1.schemaOriginal)); }
	| ID DOT ID DOT ID { $$ = new yy.ast.ASTFieldSelector($3, new yy.ast.ASTIdentifier($2, $1)); }
	| scoped-id DOTSTAR { $$ = new yy.ast.ASTFieldSelector('*', new yy.ast.ASTIdentifier($1)); } ;

subquery:
	select-stmt
	| LANGSWITCH { $$ = yy.messageQueue.shift(); } ;

boolean-literal:
	TRUE { $$ = new yy.ast.ASTLiteral($1, true); }
	| FALSE { $$ = new yy.ast.ASTLiteral($1, false); }
	| NULL { $$ = new yy.ast.ASTLiteral($1, null); } ;

primary-expression:
	field-selector
	| PARAM { $$ = new yy.ast.ASTParam($1); }
	| NUMBER { $$ = new yy.ast.ASTNumberLiteral($1); }
	| STRING { $$ = new yy.ast.ASTStringLiteral($1); }
	| ID STRING { $$ = new yy.ast.ASTCast(new yy.ast.ASTStringLiteral($2), $1); }
	| boolean-literal
	| LPAR expression RPAR { $$ = $2; }
	| scoped-id LPAR expression-list_opt RPAR { 
		$$ = new yy.ast.ASTFunction('sql', $1, $3);
	}
	| scoped-id LPAR subquery RPAR { $$ = new yy.ast.ASTFunction('sql', $1, [$3]); }
	| LPAR subquery RPAR { $$ = $2; }
	| ARRAY LBRA expression-list_opt RBRA { $$ = new yy.ast.ASTArray($3); };

expression-list:
	expression { $$ = [$1]; }
	| expression-list COMMA expression { $$ = $1; $$.push($3); };

expression-list_opt-list:
	LPAR expression-list_opt RPAR { $$ = [$2]; }
	| expression-list_opt-list COMMA LPAR expression-list_opt RPAR { $$ = $1; $$.push($4); };

cast-expression:
	primary-expression
	| CAST LPAR expression AS ID braces_opt RPAR { $$ = new yy.ast.ASTCast($3, $5, !!$6); }
	| primary-expression DBLCOLON ID braces_opt { $$ = new yy.ast.ASTCast($1, $3, !!$4); } ;

subscript-expression:
	cast-expression
	| subscript-expression LBRA expression RBRA { $$ = new yy.ast.ASTSubscript($1, $3); }
	| subscript-expression LBRA expression COLON expression RBRA { $$ = new yy.ast.ASTSubscript($1, $3, $5); };

unary-expression:
	subscript-expression
	| unary-operator cast-expression { $$ = yy.makeOp($1, [$2]); } ;

unary-operator:
	PLUS | MINUS ;

exponentiative-expression:
	unary-expression
	| exponentiative-expression EXP cast-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

multiplicative-operator:
	STAR | DIV | MOD ;

multiplicative-expression:
	exponentiative-expression
	| multiplicative-expression multiplicative-operator cast-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

additive-expression:
	multiplicative-expression
	| additive-expression PLUS multiplicative-expression { $$ = yy.makeOp($2, [$1, $3]); }
	| additive-expression MINUS multiplicative-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

userop-expression:
	additive-expression
	| userop-expression USEROP additive-expression { $$ = yy.makeOp($2, [$1, $3]); }
	| userop-expression OPERATOR LPAR scoped-id RPAR additive-expression { $$ = yy.makeOp($4, [$1, $6]); } ;

string-set-range-expression:
	userop-expression
	| userop-expression not_opt BETWEEN userop-expression AND userop-expression { $$ = yy.wrapNot(yy.makeOp($3, [$1, $4, $6]), $2); }
	| userop-expression not_opt IN LPAR expression-list RPAR { $$ = yy.wrapNot(yy.makeOp($3, [$1, $5]), $2); }
	| userop-expression not_opt IN LPAR subquery RPAR { $$ = yy.wrapNot(yy.makeOp($3, [$1, $5]), $2); }
	| userop-expression not_opt LIKE userop-expression { $$ = yy.wrapNot(yy.makeOp($3, [$1, $4]), $2); }
	| userop-expression not_opt ILIKE userop-expression { $$ = yy.wrapNot(yy.makeOp($3, [$1, $4]), $2); } ;

relational-operator:
	LT | GT | LTE | GTE | EQ | NEQ ;

relational-expression:
	string-set-range-expression
	| relational-expression relational-operator additive-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

is-expression:
	relational-expression
	| relational-expression IS not_opt boolean-literal { $$ = yy.wrapNot(yy.makeOp($2, [$1, $4]), $3); }
	| relational-expression IS not_opt DISTINCT FROM relational-expression { $$ = yy.wrapNot(yy.makeOp('DISTINCT FROM', [$1, $6]), $3); } ;

logical-NOT-expression:
	is-expression
	| NOT is-expression { $$ = yy.wrapNot($2, $1); } ;

logical-AND-expression:
	logical-NOT-expression
	| logical-AND-expression AND logical-NOT-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

logical-OR-expression:
	logical-AND-expression
	| logical-OR-expression OR logical-AND-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

expression:
	logical-OR-expression ;


// optionals

semicolon_opt:
  | SEMICOLON ;

expression-list_opt:
	| expression-list ;

not_opt:
	| NOT ;

alias_opt:
	| AS ID { $$ = new yy.ast.ASTIdentifier($2); } ;

table-alias_opt:
	| AS ID { $$ = new yy.ast.ASTTableAlias($2); }
	| AS ID LPAR column-list RPAR { $$ = new yy.ast.ASTTableAlias($2, $4); } ;

outer_opt:
	| OUTER ;

join-condition_opt:
	| join-condition ;

where-clause_opt:
	| where-clause ;

groupby-clause_opt:
	| groupby-clause ;

having-clause_opt:
	| having-clause ;

setop_opt:
	| setop ;

orderby-clause_opt:
	| orderby-clause ;

limit-clause_opt:
	| limit-clause ;

braces_opt:
	| CLOSEDBRAS ;