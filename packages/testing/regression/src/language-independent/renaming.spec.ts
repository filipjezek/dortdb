import { ASTIdentifier, AttributeRenamer, DortDB } from '@dortdb/core';
import { RenameMap } from '@dortdb/core/plan';
import { SQL } from '@dortdb/lang-sql';
import { Trie } from '@dortdb/core/data-structures';
import { PushdownSelections } from '@dortdb/core/optimizer';

describe('Attribute renaming', () => {
  const db = new DortDB({
    mainLang: SQL(),
    optimizer: { rules: [] },
  });
  db.registerSource(
    ['nation'],
    [
      { nationKey: 1, population: 60 },
      { nationKey: 2, population: 50 },
      { nationKey: 3, population: 40 },
      { nationKey: 4, population: 30 },
      { nationKey: 5, population: 20 },
      { nationKey: 6, population: 10 },
    ],
  );

  it('should not rename attributes that would shadow existing attributes', () => {
    db.optimizer.reconfigure({ rules: [PushdownSelections] });
    const result = db.query(`
      select nationKey from nation x
      where exists (select 1 from nation where nationKey > x.nationKey)
      order by nationKey
    `);
    expect(result.data).toEqual([
      { nationKey: 1 },
      { nationKey: 2 },
      { nationKey: 3 },
      { nationKey: 4 },
      { nationKey: 5 },
    ]);
  });

  it('should not rename attributes that are not free', () => {
    db.optimizer.reconfigure({ rules: [] });
    const renamers: Record<string, AttributeRenamer> = (
      db as any
    ).friendInterface.langMgr.getVisitorMap('attributeRenamer');
    const ast = db.parse(`
      select nationKey, population from nation
      where nationKey > (select avg(nationKey) from nation)
      order by nationKey
    `);
    const plan = db.buildPlan(ast[0]);
    const renameMap: RenameMap = new Trie();
    renameMap.set(['nationKey'], ['population']);
    renamers[plan.lang].rename(
      (plan as any).source.source.source.condition,
      renameMap,
    );

    const aggArg = (plan as any).source.source.source.condition.args[1].source
      .source.aggs[0].args[0] as ASTIdentifier;

    expect(aggArg.parts).toEqual(['nationKey']);

    const result = db.executePlan(plan);

    // only partially renamed because the inner query is not free
    expect(Array.from(result.data)).toEqual([
      { nationKey: 1, population: 60 },
      { nationKey: 2, population: 50 },
      { nationKey: 3, population: 40 },
      { nationKey: 4, population: 30 },
      { nationKey: 5, population: 20 },
      { nationKey: 6, population: 10 },
    ]);
  });

  it('should rename attributes that are free', () => {
    db.optimizer.reconfigure({ rules: [] });
    const renamers: Record<string, AttributeRenamer> = (
      db as any
    ).friendInterface.langMgr.getVisitorMap('attributeRenamer');
    const ast = db.parse(`
      select x.nationKey nationKey, x.population population from nation x
      where x.nationKey > (select avg(x.nationKey) from nation)
      order by x.nationKey
    `);
    const plan = db.buildPlan(ast[0]);
    const renameMap: RenameMap = new Trie();
    renameMap.set(['x', 'nationKey'], ['x', 'population']);
    renamers[plan.lang].rename(
      (plan as any).source.source.source.condition,
      renameMap,
    );

    const aggArg = (plan as any).source.source.source.condition.args[1].source
      .source.aggs[0].args[0] as ASTIdentifier;

    expect(aggArg.parts).toEqual(['x', 'population']);

    const result = db.executePlan(plan);

    // not renamed because the inner query is not free
    expect(Array.from(result.data)).toEqual([]);
  });
});
