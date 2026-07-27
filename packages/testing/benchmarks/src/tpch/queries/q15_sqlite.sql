-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Top Supplier Query (Q15)
-- Functional Query Definition
-- Approved February 1998

with revenue0 (supplier_no, total_revenue) as materialized (
  select
    l.suppkey,
    sum(l.extendedprice * (1 - l.discount))
  from
    lineitem l
  where
    l.shipdate >= date('1993-07-01')
    and l.shipdate < date('1993-07-01', '+3 months')
  group by
    l.suppkey
)
select
  s.suppkey,
  s.name,
  s.address,
  s.phone,
  r.total_revenue
from
  supplier s,
  revenue0 r
where
  s.suppkey = r.supplier_no
  and r.total_revenue = (
    select
      max(total_revenue)
    from
      revenue0
  )
order by
  s.suppkey;