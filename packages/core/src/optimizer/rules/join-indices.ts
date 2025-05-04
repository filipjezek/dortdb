import { ASTIdentifier } from '../../ast.js';
import { DortDBAsFriend } from '../../db.js';
import * as plan from '../../plan/operators/index.js';
import { IdSet, PlanOperator } from '../../plan/visitor.js';
import { containsAll } from '../../utils/trie.js';
import { AttributeRenameChecker } from '../../visitors/attribute-rename-checker.js';
import { AttributeRenamer } from '../../visitors/attribute-renamer.js';
import { TransitiveDependencies } from '../../visitors/transitive-deps.js';
import { PatternRule, PatternRuleMatchResult } from '../rule.js';

export interface JoinIndicesBindings {
  side: 'left' | 'right';
  renameMap?: plan.RenameMap;
  indexMatch: number[];
  source: plan.TupleSource;
}

export class JoinIndices
  implements PatternRule<plan.Join, JoinIndicesBindings>
{
  public operator = plan.Join;
  protected tdepsVmap: Record<string, TransitiveDependencies>;
  protected renamerVmap: Record<string, AttributeRenamer>;
  protected renameCheckerVmap: Record<string, AttributeRenameChecker>;

  constructor(protected db: DortDBAsFriend) {
    this.tdepsVmap = this.db.langMgr.getVisitorMap('transitiveDependencies');
    this.renamerVmap = this.db.langMgr.getVisitorMap('attributeRenamer');
    this.renameCheckerVmap = this.db.langMgr.getVisitorMap(
      'attributeRenameChecker',
    );
  }

  match(node: plan.Join): PatternRuleMatchResult<JoinIndicesBindings> {
    for (const side of ['left', 'right'] as const) {
      if (
        (side === 'left' && node.rightOuter) ||
        (side === 'right' && node.leftOuter)
      )
        continue;
      const tRes = this.traverseSide(node[side]);
      if (!tRes) continue;
      const candidates = this.getExprCandidates(
        node.conditions,
        node[side].schemaSet,
      );
      if (!candidates.length) continue;
      const indices =
        this.db.indices.get(
          (Array.isArray(tRes.source.name)
            ? tRes.source.name[0]
            : tRes.source.name
          ).parts,
        ) ?? [];
      const renameMap = this.prepareRenameMap(tRes.projections);

      for (const index of indices) {
        const match = index.match(
          candidates.map(([i, j]) => {
            const containingFn = node.conditions[i].original as plan.FnCall;
            return {
              containingFn,
              expr:
                containingFn.args[j] instanceof ASTIdentifier
                  ? containingFn.args[j]
                  : containingFn.args[j].op,
            };
          }),
          renameMap,
        );
        if (match) {
          return {
            bindings: {
              side,
              renameMap,
              indexMatch: match.map((i) => candidates[i][0]),
              source: tRes.source,
            },
          };
        }
      }
    }
    return null;
  }

  protected prepareRenameMap(
    projections: plan.Projection[],
  ): plan.RenameMap | null {
    if (!projections.length) return null;
    const renameMap = projections[0].renamesInv.clone();
    for (let i = 1; i < projections.length; i++) {
      for (const [key, value] of renameMap.entries()) {
        renameMap.set(key, projections[i].renamesInv.get(value) ?? value);
      }
    }
    return renameMap;
  }

  /**
   * Get expressions to match against the index.
   * @param conditions conditions to check
   * @param schema schema of the side which we are checking against
   * @returns array of pairs [condition index, condition original FnCall argument index]
   */
  protected getExprCandidates(
    conditions: plan.Calculation[],
    schema: IdSet,
  ): [number, number][] {
    const candidates: [number, number][] = [];
    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i];
      if (cond.original instanceof plan.FnCall) {
        const args = cond.original.args;
        for (let j = 0; j < args.length; j++) {
          if (args[j] instanceof ASTIdentifier) {
            if (schema.has((args[j] as ASTIdentifier).parts)) {
              candidates.push([i, j]);
              break;
            }
          } else {
            const tdeps = (args[j] as plan.PlanOpAsArg).op.accept(
              this.tdepsVmap,
            );
            if (containsAll(schema, tdeps)) {
              candidates.push([i, j]);
              break;
            }
          }
        }
      }
    }
    return candidates;
  }

  protected traverseSide(node: PlanOperator): {
    projections: plan.Projection[];
    source: plan.TupleSource;
  } | null {
    const projections: plan.Projection[] = [];
    while (
      [plan.Projection, plan.Selection, plan.OrderBy].includes(
        node.constructor as any,
      )
    ) {
      if (node instanceof plan.Projection) {
        projections.push(node);
      }
      node = (node as plan.Projection | plan.Selection | plan.OrderBy).source;
    }
    if (node instanceof plan.TupleSource) {
      return { projections, source: node };
    }
    return null;
  }

  transform(node: plan.Join, bindings: JoinIndicesBindings): PlanOperator {
    const otherSide = bindings.side === 'left' ? 'right' : 'left';
    const external = Symbol('external');
    const proj = new plan.Projection(
      node.lang,
      node[otherSide].schema.map((id) => [
        id,
        ASTIdentifier.fromParts([external, ...id.parts]),
      ]),
      node[otherSide],
    );
    for (const cond of node.conditions) {
      this.renamerVmap[cond.lang].rename(cond, proj.renames);
    }

    const source = bindings.source;
    for (const i of bindings.indexMatch) {
      const cond = node.conditions[i];
      if (bindings.renameMap) {
        this.renamerVmap[cond.lang].rename(cond, bindings.renameMap);
      }
      source.parent.replaceChild(
        source,
        new plan.Selection(cond.lang, cond, source),
      );
    }

    for (let i = 0; i < node.conditions.length; i++) {
      const cond = node.conditions[i];
      if (bindings.indexMatch.includes(i)) continue;
      node.replaceChild(
        node[bindings.side],
        new plan.Selection(cond.lang, cond, node[bindings.side]),
      );
    }

    const djoin = new plan.ProjectionConcat(
      node.lang,
      node[bindings.side],
      node[`${bindings.side}Outer`],
      proj,
    );

    return new plan.Projection(
      node.lang,
      djoin.schema.map((id) =>
        id.parts[0] === external
          ? [id, ASTIdentifier.fromParts(id.parts.slice(1))]
          : [id, id],
      ),
      djoin,
    );
  }
}
