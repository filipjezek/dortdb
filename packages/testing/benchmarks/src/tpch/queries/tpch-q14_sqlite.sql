-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
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
	and date(l.shipdate) >= date('1997-07-01')
	and date(l.shipdate) < date('1997-07-01', '+1 months');
