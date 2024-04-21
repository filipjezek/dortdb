import { sqlParser as Parser, sqlLexer } from './sql.js';
import { ASTNode } from '@dortdb/core';

const parser = new Parser({}, new sqlLexer());
parser.parse('SELECT * FROM table WHERE id = 1');
