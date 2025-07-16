import { ExtractedFileOptions } from '@dortdb/dataloaders';

export interface TPCHData {
  customer: any[];
  lineitem: any[];
  nation: any[];
  orders: any[];
  part: any[];
  partsupp: any[];
  region: any[];
  supplier: any[];
}

export const tpchFiles: Record<string, ExtractedFileOptions> = {
  'customer.tbl': {
    type: 'csv',
    key: 'customer',
    csvOptions: {
      separator: '|',
      columns: [
        'custkey',
        'name',
        'address',
        'nationkey',
        'phone',
        'acctbal',
        'mktsegment',
        'comment',
      ],
    },
  },
  'lineitem.tbl': {
    type: 'csv',
    key: 'lineitem',
    csvOptions: {
      separator: '|',
      columns: [
        'orderkey',
        'partkey',
        'suppkey',
        'linenumber',
        'quantity',
        'extendedprice',
        'discount',
        'tax',
        'returnflag',
        'linestatus',
        'shipdate',
        'commitdate',
        'receiptdate',
        'shipinstruct',
        'shipmode',
        'comment',
      ],
    },
  },
  'nation.tbl': {
    type: 'csv',
    key: 'nation',
    csvOptions: {
      separator: '|',
      columns: ['nationkey', 'name', 'regionkey', 'comment'],
    },
  },
  'orders.tbl': {
    type: 'csv',
    key: 'orders',
    csvOptions: {
      separator: '|',
      columns: [
        'orderkey',
        'custkey',
        'orderstatus',
        'totalprice',
        'orderdate',
        'orderpriority',
        'clerk',
        'shippriority',
        'comment',
      ],
    },
  },
  'part.tbl': {
    type: 'csv',
    key: 'part',
    csvOptions: {
      separator: '|',
      columns: [
        'partkey',
        'name',
        'mfgr',
        'brand',
        'type',
        'size',
        'container',
        'retailprice',
        'comment',
      ],
    },
  },
  'partsupp.tbl': {
    type: 'csv',
    key: 'partsupp',
    csvOptions: {
      separator: '|',
      columns: ['partkey', 'suppkey', 'availqty', 'supplycost', 'comment'],
    },
  },
  'region.tbl': {
    type: 'csv',
    key: 'region',
    csvOptions: {
      separator: '|',
      columns: ['regionkey', 'name', 'comment'],
    },
  },
  'supplier.tbl': {
    type: 'csv',
    key: 'supplier',
    csvOptions: {
      separator: '|',
      columns: [
        'suppkey',
        'name',
        'address',
        'nationkey',
        'phone',
        'acctbal',
        'comment',
      ],
    },
  },
};
