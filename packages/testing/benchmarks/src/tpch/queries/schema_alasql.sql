CREATE TABLE region (
    regionkey INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    comment TEXT
);

CREATE TABLE nation (
    nationkey INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    regionkey INTEGER NOT NULL,
    comment TEXT,
    FOREIGN KEY (regionkey) REFERENCES region(regionkey)
);

CREATE TABLE supplier (
    suppkey INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    nationkey INTEGER NOT NULL,
    phone TEXT,
    acctbal REAL,
    comment TEXT,
    FOREIGN KEY (nationkey) REFERENCES nation(nationkey)
);

CREATE TABLE part (
    partkey INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    mfgr TEXT,
    brand TEXT,
    type TEXT,
    size INTEGER,
    container TEXT,
    retailprice REAL,
    comment TEXT
);

CREATE TABLE partsupp (
    partkey INTEGER NOT NULL,
    suppkey INTEGER NOT NULL,
    availqty INTEGER,
    supplycost REAL,
    comment TEXT,
    PRIMARY KEY (partkey, suppkey),
    FOREIGN KEY (partkey) REFERENCES part(partkey),
    FOREIGN KEY (suppkey) REFERENCES supplier(suppkey)
);

CREATE TABLE customer (
    custkey INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    nationkey INTEGER NOT NULL,
    phone TEXT,
    acctbal REAL,
    mktsegment TEXT,
    comment TEXT,
    FOREIGN KEY (nationkey) REFERENCES nation(nationkey)
);

CREATE TABLE orders (
    orderkey INTEGER PRIMARY KEY,
    custkey INTEGER NOT NULL,
    orderstatus TEXT,
    totalprice REAL,
    orderdate Date,
    orderpriority TEXT,
    clerk TEXT,
    shippriority INTEGER,
    comment TEXT,
    FOREIGN KEY (custkey) REFERENCES customer(custkey)
);

CREATE TABLE lineitem (
    orderkey INTEGER NOT NULL,
    partkey INTEGER NOT NULL,
    suppkey INTEGER NOT NULL,
    linenumber INTEGER NOT NULL,
    quantity REAL,
    extendedprice REAL,
    discount REAL,
    tax REAL,
    returnflag TEXT,
    linestatus TEXT,
    shipdate Date,
    commitdate Date,
    receiptdate Date,
    shipinstruct TEXT,
    shipmode TEXT,
    comment TEXT,
    PRIMARY KEY (orderkey, linenumber),
    FOREIGN KEY (orderkey) REFERENCES orders(orderkey),
    FOREIGN KEY (partkey, suppkey) REFERENCES partsupp(partkey, suppkey)
);

CREATE INDEX idx_nation_regionkey ON nation(regionkey);
CREATE INDEX idx_supplier_nationkey ON supplier(nationkey);
CREATE INDEX idx_partsupp_partkey ON partsupp(partkey);
CREATE INDEX idx_partsupp_suppkey ON partsupp(suppkey);
CREATE INDEX idx_customer_nationkey ON customer(nationkey);
CREATE INDEX idx_orders_custkey ON orders(custkey);
CREATE INDEX idx_lineitem_partkey ON lineitem(partkey);
CREATE INDEX idx_lineitem_suppkey ON lineitem(suppkey);
CREATE INDEX idx_lineitem_partkey_suppkey ON lineitem(partkey, suppkey);
