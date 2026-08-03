import {
  AttributeRenamer,
  DortDBAsFriend,
  PlanVisitor,
  Translations,
} from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';

/**
 * Extends {@link AttributeRenamer} to apply column renames inside
 * {@link TreeJoin} step expressions and to propagate renames through
 * {@link ProjectionSize} operators.
 */
export class XQueryAttributeRenamer
  extends AttributeRenamer
  implements XQueryPlanVisitor<void, Translations>
{
  constructor(
    vmap: Record<string, PlanVisitor<void, Translations>>,
    db: DortDBAsFriend,
  ) {
    super(vmap, db);
  }
  visitTreeJoin(operator: TreeJoin, translations: Translations): void {
    operator.source.accept(this.vmap, translations);
    this.processItem(operator, 'step', translations, operator);
  }
  visitProjectionSize(
    operator: ProjectionSize,
    translations: Translations,
  ): void {
    const renames = translations.get(operator);
    operator.sizeCol = renames.get(operator.sizeCol.parts);
    operator.source.accept(this.vmap, translations);
  }
}
