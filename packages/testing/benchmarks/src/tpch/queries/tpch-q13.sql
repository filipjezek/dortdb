-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Customer Distribution Query (Q13)
-- Functional Query Definition
-- Approved February 1998


select
	orders.cnt,
	count(*) as custdist
from
	(
		select
			c.custkey,
			count(o.orderkey) as cnt
		from
			customer c left outer join orders o on
				c.custkey = o.custkey
				and o.comment not like '%unusual%deposits%'
		group by
			c.custkey
	) as orders
group by
	orders.cnt
order by
	custdist desc,
	orders.cnt desc;
