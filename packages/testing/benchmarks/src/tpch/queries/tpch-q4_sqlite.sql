-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Order Priority Checking Query (Q4)
-- Functional Query Definition
-- Approved February 1998


select
	o.orderpriority,
	count(*) as order_count
from
	orders o
where
	date(o.orderdate) >= date('1994-05-01')
	and date(o.orderdate) < date('1994-05-01', '+3 months')
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
