{
  const ast = options.ast;
}

Root
  = _? res:Module (_? ';')? _? !. {
    return { value: res, remainingInput: input.slice(location().end.offset) };
  }
  / _? res:Module (_? ';')? _? & ScopeExit {
    return { value: res, remainingInput: input.slice(location().end.offset) };
  }
  / _? res:Module (_? ';')? _? 'lang'i _ 'exit'i {
    return { value: res, remainingInput: input.slice(location().end.offset) };
  }
  ;

ScopeExit
  =	'}'
	/ ')'
	/ ']'
  ;

Module = p:(@Prolog _)? b:QueryBody {
  return new ast.Module(p ?? new ast.Prolog([]), b);
} ;

Prolog = x:Declaration|.., _| { return new ast.Prolog(x); } ;

Declaration
  = 'declare' _ 'namespace' _ key:NCName _? '=' _? val:StringLiteral { return ast.NSDeclaration(key, val); }
  / 'declare' _ 'default' _ 'element' _ 'namespace' _? '=' _? val:StringLiteral { return ast.DefaultNSDeclaration(val); }
  / 'declare' _ 'base' _ 'uri' _ val:StringLiteral { return ast.BaseURIDeclaration(val); }
  / 'declare' _ 'ordering' _ val:OrderingMode { return ast.OrderingDeclaration(key, val); }
  / 'declare' _ 'default' _ 'order' _ 'empty' _ val:EmptyOrder { return ast.EmptyOrderDeclaration(key, val); }
  ;

OrderingMode = 'ordered' { return true; }
  / 'unordered' { return false; }
  ;

EmptyOrder = 'greatest' { return true; }
  / 'least' { return false; }
  ;

QueryBody = ExprList ;

Expr
	= FlworExpr
	/ QuantifiedExpr
	/ SwitchExpr
	/ IfExpr
	/ OrExpr
  ;

FlworExpr
  = init:FlworInitial _ body:(@FlworBody _)? end:FlworReturn {
    body ??= [];
    body.unshift(init);
    body.push(end);
    return new ast.FLWORExpr(body);
  }
  ;

FlworInitial
  = ForClause
  / LetClause
  / WindowClause
  ;

ForClause
  = 'for' _ bindings:ForBinding|1.., _? ',' _?| { return new ast.FLWORFor(bindings); } ;

ForBinding
  = variable:Variable allowEmpty:(_ 'allowing' _ 'empty')? pos:(_ 'at' _ @Variable)? _ 'in' _ expr:Expr {
    return new ast.FLWORForBinding(variable, expr, !!allowEmpty, pos);
  } ;

LetClause
  = 'let' _ bindings:LetBinding|1.., _? ',' _?| { return new ast.FLWORLet(bindings); } ;

LetBinding
  = variable:Variable _? ':=' _? expr:Expr {
    return [variable, expr];
  } ;

WindowClause
  = 'for' _ 'sliding' _ 'window' _ variable:Variable _ 'in' _ expr:Expr _ start:WindowStart end:(_ @WindowEnd)? {
    return new ast.FLWORWindow('sliding', variable, expr, start, end);
  }
  / 'for' _ 'tumbling' _ 'window' _ variable:Variable _ 'in' _ expr:Expr _ start:WindowStart _ end:WindowEnd {
    return new ast.FLWORWindow('tumbling', variable, expr, start, end);
  }
  ;

WindowStart
  = 'start' _ vars:WindowVars 'when' _ expr:Expr {
    vars.expr = expr;
    return vars;
  } ;

WindowEnd
  = only:('only' _)? 'end' _ vars:WindowVars 'when' _ expr:Expr {
    vars.expr = expr;
    vars.only = !!only;
    return vars;
  } ;

WindowVars
  = variable:(@Variable _)? pos:('at' _ @Variable _)? prev:('previous' _ @Variable _)? next:('next' _ @Variable _)? {
    return new ast.WindowBoundary(variable, pos, prev, next);
  } ;

FlworBody
  = FlworBodyClause|1.., _| ;

FlworBodyClause
  = FlworInitial
  / WhereClause
  / GroupByClause
  / OrderByClause
  / CountClause
  ;

WhereClause
  = 'where' _ expr:Expr { return new ast.FLWORWhere(expr); } ;

GroupByClause
  = 'group' _ 'by' _ groups:GroupBinding|1.., _? ',' _?| {
    return new ast.FLWORGroupBy(groups);
  } ;

GroupBinding
  = LetBinding
  / v:Variable { return [v, v]; }
  ;

