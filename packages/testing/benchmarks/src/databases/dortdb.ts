import { Database, type SqlObject, type SqlValue } from '../database.js';
import { QueryParams } from '../query.js';
import { DortDB, MapIndex, QueryResult } from '@dortdb/core';
import { datetime } from '@dortdb/datetime';
import { SQL } from '@dortdb/lang-sql';
import { UnnestSubqueries, mergeToFromItems, mergeFromToItems, PushdownSelections, ProjConcatToJoin, productsToJoins, JoinIndices, IndexScans, MergeProjections, PatternRule, PatternRuleConstructor } from '@dortdb/core/optimizer';
import { DomDataAdapter, XQuery } from '@dortdb/lang-xquery';
import { Cypher } from '@dortdb/lang-cypher'
import { createDocument } from '../utils/setup-xml.js';

export type ResultObject = { [key: string]: ResultValue };
export type ResultValue = SqlValue | Date | ResultObject | ResultValue[];

export class DortDBDatabase extends Database<QueryResult<ResultObject>> {
  constructor(
    readonly innerDb: DortDB
  ) {
    super();
  }

  override async query(content: string, params?: QueryParams) {
    const options = params ? { boundParams: params } : undefined;
    return this.innerDb.query<ResultObject>(content, options);
  }

  override extractResults(result: QueryResult<ResultObject>): SqlObject[] {
    const { data, schema } = result;

    // Some workaround probably. Not sure why this is needed.
    const objects = schema
      ? data
      : data.map(value => ({ value })) as ResultObject[];

    return objects.map(object => {
      const output: SqlObject = {};

      for (const key in object)
        output[key] = transformToSqlValue(object[key]);

      return output;
    });
  }

  static create(excludeRules: DortDBRuleFamily[]): DortDBDatabase {
    const rules: (PatternRule | PatternRuleConstructor)[] = [];

    for (const [ family, familyRules ] of Object.entries(RULE_FAMILIES)) {
      if (!excludeRules.includes(family as DortDBRuleFamily))
        rules.push(...familyRules);
    }

    const innerDb = new DortDB({
      mainLang: SQL(),
      additionalLangs: [
        XQuery({ adapter: new DomDataAdapter(createDocument()) }),
        Cypher({ defaultGraph: 'defaultGraph' }),
      ],
      extensions: [ datetime ],
      optimizer: { rules },
      executor: { hashJoinIndices: [ MapIndex ] },
    });

    return new DortDBDatabase(innerDb);
  }
}

function transformToSqlValue(value: ResultValue): SqlValue {
  if (typeof value !== 'object')
    return value;

  // Can't be put to the previous case for some TS reason.
  if (value === null)
    return null;

  if (value instanceof Date)
    return value.toISOString().substring(0, 10);

  throw new Error(`Cannot transform value to SqlValue: ${value}`);
}

const RULE_FAMILIES = {
  subqueryNormalization: [ UnnestSubqueries ],
  boundaryNormalization: [ mergeToFromItems, mergeFromToItems ],
  predicateMovement: [ PushdownSelections ],
  joinNormalization: [ ProjConcatToJoin, productsToJoins ],
  indexAwareRewriting: [ JoinIndices, IndexScans ],
  planSimplification: [ MergeProjections ],
};

export type DortDBRuleFamily = keyof typeof RULE_FAMILIES;
export const DORTDB_RULE_FAMILIES = Object.keys(RULE_FAMILIES) as DortDBRuleFamily[];
