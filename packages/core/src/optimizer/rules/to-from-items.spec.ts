import { DortDB } from '../../db.js';
import { mergeToFromItems } from './to-from-items.js';
import * as plan from '../../plan/operators/index.js';
import { ASTIdentifier } from '../../ast.js';
import { EqualityChecker } from '../../visitors/equality-checker.js';

describe('mergeToFromItems', () => {
  let db: DortDB;
  let eqChecker: EqualityChecker;
  const lang = 'lang';

  beforeEach(() => {
    db = new DortDB({
      mainLang: null,
      optimizer: {
        rules: [mergeToFromItems],
      },
    });
    const vmap: Record<string, EqualityChecker> = {};
    vmap[lang] = new EqualityChecker(vmap);
  });

  it('should merge MapToItem and MapFromItem operators with equal keys', () => {
    const key = ASTIdentifier.fromParts(['test', 'key']);
    const source = new plan.ItemSource(
      'lang',
      ASTIdentifier.fromParts(['test', 'source']),
    );

    const initialPlan = new plan.Limit(
      'lang',
      10,
      10,
      new plan.MapToItem(
        'lang',
        key,
        new plan.MapFromItem('lang', key, source),
      ),
    );

    const optimizedPlan = db.optimizer.optimize(initialPlan);
    const expectedResult = new plan.Limit('lang', 10, 10, source);

    expect(eqChecker.areEqual(optimizedPlan, expectedResult)).toBe(true);
  });
});
