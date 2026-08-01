import subprocess
from common import DORTDB_RULES, QUERY_TIMEOUT_MS

def main():
    commands = [
        *tpch_commands(),
        *unibench_commands(),
        *dortdb_rules_commands(),
    ]

    for command in commands:
        args = ['npm', 'run', 'benchmark', '--', *command.to_cli_args(command.timeout_s)]
        print(f'Running benchmark {command.benchmark} on database {command.database} with args: {args}')
        subprocess.run(args, cwd='../')

def tpch_dortdb_command():
    return Command('tpch', 'dortdb', {
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
    tpch_sqlite = Command('tpch', 'sqlite', {
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

    tpch_alasql = Command('tpch', 'alasql', {
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

    tpch_alasql_long = Command('tpch', 'alasql', same_runs([ 11, 13, 21 ], 30))
    tpch_alasql_long.timeout_s = 2 * 24 * 60 * 60 # 2 days

    # These will surely timeout, so they are runned separately to avoid blocking the other queries.
    tpch_timeouts = [
        Command('tpch', 'dortdb', {19: 30}),
        Command('tpch', 'alasql', {4: 30}),
        Command('tpch', 'alasql', {9: 30}),
        Command('tpch', 'alasql', {19: 30}),
        Command('tpch', 'alasql', {20: 30}),
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
        Command('unibench', 'dortdb', {1: 50}),
        Command('unibench', 'arango', {1: 80}),
        Command('unibench', 'orient', {1: 100}),
    ]
    for command in unibench_all:
        # Use the full dataset.
        command.data_url = 'https://github.com/HY-UDBMS/UniBench/releases/download/0.2/Unibench-0.2.zip'

    unisample_dortdb = Command('unibench', 'dortdb', {
        1: 100,
        2: 100,
        3: 100,
        4: 100,
        5: 100,
        6: 80,
        7: 50,
        8: 40,
        9: 50,
        10: 100,
    })
    unisample_dortdb.output = 'unisample_dortdb.log'

    unisample_arango = Command('unibench', 'arango', same_runs([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 100))
    unisample_arango.output = 'unisample_arango.log'

    return [
        *unibench_all,
        unisample_dortdb,
        unisample_arango,
    ]

def dortdb_rules_commands():
    commands: list[Command] = []

    for rule in DORTDB_RULES:
        command = tpch_dortdb_command()
        commands.append(command)

        command.output = f'tpch_dortdb_exclude_{rule}.log'
        command.custom_args = ['--dortdb-exclude-rule', rule]

    exclude_all = tpch_dortdb_command()
    commands.append(exclude_all)

    exclude_all.output = 'tpch_dortdb_exclude_all.log'
    exclude_all.custom_args = []
    for rule in DORTDB_RULES:
        exclude_all.custom_args.append('--dortdb-exclude-rule')
        exclude_all.custom_args.append(rule)

    return commands

class Command:

    def __init__(self, benchmark: str, database: str, query_runs: dict[int, int]):
        self.benchmark = benchmark
        self.database = database
        self.query_runs = query_runs

        self.timeout_s = int(QUERY_TIMEOUT_MS / 1000)
        self.output: str | None = None
        self.data_url: str | None = None
        self.custom_args: list[str] = []

    def to_cli_args(self, timeout_s: int | None) -> list[str]:
        args = [
            '-b', self.benchmark,
            '-d', self.database,
            '-t', str(timeout_s),
            '-T', str(timeout_s),
        ]

        if self.data_url is not None:
            args.append('-u')
            args.append(self.data_url)

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
