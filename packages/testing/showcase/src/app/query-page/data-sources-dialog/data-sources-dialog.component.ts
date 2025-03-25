import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import Prism from 'prismjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

interface Source {
  name: string;
  description: string;
  example: string;
  exampleHighlighted?: SafeHtml;
  lang: string;
}

@Component({
  selector: 'dort-data-sources-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatExpansionModule],
  templateUrl: './data-sources-dialog.component.html',
  styleUrl: './data-sources-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSourcesDialogComponent {
  sources: Source[] = [
    {
      lang: 'markup',
      name: 'Invoices',
      description:
        'Unibench data. Invoices represented as XML. Same data as orders, but in a different format.',
      example: `<Invoices>
  <Invoice>
      <OrderId>6711da51-dee6-452a-a7b8-f79a1cbb9436</OrderId>
      <PersonId>1</PersonId>
      <OrderDate>2022-09-01</OrderDate>
      <TotalPrice>723.88</TotalPrice>
      <Orderline>
          <productId>6465</productId>
          <asin>B000FIE4WC</asin>
          <title>Topeak Dual Touch Bike Storage Stand</title>
          <price>199.95</price>
          <brand>MYLAPS_Sports_Timing</brand>
      </Orderline>
      <Orderline>
          <productId>178</productId>
          <asin>B002Q6DB7A</asin>
          <title>Radians Eclipse RXT Photochromic Lens with Black Frame Glass</title>
          <price>61.99</price>
          <brand>Elfin_Sports_Cars</brand>
      </Orderline>
  </Invoice>
  <!-- more invoices -->
</Invoices>`,
    },
    {
      lang: 'javascript',
      name: 'customers',
      description: 'Unibench data. Customers represented as JS objects.',
      example: `[{
  "id": 1,
  "firstName": "John",
  "lastName": "Doe",
  "gender": "male",
  "birthday": new Date("1980-01-01"),
  "creationDate": new Date("2010-03-13T02:10:23.099+0000"),
  "locationIP": "41.138.53.138",
  "browserUsed": "Firefox",
  "place": 1263
}, /* ... */]`,
    },
    {
      lang: 'javascript',
      name: 'feedback',
      description: 'Unibench data. Feedback represented as JS objects.',
      example: `[{
  "personId": 1,
  "productId": 1,
  "feedback": "5.0,This feels just like a dart board you would use in a bar, minus the 1,000 holes that other drunk people put into it. Took me about 10 minutes to install. It is very heavy, so make sure you have some good studs in the wall to support it. I would suggest buying some extra darts for it, as the ones it comes with are cheaply made...had one break on me during my first game.***NOTE*** The installation was very easy, just don\\t listen to the instructions. It tells you to slide the paper inside to mark everything. Just put the paper on the back of the board and poke the holes, saves a lot of frustration and gives you the most accurate markings."
}, /* ... */]`,
    },
    {
      lang: 'javascript',
      name: 'orders',
      description:
        'Unibench data. Orders represented as JS objects. Same data as invoices, but in a different format.',
      example: `[{
  "OrderId":"016f6a4a-ec18-4885-b1c7-9bf2306c76d6",
  "PersonId":"10995116278711",
  "OrderDate":"2022-09-01",
  "TotalPrice":723.88,
  "Orderline": [
    {
      "productId":"6465",
      "asin":"B000FIE4WC",
      "title":"Topeak Dual Touch Bike Storage Stand",
      "price":199.95,
      "brand":"MYLAPS_Sports_Timing"
    },
    {
      "productId":"178",
      "asin":"B002Q6DB7A",
      "title":"Radians Eclipse RXT Photochromic Lens with Black Frame Glass",
      "price":61.99,
      "brand":"Elfin_Sports_Cars"
    }
  ]
}, /* ... */]`,
    },
    {
      lang: 'javascript',
      name: 'addresses',
      description: 'Addresses of customers. Represented as JS objects.',
      example: `[{
  "customerId": 1,
  "street": "Ke Karlovu",
  "city": "Prague",
  "zip": "12000",
}, /* ... */]`,
    },
    {
      lang: 'javascript',
      name: 'defaultGraph',
      description:
        'Relationships between customers. Represented as Graphology graph.',
      example: `const defaultGraph = new MultiDirectedGraph();
defaultGraph.addNode('1', { id: 1, name: 'Alice' });
defaultGraph.addNode('2', { id: 2, name: 'Bob' });
defaultGraph.addNode('3', { id: 3, name: 'Cynthia' });
defaultGraph.addNode('4', { id: 4, name: 'Daniel' });
defaultGraph.addEdge('2', '1', { type: 'hasFriend' });
defaultGraph.addEdge('2', '3', { type: 'hasFriend' });
defaultGraph.addEdge('2', '4', { type: 'hasFriend' });
// ...`,
    },
  ];
  languages: Record<string, Prism.Grammar> = {
    markup: Prism.languages['markup'],
    javascript: Prism.languages['javascript'],
  };

  constructor(sanitizer: DomSanitizer) {
    for (const src of this.sources) {
      src.exampleHighlighted = sanitizer.bypassSecurityTrustHtml(
        Prism.highlight(src.example, this.languages[src.lang], src.lang),
      );
    }
  }
}
