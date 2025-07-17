-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
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
