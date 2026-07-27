# benchmarks

Install [Nx](https://nx.dev).

From the root of the project, run:
```bash
npm install
nx build benchmarks
cd packages/testing/benchmarks
```

Run:
```bash
npm run benchmark -- -b tpch -d dortdb -q 1
npm run benchmark -- -b tpch -d sqlite -q 1
npm run benchmark -- -b tpch -d alasql -q 1

npm run benchmark -- -b unibench -d dortdb -q 1
npm run benchmark -- -b unibench -d orient -q 1
npm run benchmark -- -b unibench -d arango -q 1

# Full data
# npm run benchmark -- -b unibench -u https://github.com/HY-UDBMS/UniBench/releases/download/0.2/Unibench-0.2.zip -d dortdb -q 1
# npm run benchmark -- -b unibench -u https://github.com/HY-UDBMS/UniBench/releases/download/0.2/Unibench-0.2.zip -d orient -q 1
# npm run benchmark -- -b unibench -u https://github.com/HY-UDBMS/UniBench/releases/download/0.2/Unibench-0.2.zip -d arango -q 1

# npm run unibench
# npm run tpch
# npm run tpch:sqlite
# npm run tpch:alasql
```
