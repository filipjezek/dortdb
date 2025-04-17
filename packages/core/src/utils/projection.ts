import { Projection } from '../plan/operators/index.js';
import { IdSet } from '../plan/visitor.js';

export enum RenamedDepsResult {
  modified = 0,
  renamed = 1,
  unchanged = 2,
}

export function areDepsOnlyRenamed(
  deps: IdSet,
  projection: Projection,
): RenamedDepsResult {
  let unchanged = true;
  for (const id of deps) {
    if (projection.schemaSet.has(id)) {
      if (!projection.renamesInv.has(id)) {
        return RenamedDepsResult.modified;
      }
      if (unchanged && !arrEq(projection.renamesInv.get(id), id)) {
        unchanged = false;
      }
    }
  }
  return unchanged ? RenamedDepsResult.unchanged : RenamedDepsResult.renamed;
}

function arrEq<T>(arr1: T[], arr2: T[]): boolean {
  if (arr1.length !== arr2.length) {
    return false;
  }
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }
  return true;
}
