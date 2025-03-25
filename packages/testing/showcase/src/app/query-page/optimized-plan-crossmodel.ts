import { ASTIdentifier } from '@dortdb/core';
import * as plan from '@dortdb/core/plan';
import { ret1, toPair } from '@dortdb/core/internal-fns';
import { DOT, TreeJoin } from '@dortdb/lang-xquery';

const addressTable = new plan.TupleSource(
  'sql',
  ASTIdentifier.fromParts(['addresses']),
);
addressTable.addToSchema([
  ASTIdentifier.fromParts(['city']),
  ASTIdentifier.fromParts(['street']),
  ASTIdentifier.fromParts(['addresses', 'personId']),
]);

export const optimizedPlanCrossmodel = new plan.MapToItem(
  'xquery',
  ASTIdentifier.fromParts(['address']),
  new plan.Projection(
    'xquery',
    [
      toPair(ASTIdentifier.fromParts(['invoice', 'person'])),
      [
        new plan.Calculation('xquery', ret1, [
          new plan.MapToItem(
            'xquery',
            ASTIdentifier.fromParts(['ROW("city","street")']),
            new plan.Projection(
              'sql',
              [
                [
                  new plan.Calculation('sql', ret1, [
                    ASTIdentifier.fromParts(['city']),
                    ASTIdentifier.fromParts(['street']),
                  ]),
                  ASTIdentifier.fromParts(['ROW("city","street")']),
                ],
              ],
              new plan.Selection(
                'sql',
                new plan.Calculation('sql', ret1, [
                  ASTIdentifier.fromParts(['invoice', 'person']),
                  ASTIdentifier.fromParts(['addresses', 'personId']),
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
                          [ASTIdentifier.fromParts(['address'])],
                          ret1,
                          ASTIdentifier.fromParts(['unwind']),
                        ),
                      ),
                    ),
                  ),
                ]),
                addressTable,
              ),
            ),
          ),
        ]),
        ASTIdentifier.fromParts(['address']),
      ],
    ],
    new plan.MapFromItem(
      'xquery',
      ASTIdentifier.fromParts(['invoice', 'person']),
      new TreeJoin(
        'xquery',
        new plan.Calculation('xquery', ret1, [DOT]),
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
);
