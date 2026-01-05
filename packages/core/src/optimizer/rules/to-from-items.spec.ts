import { DortDB } from '../../db.js';
import { mergeFromToItems, mergeToFromItems } from './to-from-items.js';
import * as plan from '../../plan/operators/index.js';
import { allAttrs, ASTIdentifier } from '../../ast.js';
import { EqualityChecker } from '../../visitors/equality-checker.js';
import { mockLang } from '../../testing/mock-lang.js';

describe('mergeToFromItems', () => {
  let db: DortDB;
  let eqChecker: EqualityChecker;
  const lang = mockLang.name;

  beforeEach(() => {
    db = new DortDB({
      mainLang: mockLang,
      optimizer: {
        rules: [mergeToFromItems],
      },
    });
    const vmap: Record<string, EqualityChecker> = {};
    eqChecker = vmap[lang] = new EqualityChecker(vmap);
  });

  it('should merge MapToItem and MapFromItem operators with equal keys', () => {
    const key = ASTIdentifier.fromParts(['test', 'key']);
    const source = new plan.ItemSource(
      lang,
      ASTIdentifier.fromParts(['test', 'source']),
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.MapToItem(lang, key, new plan.MapFromItem(lang, key, source)),
    );

    const optimizedPlan = db.optimizer.optimize(initialPlan);
    const expectedResult = new plan.Limit(lang, 10, 10, source);

    expect(eqChecker.areEqual(optimizedPlan, expectedResult)).toBe(true);
  });

  it('should not merge MapToItem and MapFromItem operators with different keys', () => {
    const key1 = ASTIdentifier.fromParts(['test', 'key1']);
    const key2 = ASTIdentifier.fromParts(['test', 'key2']);
    const source = new plan.ItemSource(
      lang,
      ASTIdentifier.fromParts(['test', 'source']),
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.MapToItem(lang, key1, new plan.MapFromItem(lang, key2, source)),
    );
    const optimizedPlan = db.optimizer.optimize(initialPlan);

    expect(eqChecker.areEqual(optimizedPlan, initialPlan)).toBe(true);
  });
});

describe('mergeFromToItems', () => {
  let db: DortDB;
  let eqChecker: EqualityChecker;
  const lang = mockLang.name;

  beforeEach(() => {
    db = new DortDB({
      mainLang: mockLang,
      optimizer: {
        rules: [mergeFromToItems],
      },
    });
    const vmap: Record<string, EqualityChecker> = {};
    eqChecker = vmap[lang] = new EqualityChecker(vmap);
  });

  it('should merge MapFromItem and MapToItem operators with equal keys', () => {
    const key = ASTIdentifier.fromParts(['test', 'key']);
    const source = new plan.TupleSource(
      lang,
      ASTIdentifier.fromParts(['test', 'source']),
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.MapFromItem(lang, key, new plan.MapToItem(lang, key, source)),
    );

    const optimizedPlan = db.optimizer.optimize(initialPlan);
    const expectedResult = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(lang, [[key, key]], source),
    );

    expect(eqChecker.areEqual(optimizedPlan, expectedResult)).toBe(true);
  });

  it('should merge MapFromItem and MapToItem operators with different keys', () => {
    const key1 = ASTIdentifier.fromParts(['test', 'key1']);
    const key2 = ASTIdentifier.fromParts(['test', 'key2']);
    const source = new plan.TupleSource(
      lang,
      ASTIdentifier.fromParts(['test', 'source']),
    );

    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.MapFromItem(lang, key1, new plan.MapToItem(lang, key2, source)),
    );
    const optimizedPlan = db.optimizer.optimize(initialPlan);
    const expectedResult = new plan.Limit(
      lang,
      10,
      10,
      new plan.Projection(lang, [[key2, key1]], source),
    );

    expect(eqChecker.areEqual(optimizedPlan, expectedResult)).toBe(true);
  });

  it('should not merge MapFromItem and MapToItem operators with allAttrs key', () => {
    const key1 = ASTIdentifier.fromParts(['test', 'key1']);
    const key2 = ASTIdentifier.fromParts(['test', allAttrs]);
    const source = new plan.TupleSource(
      lang,
      ASTIdentifier.fromParts(['test', 'source']),
    );
    const initialPlan = new plan.Limit(
      lang,
      10,
      10,
      new plan.MapFromItem(lang, key1, new plan.MapToItem(lang, key2, source)),
    );

    const expectedResult = initialPlan.clone();
    const optimizedPlan = db.optimizer.optimize(initialPlan);
    expect(eqChecker.areEqual(optimizedPlan, expectedResult)).toBe(true);
  });
});
