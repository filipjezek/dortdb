import { DortDB, Language, LogicalPlanVisitor } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { XQuery } from '@dortdb/lang-xquery';
import { GraphBuilder } from './graph-builder.js';

const langs = new Map<string, Language>([
  ['sql', SQL],
  ['xquery', XQuery],
]);
let db: DortDB<'sql' | 'xquery'>;

function swapLang(lang: string) {
  const newLang = langs.get(lang);
  if (!newLang) return;
  db = new DortDB({
    mainLang: newLang,
    additionalLangs: Array.from(langs.values()).filter((l) => l !== newLang),
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const textarea = document.getElementById('code-input') as HTMLTextAreaElement;
  const parseButton = document.getElementById('action-parse');
  const errorOutput = document.getElementById('error-output');
  const langSelect = document.querySelector<HTMLSelectElement>(
    'select[name="lang"]'
  );
  const langIndicatorOptions = Array.from(
    document.querySelectorAll<HTMLInputElement>('[name="lang-indicator-type"]')
  );
  const svg = document.getElementById('svg-output') as any as SVGSVGElement;
  const vmap: Record<string, LogicalPlanVisitor<SVGGElement>> = {};
  const treeBuilder = new GraphBuilder(svg, vmap);
  vmap['sql'] = vmap['xquery'] = vmap['cypher'] = treeBuilder;
  swapLang(langSelect.value);

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
      const plan = db.buildPlan(ast.value[0]);
      console.log(plan);
      treeBuilder.drawTree(plan);
    } catch (err) {
      handleError(err as any);
    }
  }

  parseButton.addEventListener('click', (e) => {
    e.preventDefault();
    parse();
  });
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      parse();
    }
  });
  langSelect.addEventListener('change', () => {
    swapLang(langSelect.value);
  });
  for (const option of langIndicatorOptions) {
    svg.classList.toggle(option.value, option.checked);
    option.addEventListener('change', () => {
      svg.classList.toggle(option.value, option.checked);
    });
  }
});
