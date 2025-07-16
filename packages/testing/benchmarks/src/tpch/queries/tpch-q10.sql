-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Returned Item Reporting Query (Q10)
-- Functional Query Definition
-- Approved February 1998


select
	c.custkey,
	c.name,
	sum(l.extendedprice * (1 - l.discount)) as revenue,
	c.acctbal,
	n.name,
	c.address,
	c.phone,
	c.comment
from
	customer c,
	orders o,
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
