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

RESULTS_FILENAME = 'results.jsonl'

QUERY_TIMEOUT_MS = 100 * 60 * 1000
"""Maximal possible time of a query. 100 minutes in milliseconds."""

@dataclass
class Benchmark:
    name: str

    def logs_path(self, database: str) -> Path:
        filename = f'{self.name}_{database}.log'
        return LOG_DIR / filename

    def load_logs(self, database: str) -> pd.DataFrame:
        path = self.logs_path(database)
        return pd.read_json(path, lines=True)

    def load_results(self) -> pd.DataFrame:
        path = OUTPUT_DIR / RESULTS_FILENAME
        df = pd.read_json(path, lines=True)
        return df[(df['benchmark'] == self.name)]

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

DORTDB_RULES = [
    'subqueryNormalization',
    'boundaryNormalization',
    'predicateMovement',
    'joinNormalization',
    'indexAwareRewriting',
    'planSimplification',
]
