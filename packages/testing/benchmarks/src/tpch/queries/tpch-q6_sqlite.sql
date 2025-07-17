-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Forecasting Revenue Change Query (Q6)
-- Functional Query Definition
-- Approved February 1998


select
	sum(l.extendedprice * l.discount) as revenue
from
	lineitem l
where
	date(l.shipdate) >= date('1997-01-01')
	and date(l.shipdate) < date('1997-01-01', '+1 years')
	and l.discount between 0.08 - 0.01 and 0.08 + 0.01
	and l.quantity < 24;
