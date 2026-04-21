from __future__ import annotations

import json
import socket
import uuid
from pathlib import Path


def _state_file(state_dir: Path) -> Path:
    return state_dir / "state.json"


def load_state(state_dir: Path) -> dict:
    state_file = _state_file(state_dir)
    if state_file.exists():
        return json.loads(state_file.read_text())

    state = {
        "device_uid": str(uuid.uuid4()),
        "fingerprint": socket.gethostname(),
        "credential": "",
        "monitoring": {"services": []},
        "last_inventory": None,
    }
    state_file.write_text(json.dumps(state, indent=2))
    return state


def save_state(state_dir: Path, state: dict) -> None:
    _state_file(state_dir).write_text(json.dumps(state, indent=2))


def clear_credential(state_dir: Path, state: dict) -> None:
    state["credential"] = ""
    save_state(state_dir, state)
