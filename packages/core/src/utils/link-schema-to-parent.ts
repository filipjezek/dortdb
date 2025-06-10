import { PlanTupleOperator } from '../plan/visitor.js';

/**
 * Ensures that the operator parent's schema is a reference to the operator's schema.
 */
export function linkSchemaToParent(operator: PlanTupleOperator) {
  const newSchema = operator.schema;
  operator.schema = (operator.parent as PlanTupleOperator).schema;
  operator.schemaSet = (operator.parent as PlanTupleOperator).schemaSet;
  operator.clearSchema();
  operator.addToSchema(newSchema);
}
