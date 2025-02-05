%start root

%token SELECT
%token ALL
%token DISTINCT
%token AS
%token FROM
%token WHERE
%token GROUP
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
%token LATERAL
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
%token CASE
%token WHEN
%token THEN
%token ELSE
%token END
%token ROW
%token VALUES
%token WITHIN
%token FILTER
%token OVER
%token PARTITION
%token RANGE
%token ROWS
%token GROUPS
%token UNBOUNDED
%token PRECEDING
%token FOLLOWING
%token CURRENT
%token EXCLUDE
%token TIES
%token NOOTHERS
%token WINDOW
%token ORDINALITY
%token WITH
%token RECURSIVE
%token SEARCH
%token BREADTH
%token DEPTH
%token SET
%token BY
%token CYCLE
%token TO
%token DEFAULT
%token MATERIALIZED

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
	values_clause orderby-clause_opt limit-clause_opt { $$ = new yy.ast.SelectStatement($1, $2, $3?.[0], $3?.[1]); }
	| with-clause select-set-list orderby-clause_opt limit-clause_opt { $$ = new yy.ast.SelectStatement($2, $3, $4?.[0], $4?.[1], $1); }
	| select-set-list orderby-clause_opt limit-clause_opt { $$ = new yy.ast.SelectStatement($1, $2, $3?.[0], $3?.[1]); } ;

select-set:
	SELECT distinct-clause_opt select-list { $$ = new yy.ast.SelectSet($3); }
	| SELECT distinct-clause_opt select-list FROM table-item
	where-clause_opt groupby-clause_opt having-clause_opt window-clause_opt {
		$$ = new yy.ast.SelectSet($3, $5, $6, $7, $8, $2, $9);
	} ;

select-set-list:
	select-set
	| select-set setop all_opt LPAR subquery RPAR { $$ = $1; $1.setOp = new yy.ast.SelectSetOp(yy.allFrom($5), !$3, $2); }
	| LPAR subquery RPAR setop all_opt LPAR subquery RPAR { $$ = yy.allFrom($2); $$.setOp = new yy.ast.SelectSetOp(yy.allFrom($7), !$5, $4); }
	| select-set setop all_opt select-set-list { $$ = $1; $1.setOp = new yy.ast.SelectSetOp($4, !$3, $2); }
	| LPAR subquery RPAR setop all_opt select-set-list { $$ = yy.allFrom($2); $$.setOp = new yy.ast.SelectSetOp($6, !$5, $4); } ;

distinct-or-all:
	ALL
	| DISTINCT ;

select-list:
	expression alias_opt { $$ = [$2 ? new yy.ast.ASTExpressionAlias($1, $2) : $1]; }
	| select-list COMMA expression alias_opt { $$ = $1; $$.push($4 ? new yy.ast.ASTExpressionAlias($3, $4) : $3); } ;

one-table:
	scoped-id table-alias_opt { if ($2) {$2.table = $1; $$ = $2;} else { $$ = $1; } }
	| LPAR subquery RPAR table-alias { $4.table = $2; $$ = $4; }
	| table-function-call ;

table-function-call:
	simple-function-call table-alias { $$ = $2; $2.table = new yy.ast.TableFn($1.id, $1.args); }
	| simple-function-call WITH ORDINALITY table-alias {
		$$ = $4; $4.table = new yy.ast.TableFn($1.id, $1.args, true);
	}
	| ROWS FROM LPAR simple-function-call-list RPAR with-ordinality_opt table-alias {
		$$ = $7; $7.table = new yy.ast.RowsFrom($4, $6);
	} ;

with-clause:
	WITH recursive_opt with-query-cycle-list {
		$$ = $3;
		for (const q of $$) {
			q.recursive = $2;
		}
	} ;

with-query-name:
	ID AS materialized_opt LPAR statement RPAR { $$ = new yy.ast.WithQuery(new yy.ast.SQLIdentifier($1), [], $5, $3); }
	| ID LPAR column-list RPAR AS materialized_opt LPAR statement RPAR { $$ = new yy.ast.WithQuery(new yy.ast.SQLIdentifier($1), $3, $8, $6); } ;

