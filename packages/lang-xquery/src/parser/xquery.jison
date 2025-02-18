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
%token KW_EQ
%token KW_NEQ
%token KW_LT
%token KW_LTE
%token KW_GT
%token KW_GTE
%token IS
%token UNION
%token EXCEPT
%token INTERSECT
%token EMPTYSEQ
%token ITEM
%token PROC_INSTR
%token SCHEMA_ATTRIBUTE
%token FUNCTION
%token DOCUMENT

%token COMMA
%token SLASH
%token DBLSLASH
%token DOT
%token DOLLAR
%token LPAR
%token RPAR
%token LBRA
%token RBRA
%token LCUR
%token RCUR
%token COLONEQ
%token DBLCOLON
%token MINUS
%token EQ
%token NEQ
%token GT
%token GTE
%token LTE
%token SHIFTR
%token SHIFTL
%token PIPE
%token DBLPIPE
%token QUESTION
%token EMPH
%token AT_SIGN
%token NUMBER
%token STRING
%token QNAME
%token QNAME_WILDCARD
%token NCNAME
%token DIREL_SELFEND
%token WS
%token DIRCOMMENT_START
%token DIRCOMMENT_END
%token DIRPI_START
%token DIRPI_END
%token ATTR_CONTENT
%token EMPTY_ATTR
%token COMMENT_CONTENT
%token PI_CONTENT
%token DIREL_CONTENT
%token LANGSWITCH
%token LANGEXIT

// see https://www.w3.org/TR/2014/REC-xquery-30-20140408/#extra-grammatical-constraints - the grammar from the spec itself is hacky
%left SEQUENCE_TYPE_PRIORITY
%left BINOP_PRIORITY
%left PATH_START_PRIORITY
%left LONE_SLASH_PRIORITY
%left PLUS
%left STAR // these operators need to have some precedence defined in order for other priorities to work
%nonassoc LT

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
	prolog querybody { $$ = new yy.ast.Module($1, $2); } ;
	
prolog:
	declaration-list_opt { $$ = new yy.ast.Prolog($1); } ;

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
	| if-expr
	| or-expr ;

flwor-expr:
	flwor-initial flwor-body flwor-return { $2.unshift($1); $2.push($3); $$ = new yy.ast.FLWORExpr($2); }
	| flwor-initial flwor-return { $$ = new yy.ast.FLWORExpr([$1, $2]); } ;

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

groupby-binding-list:
	groupby-binding { $$ = [$1]; }
	| groupby-binding-list COMMA groupby-binding { $$ = $1; $$.push($3); } ;

groupby-binding:
	let-binding
	| variable { $$ = [$1, $1]; } ;

groupby-clause:
	GROUPBY groupby-binding-list { $$ = new yy.ast.FLWORGroupBy($2); } ;

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
	SWITCH par-expr switch-case-list DEFAULT RETURN expr { $$ = new yy.ast.SwitchExpr($2, $3, $6); } ;

switch-case-list:
	switch-case { $$ = [$1]; }
	| switch-case-list switch-case { $$ = $1; $$.push($2); } ;

switch-case:
	case-list RETURN expr { $$ = [$1, $3]; } ;

case-list:
	CASE expr { $$ = [$2]; }
	| case-list CASE expr { $$ = $1; $$.push($3); } ;

if-expr:
	IF par-expr THEN expr ELSE expr { $$ = new yy.ast.IfExpr($2, $4, $6); } ;

// expression

keyword:
	WINDOW
	| WHERE
	| WHEN
	| UNORDERED
	| UNION
	| TUMBLING
	| TO
	| THEN
	| TEXT
	| SWITCH
	| START
	| STABLE
	| SOME
	| SLIDING
	| SELF
	| SCHEMA_ELEMENT
	| SCHEMA_ATTRIBUTE
	| SATISFIES
	| RETURN
	| PROC_INSTR
	| PREVIOUS
	| PRECEDING_SIBLING
	| PRECEDING
	| PARENT
	| ORDERING
	| ORDERED
	| ORDERBY
	| ORDER
	| OR
	| ONLY
	| NODE
	| NEXT
	| KW_NEQ
	| NAMESPACENODE
	| NAMESPACE
	| MOD
	| KW_LT
	| LET
	| LEAST
	| KW_LTE
	| ITEM
	| IS
	| INTERSECT
	| INSTANCEOF
	| IN
	| IF
	| IDIV
	| KW_GT
	| GROUPBY
	| GREATEST
	| KW_GTE
	| FUNCTION
	| FOR
	| FOLLOWING_SIBLING
	| FOLLOWING
	| EXCEPT
	| EVERY
	| KW_EQ
	| END
	| EMPTYSEQ
	| EMPTY
	| ELSE
	| ELEMENT
	| DOCUMENT_NODE
	| DOCUMENT
	| DIV
	| DESCENDING
	| DESCENDANT_OR_SELF
	| DESCENDANT
	| DEFAULT
	| DECLARE
	| COUNT
	| COMMENT
	| CHILD
	| CAST
	| CASE
	| BASEURI
	| ATTRIBUTE
	| AT
	| ASCENDING
	| AS
	| AND
	| ANCESTOR_OR_SELF
	| ANCESTOR
	| ALLOWING ;

