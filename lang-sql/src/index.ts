import { LanguageManager } from '@dortdb/core';
import { sqlLexer as Lexer, sqlParser as Parser } from './parser/sql.js';
import { Keywords, AdditionalTokens } from './parser/tokens.js';
import { YyContext } from './parser/yycontext.js';

const yy: YyContext = {
  Keywords,
  AdditionalTokens,
  reportComment: () => {},
  commentDepth: 0,
  comment: '',
  strContent: '',
  delimiter: '',
  langMgr: new LanguageManager(),
  messageQueue: [],
};

const lexer: Lexer = new Lexer(yy);
const parser = new Parser(yy, lexer);

console.log(parser.parse('SELECT * FROM table WHERE id = $aaa$f$a$oo$aaa$'));

export { SQL } from './parser/language.js';
