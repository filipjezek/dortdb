from dataclasses import dataclass
from typing import cast
import numpy as np
import pandas as pd
from common import Benchmark, Events, JsonLinesWriter, open_output

OUTPUT_FILENAME = 'measured.jsonl'

DATABASES = {
    'tpch': [ 'dortdb', 'alasql', 'sqlite' ],
    # 'unibench': [ 'dortdb', 'arango', 'orient' ],
    # 'unisample': [ 'dortdb', 'arango' ],
}

WARMUP_RUNS = {
    'arango': 5,
    'orient': 5,
}

def main():
    with open_output(OUTPUT_FILENAME) as output:
        writer = JsonLinesWriter(output)

        for benchmark_name, databases in DATABASES.items():
            benchmark = Benchmark(benchmark_name)

            for database in databases:
                process_database(writer, benchmark, database)

def process_database(writer: JsonLinesWriter, benchmark: Benchmark, database: str):
    logs = benchmark.load_logs(database)

    for _, group in logs.groupby('runId'):
        timeouts = group[group['event'].isin([Events.softTimeout, Events.hardTimeout])]
        is_timeout = len(timeouts) > 0

        process_run(writer, benchmark, database, group, is_timeout)

def process_run(writer: JsonLinesWriter, benchmark: Benchmark, database: str, logs: pd.DataFrame, is_timeout: bool):
    # This automatically removes NaNs.
    by_query_id = logs.groupby('queryId')

    group_index = -1
    for query_id, group in by_query_id:
        group_index += 1
        query_id = int(cast(float, query_id))

        runs = group[group['event'] == Events.runQuery]
        executions = group[group['event'] == Events.queryExecuted]

        error = None
        if len(runs) != len(executions):
            error = 'FAILED'

            # If the run timeouted, it's gonna be the last query in the run.
            if is_timeout and group_index == len(by_query_id) - 1:
                error = 'TIMEOUT'

        times = executions.duration.to_numpy()

        warmup_runs = WARMUP_RUNS.get(database, 0)
        measured_runs = times[warmup_runs:]

        result = QueryResult(
            benchmark=benchmark.name,
            database=database,
            query=query_id,
            error=error,
            memoryBeforeRun1=get_memory_event(group, Events.memoryBeforeQuery),
            memoryAfterRun1=get_memory_event(group, Events.memoryAfterQuery),
            runs=times.tolist(),
            median=np.median(measured_runs),
            std=np.std(measured_runs),
        )

        writer.writeobject(result)

def get_memory_event(group: pd.DataFrame, event_name: str) -> int | None:
    events = group[group['event'] == event_name]['rss']
    if len(events) != 1:
        return None

    return int(cast(float, events.iloc[0]))

@dataclass
class QueryResult:
    benchmark: str
    database: str
    query: int
    error: str | None
    memoryBeforeRun1: int | None
    memoryAfterRun1: int | None
    runs: list[float]
    """All runs (even warmup runs) are included here."""
    median: float
    """Median of the measured runs (after warmup runs are excluded)."""
    std: float
    """Standard deviation of the measured runs (after warmup runs are excluded)."""

if __name__ == '__main__':
    main()
