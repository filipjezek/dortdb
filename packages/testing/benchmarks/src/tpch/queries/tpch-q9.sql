-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Product Type Profit Measure Query (Q9)
-- Functional Query Definition
-- Approved February 1998


select
	profit.nation,
	profit.year,
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
			orders o,
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