string-literal:
	STRING { $$ = new yy.ast.ASTStringLiteral($1); } ;

number-literal:
	NUMBER { $$ = new yy.ast.ASTNumberLiteral($1); } ;

variable:
	DOLLAR name { $$ = new yy.ast.ASTVariable($2); } ;

name:
	QNAME { $$ = new yy.ast.XQueryIdentifier($1); }
	| NCNAME { $$ = new yy.ast.XQueryIdentifier($1); } ;

par-expr:
	LPAR nested-lang RPAR { $$ = $2; }
	| LPAR expr RPAR { $$ = $2; } ;

cur-expr:
	LCUR nested-lang RCUR { $$ = $2; }
	| LCUR expr-list RCUR { $$ = $2; } ;

cur-opt-expr:
	LCUR nested-lang RCUR { $$ = $2; }
	| LCUR expr-list_opt RCUR { $$ = $2; } ;

occurence:
	STAR
	| PLUS
	| QUESTION ;

item-type:
	kind-test
	| ITEM LPAR RPAR { $$ = new yy.ast.ASTItemType($1); }
	| FUNCTION LPAR STAR RPAR { $$ = new yy.ast.ASTItemType($1, $3); }
	| name { $$ = new yy.ast.ASTItemType(null, $1); }
	| LPAR item-type RPAR { $$ = $2; } ;

kind-test:
	document-test
	| element-test
	| attribute-test
	| SCHEMA_ELEMENT LPAR name RPAR { $$ = new yy.ast.ASTItemType($1, $3); }
	| SCHEMA_ATTRIBUTE LPAR name RPAR { $$ = new yy.ast.ASTItemType($1, $3); }
	| pi-test
	| COMMENT LPAR RPAR { $$ = new yy.ast.ASTItemType($1); }
	| TEXT LPAR RPAR { $$ = new yy.ast.ASTItemType($1); }
	| NAMESPACENODE LPAR RPAR { $$ = new yy.ast.ASTItemType($1); }
	| NODE LPAR RPAR { $$ = new yy.ast.ASTItemType($1); } ;

document-test:
	DOCUMENT_NODE LPAR RPAR { $$ = new yy.ast.ASTItemType($1); }
	| DOCUMENT_NODE LPAR element-test RPAR { $$ = new yy.ast.ASTItemType(yy.ast.ItemKind.documentElement, $3.name); }
	| DOCUMENT_NODE LPAR SCHEMA_ELEMENT LPAR name RPAR RPAR { $$ = new yy.ast.ASTItemType(yy.ast.ItemKind.documentSchemaElement, $3.name); } ;

name-or-star:
	name
	| STAR ;

element-test:
	ELEMENT LPAR RPAR { $$ = new yy.ast.ASTItemType($1); }
	| ELEMENT LPAR name-or-star RPAR { $$ = new yy.ast.ASTItemType($1, $3); };

attribute-test:
	ATTRIBUTE LPAR RPAR { $$ = new yy.ast.ASTItemType($1); }
	| ATTRIBUTE LPAR name-or-star RPAR { $$ = new yy.ast.ASTItemType($1, $3); };

pi-test:
	PROC_INSTR LPAR RPAR { $$ = new yy.ast.ASTItemType($1); }
	| PROC_INSTR LPAR name RPAR { $$ = new yy.ast.ASTItemType($1, $3); }
	| PROC_INSTR LPAR string-literal RPAR { $$ = new yy.ast.ASTItemType($1, $3); };

