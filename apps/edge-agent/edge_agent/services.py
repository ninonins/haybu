from __future__ import annotations

import json
import socket
import subprocess
from datetime import datetime, UTC
from urllib import request, error


SYSTEM_PROCESS_NAMES = {
    "bash",
    "zsh",
    "sh",
    "login",
    "launchd",
    "kernel_task",
    "WindowServer",
    "SystemUIServer",
    "coreservicesd",
    "coreaudiod",
    "distnoted",
    "cfprefsd",
    "notifyd",
    "runningboardd",
    "opendirectoryd",
    "securityd",
    "bluetoothd",
    "airportd",
    "mds",
    "mdworker",
    "xpcproxy",
    "Xorg",
}

CUSTOM_PROCESS_KEYWORDS = {
    "nginx",
    "node",
    "npm",
    "pnpm",
    "yarn",
    "python",
    "gunicorn",
    "uvicorn",
    "php",
    "java",
    "dotnet",
    "redis",
    "postgres",
    "mysql",
    "mongod",
    "httpd",
    "apache2",
    "caddy",
}


def _run_command(command: list[str]) -> str:
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=3, check=False)
        if completed.returncode != 0:
            return ""
        return completed.stdout.strip()
    except Exception:
        return ""


def _classify_process(name: str, command: str, user: str) -> tuple[str, int]:
    lowered_name = name.lower()
    lowered_command = command.lower()

    if any(keyword in lowered_name for keyword in CUSTOM_PROCESS_KEYWORDS):
        return ("custom", 100)
    if "/users/" in lowered_command or "/home/" in lowered_command:
        return ("custom", 95)
    if "/opt/homebrew/" in lowered_command or "/usr/local/" in lowered_command:
        return ("custom", 90)
    if "pm2" in lowered_command or "node " in lowered_command or "python" in lowered_command:
        return ("custom", 85)
    if user not in {"root", "_windowserver", "_spotlight", "_mbsetupuser"}:
        return ("custom", 75)
    if name in SYSTEM_PROCESS_NAMES:
        return ("system", 10)
    if lowered_command.startswith("/system/") or lowered_command.startswith("/usr/libexec/"):
        return ("system", 5)
    return ("system", 20)


def discover_runtime_services() -> list[dict]:
    discovered: list[dict] = []

    ps_output = _run_command(["ps", "-axo", "user=,comm=,command="])
    for line in ps_output.splitlines():
        parts = line.strip().split(None, 2)
        if len(parts) < 3:
            continue
        user, command_path, command = parts
        name = command_path.strip().split("/")[-1]
        if not name:
            continue
        classification, priority = _classify_process(name, command, user)
        discovered.append(
            {
                "name": name,
                "source": "process",
                "type": "process",
                "classification": classification,
                "priority": priority,
                "user": user,
                "command": command,
            }
        )

    docker_output = _run_command(["docker", "ps", "--format", "{{.Names}}"])
    for line in docker_output.splitlines():
        name = line.strip()
        if name:
            discovered.append({"name": name, "source": "docker", "type": "container"})

    pm2_output = _run_command(["pm2", "jlist"])
    if pm2_output:
        try:
            for process in json.loads(pm2_output):
                name = process.get("name")
                if name:
                    discovered.append({"name": name, "source": "pm2", "type": "pm2"})
        except json.JSONDecodeError:
            pass

    unique: dict[str, dict] = {}
    for item in discovered:
        key = f"{item['source']}:{item['name']}"
        current = unique.get(key)
        if current is None or item.get("priority", 0) > current.get("priority", 0):
            unique[key] = item
    return sorted(unique.values(), key=lambda item: (item["source"], -item.get("priority", 0), item["name"]))


def _check_process(service: dict) -> dict:
    process_name = service["name"]
    ps_output = _run_command(["ps", "-axo", "comm="])
    running = any(line.strip().split("/")[-1] == process_name for line in ps_output.splitlines())
    return {
        "name": process_name,
        "source": service.get("source", "process"),
        "status": "up" if running else "down",
        "reason": "" if running else "process not found",
        "checkedAt": datetime.now(UTC).isoformat(),
        "monitorMode": service.get("monitorMode", "active"),
    }


def _check_docker_container(service: dict) -> dict:
    container_name = service["name"]
    output = _run_command(["docker", "ps", "--format", "{{.Names}}"])
    running = any(line.strip() == container_name for line in output.splitlines())
    return {
        "name": container_name,
        "source": "docker",
        "status": "up" if running else "down",
        "reason": "" if running else "container not running",
        "checkedAt": datetime.now(UTC).isoformat(),
        "monitorMode": service.get("monitorMode", "active"),
    }


def _check_pm2_process(service: dict) -> dict:
    process_name = service["name"]
    output = _run_command(["pm2", "jlist"])
    running = False
    if output:
        try:
            for process in json.loads(output):
                if process.get("name") == process_name and process.get("pm2_env", {}).get("status") == "online":
                    running = True
                    break
        except json.JSONDecodeError:
            running = False
    return {
        "name": process_name,
        "source": "pm2",
        "status": "up" if running else "down",
        "reason": "" if running else "pm2 process not online",
        "checkedAt": datetime.now(UTC).isoformat(),
        "monitorMode": service.get("monitorMode", "active"),
    }


def _check_tcp(service: dict) -> dict:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(2)
    try:
        sock.connect((service["host"], int(service["port"])))
        status = "up"
        reason = ""
    except OSError as exc:
        status = "down"
        reason = str(exc)
    finally:
        sock.close()
    return {
        "name": service["name"],
        "source": service.get("source", "tcp"),
        "status": status,
        "reason": reason,
        "checkedAt": datetime.now(UTC).isoformat(),
        "monitorMode": service.get("monitorMode", "active"),
    }


def _check_http(service: dict) -> dict:
    req = request.Request(service["url"], method="GET")
    try:
        with request.urlopen(req, timeout=3) as response:
            status = "up" if 200 <= response.status < 400 else "degraded"
            reason = f"http {response.status}"
    except error.URLError as exc:
        status = "down"
        reason = str(exc)
    return {
        "name": service["name"],
        "source": service.get("source", "http"),
        "status": status,
        "reason": reason,
        "checkedAt": datetime.now(UTC).isoformat(),
        "monitorMode": service.get("monitorMode", "active"),
    }


def evaluate_services(services: list[dict]) -> list[dict]:
    results: list[dict] = []
    for service in services:
        service_type = service.get("type", "tcp")
        source = service.get("source")
        if source == "process" or service_type == "process":
            results.append(_check_process(service))
        elif source == "docker" or service_type == "container":
            results.append(_check_docker_container(service))
        elif source == "pm2" or service_type == "pm2":
            results.append(_check_pm2_process(service))
        elif service_type == "http":
            results.append(_check_http(service))
        else:
            results.append(_check_tcp(service))
    return results
