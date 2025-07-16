-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Potential Part Promotion Query (Q20)
-- Function Query Definition
-- Approved February 1998


select
	s.name,
	s.address
from
	supplier s,
	nation n
where
	s.suppkey in (
		select
			ps.suppkey
		from
			partsupp ps
		where
			ps.partkey in (
				select
					p.partkey
				from
					part p
				where
					p.name like 'mint%'
			)
			and ps.availqty > (
				select
					0.5 * sum(l.quantity)
				from
					lineitem l
				where
					l.partkey = ps.partkey
					and l.suppkey = ps.suppkey
					and l.shipdate >= '1994-01-01'::date
					and l.shipdate < date.add('1994-01-01'::date, interval('1 year'))
			)
	)
	and s.nationkey = n.nationkey
	and n.name = 'KENYA'
order by
	s.name;