OrderByClause
  =  stable:('stable' _)? 'order' _ 'by' _ orders:OrderSpec|1.., _? ',' _?| {
    return new ast.FLWOROrderBy(orders);
  } ;

OrderSpec
  = expr:Expr dir:(_ @OrderDir)? emptyDir:(_ @EmptyOrder)? {
    return new ast.OrderByItem(expr, dir === null ? true : dir, emptyDir);
  } ;

OrderDir
  = 'ascending' { return true; }
  / 'descending' { return false; }
  ;

CountClause
  = 'count' _ variable:Variable { return new ast.FLWORCount(variable); } ;

FlworReturn
  = 'return' _ expr:Expr { return new ast.FLWORReturn(expr); } ;

QuantifiedExpr
  = quant:('some' / 'every') _ bindings:QuantifierBinding|1.., _? ',' _?| _ 'satisfies' _ expr:Expr {
    return new ast.QuantifiedExpr(quant, bindings, expr);
  } ;

QuantifierBinding
  = variable:Variable _ 'in' _ expr:Expr { return [variable, expr]; } ;

SwitchExpr
  = 'switch' _? expr:ParExpr _? cases:SwitchCase|1.., _| _ 'default' _ 'return' _ defaultExpr:Expr {
    return new ast.SwitchExpr(expr, cases, defaultExpr);
  } ;

SwitchCase
  = key:('case' _ @Expr)|1.., _| _ 'return' _ expr:Expr {
    return [key, expr];
  } ;

IfExpr
  = 'if' _? cond:ParExpr _? 'then' _ then:Expr _ 'else' _ elseExpr:Expr {
    return new ast.IfExpr(cond, then, elseExpr);
  } ;

ParExpr
  = '(' _? @NestedLang _? ')'
  / '(' _? @Expr _? ')'
  ;

CurExpr
	= '{' _? @NestedLang _? '}'
	/ '{' _? @ExprList _? '}'
  ;

CurOptExpr
	= '{' _? @NestedLang _? '}'
	/ '{' _? @ExprList? _? '}'
  ;

ExprList = Expr|1.., _? ',' _?| ;

Occurence
  = '*' / '+' / '?' ;

ItemType
  = KindTest
  / x:'item' _? '(' _? ')' { return new ast.ASTItemType(x); }
  / x:'function' _? '(' _? '*' _? ')' { return new ast.ASTItemType(x, '*'); }
  / x:Name { return new ast.ASTItemType(null, x); }
  / '(' _? @ItemType _? ')'
  ;

KindTest
  = DocumentTest
  / ElementTest
  / AttributeTest
  / x:'schema-element' _? '(' _? name:Name _? ')' { return new ast.ASTItemType(x, name); }
  / x:'schema-attribute' _? '(' _? name:Name _? ')' { return new ast.ASTItemType(x, name); }
  / PITest
  / x:'comment' _? '(' _? ')' { return new ast.ASTItemType(x); }
  / x:'text' _? '(' _? ')' { return new ast.ASTItemType(x); }
  / x:'namespace-node' _? '(' _? ')' { return new ast.ASTItemType(x); }
  / x:'node' _? '(' _? ')' { return new ast.ASTItemType(x); }
  ;

DocumentTest
  = x:'document-node' _? '(' _? ')' { return new ast.ASTItemType(x); }
  / 'document-node' _? '(' _? el:ElementTest  _? ')' { return new ast.ASTItemType(ast.ItemKind.documentElement, el.name); }
  / 'document-node' _? '(' _? 'schema-element' _? '(' _? name:Name  _? ')' _? ')'
  { return new ast.ASTItemType(ast.ItemKind.documentSchemaElement, name); }
  ;

NameOrStar = Name / '*'

ElementTest
  = x:'element' _? '(' _? name:(@NameOrStar _?)? ')' {  return new ast.ASTItemType(x, name ?? '*'); }
  ;

AttributeTest
  = x:'attribute' _? '(' _? name:(@NameOrStar _?)? ')' {  return new ast.ASTItemType(x, name ?? '*'); }
  ;

NameOrStr = Name / StringLiteral ;

PITest
  = x:'processing-instruction' _? '(' _? name:(@NameOrStr _?)? ')' {
    return new ast.ASTItemType(x, name ?? '*');
  } ;

SequenceType
  = 'empty-sequence' _? '(' _? ')' { return new ast.ASTSequenceType(); }
  / it:ItemType occ:Occurence {
    return new ast.ASTSequenceType(it, occ);
  }
  / it:ItemType { return new ast.ASTSequenceType(it); }
  ;

