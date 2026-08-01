import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from matplotlib.typing import LegendLocType
from common import DORTDB_RULES, OUTPUT_DIR, QUERY_TIMEOUT_MS, Benchmark

def main():
    _plot_tpch()
    _plot_unibench()
    _plot_unisample()
    _plot_tpch_rules()

def _plot_tpch():
    results = Benchmark('tpch').load_results()
    databases = ['dortdb', 'alasql', 'sqlite']
    plot_benchmark_query_times(results, databases, 'bar', fillna=True, save_as='tpch_medians.pdf')

def _plot_unibench():
    results = Benchmark('unibench').load_results()
    databases = ['dortdb', 'arango', 'orient']
    plot_benchmark_query_times(results, databases, 'bar', fillna=True, save_as='unibench_medians.pdf')

def _plot_unisample():
    results = Benchmark('unisample').load_results()
    databases = ['dortdb', 'arango']
    plot_benchmark_query_times(results, databases, 'bar', fillna=True, save_as='unisample_medians.pdf', legend_loc='upper right')

def _plot_tpch_rules():
    results = Benchmark('tpch').load_results()
    databases = [f'dortdb_exclude_{rule}' for rule in DORTDB_RULES] + ['dortdb_exclude_all']
    plot_benchmark_query_times(results, databases, 'bar', fillna=True, save_as='tpch_rules_medians.pdf', legend_loc='upper right')

def plot_database_query_times(results: pd.DataFrame, database: str):
    """Plot all query execution times for a given benchmark and database.

    Use this to visually inspect the distribution.
    """
    queries = results[(results['database'] == database)]

    for query_id, group in queries.groupby('queryId'):
        row = group.iloc[0]
        times = row['runs']
        label = f'{database}-q{query_id}'
        _plot_query_times(label, times)

def _plot_query_times(query_label: str, times: np.ndarray):
    max = np.max(times)
    normalized_times = times / max  # Normalize the times for better visualization
    std = np.std(normalized_times)

    plt.figure(figsize=(10, 6))
    plt.plot(normalized_times, linestyle='None', marker='.')
    plt.title(f'{query_label} execution times (max: {(max / 1000):.2f} s, normalized std: {std:.2f})')
    plt.xlabel('Iteration')
    plt.ylabel('Normalized execution time')
    plt.grid()
    plt.show()

def plot_benchmark_query_times(
        results: pd.DataFrame,
        databases: list[str],
        style: str,
        fillna: bool,
        save_as: str | None = None,
        legend_loc: LegendLocType | None = None
    ):
    """Plots the median execution times of queries (with std error bars) for a given benchmark and databases."""
    df = (
        results
            .pivot(index='queryId', columns='database', values=['median', 'std'])
            # Swap the levels so that the databases are the first level and the metrics (median, std) are the second level.
            .swaplevel(0, 1, axis=1)
            # Sort the columns as is the `databases` list.
            .reindex(databases, axis=1, level=0)
            # Sort the index so that the queries are in order.
            .sort_index()
    )

    # Remove queries that have NaN for all databases.
    df = df[~df.isna().all(axis=1)]

    plt.figure(figsize=(20, 6))
    ax = plt.gca()

    x_ticks = df.index
    ax.set_xticks(x_ticks)
    ax.set_xticklabels(df.index)

    ax.set_yscale('log')
    ax.grid(which='both', color='0.9', axis='y')

    y_max = 0.

    for db_index, db in enumerate(databases):
        medians = df[(db, 'median')]
        nan_map = [np.isnan(median) for median in medians]
        if fillna:
            medians = medians.fillna(QUERY_TIMEOUT_MS)

        y_max = max(y_max, np.max(medians))

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

    loc = legend_loc if legend_loc is not None else 'upper left'
    ncols = len(databases)
    if ncols > 3:
        ncols = 3
    ax.legend(loc=loc, ncols=ncols)

    x_vlines = [x - 0.5 for x in x_ticks[1:]]
    # get the current maximal y value:
    plt.vlines(x_vlines, ymin=0, ymax=y_max, colors='0.8', linewidth=0.5)
    plt.tight_layout()

    if save_as:
        path = OUTPUT_DIR / save_as
        plt.savefig(path, bbox_inches='tight')
    else:
        plt.show()

COLORS = list(mcolors.TABLEAU_COLORS.keys())

if __name__ == '__main__':
    main()
