import { DortDB, DortDBAsFriend } from '../../db.js';
import * as plan from '../../plan/operators/index.js';
import { ASTIdentifier } from '../../ast.js';
import { EqualityChecker } from '../../visitors/equality-checker.js';
import { mockLang } from '../../testing/mock-lang.js';
import { IndexScans } from './index-scans.js';
import { PlanTupleOperator } from '../../plan/visitor.js';
import { Index, IndexFillInput, IndexMatchInput } from '../../indices/index.js';
import { intermediateToCalc } from '../../utils/calculation.js';
import { CalculationBuilder } from '../../visitors/calculation-builder.js';

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

describe('IndexScans', () => {
  let db: DortDB;
  let eqChecker: EqualityChecker;
  const lang = mockLang.name;
  const sourceName = ASTIdentifier.fromParts(['test', 'source']);
  let calcBuilders: Record<string, CalculationBuilder>;
  const strToCalc = (str: string) =>
    intermediateToCalc(
      new plan.FnCall(lang, [ASTIdentifier.fromParts([str])], () => str),
      calcBuilders,
      {
        [lang]: eqChecker,
      },
    );

  beforeEach(() => {
    db = new DortDB({
      mainLang: mockLang,
      optimizer: {
        rules: [IndexScans],
      },
    });
    db.registerSource(sourceName.parts, []);
    const vmap: Record<string, EqualityChecker> = {};
    eqChecker = vmap[lang] = new EqualityChecker(vmap);
    calcBuilders = (db as any).friendInterface.langMgr.getVisitorMap(
      'calculationBuilder',
    );
  });

  for (const sourceType of ['tuple', 'item'] as const) {
    describe(`with ${sourceType} source`, () => {
      let source: PlanTupleOperator;

      beforeEach(() => {
        if (sourceType === 'tuple') {
          source = new plan.TupleSource(lang, sourceName);
        } else {
          const sourceKey = ASTIdentifier.fromParts(['test', 'sourceKey']);
          source = new plan.MapFromItem(
            lang,
            sourceKey,
            new plan.ItemSource(lang, sourceName),
          );
        }
      });

      it('should not do anything if there are no applicable selections', () => {
        const initialPlan = new plan.Limit(
          lang,
          10,
          10,
          new plan.Selection(
            lang,
            new plan.Calculation(lang, () => true, [], []),
            source.clone(),
          ),
        );
        const expectedPlan = initialPlan.clone();
        const optimized = db.optimizer.optimize(initialPlan);
        expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
      });

      describe('single expr index', () => {
        it('should apply index scan when the only selection matches', () => {
          const initialPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.Selection(lang, strToCalc('foo'), source.clone()),
          );

          const index = new MockIndex([], null);
          index.match.mockImplementation(() => [0]);
          const accessor = strToCalc('access');
          index.createAccessor.mockImplementation(() => accessor);
          db.indices.set(sourceName.parts, [index]);

          const expectedPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.IndexScan(lang, sourceName, index, accessor.clone()),
          );
          const optimized = db.optimizer.optimize(initialPlan);
          expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
        });

        it('should apply index scan when the first selection matches', () => {
          const barCalc = strToCalc('bar');
          const initialPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.Selection(
              lang,
              strToCalc('foo'),
              new plan.Selection(lang, barCalc, source.clone()),
            ),
          );

          const index = new MockIndex([], null);
          index.match.mockImplementation((exprs) => [
            exprs.findIndex(
              (e) => (e.expr as ASTIdentifier).parts[0] === 'foo',
            ),
          ]);
          const accessor = strToCalc('access');
          index.createAccessor.mockImplementation(() => accessor);
          db.indices.set(sourceName.parts, [index]);

          const expectedPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.Selection(
              lang,
              barCalc.clone(),
              new plan.IndexScan(lang, sourceName, index, accessor.clone()),
            ),
          );
          const optimized = db.optimizer.optimize(initialPlan);
          expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
        });

        it('should apply index scan when the last selection matches', () => {
          const fooCalc = strToCalc('foo');
          const initialPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.Selection(
              lang,
              fooCalc,
              new plan.Selection(lang, strToCalc('bar'), source.clone()),
            ),
          );

          const index = new MockIndex([], null);
          index.match.mockImplementation((exprs) => [
            exprs.findIndex(
              (e) => (e.expr as ASTIdentifier).parts[0] === 'bar',
            ),
          ]);
          const accessor = strToCalc('access');
          index.createAccessor.mockImplementation(() => accessor);
          db.indices.set(sourceName.parts, [index]);

          const expectedPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.Selection(
              lang,
              fooCalc.clone(),
              new plan.IndexScan(lang, sourceName, index, accessor.clone()),
            ),
          );
          const optimized = db.optimizer.optimize(initialPlan);
          expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
        });

        it('should apply index scan when the middle selection matches', () => {
          const fooCalc = strToCalc('foo');
          const bazCalc = strToCalc('baz');
          const initialPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.Selection(
              lang,
              fooCalc,
              new plan.Selection(
                lang,
                strToCalc('bar'),
                new plan.Selection(lang, bazCalc, source.clone()),
              ),
            ),
          );

          const index = new MockIndex([], null);
          index.match.mockImplementation((exprs) => [
            exprs.findIndex(
              (e) => (e.expr as ASTIdentifier).parts[0] === 'bar',
            ),
          ]);
          const accessor = strToCalc('access');
          index.createAccessor.mockImplementation(() => accessor);
          db.indices.set(sourceName.parts, [index]);

          const expectedPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.Selection(
              lang,
              fooCalc.clone(),
              new plan.Selection(
                lang,
                bazCalc.clone(),
                new plan.IndexScan(lang, sourceName, index, accessor.clone()),
              ),
            ),
          );
          const optimized = db.optimizer.optimize(initialPlan);
          expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
        });

        it('should apply the first index scan that matches', () => {
          const initialPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.Selection(lang, strToCalc('foo'), source.clone()),
          );

          const accessor = strToCalc('access');
          const indices: MockIndex[] = [];
          for (let i = 0; i < 3; i++) {
            const index = new MockIndex([], null);
            index.match.mockImplementation(() => [0]);
            index.createAccessor.mockImplementation(() => accessor.clone());
            indices.push(index);
          }
          db.indices.set(sourceName.parts, indices);

          const expectedPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.IndexScan(lang, sourceName, indices[0], accessor.clone()),
          );
          const optimized = db.optimizer.optimize(initialPlan);
          expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
        });
      });

      describe('multi expr index', () => {
        it('should apply index scan when all selections match', () => {
          const initialPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.Selection(
              lang,
              strToCalc('foo'),
              new plan.Selection(lang, strToCalc('bar'), source.clone()),
            ),
          );

          const index = new MockIndex([], null);
          index.match.mockImplementation((exprs) =>
            exprs
              .map((_, i) => i)
              .filter((i) =>
                ['foo', 'bar'].includes(
                  (exprs[i].expr as ASTIdentifier).parts[0] as string,
                ),
              ),
          );
          const accessor = strToCalc('access');
          index.createAccessor.mockImplementation(() => accessor);
          db.indices.set(sourceName.parts, [index]);

          const expectedPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.IndexScan(lang, sourceName, index, accessor.clone()),
          );
          const optimized = db.optimizer.optimize(initialPlan);
          expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
        });
        it('should apply index scan when some selections match', () => {
          const calcs = ['c1', 'c2', 'c3', 'c4', 'c5'].map(strToCalc);
          const initialPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.Selection(
              lang,
              calcs[0],
              new plan.Selection(
                lang,
                calcs[1],
                new plan.Selection(
                  lang,
                  calcs[2],
                  new plan.Selection(
                    lang,
                    calcs[3],
                    new plan.Selection(lang, calcs[4], source.clone()),
                  ),
                ),
              ),
            ),
          );

          const index = new MockIndex([], null);
          index.match.mockImplementation((exprs) =>
            exprs
              .map((_, i) => i)
              .filter((i) =>
                ['c2', 'c4'].includes(
                  (exprs[i].expr as ASTIdentifier).parts[0] as string,
                ),
              ),
          );
          const accessor = strToCalc('access');
          index.createAccessor.mockImplementation(() => accessor);
          db.indices.set(sourceName.parts, [index]);

          const expectedPlan = new plan.Limit(
            lang,
            10,
            10,
            new plan.Selection(
              lang,
              calcs[0].clone(),
              new plan.Selection(
                lang,
                calcs[2].clone(),
                new plan.Selection(
                  lang,
                  calcs[4].clone(),
                  new plan.IndexScan(lang, sourceName, index, accessor.clone()),
                ),
              ),
            ),
          );
          const optimized = db.optimizer.optimize(initialPlan);
          expect(eqChecker.areEqual(optimized, expectedPlan)).toBe(true);
        });
      });
    });
  }
});
