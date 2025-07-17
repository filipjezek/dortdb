import { ExtractedFileOptions } from './zip/zip-extractor.js';

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
      cast: {
        custkey: Number,
        nationkey: Number,
        acctbal: Number,
      },
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
      cast: {
        orderkey: Number,
        partkey: Number,
        suppkey: Number,
        linenumber: Number,
        quantity: Number,
        extendedprice: Number,
        discount: Number,
        tax: Number,
        shipdate: (d) => new Date(d),
        commitdate: (d) => new Date(d),
        receiptdate: (d) => new Date(d),
      },
    },
  },
  'nation.tbl': {
    type: 'csv',
    key: 'nation',
    csvOptions: {
      separator: '|',
      columns: ['nationkey', 'name', 'regionkey', 'comment'],
      cast: {
        nationkey: Number,
        regionkey: Number,
      },
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
      cast: {
        orderkey: Number,
        custkey: Number,
        totalprice: Number,
        orderdate: (d) => new Date(d),
        shippriority: Number,
      },
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
      cast: {
        partkey: Number,
        size: Number,
        retailprice: Number,
      },
    },
  },
  'partsupp.tbl': {
    type: 'csv',
    key: 'partsupp',
    csvOptions: {
      separator: '|',
      columns: ['partkey', 'suppkey', 'availqty', 'supplycost', 'comment'],
      cast: {
        partkey: Number,
        suppkey: Number,
        availqty: Number,
        supplycost: Number,
      },
    },
  },
  'region.tbl': {
    type: 'csv',
    key: 'region',
    csvOptions: {
      separator: '|',
      columns: ['regionkey', 'name', 'comment'],
      cast: {
        regionkey: Number,
      },
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
      cast: {
        suppkey: Number,
        nationkey: Number,
        acctbal: Number,
      },
    },
  },
};
