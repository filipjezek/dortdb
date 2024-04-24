import { Language } from '@dortdb/core';
import { sqlLexer as Lexer, sqlParser as Parser } from './sql.js';
import { Keywords, AdditionalTokens } from './tokens.js';
import { YyContext } from './yycontext.js';

export const SQL: Language<'sql'> = {
  name: 'sql',
  operators: [],
  aggregators: [],
  functions: [],
  createParser: (mgr) => {
    const yy: YyContext = {
      Keywords,
      AdditionalTokens,
      reportComment: () => {},
      commentDepth: 0,
      comment: '',
      strContent: '',
      delimiter: '',
      langMgr: mgr,
      messageQueue: [],
    };
    const parser = new Parser(yy, new Lexer(yy));
    return {
      parse: (input: string) => {
        const result = parser.parse(input);
        return {
          value: result,
          remainingInput: (parser.lexer as any)._input,
        };
      },
    };
  },
};
