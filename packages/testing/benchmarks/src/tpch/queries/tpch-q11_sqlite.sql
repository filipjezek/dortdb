-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Important Stock Identification Query (Q11)
-- Functional Query Definition
-- Approved February 1998


select
	ps.partkey,
	sum(ps.supplycost * ps.availqty) as value
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
	value desc;
