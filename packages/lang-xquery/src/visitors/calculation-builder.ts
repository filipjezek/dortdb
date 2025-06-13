import { CalculationBuilder, CalculationParams } from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { flat } from '@dortdb/core/internal-fns';
import * as plan from '@dortdb/core/plan';

export class XQueryCalculationBuilder
  extends CalculationBuilder
  implements XQueryPlanVisitor<CalculationParams>
{
  visitTreeJoin(operator: TreeJoin): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  visitProjectionSize(operator: ProjectionSize): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitCartesianProduct(
    operator: plan.CartesianProduct,
  ): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitDifference(operator: plan.Difference): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitDistinct(operator: plan.Distinct): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitGroupBy(operator: plan.GroupBy): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitIndexScan(operator: plan.IndexScan): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitIndexedRecursion(
    operator: plan.IndexedRecursion,
  ): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitIntersection(operator: plan.Intersection): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitItemFnSource(operator: plan.ItemFnSource): CalculationParams {
    return {
      args: [operator],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitItemSource(operator: plan.ItemSource): CalculationParams {
    return {
      args: [operator],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitMapFromItem(operator: plan.MapFromItem): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitMapToItem(operator: plan.MapToItem): CalculationParams {
    return {
      args: [operator],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitJoin(operator: plan.Join): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitLimit(operator: plan.Limit): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitOrderBy(operator: plan.OrderBy): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitProjection(operator: plan.Projection): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitProjectionConcat(
    operator: plan.ProjectionConcat,
  ): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitProjectionIndex(
    operator: plan.ProjectionIndex,
  ): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitRecursion(operator: plan.Recursion): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitSelection(operator: plan.Selection): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitTupleFnSource(operator: plan.TupleFnSource): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitTupleSource(operator: plan.TupleSource): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
  override visitUnion(operator: plan.Union): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [], acceptSequence: true }],
    };
  }
}
