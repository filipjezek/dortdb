import subprocess
from common import DORTDB_RULES, QUERY_TIMEOUT_MS

BENCHMARK_BASE_CLI_ARGS = ['npm', 'run', 'benchmark', '--']

TPCH_URL = 'https://s3.eu-north-1.amazonaws.com/dortdb.datasets-183601983835-eu-north-1-an/tpch.zip'
UNIBENCH_URL = {
    'dortdb': 'https://github.com/HY-UDBMS/UniBench/releases/download/0.2/Unibench-0.2.zip',
    'arango': 'arangodb://root@localhost:8529/unibench',
    'orient': 'orientdb://root:pass@localhost:2424/test',
}
UNISAMPLE_URL = {
    'dortdb': 'https://s3.eu-north-1.amazonaws.com/dortdb.datasets-183601983835-eu-north-1-an/Unibench-0.2.sample.zip',
    'arango': 'arangodb://root@localhost:8529/unisample',
}

def main():
    commands = [
        *tpch_commands(),
        *unibench_commands(),
        *dortdb_rules_commands(),
    ]

    for command in commands:
        args = [*BENCHMARK_BASE_CLI_ARGS, *command.to_cli_args(command.timeout_s)]
        print(f'Running benchmark {command.benchmark} on database {command.database} with args: {args}')
        subprocess.run(args, cwd='../')

def tpch_dortdb_command():
    return Command('tpch', 'dortdb', TPCH_URL, {
        1: 40,
        2: 50,
        3: 80,
        4: 50,
        5: 50,
        6: 50,
        7: 40,
        8: 40,
        9: 30,
        10: 50,
        11: 50,
        12: 50,
        13: 50,
        14: 50,
        15: 50,
        16: 50,
        17: 50,
        18: 50,
        20: 50,
        21: 50,
        22: 100,
    })

def tpch_commands():
    tpch_sqlite = Command('tpch', 'sqlite', TPCH_URL, {
        1: 50,
        2: 100,
        3: 50,
        4: 100,
        5: 80,
        6: 80,
        7: 50,
        8: 50,
        9: 50,
        10: 80,
        11: 100,
        12: 100,
        13: 80,
        14: 80,
        15: 50,
        16: 100,
        17: 100,
        18: 80,
        19: 80,
        20: 100,
        21: 50,
        22: 100,
    })

    tpch_alasql = Command('tpch', 'alasql', TPCH_URL, {
        1: 40,
        2: 100,
        3: 100,
        5: 50,
        6: 50,
        7: 50,
        8: 50,
        10: 50,
        12: 40,
        14: 40,
        15: 50,
        16: 100,
        17: 40,
        18: 100,
        22: 30,
    })

    tpch_alasql_long = Command('tpch', 'alasql', TPCH_URL, same_runs([ 11, 13, 21 ], 30))
    tpch_alasql_long.timeout_s = 2 * 24 * 60 * 60 # 2 days

    # These will surely timeout, so they are runned separately to avoid blocking the other queries.
    tpch_timeouts = [
        Command('tpch', 'dortdb', TPCH_URL, {19: 30}),
        Command('tpch', 'alasql', TPCH_URL, {4: 30}),
        Command('tpch', 'alasql', TPCH_URL, {9: 30}),
        Command('tpch', 'alasql', TPCH_URL, {19: 30}),
        Command('tpch', 'alasql', TPCH_URL, {20: 30}),
    ]

    return [
        tpch_dortdb_command(),
        tpch_alasql,
        tpch_alasql_long,
        tpch_sqlite,
        *tpch_timeouts,
    ]