with-query-search:
	with-query-name
	| with-query-name SEARCH with-search-type FIRST BY column-list SET ID {
		$$ = $1;
		$$.searchType = $3;
		$$.searchCols = $6;
		$$.searchName = new yy.ast.SQLIdentifier($8);
	};

with-query-cycle:
	with-query-search
	| with-query-search CYCLE column-list SET ID USING ID {
		$$ = $1;
		$$.cycleCols = $3;
		$$.cycleMarkName = new yy.ast.SQLIdentifier($5);
		$$.cyclePathName = new yy.ast.SQLIdentifier($7);
	}
	| with-query-search CYCLE column-list SET ID TO expression DEFAULT expression USING ID {
		$$ = $1;
		$$.cycleCols = $3;
		$$.cycleMarkName = new yy.ast.SQLIdentifier($5);
		$$.cyclePathName = new yy.ast.SQLIdentifier($11);
		$$.cycleMarkVal = $7;
		$$.cycleMarkDefault = $9;
	};

with-query-cycle-list:
	with-query-cycle { $$ = [$1]; }
	| with-query-cycle-list COMMA with-query-cycle { $$ = $1; $$.push($3); } ;

with-search-type:
	DEPTH { $$ = 'dfs'; }
	| BREADTH { $$ = 'bfs'; } ;

values_clause:
	VALUES expression-list_opt-list { $$ = new yy.ast.ValuesClause($2); } ;

table-item:
	one-table
	| table-item join-type lateral_opt one-table join-condition_opt { $$ = new yy.ast.JoinClause($1, $4, $2, $5, $3); }
	| table-item CROSS JOIN lateral_opt one-table { $$ = new yy.ast.JoinClause($1, $5, 'cross', undefined, $4); }
	| table-item NATURAL join-type lateral_opt one-table { $$ = new yy.ast.JoinClause($1, $5, $3, undefined, $4); $$.natural = true; } ;

join-type:
	COMMA { $$ = 'cross'; }
	| JOIN { $$ = 'inner'; }
	| INNER JOIN { $$ = 'inner'; }
	| LEFT outer_opt JOIN { $$ = 'left'; }
	| RIGHT outer_opt JOIN { $$ = 'right'; }
	| FULL outer_opt JOIN { $$ = 'full'; } ;

join-condition:
	ON expression { $$ = $2; }
	| USING LPAR column-list RPAR { $$ = $3; } ;

column-list:
	ID { $$ = [new yy.ast.SQLIdentifier($1)]; }
	| column-list COMMA ID { $$ = $1; $$.push(new yy.ast.SQLIdentifier($3)); } ;

where-clause:
	WHERE expression { $$ = $2; } ;

groupby-clause:
	GROUP BY expression-list { $$ = new yy.ast.GroupByClause($3, 'basic'); }
	| GROUP BY ROLLUP LPAR expression-list RPAR { $$ = new yy.ast.GroupByClause($5, $3); }
	| GROUP BY CUBE LPAR expression-list RPAR { $$ = new yy.ast.GroupByClause($5, $3); }
	| GROUP BY GROUPINGSETS LPAR expression-list_opt-list RPAR { $$ = new yy.ast.GroupByClause($5, $3); } ;

window-clause:
	WINDOW window-spec-list { $$ = $2; } ;

window-spec-list:
	ID AS window-spec { $$ = {[$1]: $3}; }
	| window-spec-list COMMA ID AS window-spec { $$ = $1; $$[$3] = $5; } ;

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
	ID { $$ = new yy.ast.SQLIdentifier($1); }
	| ID DOT ID { $$ = new yy.ast.SQLIdentifier($3, $1); } ;

field-selector:
	STAR { $$ = new yy.ast.SQLIdentifier(yy.ast.allAttrs); }
	| scoped-id { $$ = $1; }
	| ID DOT ID DOT ID { $$ = new yy.ast.SQLIdentifier($5, $1, $3); }
	| scoped-id DOTSTAR { $$ = new yy.ast.SQLIdentifier(yy.ast.allAttrs, ...$1.schemasOriginal); } ;