OrderedExpr
  = ord:('ordered' / 'unordered') _? expr:CurExpr {
    return new ast.OrderedExpr(expr, ord === 'ordered');
  }

DirectConstructor
  = DirElemConstr
  / DirCommentConstr
  / DirPIConstr
  ;

DirElemConstr
  = '<' name1:Name attrs:DirAttrList? _? '>' content:DirElemContent* '</' name2:Name _? '>' & { return name1.equals(name2) } {
      return new ast.DirectElementConstructor(name1, attrs ?? [], content);
    }
  / '<' name1:Name attrs:DirAttrList? _? '/>' {
    return new ast.DirectElementConstructor(name1, attrs ?? []);
  }
  ;

DirElemContent
  = DirectConstructor
  / CDataSection
  / CommonContent
  / $ElementContentChar
  ;

ElementContentChar
  = [^<&\u007B\u007D]+
  ;

CommonContent
  = x:$PredefinedEntityRef { return options.interpretEscape(x); }
  / x:$CharRef { return options.interpretEscape(x); }
  / '\u007B\u007B' { return '\u007B'; }
  / '\u007D\u007D' { return '\u007D'; }
  / CurOptExpr
  ;

PredefinedEntityRef
  = '&' (
    'lt' / 'gt' / 'amp' / 'apos' / 'quot'
  ) ';'
  ;

CharRef
  = '&#' [0-9]+ ';'
  / '&#x' [0-9a-fA-F]+ ';'
  ;

CDataSection
  = '<![CDATA[' @$CDataSectionContent* ']]>' ;

CDataSectionContent
  = [^\]]+
  / ']' [^\]]+
  / ']]' [^>]
  ;

DirAttrList = _ @DirAttr|.., _| ;

DirAttr = k:Name _? '=' _? v:DirAttrVal { return [k, new ast.DirConstrContent(v)]; } ;

