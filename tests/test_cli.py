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
        self.assertIn("visual_variant", payload["world"]["tiles"][0][0])
        self.assertIn("sprite_key", payload["world"]["settlements"][0])
        self.assertIn("footprint", payload["world"]["settlements"][0])

    def test_generate_world_command_accepts_request_stdin(self) -> None:
        scenario_path = ROOT / "scenarios" / "frontier_seeded.json"
        scenario = json.loads(scenario_path.read_text(encoding="utf-8"))
        command = [
            sys.executable,
            "-m",
            "gridnomad",
            "generate-world",
            "--request-stdin",
            "--seed",
            "45",
            "--map-width",
            "24",
            "--map-height",
            "24",
        ]
        result = subprocess.run(
            command,
            cwd=ROOT,
            input=json.dumps({"scenario": scenario}),
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, msg=result.stderr)
        payload = json.loads(result.stdout)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["world"]["seed"], 45)
        self.assertEqual(payload["world"]["width"], 24)
        self.assertEqual(payload["world"]["height"], 24)

    def test_run_stream_emits_live_messages_and_artifacts(self) -> None:
        scenario = ROOT / "scenarios" / "river_fork.json"
        scratch_root = ROOT / ".tmp-test-artifacts"
        run_dir = scratch_root / f"stream-{uuid.uuid4().hex}"
        scratch_root.mkdir(exist_ok=True)
        run_dir.mkdir(parents=True, exist_ok=False)
        try:
            command = [
                sys.executable,
                "-m",
                "gridnomad",
                "run-stream",
                "--scenario",
                str(scenario),
                "--ticks",
                "2",
                "--seed",
                "33",
                "--out",
                str(run_dir),
            ]
            result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, msg=result.stderr)
            messages = [
                json.loads(line)
                for line in result.stdout.splitlines()
                if line.strip()
            ]
            types = [message["type"] for message in messages]
            self.assertIn("run_started", types)
            self.assertIn("frame", types)
            self.assertIn("snapshot", types)
            self.assertIn("status", types)
            self.assertIn("complete", types)
            run_started = next(message for message in messages if message["type"] == "run_started")
            self.assertIn("controllers", run_started)
            first_frame = next(message for message in messages if message["type"] == "frame")
            self.assertIn("humans", first_frame)
            self.assertTrue((run_dir / "events.jsonl").exists())
            self.assertTrue((run_dir / "snapshot-0000.json").exists())
            self.assertTrue((run_dir / "snapshot-0002.json").exists())
        finally:
            shutil.rmtree(scratch_root, ignore_errors=True)

    def test_run_stream_fails_fast_when_provider_is_not_ready(self) -> None:
        scenario_path = ROOT / "scenarios" / "river_fork.json"
        scenario = json.loads(scenario_path.read_text(encoding="utf-8"))
        scenario["agents"] = [
            {
                "id": "red-human-01",
                "name": "Ada",
                "faction_id": "red",
                "personality": {"openness": 7, "conscientiousness": 6, "extraversion": 5, "agreeableness": 6, "neuroticism": 3},
                "emotions": {"Joy": 4, "Sadness": 1, "Fear": 2, "Anger": 1, "Disgust": 0, "Surprise": 3},
                "needs": {"Survival": 4, "Safety": 4, "Belonging": 5, "Esteem": 4, "Self_Actualization": 5},
                "inventory": {"food": 2, "wood": 1, "stone": 0},
            }
        ]
        scratch_root = ROOT / ".tmp-test-artifacts"
        run_dir = scratch_root / f"strict-fail-{uuid.uuid4().hex}"
        scratch_root.mkdir(exist_ok=True)
        run_dir.mkdir(parents=True, exist_ok=False)
        try:
          command = [
              sys.executable,
              "-m",
              "gridnomad",
              "run-stream",
              "--request-stdin",
              "--ticks",
              "2",
              "--out",
              str(run_dir),
          ]
          payload = {
              "scenario": scenario,
              "settings": {
                  "factions": {
                      "red": {"provider": "openai", "model": "gpt-5", "apiKey": ""},
                      "blue": {"provider": "heuristic", "model": ""}
                  }
              }
          }
          result = subprocess.run(
              command,
              cwd=ROOT,
              input=json.dumps(payload),
              capture_output=True,
              text=True,
              check=False,
          )
          self.assertNotEqual(result.returncode, 0)
          messages = [
              json.loads(line)
              for line in result.stdout.splitlines()
              if line.strip()
          ]
          types = [message["type"] for message in messages]
          self.assertIn("run_failed", types)
          self.assertFalse(any(message.get("type") == "event" and message.get("event", {}).get("kind") == "MOVE" for message in messages))
        finally:
            shutil.rmtree(scratch_root, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
