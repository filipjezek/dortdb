-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Shipping Modes and Order Priority Query (Q12)
-- Functional Query Definition
-- Approved February 1998


select
	l.shipmode,
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
	orders o,
	lineitem l
where
	o.orderkey = l.orderkey
	and l.shipmode in ('FOB', 'TRUCK')
	and l.commitdate < l.receiptdate
	and l.shipdate < l.commitdate
	and date(l.receiptdate) >= date('1997-01-01')
	and date(l.receiptdate) < date('1997-01-01', '+1 years')
group by
	l.shipmode
order by
	l.shipmode;
