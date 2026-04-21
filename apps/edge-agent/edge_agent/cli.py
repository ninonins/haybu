from __future__ import annotations

import argparse
import json
import time
from urllib.parse import urlencode

import websocket

from .api import create_pairing_session, inventory_changed, poll_pairing_status
from .config import load_config
from .payload import build_compact_heartbeat_payload, build_system_inventory
from .services import discover_runtime_services, evaluate_services
from .state import clear_credential, load_state, save_state


def ensure_credential(config, state: dict) -> None:
    if state.get("credential"):
        return

    pairing = create_pairing_session(
        config.api_base_url,
        state["device_uid"],
        config.device_name,
        state["fingerprint"],
        build_system_inventory(),
    )
    print(f"Pairing code: {pairing['code']} (expires {pairing['expiresAt']})")
    print("Enter this code in the portal Pair Device page.")

    while True:
        status = poll_pairing_status(config.api_base_url, pairing["code"])
        if status["status"] == "paired":
            print("Pairing completed in portal, waiting for credential handoff.")
            break
        if status["status"] == "expired":
            raise RuntimeError("Pairing expired before completion")
        time.sleep(3)

    print("Paste the device credential returned by the portal:")
    state["credential"] = input("> ").strip()
    save_state(config.state_dir, state)


def heartbeat_loop(config, state: dict) -> bool:
    query = urlencode({"token": state["credential"]})
    ws_url = f"{config.ws_base_url}?{query}"
    monitor_config = state.get("monitoring", {"services": []})

    while True:
        try:
            ws = websocket.create_connection(ws_url, timeout=5)
            print("Connected to heartbeat socket.")
            try:
                initial_message = ws.recv()
                print(initial_message)
                if "unauthorized" in initial_message or "revoked" in initial_message:
                    clear_credential(config.state_dir, state)
                    return False
                try:
                    parsed = json.loads(initial_message)
                    if parsed.get("config") is not None:
                        state["monitoring"] = parsed["config"]
                        save_state(config.state_dir, state)
                        monitor_config = parsed["config"]
                except json.JSONDecodeError:
                    pass
            except Exception:
                pass

            while True:
                discovered_services = discover_runtime_services()
                if isinstance(monitor_config, dict) and "services" in monitor_config:
                    configured_services = monitor_config.get("services", [])
                else:
                    configured_services = config.services
                services = evaluate_services(configured_services)
                current_inventory = build_system_inventory()
                include_inventory = inventory_changed(state.get("last_inventory"), current_inventory)
                payload = build_compact_heartbeat_payload(
                    state["device_uid"],
                    services,
                    discovered_services,
                    include_inventory=include_inventory,
                )
                if include_inventory:
                    state["last_inventory"] = current_inventory
                    save_state(config.state_dir, state)
                ws.send(json.dumps({"type": "heartbeat", "payload": payload}))
                reply = ws.recv()
                print(reply)
                if "unauthorized" in reply or "revoked" in reply:
                    clear_credential(config.state_dir, state)
                    return False
                try:
                    parsed = json.loads(reply)
                    if parsed.get("config") is not None:
                        state["monitoring"] = parsed["config"]
                        save_state(config.state_dir, state)
                        monitor_config = parsed["config"]
                except json.JSONDecodeError:
                    pass
                time.sleep(config.heartbeat_interval_seconds)
        except Exception as exc:
            print(f"Heartbeat connection failed: {exc}")
            time.sleep(5)
            return True


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--reset-pairing", action="store_true")
    args = parser.parse_args()

    config = load_config(args.config)
    state = load_state(config.state_dir)
    if args.reset_pairing:
        clear_credential(config.state_dir, state)
        print("Cleared stored device credential. Agent will request a new pairing code.")

    while True:
        ensure_credential(config, state)
        should_retry = heartbeat_loop(config, state)
        if not should_retry:
            print("Stored credential is no longer valid. Restarting pairing flow.")
            continue


if __name__ == "__main__":
    main()