table-alias:
	ID { $$ = new yy.ast.ASTTableAlias($1); }
	| ID LPAR column-list RPAR { $$ = new yy.ast.ASTTableAlias($1, $3); }
	| AS ID { $$ = new yy.ast.ASTTableAlias($2); }
	| AS ID LPAR column-list RPAR { $$ = new yy.ast.ASTTableAlias($2, $4); } ;

subquery:
	select-stmt
	| LANGSWITCH { $$ = new yy.ast.LangSwitch($1, yy.messageQueue.shift()); } ;

query-quantifier:
	ALL
	| ANY ;

quantified-query:
	query-quantifier LPAR subquery RPAR { $$ = new yy.ast.ASTQuantifier($1, $3); }
	| query-quantifier LPAR STRING RPAR { $$ = new yy.ast.ASTQuantifier($1, $3); }
	| query-quantifier LPAR array-constructor RPAR { $$ = new yy.ast.ASTQuantifier($1, $3); } ;

boolean-literal:
	TRUE { $$ = new yy.ast.ASTLiteral($1, true); }
	| FALSE { $$ = new yy.ast.ASTLiteral($1, false); }
	| NULL { $$ = new yy.ast.ASTLiteral($1, null); } ;

array-constructor:
	ARRAY LBRA expression-list_opt RBRA { $$ = new yy.ast.ASTArray($3); }
	| ARRAY LPAR subquery RPAR { $$ = new yy.ast.ASTArray($3); } ;

row-constructor:
	ROW LPAR expression RPAR { $$ = new yy.ast.ASTRow($3); }
	| ROW LPAR RPAR { $$ = new yy.ast.ASTRow([]); }
	| LPAR expression COMMA expression-list RPAR { $$ = new yy.ast.ASTRow($5); $5.unshift($3); }
	| ROW LPAR expression COMMA expression-list RPAR { $$ = new yy.ast.ASTRow($5); $5.unshift($3); } ;

primary-expression:
	field-selector
	| PARAM { $$ = new yy.ast.ASTParam($1); }
	| NUMBER { $$ = new yy.ast.ASTNumberLiteral($1); }
	| STRING { $$ = new yy.ast.ASTStringLiteral($1); }
	| ID STRING { $$ = new yy.ast.ASTCast(new yy.ast.ASTStringLiteral($2), $1); }
	| boolean-literal
	| LPAR expression RPAR { $$ = $2; }
	| LPAR subquery RPAR { $$ = $2; }
	| array-constructor
	| row-constructor
	| case-expression
	| function-call ;

function-call:
	simple-function-call
	| scoped-id LPAR expression-list RPAR filter-clause { $$ = new yy.ast.ASTAggregate($1, $3, undefined, undefined, $5); }
	| scoped-id LPAR expression-list orderby-clause RPAR filter-clause_opt {
		$$ = new yy.ast.ASTAggregate($1, $3, undefined, $4, $6);
	}
	| scoped-id LPAR distinct-or-all expression-list orderby-clause_opt RPAR filter-clause_opt {
		$$ = new yy.ast.ASTAggregate($1, $4, $3, $5, $7);
	}
	| scoped-id LPAR expression-list RPAR WITHIN GROUP LPAR expression-list orderby-clause_opt RPAR filter-clause_opt {
		$$ = new yy.ast.ASTAggregate($1, $3, undefined, $9, $11, $8);
	}
	| scoped-id LPAR RPAR WITHIN GROUP LPAR expression-list orderby-clause_opt RPAR filter-clause_opt {
		$$ = new yy.ast.ASTAggregate($1, [], undefined, $8, $10, $7);
	}
	| scoped-id LPAR RPAR filter-clause_opt OVER window-spec-or-id {
		$$ = new yy.ast.ASTWindowFn($1, [], $6, $4);
	}
	| scoped-id LPAR expression-list RPAR filter-clause_opt OVER window-spec-or-id {
		$$ = new yy.ast.ASTWindowFn($1, $3, $7, $5);
	};

simple-function-call:
	scoped-id LPAR RPAR { $$ = new yy.ast.ASTFunction('sql', $1, []); }
	| scoped-id LPAR subquery RPAR { $$ = new yy.ast.ASTFunction('sql', $1, [$3]); }
	| scoped-id LPAR expression-list RPAR {
		$$ = new yy.ast.ASTFunction('sql', $1, $3);
	} ;

