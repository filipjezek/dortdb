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

"WITHIN" return this.yy.Keywords.WITHIN;
"WITH" return this.yy.Keywords.WITH;
"WINDOW" return this.yy.Keywords.WINDOW;
"WHERE"  return this.yy.Keywords.WHERE;
"WHEN" return this.yy.Keywords.WHEN;
"VALUES" return this.yy.Keywords.VALUES;
"USING"  return this.yy.Keywords.USING;
"UNION"  return this.yy.Keywords.UNION;
"UNBOUNDED" return this.yy.Keywords.UNBOUNDED;
"TO" return this.yy.Keywords.TO;
"TRUE"  return this.yy.Keywords.TRUE;
"TIES" return this.yy.Keywords.TIES;
"THEN" return this.yy.Keywords.THEN;
"SOME" return this.yy.Keywords.ANY;
"SET" return this.yy.Keywords.SET;
"SELECT"  return this.yy.Keywords.SELECT;
"SEARCH" return this.yy.Keywords.SEARCH;
"ROWS" return this.yy.Keywords.ROWS;
"ROW" return this.yy.Keywords.ROW;
"ROLLUP"  return this.yy.Keywords.ROLLUP;
"RIGHT"  return this.yy.Keywords.RIGHT;
"RECURSIVE" return this.yy.Keywords.RECURSIVE;
"RANGE" return this.yy.Keywords.RANGE;
"PRECEDING" return this.yy.Keywords.PRECEDING;
"PARTITION" return this.yy.Keywords.PARTITION;
"OVER" return this.yy.Keywords.OVER;
"OUTER"  return this.yy.Keywords.OUTER;
"OR"  return this.yy.Keywords.OR;
"ORDINALITY" return this.yy.Keywords.ORDINALITY;
"ORDER"\s+"BY"  return this.yy.Keywords.ORDERBY;
"OPERATOR"  return this.yy.Keywords.OPERATOR;
"ON"  return this.yy.Keywords.ON;
"OFFSET"  return this.yy.Keywords.OFFSET;
"NULLS" return this.yy.Keywords.NULLS;
"NULL"  return this.yy.Keywords.NULL;
"NOT"  return this.yy.Keywords.NOT;
"NO"\s+"OTHERS" return this.yy.Keywords.NOOTHERS;
"NATURAL"  return this.yy.Keywords.NATURAL;
"MATERIALIZED" return this.yy.Keywords.MATERIALIZED;
"LIMIT"  return this.yy.Keywords.LIMIT;
"LIKE"  return this.yy.Keywords.LIKE;
"LEFT"  return this.yy.Keywords.LEFT;
"LATERAL"  return this.yy.Keywords.LATERAL;
"LAST" return this.yy.Keywords.LAST;
"JOIN"  return this.yy.Keywords.JOIN;
"IS"  return this.yy.Keywords.IS;
"INTERSECT"  return this.yy.Keywords.INTERSECT;
"INNER"  return this.yy.Keywords.INNER;
"IN"  return this.yy.Keywords.IN;
"ILIKE"  return this.yy.Keywords.ILIKE;
"HAVING"  return this.yy.Keywords.HAVING;
"GROUPS" return this.yy.Keywords.GROUPS;
"GROUPING"\s+"SETS"  return this.yy.Keywords.GROUPINGSETS;
"GROUP"  return this.yy.Keywords.GROUP;
"FULL"  return this.yy.Keywords.FULL;
"FROM"  return this.yy.Keywords.FROM;
"FOLLOWING" return this.yy.Keywords.FOLLOWING;
"FIRST" return this.yy.Keywords.FIRST;
"FILTER" return this.yy.Keywords.FILTER;
"FALSE"  return this.yy.Keywords.FALSE;
"EXISTS"  return this.yy.Keywords.EXISTS;
"EXCLUDE" return this.yy.Keywords.EXCLUDE;
"EXCEPT"  return this.yy.Keywords.EXCEPT;
"END" return this.yy.Keywords.END;
"ELSE" return this.yy.Keywords.ELSE;
"DISTINCT"  return this.yy.Keywords.DISTINCT;
"DESC"  return this.yy.Keywords.DESC;
"DEPTH" return this.yy.Keywords.DEPTH;
"DEFAULT" return this.yy.Keywords.DEFAULT;
"CYCLE" return this.yy.Keywords.CYCLE;
"CURRENT" return this.yy.Keywords.CURRENT;
"CUBE"  return this.yy.Keywords.CUBE;
"CROSS"  return this.yy.Keywords.CROSS;
"CAST"  return this.yy.Keywords.CAST;
"CASE" return this.yy.Keywords.CASE;
"BY" return this.yy.Keywords.BY;
"BREADTH" return this.yy.Keywords.BREADTH;
"BETWEEN"  return this.yy.Keywords.BETWEEN;
"ASC"  return this.yy.Keywords.ASC;
"AS"  return this.yy.Keywords.AS;
"ARRAY" return this.yy.Keywords.ARRAY;
"ANY" return this.yy.Keywords.ANY;
"AND"  return this.yy.Keywords.AND;
"ALL"  return this.yy.Keywords.ALL;

"LANG"\s+"EXIT" this.yy.saveRemainingInput(this._input); return this.yy.AdditionalTokens.LANGEXIT;
"LANG"\s+({ID}+) %{
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
{DEC}+"."{DEC}+"e"{DEC}+ return this.yy.AdditionalTokens.NUMBER;
{DEC}+"."{DEC}+ return this.yy.AdditionalTokens.NUMBER;
{DEC}+		  return this.yy.AdditionalTokens.NUMBER;

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
"::" 			return this.yy.AdditionalTokens.DBLCOLON;
":" 		  return this.yy.AdditionalTokens.COLON;
"+"	  		return this.yy.AdditionalTokens.PLUS;
"-" 			return this.yy.AdditionalTokens.MINUS;
"/" 			return this.yy.AdditionalTokens.DIV;
"%" 			return this.yy.AdditionalTokens.MOD;
"^"				return this.yy.AdditionalTokens.EXP;
"=" 			return this.yy.AdditionalTokens.EQ;
"!="|"<>" return this.yy.AdditionalTokens.NEQ;
">="      return this.yy.AdditionalTokens.GTE;
"<="      return this.yy.AdditionalTokens.LTE;
">"       return this.yy.AdditionalTokens.GT;
"<"       return this.yy.AdditionalTokens.LT;

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
    yytext = this.yy.delimiter + this.yy.strContent;
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
