{{
  const kwNeverIds = [
    'select', 'from', 'where', 'group', 'having', 'order', 'limit', 'offset', 'values', 'with',
    'union', 'intersect', 'except',
    'join', 'inner', 'left', 'right', 'full', 'cross', 'natural',
    'on', 'using',
    'as',
    'distinct', 'all',
    'asc', 'desc',
    'null', 'true', 'false',
    'exists',
    'is',
    'between',
    'in',
    'like', 'ilike',
    'any', 'some', 'all',
    'case', 'when', 'then', 'else', 'end',
  ];
  const notUserOps = [
    '+', '-', '*', '/', '%', '^', '::',
    '=', '<>', '<=', '>=', '!=', '<', '>',
  ];
}}

{
  const ast = options.ast;
}

Root
  = _? res:StatementList (_? ';')? _? !. {
    return { value: res, remainingInput: input.slice(location().end.offset) };
  }
  / _? res:StatementList (_? ';')? _? & ScopeExit {
    return { value: res, remainingInput: input.slice(location().end.offset) };
  }
  / _? res:StatementList (_? ';')? _? 'lang'i _ 'exit'i {
    return { value: res, remainingInput: input.slice(location().end.offset) };
  }
  ;

ScopeExit
  =	'}'
	/ ')'
	/ ']'
  ;

StatementList
  = Statement|1.., _? ';' _?|
  ;

Statement = SelectStmt ;

SelectStmt
  = vals:ValuesClause ord:(_ @OrderByClause)? lim:(_ @LimitClause)? {
    return new ast.SelectStatement(vals, ord, lim?.[0], lim?.[1])
  }
  / w:(@WithClause _)? ssl:SelectSetList ord:(_ @OrderByClause)? lim:(_ @LimitClause)? {
    return new ast.SelectStatement(ssl, ord, lim?.[0], lim?.[1], w)
  }
  ;

SelectSet
  = 'SELECT'i _ dist:(@DistinctClause _)? sl:SelectList _ 'FROM'i _
  tbl:TableItem w:(_ @WhereClause)? gb:(_ @GroupByClause)? h:(_ @HavingClause)? wind:(_ @WindowClause)? {
    return new ast.SelectSet(sl, tbl, w, gb, h, dist ?? false, wind);
  }
  / 'SELECT'i _ dist:(@DistinctClause _)? sl:SelectList {
    const ss = new ast.SelectSet(sl);
    ss.distinct = dist ?? false;
    return ss;
  }
  ;

SelectSetList
  = ss:SelectSet _ op:SetOp all:(_ 'ALL'i)? _ ssl:SelectSetList {
    ss.setOp = new ast.SelectSetOp(ssl, !all, op);
    return ss;
  }
  / ss:SelectSet _ op:SetOp all:(_ 'ALL'i)? _? '(' _? sq:Subquery _? ')' {
    ss.setOp = new ast.SelectSetOp(options.allFrom(sq), !all, op);
    return ss;
  }
  / SelectSet
  / '(' _? sq:Subquery  _? ')' _? op:SetOp all:(_ 'ALL'i)? _ ssl:SelectSetList {
    const res = options.allFrom(sq);
    res.setOp = new ast.SelectSetOp(ssl, !all, op);
    return res;
  }
  / '(' _? sq1:Subquery  _? ')' _? op:SetOp all:(_ 'ALL'i)? _? '(' _? sq2:Subquery _? ')' {
    const res = options.allFrom(sq1);
    res.setOp = new ast.SelectSetOp(options.allFrom(sq2), !all, op);
    return res;
  }
  ;

SetOp
  = 'UNION'i
  / 'INTERSECT'i
  / 'EXCEPT'i
  ;

SelectList
  = pairs:(@Expression @(_ @Alias)?)|1.., _? ',' _?| {
    return pairs.map(([expr, alias]) => alias ? new ast.ASTExpressionAlias(expr, alias) : expr);
  }
  ;

OneTable
  = TableFunctionCall
  / id:ScopedId alias:(_ @TableAlias)? {
    if (alias) {
      alias.table = id;
      return alias;
    }
    return id;
  }
  / '(' _? sq:Subquery _? ')' _ alias:TableAlias {
    alias.table = sq;
    return alias;
  }
  ;

