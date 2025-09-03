import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import Prism from 'prismjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { UnibenchService } from '../../services/unibench.service';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

interface Source {
  name: string;
  description: string;
  example?: string;
  exampleHighlighted?: SafeHtml;
  img?: string;
  lang: string;
  indices?: string[];
  indicesHighlighted?: SafeHtml[];
}

@Component({
  selector: 'dort-data-sources-dialog',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatExpansionModule,
    MatProgressSpinner,
  ],
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
  <Invoice.xml>
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
  </Invoice.xml>
  <!-- more invoices -->
</Invoices>`,
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
      indices: [`db.createIndex(['orders'], ['PersonId::number'], MapIndex);`],
    },
    {
      lang: 'javascript',
      name: 'customers',
      description: 'Unibench data. Customers represented as JS objects.',
      example: `[{
  "id": 4145,
  "firstName": "Albade",
  "lastName": "Maazou",
  "gender": "female",
  "birthday": "1981-03-21T00:00:00.000Z",
  "creationDate": "2010-03-13T02:10:23.099Z",
  "locationIP": "41.138.53.138",
  "browserUsed": "Internet Explorer",
  "place": 1263
}, /* ... */]`,
      indices: [`db.createIndex(['customers'], ['id'], MapIndex);`],
    },
    {
      lang: 'javascript',
      name: 'feedback',
      description: 'Unibench data. Feedback represented as JS objects.',
      example: `[{
  "productAsin": "B005FUKW6M",
  "personId": 26388279075595,
  "feedback": "'5.0,This feels just like a dart board you would use in a bar, minus the 1,000 holes that other drunk people put into it. Took me about 10 minutes to install. It is very heavy, so make sure you have some good studs in the wall to support it. I would suggest buying some extra darts for it, as the ones it comes with are cheaply made...had one break on me during my first game.***NOTE*** The installation was very easy, just don\\\\t listen to the instructions. It tells you to slide the paper inside to mark everything. Just put the paper on the back of the board and poke the holes, saves a lot of frustration and gives you the most accurate markings.'"
}, /* ... */]`,
      indices: [`db.createIndex(['feedback'], ['productAsin'], MapIndex);`],
    },
    {
      lang: 'javascript',
      name: 'products',
      description: 'Unibench data. E-shop products represented as JS objects.',
      example: `[{
  "asin": "B0001XH6G2",
  "title": "Canon 12x36 Image Stabilization II Binoculars w/Case, Neck Strap &amp; Batteries",
  "price": 670.1,
  "imgUrl": "http://ecx.images-amazon.com/images/I/413ZMJSMGVL._SX300_.jpg",
  "productId": 2566,
  "brand": 18
}, /* ... */]`,
      indices: [
        `db.createIndex(['products'], ['productId'], MapIndex);`,
        `db.createIndex(['products'], ['brand'], MapIndex);`,
        `db.createIndex(['products'], ['asin'], MapIndex);`,
      ],
    },
    {
      lang: 'javascript',
      name: 'brandProducts',
      description:
        'Unibench data. A relation linking vendors and products. Represented as JS objects.',
      example: `[{
  "brandName": "Signia_(sportswear)",
  "productAsin": "B002OP5TUA"
}, /* ... */]`,
      indices: [
        `db.createIndex(['brandProducts'], ['brandName'], MapIndex);`,
        `db.createIndex(['brandProducts'], ['productAsin'], MapIndex);`,
      ],
    },
    {
      lang: 'javascript',
      name: 'vendors',
      description: 'Unibench data. E-shop vendors represented as JS objects.',
      example: `[{
  "id": "Signia_(sportswear)",
  "Country": "Argentina",
  "Industry": "Sports"
}, /* ... */]`,
      indices: [`db.createIndex(['vendors'], ['id'], MapIndex);`],
    },
    {
      lang: 'javascript',
      name: 'posts',
      description:
        'Unibench data. Social network posts represented as JS objects.',
      example: `[{
  "id": 549755814351,
  "imageFile": "",
  "creationDate": "2010-11-24T04:47:12.247Z",
  "locationIP": "78.143.191.96",
  "browserUsed": "Internet Explorer",
  "language": "uz",
  "content": "About Armasight Spark CORE Multi-Purpose Night Vision Monocular, in tour singles titles, butAbout Schwinn 425 Elliptical Trainer (2013), d musician who has sold ",
  "length": "161"
}, /* ... */]`,
      indices: [`db.createIndex(['posts'], ['id'], MapIndex);`],
    },
    {
      lang: 'javascript',
      name: 'defaultGraph',
      description:
        'Unibench data. Social network. Represented as Graphology graph.',
      img: 'social-network.svg',
      indices: [
        `db.createIndex(['defaultGraph', 'nodes'], [], ConnectionIndex);`,
        `db.createIndex(['defaultGraph', 'edges'], [], ConnectionIndex);`,
        `db.createIndex(['defaultGraph', 'nodes'], ['x.id'], MapIndex, {
  fromItemKey: ['x'],
  mainLang: 'cypher',
});`,
      ],
    },
  ];
  unibench: string[] = [
    'For a given CUSTOMER, find their profile, orders, feedback, and posts.',
    'For a given PRODUCT, find the persons who had bought it and posted on it.',
    'For a given PRODUCT, find persons who have commented and posted on it, and detect negative sentiments from them.',
    'Find the top-2 persons who spend the highest amount of money in orders. Then for each person, traverse their knows-graph with 3-hop to find the friends, and finally return the common friends of these two persons.',
    'The query description given in the original paper is completely different from example implementations for ArangoDB, OrientDB, and AgensGraph that are part of the UniBench repository. The actual queries can be described as ”what did the friends of CUSTOMER who bought BRAND products post about?”',
    'Given CUSTOMER 1 and CUSTOMER 2, find persons in the shortest path between them in the subgraph, and return the TOP 3 best sellers from all these persons’ purchases.',
    'For the products of a given VENDOR with declining sales, analyze the reviews for these items to see if there are any negative sentiments.',
    'For all the products of a given CATEGORY during a given year, compute its total sales amount, and measure its popularity in the social media.',
    'Find top-3 companies who have the largest amount of sales at one COUNTRY, for each company, compare the number of the male and female customers, and return the most recent posts of them.',
    'Find the top-10 most active persons by aggregating the posts during the last year, then calculate their RFM (Recency, Frequency, Monetary) value in the same period, and return their recent reviews and tags of interest.',
  ];
  languages: Record<string, Prism.Grammar> = {
    markup: Prism.languages['markup'],
    javascript: Prism.languages['javascript'],
  };

  unibenchS = inject(UnibenchService);

  constructor(sanitizer: DomSanitizer) {
    for (const src of this.sources) {
      if (src.example) {
        src.exampleHighlighted = sanitizer.bypassSecurityTrustHtml(
          Prism.highlight(src.example, this.languages[src.lang], src.lang),
        );
      }
      if (src.indices) {
        src.indicesHighlighted = src.indices.map((code) =>
          sanitizer.bypassSecurityTrustHtml(
            Prism.highlight(code, this.languages['javascript'], 'javascript'),
          ),
        );
      }
    }
  }
}
