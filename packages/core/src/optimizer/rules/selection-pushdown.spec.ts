import { DortDB } from '../../db.js';
import * as plan from '../../plan/operators/index.js';
import { allAttrs, ASTIdentifier } from '../../ast.js';
import { EqualityChecker } from '../../visitors/equality-checker.js';
import { mockLang } from '../../testing/mock-lang.js';
import { PushdownSelections } from './selection-pushdown.js';
import { intermediateToCalc } from '../../utils/calculation.js';
import { CalculationBuilder } from '../../visitors/calculation-builder.js';
import { PlanTupleOperator } from '../../plan/visitor.js';

function strToId(...strs: (string | symbol)[]): ASTIdentifier {
  return ASTIdentifier.fromParts(strs);
}

describe('PushdownSelections', () => {
  let db: DortDB;
  let eqChecker: EqualityChecker;
  const lang = mockLang.name;
  let source: plan.TupleSource;
  let source2: plan.TupleSource;
  let calcBuilders: Record<string, CalculationBuilder>;

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
        rules: [PushdownSelections],
      },
    });
    const vmap: Record<string, EqualityChecker> = {};
    eqChecker = vmap[lang] = new EqualityChecker(vmap);
    calcBuilders = (db as any).friendInterface.langMgr.getVisitorMap(
      'calculationBuilder',
    );
    source = new plan.TupleSource(lang, strToId('test', 'source'));
    source.addToSchema([strToId('a'), strToId('b')]);
    source2 = new plan.TupleSource(lang, strToId('test', 'source2'));
    source2.addToSchema([strToId('c'), strToId('d')]);
  });

  it('should push down a selection through a distinct', () => {
    const calc = strToCalc('a');
    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Selection(
        lang,
        calc.clone(),
        new plan.Distinct(lang, allAttrs, source.clone()),
      ),
    );

    const optimized = db.optimizer.optimize(initialPlan);
    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Distinct(
        lang,
        allAttrs,
        new plan.Selection(lang, calc.clone(), source.clone()),
      ),
    );
    expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
  });

  it('should push down a selection through an orderBy', () => {
    const calc = strToCalc('a');
    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Selection(
        lang,
        calc.clone(),
        new plan.OrderBy(
          lang,
          [{ ascending: true, key: strToId('a'), nullsFirst: true }],
          source.clone(),
        ),
      ),
    );

    const optimized = db.optimizer.optimize(initialPlan);
    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.OrderBy(
        lang,
        [{ ascending: true, key: strToId('a'), nullsFirst: true }],
        new plan.Selection(lang, calc.clone(), source.clone()),
      ),
    );
    expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
  });

  for (const setop of [plan.Union, plan.Difference, plan.Intersection]) {
    it(`should push down a selection through a ${setop.name}`, () => {
      const calc = strToCalc('a');
      source2.clearSchema();
      source2.addToSchema([strToId('a'), strToId('b')]);

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Selection(
          lang,
          calc.clone(),
          new setop(lang, source.clone(), source2.clone()),
        ),
      );
      const optimized = db.optimizer.optimize(initialPlan);
      const expectedPlan = new plan.Limit(
        lang,
        10,
        10,
        new setop(
          lang,
          new plan.Selection(lang, calc.clone(), source.clone()),
          new plan.Selection(lang, calc.clone(), source2.clone()),
        ),
      );
      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });
  }

  describe('with joins', () => {
    for (const joinOp of [
      plan.CartesianProduct,
      plan.Join,
      plan.ProjectionConcat,
    ]) {
      function makeJoin(left: PlanTupleOperator, right: PlanTupleOperator) {
        if (joinOp === plan.CartesianProduct) {
          return new plan.CartesianProduct(lang, left, right);
        } else if (joinOp === plan.Join) {
          return new plan.Join(lang, left, right, []);
        } else {
          return new plan.ProjectionConcat(lang, right, false, left);
        }
      }

      it(`should push down a selection through the left side of a ${joinOp.name}`, () => {
        const calc = strToCalc('a');

        const initialPlan = new plan.Limit(
          lang,
          10,
          10,
          new plan.Selection(
            lang,
            calc.clone(),
            makeJoin(source.clone(), source2.clone()),
          ),
        );

        const optimized = db.optimizer.optimize(initialPlan);
        const expectedPlan = new plan.Limit(
          lang,
          10,
          10,
          makeJoin(
            new plan.Selection(lang, calc.clone(), source.clone()),
            source2.clone(),
          ),
        );
        expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
      });

      it(`should push down a selection through the right side of a ${joinOp.name}`, () => {
        const calc = strToCalc('c');

        const initialPlan = new plan.Limit(
          lang,
          10,
          10,
          new plan.Selection(
            lang,
            calc.clone(),
            makeJoin(source.clone(), source2.clone()),
          ),
        );

        const optimized = db.optimizer.optimize(initialPlan);
        const expectedPlan = new plan.Limit(
          lang,
          10,
          10,
          makeJoin(
            source.clone(),
            new plan.Selection(lang, calc.clone(), source2.clone()),
          ),
        );
        expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
      });

      it(`should push down a selection through both sides of a ${joinOp.name}`, () => {
        const calc = strToCalc('a');
        source2.addToSchema(strToId('a'));

        const initialPlan = new plan.Limit(
          lang,
          10,
          10,
          new plan.Selection(
            lang,
            calc.clone(),
            makeJoin(source.clone(), source2.clone()),
          ),
        );

        const optimized = db.optimizer.optimize(initialPlan);
        const expectedPlan = new plan.Limit(
          lang,
          10,
          10,
          makeJoin(
            new plan.Selection(lang, calc.clone(), source.clone()),
            new plan.Selection(lang, calc.clone(), source2.clone()),
          ),
        );
        expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
      });

      it(`should not push down a selection through a ${joinOp.name}`, () => {
        const calc = strToCalc('a', [['c']]);

        const initialPlan = new plan.Limit(
          lang,
          10,
          10,
          new plan.Selection(
            lang,
            calc.clone(),
            makeJoin(source.clone(), source2.clone()),
          ),
        );

        const expectedPlan = initialPlan.clone();
        const optimized = db.optimizer.optimize(initialPlan);
        expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
      });

      it(`should push down only some selections through ${joinOp.name}`, () => {
        const calcA = strToCalc('a');
        const calcB = strToCalc('a', [['c']]);
        const calcC = strToCalc('d');

        const initialPlan = new plan.Limit(
          lang,
          10,
          10,
          new plan.Selection(
            lang,
            calcA.clone(),
            new plan.Selection(
              lang,
              calcB.clone(),
              new plan.Selection(
                lang,
                calcC.clone(),
                makeJoin(source.clone(), source2.clone()),
              ),
            ),
          ),
        );

        const optimized = db.optimizer.optimize(initialPlan);
        const expectedPlan = new plan.Limit(
          lang,
          10,
          10,
          new plan.Selection(
            lang,
            calcB.clone(),

            makeJoin(
              new plan.Selection(lang, calcA.clone(), source.clone()),
              new plan.Selection(lang, calcC.clone(), source2.clone()),
            ),
          ),
        );
        expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
      });
    }

    it('should not push down a selection through an outer join', () => {
      const calc = strToCalc('a');

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Selection(
          lang,
          calc.clone(),
          new plan.ProjectionConcat(
            lang,
            source.clone(),
            true,
            source2.clone(),
          ),
        ),
      );

      const expectedPlan = initialPlan.clone();
      const optimized = db.optimizer.optimize(initialPlan);
      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });
  });

  describe('with projections', () => {
    it('should push down a selection through a projection', () => {
      const filterCalc = strToCalc('renamed', [['external']]);
      const projCalc = strToCalc('a');

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Selection(
          lang,
          filterCalc.clone(),
          new plan.Projection(
            lang,
            [
              [strToId('a'), strToId('renamed')],
              [projCalc.clone(), strToId('calculated')],
            ],
            source.clone(),
          ),
        ),
      );

      const optimized = db.optimizer.optimize(initialPlan);
      const clonedCalc = cloneCalc([['a'], ['external']], filterCalc);
      const expectedPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Projection(
          lang,
          [
            [strToId('a'), strToId('renamed')],
            [projCalc.clone(), strToId('calculated')],
          ],
          new plan.Selection(lang, clonedCalc, source.clone()),
        ),
      );

      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });

    it('should push down a complex selection through a projection', () => {
      const emptyFn = () => '';
      const filterCalc = new plan.Calculation(
        lang,
        emptyFn,
        [new plan.ItemFnSource(lang, [strToId('renamed')], emptyFn)],
        [],
      );
      const projCalc = strToCalc('a');

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Selection(
          lang,
          filterCalc.clone(),
          new plan.Projection(
            lang,
            [
              [strToId('x'), strToId('renamed')],
              [projCalc.clone(), strToId('calculated')],
            ],
            new plan.Projection(
              lang,
              [[strToId('a'), strToId('x')]],
              source.clone(),
            ),
          ),
        ),
      );

      const optimized = db.optimizer.optimize(initialPlan);
      const renamedCalc = new plan.Calculation(
        lang,
        emptyFn,
        [new plan.ItemFnSource(lang, [strToId('a')], emptyFn)],
        [],
      );
      const expectedPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Projection(
          lang,
          [
            [strToId('x'), strToId('renamed')],
            [projCalc.clone(), strToId('calculated')],
          ],
          new plan.Projection(
            lang,
            [[strToId('a'), strToId('x')]],
            new plan.Selection(lang, renamedCalc, source.clone()),
          ),
        ),
      );

      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });

    it('should not push down a selection through a projection creating the filtered columns', () => {
      const calc = strToCalc('calculated');

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Selection(
          lang,
          calc.clone(),
          new plan.Projection(
            lang,
            [
              [strToId('a'), strToId('renamed')],
              [strToCalc('a'), strToId('calculated')],
            ],
            source.clone(),
          ),
        ),
      );

      const expectedPlan = initialPlan.clone();
      const optimized = db.optimizer.optimize(initialPlan);

      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });

    it('should not push down a selection through a projection with conflicting renames', () => {
      const calc = strToCalc('unique', [['duplicate']]);
      source.addToSchema(strToId('duplicate'));
      source2.addToSchema(strToId('duplicate'));

      const initialPlan = new plan.ProjectionConcat(
        lang,
        new plan.Selection(
          lang,
          calc.clone(),
          new plan.Projection(
            lang,
            [[strToId('duplicate'), strToId('unique')]],
            source.clone(),
          ),
        ),
        false,
        source2.clone(),
      );

      const expectedPlan = initialPlan.clone();
      const optimized = db.optimizer.optimize(initialPlan);

      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });
  });
});