TableFunctionCall
  = 'ROWS'i _ 'FROM'i _? '(' _? fns:SimpleFnCall|1.., _? ',' _?| _? ')' _
  withOrd:(_ 'WITH'i _ 'ORDINALITY'i)? _ alias:TableAlias {
    alias.table = new ast.RowsFrom(fns, !!withOrd);
    return alias;
  }
  / fn:SimpleFnCall withOrd:(_ 'WITH'i _ 'ORDINALITY'i)? _ alias:TableAlias {
    alias.table = new ast.TableFn(fn.id, fn.args, !!withOrd);
    return alias;
  }
  ;

WithClause
  = 'WITH'i rec:(_ 'RECURSIVE'i)? qs:WithQueryCycleList {
    rec = !!rec;
    for (q of qs) {
      q.recursive = rec;
    }
    return qs;
  }
  ;

WithQueryName
  = name:Identifier cols:(_? '(' _? @ColumnList _? ')')? _ 'AS'i _ mat:(Materialized _)? '(' sq:Subquery ')' {
    return new ast.WithQuery(name, cols ?? [], sq, !!mat); 
  }
  ;

ColumnList
  = ids:Identifier|1.., _? ',' _?|
  ;

Materialized
  = 'MATERIALIZED'i { return true; }
  / 'NOT'i _ 'MATERIALIZED'i { return false; }
  ;

WithQuerySearch
  = wq:WithQueryName _ 'SEARCH'i _ type:WithSearchType _ 'FIRST'i _ 'BY'i _ cols:ColumnList _ 'SET'i _ sortCol:Identifier {
    wq.searchType = type;
    wq.searchCols = cols;
    wq.searchName = sortCol;
    return wq;
  }
  / WithQueryName
  ;

WithSearchType
	= 'DEPTH'i { return 'dfs'; }
	/ 'BREADTH'i { return 'bfs'; } ;

WithQueryCycle
  = wq:WithQuerySearch _ 'CYCLE'i _ cols:ColumnList _ 'SET'i _ markCol:Identifier _ 'USING'i _ pathCol:Identifier {
    wq.cycleCols = cols;
    wq.cycleMarkName = markCol;
    wq.cyclePathName = pathCol;
    return wq;
  }
  / wq:WithQuerySearch _ 'CYCLE'i _ cols:ColumnList _ 'SET'i _ markCol:Identifier _
  'TO'i _ markVal:Expression _ 'DEFAULT'i _ markDef:Expression _ 'USING'i _ pathCol:Identifier {
    wq.cycleCols = cols;
    wq.cycleMarkName = markCol;
    wq.cyclePathName = pathCol;
    wq.cycleMarkValue = markVal;
    wq.cycleMarkDefault = markDef;
    return wq;
  }
  / WithQuerySearch
  ;

WithQueryCycleList = WithQueryCycle|1.., _? ',' _?| ;

ValuesClause
  = 'VALUES'i _ exprs:ExpressionListOptList { return new ast.ValuesClause(exprs); }
  ;

TableItem
  = res:OneTable joins:((_ / _? ! [a-z]i) @JoinClause)* {
    for (const join of joins) {
      const { type, lat, tbl, cond, natural } = join;
      res = new ast.JoinClause(res, tbl, type, cond, lat);
      if (natural) res.natural = true;
    }
    return res;
  }
  ;

JoinClause
  = type:JoinType lat:(_ 'LATERAL'i)? _ tbl:OneTable cond:(_ @JoinCondition)? {
    return { type, lat: !!lat, tbl, cond };
  }
  / 'NATURAL'i _ type:JoinType _ lat:(_ 'LATERAL'i)? _ tbl:OneTable {
    return { type, lat: !!lat, tbl, natural: true };
  }
  ;

JoinType
  = ',' { return 'cross'; }
  / 'JOIN'i { return 'inner'; }
  / 'INNER'i _ 'JOIN'i { return 'inner'; }
  / 'LEFT'i _ ('OUTER'i _)? 'JOIN'i { return 'left'; }
  / 'RIGHT'i _ ('OUTER'i _)? 'JOIN'i { return 'right'; }
  / 'FULL'i _ ('OUTER'i _)? 'JOIN'i { return 'full'; }
  ;

JoinCondition
  = 'ON'i _ @Expression
  / 'USING'i _? '(' _? @ColumnList _? ')'
  ;

WhereClause
  = 'WHERE'i _ @Expression
  ;

