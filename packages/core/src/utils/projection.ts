import { Projection } from '../plan/operators/index.js';
import { IdSet } from '../plan/visitor.js';

export function areDepsOnlyRenamed(deps: IdSet, projection: Projection) {
  for (const id of deps) {
    if (projection.schemaSet.has(id) && !projection.renames.has(id)) {
      console.log('areDepsOnlyRenamed failed', id, deps, projection);
      return false;
    }
  }
  console.log('areDepsOnlyRenamed ok');
  return true;
}
