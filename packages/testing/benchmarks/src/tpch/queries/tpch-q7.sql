-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Volume Shipping Query (Q7)
-- Functional Query Definition
-- Approved February 1998


select
	shipping.supp_nation,
	shipping.cust_nation,
	shipping.year,
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
			orders o,
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
				(n1.n.name = 'ROMANIA' and n2.n.name = 'BRAZIL')
				or (n1.n.name = 'BRAZIL' and n2.n.name = 'ROMANIA')
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
