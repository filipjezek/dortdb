head Customer/person_0_0.csv -n 100 > copy.csv
mv copy.csv Customer/person_0_0.csv

{
    echo '<Invoices><Invoice.xml>'
    customer_condition=$(awk -F'|' 'NR>1 {printf "PersonId='\''%s'\'' or ", $1}' Customer/person_0_0.csv | sed 's/ or $//')
    xmlstarlet sel -t -c "Invoices/Invoice.xml[$customer_condition]" Invoice/Invoice.xml
    echo '</Invoice.xml></Invoices>'
} > copy.xml
mv copy.xml Invoice/Invoice.xml

jq -c --slurpfile customers <(awk -F'|' 'NR>1 {print $1}' Customer/person_0_0.csv | jq -R . | jq -s .) '
select(.PersonId as $pid | $customers[0] | index($pid))
' Order/Order.json > copy.json
mv copy.json Order/Order.json

product_ids=$(jq -r '.Orderline[].asin' Order/Order.json | sort -u | paste -sd'|')
awk -F',' -v ids="$product_ids" '
BEGIN { split(ids, id_array, "|"); for(i in id_array) valid_ids[id_array[i]]=1 }
$1 in valid_ids || NR==1
' Product/Product.csv > copy.csv
mv copy.csv Product/Product.csv
awk -F',' -v ids="$product_ids" '
BEGIN { split(ids, id_array, "|"); for(i in id_array) valid_ids[id_array[i]]=1 }
$2 in valid_ids
' Product/BrandByProduct.csv > copy.csv
mv copy.csv Product/BrandByProduct.csv

customer_ids=$(awk -F'|' 'NR>1 {print $1}' Customer/person_0_0.csv | paste -sd'|')
awk -F'|' -v cust_ids="$customer_ids" -v prod_ids="$product_ids" '
BEGIN {
  split(cust_ids, cust_id_array, "|");
  for(i in cust_id_array) valid_cust_ids[cust_id_array[i]]=1;
  split(prod_ids, prod_id_array, "|");
  for(i in prod_id_array) valid_prod_ids[prod_id_array[i]]=1
}
$2 in valid_cust_ids && $1 in valid_prod_ids
' Feedback/Feedback.csv > copy.csv
mv copy.csv Feedback/Feedback.csv

# === SocialNetwork ===

# if we filter using $1 && $2, we get only about 10 rows
awk -F'|' -v ids="$customer_ids" '
BEGIN { split(ids, id_array, "|"); for(i in id_array) valid_ids[id_array[i]]=1 }
($1 in valid_ids || $2 in valid_ids) || NR==1
' SocialNetwork/person_knows_person_0_0.csv > copy.csv
mv copy.csv SocialNetwork/person_knows_person_0_0.csv

awk -F'|' -v ids="$customer_ids" '
BEGIN { RS="\r\n"; split(ids, id_array, "|"); for(i in id_array) valid_ids[id_array[i]]=1 }
($2 in valid_ids && rand() <= 0.025) || NR==1
' SocialNetwork/post_hasCreator_person_0_0.csv > copy.csv
mv copy.csv SocialNetwork/post_hasCreator_person_0_0.csv

post_ids=$(awk -F'|' 'NR>1 {print $1}' SocialNetwork/post_hasCreator_person_0_0.csv | paste -sd'|')
awk -F'|' -v ids="$post_ids" '
BEGIN { split(ids, id_array, "|"); for(i in id_array) valid_ids[id_array[i]]=1 }
$1 in valid_ids || NR==1
' SocialNetwork/post_0_0.csv > copy.csv
mv copy.csv SocialNetwork/post_0_0.csv

awk -F'|' -v ids="$post_ids" '
BEGIN { split(ids, id_array, "|"); for(i in id_array) valid_ids[id_array[i]]=1 }
$1 in valid_ids || NR==1
' SocialNetwork/post_hasTag_tag_0_0.csv > copy.csv
mv copy.csv SocialNetwork/post_hasTag_tag_0_0.csv

tag_ids=$(awk -F'|' 'BEGIN { RS="\r\n" } NR>1 {print $2}' SocialNetwork/post_hasTag_tag_0_0.csv | sort -u | paste -sd'|')
awk -F'|' -v cust_ids="$customer_ids" -v tag_ids="$tag_ids" '
BEGIN {
  split(cust_ids, cust_id_array, "|");
  for(i in cust_id_array) valid_cust_ids[cust_id_array[i]]=1;
  split(tag_ids, tag_id_array, "|");
  for(i in tag_id_array) valid_tag_ids[tag_id_array[i]]=1
}
($1 in valid_cust_ids && $2 in valid_tag_ids) || NR==1
' SocialNetwork/person_hasInterest_tag_0_0.csv > copy.csv
mv copy.csv SocialNetwork/person_hasInterest_tag_0_0.csv