GroupByClause
  = 'GROUP'i _ 'BY'i _ 'ROLLUP'i _ '(' _? exprs:ExpressionList _? ')' {
    return new ast.GroupByClause(exprs, 'rollup');
  }
  / 'GROUP'i _ 'BY'i _ 'CUBE'i _ '(' _? exprs:ExpressionList _? ')' {
    return new ast.GroupByClause(exprs, 'cube');
  }
  / 'GROUP'i _ 'BY'i _ 'GROUPING'i _ 'SETS'i _ '(' _? exprs:ExpressionListOptList _? ')' {
    return new ast.GroupByClause(exprs, 'grouping sets');
  }
  / 'GROUP'i _ 'BY'i _ exprs:ExpressionList {
    return new ast.GroupByClause(exprs, 'basic');
  }
  ;

WindowClause
  = 'WINDOW'i _ specs:(@IdPart _ 'AS'i _ @WindowSpec)|1.., _? ',' _?| {
    return Object.fromEntries(specs);
  }
  ;

WindowSpec
  = '(' _? parent:(@IdPart _)? partition:('PARTITION'i _ 'BY'i _ @ExpressionList _)?
  ord:(@OrderByClause _)? frame:(@FrameClause _)? _? ')' {
    const res = frame ?? new ast.WindowSpec();
    res.columns = partition ?? [];
    res.order = ord ?? [];
    res.parent = parent;
    return res;
  }
  ;

FrameClause
  = mode:FrameMode _ 'BETWEEN'i _ start:FrameBoundStart _ 'AND'i _ end:FrameBoundEnd exclude:(_ @FrameExclusion)? {
    return new ast.WindowSpec(mode, start, end, exclude ?? 'noothers');
  }
  / mode:FrameMode _ start:FrameBoundStart exclude:(_ @FrameExclusion)? {
    return new ast.WindowSpec(mode, start, null, exclude ?? 'noothers');
  }
  ;

FrameMode
  = 'RANGE'i
  / 'ROWS'i
  / 'GROUPS'i
  ;

FrameBoundStart
  = 'UNBOUNDED'i _ 'PRECEDING'i { return new ast.ASTNumberLiteral('Infinity'); }
  / 'CURRENT'i _ 'ROW'i { return new ast.ASTNumberLiteral('0'); }
  / @Expression _ 'PRECEDING'i
  ;

FrameBoundEnd
  = 'UNBOUNDED'i _ 'FOLLOWING'i { return new ast.ASTNumberLiteral('Infinity'); }
  / 'CURRENT'i _ 'ROW'i { return new ast.ASTNumberLiteral('0'); }
  / @Expression _ 'FOLLOWING'i
  ;

FrameExclusion
  = 'EXCLUDE'i _ 'CURRENT'i _ 'ROW'i { return 'currentrow'; }
  / 'EXCLUDE'i _ 'GROUP'i { return 'group'; }
  / 'EXCLUDE'i _ 'TIES'i { return 'ties'; }
  / 'EXCLUDE'i _ 'NO'i _ 'OTHERS'i { return 'noothers'; }
  ;

HavingClause
  = 'HAVING'i _ @Expression
  ;

DistinctClause
  = 'DISTINCT'i _ 'ON'i _ '(' _? exprs:ExpressionList _? ')' { return exprs; }
  / 'DISTINCT'i { return true; }
  / 'ALL'i { return false; }
  ;

OrderByOrder
  = 'ASC'i
  / 'DESC'i
  ;

OrderByNulls
  = 'NULLS'i _ 'FIRST'i { return true; }
  / 'NULLS'i _ 'LAST'i { return false; }
  ;

OrderByItem
  = expr:Expression dir:(_ @OrderByOrder)? nulls:(_ @OrderByNulls)? {
    return new ast.OrderByItem(expr, dir ?? 'asc', nulls);
  }
  ;

OrderByClause
  = 'ORDER'i _ 'BY'i _ @OrderByItem|1.., _? ',' _?|
  ;

LimitClause
  = 'LIMIT'i _ lim:Expression _ 'OFFSET'i _ offset:Expression { return [lim, offset]; }
  / 'LIMIT'i _ 'ALL'i _ 'OFFSET'i _ offset:Expression { return [undefined, offset]; }
  / 'LIMIT'i _ lim:Expression { return [lim, undefined]; }
  / 'OFFSET'i _ offset:Expression { return [undefined, offset]; }
  ;

Subquery
  = SelectStmt
  / LangSwitch
  ;

