%options case-insensitive easy_keyword_rules ranges

ID1				[a-z_]
ID				[0-9a-z_$]
HEX				[0-9a-fA-F]
BIN				[01]
OCT				[0-7]
DEC       [0-9]

%%

"YIELD"       return this.yy.Keywords.YIELD;
"XOR"         return this.yy.Keywords.XOR;
"WITH"        return this.yy.Keywords.WITH;
"WHERE"       return this.yy.Keywords.WHERE;
"WHEN"        return this.yy.Keywords.WHEN;
"UNWIND"      return this.yy.Keywords.UNWIND;
"UNIQUE"      return this.yy.Keywords.UNIQUE;
"UNION"       return this.yy.Keywords.UNION;
"TRUE"        return this.yy.Keywords.TRUE;
"THEN"        return this.yy.Keywords.THEN;
"STARTS"      return this.yy.Keywords.STARTS;
"SKIP"        return this.yy.Keywords.SKIP;
"SINGLE"      return this.yy.Keywords.SINGLE;
"SET"         return this.yy.Keywords.SET;
"SCALAR"      return this.yy.Keywords.SCALAR;
"RETURN"      return this.yy.Keywords.RETURN;
"REQUIRE"     return this.yy.Keywords.REQUIRE;
"REMOVE"      return this.yy.Keywords.REMOVE;
"ORDER"       return this.yy.Keywords.ORDER;
"OR"          return this.yy.Keywords.OR;
"OPTIONAL"    return this.yy.Keywords.OPTIONAL;
"ON"          return this.yy.Keywords.ON;
"OF"          return this.yy.Keywords.OF;
"NULL"        return this.yy.Keywords.NULL;
"NOT"         return this.yy.Keywords.NOT;
"NONE"        return this.yy.Keywords.NONE;
"MERGE"       return this.yy.Keywords.MERGE;
"MATCH"       return this.yy.Keywords.MATCH;
"MANDATORY"   return this.yy.Keywords.MANDATORY;
"LIMIT"       return this.yy.Keywords.LIMIT;
"IS"          return this.yy.Keywords.IS;
"IN"          return this.yy.Keywords.IN;
"FOR"         return this.yy.Keywords.FOR;
"FALSE"       return this.yy.Keywords.FALSE;
"EXISTS"      return this.yy.Keywords.EXISTS;
"ENDS"        return this.yy.Keywords.ENDS;
"END"         return this.yy.Keywords.END;
"ELSE"        return this.yy.Keywords.ELSE;
"DROP"        return this.yy.Keywords.DROP;
"DO"          return this.yy.Keywords.DO;
"DISTINCT"    return this.yy.Keywords.DISTINCT;
"DETACH"      return this.yy.Keywords.DETACH;
"DESCENDING"  return this.yy.Keywords.DESCENDING;
"DESC"        return this.yy.Keywords.DESC;
"DELETE"      return this.yy.Keywords.DELETE;
"CREATE"      return this.yy.Keywords.CREATE;
"COUNT"       return this.yy.Keywords.COUNT;
"CONTAINS"    return this.yy.Keywords.CONTAINS;
"CONSTRAINT"  return this.yy.Keywords.CONSTRAINT;
"CASE"        return this.yy.Keywords.CASE;
"CALL"        return this.yy.Keywords.CALL;
"BY"          return this.yy.Keywords.BY;
"ASCENDING"   return this.yy.Keywords.ASCENDING;
"ASC"         return this.yy.Keywords.ASC;
"AS"          return this.yy.Keywords.AS;
"ANY"         return this.yy.Keywords.ANY;
"AND"         return this.yy.Keywords.AND;
"ALL"         return this.yy.Keywords.ALL;
"ADD"         return this.yy.Keywords.ADD;

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
  return this.yy.AdditionalTokens.LANGSWITCH;
}
%}

\s+                 /* skip whitespace */