simple-function-call-list:
	simple-function-call { $$ = [$1]; }
	| simple-function-call-list COMMA simple-function-call { $$ = $1; $$.push($3); } ;

filter-clause:
	FILTER LPAR WHERE expression RPAR { $$ = $4; } ;

window-spec-or-id:
	ID
	| window-spec ;

window-spec:
	LPAR ID_opt PARTITION BY expression-list orderby-clause frame-clause_opt RPAR {
		$$ = $7 ? $7 : new yy.ast.WindowSpec();
		$$.columns = $5;
		$$.parent = $2;
		$$.order = $6;
	}
	| LPAR ID_opt PARTITION BY expression-list frame-clause_opt RPAR {
		$$ = $6 ? $6 : new yy.ast.WindowSpec();
		$$.columns = $5;
		$$.parent = $2;
	};

frame-clause:
	frame-mode frame-boundary-start frame-exclusion_opt { $$ = new yy.ast.WindowSpec(undefined, $1, $2, undefined, $3?.slice(7)); }
	| frame-mode BETWEEN frame-boundary-start AND frame-boundary-end frame-exclusion_opt { $$ = new yy.ast.WindowSpec(undefined, $1, $3, $5, $6?.slice(7)); };

frame-mode:
	RANGE
	| ROWS
	| GROUPS ;

frame-boundary-start:
	UNBOUNDED PRECEDING { $$ = new yy.ast.ASTLiteral(null, Infinity); }
	| expression PRECEDING { $$ = $1; }
	| CURRENT ROW { $$ = new yy.ast.ASTLiteral(null, 0); };

frame-boundary-end:
	CURRENT ROW { $$ = new yy.ast.ASTLiteral(null, 0); }
	| expression FOLLOWING { $$ = $1; }
	| UNBOUNDED FOLLOWING { $$ = new yy.ast.ASTLiteral(null, Infinity); };

frame-exclusion:
	EXCLUDE GROUP { $$ = 'group'; }
	| EXCLUDE TIES { $$ = 'ties'; }
	| EXCLUDE NOOTHERS { $$ = 'noothers'; }
	| EXCLUDE CURRENT ROW { $$ = 'currentrow'; } ;

expression-list:
	expression { $$ = [$1]; }
	| expression-list COMMA expression { $$ = $1; $$.push($3); };

expression-list_opt-list:
	LPAR expression-list_opt RPAR { $$ = [$2 ?? []]; }
	| expression-list_opt-list COMMA LPAR expression-list_opt RPAR { $$ = $1; $$.push($4 ?? []);};

cast-or-subscript-expression:
	primary-expression
	| CAST LPAR expression AS ID braces_opt RPAR { $$ = new yy.ast.ASTCast($3, new yy.ast.SQLIdentifier($5), !!$6); }
	| cast-or-subscript-expression DBLCOLON ID braces_opt { $$ = new yy.ast.ASTCast($1, new yy.ast.SQLIdentifier($3), !!$4); }
	| cast-or-subscript-expression LBRA expression RBRA { $$ = new yy.ast.ASTSubscript($1, $3); }
	| cast-or-subscript-expression LBRA expression COLON expression RBRA { $$ = new yy.ast.ASTSubscript($1, $3, $5); };

unary-expression:
	cast-or-subscript-expression
	| unary-operator unary-expression { $$ = yy.makeOp($1, [$2]); } ;

unary-operator:
	PLUS | MINUS ;

exponentiative-expression:
	unary-expression
	| exponentiative-expression EXP unary-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

multiplicative-operator:
	STAR | DIV | MOD ;

multiplicative-expression:
	exponentiative-expression
	| multiplicative-expression multiplicative-operator exponentiative-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

additive-expression:
	multiplicative-expression
	| additive-expression PLUS multiplicative-expression { $$ = yy.makeOp($2, [$1, $3]); }
	| additive-expression MINUS multiplicative-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

additive-or-quantified-expression:
	additive-expression
	| quantified-query ;

