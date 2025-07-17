-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Global Sales Opportunity Query (Q22)
-- Functional Query Definition
-- Approved February 1998


select
	custsale.cntrycode,
	count(*) as numcust,
	sum(custsale.acctbal) as totacctbal
from
	(
		select
			substr(c.phone, 0, 2) as cntrycode,
			c.acctbal
		from
			customer c
		where
			substr(c.phone, 0, 2) in
				('24', '18', '27', '28', '29', '10', '17')
			and c.acctbal > (
				select
					avg(c.acctbal)
				from
					customer c
				where
					c.acctbal > 0.00
					and substr(c.phone, 0, 2) in
						('24', '18', '27', '28', '29', '10', '17')
			)
			and not exists (
				select
					1
				from
					orders o
				where
					o.custkey = c.custkey
			)
	) as custsale
group by
	custsale.cntrycode
order by
	custsale.cntrycode;
