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
    },
    {
      lang: 'javascript',
      name: 'defaultGraph',
      description:
        'Unibench data. Social network. Represented as Graphology graph.',
      img: 'social-network.svg',
    },
  ];
  languages: Record<string, Prism.Grammar> = {
    markup: Prism.languages['markup'],
    javascript: Prism.languages['javascript'],
  };

  unibenchS = inject(UnibenchService);

  constructor(sanitizer: DomSanitizer) {
    for (const src of this.sources) {
      if (!src.example) continue;
      src.exampleHighlighted = sanitizer.bypassSecurityTrustHtml(
        Prism.highlight(src.example, this.languages[src.lang], src.lang),
      );
    }
  }
}
