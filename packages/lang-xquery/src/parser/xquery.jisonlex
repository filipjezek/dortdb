%options easy_keyword_rules ranges

NAME1     [A-Za-z_\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u10000-\uEFFFF]
NAME      {NAME1}|[-.0-9\xB7\u0300-\u036F\u203F-\u2040]
ENTITY    "&"([a-z]+|"#"[0-9]+|"#x"[0-9a-zA-Z]+)";"
DEC       [0-9]

%x blockc

%%


[Ll][Aa][Nn][Gg]\s+[Ee][Xx][Ii][Tt] this.yy.saveRemainingInput(this._input); return this.yy.AdditionalTokens.LANGEXIT;
[Ll][Aa][Nn][Gg]\s+([0-9a-z_$A-Z]+) %{
{
  const langName = yytext.slice(5);
  const lang = this.yy.langMgr.getLang(langName);
  if (!lang) {
    return new Error(`Unknown language: ${langName}`);
  }
  const nestedParser = lang.createParser(this.yy.langMgr);
  const res = nestedParser.parse(this._input);
  if (res instanceof Error) {
    return res;
  }
  this.yy.messageQueue.push(res.value);
  this._input = res.remainingInput;
  return this.yy.Keywords.LANGSWITCH;
}
%}

"window"                 return this.yy.Keywords.WINDOW;
"where"                  return this.yy.Keywords.WHERE;
"when"                   return this.yy.Keywords.WHEN;
"unordered"              return this.yy.Keywords.UNORDERED;
"union"                  return this.yy.Keywords.UNION;
"tumbling"               return this.yy.Keywords.TUMBLING;
"to"                     return this.yy.Keywords.TO;
"then"                   return this.yy.Keywords.THEN;
"text"                   return this.yy.Keywords.TEXT;
"switch"                 return this.yy.Keywords.SWITCH;
"start"                  return this.yy.Keywords.START;
"stable"                 return this.yy.Keywords.STABLE;
"some"                   return this.yy.Keywords.SOME;
"sliding"                return this.yy.Keywords.SLIDING;
"self"                   return this.yy.Keywords.SELF;
"schema-element"         return this.yy.Keywords.SCHEMA_ELEMENT;
"schema-attribute"       return this.yy.Keywords.SCHEMA_ATTRIBUTE;
"satisfies"              return this.yy.Keywords.SATISFIES;
"return"                 return this.yy.Keywords.RETURN;
"processing-instruction" return this.yy.Keywords.PROC_INSTR;
"previous"               return this.yy.Keywords.PREVIOUS;
"preceding"              return this.yy.Keywords.PRECEDING;
"preceding-sibling"      return this.yy.Keywords.PRECEDING_SIBLING;
"parent"                 return this.yy.Keywords.PARENT;
"ordering"               return this.yy.Keywords.ORDERING;
"ordered"                return this.yy.Keywords.ORDERED;
"order"\s+"by"           return this.yy.Keywords.ORDERBY;
"order"                  return this.yy.Keywords.ORDER;
"or"                     return this.yy.Keywords.OR;
"only"                   return this.yy.Keywords.ONLY;
"node"                   return this.yy.Keywords.NODE;
"next"                   return this.yy.Keywords.NEXT;
"ne"                     return this.yy.Keywords.KW_NEQ;
"namespace"              return this.yy.Keywords.NAMESPACE;
"namespace-node"         return this.yy.Keywords.NAMESPACENODE;
"mod"                    return this.yy.Keywords.MOD;
"lt"                     return this.yy.Keywords.KW_LT;
"let"                    return this.yy.Keywords.LET;
"least"                  return this.yy.Keywords.LEAST;
"le"                     return this.yy.Keywords.KW_LTE;
"item"                   return this.yy.Keywords.ITEM;
"is"                     return this.yy.Keywords.IS;
"intersect"              return this.yy.Keywords.INTERSECT;
"instance"\s+"of"        return this.yy.Keywords.INSTANCEOF;
"in"                     return this.yy.Keywords.IN;
"if"                     return this.yy.Keywords.IF;
"idiv"                   return this.yy.Keywords.IDIV;
"gt"                     return this.yy.Keywords.KW_GT;
"group"\s+"by"           return this.yy.Keywords.GROUPBY;
"greatest"               return this.yy.Keywords.GREATEST;
"ge"                     return this.yy.Keywords.KW_GTE;
"function"               return this.yy.Keywords.FUNCTION;
"for"                    return this.yy.Keywords.FOR;
"following"              return this.yy.Keywords.FOLLOWING;
"following-sibling"      return this.yy.Keywords.FOLLOWING_SIBLING;
"except"                 return this.yy.Keywords.EXCEPT;
"every"                  return this.yy.Keywords.EVERY;
"eq"                     return this.yy.Keywords.KW_EQ;
"end"                    return this.yy.Keywords.END;
"empty-sequence"         return this.yy.Keywords.EMPTYSEQ;
"empty"                  return this.yy.Keywords.EMPTY;
"else"                   return this.yy.Keywords.ELSE;
"element"                return this.yy.Keywords.ELEMENT;
"document-node"          return this.yy.Keywords.DOCUMENT_NODE;
"div"                    return this.yy.Keywords.DIV;
"descending"             return this.yy.Keywords.DESCENDING;
"descendant"             return this.yy.Keywords.DESCENDANT;
"descendant-or-self"     return this.yy.Keywords.DESCENDANT_OR_SELF;
"default"                return this.yy.Keywords.DEFAULT;
"declare"                return this.yy.Keywords.DECLARE;
"count"                  return this.yy.Keywords.COUNT;
"comment"                return this.yy.Keywords.COMMENT;
"child"                  return this.yy.Keywords.CHILD;
"cast"                   return this.yy.Keywords.CAST;
"case"                   return this.yy.Keywords.CASE;
"base-uri"               return this.yy.Keywords.BASEURI;
"attribute"              return this.yy.Keywords.ATTRIBUTE;
"at"                     return this.yy.Keywords.AT;
"ascending"              return this.yy.Keywords.ASCENDING;
"as"                     return this.yy.Keywords.AS;
"and"                    return this.yy.Keywords.AND;
"ancestor"               return this.yy.Keywords.ANCESTOR;
"ancestor-or-self"       return this.yy.Keywords.ANCESTOR_OR_SELF;
"allowing"               return this.yy.Keywords.ALLOWING;

