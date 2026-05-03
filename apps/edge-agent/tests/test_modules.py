from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from edge_agent import modules as modules_pkg
from edge_agent.modules import ModuleManager


class ModuleManagerTest(unittest.TestCase):
    def test_load_all_enables_persisted_modules_and_runs_on_interval(self) -> None:
        with TemporaryDirectory() as tmp:
            module_dir = Path(tmp) / "speedtest"
            module_dir.mkdir()
            (module_dir / "manifest.json").write_text(
                """
{
  "name": "speedtest",
  "version": "1.0.0",
  "description": "test module",
  "entrypoint": "module.py",
  "config_schema": {
    "intervalSeconds": { "type": "number" },
    "serverId": { "type": "string" }
  }
}
""".strip()
            )
            (module_dir / "module.py").write_text(
                """
def init(config=None):
    pass

def run():
    return {"download_mbps": 100}
""".strip()
            )

            manager = ModuleManager()
            configs = {"speedtest": {"enabled": True, "config": {"intervalSeconds": 60}}}
            with patch.object(modules_pkg, "MODULES_DIR", Path(tmp)):
                manager.load_all(configs)

            self.assertTrue(manager.is_enabled("speedtest"))
            self.assertEqual(
                manager.run_due(),
                {"speedtest": {"result": {"download_mbps": 100}}},
            )
            self.assertEqual(manager.run_due(), {})
            self.assertEqual(
                manager.run_all(),
                {"speedtest": {"result": {"download_mbps": 100}}},
            )

    def test_dispatch_command_result_is_included_in_next_due_payload(self) -> None:
        with TemporaryDirectory() as tmp:
            module_dir = Path(tmp) / "speedtest"
            module_dir.mkdir()
            (module_dir / "manifest.json").write_text(
                """
{
  "name": "speedtest",
  "version": "1.0.0",
  "description": "test module",
  "entrypoint": "module.py"
}
""".strip()
            )
            (module_dir / "module.py").write_text(
                """
def init(config=None):
    pass

def run():
    return {"download_mbps": 100}
""".strip()
            )

            manager = ModuleManager()
            configs = {"speedtest": {"enabled": True, "config": {"intervalSeconds": 3600}}}
            with patch.object(modules_pkg, "MODULES_DIR", Path(tmp)):
                manager.load_all(configs)

            self.assertEqual(
                manager.dispatch_command({"module": "speedtest", "action": "run"}),
                {"result": {"download_mbps": 100}},
            )
            self.assertEqual(
                manager.run_due(),
                {"speedtest": {"result": {"download_mbps": 100}}},
            )
            self.assertEqual(manager.run_due(), {})


if __name__ == "__main__":
    unittest.main()
