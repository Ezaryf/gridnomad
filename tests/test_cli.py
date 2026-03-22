from __future__ import annotations

import json
import shutil
import subprocess
import sys
import unittest
import uuid
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class CLITests(unittest.TestCase):
    def test_cli_run_produces_replay_files_and_is_deterministic(self) -> None:
        scenario = ROOT / "scenarios" / "river_fork.json"
        scratch_root = ROOT / ".tmp-test-artifacts"
        first = scratch_root / f"run-{uuid.uuid4().hex}"
        second = scratch_root / f"run-{uuid.uuid4().hex}"
        scratch_root.mkdir(exist_ok=True)
        first.mkdir(parents=True, exist_ok=False)
        second.mkdir(parents=True, exist_ok=False)
        try:
            command = [
                sys.executable,
                "-m",
                "gridnomad",
                "run",
                "--scenario",
                str(scenario),
                "--ticks",
                "4",
                "--seed",
                "21",
                "--out",
                str(first),
            ]
            result_one = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
            self.assertEqual(result_one.returncode, 0, msg=result_one.stderr)
            self.assertTrue((first / "events.jsonl").exists())
            self.assertTrue((first / "snapshot-0000.json").exists())
            self.assertTrue((first / "snapshot-0004.json").exists())

            command[-1] = str(second)
            result_two = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
            self.assertEqual(result_two.returncode, 0, msg=result_two.stderr)

            self.assertEqual(
                (first / "events.jsonl").read_text(encoding="utf-8"),
                (second / "events.jsonl").read_text(encoding="utf-8"),
            )
            self.assertEqual(
                json.loads((first / "snapshot-0004.json").read_text(encoding="utf-8")),
                json.loads((second / "snapshot-0004.json").read_text(encoding="utf-8")),
            )
        finally:
            shutil.rmtree(scratch_root, ignore_errors=True)

    def test_generate_world_command_returns_seeded_payload(self) -> None:
        scenario = ROOT / "scenarios" / "frontier_seeded.json"
        command = [
            sys.executable,
            "-m",
            "gridnomad",
            "generate-world",
            "--scenario",
            str(scenario),
            "--seed",
            "44",
            "--map-width",
            "32",
            "--map-height",
            "32",
        ]
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        payload = json.loads(result.stdout)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["world"]["seed"], 44)
        self.assertEqual(payload["world"]["width"], 32)
        self.assertEqual(payload["world"]["height"], 32)
        self.assertGreater(len(payload["world"]["settlements"]), 0)


if __name__ == "__main__":
    unittest.main()
