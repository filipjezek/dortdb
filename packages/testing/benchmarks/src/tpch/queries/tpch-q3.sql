-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Shipping Priority Query (Q3)
-- Functional Query Definition
-- Approved February 1998


select
	l.orderkey,
	sum(l.extendedprice * (1 - l.discount)) as revenue,
	o.orderdate,
	o.shippriority
from
	customer c,
	orders o,
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
