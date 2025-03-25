import { allAttrs, ASTIdentifier, boundParam } from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import { ret1, toPair } from '@dortdb/core/internal-fns';
import { count } from '@dortdb/core/aggregates';
import { DOT, POS, TreeJoin } from '@dortdb/lang-xquery';

const unnamed = Symbol('unnamed');
const unnamed0 = ASTIdentifier.fromParts([unnamed, '0']);
const unnamed1 = ASTIdentifier.fromParts([unnamed, '1']);

const xqueryBranch = new plan.Projection(
  'sql',
  [[DOT, ASTIdentifier.fromParts(['products', 'item'])]],
  new TreeJoin(
    'xquery',
    new plan.Calculation('xquery', ret1, [DOT]),
    new plan.Selection(
      'xquery',
      new plan.Calculation('xquery', ret1, [POS]),
      new TreeJoin(
        'xquery',
        new plan.Calculation('xquery', ret1, [DOT]),
        new plan.Selection(
          'xquery',
          new plan.Calculation('xquery', ret1, [
            new plan.MapToItem(
              'xquery',
              DOT,
              new TreeJoin(
                'xquery',
                new plan.Calculation('xquery', ret1, [DOT]),
                new plan.MapFromItem(
                  'xquery',
                  DOT,
                  new plan.ItemFnSource(
                    'xquery',
                    [DOT],
                    ret1,
                    ASTIdentifier.fromParts(['unwind']),
                  ),
                ),
              ),
            ),
            ASTIdentifier.fromParts(['friends', 'id']),
            POS,
          ]),
          new TreeJoin(
            'xquery',
            new plan.Calculation('xquery', ret1, [DOT]),
            new plan.MapFromItem(
              'xquery',
              DOT,
              new plan.ItemSource(
                'xquery',
                ASTIdentifier.fromParts(['invoices']),
              ),
            ),
          ),
        ),
      ),
    ),
  ),
);
const addressTable = new plan.TupleSource(
  'sql',
  ASTIdentifier.fromParts(['addresses']),
);
addressTable.addToSchema([
  ASTIdentifier.fromParts(['addresses', 'city']),
  ASTIdentifier.fromParts(['addresses', 'customerId']),
]);

export const optimizedPlan = new plan.Projection(
  'sql',
  [
    toPair(ASTIdentifier.fromParts(['products', 'value'])),
    [
      new plan.Calculation('sql', ret1, [
        ASTIdentifier.fromParts(['"count"(*)']),
      ]),
      ASTIdentifier.fromParts(['productsCount']),
    ],
  ],
  new plan.Selection(
    'sql',
    new plan.Calculation('sql', ret1, [
      ASTIdentifier.fromParts(['"count"(*)']),
    ]),
    new plan.GroupBy(
      'sql',
      [toPair(ASTIdentifier.fromParts(['products', 'name']))],
      [
        new plan.AggregateCall(
          'sql',
          [ASTIdentifier.fromParts([allAttrs])],
          count,
          ASTIdentifier.fromParts(['"count"(*)']),
        ),
      ],
      new plan.ProjectionConcat(
        'sql',
        xqueryBranch,
        false,
        new plan.Join(
          'sql',
          new plan.Selection(
            'sql',
            new plan.Calculation('sql', ret1, [
              ASTIdentifier.fromParts(['addresses', 'city']),
            ]),
            addressTable,
          ),
          new plan.Projection(
            'cypher',
            [
              [
                new plan.Calculation('cypher', ret1, [
                  ASTIdentifier.fromParts(['friend']),
                ]),
                ASTIdentifier.fromParts(['friends', 'id']),
              ],
            ],
            new plan.Join(
              'cypher',
              new plan.Join(
                'cypher',
                new plan.Selection(
                  'cypher',
                  new plan.Calculation('cypher', ret1, [
                    unnamed0,
                    ASTIdentifier.fromParts([boundParam, 'myId']),
                  ]),
                  new plan.MapFromItem(
                    'cypher',
                    unnamed0,
                    new plan.ItemSource(
                      'cypher',
                      ASTIdentifier.fromParts(['defaultGraph', 'nodes']),
                    ),
                  ),
                ),
                new plan.Selection(
                  'cypher',
                  new plan.Calculation('cypher', ret1, [unnamed1]),
                  new plan.MapFromItem(
                    'cypher',
                    unnamed1,
                    new plan.ItemSource(
                      'cypher',
                      ASTIdentifier.fromParts(['defaultGraph', 'edges']),
                    ),
                  ),
                ),
                new plan.Calculation('cypher', ret1, [unnamed0, unnamed1]),
              ),
              new plan.MapFromItem(
                'cypher',
                ASTIdentifier.fromParts(['friend']),
                new plan.ItemSource(
                  'cypher',
                  ASTIdentifier.fromParts(['defaultGraph', 'nodes']),
                ),
              ),
              new plan.Calculation('cypher', ret1, [
                ASTIdentifier.fromParts(['friend']),
                unnamed1,
                unnamed0,
              ]),
            ),
          ),
          new plan.Calculation('sql', ret1, [
            ASTIdentifier.fromParts(['friends', 'id']),
            ASTIdentifier.fromParts(['addresses', 'customerId']),
          ]),
        ),
      ),
    ),
  ),
);

const groupBy = (optimizedPlan.source as plan.Selection).source as plan.GroupBy;
groupBy.aggs[0].postGroupSource.addToSchema(groupBy.source.schema);
