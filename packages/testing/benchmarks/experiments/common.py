from dataclasses import dataclass, is_dataclass, asdict
from io import TextIOWrapper
import json
import os
from pathlib import Path
from typing import Any
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

BENCHMARKS_DIR = Path(__file__).parents[1]
LOG_DIR = BENCHMARKS_DIR / 'dist/logs'
OUTPUT_DIR = BENCHMARKS_DIR / 'outputs'

QUERY_TIMEOUT_MS = 100 * 60 * 1000
"""Maximal possible time of a query. 100 minutes in milliseconds."""

@dataclass
class Benchmark:
    name: str

    def file_path(self, database: str) -> str:
        filename = f'{self.name}_{database}.log'
        return os.path.join(LOG_DIR, filename)

    def load_logs(self, database: str) -> pd.DataFrame:
        path = self.file_path(database)
        return pd.read_json(path, lines=True)

def open_output(filename: str) -> TextIOWrapper:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    path = OUTPUT_DIR / filename
    # Let's append because there might be multiple results from different databases and benchmarks.
    return open(path, 'a', newline='', encoding='utf-8')

class JsonEncoder(json.JSONEncoder):
    def default(self, o):
        if is_dataclass(o):
            dataclass: Any = o
            return asdict(dataclass)
        return super().default(o)

class JsonLinesWriter:
    def __init__(self, file: TextIOWrapper):
        """If `extended` is True, extended json (via `bson.json_util`) will be used."""
        self._file = file

    def writeobject(self, object: dict | Any):
        json.dump(object, self._file, cls=JsonEncoder)
        self._file.write('\n')

class Events:
    runStarted = 'run-started'
    workerError = 'worker-error'
    softTimeout = 'soft-timeout'
    hardTimeout = 'hard-timeout'
    queryError = 'query-error'
    memorySnapshot = 'memory-snapshot'
    dataParsed = 'data-parsed'
    environmentSetup = 'environment-setup'
    runQuery = 'run-query'
    queryExecuted = 'query-executed'
    memoryBeforeQuery = 'memory-before-query'
    memoryAfterQuery = 'memory-after-query'
    queryResultRight = 'query-result-right'
    queryResultWrong = 'query-result-wrong'

def plot_database_query_times(benchmark: Benchmark, database: str):
    """Plot all query execution times for a given benchmark and database.

    Use this to visually inspect the distribution.
    """
    logs = benchmark.load_logs(database)
    executions = logs[logs['event'] == Events.queryExecuted]

    filtered = executions[['queryId', 'duration']]
    filtered['queryId'] = filtered['queryId'].astype(int)

    for query_id, group in filtered.groupby('queryId'):
        times = group.duration.to_numpy()
        label = f'{benchmark}-{database}-q{query_id}'
        plot_query_times(label, times)

def plot_query_times(query_label: str, times: np.ndarray):
    max = np.max(times)
    normalized_times = times / max  # Normalize the times for better visualization
    std = np.std(normalized_times)

    plt.figure(figsize=(10, 6))
    plt.plot(normalized_times, linestyle='None', marker='.')
    plt.title(f'{query_label} execution times (max: {(max / 1000):.2f} s, std: {std:.2f})')
    plt.xlabel('Iteration')
    plt.ylabel('Normalized execution time')
    plt.grid()
    plt.show()

def load_benchmark_query_times(benchmark: Benchmark, databases: list[str]) -> pd.DataFrame:
    times = list[pd.DataFrame]()

    for db in databases:
        logs = benchmark.load_logs(db)
        executions = logs[logs['event'] == Events.queryExecuted]

        filtered = executions[['queryId', 'duration']]
        filtered['queryId'] = filtered['queryId'].astype(int)

        grouped = filtered.groupby('queryId')['duration']
        duration = pd.DataFrame({
            'median': grouped.median(),
            'std': grouped.std(),
        })

        times.append(duration)

    return pd.concat(times, axis=1, keys=databases, sort=True)

def plot_benchmark_query_times(df: pd.DataFrame, databases: list[str], style: str, fillna: bool):
    """Plots the median execution times of queries (with std error bars) for a given benchmark and databases."""
    plt.figure(figsize=(20, 6))
    ax = plt.gca()

    x_ticks = df.index
    ax.set_xticks(x_ticks)
    ax.set_xticklabels(df.index)

    ax.set_yscale('log')
    ax.grid(which='both', color='0.9', axis='y')

    for db_index, db in enumerate(databases):
        medians = df[(db, 'median')]
        nan_map = [np.isnan(median) for median in medians]
        if fillna:
            medians = medians.fillna(QUERY_TIMEOUT_MS)

        # Standard error of the median is approximated as std * sqrt(pi / 2) (we assume normal distribution of the data).
        error_coefficient = np.sqrt(np.pi / 2)
        errors = df[(db, 'std')] * error_coefficient

        if style == 'bar':
            bar_width = 0.75 / len(databases)

            color = COLORS[db_index]
            colors = ['white' if is_nan else color for is_nan in nan_map]
            hatches = ['//' if is_nan else None for is_nan in nan_map]

            ax.bar(
                x_ticks + (db_index - (len(databases) - 1) / 2) * bar_width,
                medians,
                bar_width,
                yerr=errors,
                label=db,
                capsize=4,
                color=colors,
                edgecolor=color,
                hatch=hatches,
                zorder=4,
            )
        elif style == 'line':
            ax.errorbar(
                x_ticks,
                medians,
                # yerr=errors,
                marker='.',
                # linestyle='None',
                label=db,
                zorder=4,
            )

    ax.set_ylabel('Median execution time (ms)')
    ax.set_xlabel('TPC-H Query')

    ax.legend(loc='upper left', ncols=len(databases))

    x_vlines = [x - 0.5 for x in x_ticks[1:]]
    plt.vlines(x_vlines, ymin=0, ymax=QUERY_TIMEOUT_MS, colors='0.8', linewidth=0.5)
    plt.tight_layout()
    plt.show()

    # TODO
    # plt.savefig(path, bbox_inches='tight')

COLORS = [ 'tab:blue', 'tab:orange', 'tab:green' ]

DORTDB_RULES = [
    'subqueryNormalization',
    'boundaryNormalization',
    'predicateMovement',
    'joinNormalization',
    'indexAwareRewriting',
    'planSimplification',
]
