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
%token NULLS
%token FIRST
%token LAST
%token EXISTS

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
	RBRA
	| RPAR
	| RCUR
	| LANGEXIT ;

root:
	scope-exit { return []; }
	| scope-exit error { return []; }
  | statement-list semicolon_opt scope-exit { return $1; }
	| statement-list semicolon_opt scope-exit error { return $1; }
  | statement-list semicolon_opt { return $1; } ;

statement-list:
	statement { $$ = [$1]; }
	| statement-list SEMICOLON statement { $$ = $1; $$.push($2); } ;

statement:
  select-stmt ;

select-stmt:
	select-set-list orderby-clause_opt limit-clause_opt { $$ = new yy.ast.SelectStatement($1, $2, $3?.[0], $3?.[1]); } ;

select-set:
	SELECT distinct-clause_opt select-list { $$ = new yy.ast.SelectSet($3); }
	| SELECT distinct-clause_opt select-list FROM table-item
	where-clause_opt groupby-clause_opt having-clause_opt {
		$$ = new yy.ast.SelectSet($3, $5, $6, $7, $8);
	} ;

select-set-or-subquery:
	select-set
	| LPAR subquery RPAR { $$ = yy.allFrom($2); } ;

select-set-list:
	select-set
	| LPAR subquery RPAR setop select-set-or-subquery {
		$$ = yy.allFrom($2);
		$$.setOp = new yy.ast.SelectSetOp($5, undefined, $4);
	}
	| LPAR subquery RPAR setop-modifier setop select-set-or-subquery {
		$$ = yy.allFrom($2);
		$$.setOp = new yy.ast.SelectSetOp($6, $4, $5);
	}
	| select-set-list setop select-set-or-subquery { $$ = $1; $$.setOp = new yy.ast.SelectSetOp($3, undefined, $2); }
	| select-set-list setop-modifier setop select-set-or-subquery { $$ = $1; $$.setOp = new yy.ast.SelectSetOp($4, $2, $3); } ;

setop-modifier:
	ALL
	| DISTINCT ;

select-list:
	expression alias_opt { $$ = [$2 ? new yy.ast.ASTAlias($1, $2) : $1]; }
	| select-list COMMA expression alias_opt { $$ = $1; $$.push($4 ? new yy.ast.ASTAlias($3, $4) : $3); } ;

one-table:
	scoped-id table-alias_opt { if ($2) {$2.table = $1; $$ = $2;} else { $$ = $1; } }
	| LPAR subquery RPAR table-alias_opt { if ($4) {$4.table = $2; $$ = $4;} else { $$ = $2; } } ;

table-item:
	one-table
	| table-item join-type one-table join-condition_opt { $$ = new yy.ast.JoinClause($3, $2, $4); }
	| table-item CROSS JOIN one-table { $$ = new yy.ast.JoinClause($4, 'cross'); }
	| table-item NATURAL join-type one-table { $$ = new yy.ast.JoinClause($4, $3); $$.natural = true; } ;

join-type:
	COMMA { $$ = 'cross'; }
	| JOIN { $$ = 'inner'; }
	| INNER JOIN { $$ = 'inner'; }
	| LEFT outer_opt JOIN { $$ = 'left'; }
	| RIGHT outer_opt JOIN { $$ = 'right'; }
	| FULL outer_opt JOIN { $$ = 'full'; } ;

join-condition:
	ON expression { $$ = $2; }
	| USING LPAR column-list RPAR table-alias_opt {
		$$ = new yy.ast.ASTUsing($3);
		if ($4) {
			let alias = new yy.ast.ASTAlias($5);
			alias.table = $$;
			$$ = alias;
		}
	} ;

column-list:
	ID { $$ = [new yy.ast.ASTIdentifier($1)]; }
	| column-list COMMA ID { $$ = $1; $$.push(new yy.ast.ASTIdentifier($3)); } ;

where-clause:
	WHERE expression { $$ = $2; } ;

groupby-clause:
	GROUPBY expression-list { $$ = new yy.ast.GroupByClause($2, 'basic'); }
	| GROUPBY ROLLUP LPAR expression-list RPAR { $$ = new yy.ast.GroupByClause($4, 'rollup'); }
	| GROUPBY CUBE LPAR expression-list RPAR { $$ = new yy.ast.GroupByClause($4, 'cube'); }
	| GROUPBY GROUPINGSETS LPAR expression-list_opt-list RPAR { $$ = new yy.ast.GroupByClause($4, 'groupingsets'); } ;

having-clause:
	HAVING expression { $$ = $2; };

