from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from gridnomad.ai import HeuristicLLMAdapter, RoutingLLMAdapter
from gridnomad.core.scenario import dump_snapshot, load_scenario, load_scenario_data
from gridnomad.core.simulation import Simulation, SimulationAbortError


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
        help="Optional JSON file with per-group AI provider settings.",
    )

    stream_parser = subparsers.add_parser("run-stream", help="Run a scenario and stream tick updates as NDJSON.")
    _add_world_arguments(stream_parser)
    stream_parser.add_argument("--ticks", type=int, required=True, help="Number of ticks to simulate.")
    stream_parser.add_argument("--out", required=True, help="Output directory for events and snapshots.")
    stream_parser.add_argument(
        "--settings",
        default=None,
        help="Optional JSON file with per-group AI provider settings.",
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
    bundle, adapter = _load_bundle_and_adapter(args)
    simulation = Simulation(
        bundle.config,
        bundle.world,
        adapter,
        culture_store=bundle.culture_store,
    )
    output_dir = Path(args.out)
    output_dir.mkdir(parents=True, exist_ok=True)
    dump_snapshot(output_dir / "snapshot-0000.json", simulation.snapshot())
    try:
        for _ in range(args.ticks):
            simulation.step()
            if simulation.world.tick % bundle.config.snapshot_interval == 0:
                dump_snapshot(output_dir / f"snapshot-{simulation.world.tick:04d}.json", simulation.snapshot())
    except SimulationAbortError as exc:
        dump_snapshot(output_dir / f"snapshot-{simulation.world.tick:04d}.json", simulation.snapshot())
        simulation.write_events(output_dir)
        print(str(exc), file=sys.stderr)
        return 1
    if simulation.world.tick % bundle.config.snapshot_interval != 0:
        dump_snapshot(output_dir / f"snapshot-{simulation.world.tick:04d}.json", simulation.snapshot())
    simulation.write_events(output_dir)
    print(
        f"Completed {args.ticks} ticks for scenario {args.scenario}. "
        f"Artifacts written to {output_dir.resolve()}"
    )
    return 0


def run_stream_command(args: argparse.Namespace) -> int:
    bundle, adapter = _load_bundle_and_adapter(args)
    simulation = Simulation(
        bundle.config,
        bundle.world,
        adapter,
        culture_store=bundle.culture_store,
    )
    output_dir = Path(args.out)
    output_dir.mkdir(parents=True, exist_ok=True)

    def emit(message_type: str, **payload: object) -> None:
        print(json.dumps({"type": message_type, **payload}, sort_keys=True), flush=True)

    initial_snapshot = simulation.snapshot()
    dump_snapshot(output_dir / "snapshot-0000.json", initial_snapshot)
    controller_summaries = (
        adapter.describe_controllers(simulation.world.factions)
        if isinstance(adapter, RoutingLLMAdapter)
        else []
    )
    emit(
        "run_started",
        ticks=args.ticks,
        run_duration_seconds=bundle.config.run_duration_seconds,
        decision_interval_ms=bundle.config.decision_interval_ms,
        microstep_interval_ms=bundle.config.microstep_interval_ms,
        playback_speed=bundle.config.playback_speed,
        output_dir=str(output_dir.resolve()),
        seed=simulation.world.seed,
        controllers=controller_summaries,
    )
    emit(
        "frame",
        time_ms=0,
        frame_index=0,
        decision_beat=0,
        humans=_frame_humans(simulation),
    )
    emit("snapshot", tick=0, snapshot=initial_snapshot)
    emit(
        "status",
        tick=0,
        time_ms=0,
        humans_alive=sum(1 for agent in simulation.world.agents.values() if agent.alive),
        groups=len(simulation.world.factions),
        message="Live simulation started.",
    )

    frame_index = 0
    for _ in range(args.ticks):
        previous_agents = {
            agent.id: {"x": agent.x, "y": agent.y}
            for agent in simulation.world.agents.values()
            if agent.alive
        }
        try:
            events = simulation.step()
        except SimulationAbortError as exc:
            if isinstance(adapter, RoutingLLMAdapter):
                for message in adapter.consume_runtime_messages():
                    emit("provider_status", tick=simulation.world.tick, time_ms=simulation.current_time_ms, **message)
            snapshot = simulation.snapshot()
            dump_snapshot(output_dir / f"snapshot-{simulation.world.tick:04d}.json", snapshot)
            simulation.write_events(output_dir)
            emit(
                "run_failed",
                tick=simulation.world.tick,
                time_ms=simulation.current_time_ms,
                message=str(exc),
                reason=exc.reason,
                actor_id=exc.actor_id,
                faction_id=exc.faction_id,
                provider=exc.provider,
                model=exc.model,
                snapshot=snapshot,
            )
            emit(
                "error",
                tick=simulation.world.tick,
                time_ms=simulation.current_time_ms,
                message=str(exc),
            )
            return 1
        if simulation.world.tick % bundle.config.snapshot_interval == 0:
            dump_snapshot(output_dir / f"snapshot-{simulation.world.tick:04d}.json", simulation.snapshot())
        for event in events:
            emit(
                "event",
                tick=event.tick,
                time_ms=simulation.current_time_ms,
                event=event.to_dict(),
            )
        for frame in simulation.build_transition_frames(previous_agents, frame_index_start=frame_index):
            emit("frame", **frame)
            frame_index = int(frame["frame_index"])
        snapshot = simulation.snapshot()
        emit("snapshot", tick=simulation.world.tick, snapshot=snapshot)
        if isinstance(adapter, RoutingLLMAdapter):
            for message in adapter.consume_runtime_messages():
                emit("provider_status", tick=simulation.world.tick, time_ms=simulation.current_time_ms, **message)
        emit(
            "status",
            tick=simulation.world.tick,
            time_ms=simulation.current_time_ms,
            humans_alive=sum(1 for agent in simulation.world.agents.values() if agent.alive),
            groups=len(simulation.world.factions),
            message=f"Live step {simulation.world.tick} complete.",
        )

    if simulation.world.tick % bundle.config.snapshot_interval != 0:
        dump_snapshot(output_dir / f"snapshot-{simulation.world.tick:04d}.json", simulation.snapshot())
    simulation.write_events(output_dir)
    emit(
        "complete",
        tick=simulation.world.tick,
        time_ms=simulation.current_time_ms,
        run_dir=str(output_dir.resolve()),
        event_count=len(simulation.events),
        snapshot=simulation.snapshot(),
    )
    return 0


def generate_world_command(args: argparse.Namespace) -> int:
    bundle, _ = _load_bundle_and_adapter(args, allow_settings=False)
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
    try:
        if args.command == "run":
            return run_command(args)
        if args.command == "run-stream":
            return run_stream_command(args)
        if args.command == "generate-world":
            return generate_world_command(args)
    except ValueError as exc:
        parser.error(str(exc))
    parser.error(f"Unknown command {args.command}")
    return 2


def _add_world_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--scenario", default=None, help="Path to the scenario JSON file.")
    parser.add_argument(
        "--request-stdin",
        action="store_true",
        help="Read the scenario payload, and optional controller settings, from stdin as JSON.",
    )
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
    parser.add_argument("--biome-density", type=int, default=None, help="Optional biome density override.")
    parser.add_argument("--fauna-density", type=int, default=None, help="Optional legacy world density override.")
    parser.add_argument(
        "--kingdom-growth-intensity",
        type=int,
        default=None,
        help="Optional legacy world intensity override.",
    )


def _frame_humans(simulation: Simulation) -> list[dict[str, object]]:
    return [
        {
            "id": agent.id,
            "x": agent.x,
            "y": agent.y,
            "render_x": float(agent.x),
            "render_y": float(agent.y),
            "health": agent.health,
            "food": agent.inventory.food,
            "wood": agent.inventory.wood,
            "stone": agent.inventory.stone,
            "weapon_kind": agent.weapon_kind,
            "bonded_partner_id": agent.bonded_partner_id,
            "home_structure_id": agent.home_structure_id,
            "last_world_action_summary": agent.last_world_action_summary,
            "state": agent.task_state,
            "task_progress": agent.task_progress,
            "target_human_id": agent.interaction_target_id,
            "target_tile": None
            if agent.task_target_x is None or agent.task_target_y is None
            else {"x": agent.task_target_x, "y": agent.task_target_y},
            "speaking": False,
            "alive": agent.alive,
        }
        for agent in sorted(simulation.world.agents.values(), key=lambda item: item.id)
        if agent.alive
    ]


def _load_bundle_and_adapter(
    args: argparse.Namespace,
    *,
    allow_settings: bool = True,
):
    payload = _read_request_payload(args)
    if payload is not None:
        scenario_payload = payload.get("scenario")
        if not isinstance(scenario_payload, dict):
            raise ValueError("Request stdin payload must include a scenario object.")
        bundle = load_scenario_data(
            scenario_payload,
            seed_override=args.seed,
            width_override=args.map_width,
            height_override=args.map_height,
            preset_override=args.generator_preset,
            coastline_bias_override=args.coastline_bias,
            river_count_override=args.river_count,
            settlement_density_override=args.settlement_density,
            landmark_density_override=args.landmark_density,
            biome_density_override=args.biome_density,
            fauna_density_override=args.fauna_density,
            kingdom_growth_intensity_override=args.kingdom_growth_intensity,
        )
        if allow_settings and isinstance(payload.get("settings"), dict):
            adapter = RoutingLLMAdapter.from_dict(payload["settings"], project_dir=Path.cwd())
        else:
            adapter = HeuristicLLMAdapter()
        return bundle, adapter

    if not args.scenario:
        raise ValueError("Either --scenario or --request-stdin is required.")
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
        biome_density_override=args.biome_density,
        fauna_density_override=args.fauna_density,
        kingdom_growth_intensity_override=args.kingdom_growth_intensity,
    )
    adapter = (
        RoutingLLMAdapter.from_path(args.settings, project_dir=Path.cwd())
        if allow_settings and args.settings
        else HeuristicLLMAdapter()
    )
    return bundle, adapter


def _read_request_payload(args: argparse.Namespace) -> dict | None:
    if not args.request_stdin:
        return None
    raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("Expected JSON payload on stdin.")
    return json.loads(raw)
