-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R National Market Share Query (Q8)
-- Functional Query Definition
-- Approved February 1998


select
	all_nations.year,
	sum(case
		when all_nations.nation = 'BRAZIL' then all_nations.volume
		else 0
	end) / sum(all_nations.volume) as mkt_share
from
	(
		select
			date.extract(o.orderdate, 'year') as year,
			l.extendedprice * (1 - l.discount) as volume,
			n2.name as nation
		from
			part,
			supplier,
			lineitem,
			orders,
			customer,
			nation n1,
			nation n2,
			region
		where
			p.partkey = l.partkey
			and s.suppkey = l.suppkey
			and l.orderkey = o.orderkey
			and o.custkey = c.custkey
			and c.nationkey = n1.nationkey
			and n1.regionkey = r.regionkey
			and r.name = 'AMERICA'
			and s.nationkey = n2.nationkey
			and o.orderdate between '1995-01-01'::date and '1996-12-31'::date
			and p.type = 'LARGE POLISHED NICKEL'
	) as all_nations
group by
	all_nations.year
order by
	all_nations.year;
