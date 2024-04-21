import { sqlLexer as Lexer, sqlParser as Parser } from './parser/sql.js';
import { Keywords, AdditionalTokens } from './parser/tokens.js';

const yy = {
  Keywords,
  AdditionalTokens,
  reportComment: () => {},
  commentDepth: 0,
  comment: '',
  strContent: '',
  delimiter: '',
};

const lexer: Lexer = new Lexer(yy);

lexer.setInput('SELECT * FROM table WHERE id = $aaa$f$a$oo$aaa$', yy);

let token: any;
do {
  token = lexer.lex();
  console.log('token', token, 'text', lexer.yytext);
} while (token !== 1);
