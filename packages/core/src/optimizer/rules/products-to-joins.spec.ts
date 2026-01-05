import { DortDB } from '../../db.js';
import * as plan from '../../plan/operators/index.js';
import { ASTIdentifier } from '../../ast.js';
import { EqualityChecker } from '../../visitors/equality-checker.js';
import { mockLang } from '../../testing/mock-lang.js';
import { productsToJoins } from './products-to-joins.js';
import { ret1 } from '../../internal-fns/index.js';

describe('productsToJoins', () => {
  let db: DortDB;
  let eqChecker: EqualityChecker;
  const lang = mockLang.name;

  beforeEach(() => {
    db = new DortDB({
      mainLang: mockLang,
      optimizer: {
        rules: [productsToJoins],
      },
    });
    const vmap: Record<string, EqualityChecker> = {};
    eqChecker = vmap[lang] = new EqualityChecker(vmap);
  });

  it('should merge a cartesian product with a single selection', () => {
    const key = ASTIdentifier.fromParts(['test', 'key']);
    const calc = new plan.Calculation(lang, () => 42, [key], []);
    const source1 = new plan.TupleSource(
      lang,
      ASTIdentifier.fromParts(['test', 'source1']),
    );
    const source2 = new plan.TupleSource(
      lang,
      ASTIdentifier.fromParts(['test', 'source2']),
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Selection(
        lang,
        calc,
        new plan.CartesianProduct(lang, source1, source2),
      ),
    );

    const optimizedPlan = db.optimizer.optimize(initialPlan);
    const expectedResult = new plan.Limit(
      lang,
      10,
      10,
      new plan.Join(lang, source1, source2, [calc]),
    );
    expect(eqChecker.areEqual(optimizedPlan, expectedResult)).toBe(true);
  });

  it('should merge a cartesian product with multiple selections', () => {
    const key1 = ASTIdentifier.fromParts(['test', 'key1']);
    const calc1 = new plan.Calculation(lang, () => 42, [key1], []);
    const key2 = ASTIdentifier.fromParts(['test', 'key2']);
    const calc2 = new plan.Calculation(lang, ret1, [key2], []);
    const source1 = new plan.TupleSource(
      lang,
      ASTIdentifier.fromParts(['test', 'source1']),
    );
    const source2 = new plan.TupleSource(
      lang,
      ASTIdentifier.fromParts(['test', 'source2']),
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Selection(
        lang,
        calc1,
        new plan.Selection(
          lang,
          calc2,
          new plan.CartesianProduct(lang, source1, source2),
        ),
      ),
    );

    const optimizedPlan = db.optimizer.optimize(initialPlan);
    const expectedResult = new plan.Limit(
      lang,
      10,
      10,
      new plan.Join(lang, source1, source2, [calc1, calc2]),
    );
    expect(eqChecker.areEqual(optimizedPlan, expectedResult)).toBe(true);
  });
});
