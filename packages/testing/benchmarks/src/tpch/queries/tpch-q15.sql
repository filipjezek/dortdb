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
    l.shipdate >= '1993-07-01'::date
    and l.shipdate < date.add('1993-07-01'::date, interval('3 month'))
  group by
    l.suppkey
)
select
  s.suppkey as suppkey,
  s.name as name,
  s.address as address,
  s.phone as phone,
  r.total_revenue as total_revenue
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