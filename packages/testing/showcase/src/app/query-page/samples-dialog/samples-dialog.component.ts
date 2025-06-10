import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { unibenchQueries } from './unibench-queries';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, map } from 'rxjs/operators';
import fuzzysort from 'fuzzysort';
import { toSignal } from '@angular/core/rxjs-interop';

export interface Sample {
  name: string;
  tags: string[];
  query: string;
  lang: 'sql' | 'cypher' | 'xquery';
}

@Component({
  selector: 'dort-samples-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatListModule,
    MatFormFieldModule,
    MatInput,
    ReactiveFormsModule,
  ],
  templateUrl: './samples-dialog.component.html',
  styleUrl: './samples-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SamplesDialogComponent {
  queries: Sample[] = [
    {
      lang: 'sql',
      name: 'Demopaper query',
      tags: ['demopaper'],
      query: `SELECT products.value, count(*) AS productCount
FROM addresses
JOIN (
    LANG cypher
    MATCH ({id: $myId})-[:hasFriend]->(friend)
    RETURN friend.id AS id
) friends ON friends.id = addresses.customerId
JOIN LATERAL (
    LANG xquery
    $invoices/Invoice[PersonId=$friends:id]/Orderline[0]/title
) products
WHERE addresses.city = 'Prague'
GROUP BY products.value
HAVING productCount > 2`,
    },
    ...unibenchQueries.map<Sample>(({ query, lang }, i) => ({
      lang,
      name: `Query ${i + 1}`,
      tags: ['unibench'],
      query,
    })),
    {
      lang: 'sql',
      name: 'Schema inference',
      tags: [],
      query: `-- infers schema of the foo table through multiple nested languages

select foo.frst, (
  lang xquery
  for $x in $xs
  return $foo:second + (lang sql select foo.third from bar)
) as nested
from foo`,
    },
    {
      lang: 'xquery',
      name: 'Cross model optimization',
      tags: [],
      query: `(: See how the optimizer pushes down an xquery selection into the sql subquery :)

for $invoice:person in $invoices//PersonId
let $address := (
  LANG SQL
  SELECT ROW(city, street) FROM addresses
  WHERE invoice.person = addresses.personId
)
where $address/@city = 'Prague'
return $address`,
    },
    {
      lang: 'xquery',
      name: 'Example from the "A Complete and Efficient Algebraic Compiler for XQuery" paper',
      tags: [],
      query: `for $p in $auction//person
let $a :=
  for $t in $auction//closed_auction
  where $t/buyer/@person = $p/@id
  return $t
return <item person="{ $p/name }">
  { fn:count($a) }
</item>`,
    },
    {
      lang: 'sql',
      name: 'Optimization example',
      tags: [],
      query: `select x + 1 as xx from foo
where x + (select count(y) from bar) > (select cat from dog)`,
    },
    {
      lang: 'sql',
      name: 'Indices example',
      tags: [],
      query: `select t1.foo, t2.bar from t1 join t2 on t1.id = t2.id and t1.foo = t2.a
-- select t1.foo, t2.bar from t1 join t2 on t1.id = t2.a + t2.b / 2 and t1.foo = t2.a`,
    },
    {
      lang: 'xquery',
      name: 'Complex XQuery example',
      tags: [],
      query: `for $p in (LANG SQL SELECT id, firstName AS name FROM customers)
let $invoices :=
  for $i in $Invoices//Invoice.xml
  where $i/PersonId = $p/@id
  return $i
return <item person="{ $p/@name }">
  { fn:count($i) }
</item>`,
    },
  ];
  private preparedQueries = this.queries.map((query) => ({
    original: query,
    name: fuzzysort.prepare(query.name),
    tags: fuzzysort.prepare(query.tags.join(' ')),
    query: fuzzysort.prepare(query.query),
  }));

  searchControl = new FormControl<string>('');
  filteredQueries = toSignal(
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      map((search) => {
        if (!search) {
          return this.queries;
        }
        return fuzzysort
          .go(search, this.preparedQueries, {
            keys: ['name', 'tags', 'query'],
            threshold: 0.3,
          })
          .map((res) => res.obj.original);
      }),
    ),
    { initialValue: this.queries },
  );
}
