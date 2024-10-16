import { DortDB } from '@dortdb/core';
import { XQuery } from './language.js';

export { XQuery } from './language.js';

export * from './ast/index.js';
export * from './ast/visitor.js';

import { inspect } from 'util';

const db = new DortDB({
  mainLang: XQuery,
});
console.log(
  inspect(db.parse('<?format  foo="3"?>').value.body, {
    colors: true,
    depth: null,
  })
);
// console.log(
//   inspect(
//     db.parse('<a foo="1234 {1 + 1}"><b><c x="11" /></b></a>').value.body,
//     {
//       colors: true,
//       depth: null,
//     }
//   )
// );
