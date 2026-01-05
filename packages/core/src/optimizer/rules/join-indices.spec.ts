import { DortDB, DortDBAsFriend } from '../../db.js';
import * as plan from '../../plan/operators/index.js';
import { ASTIdentifier } from '../../ast.js';
import { EqualityChecker } from '../../visitors/equality-checker.js';
import { mockLang } from '../../testing/mock-lang.js';
import { PlanOperator, PlanTupleOperator } from '../../plan/visitor.js';
import { Index, IndexFillInput, IndexMatchInput } from '../../indices/index.js';
import { intermediateToCalc } from '../../utils/calculation.js';
import { CalculationBuilder } from '../../visitors/calculation-builder.js';
import { JoinIndices } from './join-indices.js';
import { Trie } from '../../data-structures/trie.js';

class MockIndex implements Index {
  constructor(
    public expressions: plan.Calculation[],
    public db: DortDBAsFriend,
  ) {}
  reindex(values: Iterable<IndexFillInput>): void {}
  match = vi.fn(
    (
      expressions: IndexMatchInput[],
      renameMap?: plan.RenameMap,
    ): number[] | null => null,
  );
  createAccessor = vi.fn((expressions: IndexMatchInput[]): plan.Calculation => {
    throw new Error('Not implemented');
  });
}

function strToId(...strs: (string | symbol)[]): ASTIdentifier {
  return ASTIdentifier.fromParts(strs);
}