distinct-clause:
	DISTINCT { $$ = true; }
	| ALL { $$ = false; }
	| DISTINCT ON LPAR expression-list RPAR { $$ = $4; } ;

setop:
	UNION
	| INTERSECT
	| EXCEPT ;

orderby-order:
	ASC
	| DESC ;

orderby-nulls:
	NULLS FIRST { $$ = true; }
	| NULLS LAST { $$ = false; } ;

orderby-clause:
	ORDERBY expression orderby-order_opt orderby-nulls_opt { $$ = [new yy.ast.OrderByItem($2, $3, $4)]}
	| orderby-clause COMMA expression orderby-order_opt orderby-nulls_opt {
		$$ = $1;
		$$.push(new yy.ast.OrderByItem($3, $4, $5));
	} ;

limit-clause:
	LIMIT expression { $$ = [undefined, $2]; }
	| LIMIT ALL OFFSET expression { $$ = [$4, undefined]; }
	| OFFSET expression { $$ = [$2, undefined]; }
	| LIMIT expression OFFSET expression { $$ = [$4, $2]; } ;


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

query-quantifier:
	ALL
	| ANY ;

quantified-query:
	query-quantifier LPAR subquery RPAR { $$ = new yy.ast.ASTQuantifiedQuery($1, $3); }
	| query-quantifier LPAR STRING RPAR { $$ = new yy.ast.ASTQuantifiedQuery($1, $3); }
	| query-quantifier LPAR array-constructor RPAR { $$ = new yy.ast.ASTQuantifiedQuery($1, $3); } ;

boolean-literal:
	TRUE { $$ = new yy.ast.ASTLiteral($1, true); }
	| FALSE { $$ = new yy.ast.ASTLiteral($1, false); }
	| NULL { $$ = new yy.ast.ASTLiteral($1, null); } ;

array-constructor:
	ARRAY LBRA expression-list_opt RBRA { $$ = new yy.ast.ASTArray($3); } ;

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
	| array-constructor ;

expression-list:
	expression { $$ = [$1]; }
	| expression-list COMMA expression { $$ = $1; $$.push($3); };

expression-list_opt-list:
	LPAR expression-list_opt RPAR { $$ = [$2 ?? []]; }
	| expression-list_opt-list COMMA LPAR expression-list_opt RPAR { $$ = $1; $$.push($4 ?? []);};

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

additive-or-quantified-expression:
	additive-expression
	| quantified-query ;

userop-expression:
	additive-expression
	| userop-expression USEROP additive-or-quantified-expression { $$ = yy.makeOp($2, [$1, $3]); }
	| userop-expression OPERATOR LPAR scoped-id RPAR additive-or-quantified-expression { $$ = yy.makeOp($4, [$1, $6]); } ;

userop-or-quantified-expression:
	userop-expression
	| quantified-query ;

string-set-range-expression:
	userop-expression
	| userop-expression not_opt BETWEEN userop-or-quantified-expression AND userop-or-quantified-expression { $$ = yy.wrapNot(yy.makeOp($3, [$1, $4, $6]), $2); }
	| userop-expression not_opt IN LPAR expression-list RPAR { $$ = yy.wrapNot(yy.makeOp($3, [$1, $5]), $2); }
	| userop-expression not_opt IN LPAR subquery RPAR { $$ = yy.wrapNot(yy.makeOp($3, [$1, $5]), $2); }
	| userop-expression not_opt LIKE userop-or-quantified-expression { $$ = yy.wrapNot(yy.makeOp($3, [$1, $4]), $2); }
	| userop-expression not_opt ILIKE userop-or-quantified-expression { $$ = yy.wrapNot(yy.makeOp($3, [$1, $4]), $2); } ;

relational-operator:
	LT | GT | LTE | GTE | EQ | NEQ ;

relational-expression:
	string-set-range-expression
	| relational-expression relational-operator additive-or-quantified-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

relational-or-quantified-expression:
	relational-expression
	| quantified-query ;

is-expression:
	relational-expression
	| relational-expression IS not_opt boolean-literal { $$ = yy.wrapNot(yy.makeOp($2, [$1, $4]), $3); }
	| relational-expression IS not_opt DISTINCT FROM relational-expression { $$ = yy.wrapNot(yy.makeOp('DISTINCT FROM', [$1, $6]), $3); }
	| EXISTS LPAR subquery RPAR { $$ = new yy.ast.ASTExists($3); } ;

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

orderby-order_opt:
	| orderby-order ;

orderby-nulls_opt:
	| orderby-nulls ;

distinct-clause_opt:
	| distinct-clause ;