sequence-type:
	EMPTYSEQ LPAR RPAR { $$ = new yy.ast.ASTSequenceType(); }
	| item-type %prec BINOP_PRIORITY { $$ = new yy.ast.ASTSequenceType($1); }
	| item-type occurence %prec SEQUENCE_TYPE_PRIORITY { $$ = new yy.ast.ASTSequenceType($1, $2); } ;

ordered-expr:
	ORDERED cur-expr { $$ = new yy.ast.OrderedExpr($2, true); }
	| UNORDERED cur-expr { $$ = new yy.ast.OrderedExpr($2, false); } ;

direct-constructor:
	dir-elem-constr-meta dir-elem-constr { $$ = $2; }
  | dir-comment-constr-meta dir-comment-constr { $$ = $2; }
	| dir-pi-constr-meta dir-pi-constr { $$ = $2; } ;

dir-comment-constr:
	DIRCOMMENT_START COMMENT_CONTENT DIRCOMMENT_END { $$ = new yy.ast.DirectCommentConstructor($2); } ;

dir-pi-constr:
	DIRPI_START WS_opt PI_CONTENT WS_opt DIRPI_END { $$ = new yy.ast.DirectPIConstructor($3); }
	| DIRPI_START WS_opt PI_CONTENT WS_opt PI_CONTENT WS_opt DIRPI_END { $$ = new yy.ast.DirectPIConstructor($3, $5); } ;

dir-elem-constr:
	LT name dir-elem-attr-list_opt DIREL_SELFEND { $$ = new yy.ast.DirectElementConstructor($2, $3); }
	| LT name dir-elem-attr-list_opt dir-elem-constr-end {
		if (!$4[1].equals($2)) throw new Error('Unexpected closing tag: "' + $4[1].original + '"');
		$$ = new yy.ast.DirectElementConstructor($2, $3, $4[0]);
	} ;

dir-elem-constr-end:
	GT dir-elem-content_opt name GT { $$ = [$2, $3]; } ; /* DIREL_END token is consumed by the lexer */

dir-elem-content:
	dir-elem-content-part { $$ = [$1]; }
	| dir-elem-content dir-elem-content-part { $$ = $1; $$.push($2); } ;

dir-elem-content-part:
	DIREL_CONTENT
	| direct-constructor
	| cur-expr { $$ = $1; } ;

dir-elem-attr-list:
	WS dir-elem-attr { $$ = [$2]; }
	| dir-elem-attr-list WS dir-elem-attr { $$ = $1; $$.push($3); } ;

dir-elem-attr:
	name WS_opt EQ WS_opt dir-attr-content { $$ = [$1, new yy.ast.DirConstrContent($5)]; } ;

dir-attr-content:
	dir-attr-content-part { $$ = $1 === '' ? [] : [$1]; }
	| dir-attr-content dir-attr-content-part { $$ = $1; $$.push($2); } ;

dir-attr-content-part:
	ATTR_CONTENT
	| EMPTY_ATTR { $$ = ''; }
	| cur-expr { $$ = $1; } ;

/* this rule only serves to switch lexer state and retry */
dir-elem-constr-meta:
	LT NCNAME { console.log('matched ncname', $2); yy.lexer.pushState('dirconstr'); yy.lexer.unput('<' + $2); }
	| LT keyword { console.log('matched keyword', $2); yy.lexer.pushState('dirconstr'); yy.lexer.unput('<' + $2); }
	| LT QNAME { console.log('matched qname', $2); yy.lexer.pushState('dirconstr'); yy.lexer.unput('<' + $2); } ;
dir-comment-constr-meta:
	LT EMPH { yy.lexer.pushState('dirconstr'); yy.lexer.unput('<!'); } ;
dir-pi-constr-meta:
	LT QUESTION { yy.lexer.pushState('dirconstr'); yy.lexer.unput('<?'); } ;

