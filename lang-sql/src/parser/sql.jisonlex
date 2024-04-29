%options case-insensitive easy_keyword_rules ranges

ID1				[a-z_]
ID				[0-9a-z_$]
HEX				[0-9a-fA-F]
BIN				[01]
OCT				[0-7]
DEC       [0-9]

%x dollarPreamble
%x dollarInner
%x linec
%x blockc

%%

"," 			return this.yy.AdditionalTokens.COMMA;
".*"      return this.yy.AdditionalTokens.DOTSTAR;
"."				return this.yy.AdditionalTokens.DOT;
"("				return this.yy.AdditionalTokens.LPAR;
")"				this.yy.saveRemainingInput(')' + this._input); return this.yy.AdditionalTokens.RPAR;
"[]"      return this.yy.AdditionalTokens.CLOSEDBRAS;
"["				return this.yy.AdditionalTokens.LBRA;
"]"				this.yy.saveRemainingInput(']' + this._input); return this.yy.AdditionalTokens.RBRA;
"}"				this.yy.saveRemainingInput('}' + this._input); return this.yy.AdditionalTokens.RCUR;
"*"				return this.yy.AdditionalTokens.STAR;
";" 			return this.yy.AdditionalTokens.SEMICOLON;
":" 		  return this.yy.AdditionalTokens.COLON;
"::" 			return this.yy.AdditionalTokens.DBLCOLON;
"+"	  		return this.yy.AdditionalTokens.PLUS;
"-" 			return this.yy.AdditionalTokens.MINUS;
"/" 			return this.yy.AdditionalTokens.DIV;
"%" 			return this.yy.AdditionalTokens.MOD;
"^"				return this.yy.AdditionalTokens.EXP;
"=" 			return this.yy.AdditionalTokens.EQ;
"!="|"<>" return this.yy.AdditionalTokens.NEQ;
">"       return this.yy.AdditionalTokens.GT;
"<"       return this.yy.AdditionalTokens.LT;
">="      return this.yy.AdditionalTokens.GTE;
"<="      return this.yy.AdditionalTokens.LTE;


"SELECT"  return this.yy.Keywords.SELECT;
"ALL"  return this.yy.Keywords.ALL;
"DISTINCT"  return this.yy.Keywords.DISTINCT;
"AS"  return this.yy.Keywords.AS;
"FROM"  return this.yy.Keywords.FROM;
"WHERE"  return this.yy.Keywords.WHERE;
"GROUP BY"  return this.yy.Keywords.GROUPBY;
"ROLLUP"  return this.yy.Keywords.ROLLUP;
"CUBE"  return this.yy.Keywords.CUBE;
"GROUPING SETS"  return this.yy.Keywords.GROUPINGSETS;
"HAVING"  return this.yy.Keywords.HAVING;
"UNION"  return this.yy.Keywords.UNION;
"INTERSECT"  return this.yy.Keywords.INTERSECT;
"EXCEPT"  return this.yy.Keywords.EXCEPT;
"ORDER BY"  return this.yy.Keywords.ORDERBY;
"LIMIT"  return this.yy.Keywords.LIMIT;
"OFFSET"  return this.yy.Keywords.OFFSET;
"JOIN"  return this.yy.Keywords.JOIN;
"INNER"  return this.yy.Keywords.INNER;
"LEFT"  return this.yy.Keywords.LEFT;
"RIGHT"  return this.yy.Keywords.RIGHT;
"FULL"  return this.yy.Keywords.FULL;
"OUTER"  return this.yy.Keywords.OUTER;
"ON"  return this.yy.Keywords.ON;
"CROSS"  return this.yy.Keywords.CROSS;
"NATURAL"  return this.yy.Keywords.NATURAL;
"USING"  return this.yy.Keywords.USING;

"AND"  return this.yy.Keywords.AND;
"OR"  return this.yy.Keywords.OR;
"NOT"  return this.yy.Keywords.NOT;
"IS"  return this.yy.Keywords.IS;
"NULL"  return this.yy.Keywords.NULL;
"TRUE"  return this.yy.Keywords.TRUE;
"FALSE"  return this.yy.Keywords.FALSE;
"BETWEEN"  return this.yy.Keywords.BETWEEN;
"IN"  return this.yy.Keywords.IN;
"LIKE"  return this.yy.Keywords.LIKE;
"ILIKE"  return this.yy.Keywords.ILIKE;
"CAST"  return this.yy.Keywords.CAST;
"OPERATOR"  return this.yy.Keywords.OPERATOR;
"ASC"  return this.yy.Keywords.ASC;
"DESC"  return this.yy.Keywords.DESC;
"ARRAY" return this.yy.Keywords.ARRAY;
"ANY"|"SOME" return this.yy.Keywords.ANY;
"NULLS" return this.yy.Keywords.NULLS;
"FIRST" return this.yy.Keywords.FIRST;
"LAST" return this.yy.Keywords.LAST;

"LANG EXIT" this.yy.saveRemainingInput(this._input); return this.yy.AdditionalTokens.LANGEXIT;
"LANG "({ID}+) %{
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



{ID1}({ID})* 	return this.yy.AdditionalTokens.ID;
["]{ID1}({ID})*["] 	return this.yy.AdditionalTokens.ID;
0x{HEX}+		return this.yy.AdditionalTokens.NUMBER;
0b{BIN}+		return this.yy.AdditionalTokens.NUMBER;
0o{OCT}+		return this.yy.AdditionalTokens.NUMBER;
{DEC}+		  return this.yy.AdditionalTokens.NUMBER;

[']([^']|[']['])*[']    return this.yy.AdditionalTokens.STRING;

"$"								      %{ this.pushState('dollarPreamble'); this.yy.strContent = ''; this.yy.delimiter = yytext; %}
<dollarPreamble>"$"	    %{ this.popState(); this.pushState('dollarInner'); this.yy.delimiter += yytext; %}
<dollarPreamble>.		    this.yy.delimiter += yytext;
<dollarPreamble><<EOF>>	%{ this.popState(); return new Error('Unexpected end of file'); %}
<dollarInner><<EOF>>	  %{ this.popState(); return new Error('Unexpected end of file'); %}
<dollarInner>.          %{
  this.yy.strContent += yytext;
  if (this.yy.strContent.endsWith(this.yy.delimiter)) {
    this.popState();
    yytext = this.yy.strContent.slice(0, -this.yy.delimiter.length);
    return this.yy.AdditionalTokens.STRING;
  }
%}


"--"					%{ this.pushState('linec'); this.yy.comment = '--'; %}
<linec>\n		  %{ this.yy.reportComment(this.yy.comment, {...this.yyloc}); this.popState(); %}
<linec>.      this.yy.comment += yytext;


"/*"				    %{ this.pushState('blockc'); this.yy.comment = '/*'; %}
<blockc>"/*"    %{ this.yy.comment += '/*'; this.yy.commentDepth++; %}
<blockc>"*/"	  %{
  this.yy.comment += '*/';
  if (!this.yy.commentDepth) {
    this.popState();
    this.yy.reportComment(this.yy.comment, {...this.yyloc});
  } else this.yy.commentDepth--; 
%}
<blockc>.       this.yy.comment += yytext;
<blockc><<EOF>> %{ this.popState(); return new Error('Unexpected end of file'); %}


([+*/<>=-])+[*/<>=] return this.yy.AdditionalTokens.USEROP;
[+*/<>=~!@#%^&|`?-]*[~!@#%^&|`?][+*/<>=~!@#%^&|`?-]* return this.yy.AdditionalTokens.USEROP;
\s+                 /* skip whitespace */