DirAttrVal
  = '"' @($('""' / [^"<&\u007B\u007D])+ / CommonContent)* '"'
  / "'" @($("''" / [^'<&\u007B\u007D])+ / CommonContent)* "'"
  ;

DirCommentConstr
  = '<!--' val:$DirCommentContent* '-->' { return new ast.DirectCommentConstructor(val); } ;

DirCommentContent
  = [^-]+
  / '-' [^-]+
  ;

DirPIConstr
  = '<?' key:PITarget val:(_ @$DirPIContent*)? '?>' { return new ast.DirectPIConstructor(key, val); }
  ;

DirPIContent
  = [^?]+
  / '?' [^>]
  ;

PITarget
  = @name:$NCName ! { return name.toLowerCase() === 'xml'; }

ComputedConstructor
	= x:'document' _? expr:CurExpr { return new ast.ComputedConstructor(x, expr); }
	/ x:'element' _? name:NameOrExpr _ expr:CurOptExpr { return new ast.ComputedConstructor(x, expr, name); }
	/ x:'attribute' _? name:NameOrExpr _ expr:CurOptExpr { return new ast.ComputedConstructor(x, expr, name); }
	/ x:'namespace' _? name:NCNameOrExpr _ expr:CurExpr { return new ast.ComputedConstructor(x, expr, name); }
	/ x:'processing-instruction' _? name:NCNameOrExpr _ expr:CurExpr { return new ast.ComputedConstructor(x, expr, name); }
	/ x:'text' _? expr:CurExpr { return new ast.ComputedConstructor(x, expr); }
	/ x:'comment' _? expr:CurExpr { return new ast.ComputedConstructor(x, expr); } ;

NameOrExpr
  = Name
  / CurExpr
  ;

NCNameOrExpr
  = name:NCName { return new ast.XQueryIdentifier(name); }
  / CurExpr
  ;

ConstructorExpr
  = DirectConstructor
  / ComputedConstructor
  ;

InlineFunctionExpr
   = 'function' _? '(' _? vars:Variable|.., _? ',' _?| _? ')' _? '{' _? body:ExprList? _? '}' {
    return new ast.InlineFunctionExpr(vars, body ?? []);
   } ;

PrimaryExpr
  = NumberLiteral
  / StringLiteral
  / Variable
  / ParExpr
  / '(' _? ')' { return new ast.SequenceConstructor([]); }
  / '(' _? vals:Expr|2.., _? ',' _?| _? ')' { return new ast.SequenceConstructor(vals); }
  / name:Name _? '(' _? args:ArgumentList _? ')' {
    if (args.includes(options.argPlaceholder)) {
      return new ast.BoundFunction(
        name,
        args
          .map((a, i) => a === options.argPlaceholder ? null : [i, a])
          .filter(x => x)
      );
    }
    return new ast.ASTFunction('xquery', name, args);
  }
  / OrderedExpr
  / ConstructorExpr
  / InlineFunctionExpr
  / '.' { return ast.DOT; }
  ;

ArgumentList = Argument|.., _? ',' _?| ;

Argument
  = Expr
  / '?' { return options.argPlaceholder; }
  ;

PostfixExpr
  = e:PrimaryExpr ops:(_? @PostfixOp)* {
    for (const op of ops) {
      if (op instanceof ast.PathPredicate) {
        e = new ast.FilterExpr(e, op);
      } else {
        if (op.includes(options.argPlaceholder)) {
          e = new ast.BoundFunction(
            e,
            op
              .map((a, i) => a === options.argPlaceholder ? null : [i, a])
              .filter(x => x)
          );
        } else {
          e = new ast.DynamicFunctionCall(e, op);
        }
      }
    }
    return e;
  }
  ;

PostfixOp
  = Predicate
  / '(' _? @ArgumentList _? ')'
  ;

PathExpr
  = p:RelativePathExpr {
    if (p.length === 1 && !(p[0] instanceof ast.PathAxis)) return p[0];
    return new ast.PathExpr(p);
  }
  / '//' _? p:RelativePathExpr { return new ast.PathExpr(p, '//'); }
  / '/' _? p:RelativePathExpr { return new ast.PathExpr(p, '/') }
  / '/' { return new ast.PathExpr([], '/'); }
  ;

RelativePathExpr
  = first:StepExpr rest:(_? @$('/' '/'?) _? @StepExpr)* {
    const result = [first];
    for (const [sep, step] of rest) {
      if (sep === '/')
        result.push(step);
      else 
        result.push(
          new ast.PathAxis(
            ast.AxisType.DESCENDANT_OR_SELF,
            new ast.ASTItemType(ast.ItemKind.NODE)
          ),
          step
        );
    }
    return result;
  }
  ;

StepExpr
  = PredicateStep
  / PostfixExpr
  ;

PredicateStep
  = ax:AxisStep ps:(_? @Predicate|1.., _?|)? {
    ax.predicates = ps ?? [];
    return ax;
  }
  ;

AxisStep
  = kw:AxisKeyword _? '::' _? test:NodeTest { return new ast.PathAxis(kw, test); }
  / '..' { return new ast.PathAxis(ast.AxisType.PARENT, new ast.ASTItemType(ast.ItemKind.NODE)); }
  / test:NodeTest { return new ast.PathAxis(ast.AxisType.CHILD, test); }
  / '@' test:NodeTest { return new ast.PathAxis(ast.AxisType.ATTRIBUTE, test); }
  ;

AxisKeyword
  = 'self'
  / 'preceding-sibling'
  / 'preceding'
  / 'parent'
  / 'following-sibling'
  / 'following'
  / 'descendant-or-self'
  / 'descendant'
  / 'child'
  / 'attribute'
  / 'ancestor-or-self'
  / 'ancestor'
  ;

NodeTest
  = KindTest
  // name '(' should be a function, not a node test
  / x:NameOrStar ! (_? '(') { return new ast.ASTItemType(null, x); }
  / x:$QnameWildcard { return new ast.ASTItemType(null, new XQueryIdentifier(x)); }
  ;

Predicate
  = '[' _? expr:ExprList _? ']' { return new ast.PathPredicate(expr); } ;

SimpleMapExpr
  = e:PathExpr ops:(_? '!' _? @PathExpr)* {
    for (const op of ops) {
      e = new ast.SimpleMapExpr(e, op);
    }
    return e;
  }
  ;

ValueExpr = SimpleMapExpr ;

UnaryExpr = ops:(AdditiveOp)* e:ValueExpr {
  for (const op of ops.reverse()) {
    e = options.makeOp(op, [e]);
  }
  return e;
} ;

AdditiveOp = '+' / '-' ;

CastExpr
  = e:UnaryExpr names:(_ 'cast' _ 'as' _ @Name)* {
    for (const name of names) {
      e = new ast.CastExpr(e, name);
    }
    return e;
  }
  ;

InstanceofExpr
  = e:CastExpr types:(_? 'instance' _ ('of' ! IdentifierPart) _? @SequenceType)* {
    for (const type of types) {
      e = new ast.InstanceOfExpr(e, type);
    }
    return e;
  }
  ;

IntersectOp
  = @'intersect' ! IdentifierPart
  / @'except' ! IdentifierPart
  ;

IntersectExpr
  = e:InstanceofExpr ops:(_? @IntersectOp _? @InstanceofExpr)* {
    for (const [op, right] of ops) {
      e = options.makeOp(op, [e, right]);
    }
    return e;
  }
  ;

UnionOp
  = @'union' ! IdentifierPart
  / @'|' ! '|'
  ;

UnionExpr
  = e:IntersectExpr ops:(_? UnionOp _? @IntersectExpr)* {
    for (const right of ops) {
      e = options.makeOp('|', [e, right]);
    }
    return e;
  }
  ;

MultOp
  = '*'
  / 'div' ! IdentifierPart { return '/'; }
  / 'idiv' ! IdentifierPart { return '//'; }
  / 'mod' ! IdentifierPart { return '%'; }
  ;

MultiplicativeExpr
  = e:UnionExpr ops:(_? @MultOp _? @UnionExpr)* {
    for (const [op, right] of ops) {
      e = options.makeOp(op, [e, right]);
    }
    return e;
  }
  ;

AdditiveExpr
  = e:MultiplicativeExpr ops:(_? @AdditiveOp _? @MultiplicativeExpr)* {
    for (const [op, right] of ops) {
      e = options.makeOp(op, [e, right]);
    }
    return e;
  }
  ;

RangeExpr
  = e:AdditiveExpr ops:(_? ('to' ! IdentifierPart) _? @AdditiveExpr)* {
    for (const right of ops) {
      e = options.makeOp('to', [e, right]);
    }
    return e;
  }
  ;

StrConcatExpr
  = e:RangeExpr ops:(_? '||' _? @RangeExpr)* {
    for (const right of ops) {
      e = options.makeOp('||', [e, right]);
    }
    return e;
  }
  ;

ComparisonExpr
  = e:StrConcatExpr ops:(_? @ComparisonOp _? @StrConcatExpr)* {
    for (const [op, right] of ops) {
      e = options.makeOp(op, [e, right]);
    }
    return e;
  }
  ;

ComparisonOp
  = '='
  / '!='
  / '<'
  / '>'
  / '<='
  / '>='
  / @'eq' ! IdentifierPart
  / @'ne' ! IdentifierPart
  / @'lt' ! IdentifierPart
  / @'gt' ! IdentifierPart
  / @'le' ! IdentifierPart
  / @'ge' ! IdentifierPart
  / @'is' ! IdentifierPart
  / '<<'
  / '>>'
  ;

AndExpr
  = e:ComparisonExpr ops:(_? ('and' ! IdentifierPart) _? @ComparisonExpr)* {
    for (const right of ops) {
      e = options.makeOp('and', [e, right]);
    }
    return e;
  }
  ;

OrExpr
  = e:AndExpr ops:(_? ('or' ! IdentifierPart) _? @AndExpr)* {
    for (const right of ops) {
      e = options.makeOp('or', [e, right]);
    }
    return e;
  }
  ;

NestedLang = 'LANG'i _ name:$[0-9a-z_$]i+ {
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

StringLiteral
  = '"' ([^"] / '""')* '"' { return new ast.ASTStringLiteral(text()); }
  / "'" ([^'] / "''")* "'" { return new ast.ASTStringLiteral(text()); }

NumberLiteral
  = [+-]?[0-9]* '.' [0-9]+ ([Ee][+-]?[0-9]+)? { return new ast.ASTNumberLiteral(text()); }
  / [+-]?[0-9]+ { return new ast.ASTNumberLiteral(text()); }
  ;

Variable
  = '$' name:Name { return new ast.ASTVariable(name); } ;

Name
  = (QName / NCName) { return new ast.XQueryIdentifier(text()); }
  ;

NCName
  = IdentifierStart IdentifierPart* ;

IdentifierStart = [\p{ID_Start}\p{Pc}] ;

IdentifierPart = [\p{ID_Continue}\p{Sc}.] ;

QName
  = NCName ':' NCName
  / 'Q{' (Entity / [^&{}])* '}' NCName
  ;

QnameWildcard
  = '*' ':' NCName
  / NCName ':' '*'
  / 'Q{' (Entity / [^&{}])* '}' '*'
  ;

Entity = '&'([a-z]+ / '#'[0-9]+ / '#x'[0-9a-zA-Z]+)';' ;

_ = whitespace+ ;

whitespace = [\p{White_Space}]
  / Comment
  ;

Comment = '(:' ([^:] / (':' [^)]))* ':)'
  ;