computed-constructor:
	DOCUMENT cur-expr { $$ = new yy.ast.ComputedConstructor($1, $2); }
	| ELEMENT name-or-expr cur-opt-expr { $$ = new yy.ast.ComputedConstructor($1, $3, $2); }
	| ATTRIBUTE name-or-expr cur-opt-expr { $$ = new yy.ast.ComputedConstructor($1, $3, $2); }
	| NAMESPACE NCNAME cur-expr { $$ = new yy.ast.ComputedConstructor($1, $3, new yy.ast.XQueryIdentifier($2)); }
	| NAMESPACE cur-expr cur-expr { $$ = new yy.ast.ComputedConstructor($1, $3, $2); }
	| PROC_INSTR NCNAME cur-expr { $$ = new yy.ast.ComputedConstructor($1, $3, new yy.ast.XQueryIdentifier($2)); }
	| PROC_INSTR cur-expr cur-expr { $$ = new yy.ast.ComputedConstructor($1, $3, $2); }
	| TEXT cur-expr { $$ = new yy.ast.ComputedConstructor($1, $2); }
	| COMMENT cur-expr { $$ = new yy.ast.ComputedConstructor($1, $2); } ;

name-or-expr:
	name
	| cur-expr { $$ = $1; } ;

constructor-expr:
	direct-constructor
	| computed-constructor ;

inline-function-expr:
	FUNCTION LPAR param-list_opt RPAR LCUR expr-list_opt RCUR { $$ = new yy.ast.InlineFunction($3, $6); };

param-list:
	variable { $$ = [$1]; }
	| param-list COMMA variable { $$ = $1; $$.push($3); } ;

nested-lang:
	LANGSWITCH { $$ = new yy.ast.LangSwitch($1, yy.messageQueue.shift()); } ;

primary-expr:
	number-literal
	| string-literal
	| variable
	| LPAR expr-list_opt RPAR { $$ = $2.length === 1 ? $2[0] : new yy.ast.SequenceConstructor($2); }
	| LPAR nested-lang RPAR { $$ = $2; }
	| name LPAR argument-list_opt RPAR {
		if ($3.includes(yy.argPlaceholder)) {
			$$ = new yy.ast.BoundFunction(
				$1,
				$3.map((arg, i) => arg === yy.argPlaceholder ? 0 : [i, arg]).filter(x => x)
			);
		} else {
			$$ = new yy.ast.ASTFunction('xquery', $1, $3);
		}
	}
	| ordered-expr
	|	constructor-expr
	| inline-function-expr
	| DOT { $$ = yy.ast.DOT; } ;

postfix-expr:
	primary-expr
	| postfix-expr predicate { $$ = new yy.ast.FilterExpr($1, $2); }
	| postfix-expr LPAR argument-list_opt RPAR {
		if ($3.includes(yy.argPlaceholder)) {
			$$ = new yy.ast.BoundFunction(
				$1,
				$3.map((arg, i) => arg === yy.argPlaceholder ? 0 : [i, arg]).filter(x => x)
			);
		} else {
			$$ = new yy.ast.DynamicFunctionCall($1, $3);
		}
	} ;

argument-list:
	argument { $$ = [$1]; }
	| argument-list COMMA argument { $$ = $1; $$.push($3); } ;

argument:
	expr
	| QUESTION { $$ = yy.argPlaceholder; } ;

path-expr:
	relative-path-expr {
		if ($1.length === 1 && !($1[0] instanceof yy.ast.PathAxis)) {
			$$ = $1[0];
		} else {
			$$ = new yy.ast.PathExpr($1);
		}
	}
	| SLASH %prec LONE_SLASH_PRIORITY { $$ = new yy.ast.PathExpr([], $1); }
	| SLASH relative-path-expr %prec PATH_START_PRIORITY { $$ = new yy.ast.PathExpr($2, $1); }
	| DBLSLASH relative-path-expr { $$ = new yy.ast.PathExpr($2, $1); } ;

relative-path-expr:
	step-expr { $$ = [$1]; }
	| relative-path-expr SLASH step-expr { $$ = $1; $$.push($3); }
	| relative-path-expr DBLSLASH step-expr {
		$$ = $1;
		$$.push(
			new yy.ast.PathAxis(
				yy.ast.AxisType.DESCENDANT_OR_SELF,
				new yy.ast.ASTItemType(yy.ast.ItemKind.NODE)
			), $3);
	} ;

step-expr:
	postfix-expr
	| predicate-step ;

predicate-step:
	axis-step predicate-list { $$ = $1; $$.predicates = $2; } ;

axis-step:
	axis-keyword DBLCOLON node-test { $$ = new yy.ast.PathAxis($1, $3); }
	| node-test { $$ = new yy.ast.PathAxis(yy.ast.AxisType.CHILD, $1); }
	| DOT DOT { $$ = new yy.ast.PathAxis(yy.ast.AxisType.PARENT, new yy.ast.ASTItemType(yy.ast.ItemKind.NODE)); }
	| AT_SIGN node-test { $$ = new yy.ast.PathAxis(yy.ast.AxisType.ATTRIBUTE, $2); } ;

