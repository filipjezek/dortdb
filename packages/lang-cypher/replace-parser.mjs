import fs from 'fs';
import path from 'path';

const parserLocation = path.join(import.meta.dirname, 'src/parser/cypher.cjs');
let contents = fs.readFileSync(parserLocation, { encoding: 'utf8' });
const replacements = {
  __id_start__: '\\p{ID_Start}\\p{Pc}',
  __id_continue__: '\\p{ID_Continue}\\p{Sc}',
  '/i': '/ui',
};

for (const [key, value] of Object.entries(replacements)) {
  const regex = new RegExp(key, 'g');
  contents = contents.replace(regex, value);
}

fs.writeFileSync(parserLocation, contents, { encoding: 'utf8' });
console.log('Replacements applied to Cypher parser');
