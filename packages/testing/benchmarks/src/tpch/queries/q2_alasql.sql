-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Minimum Cost Supplier Query (Q2)
-- Functional Query Definition
-- Approved February 1998


with min_cost as (
  select
    ps.partkey,
    min(ps.supplycost) as supplycost
  from
    partsupp ps,
    supplier s,
    nation n,
    region r
  where
    s.suppkey = ps.suppkey
    and s.nationkey = n.nationkey
    and n.regionkey = r.regionkey
    and r.name = 'AMERICA'
  group by
    ps.partkey
)

select
  s.acctbal as acctbal,
  s.name as `s.name`,
  n.name as `n.name`,
  p.partkey as partkey,
  p.mfgr as mfgr,
  s.address as address,
  s.phone as phone,
  s.comment as comment
from
  part p,
  supplier s,
  partsupp ps,
  nation n,
  region r,
  min_cost mc
where
  p.partkey = ps.partkey
  and s.suppkey = ps.suppkey
  and p.size = 31
  and p.type like '%NICKEL'
  and s.nationkey = n.nationkey
  and n.regionkey = r.regionkey
  and r.name = 'AMERICA'
  and ps.partkey = mc.partkey
  and ps.supplycost = mc.supplycost
order by
  s.acctbal desc,
  n.name,
  s.name,
  p.partkey
limit 100;