describe('JoinIndices', () => {
  let db: DortDB;
  let eqChecker: EqualityChecker;
  const lang = mockLang.name;
  const sourceName = ASTIdentifier.fromParts(['test', 'sourceLeft']);
  let sourceRight: PlanTupleOperator;
  let calcBuilders: Record<string, CalculationBuilder>;
  const strToCalc = (str: string, additionalDeps: (string | symbol)[][] = []) =>
    intermediateToCalc(
      new plan.FnCall(
        lang,
        [strToId(str), ...additionalDeps.map(ASTIdentifier.fromParts)],
        () => str,
      ),
      calcBuilders,
      {
        [lang]: eqChecker,
      },
    );

  beforeEach(() => {
    db = new DortDB({
      mainLang: mockLang,
      optimizer: {
        rules: [JoinIndices],
      },
    });
    db.registerSource(sourceName.parts, []);
    const vmap: Record<string, EqualityChecker> = {};
    eqChecker = vmap[lang] = new EqualityChecker(vmap);
    calcBuilders = (db as any).friendInterface.langMgr.getVisitorMap(
      'calculationBuilder',
    );
    sourceRight = new plan.TupleSource(lang, strToId('test', 'sourceRight'));
  });

  describe(`with tuple source`, () => {
    let source: PlanTupleOperator;

    function getExternalKey(optimized: PlanOperator): symbol {
      const proj = optimized as plan.Projection;
      const pc = proj.source as plan.ProjectionConcat;
      const proj2 = pc.source as plan.Projection;
      return proj2.schema[0].parts[0] as symbol;
    }

    beforeEach(() => {
      source = new plan.TupleSource(lang, sourceName);
    });

    it('should not do anything if there are no applicable conditions', () => {
      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Join(lang, source.clone(), sourceRight.clone(), [
          new plan.Calculation(lang, () => true, [], []),
        ]),
      );
      const expectedPlan = initialPlan.clone();
      const optimized = db.optimizer.optimize(initialPlan);
      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });

    it('should prepare for an index scan if there is an applicable condition', () => {
      const calcA = strToCalc('a', [['c']]);
      source.addToSchema([strToId('a'), strToId('b')]);
      sourceRight.addToSchema([strToId('c'), strToId('d')]);

      const index = new MockIndex([], null);
      index.match.mockImplementation(() => [0]);
      db.indices.set(sourceName.parts, [index]);

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Join(lang, source.clone(), sourceRight.clone(), [calcA]),
      );
      const optimized = db.optimizer.optimize(initialPlan);
      const externalKey = getExternalKey(optimized);
      const clonedCalcA = strToCalc('a', [[externalKey, 'c']]);
      clonedCalcA.impl = calcA.impl;
      (clonedCalcA.original as plan.FnCall).impl = (
        calcA.original as plan.FnCall
      ).impl;
      const expectedPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Projection(
          lang,
          [
            [strToId(externalKey, 'c'), strToId('c')],
            [strToId(externalKey, 'd'), strToId('d')],
            [strToId('a'), strToId('a')],
            [strToId('b'), strToId('b')],
          ],
          new plan.ProjectionConcat(
            lang,
            new plan.Selection(lang, clonedCalcA, source.clone()),
            false,
            new plan.Projection(
              lang,
              [
                [strToId('c'), strToId(externalKey, 'c')],
                [strToId('d'), strToId(externalKey, 'd')],
              ],
              sourceRight.clone(),
            ),
          ),
        ),
      );
      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });

    it('should preserve other conditions', () => {
      const calcA = strToCalc('a', [['c']]);
      const calcB = strToCalc('b', [['d']]);
      source.addToSchema([strToId('a'), strToId('b')]);
      sourceRight.addToSchema([strToId('c'), strToId('d')]);

      const index = new MockIndex([], null);
      index.match.mockImplementation(() => [0]);
      db.indices.set(sourceName.parts, [index]);

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Join(lang, source.clone(), sourceRight.clone(), [
          calcA,
          calcB,
        ]),
      );
      const optimized = db.optimizer.optimize(initialPlan);
      const externalKey = getExternalKey(optimized);
      const clonedCalcA = strToCalc('a', [[externalKey, 'c']]);
      clonedCalcA.impl = calcA.impl;
      (clonedCalcA.original as plan.FnCall).impl = (
        calcA.original as plan.FnCall
      ).impl;
      const clonedCalcB = strToCalc('b', [[externalKey, 'd']]);
      clonedCalcB.impl = calcB.impl;
      (clonedCalcB.original as plan.FnCall).impl = (
        calcB.original as plan.FnCall
      ).impl;
      const expectedPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Projection(
          lang,
          [
            [strToId(externalKey, 'c'), strToId('c')],
            [strToId(externalKey, 'd'), strToId('d')],
            [strToId('a'), strToId('a')],
            [strToId('b'), strToId('b')],
          ],
          new plan.ProjectionConcat(
            lang,
            new plan.Selection(
              lang,
              clonedCalcB,
              new plan.Selection(lang, clonedCalcA, source.clone()),
            ),
            false,
            new plan.Projection(
              lang,
              [
                [strToId('c'), strToId(externalKey, 'c')],
                [strToId('d'), strToId(externalKey, 'd')],
              ],
              sourceRight.clone(),
            ),
          ),
        ),
      );
      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });

    it('should work with other operators present', () => {
      const calcA = strToCalc('a', [['c']]);
      source.addToSchema([strToId('a'), strToId('b')]);
      sourceRight.addToSchema([strToId('c'), strToId('d')]);
      const calcB = strToCalc('b');

      const index = new MockIndex([], null);
      index.match.mockImplementation(() => [0]);
      db.indices.set(sourceName.parts, [index]);

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Join(
          lang,
          new plan.Selection(
            lang,
            calcB.clone(),
            new plan.OrderBy(
              lang,
              [],
              new plan.Recursion(
                lang,
                0,
                2,
                calcB.clone(),
                new plan.IndexedRecursion(
                  lang,
                  0,
                  2,
                  new plan.TupleSource(lang, strToId('source3')),
                  source.clone(),
                ),
              ),
            ),
          ),
          sourceRight.clone(),
          [calcA],
        ),
      );
      const optimized = db.optimizer.optimize(initialPlan);
      const externalKey = getExternalKey(optimized);
      const clonedCalcA = strToCalc('a', [[externalKey, 'c']]);
      clonedCalcA.impl = calcA.impl;
      (clonedCalcA.original as plan.FnCall).impl = (
        calcA.original as plan.FnCall
      ).impl;
      const expectedPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Projection(
          lang,
          [
            [strToId(externalKey, 'c'), strToId('c')],
            [strToId(externalKey, 'd'), strToId('d')],
            [strToId('a'), strToId('a')],
            [strToId('b'), strToId('b')],
          ],
          new plan.ProjectionConcat(
            lang,
            new plan.Selection(
              lang,
              calcB.clone(),
              new plan.OrderBy(
                lang,
                [],
                new plan.Recursion(
                  lang,
                  0,
                  2,
                  calcB.clone(),
                  new plan.IndexedRecursion(
                    lang,
                    0,
                    2,
                    new plan.TupleSource(lang, strToId('source3')),
                    new plan.Selection(lang, clonedCalcA, source.clone()),
                  ),
                ),
              ),
            ),
            false,
            new plan.Projection(
              lang,
              [
                [strToId('c'), strToId(externalKey, 'c')],
                [strToId('d'), strToId(externalKey, 'd')],
              ],
              sourceRight.clone(),
            ),
          ),
        ),
      );
      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });

    it('should work with projections present', () => {
      const calcA = strToCalc('aa', [['c'], ['bbb']]);
      source.addToSchema([strToId('a'), strToId('b')]);
      sourceRight.addToSchema([strToId('c'), strToId('d')]);

      const index = new MockIndex([], null);
      index.match.mockImplementation(() => [0]);
      db.indices.set(sourceName.parts, [index]);

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Join(
          lang,
          new plan.Projection(
            lang,
            [
              [strToId('a'), strToId('aa')],
              [strToId('bb'), strToId('bbb')],
            ],
            new plan.Projection(
              lang,
              [
                [strToId('a'), strToId('a')],
                [strToId('b'), strToId('bb')],
              ],
              source.clone(),
            ),
          ),
          sourceRight.clone(),
          [calcA],
        ),
      );
      const optimized = db.optimizer.optimize(initialPlan);
      const externalKey = getExternalKey(optimized);
      const clonedCalcA = strToCalc('a', [[externalKey, 'c'], ['b']]);
      clonedCalcA.impl = calcA.impl;
      (clonedCalcA.original as plan.FnCall).impl = (
        calcA.original as plan.FnCall
      ).impl;
      const expectedPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Projection(
          lang,
          [
            [strToId(externalKey, 'c'), strToId('c')],
            [strToId(externalKey, 'd'), strToId('d')],
            [strToId('aa'), strToId('aa')],
            [strToId('bbb'), strToId('bbb')],
          ],
          new plan.ProjectionConcat(
            lang,
            new plan.Projection(
              lang,
              [
                [strToId('a'), strToId('aa')],
                [strToId('bb'), strToId('bbb')],
              ],
              new plan.Projection(
                lang,
                [
                  [strToId('a'), strToId('a')],
                  [strToId('b'), strToId('bb')],
                ],
                new plan.Selection(lang, clonedCalcA, source.clone()),
              ),
            ),
            false,
            new plan.Projection(
              lang,
              [
                [strToId('c'), strToId(externalKey, 'c')],
                [strToId('d'), strToId(externalKey, 'd')],
              ],
              sourceRight.clone(),
            ),
          ),
        ),
      );
      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);

      expect(index.match.mock.lastCall[1]).toEqual(
        new Trie({ aa: ['a'], bbb: ['b'] }),
      );
    });

    it('should work with the right branch too', () => {
      const calcA = strToCalc('a', [['c']]);
      source.addToSchema([strToId('a'), strToId('b')]);
      sourceRight.addToSchema([strToId('c'), strToId('d')]);

      const index = new MockIndex([], null);
      index.match.mockImplementation(() => [0]);
      db.indices.set(sourceName.parts, [index]);

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Join(lang, sourceRight.clone(), source.clone(), [calcA]),
      );
      const optimized = db.optimizer.optimize(initialPlan);
      const externalKey = getExternalKey(optimized);
      const clonedCalcA = strToCalc('a', [[externalKey, 'c']]);
      clonedCalcA.impl = calcA.impl;
      (clonedCalcA.original as plan.FnCall).impl = (
        calcA.original as plan.FnCall
      ).impl;
      const expectedPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Projection(
          lang,
          [
            [strToId(externalKey, 'c'), strToId('c')],
            [strToId(externalKey, 'd'), strToId('d')],
            [strToId('a'), strToId('a')],
            [strToId('b'), strToId('b')],
          ],
          new plan.ProjectionConcat(
            lang,
            new plan.Selection(lang, clonedCalcA, source.clone()),
            false,
            new plan.Projection(
              lang,
              [
                [strToId('c'), strToId(externalKey, 'c')],
                [strToId('d'), strToId(externalKey, 'd')],
              ],
              sourceRight.clone(),
            ),
          ),
        ),
      );
      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });

    it('should work with leftOuter joins', () => {
      const calcA = strToCalc('a', [['c']]);
      source.addToSchema([strToId('a'), strToId('b')]);
      sourceRight.addToSchema([strToId('c'), strToId('d')]);

      const index = new MockIndex([], null);
      index.match.mockImplementation(() => [0]);
      db.indices.set(sourceName.parts, [index]);

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Join(lang, source.clone(), sourceRight.clone(), [calcA]),
      );
      (initialPlan.source as plan.Join).leftOuter = true;
      const optimized = db.optimizer.optimize(initialPlan);
      const externalKey = getExternalKey(optimized);
      const clonedCalcA = strToCalc('a', [[externalKey, 'c']]);
      clonedCalcA.impl = calcA.impl;
      (clonedCalcA.original as plan.FnCall).impl = (
        calcA.original as plan.FnCall
      ).impl;
      const expectedPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Projection(
          lang,
          [
            [strToId(externalKey, 'c'), strToId('c')],
            [strToId(externalKey, 'd'), strToId('d')],
            [strToId('a'), strToId('a')],
            [strToId('b'), strToId('b')],
          ],
          new plan.ProjectionConcat(
            lang,
            new plan.Selection(lang, clonedCalcA, source.clone()),
            true,
            new plan.Projection(
              lang,
              [
                [strToId('c'), strToId(externalKey, 'c')],
                [strToId('d'), strToId(externalKey, 'd')],
              ],
              sourceRight.clone(),
            ),
          ),
        ),
      );
      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });

    it('should not do anything with rightOuter joins', () => {
      const calcA = strToCalc('a', [['c']]);
      source.addToSchema([strToId('a'), strToId('b')]);
      sourceRight.addToSchema([strToId('c'), strToId('d')]);

      const index = new MockIndex([], null);
      index.match.mockImplementation(() => [0]);
      db.indices.set(sourceName.parts, [index]);

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Join(lang, source.clone(), sourceRight.clone(), [calcA]),
      );
      (initialPlan.source as plan.Join).rightOuter = true;
      const expectedPlan = initialPlan.clone();
      const optimized = db.optimizer.optimize(initialPlan);
      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });

    describe('computed attributes', () => {
      it('should ignore computed attributes', () => {
        const calcA = strToCalc('a', [['c']]);
        source.addToSchema([strToId('a'), strToId('b')]);
        sourceRight.addToSchema([strToId('c'), strToId('d')]);

        const index = new MockIndex([], null);
        index.match.mockImplementation(() => [0]);
        db.indices.set(sourceName.parts, [index]);

        const computedCalc = intermediateToCalc(
          new plan.FnCall(lang, [], () => 42),
          calcBuilders,
          {
            [lang]: eqChecker,
          },
        );

        const initialPlan = new plan.Limit(
          lang,
          10,
          10,
          new plan.Join(
            lang,
            new plan.Projection(
              lang,
              [
                [computedCalc.clone(), strToId('a')],
                [strToId('b'), strToId('b')],
              ],
              source.clone(),
            ),
            sourceRight.clone(),
            [calcA],
          ),
        );
        const expectedPlan = initialPlan.clone();
        const optimized = db.optimizer.optimize(initialPlan);
        expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
      });
      it('should ignore computed and renamed attributes', () => {
        const calcA = strToCalc('a', [['d']]);
        const calcB = strToCalc('b', [['d']]);
        const calcC = strToCalc('c', [['d']]);
        source.addToSchema([strToId('a'), strToId('b'), strToId('c')]);
        sourceRight.addToSchema([strToId('d'), strToId('e')]);

        const index = new MockIndex([], null);
        index.match.mockImplementation(() => [0]);
        db.indices.set(sourceName.parts, [index]);

        const computedCalc = intermediateToCalc(
          new plan.FnCall(lang, [], () => 42),
          calcBuilders,
          {
            [lang]: eqChecker,
          },
        );

        const initialPlan = new plan.Limit(
          lang,
          10,
          10,
          new plan.Join(
            lang,
            new plan.Projection(
              lang,
              [
                [strToId('a'), strToId('aa')],
                [computedCalc.clone(), strToId('bb')],
              ],
              new plan.Projection(
                lang,
                [
                  [computedCalc.clone(), strToId('a')],
                  [strToId('b'), strToId('bb')],
                  [strToId('c'), strToId('c')],
                ],
                source.clone(),
              ),
            ),
            sourceRight.clone(),
            [calcA, calcB, calcC],
          ),
        );
        const expectedPlan = initialPlan.clone();
        const optimized = db.optimizer.optimize(initialPlan);
        expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
      });
    });
  });

  describe('with item source', () => {
    let source: PlanTupleOperator;
    const sourceKey = strToId('sourceKey');

    function getExternalKey(optimized: PlanOperator): symbol {
      const proj = optimized as plan.Projection;
      const pc = proj.source as plan.ProjectionConcat;
      const proj2 = pc.source as plan.Projection;
      return proj2.schema[0].parts[0] as symbol;
    }

    beforeEach(() => {
      source = new plan.TupleSource(lang, sourceName);
      source = new plan.MapFromItem(
        lang,
        sourceKey,
        new plan.ItemSource(lang, sourceName),
      );
    });

    it('should prepare for an index scan if there is an applicable condition', () => {
      const calcA = strToCalc('sourceKey', [['c']]);
      source.addToSchema([sourceKey]);
      sourceRight.addToSchema([strToId('c'), strToId('d')]);

      const index = new MockIndex([], null);
      index.match.mockImplementation(() => [0]);
      db.indices.set(sourceName.parts, [index]);

      const initialPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Join(lang, source.clone(), sourceRight.clone(), [calcA]),
      );
      const optimized = db.optimizer.optimize(initialPlan);
      const externalKey = getExternalKey(optimized);
      const clonedCalcA = strToCalc('sourceKey', [[externalKey, 'c']]);
      clonedCalcA.impl = calcA.impl;
      (clonedCalcA.original as plan.FnCall).impl = (
        calcA.original as plan.FnCall
      ).impl;
      const expectedPlan = new plan.Limit(
        lang,
        10,
        10,
        new plan.Projection(
          lang,
          [
            [strToId(externalKey, 'c'), strToId('c')],
            [strToId(externalKey, 'd'), strToId('d')],
            [sourceKey, sourceKey],
          ],
          new plan.ProjectionConcat(
            lang,
            new plan.Selection(lang, clonedCalcA, source.clone()),
            false,
            new plan.Projection(
              lang,
              [
                [strToId('c'), strToId(externalKey, 'c')],
                [strToId('d'), strToId(externalKey, 'd')],
              ],
              sourceRight.clone(),
            ),
          ),
        ),
      );
      expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
    });
  });
});
