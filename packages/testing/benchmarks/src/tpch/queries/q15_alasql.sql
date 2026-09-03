-- TPC TPC-H Parameter Substitution (Version 2.17.3 build 0)
-- using 1752693157 as a seed to the RNG
-- $ID$
-- TPC-H/TPC-R Top Supplier Query (Q15)
-- Functional Query Definition
-- Approved February 1998


with
  revenue0 as (
    select
      l.suppkey as supplier_no,
      sum(l.extendedprice * (1 - l.discount)) as total_revenue
    from
      lineitem l
    where
      l.shipdate >= date('1993-07-01')
      and l.shipdate < date_add(date('1993-07-01'), date_interval('3 month'))
    group by
      l.suppkey
  ),
  max_revenue as (
    select
      max(total_revenue) as total_revenue
    from
      revenue0
  )

select
  s.suppkey as suppkey,
  s.name as name,
  s.address as address,
  s.phone as phone,
  r.total_revenue as total_revenue
from
  supplier s,
  revenue0 r,
  max_revenue m
where
  s.suppkey = r.supplier_no
  and r.total_revenue = m.total_revenue
order by
  s.suppkey;
