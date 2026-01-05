import { ASTIdentifier } from '../../ast.js';
import * as plan from '../../plan/operators/index.js';
import { DortDB } from '../../db.js';
import { mockLang } from '../../testing/mock-lang.js';
import { intermediateToCalc } from '../../utils/calculation.js';
import { CalculationBuilder } from '../../visitors/calculation-builder.js';
import { EqualityChecker } from '../../visitors/equality-checker.js';
import { MergeProjections } from './merge-projections.js';

function strToId(...strs: (string | symbol)[]): ASTIdentifier {
  return ASTIdentifier.fromParts(strs);
}

describe('MergeProjections', () => {
  let db: DortDB;
  let eqChecker: EqualityChecker;
  const lang = mockLang.name;
  const sourceName = ASTIdentifier.fromParts(['test', 'source']);
  let calcBuilders: Record<string, CalculationBuilder>;
  let source: plan.TupleSource;

  const strToCalc = (str: string, additionalDeps: (string | symbol)[][] = []) =>
    intermediateToCalc(
      new plan.FnCall(
        lang,
        [strToId(str), ...additionalDeps.map(ASTIdentifier.fromParts)],
        (...args) => `(${args.join(',')})`,
      ),
      calcBuilders,
      {
        [lang]: eqChecker,
      },
    );
  const cloneCalc = (
    newArgs: (string | symbol)[][],
    original: plan.Calculation,
  ) => {
    const calc = strToCalc(newArgs[0][0] as string, newArgs.slice(1));
    calc.impl = original.impl;
    (calc.original as plan.FnCall).impl = (
      original.original as plan.FnCall
    ).impl;
    return calc;
  };

  beforeEach(() => {
    db = new DortDB({
      mainLang: mockLang,
      optimizer: {
        rules: [MergeProjections],
      },
    });
    db.registerSource(sourceName.parts, []);
    const vmap: Record<string, EqualityChecker> = {};
    eqChecker = vmap[lang] = new EqualityChecker(vmap);
    calcBuilders = (db as any).friendInterface.langMgr.getVisitorMap(
      'calculationBuilder',
    );
    source = new plan.TupleSource(lang, sourceName);
  });

  it('should merge renames', () => {
    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [strToId('aaa'), strToId('bbb')],
          [strToId('bbb'), strToId('aaa')],
          [strToId('ccc'), strToId('ccc')],
        ],
        new plan.Projection(
          lang,
          [
            [strToId('aa'), strToId('aaa')],
            [strToId('bb'), strToId('bbb')],
            [strToId('cc'), strToId('ccc')],
          ],
          new plan.Projection(
            lang,
            [
              [strToId('a'), strToId('aa')],
              [strToId('b'), strToId('bb')],
              [strToId('c'), strToId('cc')],
            ],
            source.clone(),
          ),
        ),
      ),
    );
    const optimized = db.optimizer.optimize(initialPlan);
    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [strToId('a'), strToId('bbb')],
          [strToId('b'), strToId('aaa')],
          [strToId('c'), strToId('ccc')],
        ],
        source.clone(),
      ),
    );
    expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
  });

  it('should merge projections with calculations', () => {
    const calcA = strToCalc('aa', [['bb']]);
    const calcB = strToCalc('ccc');
    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [strToId('aaa'), strToId('bbb')],
          [strToId('bbb'), strToId('aaa')],
          [calcB, strToId('calcB')],
        ],
        new plan.Projection(
          lang,
          [
            [calcA, strToId('aaa')],
            [strToId('bb'), strToId('bbb')],
            [strToId('cc'), strToId('ccc')],
          ],
          new plan.Projection(
            lang,
            [
              [strToId('a'), strToId('aa')],
              [strToId('b'), strToId('bb')],
              [strToId('c'), strToId('cc')],
            ],
            source.clone(),
          ),
        ),
      ),
    );
    const optimized = db.optimizer.optimize(initialPlan);

    const clonedCalcA = cloneCalc([['a'], ['b']], calcA);
    const clonedCalcB = cloneCalc([['c']], calcB);

    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [clonedCalcA, strToId('bbb')],
          [strToId('b'), strToId('aaa')],
          [clonedCalcB, strToId('calcB')],
        ],
        source.clone(),
      ),
    );

    expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
  });

  it('should not merge projections if calculations would be duplicated', () => {
    const calcA = strToCalc('aa');
    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [strToId('aaa'), strToId('bbb')],
          [strToId('aaa'), strToId('aaa')],
          [strToId('bbb'), strToId('b')],
          [strToId('ccc'), strToId('ccc')],
        ],
        new plan.Projection(
          lang,
          [
            [calcA, strToId('aaa')],
            [strToId('bb'), strToId('bbb')],
            [strToId('cc'), strToId('ccc')],
          ],
          new plan.Projection(
            lang,
            [
              [strToId('a'), strToId('aa')],
              [strToId('b'), strToId('bb')],
              [strToId('c'), strToId('cc')],
            ],
            source.clone(),
          ),
        ),
      ),
    );
    const optimized = db.optimizer.optimize(initialPlan);

    const clonedCalcA = cloneCalc([['a']], calcA);
    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [strToId('aaa'), strToId('bbb')],
          [strToId('aaa'), strToId('aaa')],
          [strToId('bbb'), strToId('b')],
          [strToId('ccc'), strToId('ccc')],
        ],
        new plan.Projection(
          lang,
          [
            [clonedCalcA, strToId('aaa')],
            [strToId('b'), strToId('bbb')],
            [strToId('c'), strToId('ccc')],
          ],
          source.clone(),
        ),
      ),
    );

    expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
  });

  it('should filter out unused attributes', () => {
    const calcA = strToCalc('aa');
    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [strToId('aaa'), strToId('bbb')],
          [strToId('aaa'), strToId('aaa')],
          [strToId('bbb'), strToId('b')],
          [strToId('ccc'), strToId('ccc')],
        ],
        new plan.Projection(
          lang,
          [
            [calcA, strToId('aaa')],
            [strToId('bb'), strToId('bbb')],
            [strToId('cc'), strToId('ccc')],
            [strToId('dd'), strToId('ddd')],
          ],
          new plan.Projection(
            lang,
            [
              [strToId('a'), strToId('aa')],
              [strToId('b'), strToId('bb')],
              [strToId('c'), strToId('cc')],
              [strToId('d'), strToId('dd')],
              [strToId('e'), strToId('ee')],
            ],
            source.clone(),
          ),
        ),
      ),
    );
    const optimized = db.optimizer.optimize(initialPlan);

    const clonedCalcA = cloneCalc([['a']], calcA);
    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [strToId('aaa'), strToId('bbb')],
          [strToId('aaa'), strToId('aaa')],
          [strToId('bbb'), strToId('b')],
          [strToId('ccc'), strToId('ccc')],
        ],
        new plan.Projection(
          lang,
          [
            [clonedCalcA, strToId('aaa')],
            [strToId('b'), strToId('bbb')],
            [strToId('c'), strToId('ccc')],
          ],
          source.clone(),
        ),
      ),
    );

    expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
  });

  it('should merge consecutive calculations into one', () => {
    const calcA = strToCalc('calcB', [['calcC']]);
    const calcB = strToCalc('b');
    const calcC = strToCalc('calcD');
    const calcD = strToCalc('d');
    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [[calcA, strToId('calcA')]],
        new plan.Projection(
          lang,
          [
            [strToId('calcB'), strToId('calcB')],
            [calcC, strToId('calcC')],
          ],
          new plan.Projection(
            lang,
            [
              [calcB, strToId('calcB')],
              [calcD, strToId('calcD')],
            ],
            source.clone(),
          ),
        ),
      ),
    );
    const optimized = db.optimizer.optimize(initialPlan);

    const resultCalc = intermediateToCalc(
      new plan.FnCall(
        lang,
        [
          { op: new plan.FnCall(lang, [strToId('b')], calcB.impl) },
          {
            op: new plan.FnCall(
              lang,
              [{ op: new plan.FnCall(lang, [strToId('d')], calcD.impl) }],
              calcC.impl,
            ),
          },
        ],
        calcA.impl,
      ),
      calcBuilders,
      {
        [lang]: eqChecker,
      },
    );

    expect((optimized as any).source.attrs[0][0].impl('b', 'd')).toBe(
      '((b),((d)))',
    );
    expect(resultCalc.impl('b', 'd')).toBe('((b),((d)))');

    // function implementations are compared by reference
    resultCalc.impl = (optimized as any).source.attrs[0][0].impl;
    (resultCalc.original as any).impl = (
      optimized as any
    ).source.attrs[0][0].original.impl;
    (resultCalc.original as any).args[1].op.impl = (
      optimized as any
    ).source.attrs[0][0].original.args[1].op.impl;
    (resultCalc.original as any).args[0].op.impl = (
      optimized as any
    ).source.attrs[0][0].original.args[0].op.impl;
    (resultCalc.original as any).args[1].op.args[0].op.impl = (
      optimized as any
    ).source.attrs[0][0].original.args[1].op.args[0].op.impl;

    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [[resultCalc, strToId('calcA')]],
        source.clone(),
      ),
    );

    expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    expect((optimized as any).source.attrs[0][0].impl('b', 'd')).toBe(
      '((b),((d)))',
    );
  });
});
