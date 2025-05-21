import { allAttrs, ASTIdentifier } from '../ast.js';
import { QueryResult } from '../db.js';
import { ExecutionContext } from '../execution-context.js';
import { SerializeFn } from '../lang-manager.js';

export function serializeToObjects(schemaSeparator = '.'): SerializeFn {
  return function (
    items: Iterable<unknown> | Iterable<unknown[]>,
    ctx: ExecutionContext,
    schema: ASTIdentifier[] | undefined,
  ): QueryResult {
    const serializedSchema = schema?.map((attr) =>
      attr.parts.map((x) => x.toString()).join(schemaSeparator),
    );
    const iter = items[Symbol.iterator]();
    let iterItem = iter.next();
    if (iterItem.done) {
      return { data: [], schema: serializedSchema };
    }
    const firstItem = iterItem.value;

    if (Array.isArray(firstItem)) {
      const keys = Object.keys(firstItem).map((x) => +x);
      const resKeys = keys.map((x) =>
        ctx.variableNames[x].parts
          .map((x) => x.toString())
          .join(schemaSeparator),
      );
      const allAttrsKeys = keys.map(
        (x) =>
          ctx.variableNames[x].parts[ctx.variableNames[x].parts.length - 1] ===
          allAttrs,
      );
      const data: Record<string | symbol, unknown>[] = [];

      do {
        const result: Record<string, unknown> = {};
        for (let i = 0; i < keys.length; i++) {
          const val = iterItem.value[keys[i]];
          if (allAttrsKeys[i]) {
            Object.assign(result, val);
          } else {
            result[resKeys[i]] = val;
          }
        }
        data.push(result);
      } while (!(iterItem = iter.next()).done);

      return {
        data,
        schema: serializedSchema,
      };
    } else {
      const data = [firstItem];
      while (!(iterItem = iter.next()).done) {
        data.push(iterItem.value);
      }
      return {
        data,
        schema: serializedSchema,
      };
    }
  };
}
