from dataclasses import dataclass
from typing import cast
import numpy as np
import pandas as pd
from common import DORTDB_RULES, RESULTS_FILENAME, Benchmark, Events, JsonLinesWriter, open_output

DATABASES = {
    'tpch': [ 'dortdb', 'alasql', 'sqlite', *[f'dortdb_exclude_{rule}' for rule in DORTDB_RULES], 'dortdb_exclude_all' ],
    'unibench': [ 'dortdb', 'arango', 'orient' ],
    'unisample': [ 'dortdb', 'arango' ],
}

WARMUP_RUNS = {
    'arango': 5,
    'orient': 5,
}

def main():
    with open_output(RESULTS_FILENAME) as output:
        writer = JsonLinesWriter(output)

        for benchmark_name, databases in DATABASES.items():
            benchmark = Benchmark(benchmark_name)

            for database in databases:
                process_database(writer, benchmark, database)

def process_database(writer: JsonLinesWriter, benchmark: Benchmark, database: str):
    try:
        logs = benchmark.load_logs(database)
    except Exception as e:
        print(f'No query logs found for {benchmark.name} on {database}. Skipping.')
        return

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
            queryId=query_id,
            error=error,
            memoryBeforeRun1=get_memory_event(group, Events.memoryBeforeQuery),
            memoryAfterRun1=get_memory_event(group, Events.memoryAfterQuery),
            runs=times.tolist(),
            warmupRuns=warmup_runs,
            median=np.median(measured_runs) if error is None else None,
            std=np.std(measured_runs) if error is None else None,
        )

        writer.writeobject(result)

def get_memory_event(group: pd.DataFrame, event_name: str) -> int | None:
    events = group[group['event'] == event_name]['rss']
    if len(events) != 1:
        return None

    return int(cast(float, events.iloc[0]))

@dataclass
class QueryResult:
    # We use camelCase here because this is the format we use in the JSON output.
    benchmark: str
    database: str
    queryId: int
    error: str | None
    """FAILED if the query failed, TIMEOUT if it timed out, None if it succeeded."""
    memoryBeforeRun1: int | None
    """The total memory (RSS) of the Node process in bytes just before the query is executed (after the data is loaded)."""
    memoryAfterRun1: int | None
    """The total memory (RSS) of the Node process in bytes just after the query is executed for the first time."""
    runs: list[float]
    """All runs (even warmup runs) are included here."""
    warmupRuns: int
    """How many runs are considered warmup runs and are excluded from the median/std calculations."""
    median: float | None
    """Median of the measured runs (after warmup runs are excluded)."""
    std: float | None
    """Standard deviation of the measured runs (after warmup runs are excluded)."""

if __name__ == '__main__':
    main()
