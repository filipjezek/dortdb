import { allAttrs } from '../ast.js';
import { SerializeFn } from '../lang-manager.js';
import { PlanTupleOperator } from '../plan/visitor.js';

export function serializeToObjects(schemaSeparator = '.'): SerializeFn {
  return function (items, ctx, operator) {
    if (!(operator instanceof PlanTupleOperator)) {
      return { data: items };
    }
    const serializedSchema = operator.schema.map((attr) =>
      attr.parts.map((x) => x.toString()).join(schemaSeparator),
    );
    const allAttrsKeys = operator.schema.map(
      (x) => x.parts.at(-1) === allAttrs,
    );
    const keys = ctx.getKeys(operator);

    return {
      schema: serializedSchema,
      data: Iterator.from(items as Iterable<unknown[]>).map((item) => {
        const result: Record<string, unknown> = {};
        for (let i = 0; i < keys.length; i++) {
          const val = item[keys[i]];
          if (allAttrsKeys[i]) {
            Object.assign(result, val);
          } else {
            result[serializedSchema[i]] = val;
          }
        }
        return result;
      }),
    };
  };
}
