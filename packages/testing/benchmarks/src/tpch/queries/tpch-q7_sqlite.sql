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
			strftime('%Y', l.shipdate) as year,
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
				(n1.name = 'ROMANIA' and n2.name = 'BRAZIL')
				or (n1.name = 'BRAZIL' and n2.name = 'ROMANIA')
			)
			and date(l.shipdate) between date('1995-01-01') and date('1996-12-31')
	) as shipping
group by
	shipping.supp_nation,
	shipping.cust_nation,
	shipping.year
order by
	shipping.supp_nation,
	shipping.cust_nation,
	shipping.year;
