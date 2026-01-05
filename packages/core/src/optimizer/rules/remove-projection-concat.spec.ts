import { DortDB } from '../../db.js';
import * as plan from '../../plan/operators/index.js';
import { ASTIdentifier } from '../../ast.js';
import { EqualityChecker } from '../../visitors/equality-checker.js';
import { mockLang } from '../../testing/mock-lang.js';
import { ProjConcatToJoin } from './remove-projection-concat.js';

function strToId(...strs: (string | symbol)[]): ASTIdentifier {
  return ASTIdentifier.fromParts(strs);
}

describe('ProjConcatToJoin', () => {
  let db: DortDB;
  let eqChecker: EqualityChecker;
  const lang = mockLang.name;
  let sourceLeft: plan.TupleSource;
  let sourceRight: plan.TupleSource;

  beforeEach(() => {
    db = new DortDB({
      mainLang: mockLang,
      optimizer: {
        rules: [ProjConcatToJoin],
      },
    });
    const vmap: Record<string, EqualityChecker> = {};
    eqChecker = vmap[lang] = new EqualityChecker(vmap);

    sourceLeft = new plan.TupleSource(lang, strToId('test', 'sourceLeft'));
    sourceLeft.addToSchema([strToId('a'), strToId('b')]);
    sourceRight = new plan.TupleSource(lang, strToId('test', 'sourceRight'));
    sourceRight.addToSchema([strToId('c'), strToId('d')]);
  });

  it('should convert non-correlated ProjectionConcat to CartesianProduct', () => {
    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.ProjectionConcat(
        lang,
        new plan.Projection(
          lang,
          [[strToId('d'), strToId('d')]],
          new plan.Selection(lang, strToId('c'), sourceRight.clone()),
        ),
        false,
        sourceLeft.clone(),
      ),
    );

    const optimized = db.optimizer.optimize(initialPlan);
    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.CartesianProduct(
        lang,
        sourceLeft.clone(),
        new plan.Projection(
          lang,
          [[strToId('d'), strToId('d')]],
          new plan.Selection(lang, strToId('c'), sourceRight.clone()),
        ),
      ),
    );

    expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
  });

  it('should not convert correlated ProjectionConcat', () => {
    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.ProjectionConcat(
        lang,
        new plan.Projection(
          lang,
          [[strToId('d'), strToId('d')]],
          new plan.Selection(lang, strToId('a'), sourceRight.clone()),
        ),
        false,
        sourceLeft.clone(),
      ),
    );

    const expectedPlan = initialPlan.clone();
    const optimized = db.optimizer.optimize(initialPlan);

    expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
  });

  it('should convert non-correlated outer ProjectionConcat to Join', () => {
    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.ProjectionConcat(
        lang,
        new plan.Projection(
          lang,
          [[strToId('d'), strToId('d')]],
          new plan.Selection(lang, strToId('c'), sourceRight.clone()),
        ),
        true,
        sourceLeft.clone(),
      ),
    );

    const optimized = db.optimizer.optimize(initialPlan);
    const expectedPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.Join(
        lang,
        sourceLeft.clone(),
        new plan.Projection(
          lang,
          [[strToId('d'), strToId('d')]],
          new plan.Selection(lang, strToId('c'), sourceRight.clone()),
        ),
        [],
      ),
    );
    (expectedPlan.source as plan.Join).leftOuter = true;

    expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
  });
});
