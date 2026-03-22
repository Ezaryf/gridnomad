from __future__ import annotations

import argparse
import json
from pathlib import Path

from gridnomad.ai import HeuristicLLMAdapter, RoutingLLMAdapter
from gridnomad.core.scenario import dump_snapshot, load_scenario
from gridnomad.core.simulation import Simulation


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="gridnomad", description="GridNomad backend simulator CLI.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    run_parser = subparsers.add_parser("run", help="Run a scenario and emit replay artifacts.")
    _add_world_arguments(run_parser)
    run_parser.add_argument("--ticks", type=int, required=True, help="Number of ticks to simulate.")
    run_parser.add_argument("--out", required=True, help="Output directory for events and snapshots.")
    run_parser.add_argument(
        "--settings",
        default=None,
        help="Optional JSON file with per-civilization AI provider settings.",
    )

    generate_parser = subparsers.add_parser(
        "generate-world",
        help="Generate a deterministic world and print JSON for browser consumption.",
    )
    _add_world_arguments(generate_parser)
    generate_parser.add_argument(
        "--out",
        default=None,
        help="Optional path to write the generated world payload as JSON.",
    )
    return parser


def run_command(args: argparse.Namespace) -> int:
    bundle = load_scenario(
        args.scenario,
        seed_override=args.seed,
        width_override=args.map_width,
        height_override=args.map_height,
        preset_override=args.generator_preset,
        coastline_bias_override=args.coastline_bias,
        river_count_override=args.river_count,
        settlement_density_override=args.settlement_density,
        landmark_density_override=args.landmark_density,
    )
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


def generate_world_command(args: argparse.Namespace) -> int:
    bundle = load_scenario(
        args.scenario,
        seed_override=args.seed,
        width_override=args.map_width,
        height_override=args.map_height,
        preset_override=args.generator_preset,
        coastline_bias_override=args.coastline_bias,
        river_count_override=args.river_count,
        settlement_density_override=args.settlement_density,
        landmark_density_override=args.landmark_density,
    )
    payload = {
        "ok": True,
        "config": bundle.config.to_dict(),
        "world": bundle.world.to_dict(),
        "culture": bundle.culture_store.to_dict(),
    }
    text = json.dumps(payload, indent=2, sort_keys=True)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
    else:
        print(text)
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.command == "run":
        return run_command(args)
    if args.command == "generate-world":
        return generate_world_command(args)
    parser.error(f"Unknown command {args.command}")
    return 2


def _add_world_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--scenario", required=True, help="Path to the scenario JSON file.")
    parser.add_argument("--seed", type=int, default=None, help="Optional RNG seed override.")
    parser.add_argument(
        "--generator-preset",
        default=None,
        help="Optional preset override for generator-backed scenarios.",
    )
    parser.add_argument("--map-width", type=int, default=None, help="Optional generated map width override.")
    parser.add_argument("--map-height", type=int, default=None, help="Optional generated map height override.")
    parser.add_argument("--coastline-bias", type=int, default=None, help="Optional coastline bias override.")
    parser.add_argument("--river-count", type=int, default=None, help="Optional river count override.")
    parser.add_argument(
        "--settlement-density",
        type=int,
        default=None,
        help="Optional settlement density override.",
    )
    parser.add_argument(
        "--landmark-density",
        type=int,
        default=None,
        help="Optional landmark density override.",
    )
