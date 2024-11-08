import { DortDB } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { SQL } from '@dortdb/lang-sql';
import { XQuery } from '@dortdb/lang-xquery';

const db = new DortDB({
  mainLang: SQL,
  additionalLangs: [XQuery, Cypher],
});

document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('code-input') as HTMLTextAreaElement;
  const parseButton = document.getElementById('action-parse');
  const errorOutput = document.getElementById('error-output');

  function clearOutput() {
    errorOutput.classList.add('hidden');
    errorOutput.textContent = '';
  }
  function handleError(err: Error) {
    errorOutput.classList.remove('hidden');
    errorOutput.textContent = err.message;
    console.error(err);
  }
  function parse() {
    if (!textarea.value) return;
    clearOutput();
    try {
      const ast = db.parse(textarea.value);
      console.log(ast);
    } catch (err) {
      handleError(err as any);
    }
  }

  parseButton.addEventListener('click', () => {
    parse();
  });
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      parse();
    }
  });
});
