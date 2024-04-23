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
	RBRA { this.lexer.unput($1); }
	| RPAR { this.lexer.unput($1); }
	| RCUR { this.lexer.unput($1); }
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
	expression alias_opt
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
	ID
	| ID DOT ID ;

field-selector:
	STAR
	| scoped-id
	| scoped-id DOTSTAR ;

subquery:
	select-stmt
	| LANGSWITCH ;

primary-expression:
	field-selector
	| PARAM
	| NUMBER
	| STRING
	| ID STRING
	| TRUE
	| FALSE
	| NULL
	| LPAR expression RPAR
	| scoped-id LPAR expression-list_opt RPAR
	| scoped-id LPAR subquery RPAR
	| LPAR subquery RPAR
	| ARRAY LBRA expression-list_opt RBRA ;

expression-list:
	expression
	| expression-list COMMA expression ;

expression-list_opt-list:
	LPAR expression-list_opt RPAR
	| expression-list_opt-list COMMA LPAR expression-list_opt RPAR ;

cast-expression:
	primary-expression
	| CAST LPAR expression AS ID braces_opt RPAR
	| primary-expression DBLCOLON ID braces_opt ;

subscript-expression:
	cast-expression
	| subscript-expression LBRA expression RBRA
	| subscript-expression LBRA expression COLON expression RBRA ;

unary-expression:
	subscript-expression
	| unary-operator cast-expression ;

unary-operator:
	PLUS | MINUS ;

exponentiative-expression:
	unary-expression
	| exponentiative-expression EXP cast-expression ;

multiplicative-expression:
	exponentiative-expression
	| multiplicative-expression STAR cast-expression
	| multiplicative-expression MOD cast-expression
	| multiplicative-expression DIV cast-expression ;

additive-expression:
	multiplicative-expression
	| additive-expression PLUS multiplicative-expression
	| additive-expression MINUS multiplicative-expression ;

userop-expression:
	additive-expression
	| userop-expression USEROP additive-expression
	| userop-expression OPERATOR LPAR scoped-id RPAR additive-expression ;

string-set-range-expression:
	userop-expression
	| userop-expression not_opt BETWEEN userop-expression AND userop-expression
	| userop-expression not_opt IN LPAR expression-list RPAR
	| userop-expression not_opt IN LPAR subquery RPAR
	| userop-expression not_opt LIKE userop-expression
	| userop-expression not_opt ILIKE userop-expression ;

relational-expression:
	string-set-range-expression
	| relational-expression LT additive-expression
	| relational-expression GT additive-expression
	| relational-expression LTE additive-expression
	| relational-expression GTE additive-expression
	| relational-expression EQ additive-expression
	| relational-expression NEQ additive-expression ;

is-expression:
	relational-expression
	| relational-expression IS not_opt NULL
	| relational-expression IS not_opt TRUE
	| relational-expression IS not_opt FALSE
	| relational-expression IS not_opt DISTINCT FROM relational-expression ;

logical-NOT-expression:
	is-expression
	| NOT is-expression ;

logical-AND-expression:
	logical-NOT-expression
	| logical-AND-expression AND logical-NOT-expression ;

logical-OR-expression:
	logical-AND-expression
	| logical-OR-expression OR logical-AND-expression ;

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
	| AS ID ;

table-alias_opt:
	| AS ID
	| AS ID LPAR column-list RPAR ;

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