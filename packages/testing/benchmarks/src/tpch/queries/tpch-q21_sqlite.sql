-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Suppliers Who Kept Orders Waiting Query (Q21)
-- Functional Query Definition
-- Approved February 1998


select
	s.name,
	count(*) as numwait
from
	supplier s,
	lineitem l1,
	orders o,
	nation n
where
	s.suppkey = l1.suppkey
	and o.orderkey = l1.orderkey
	and o.orderstatus = 'F'
	and l1.receiptdate > l1.commitdate
	and exists (
		select
			1
		from
			lineitem l2
		where
			l2.orderkey = l1.orderkey
			and l2.suppkey <> l1.suppkey
	)
	and not exists (
		select
			1
		from
			lineitem l3
		where
			l3.orderkey = l1.orderkey
			and l3.suppkey <> l1.suppkey
			and l3.receiptdate > l3.commitdate
	)
	and s.nationkey = n.nationkey
	and n.name = 'INDONESIA'
group by
	s.name
order by
	numwait desc,
	s.name
limit 100;
