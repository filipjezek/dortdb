export const tpchQueries: string[] = [
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Pricing Summary Report Query (Q1)
-- Functional Query Definition
-- Approved February 1998


select
	l.returnflag as returnflag,
	l.linestatus as linestatus,
	sum(l.quantity) as sum_qty,
	sum(l.extendedprice) as sum_base_price,
	sum(l.extendedprice * (1 - l.discount)) as sum_disc_price,
	sum(l.extendedprice * (1 - l.discount) * (1 + l.tax)) as sum_charge,
	avg(l.quantity) as avg_qty,
	avg(l.extendedprice) as avg_price,
	avg(l.discount) as avg_disc,
	count(*) as count_order
from
	lineitem l
where
	l.shipdate <= date.sub('1998-12-01'::date, interval('70 days'))
group by
	l.returnflag,
	l.linestatus
order by
	l.returnflag,
	l.linestatus;`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Minimum Cost Supplier Query (Q2)
-- Functional Query Definition
-- Approved February 1998


select
	s.acctbal as acctbal,
	s.name as \`s.name\`,
	n.name as \`n.name\`,
	p.partkey as partkey,
	p.mfgr as mfgr,
	s.address as address,
	s.phone as phone,
	s.comment as comment
from
	part p,
	supplier s,
	partsupp ps,
	nation n,
	region r
where
	p.partkey = ps.partkey
	and s.suppkey = ps.suppkey
	and p.size = 31
	and p.type like '%NICKEL'
	and s.nationkey = n.nationkey
	and n.regionkey = r.regionkey
	and r.name = 'AMERICA'
	and ps.supplycost = (
		select
			min(ps.supplycost)
		from
			partsupp ps,
			supplier s,
			nation n,
			region r
		where
			p.partkey = ps.partkey
			and s.suppkey = ps.suppkey
			and s.nationkey = n.nationkey
			and n.regionkey = r.regionkey
			and r.name = 'AMERICA'
	)
order by
	s.acctbal desc,
	n.name,
	s.name,
	p.partkey
limit 100;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Shipping Priority Query (Q3)
-- Functional Query Definition
-- Approved February 1998


select
	l.orderkey as orderkey,
	sum(l.extendedprice * (1 - l.discount)) as revenue,
	o.orderdate as orderdate,
	o.shippriority as shippriority
from
	customer c,
	tpch.orders o,
	lineitem l
where
	c.mktsegment = 'HOUSEHOLD'
	and c.custkey = o.custkey
	and l.orderkey = o.orderkey
	and o.orderdate < '1995-03-09'::date
	and l.shipdate > '1995-03-09'::date
group by
	l.orderkey,
	o.orderdate,
	o.shippriority
order by
	revenue desc,
	o.orderdate
limit 10;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Order Priority Checking Query (Q4)
-- Functional Query Definition
-- Approved February 1998


select
	o.orderpriority as orderpriority,
	count(*) as order_count
from
	tpch.orders o
where
	o.orderdate >= '1994-05-01'::date
	and o.orderdate < date.add('1994-05-01'::date, interval('3 months'))
	and exists (
		select
			1
		from
			lineitem l
		where
			l.orderkey = o.orderkey
			and l.commitdate < l.receiptdate
	)
group by
	o.orderpriority
order by
	o.orderpriority;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Local Supplier Volume Query (Q5)
-- Functional Query Definition
-- Approved February 1998


select
	n.name as name,
	sum(l.extendedprice * (1 - l.discount)) as revenue
from
	customer c,
	tpch.orders o,
	lineitem l,
	supplier s,
	nation n,
	region r
where
	c.custkey = o.custkey
	and l.orderkey = o.orderkey
	and l.suppkey = s.suppkey
	and c.nationkey = s.nationkey
	and s.nationkey = n.nationkey
	and n.regionkey = r.regionkey
	and r.name = 'ASIA'
	and o.orderdate >= '1997-01-01'::date
	and o.orderdate < date.add('1997-01-01'::date, interval('1 year'))
group by
	n.name
order by
	revenue desc;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Forecasting Revenue Change Query (Q6)
-- Functional Query Definition
-- Approved February 1998


select
	sum(l.extendedprice * l.discount) as revenue
from
	lineitem l
where
	l.shipdate >= '1997-01-01'::date
	and l.shipdate < date.add('1997-01-01'::date, interval('1 year'))
	and l.discount between 0.08 - 0.01 and 0.08 + 0.01
	and l.quantity < 24;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Volume Shipping Query (Q7)
-- Functional Query Definition
-- Approved February 1998


select
	shipping.supp_nation as supp_nation,
	shipping.cust_nation as cust_nation,
	shipping.year as year,
	sum(shipping.volume) as revenue
from
	(
		select
			n1.name as supp_nation,
			n2.name as cust_nation,
			date.extract(l.shipdate, 'year') as year,
			l.extendedprice * (1 - l.discount) as volume
		from
			supplier s,
			lineitem l,
			tpch.orders o,
			customer c,
			nation n1,
			nation n2
		where
			s.suppkey = l.suppkey
			and o.orderkey = l.orderkey
			and c.custkey = o.custkey
			and s.nationkey = n1.nationkey
			and c.nationkey = n2.nationkey
			and (
				(n1.name = 'ROMANIA' and n2.name = 'BRAZIL')
				or (n1.name = 'BRAZIL' and n2.name = 'ROMANIA')
			)
			and l.shipdate between '1995-01-01'::date and '1996-12-31'::date
	) as shipping
group by
	shipping.supp_nation,
	shipping.cust_nation,
	shipping.year
order by
	shipping.supp_nation,
	shipping.cust_nation,
	shipping.year;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R National Market Share Query (Q8)
-- Functional Query Definition
-- Approved February 1998


select
	all_nations.year as year,
	sum(case
		when all_nations.nation = 'BRAZIL' then all_nations.volume
		else 0
	end) / sum(all_nations.volume) as mkt_share
from
	(
		select
			date.extract(o.orderdate, 'year') as year,
			l.extendedprice * (1 - l.discount) as volume,
			n2.name as nation
		from
			part p,
			supplier s,
			lineitem l,
			tpch.orders o,
			customer c,
			nation n1,
			nation n2,
			region r
		where
			p.partkey = l.partkey
			and s.suppkey = l.suppkey
			and l.orderkey = o.orderkey
			and o.custkey = c.custkey
			and c.nationkey = n1.nationkey
			and n1.regionkey = r.regionkey
			and r.name = 'AMERICA'
			and s.nationkey = n2.nationkey
			and o.orderdate between '1995-01-01'::date and '1996-12-31'::date
			and p.type = 'LARGE POLISHED NICKEL'
	) as all_nations
group by
	all_nations.year
order by
	all_nations.year;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Product Type Profit Measure Query (Q9)
-- Functional Query Definition
-- Approved February 1998


select
	profit.nation as nation,
	profit.year as year,
	sum(profit.amount) as sum_profit
from
	(
		select
			n.name as nation,
			date.extract(o.orderdate, 'year') as year,
			l.extendedprice * (1 - l.discount) - ps.supplycost * l.quantity as amount
		from
			part p,
			supplier s,
			lineitem l,
			partsupp ps,
			tpch.orders o,
			nation n
		where
			s.suppkey = l.suppkey
			and ps.suppkey = l.suppkey
			and ps.partkey = l.partkey
			and p.partkey = l.partkey
			and o.orderkey = l.orderkey
			and s.nationkey = n.nationkey
			and p.name like '%navy%'
	) as profit
group by
	profit.nation,
	profit.year
order by
	profit.nation,
	profit.year desc;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Returned Item Reporting Query (Q10)
-- Functional Query Definition
-- Approved February 1998


select
	c.custkey as custkey,
	c.name as name,
	sum(l.extendedprice * (1 - l.discount)) as revenue,
	c.acctbal as acctbal,
	n.name as name,
	c.address as address,
	c.phone as phone,
	c.comment as comment
from
	customer c,
	tpch.orders o,
	lineitem l,
	nation n
where
	c.custkey = o.custkey
	and l.orderkey = o.orderkey
	and o.orderdate >= '1994-11-01'::date
	and o.orderdate < date.add('1994-11-01'::date, interval('3 month'))
	and l.returnflag = 'R'
	and c.nationkey = n.nationkey
group by
	c.custkey,
	c.name,
	c.acctbal,
	c.phone,
	n.name,
	c.address,
	c.comment
order by
	revenue desc
limit 20;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Important Stock Identification Query (Q11)
-- Functional Query Definition
-- Approved February 1998


select
	ps.partkey as partkey,
	sum(ps.supplycost * ps.availqty) as \`value\`
from
	partsupp ps,
	supplier s,
	nation n
where
	ps.suppkey = s.suppkey
	and s.nationkey = n.nationkey
	and n.name = 'UNITED KINGDOM'
group by
	ps.partkey having
		sum(ps.supplycost * ps.availqty) > (
			select
				sum(ps.supplycost * ps.availqty) * 0.0010000000
			from
				partsupp ps,
				supplier s,
				nation n
			where
				ps.suppkey = s.suppkey
				and s.nationkey = n.nationkey
				and n.name = 'UNITED KINGDOM'
		)
order by
	\`value\` desc;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Shipping Modes and Order Priority Query (Q12)
-- Functional Query Definition
-- Approved February 1998


select
	l.shipmode as shipmode,
	sum(case
		when o.orderpriority = '1-URGENT'
			or o.orderpriority = '2-HIGH'
			then 1
		else 0
	end) as high_line_count,
	sum(case
		when o.orderpriority <> '1-URGENT'
			and o.orderpriority <> '2-HIGH'
			then 1
		else 0
	end) as low_line_count
from
	tpch.orders o,
	lineitem l
where
	o.orderkey = l.orderkey
	and l.shipmode in ('FOB', 'TRUCK')
	and l.commitdate < l.receiptdate
	and l.shipdate < l.commitdate
	and l.receiptdate >= '1997-01-01'::date
	and l.receiptdate < date.add('1997-01-01'::date, interval('1 year'))
group by
	l.shipmode
order by
	l.shipmode;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Customer Distribution Query (Q13)
-- Functional Query Definition
-- Approved February 1998


select
	tpch.orders.\`count\` as \`count\`,
	count(*) as custdist
from
	(
		select
			c.custkey,
			count(o.orderkey) as \`count\`
		from
			customer c left outer join tpch.orders o on
				c.custkey = o.custkey
				and o.comment not like '%unusual%deposits%'
		group by
			c.custkey
	) as tpch.orders
group by
	tpch.orders.\`count\`
order by
	custdist desc,
	tpch.orders.\`count\` desc;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Promotion Effect Query (Q14)
-- Functional Query Definition
-- Approved February 1998


select
	100.00 * sum(case
		when p.type like 'PROMO%'
			then l.extendedprice * (1 - l.discount)
		else 0
	end) / sum(l.extendedprice * (1 - l.discount)) as promo_revenue
from
	lineitem l,
	part p
where
	l.partkey = p.partkey
	and l.shipdate >= '1997-07-01'::date
	and l.shipdate < date.add('1997-07-01'::date, interval('1 month'));
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Top Supplier Query (Q15)
-- Functional Query Definition
-- Approved February 1998

with revenue0 (supplier_no, total_revenue) as materialized (
  select
    l.suppkey,
    sum(l.extendedprice * (1 - l.discount))
  from
    lineitem l
  where
    l.shipdate >= '1993-07-01'::date
    and l.shipdate < date.add('1993-07-01'::date, interval('3 month'))
  group by
    l.suppkey
)
select
  s.suppkey as suppkey,
  s.name as name,
  s.address as address,
  s.phone as phone,
  r.total_revenue as total_revenue
from
  supplier s,
  revenue0 r
where
  s.suppkey = r.supplier_no
  and r.total_revenue = (
    select
      max(total_revenue)
    from
      revenue0
  )
order by
  s.suppkey;`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Parts/Supplier Relationship Query (Q16)
-- Functional Query Definition
-- Approved February 1998


select
	p.brand as brand,
	p.type as type,
	p.size as size,
	count(distinct ps.suppkey) as supplier_cnt
from
	partsupp ps,
	part p
where
	p.partkey = ps.partkey
	and p.brand <> 'Brand#42'
	and p.type not like 'MEDIUM ANODIZED%'
	and p.size in (15, 30, 20, 2, 3, 36, 37, 38)
	and ps.suppkey not in (
		select
			s.suppkey
		from
			supplier s
		where
			s.comment like '%Customer%Complaints%'
	)
group by
	p.brand,
	p.type,
	p.size
order by
	supplier_cnt desc,
	p.brand,
	p.type,
	p.size;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Small-Quantity-Order Revenue Query (Q17)
-- Functional Query Definition
-- Approved February 1998


select
	sum(l.extendedprice) / 7.0 as avg_yearly
from
	lineitem l,
	part p
where
	p.partkey = l.partkey
	and p.brand = 'Brand#22'
	and p.container = 'LG JAR'
	and l.quantity < (
		select
			0.2 * avg(l.quantity)
		from
			lineitem l
		where
			l.partkey = p.partkey
	);
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Large Volume Customer Query (Q18)
-- Function Query Definition
-- Approved February 1998

-- TODO: selection pushdown through groupby keys


select
	c.name as name,
	c.custkey as custkey,
	o.orderkey as orderkey,
	o.orderdate as orderdate,
	o.totalprice as totalprice,
	sum(l.quantity) as sum_qty
from
	customer c,
	tpch.orders o,
	lineitem l
where
	o.orderkey in (
		select
			l.orderkey
		from
			lineitem l
		group by
			l.orderkey having
				sum(l.quantity) > 300 -- originally 313, but that had no results
	)
	and c.custkey = o.custkey
	and o.orderkey = l.orderkey
group by
	c.name,
	c.custkey,
	o.orderkey,
	o.orderdate,
	o.totalprice
order by
	o.totalprice desc,
	o.orderdate
limit 100;`,
  `-- CAREFUL! This query will likely not finish in a reasonable time

-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Discounted Revenue Query (Q19)
-- Functional Query Definition
-- Approved February 1998


select
	sum(l.extendedprice* (1 - l.discount)) as revenue
from
	lineitem l,
	part p
where
	(
		p.partkey = l.partkey
		and p.brand = 'Brand#23'
		and p.container in ('SM CASE', 'SM BOX', 'SM PACK', 'SM PKG')
		and l.quantity >= 8 and l.quantity <= 8 + 10
		and p.size between 1 and 5
		and l.shipmode in ('AIR', 'AIR REG')
		and l.shipinstruct = 'DELIVER IN PERSON'
	)
	or
	(
		p.partkey = l.partkey
		and p.brand = 'Brand#23'
		and p.container in ('MED BAG', 'MED BOX', 'MED PKG', 'MED PACK')
		and l.quantity >= 17 and l.quantity <= 17 + 10
		and p.size between 1 and 10
		and l.shipmode in ('AIR', 'AIR REG')
		and l.shipinstruct = 'DELIVER IN PERSON'
	)
	or
	(
		p.partkey = l.partkey
		and p.brand = 'Brand#24'
		and p.container in ('LG CASE', 'LG BOX', 'LG PACK', 'LG PKG')
		and l.quantity >= 24 and l.quantity <= 24 + 10
		and p.size between 1 and 15
		and l.shipmode in ('AIR', 'AIR REG')
		and l.shipinstruct = 'DELIVER IN PERSON'
	);
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Potential Part Promotion Query (Q20)
-- Function Query Definition
-- Approved February 1998


select
	s.name as name,
	s.address as address
from
	supplier s,
	nation n
where
	s.suppkey in (
		select
			ps.suppkey
		from
			partsupp ps
		where
			ps.partkey in (
				select
					p.partkey
				from
					part p
				where
					p.name like 'mint%'
			)
			and ps.availqty > (
				select
					0.5 * sum(l.quantity)
				from
					lineitem l
				where
					l.partkey = ps.partkey
					and l.suppkey = ps.suppkey
					and l.shipdate >= '1994-01-01'::date
					and l.shipdate < date.add('1994-01-01'::date, interval('1 year'))
			)
	)
	and s.nationkey = n.nationkey
	and n.name = 'KENYA'
order by
	s.name;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Suppliers Who Kept tpch.orders Waiting Query (Q21)
-- Functional Query Definition
-- Approved February 1998


select
	s.name as name,
	count(*) as numwait
from
	supplier s,
	lineitem l1,
	tpch.orders o,
	nation n
where
	s.suppkey = l1.suppkey
	and o.orderkey = l1.orderkey
	and o.tpch.orderstatus = 'F'
	and l1.receiptdate > l1.commitdate
	and exists (
		select
			1
		from
			lineitem l2
		where
			l2.orderkey = l1.orderkey
			and l2.suppkey <> l1.suppkey
	)
	and not exists (
		select
			1
		from
			lineitem l3
		where
			l3.orderkey = l1.orderkey
			and l3.suppkey <> l1.suppkey
			and l3.receiptdate > l3.commitdate
	)
	and s.nationkey = n.nationkey
	and n.name = 'INDONESIA'
group by
	s.name
order by
	numwait desc,
	s.name
limit 100;
`,
  `-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Global Sales Opportunity Query (Q22)
-- Functional Query Definition
-- Approved February 1998


select
	custsale.cntrycode as cntrycode,
	count(*) as numcust,
	sum(custsale.acctbal) as totacctbal
from
	(
		select
			substr(c.phone, 1, 2) as cntrycode,
			c.acctbal
		from
			customer c
		where
			substr(c.phone, 1, 2) in
				('24', '18', '27', '28', '29', '10', '17')
			and c.acctbal > (
				select
					avg(c.acctbal)
				from
					customer c
				where
					c.acctbal > 0.00
					and substr(c.phone, 1, 2) in
						('24', '18', '27', '28', '29', '10', '17')
			)
			and not exists (
				select
					1
				from
					tpch.orders o
				where
					o.custkey = c.custkey
			)
	) as custsale
group by
	custsale.cntrycode
order by
	custsale.cntrycode;
`,
];