LangSwitch = 'LANG'i _ name:$[0-9a-z_$]i+ {
  name = name.toLowerCase();
  const lang = options.langMgr.getLang(name);
  if (!lang) {
    throw new Error(`Unknown language: ${name}`);
  }
  const offset = location().end.offset;
  const nestedParser = lang.createParser(options.langMgr);
  const locationFix = '\n'.repeat(location().end.line - 1) + ' '.repeat(location().end.column - 1);
  const res = nestedParser.parse(locationFix + input.slice(offset));

  input = input.slice(0, offset) + (
    input.slice(offset, input.length - res.remainingInput.length).replace(/[^\n]/g, ' ')
  ) + res.remainingInput;
  return new ast.LangSwitch(name, res.value);
} ;

QueryQuantifier
  = 'ALL'i
  / 'ANY'i
  / 'SOME'i
  ;

QuantifiedQuery
  = q:QueryQuantifier _? '(' _? sq:Subquery _? ')' { return new ast.ASTQuantifier(q, sq); }
  ;

BooleanLiteral
  = x:'TRUE'i { return new ast.ASTLiteral(x, true); }
  / x:'FALSE'i { return new ast.ASTLiteral(x, false); }
  / x:'NULL'i { return new ast.ASTLiteral(x, null); }
  ;

ArrayConstructor
  = 'ARRAY'i _? '[' _? exprs:ExpressionListOpt _? ']' { return new ast.ASTArray(exprs); }
  / 'ARRAY'i _? '(' _? sq:Subquery _? ')' { return new ast.ASTArray(sq); }
  ;

RowConstructor
  = 'ROW'i _? '(' _? sl:SelectList _? ')' { return new ast.ASTRow(sl); }
  / 'ROW'i _? '(' _? ')' { return new ast.ASTRow([]); }
  / '(' _? e:Expression alias:(_ @Alias) _? ',' _? sl:SelectList _? ')' {
    sl.unshift(alias ? new ast.ASTExppressionAlias(e, alias) : e);
    return new ast.ASTRow(sl);
  }
  ;

PrimaryExpression
  = Param
  / x:$NumberLiteral { return new ast.ASTNumberLiteral(x); }
  / id:Identifier _? str:StringLiteral { return new ast.ASTCast(str, id); }
  / StringLiteral
  / BooleanLiteral
  / '(' _? @Subquery _? ')'
  / '(' _? @Expression _? ')'
  / ArrayConstructor
  / RowConstructor
  / CaseExpression
  / FunctionCall
  / FieldSelector
  ;

NumberLiteral
  = '0x'i [0-9a-f]i+
  / '0b'i [01]+
  / '0o'i [0-7]+
  / [+-]? [0-9]+ '.' [0-9]+ 'e'i [+-]?[0-9]+
  / [+-]? [0-9]+ '.' [0-9]+
  / [+-]? [0-9]+
  ;

