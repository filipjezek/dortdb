import { DortDB } from '@dortdb/core';
import { Cypher } from '@dortdb/lang-cypher';
import { defaultRules } from '@dortdb/core/optimizer';

describe('Cypher - quantified expressions', () => {
  const db = new DortDB({
    mainLang: Cypher({ defaultGraph: 'g' }),
    optimizer: { rules: defaultRules },
  });

  it('should evaluate all() over all elements matching', () => {
    const result = db.query('RETURN all(x IN [1, 3, 5] WHERE x > 0) AS result');
    expect(result.data).toEqual([{ result: true }]);
  });

  it('should evaluate all() over some elements not matching', () => {
    const result = db.query('RETURN all(x IN [1, 3, 5] WHERE x > 2) AS result');
    expect(result.data).toEqual([{ result: false }]);
  });

  it('should evaluate all() over no elements', () => {
    const result = db.query('RETURN all(x IN [] WHERE x > 0) AS result');
    expect(result.data).toEqual([{ result: true }]);
  });

  it('should evaluate any() over all elements not matching', () => {
    const result = db.query('RETURN any(x IN [1, 3, 5] WHERE x < 0) AS result');
    expect(result.data).toEqual([{ result: false }]);
  });

  it('should evaluate any() over some elements matching', () => {
    const result = db.query(
      'RETURN any(x IN [1, 3, -1, 5] WHERE x < 0) AS result',
    );
    expect(result.data).toEqual([{ result: true }]);
  });

  it('should evaluate any() over no elements', () => {
    const result = db.query('RETURN any(x IN [] WHERE x < 0) AS result');
    expect(result.data).toEqual([{ result: false }]);
  });

  it('should evaluate single() over a single matching element', () => {
    const result = db.query(
      'RETURN single(x IN [1, 3, 5] WHERE x = 3) AS result',
    );
    expect(result.data).toEqual([{ result: true }]);
  });

  it('should evaluate single() over multiple matching elements', () => {
    const result = db.query(
      'RETURN single(x IN [1, 3, 5] WHERE x > 0) AS result',
    );
    expect(result.data).toEqual([{ result: false }]);
  });

  it('should evaluate single() over no matching elements', () => {
    const result = db.query(
      'RETURN single(x IN [1, 3, 5] WHERE x < 0) AS result',
    );
    expect(result.data).toEqual([{ result: false }]);
  });

  it('should evaluate single() over no elements', () => {
    const result = db.query('RETURN single(x IN [] WHERE x < 0) AS result');
    expect(result.data).toEqual([{ result: false }]);
  });

  it('should evaluate none() over all elements not matching', () => {
    const result = db.query(
      'RETURN none(x IN [1, 3, 5] WHERE x < 0) AS result',
    );
    expect(result.data).toEqual([{ result: true }]);
  });

  it('should evaluate none() over some elements matching', () => {
    const result = db.query(
      'RETURN none(x IN [1, 3, -1, 5] WHERE x < 0) AS result',
    );
    expect(result.data).toEqual([{ result: false }]);
  });

  it('should evaluate none() over no elements', () => {
    const result = db.query('RETURN none(x IN [] WHERE x < 0) AS result');
    expect(result.data).toEqual([{ result: true }]);
  });
});
