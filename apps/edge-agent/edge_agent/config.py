from __future__ import annotations

import json
import socket
from dataclasses import dataclass
from pathlib import Path


@dataclass
class Config:
    api_base_url: str
    ws_base_url: str
    device_name: str
    heartbeat_interval_seconds: int
    state_dir: Path
    services: list[dict]


def _parse_env_file(path: str) -> dict[str, str]:
    values: dict[str, str] = {}
    current_key: str | None = None
    current_value_lines: list[str] = []
    bracket_depth = 0

    for raw_line in Path(path).read_text().splitlines():
        stripped = raw_line.strip()

        if current_key is not None:
            current_value_lines.append(raw_line)
            bracket_depth += raw_line.count("[") + raw_line.count("{")
            bracket_depth -= raw_line.count("]") + raw_line.count("}")
            if bracket_depth <= 0:
                values[current_key] = "\n".join(current_value_lines).strip()
                current_key = None
                current_value_lines = []
                bracket_depth = 0
            continue

        if not stripped or stripped.startswith("#") or "=" not in raw_line:
            continue

        key, value = raw_line.split("=", 1)
        key = key.strip()
        value = value.strip()

        if value in ("[", "{"):
            current_key = key
            current_value_lines = [value]
            bracket_depth = value.count("[") + value.count("{") - value.count("]") - value.count("}")
            continue

        values[key] = value

    if current_key is not None:
        values[current_key] = "\n".join(current_value_lines).strip()

    return values


def load_config(path: str) -> Config:
    values = _parse_env_file(path)

    state_dir = Path(values.get("STATE_DIR", ".edge-state"))
    state_dir.mkdir(parents=True, exist_ok=True)

    services = json.loads(values.get("SERVICES_JSON", "[]"))

    return Config(
        api_base_url=values.get("API_BASE_URL", "http://localhost:4000").rstrip("/"),
        ws_base_url=values.get("WS_BASE_URL", "ws://localhost:4000/ws/devices"),
        device_name=values.get("DEVICE_NAME", socket.gethostname()),
        heartbeat_interval_seconds=int(values.get("HEARTBEAT_INTERVAL_SECONDS", "30")),
        state_dir=state_dir,
        services=services,
    )
