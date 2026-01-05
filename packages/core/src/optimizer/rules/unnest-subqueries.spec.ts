import { DortDB } from '../../db.js';
import * as plan from '../../plan/operators/index.js';
import { ASTIdentifier } from '../../ast.js';
import { EqualityChecker } from '../../visitors/equality-checker.js';
import { mockLang } from '../../testing/mock-lang.js';
import { intermediateToCalc } from '../../utils/calculation.js';
import { CalculationBuilder } from '../../visitors/calculation-builder.js';
import { unnestedAttr, UnnestSubqueries } from './unnest-subqueries.js';
import { assertMaxOne } from '../../internal-fns/index.js';
import { or } from '../../operators/index.js';

function strToId(...strs: (string | symbol)[]): ASTIdentifier {
  return ASTIdentifier.fromParts(strs);
}

describe('UnnestSubqueries', () => {
  let db: DortDB;
  let eqChecker: EqualityChecker;
  const lang = mockLang.name;
  let source: plan.TupleSource;
  let source2: plan.ItemSource;
  let calcBuilders: Record<string, CalculationBuilder>;

  const joinArgs = (...args: any[]) => `(${args.join(',')})`;
  const strToCalc = (
    str: string | symbol | (string | symbol)[],
    additionalDeps: (string | symbol)[][] = [],
  ) =>
    intermediateToCalc(
      new plan.FnCall(
        lang,
        [
          strToId(...(Array.isArray(str) ? str : [str])),
          ...additionalDeps.map(ASTIdentifier.fromParts),
        ],
        joinArgs,
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
    const calc = strToCalc(newArgs[0], newArgs.slice(1));
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
        rules: [UnnestSubqueries],
      },
    });
    const vmap: Record<string, EqualityChecker> = {};
    eqChecker = vmap[lang] = new EqualityChecker(vmap);
    calcBuilders = (db as any).friendInterface.langMgr.getVisitorMap(
      'calculationBuilder',
    );
    source = new plan.TupleSource(lang, strToId('test', 'source'));
    source.addToSchema([strToId('a'), strToId('b')]);
    source2 = new plan.ItemSource(lang, strToId('test', 'source2'));
  });

  it('should unnest a subquery', () => {
    const calc = intermediateToCalc(
      new plan.FnCall(lang, [strToId('a'), { op: source2.clone() }], joinArgs),
      calcBuilders,
      { [lang]: eqChecker },
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Selection(lang, calc.clone(), source.clone()),
    );
    const optimizedPlan = db.optimizer.optimize(initialPlan);
    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [strToId('a'), strToId('a')],
          [strToId('b'), strToId('b')],
        ],
        new plan.Selection(
          lang,
          cloneCalc([['a'], [unnestedAttr, '0']], calc),
          new plan.ProjectionConcat(
            lang,
            new plan.MapFromItem(
              lang,
              strToId(unnestedAttr, '0'),
              source2.clone(),
            ),
            true,
            source.clone(),
          ),
        ),
      ),
    );

    expect(eqChecker.areEqual(optimizedPlan, expectedPlan)).toBe(true);
  });

  it('should unnest a subquery in a projection', () => {
    const calc = intermediateToCalc(
      new plan.FnCall(lang, [strToId('a'), { op: source2.clone() }], joinArgs),
      calcBuilders,
      { [lang]: eqChecker },
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [calc.clone(), strToId('x')],
          [strToId('b'), strToId('b')],
        ],
        source.clone(),
      ),
    );
    const optimizedPlan = db.optimizer.optimize(initialPlan);
    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [strToId('x'), strToId('x')],
          [strToId('b'), strToId('b')],
        ],

        new plan.Projection(
          lang,
          [
            [cloneCalc([['a'], [unnestedAttr, '0']], calc), strToId('x')],
            [strToId('b'), strToId('b')],
          ],
          new plan.ProjectionConcat(
            lang,
            new plan.MapFromItem(
              lang,
              strToId(unnestedAttr, '0'),
              source2.clone(),
            ),
            true,
            source.clone(),
          ),
        ),
      ),
    );

    expect(eqChecker.areEqual(optimizedPlan, expectedPlan)).toBe(true);
  });

  it('should unnest a subquery in a projection with no computation', () => {
    const clonedSource2 = source2.clone();
    const calc = new plan.Calculation(
      lang,
      assertMaxOne,
      [clonedSource2],
      [{ originalLocations: [] }],
      clonedSource2,
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [calc.clone(), strToId('x')],
          [strToId('b'), strToId('b')],
        ],
        source.clone(),
      ),
    );
    const optimizedPlan = db.optimizer.optimize(initialPlan);
    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [strToId('x'), strToId('x')],
          [strToId('b'), strToId('b')],
        ],
        new plan.Projection(
          lang,
          [
            [strToId(unnestedAttr, '0'), strToId('x')],
            [strToId('b'), strToId('b')],
          ],
          new plan.ProjectionConcat(
            lang,
            new plan.MapFromItem(
              lang,
              strToId(unnestedAttr, '0'),
              source2.clone(),
            ),
            true,
            source.clone(),
          ),
        ),
      ),
    );

    expect(eqChecker.areEqual(optimizedPlan, expectedPlan)).toBe(true);
  });

  it('should unnest multiple subqueries', () => {
    const source3 = new plan.ItemSource(lang, strToId('test', 'source3'));
    const calc = intermediateToCalc(
      new plan.FnCall(
        lang,
        [{ op: source2.clone() }, { op: source3.clone() }],
        joinArgs,
      ),
      calcBuilders,
      { [lang]: eqChecker },
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Selection(lang, calc.clone(), source.clone()),
    );
    const optimizedPlan = db.optimizer.optimize(initialPlan);
    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [strToId('a'), strToId('a')],
          [strToId('b'), strToId('b')],
        ],
        new plan.Selection(
          lang,
          cloneCalc(
            [
              [unnestedAttr, '0'],
              [unnestedAttr, '1'],
            ],
            calc,
          ),
          new plan.ProjectionConcat(
            lang,
            new plan.MapFromItem(
              lang,
              strToId(unnestedAttr, '1'),
              source3.clone(),
            ),
            true,
            new plan.ProjectionConcat(
              lang,
              new plan.MapFromItem(
                lang,
                strToId(unnestedAttr, '0'),
                source2.clone(),
              ),
              true,
              source.clone(),
            ),
          ),
        ),
      ),
    );

    expect(eqChecker.areEqual(optimizedPlan, expectedPlan)).toBe(true);
  });

  it('should not unnest subqueries that are possibly skipped', () => {
    // the or operator may skip evaluating its second argument
    const calc = intermediateToCalc(
      new plan.FnCall(lang, [strToId('a'), { op: source2.clone() }], or.impl),
      calcBuilders,
      { [lang]: eqChecker },
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Selection(lang, calc.clone(), source.clone()),
    );
    const expectedPlan = initialPlan.clone();
    const optimizedPlan = db.optimizer.optimize(initialPlan);

    expect(eqChecker.areEqual(optimizedPlan, expectedPlan)).toBe(true);
  });

  it('should not unnest subqueries that return sequences', () => {
    const calc = intermediateToCalc(
      new plan.FnCall(
        lang,
        [strToId('a'), { op: source2.clone(), acceptSequence: true }],
        joinArgs,
      ),
      calcBuilders,
      { [lang]: eqChecker },
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Selection(lang, calc.clone(), source.clone()),
    );
    const expectedPlan = initialPlan.clone();
    const optimizedPlan = db.optimizer.optimize(initialPlan);

    expect(eqChecker.areEqual(optimizedPlan, expectedPlan)).toBe(true);
  });

  it('should detect guaranteed value subqueries', () => {
    const calc = intermediateToCalc(
      new plan.FnCall(
        lang,
        [
          strToId('a'),
          {
            op: new plan.MapToItem(
              lang,
              strToId('a'),
              new plan.Projection(lang, [], new plan.NullSource(lang)),
            ),
          },
        ],
        joinArgs,
      ),
      calcBuilders,
      { [lang]: eqChecker },
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Selection(lang, calc.clone(), source.clone()),
    );
    const optimizedPlan = db.optimizer.optimize(initialPlan);
    // projectionConcat is NOT outer here
    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(
        lang,
        [
          [strToId('a'), strToId('a')],
          [strToId('b'), strToId('b')],
        ],
        new plan.Selection(
          lang,
          cloneCalc([['a'], [unnestedAttr, '0']], calc),
          new plan.ProjectionConcat(
            lang,
            new plan.MapFromItem(
              lang,
              strToId(unnestedAttr, '0'),
              new plan.MapToItem(
                lang,
                strToId('a'),
                new plan.Projection(lang, [], new plan.NullSource(lang)),
              ),
            ),
            false,
            source.clone(),
          ),
        ),
      ),
    );

    expect(eqChecker.areEqual(optimizedPlan, expectedPlan)).toBe(true);
  });
});
