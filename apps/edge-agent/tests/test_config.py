from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from edge_agent.config import load_config


class ConfigTest(unittest.TestCase):
    def test_load_config(self) -> None:
        with TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "edge.env"
            config_path.write_text(
                "\n".join(
                    [
                        "API_BASE_URL=http://localhost:4000",
                        "WS_BASE_URL=ws://localhost:4000/ws/devices",
                        "DEVICE_NAME=Test",
                        "HEARTBEAT_INTERVAL_SECONDS=15",
                        "STATE_DIR=.state",
                        'SERVICES_JSON=[{"name":"api","type":"tcp","host":"127.0.0.1","port":4000}]',
                    ]
                )
            )

            config = load_config(str(config_path))
            self.assertEqual(config.device_name, "Test")
            self.assertEqual(config.heartbeat_interval_seconds, 15)
            self.assertEqual(config.services[0]["name"], "api")

    def test_load_config_with_multiline_services_json(self) -> None:
        with TemporaryDirectory() as tmp:
            config_path = Path(tmp) / "edge.env"
            config_path.write_text(
                "\n".join(
                    [
                        "API_BASE_URL=http://localhost:4000",
                        "WS_BASE_URL=ws://localhost:4000/ws/devices",
                        "DEVICE_NAME=Test",
                        "HEARTBEAT_INTERVAL_SECONDS=15",
                        "STATE_DIR=.state",
                        "SERVICES_JSON=[",
                        '  {"name":"api","type":"tcp","host":"127.0.0.1","port":4000},',
                        '  {"name":"web","type":"tcp","host":"127.0.0.1","port":5174}',
                        "]",
                    ]
                )
            )

            config = load_config(str(config_path))
            self.assertEqual(len(config.services), 2)
            self.assertEqual(config.services[1]["name"], "web")


if __name__ == "__main__":
    unittest.main()
