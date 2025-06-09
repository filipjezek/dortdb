import { CalculationBuilder, CalculationParams } from '@dortdb/core';
import { ProjectionSize, TreeJoin, XQueryPlanVisitor } from '../plan/index.js';
import { assertMaxOne, flat } from '@dortdb/core/internal-fns';
import * as plan from '@dortdb/core/plan';

export class XQueryCalculationBuilder
  extends CalculationBuilder
  implements XQueryPlanVisitor<CalculationParams>
{
  visitTreeJoin(operator: TreeJoin): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  visitProjectionSize(operator: ProjectionSize): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitCartesianProduct(
    operator: plan.CartesianProduct,
  ): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitDifference(operator: plan.Difference): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitDistinct(operator: plan.Distinct): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitGroupBy(operator: plan.GroupBy): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitIndexScan(operator: plan.IndexScan): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitIndexedRecursion(
    operator: plan.IndexedRecursion,
  ): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitIntersection(operator: plan.Intersection): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitItemFnSource(operator: plan.ItemFnSource): CalculationParams {
    return {
      args: [operator],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitItemSource(operator: plan.ItemSource): CalculationParams {
    return {
      args: [operator],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitMapFromItem(operator: plan.MapFromItem): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitMapToItem(operator: plan.MapToItem): CalculationParams {
    return {
      args: [operator],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitJoin(operator: plan.Join): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitLimit(operator: plan.Limit): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitOrderBy(operator: plan.OrderBy): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitProjection(operator: plan.Projection): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitProjectionConcat(
    operator: plan.ProjectionConcat,
  ): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitProjectionIndex(
    operator: plan.ProjectionIndex,
  ): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitRecursion(operator: plan.Recursion): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitSelection(operator: plan.Selection): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitTupleFnSource(operator: plan.TupleFnSource): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitTupleSource(operator: plan.TupleSource): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
  override visitUnion(operator: plan.Union): CalculationParams {
    return {
      args: [this.toItem(operator)],
      impl: flat,
      argMeta: [{ originalLocations: [] }],
    };
  }
}
