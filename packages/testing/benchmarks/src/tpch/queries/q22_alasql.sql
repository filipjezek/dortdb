-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Global Sales Opportunity Query (Q22)
-- Functional Query Definition
-- Approved February 1998


with avg_acctbal as (
  select
    avg(acctbal) as avg_acctbal
  from
    customer c
  where
    c.acctbal > 0
    and substr(c.phone,1,2) in
      ('24','18','27','28','29','10','17')
)

select
  custsale.cntrycode as cntrycode,
  count(*) as numcust,
  sum(custsale.acctbal) as totacctbal
from
  (
    select
      substr(c.phone, 1, 2) as cntrycode,
      c.acctbal
    from
      customer c,
      avg_acctbal a
    where
      substr(c.phone, 1, 2) in
        ('24', '18', '27', '28', '29', '10', '17')
      and c.acctbal > a.avg_acctbal
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
