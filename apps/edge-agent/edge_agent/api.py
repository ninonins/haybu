from __future__ import annotations

import requests


def create_pairing_session(
    base_url: str, device_uid: str, device_name: str, fingerprint: str, inventory: dict
) -> dict:
    response = requests.post(
        f"{base_url}/pairing/session",
        json={
            "deviceUid": device_uid,
            "deviceName": device_name,
            "fingerprint": fingerprint,
            "meta": {"source": "python-edge-agent", "inventory": inventory},
        },
        timeout=5,
    )
    response.raise_for_status()
    return response.json()["pairing"]


def poll_pairing_status(base_url: str, code: str) -> dict:
    response = requests.get(f"{base_url}/pairing/status/{code}", timeout=5)
    response.raise_for_status()
    return response.json()["pairing"]


def poll_credential(base_url: str, code: str) -> dict | None:
    response = requests.post(
        f"{base_url}/pairing/poll-credential",
        json={"code": code},
        timeout=5
    )
    if response.status_code == 202:
        return None
    response.raise_for_status()
    return response.json()


def inventory_changed(previous: dict | None, current: dict | None) -> bool:
    return previous != current
