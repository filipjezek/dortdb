-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Pricing Summary Report Query (Q1)
-- Functional Query Definition
-- Approved February 1998


select
	l.returnflag,
	l.linestatus,
	sum(l.quantity) as sum_qty,
	sum(l.extendedprice) as sum_base_price,
	sum(l.extendedprice * (1 - l.discount)) as sum_disc_price,
	sum(l.extendedprice * (1 - l.discount) * (1 + l.tax)) as sum_charge,
	avg(l.quantity) as avg_qty,
	avg(l.extendedprice) as avg_price,
	avg(l.discount) as avg_disc,
	count(*) as count_order
from
	lineitem l
where
	date(l.shipdate) <= date('1998-12-01', '-70 days')
group by
	l.returnflag,
	l.linestatus
order by
	l.returnflag,
	l.linestatus;