node-test:
	kind-test
	| name-or-star { $$ = new yy.ast.ASTItemType(null, $1); }
	| QNAME_WILDCARD { $$ = new yy.ast.ASTItemType(null, new yy.ast.XQueryIdentifier($1)); } ;

axis-keyword:
	CHILD
	| DESCENDANT
	| ATTRIBUTE
	| SELF
	| DESCENDANT_OR_SELF
	| ANCESTOR
	| FOLLOWING_SIBLING
	| FOLLOWING
	| PARENT
	| PRECEDING_SIBLING
	| PRECEDING
	| ANCESTOR_OR_SELF ;

predicate-list:
	{ $$ = []; }
	| predicate-list predicate { $$ = $1; $$.push($2); } ;

predicate:
	LBRA expr-list RBRA { $$ = new yy.ast.PathPredicate($2); } ;

simple-map-expr:
	path-expr
	| simple-map-expr EMPH path-expr { $$ = yy.makeOp($2, [$1, $3]); } ;

value-expr:
	simple-map-expr ;

unary-expr:
	value-expr
	| additive-op unary-expr { $$ = new yy.makeOp($1, [$2]); } ;

cast-expr:
	unary-expr
	| cast-expr CAST AS name { $$ = new yy.ast.CastExpr($1, $4); } ;

instanceof-expr:
	cast-expr
	| instanceof-expr INSTANCEOF sequence-type { $$ = new yy.ast.InstanceOfExpr($1, $3); } ;

intersect-op:
	INTERSECT
	| EXCEPT ;

intersect-expr:
	instanceof-expr
	| intersect-expr intersect-op instanceof-expr { $$ = yy.makeOp($2, [$1, $3]); } ;


union-op:
	PIPE
	| UNION ;

union-expr:
	intersect-expr
	| union-expr union-op intersect-expr { $$ = yy.makeOp("|", [$1, $3]); } ;

mult-op:
	STAR
	| DIV
	| IDIV
	| MOD ;

multiplicative-expr:
	union-expr
	| multiplicative-expr mult-op union-expr { $$ = yy.makeOp($2, [$1, $3]); } ;

additive-op:
	PLUS
	| MINUS ;

additive-expr:
	multiplicative-expr
	| additive-expr additive-op multiplicative-expr { $$ = yy.makeOp($2, [$1, $3]); } ;

range-expr:
	additive-expr
	| range-expr TO additive-expr { $$ = yy.makeOp($2, [$1, $3]); } ;

str-concat-expr:
	range-expr
	| str-concat-expr DBLPIPE range-expr { $$ = yy.makeOp($2, [$1, $3]); } ;

comparison-expr:
	str-concat-expr
	| comparison-expr comparison-op str-concat-expr { $$ = yy.makeOp($2, [$1, $3]); } ;

comparison-op:
	EQ | NEQ | GT | GTE | LT | LTE | KW_EQ | KW_NEQ | KW_GT | KW_GTE | KW_LT | KW_LTE | IS | SHIFTL | SHIFTR ;

and-expr:
	comparison-expr
	| and-expr AND comparison-expr { $$ = yy.makeOp($2, [$1, $3]); } ;

or-expr:
	and-expr
	| or-expr OR and-expr { $$ = yy.makeOp($2, [$1, $3]); } ;


// optionals

window-end_opt:
	| window-end ;

variable-opt:
	| variable ;

stable_opt:
	| STABLE ;

empty-order_opt:
	| empty-order ;

occurence_opt:
	| occurence ;

question_opt:
	| QUESTION ;

argument-list_opt:
	| argument-list ;

relative-path-expr_opt:
	{ $$ = []; }
	| relative-path-expr ;

expr-list_opt:
	{ $$ = []; }
	| expr-list ;

WS_opt:
	| WS ;

dir-elem-attr-list_opt:
	WS_opt { $$ = []; }
	| dir-elem-attr-list ;

dir-elem-content_opt:
	| dir-elem-content ;

declaration-list_opt:
	{ $$ = []; }
	| declaration-list ;

param-list_opt:
	{ $$ = []; }
	| param-list ;