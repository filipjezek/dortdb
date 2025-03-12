import { DortDB } from '@dortdb/core';
import { SQL } from '@dortdb/lang-sql';
import { Cypher } from '@dortdb/lang-cypher';
import { XQuery } from '@dortdb/lang-xquery';
import { MultiDirectedGraph } from 'graphology';

const addresses = [
  { customerId: 1, city: 'Istanbul', country: 'Turkey' },
  { customerId: 2, city: 'Ankara', country: 'Turkey' },
  { customerId: 3, city: 'Prague', country: 'Czech Republic' },
  { customerId: 4, city: 'Ankara', country: 'Turkey' },
];
const invoices = new DOMParser().parseFromString(
  `<Invoices>
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
  </Invoices>  
`,
  'text/xml',
);
const friends = new MultiDirectedGraph();
friends.addNode('Alice', { id: 1 });
friends.addNode('Bob', { id: 2 });
friends.addNode('Cynthia', { id: 3 });
friends.addNode('Daniel', { id: 4 });
friends.addEdge('Bob', 'Alice', { type: 'hasFriend' });
friends.addEdge('Bob', 'Cynthia', { type: 'hasFriend' });
friends.addEdge('Bob', 'Daniel', { type: 'hasFriend' });

const db = new DortDB({
  mainLang: SQL(),
  additionalLangs: [
    Cypher({
      defaultGraph: 'defaultGraph',
    }),
    XQuery(),
  ],
});

db.registerSource(['addresses'], addresses);
db.registerSource(['invoices'], invoices.firstChild);
db.registerSource(['friends'], friends);

const result = db.query('...');