userop-expression:
	additive-expression
	| userop-expression USEROP additive-or-quantified-expression { $$ = yy.makeOp($2, [$1, $3]); $3.parentOp = $2; }
	| userop-expression OPERATOR LPAR scoped-id RPAR additive-or-quantified-expression { $$ = yy.makeOp($4, [$1, $6]); $6.parentOp = $4; } ;

userop-or-quantified-expression:
	userop-expression
	| quantified-query ;

string-set-range-expression:
	userop-expression
	| userop-expression not_opt BETWEEN userop-or-quantified-expression AND userop-or-quantified-expression {
		$$ = yy.wrapNot(yy.makeOp($3, [$1, $4, $6]), $2);
		$4.parentOp = '>=';
		$6.parentOp = '<=';
	}
	| userop-expression not_opt IN LPAR expression-list RPAR { $$ = yy.wrapNot(yy.makeOp($3, [$1, $5]), $2); }
	| userop-expression not_opt IN LPAR subquery RPAR { $$ = yy.wrapNot(yy.makeOp($3, [$1, $5]), $2); }
	| userop-expression not_opt LIKE userop-or-quantified-expression { $$ = yy.wrapNot(yy.makeOp($3, [$1, $4]), $2); $4.parentOp = 'LIKE'; }
	| userop-expression not_opt ILIKE userop-or-quantified-expression { $$ = yy.wrapNot(yy.makeOp($3, [$1, $4]), $2); $4.parentOp = 'ILIKE'; } ;

relational-operator:
	LT | GT | LTE | GTE | EQ | NEQ ;

relational-expression:
	string-set-range-expression
	| relational-expression relational-operator userop-or-quantified-expression { $$ = yy.makeOp($2, [$1, $3]); $3.parentOp = $2; } ;

is-expression:
	relational-expression
	| is-expression IS not_opt boolean-literal { $$ = yy.wrapNot(yy.makeOp($2, [$1, $4]), $3); }
	| is-expression IS not_opt DISTINCT FROM relational-expression { $$ = yy.wrapNot(yy.makeOp('DISTINCT FROM', [$1, $6]), $3); }
	| EXISTS LPAR subquery RPAR { $$ = new yy.ast.ASTExists($3); } ;

logical-NOT-expression:
	is-expression
	| NOT logical-NOT-expression { $$ = yy.wrapNot($2, $1); } ;

logical-AND-expression:
	logical-NOT-expression
	| logical-AND-expression AND logical-NOT-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

logical-OR-expression:
	logical-AND-expression
	| logical-OR-expression OR logical-AND-expression { $$ = yy.makeOp($2, [$1, $3]); } ;

expression:
	logical-OR-expression ;

// case

case-expression:
	CASE expression_opt when-list else-expression_opt END { $$ = new yy.ast.ASTCase($2, $3, $4); } ;

when-list:
	WHEN expression THEN expression { $$ = [[$2, $4]]; }
	| when-list WHEN expression THEN expression { $$ = $1; $$.push([$3, $5]); } ;

// optionals

semicolon_opt:
  | SEMICOLON ;

expression-list_opt:
	{ $$ = []; }
	| expression-list ;

not_opt:
	| NOT ;

alias_opt:
	| ID { $$ = $1; }
	| AS ID { $$ = $2; } ;

table-alias_opt:
	| table-alias ;

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

lateral_opt:
	{ $$ = false; }
	| LATERAL { $$ = true; } ;

expression_opt:
	| expression ;

else-expression_opt:
	| ELSE expression { $$ = $2; } ;

filter-clause_opt:
	| filter-clause ;

window-clause_opt:
	| window-clause ;

ID_opt:
	| ID ;

frame-clause_opt:
	| frame-clause ;

frame-exclusion_opt:
	| frame-exclusion ;

with-ordinality_opt:
	| WITH ORDINALITY ;

recursive_opt:
	{ $$ = false; }
	| RECURSIVE { $$ = true; } ;

materialized_opt:
	| NOT MATERIALIZED { $$ = false; }
	| MATERIALIZED { $$ = true; } ;

all_opt:
	| ALL ;
