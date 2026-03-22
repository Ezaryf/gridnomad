from __future__ import annotations

import argparse
from pathlib import Path

from gridnomad.ai import HeuristicLLMAdapter, RoutingLLMAdapter
from gridnomad.core.scenario import dump_snapshot, load_scenario
from gridnomad.core.simulation import Simulation


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="gridnomad", description="GridNomad backend simulator CLI.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_parser = subparsers.add_parser("run", help="Run a scenario and emit replay artifacts.")
    run_parser.add_argument("--scenario", required=True, help="Path to the scenario JSON file.")
    run_parser.add_argument("--ticks", type=int, required=True, help="Number of ticks to simulate.")
    run_parser.add_argument("--seed", type=int, default=None, help="Optional RNG seed override.")
    run_parser.add_argument("--out", required=True, help="Output directory for events and snapshots.")
    run_parser.add_argument(
        "--settings",
        default=None,
        help="Optional JSON file with per-civilization AI provider settings.",
    )
    return parser


def run_command(args: argparse.Namespace) -> int:
    bundle = load_scenario(args.scenario, seed_override=args.seed)
    adapter = (
        RoutingLLMAdapter.from_path(args.settings, project_dir=Path.cwd())
        if args.settings
        else HeuristicLLMAdapter()
    )
    simulation = Simulation(
        bundle.config,
        bundle.world,
        adapter,
        culture_store=bundle.culture_store,
    )
    output_dir = Path(args.out)
    output_dir.mkdir(parents=True, exist_ok=True)
    dump_snapshot(output_dir / "snapshot-0000.json", simulation.snapshot())
    for _ in range(args.ticks):
        simulation.step()
        if simulation.world.tick % bundle.config.snapshot_interval == 0:
            dump_snapshot(output_dir / f"snapshot-{simulation.world.tick:04d}.json", simulation.snapshot())
    if simulation.world.tick % bundle.config.snapshot_interval != 0:
        dump_snapshot(output_dir / f"snapshot-{simulation.world.tick:04d}.json", simulation.snapshot())
    simulation.write_events(output_dir)
    print(
        f"Completed {args.ticks} ticks for scenario {args.scenario}. "
        f"Artifacts written to {output_dir.resolve()}"
    )
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "run":
        return run_command(args)
    parser.error(f"Unknown command {args.command}")
    return 2
