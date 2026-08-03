# benchmarks

Install [Nx](https://nx.dev).

From the root of the project, run:
```bash
npm install
nx build benchmarks
cd packages/testing/benchmarks
```
(If you don't want to install Nx, `npx nx build benchmarks` should also work.)

### Experiments

```bash
cd experiments
python -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

In VS Code, select the Python interpreter for the experiments folder. Press `Ctrl+Shift+P` and search for "Python: Select Interpreter", press "Enter interpreter path" and paste `packages/testing/benchmarks/experiments/.venv/bin/python`.

```bash
python -m measure_queries
```