StringLiteral
  = "'" ([^'] / "''")* "'" { return new ast.ASTStringLiteral(text()); }
  / start:$StringDelim ([^$]+ / mbDelim:$('$' [^$]* & '$') ! { return start === mbDelim + '$' })*
    end:$StringDelim & { return start === end } { return new ast.ASTStringLiteral(text()); }
  ;

StringDelim = '$' [^$]* '$' ;

FunctionCall
  = id:ScopedId _? '(' _? args:(@ExpressionList _?)? ')' _ 'WITHIN'i _ 'GROUP'i _?
  '(' _? wg:OrderByClause  _? ')' filter:(_ @FilterClause)? {
    return new ast.ASTAggregate(id, args ?? [], null, null, filter, wg);
  }
  / id:ScopedId _? '(' _? ')' _ filter:FilterClause {
    return new ast.ASTAggregate(id, [], null, null, filter);
  }
  / id:ScopedId _? '(' _? args:(@ExpressionList _?)? ')' filter:(_ @filter:FilterClause)?
  _ 'OVER'i window:(_ @IdPart / _? @WindowSpec) {
    return new ast.ASTWindowFn(id, args ?? [], window, filter);
  }
  / id:ScopedId _? '(' _? dist:(@'DISTINCT'i _ / @'ALL'i _)? args:ExpressionList ord:(_ @OrderByClause)? _? ')' filter:(_ @FilterClause)?
  & { return dist || ord || filter; } {
    return new ast.ASTAggregate(id, args, dist, ord, filter);
  }
  / SimpleFnCall
  ;

FilterClause
  = 'FILTER'i _? '(' _? 'WHERE'i _ @Expression _? ')'
  ;

SimpleFnCall
  = id:ScopedId _? '(' _? ')' { return new ast.ASTFunction('sql', id, []); }
  / id:ScopedId _? '(' _? sq:Subquery _? ')' { return new ast.ASTFunction('sql', id, [sq]); }
  / id:ScopedId _? '(' _? args:ExpressionList _? ')' { return new ast.ASTFunction('sql', id, args); }
  ;

CastOrSubscriptExpr
  = 'CAST'i _? '(' _? e:Expression _ 'AS'i _ id:ScopedId arr:('[' _? ']')? _? ')' {
    return new ast.ASTCast(e, id, !!arr);
  }
  / e:PrimaryExpression ops:(_? @(Subscript / CastOp))* {
    for (const op of ops) {
      if (op[0] === 'subscript') {
        e = new ast.ASTSubscript(e, op[1], op[2]);
      } else if (op[0] === 'cast') {
        e = new ast.ASTCast(e, op[1], op[2]);
      }
    }
    return e;
  }
  ;

Subscript
  = '[' _? e1:Expression e2:(_? ':' _? @Expression)? _? ']' {
    return e2 ? ['subscript', e1, e2] : ['subscript', e1];
  }
  ;

CastOp
  = '::' _? id:ScopedId arr:('[' _? ']')? {
    return ['cast', id, !!arr];
  }
  ;

UnaryExpression
  = ops:(AddOp)* e:CastOrSubscriptExpr {
    for (const op of ops) {
      e = options.makeOp(op, [e]);
    }
    return e;
  }
  ;

AddOp
  = '+' / '-'
  ;

ExponentiativeExpression
  = e:UnaryExpression ops:(_? '^' _? @UnaryExpression)* {
    for (const right of ops) {
      e = options.makeOp('^', [e, right]);
    }
    return e;
  }
  ;

MultOp
  = '*' / '/' / '%'
  ;

MultiplicativeExpression
  = e:ExponentiativeExpression ops:(_? @MultOp _? @ExponentiativeExpression)* {
    for (const [op, right] of ops) {
      e = options.makeOp(op, [e, right]);
    }
    return e;
  }
  ;

AdditiveExpression
  = e:MultiplicativeExpression ops:(_? @AddOp _? @MultiplicativeExpression)* {
    for (const [op, right] of ops) {
      e = options.makeOp(op, [e, right]);
    }
    return e;
  }
  ;

AdditiveOrQuantifiedExpression
  = AdditiveExpression
  / QuantifiedQuery
  ;

UseropExpression
  = e:AdditiveExpression ops:(_? @UserOp _? @AdditiveOrQuantifiedExpression)* {
    for (const [op, right] of ops) {
      e = options.makeOp(op, [e, right]);
      options.parentOp(right, op);
    }
    return e;
  }
  ;

UserOp
  = 'OPERATOR'i _? '(' _? @ScopedId _? ')'
  / @x:$([+*/<>=~!@#%^&|`?-]+) ! { return notUserOps.includes(x) }
  & { return x.match(/[~!@#%^&|`?]/) }
  / @x:$([+*/<>=-]+) ! { return x.at(-1) === '-' || x.at(-1) === '+' || notUserOps.includes(x) }
  ;

UseropOrQuantifiedExpression
  = UseropExpression
  / QuantifiedQuery
  ;

StringSetRangeExpression
  = e:UseropExpression ops:(_ @(@'NOT'i _)? @StringSetRangeOp)* {
    for (const [not, [op, ...args]] of ops) {
      if (op === 'in') {
        e = options.makeOp(not ? 'not in' : 'in', [e, ...args]);
      } else {
        e = options.wrapNot(options.makeOp(op, [e, ...args]), not);
        if (op === 'between') {
          options.parentOp(args[0], '>=');
          options.parentOp(args[1], '<=');
        } else {
          options.parentOp(args[0], op.toLowerCase());
        }
      }
    }
    return e;
  }
  ;

StringSetRangeOp
  = 'IN'i _? '(' _? x:Subquery _? ')' { return ['in', x]; }
  / 'IN'i _? '(' _? exprs:ExpressionList _? ')' { return ['in', new ast.ASTTuple(exprs)]; }
  / @('ILIKE'i / 'LIKE'i) _ @UseropOrQuantifiedExpression
  / 'BETWEEN'i _ x1:UseropOrQuantifiedExpression _ 'AND'i _ x2:UseropOrQuantifiedExpression { return ['between', x1, x2]; }
  ;

RelOp
  = '='
  / '<>'
  / '<='
  / '>='
  / '!='
  / '<'
  / '>'
  ;

RelationalExpression
  = e:StringSetRangeExpression ops:(_? @RelOp _? @UseropOrQuantifiedExpression)* {
    for (const [op, right] of ops) {
      e = options.makeOp(op, [e, right]);
      options.parentOp(right, op);
    }
    return e;
  }
  ;

IsExpression
  = 'EXISTS'i _? '(' _? sq:Subquery _? ')' { return new ast.ASTExists(sq); }
  / e:RelationalExpression ops:(_ 'IS'i _ @(@'NOT'i _)? @IsOp)* {
    for (const [not, [op, right]] of ops) {
      e = options.wrapNot(options.makeOp(op, [e, right]), not);
    }
    return e;
  }
  ;

IsOp
  = x:BooleanLiteral { return ['is', x]; }
  / 'DISTINCT'i _ 'FROM'i _ e:RelationalExpression { return ['distinct from', e]; }
  ;

LogicalNotExpression
  = ops:(@'NOT'i _)* e:IsExpression {
    for (const op of ops) {
      e = options.wrapNot(e, op);
    }
    return e;
  }
  ;

LogicalAndExpression
  = e:LogicalNotExpression ops:(_ 'AND'i _ @LogicalNotExpression)* {
    for (const right of ops) {
      e = options.makeOp('and', [e, right]);
    }
    return e;
  }
  ;

LogicalOrExpression
  = e:LogicalAndExpression ops:(_ 'OR'i _ @LogicalAndExpression)* {
    for (const right of ops) {
      e = options.makeOp('or', [e, right]);
    }
    return e;
  }
  ;

Expression
  = LogicalOrExpression
  ;

CaseExpression
  = 'CASE'i e:(_ @e:Expression ! {
    return e instanceof ast.SQLIdentifier && e.parts.length === 1 && e.parts[0].toLowerCase() === 'when';
  })? _ wts:WhenThen|1.., _| elsExpr:(_ 'ELSE'i _ @Expression)? _ 'END'i {
    return new ast.ASTCase(e, wts, elsExpr);
  }
  ;

WhenThen
  = 'WHEN'i _ cond:Expression _ 'THEN'i _ res:Expression {
    return [cond, res];
  }
  ;

ExpressionListOpt = Expression|.., _? ',' _?| ;

ExpressionList = Expression|1.., _? ',' _?| ;

ExpressionListOptList = ( '(' _? @ExpressionListOpt _? ')' )|1.., _? ',' _?| ;

_ = whitespace+ ;

IdPart "Identifier part"
  = @id:$([a-z_]i[0-9a-z_$]i*) ! { return kwNeverIds.includes(id.toLowerCase()) }
  / $('"' ('""' / [^"])* '"')
  / $('`' ('``' / [^`])* '`')
  ;

Identifier = id:IdPart { return new ast.SQLIdentifier(id); } ;

Param = [:?] id:IdPart {
  const res =new ast.SQLIdentifier(id);
  res.parts.unshift(ast.boundParam);
  return res;
} ;

ScopedId
  = tbl:IdPart '.' col:IdPart {
    return new ast.SQLIdentifier(col, tbl);
  }
  / Identifier
  ;

FieldSelector
  = '*' { return new ast.SQLIdentifier(ast.allAttrs); }
  / schema:IdPart '.' tbl:IdPart '.' col:IdPart {
    return new ast.SQLIdentifier(col, schema, tbl);
  }
  / id:ScopedId '.*' {
    return new ast.SQLIdentifier(ast.allAttrs, ...id.schemasOriginal);
  }
  / ScopedId
  ;

TableAlias
  = ('AS'i _)? id:ScopedId _? '(' _? cols:ColumnList _? ')' { return new ast.ASTTableAlias(id, cols); }
  / ('AS'i _)? id:IdPart { return new ast.ASTTableAlias(id); }
  ;

Alias
  = ('AS'i _)? @IdPart
  ;

whitespace = WhitespacePattern
  / Comment
  ;

WhitespacePattern "whitespace"
  = [\p{White_Space}]
  ;

Comment = '/*' ([^*] / ('*' [^/]))* '*/'
  / '--' ([^\r\n])* '\r'? ('\n' / !.)
  ;