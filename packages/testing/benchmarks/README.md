# benchmarks

A library for comparing DortDB against other databases and trying out different query optimization strategies.

## Setup

### Build

Install [Nx](https://nx.dev). From the root of the project, run:

```bash
npm install
nx build benchmarks
```

(If you don't want to install Nx, `npx nx build benchmarks` should also work.)

### Python

Run:

```bash
cd packages/testing/benchmarks/experiments
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

The `source .venv/bin/activate` command needs to be run every time you open a new terminal window and want to run the experiments.

### Databases

The JS libraries (including DortDB) download their own data automatically. Other databases (ArangoDB, OrientDB) need to be installed manually. The [measure_queries](./experiments/measure_queries.py) script contains connection strings with the expected credentials for each database. The Unibench files (see the download links in the script) contain scripts for loading the data into each database (however, you will probably need to modify them a bit as they assume the default credentials for each database).

## Experiments

To measure the query times, run:

```bash
python -m measure_queries
```

Keep in mind that this might take a long time (several days). Feel free to comment out some of the commands to run only a subset of the experiments. The script will write logs to `dist/logs` directory. The logs are appended to existing files, so if you want to start fresh, delete the old logs first.

Export the logs to a more convenient format:

```bash
python -m export_logs
```

This will create a `outputs/results.jsonl` file with one line for each benchmark/database/query combination.

Finally, you can plot the results:

```bash
python -m plot_results
```

The plots will be, again, written to the `outputs` directory.

You can also inspect plot individual queries and further inspect the results in a Jupyter notebook. In VS Code, select the Python interpreter for the experiments folder. Press `Ctrl+Shift+P` and search for "Python: Select Interpreter", press "Enter interpreter path" and paste `packages/testing/benchmarks/experiments/.venv/bin/python`. Then, open [plots.ipynb](./experiments/plots.ipynb) and run the cells.
