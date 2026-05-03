"""Haybu Speedtest Module — Internet speed test using speedtest-cli.

Supports two backends (tried in order):
1. Official Ookla speedtest binary (most accurate)
2. speedtest-cli Python package (pip install speedtest-cli)

If neither is available, returns an error indicating the binary is missing.
"""
from __future__ import annotations

import json
import shutil
import subprocess
from datetime import datetime, UTC

# Module-level state
_config: dict = {}


def init(config: dict | None = None) -> None:
    global _config
    _config = config or {}


def _find_speedtest_binary() -> tuple[str | None, str | None]:
    """Find an available speedtest binary and detect its type."""
    for binary in ["speedtest", "speedtest-cli"]:
        path = shutil.which(binary)
        if not path:
            continue
        # Detect by --version (Ookla prints its name)
        try:
            result = subprocess.run([path, "--version"], capture_output=True, text=True, timeout=5)
            version_text = result.stdout + result.stderr
            if "Ookla" in version_text or "Speedtest by Ookla" in version_text:
                return path, "ookla"
        except Exception:
            pass
        # Detect by --help flags
        try:
            result = subprocess.run([path, "--help"], capture_output=True, text=True, timeout=5)
            help_text = result.stdout + result.stderr
            if "--format" in help_text:
                return path, "ookla"
            if "--json" in help_text:
                return path, "speedtest-cli"
        except Exception:
            pass
        # Fallback by name
        return path, "ookla" if binary == "speedtest" else "speedtest-cli"
    return None, None


def _run_ookla_speedtest(binary: str, server_id: str | None = None) -> dict:
    """Run official Ookla speedtest CLI and parse JSON output."""
    cmd = [binary, "--format=json", "--accept-license", "--accept-gdpr"]
    if server_id:
        cmd.extend(["--server-id", str(server_id)])

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
    )

    if result.returncode != 0:
        raise RuntimeError(f"speedtest failed: {result.stderr.strip() or 'unknown error'}")

    if not result.stdout.strip():
        raise RuntimeError(f"speedtest returned empty output (stderr: {result.stderr.strip() or 'none'})")

    data = json.loads(result.stdout)

    server = data.get("server", {})
    download = data.get("download", {})
    upload = data.get("upload", {})
    ping = data.get("ping", {})
    result_data = data.get("result", {})

    return {
        "download_mbps": round(download.get("bandwidth", 0) * 8 / 1_000_000, 2),
        "upload_mbps": round(upload.get("bandwidth", 0) * 8 / 1_000_000, 2),
        "ping_ms": round(ping.get("latency", 0), 2),
        "jitter_ms": round(ping.get("jitter", 0), 2),
        "packet_loss_percent": result_data.get("packetLoss", None),
        "server_name": server.get("name", "Unknown"),
        "server_id": server.get("id", None),
        "server_location": f"{server.get('location', 'Unknown')}, {server.get('country', 'Unknown')}",
        "isp": data.get("isp", "Unknown"),
        "timestamp": datetime.now(UTC).isoformat(),
        "backend": "ookla",
    }


def _run_speedtest_cli_package(binary: str, server_id: str | None = None) -> dict:
    """Run speedtest-cli Python package and parse output."""
    cmd = [binary, "--json"]
    if server_id:
        cmd.extend(["--server", str(server_id)])

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120,
    )

    if result.returncode != 0:
        raise RuntimeError(f"speedtest-cli failed: {result.stderr.strip() or 'unknown error'}")

    if not result.stdout.strip():
        raise RuntimeError(f"speedtest-cli returned empty output (stderr: {result.stderr.strip() or 'none'})")

    data = json.loads(result.stdout)

    server = data.get("server", {})

    return {
        "download_mbps": round(data.get("download", 0) / 1_000_000, 2),
        "upload_mbps": round(data.get("upload", 0) / 1_000_000, 2),
        "ping_ms": round(data.get("ping", 0), 2),
        "jitter_ms": None,  # speedtest-cli doesn't report jitter
        "packet_loss_percent": None,
        "server_name": server.get("sponsor", "Unknown"),
        "server_id": server.get("id", None),
        "server_location": f"{server.get('name', 'Unknown')}, {server.get('country', 'Unknown')}",
        "isp": data.get("client", {}).get("isp", "Unknown"),
        "timestamp": datetime.now(UTC).isoformat(),
        "backend": "speedtest-cli",
    }


def run() -> dict:
    """Run a speedtest and return structured results."""
    binary, backend = _find_speedtest_binary()
    if not binary:
        return {
            "error": "No speedtest binary found. Install official Ookla speedtest (https://www.speedtest.net/apps/cli) or run: pip install speedtest-cli",
            "timestamp": datetime.now(UTC).isoformat(),
        }

    server_id = _config.get("serverId") or None

    try:
        if backend == "ookla":
            return _run_ookla_speedtest(binary, server_id)
        return _run_speedtest_cli_package(binary, server_id)
    except Exception as exc:
        return {
            "error": str(exc),
            "timestamp": datetime.now(UTC).isoformat(),
        }


def teardown() -> None:
    global _config
    _config = {}