def unibench_commands():
    unibench_all = [
        Command('unibench', 'dortdb', UNIBENCH_URL['dortdb'], {1: 50}),
        Command('unibench', 'arango', UNIBENCH_URL['arango'], {1: 80}),
        Command('unibench', 'orient', UNIBENCH_URL['orient'], {1: 100}),
    ]

    unisample_dortdb = Command('unibench', 'dortdb', UNISAMPLE_URL['dortdb'], same_runs([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 100))
    unisample_dortdb.output = 'unisample_dortdb.log'

    unisample_arango = Command('unibench', 'arango', UNISAMPLE_URL['arango'], same_runs([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 100))
    unisample_arango.output = 'unisample_arango.log'

    return [
        *unibench_all,
        unisample_dortdb,
        unisample_arango,
    ]

def dortdb_rules_commands():
    boundaryNormalizationCommand = rule_command('boundaryNormalization', 4, {
        1: 50,
        2: 100,
        3: 100,
        4: 100,
        5: 100,
        6: 100,
        7: 50,
        8: 50,
        9: 30,
        10: 100,
        11: 100,
        12: 50,
        13: 100,
        14: 100,
        15: 50,
        16: 50,
        17: 50,
        18: 50,
        20: 100,
        21: 50,
        22: 100,
    })

    indexAwareRewritingCommand = rule_command('indexAwareRewriting', 36, {
        1: 50,
        2: 50,
        3: 100,
        4: 5,
        5: 50,
        6: 100,
        7: 50,
        8: 30,
        9: 30,
        10: 100,
        11: 100,
        12: 100,
        13: 100,
        14: 100,
        15: 50,
        16: 30,
        17: 10,
        # 18: TIMEOUT
        # 20: TIMEOUT
        21: 5,
        22: 30,
    })

    joinNormalizationCommand = rule_command('joinNormalization', 72, {
        1: 50,
        2: 5,
        3: 5,
        4: 100,
        # 5: TIMEOUT
        6: 100,
        # 7: TIMEOUT
        # 8: TIMEOUT
        # 9: TIMEOUT
        10: 10,
        # 11: TIMEOUT
        12: 10,
        13: 100,
        14: 20,
        15: 50,
        16: 20,
        17: 40,
        18: 50,
        20: 100,
        # 21: TIMEOUT
        22: 20,
    })

    planSimplificationCommand = rule_command('planSimplification', 4, {
        1: 50,
        2: 100,
        3: 100,
        4: 100,
        5: 100,
        6: 100,
        7: 40,
        8: 50,
        9: 30,
        10: 100,
        11: 100,
        12: 50,
        13: 100,
        14: 100,
        15: 50,
        16: 50,
        17: 50,
        18: 50,
        20: 100,
        21: 50,
        22: 100,
    })

    predicateMovementCommand = rule_command('predicateMovement', 24, {
        1: 50,
        # 2: TIMEOUT
        # 3: TIMEOUT
        4: 5,
        # 5: TIMEOUT
        6: 100,
        # 7: TIMEOUT
        # 8: TIMEOUT
        # 9: TIMEOUT
        # 10: TIMEOUT
        11: 10,
        12: 50,
        13: 100,
        14: 50,
        15: 50,
        16: 20,
        17: 10,
        # 18: TIMEOUT
        # 20: TIMEOUT
        # 21: TIMEOUT
        22: 30,
    })

    subqueryNormalizationCommand = rule_command('subqueryNormalization', 12, {
        1: 50,
        # 2: WRONG
        3: 100,
        # 4: WRONG
        5: 100,
        6: 100,
        7: 50,
        8: 50,
        9: 30,
        10: 100,
        11: 5,
        12: 50,
        13: 100,
        14: 100,
        15: 50,
        16: 50,
        # 17: WRONG
        18: 50,
        # 20: WRONG
        21: 40,
        # 22: WRONG,
    })

    allCommand = rule_command('all', 24, {
        1: 50,
        # 2: TIMEOUT
        # 3: TIMEOUT
        4: 5,
        # 5: TIMEOUT
        6: 50,
        # 7: TIMEOUT
        # 8: TIMEOUT
        # 9: TIMEOUT
        # 10: TIMEOUT
        # 11: TIMEOUT
        # 12: TIMEOUT
        13: 100,
        # 14: TIMEOUT
        15: 50,
        16: 5,
        # 17: TIMEOUT
        # 18: TIMEOUT
        # 20: TIMEOUT
        # 21: TIMEOUT
        22: 10,
    })

    return [
        boundaryNormalizationCommand,
        indexAwareRewritingCommand,
        joinNormalizationCommand,
        planSimplificationCommand,
        predicateMovementCommand,
        subqueryNormalizationCommand,
        allCommand,
    ]

def rule_command(rule: str, timeout_h: int, query_runs: dict[int, int]):
    command = Command('tpch', 'dortdb', TPCH_URL, query_runs)
    command.output = f'tpch_dortdb_exclude_{rule}.log'
    command.timeout_s = timeout_h * 60 * 60

    if rule == 'all':
        command.custom_args = []
        for rule in DORTDB_RULES:
            command.custom_args.extend(['--dortdb-exclude-rule', rule])
    else:
        command.custom_args = ['--dortdb-exclude-rule', rule]

    return command

class Command:

    def __init__(self, benchmark: str, database: str, data_url: str, query_runs: dict[int, int]):
        self.benchmark = benchmark
        self.database = database
        self.data_url = data_url
        self.query_runs = query_runs

        self.timeout_s = int(QUERY_TIMEOUT_MS / 1000)
        self.output: str | None = None
        self.custom_args: list[str] = []

    def to_cli_args(self, timeout_s: int | None) -> list[str]:
        args = [
            '-b', self.benchmark,
            '-d', self.database,
            '-u', self.data_url,
            '-t', str(timeout_s),
            '-T', str(timeout_s),
        ]

        if self.output is not None:
            args.append('-o')
            args.append(self.output)

        for query_id, runs in self.query_runs.items():
            args.append('-q')
            args.append(str(query_id))
            args.append('-r')
            args.append(str(runs))

        args.extend(self.custom_args)

        return args

def same_runs(ids: list[int], runs: int) -> dict[int, int]:
    return {id: runs for id in ids}

if __name__ == '__main__':
    main()
