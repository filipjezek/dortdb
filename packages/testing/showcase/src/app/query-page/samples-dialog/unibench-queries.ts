export const unibenchQueries: {
  query: string;
  lang: 'sql' | 'cypher' | 'xquery';
}[] = [
  {
    query: `-- all data about CUSTOMER
--
-- one such customer id is 4145

SELECT
  ROW(customers.id AS id, customers.firstName AS firstName, customers.lastName AS lastName) profile,
  ARRAY(SELECT ROW(orders.OrderId as orderId, orders.Orderline AS orderline, orders.TotalPrice AS totalPrice) FROM orders WHERE PersonId = customers.id) orders,
  ARRAY(SELECT ROW(feedback.productAsin AS asin, feedback.feedback AS feedback) FROM feedback WHERE personId = customers.id) feedback,
  ARRAY(
    LANG cypher
    MATCH ({id: customers.id})<-[:hasCreator]-(post)
    RETURN post
  ) posts
FROM customers
WHERE id = :customer`,
    lang: 'sql',
  },
  {
    query: `-- customers which bought PRODUCT and posted about it
--
-- one such product id is 52

SELECT id, firstName FROM customers
WHERE EXISTS (
  LANG cypher
  MATCH (:person {id: customers.id})<-[:hasCreator]-(post)-[:hasTag]->({id: $product})
  RETURN 1
) AND EXISTS (
  SELECT 1 FROM orders
  WHERE PersonId = customers.id AND EXISTS (
    SELECT 1 FROM unwind(orders.Orderline) orderline WHERE productId = :product
  )
)`,
    lang: 'sql',
  },
  {
    query: `-- customers which posted about PRODUCT and left negative feedback
--
-- the only such product in the dataset is 202

SELECT customers.id, feedback.feedback, products.productId
FROM customers
JOIN feedback ON customers.id = feedback.personId
JOIN products ON feedback.productAsin = products.asin
WHERE products.productId = :product AND (feedback.feedback[1])::number < 3
AND EXISTS (
  LANG cypher
  MATCH ({id: customers.id})<-[:hasCreator]-(post)-[:hasTag]->({id: products.productId})
  RETURN 1
)`,
    lang: 'sql',
  },
  {
    query: `// three-hop common friends of the two top spenders
//
// these two are actually not connected in the sample data

WITH [x IN (
  LANG sql
    SELECT PersonId::number
    FROM orders
    GROUP BY PersonId
    ORDER BY sum(TotalPrice) DESC
    LIMIT 2
) | x] AS toptwo
MATCH (:person {id: toptwo[0]})-[:knows *..3]->(foaf)<-[:knows *..3]-({id: toptwo[1]})
RETURN foaf`,
    lang: 'cypher',
  },
  {
    query: `-- what did the friends of CUSTOMER which bought BRAND products post about?

SELECT c.person, c.tag
FROM (
  LANG cypher
  MATCH ({id: $customer})-[:knows]->(person)-[:hasCreated]->()-[:hasTag]->(tag)
  WHERE EXISTS {
    LANG xquery
    $Invoices/Invoice.xml[PersonId=$person]/Orderline[brand=$brand]
  }
  RETURN person, tag
) c`,
    lang: 'sql',
  },
  {
    query: `-- find persons in the shortest path between CUSTOMERS and return their top 3 bestsellers

SELECT x.num as productId FROM (
  LANG xquery
  for $interPerson in (
    LANG cypher
    MATCH ps = allShortestPaths(({id: $cust1})-[]-({id: $cust2}))
    UNWIND ps AS p
    UNWIND p[1..-1] AS pathEl
    WITH DISTINCT pathEl WHERE pathEl:Person
    RETURN pathEl.id
  ), $productId in $Invoices/Invoice.xml[PersonId=$interPerson]//productId
  group by $num := number($productId)
  order by fn:count($productId) descending
  return $num
) x
LIMIT 3`,
    lang: 'sql',
  },
  {
    query: `-- find negative feedback on BRAND products with decreasing sales

SELECT feedback FROM feedback
JOIN products ON products.id = feedback.productId
WHERE brand = :brand AND feedback[1]::number < 4 AND (
  LANG xquery
  for $orderline in $Invoices//*[ 
    date(OrderDate) gt now() - interval('3 months')
  ]
    /Orderline[productId = $products:id]
  return sum($orderline)
) < (
  LANG xquery
  for $orderline in $Invoices//*[ 
    date(OrderDate) le now() - interval('3 months') and
    date(OrderDate) gt now() - interval('6 months')
  ]
    /Orderline[productId = $products:id]
  return sum($orderline)
)

-- join SQL * XML * XML`,
    lang: 'sql',
  },
  {
    query: `-- compute this year's total sales amount and social media popularity of
-- products in CATEGORY 

WITH totalPosts AS (
  LANG cypher
  UNWIND (
    LANG sql
    SELECT id FROM products WHERE category = :category
  ) AS productId
  MATCH (post)-[:hasTag]->({id: productId})
  WHERE post.creationDate > now() - interval('1 year')
  RETURN count(post) AS total
)
SELECT
  products.id,
  (
    LANG xquery
    for $product in $Invoices//*[ 
      date(OrderDate) gt now() - interval('1 year')
    ]
      /Orderline[productId = $products:id]
    return fn:count($product)
  ) amountSold,
  (
    LANG cypher
    MATCH (post)-[:hasTag]->({id: products.id})
    WHERE post.creationDate > now() - interval('1 year')
    RETURN count(post)
  ) / (SELECT total FROM totalPosts) relativePopulatity
FROM products
WHERE products.category = :category`,
    lang: 'sql',
  },
  {
    query: `-- compare top 3 vendors' male and female customer ratio and find latest posts about them

WITH topVendors AS (
  SELECT
    vendors.id,
    (
      LANG xquery
      for $sale in $Invoices//*[brand = $vendors:id]
      return fn:count($sale)
    ) sales
  FROM vendors
  ORDER BY sales DESC
  LIMIT 3
)
SELECT
  id,
  (
    SELECT
      count(*) FILTER (WHERE gender = 'male') / count(*) FILTER (WHERE gender = 'female')
    FROM customers
    WHERE EXISTS (
      SELECT 1 FROM orders WHERE personId = customers.id
      AND orderlines @> ARRAY[ROW(topVendors.id AS brand)]
    )
  ),
  ARRAY(
    LANG cypher
    MATCH (post)-[:hasTag]->({id: topVendors.id})
    RETURN post.content ORDER BY post.creationDate DESC LIMIT 10
  ) latestPosts
FROM topVendors`,
    lang: 'sql',
  },
  {
    query: `-- find this year's top posters and get their recency/frequency/monetary statistics,
-- their interests and their latest feedback

SELECT
  orders.personId,
  topPosters.interests,
  MAX(orders.orderDate) recency,
  COUNT(orders.personId) frequency,
  SUM(orders.totalPrice) monetary,
  ARRAY(
    SELECT feedback FROM feedback
    WHERE customerId = orders.personId
    LIMIT 10
  ) recentReviews
FROM orders JOIN (
  LANG cypher
  MATCH (cust)-[:hasCreated]->(post),
    (cust)-[:hasInterest]->(tag)
  WHERE post.creationDate > now() - interval('1 year')
  RETURN cust.id AS custId, collect(tag.id) AS interests
  ORDER BY count(post) DESC LIMIT 10
) topPosters
ON orders.personId = topPosters.custId
GROUP BY orders.personId, topPosters.interests`,
    lang: 'sql',
  },
];