"Q{"({ENTITY}|[^&{}])*"}"{NAME1}{NAME}*  return this.yy.AdditionalTokens.QNAME;
{NAME1}{NAME}*":"{NAME1}{NAME}*          return this.yy.AdditionalTokens.QNAME;
{NAME1}{NAME}*                           return this.yy.AdditionalTokens.NCNAME;
"Q{"({ENTITY}|[^&{}])*"}*"               return this.yy.AdditionalTokens.QNAME_WILDCARD;
{NAME1}{NAME}*":*"                       return this.yy.AdditionalTokens.QNAME_WILDCARD;
"*:"{NAME1}{NAME}*                       return this.yy.AdditionalTokens.QNAME_WILDCARD;

[+-]?{DEC}*"."{DEC}+[Ee][+-]?{DEC}+ return this.yy.AdditionalTokens.NUMBER;
[+-]?{DEC}*"."{DEC}+ return this.yy.AdditionalTokens.NUMBER;
[+-]?{DEC}+		  return this.yy.AdditionalTokens.NUMBER;

[']([^']|[']['])*[']    return this.yy.AdditionalTokens.STRING;
["]([^"]|["]["])*["]    return this.yy.AdditionalTokens.STRING;


"(:"				    %{ this.pushState('blockc'); this.yy.comment = '(:'; %}
<blockc>"(:"    %{ this.yy.comment += '(:'; this.yy.commentDepth++; %}
<blockc>":)"	  %{
  this.yy.comment += ':)';
  if (!this.yy.commentDepth) {
    this.popState();
    this.yy.reportComment(this.yy.comment, {...this.yyloc});
  } else this.yy.commentDepth--; 
%}
<blockc>.|\n       this.yy.comment += yytext;
<blockc><<EOF>> %{ this.popState(); return new Error('Unexpected end of file'); %}

"," 			return this.yy.AdditionalTokens.COMMA;
"."				return this.yy.AdditionalTokens.DOT;
"$"       return this.yy.AdditionalTokens.DOLLAR;
"("				return this.yy.AdditionalTokens.LPAR;
")"				this.yy.saveRemainingInput(')' + this._input); return this.yy.AdditionalTokens.RPAR;
"[]"      return this.yy.AdditionalTokens.CLOSEDBRAS;
"["				return this.yy.AdditionalTokens.LBRA;
"]"				this.yy.saveRemainingInput(']' + this._input); return this.yy.AdditionalTokens.RBRA;
"}"				this.yy.saveRemainingInput('}' + this._input); return this.yy.AdditionalTokens.RCUR;
"*"				return this.yy.AdditionalTokens.STAR;
";" 			return this.yy.AdditionalTokens.SEMICOLON;
"::" 			return this.yy.AdditionalTokens.DBLCOLON;
":=" 		  return this.yy.AdditionalTokens.COLONEQ;
":" 		  return this.yy.AdditionalTokens.COLON;
"+"	  		return this.yy.AdditionalTokens.PLUS;
"-" 			return this.yy.AdditionalTokens.MINUS;
"//"      return this.yy.AdditionalTokens.DBLSLASH;
"/" 			return this.yy.AdditionalTokens.SLASH;
"^"				return this.yy.AdditionalTokens.EXP;
"=" 			return this.yy.AdditionalTokens.EQ;
"!="|"<>" return this.yy.AdditionalTokens.NEQ;
">="      return this.yy.AdditionalTokens.GTE;
"<="      return this.yy.AdditionalTokens.LTE;
">>"      return this.yy.AdditionalTokens.SHIFTR;
"<<"      return this.yy.AdditionalTokens.SHIFTL;
">"       return this.yy.AdditionalTokens.GT;
"<"       return this.yy.AdditionalTokens.LT;
"||"      return this.yy.AdditionalTokens.DBLPIPE;
"|"       return this.yy.AdditionalTokens.PIPE;
"?"       return this.yy.AdditionalTokens.QUESTION;
"!"       return this.yy.AdditionalTokens.EMPH;
"@"       return this.yy.AdditionalTokens.AT_SIGN;


\s+       /* skip whitespace */
